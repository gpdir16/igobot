import { randomUUID } from 'node:crypto';
import { ensureValidToken } from './codex-auth.js';
import config from '../core/config.js';
import logger from '../utils/logger.js';

const CODEX_ENDPOINT = 'https://chatgpt.com/backend-api/codex/responses';

/**
 * Codex API 클라이언트
 * ChatGPT 구독의 Codex OAuth를 통해 LLM 응답을 생성한다.
 */
class CodexClient {
  constructor() {
    this.sessionId = randomUUID();
  }

  /**
   * 대화 메시지를 Responses API 입력 형식으로 변환
   */
  _convertMessages(messages) {
    return messages.map(msg => {
      if (msg.role === 'user') {
        return {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text: msg.content }]
        };
      }
      if (msg.role === 'assistant') {
        return {
          type: 'message',
          role: 'assistant',
          content: [{ type: 'output_text', text: msg.content }]
        };
      }
      if (msg.role === 'tool') {
        return {
          type: 'function_call_output',
          call_id: msg.call_id,
          output: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
        };
      }
      // function_call (assistant tool_calls)
      if (msg.type === 'function_call') {
        return {
          type: 'function_call',
          name: msg.name,
          arguments: typeof msg.arguments === 'string' ? msg.arguments : JSON.stringify(msg.arguments),
          call_id: msg.call_id
        };
      }
      return msg;
    });
  }

  /**
   * LLM 응답 생성 (SSE 스트림 파싱)
   * @param {object} options
   * @param {string} options.instructions - 시스템 프롬프트
   * @param {Array} options.messages - 대화 메시지
   * @param {Array} options.tools - 도구 스키마
   * @param {Function} [options.onDelta] - 텍스트 델타 콜백 (스트리밍용)
   * @returns {Promise<{text: string, toolCalls: Array, usage: object}>}
   */
  async chat({ instructions, messages, tools = [], onDelta = null }) {
    const tokens = await ensureValidToken();

    const body = {
      model: config.llm.model,
      instructions,
      input: this._convertMessages(messages),
      tools: tools.map(t => ({
        type: 'function',
        name: t.name,
        description: t.description,
        parameters: t.parameters || {}
      })),
      tool_choice: tools.length > 0 ? 'auto' : undefined,
      parallel_tool_calls: false,
      store: false,
      stream: true,
      reasoning: {
        effort: config.llm.reasoningEffort,
        summary: 'auto'
      },
      prompt_cache_key: this.sessionId
    };

    logger.debug(`Codex 요청: model=${body.model}, messages=${messages.length}, tools=${tools.length}`);

    const res = await fetch(CODEX_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        'chatgpt-account-id': tokens.account_id,
        'OpenAI-Beta': 'responses=experimental',
        'session_id': this.sessionId
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Codex API 오류 ${res.status}: ${errBody}`);
    }

    return this._parseSSE(res, onDelta);
  }

  /**
   * SSE 응답 스트림 파싱
   * @param {Response} response
   * @param {Function|null} onDelta - 텍스트 델타 콜백
   */
  async _parseSSE(response, onDelta = null) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    let textParts = [];
    let reasoningParts = [];
    let toolCalls = [];
    let usage = null;
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // 마지막 불완전한 줄은 버퍼에 유지

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') continue;

        try {
          const event = JSON.parse(data);

          switch (event.type) {
            case 'response.output_text.delta':
              textParts.push(event.delta);
              if (onDelta) {
                try { onDelta(textParts.join('')); } catch {}
              }
              break;

            case 'response.reasoning_summary_text.delta':
              reasoningParts.push(event.delta);
              break;

            case 'response.output_item.done':
              if (event.item?.type === 'function_call') {
                toolCalls.push({
                  call_id: event.item.call_id,
                  name: event.item.name,
                  arguments: event.item.arguments
                });
              }
              break;

            case 'response.completed':
              usage = event.response?.usage || null;
              break;

            case 'response.failed':
              throw new Error(`Codex 응답 실패: ${JSON.stringify(event)}`);
          }
        } catch (err) {
          if (err.message.startsWith('Codex')) throw err;
          // JSON 파싱 실패는 무시 (불완전한 청크)
        }
      }
    }

    const text = textParts.join('');
    const reasoning = reasoningParts.join('');

    logger.debug(`Codex 응답: text=${text.length}자, toolCalls=${toolCalls.length}, reasoning=${reasoning.length}자`);
    if (usage) {
      logger.info(`토큰 사용: input=${usage.input_tokens}, output=${usage.output_tokens}`);
    }

    return { text, reasoning, toolCalls, usage };
  }

  /**
   * 새 세션 시작
   */
  resetSession() {
    this.sessionId = randomUUID();
  }
}

export default CodexClient;
