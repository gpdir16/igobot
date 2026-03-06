import { randomUUID } from "node:crypto";
import { ensureValidToken } from "./codex-auth.js";
import config from "../core/config.js";
import logger from "../utils/logger.js";

const CODEX_ENDPOINT = "https://chatgpt.com/backend-api/codex/responses";

// Codex API 클라이언트 (Codex OAuth 기반)
class CodexClient {
    constructor() {
        this.sessionId = randomUUID();
        // context_length_exceeded 에러 발생 시 파싱되어 설정됨 (null이면 미감지)
        this.contextWindow = null;
    }

    // 에러 메시지에서 컨텍스트 윈도우 파싱
    _parseContextWindowFromError(errText) {
        // "maximum context length is 128000 tokens"
        const m = errText.match(/(?:maximum |max |context[ _](?:window|length|size)(?:[^\d]*))?(\d{4,7})(?:\s*tokens?)/i);
        if (m) {
            const val = parseInt(m[1]);
            if (val > 1000) return val;
        }
        return null;
    }

    // 대화 메시지를 Responses API 입력 형식으로 변환
    _convertMessages(messages) {
        return messages.map((msg) => {
            if (msg.role === "user") {
                // content가 배열이면 그대로 사용 (vision 입력 포함 가능)
                const content = Array.isArray(msg.content)
                    ? msg.content
                    : [{ type: "input_text", text: msg.content }];
                return {
                    type: "message",
                    role: "user",
                    content,
                };
            }
            if (msg.role === "assistant") {
                return {
                    type: "message",
                    role: "assistant",
                    content: [{ type: "output_text", text: msg.content }],
                };
            }
            if (msg.role === "tool") {
                return {
                    type: "function_call_output",
                    call_id: msg.call_id,
                    output: typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content),
                };
            }
            // function_call (assistant tool_calls)
            if (msg.type === "function_call") {
                return {
                    type: "function_call",
                    name: msg.name,
                    arguments: typeof msg.arguments === "string" ? msg.arguments : JSON.stringify(msg.arguments),
                    call_id: msg.call_id,
                };
            }
            return msg;
        });
    }

    // LLM 응답 생성 (SSE 스트림 파싱)
    async chat({ instructions, messages, tools = [], onDelta = null }) {
        const tokens = await ensureValidToken();

        const body = {
            model: config.llm.model,
            instructions,
            input: this._convertMessages(messages),
            tools: tools.map((t) => ({
                type: "function",
                name: t.name,
                description: t.description,
                parameters: t.parameters || {},
            })),
            tool_choice: tools.length > 0 ? "auto" : undefined,
            parallel_tool_calls: false,
            store: false,
            stream: true,
            reasoning: {
                effort: config.llm.reasoningEffort,
                summary: "auto",
            },
            prompt_cache_key: this.sessionId,
        };

        logger.debug(`Codex 요청: model=${body.model}, messages=${messages.length}, tools=${tools.length}`);

        const res = await fetch(CODEX_ENDPOINT, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${tokens.access_token}`,
                "Content-Type": "application/json",
                Accept: "text/event-stream",
                "chatgpt-account-id": tokens.account_id,
                "OpenAI-Beta": "responses=experimental",
                session_id: this.sessionId,
            },
            body: JSON.stringify(body),
        });

        if (!res.ok) {
            const errBody = await res.text();
            // context length 초과 에러에서 실제 한도 파싱
            const cw = this._parseContextWindowFromError(errBody);
            if (cw) {
                this.contextWindow = cw;
                logger.info(`컨텍스트 윈도우 감지 (HTTP 에러 파싱): ${cw.toLocaleString()} tokens`);
            }
            throw new Error(`Codex API 오류 ${res.status}: ${errBody}`);
        }

        return this._parseSSE(res, onDelta);
    }

    // SSE 응답 스트림 파싱
    async _parseSSE(response, onDelta = null) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        let textParts = [];
        let reasoningParts = [];
        let toolCalls = [];
        let usage = null;
        let buffer = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop(); // 마지막 불완전한 줄은 버퍼에 유지

            for (const line of lines) {
                if (!line.startsWith("data: ")) continue;
                const data = line.slice(6).trim();
                if (data === "[DONE]") continue;

                try {
                    const event = JSON.parse(data);

                    switch (event.type) {
                        case "response.output_text.delta":
                            textParts.push(event.delta);
                            if (onDelta) {
                                try {
                                    onDelta(textParts.join(""));
                                } catch {}
                            }
                            break;

                        case "response.reasoning_summary_text.delta":
                            reasoningParts.push(event.delta);
                            break;

                        case "response.output_item.done":
                            if (event.item?.type === "function_call") {
                                toolCalls.push({
                                    call_id: event.item.call_id,
                                    name: event.item.name,
                                    arguments: event.item.arguments,
                                });
                            }
                            break;

                        case "response.completed": {
                            const resp = event.response || {};
                            usage = resp.usage || null;
                            const meta = {
                                id: resp.id,
                                model: resp.model,
                                status: resp.status,
                                truncation: resp.truncation,
                                service_tier: resp.service_tier,
                                usage: resp.usage,
                            };
                            logger.debug(`response.completed: ${JSON.stringify(meta)}`);
                            break;
                        }

                        case "response.failed": {
                            const failMsg = JSON.stringify(event);
                            // context length 초과 에러에서 실제 한도 파싱
                            const cw = this._parseContextWindowFromError(failMsg);
                            if (cw) {
                                this.contextWindow = cw;
                                logger.info(`컨텍스트 윈도우 감지 (response.failed 파싱): ${cw.toLocaleString()} tokens`);
                            }
                            throw new Error(`Codex 응답 실패: ${failMsg}`);
                        }
                    }
                } catch (err) {
                    if (err.message.startsWith("Codex")) throw err;
                    // JSON 파싱 실패는 무시 (불완전한 청크)
                }
            }
        }

        const text = textParts.join("");
        const reasoning = reasoningParts.join("");

        logger.debug(`Codex 응답: text=${text.length}자, toolCalls=${toolCalls.length}, reasoning=${reasoning.length}자`);
        if (usage) {
            logger.info(
                `토큰 사용: input=${usage.input_tokens} (캐시=${usage.input_tokens_details?.cached_tokens ?? 0}), output=${usage.output_tokens} (추론=${usage.output_tokens_details?.reasoning_tokens ?? 0})`,
            );
        }

        return { text, reasoning, toolCalls, usage };
    }

    // 새 세션 시작
    resetSession() {
        this.sessionId = randomUUID();
    }
}

export default CodexClient;
