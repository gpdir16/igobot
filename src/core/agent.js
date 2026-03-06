import CodexClient from "../llm/codex-client.js";
import ModuleLoader from "./module-loader.js";
import config from "./config.js";
import memoryStore from "./memory.js";
import { needsCompression, compressContext } from "./context-compressor.js";
import logger from "../utils/logger.js";

const SYSTEM_PROMPT = `당신은 igobot이라는 자율 AI 에이전트입니다.
사용자의 요청을 수행하기 위해 제공된 도구들을 자유롭게 사용하세요.

**중요 — 실행 환경:**
- 이것은 서버에서 실행되는 에이전트입니다. GUI나 화면이 없습니다.
- 사용자에게 보여줄 모든 내용은 반드시 텔레그램 메시지로 전송해야 합니다.
- 코드 실행 결과, 파일 내용 등도 사용자에게 텍스트로 전달하세요.
- **파일 작업(write_file, delete_file)은 data/workspace/ 디렉토리 내에서만 가능합니다.** 이 경로를 기준으로 상대 경로를 사용하세요.
- 사용자가 이미지를 보내면 직접 볼 수 있습니다. 이미지 분석이 가능합니다.

사용 가능한 도구:
- run_terminal: 터미널에서 셸 명령 실행
- read_file: 파일 내용 읽기
- list_directory: 디렉토리 내용 목록
- search_files: 파일에서 텍스트 검색
- write_file: 파일 생성/수정 (data/workspace/ 기준)
- delete_file: 파일 삭제 (data/workspace/ 기준)
- browser_fetch: 웹페이지 내용 가져오기
- browser_interact: 웹페이지 인터랙션
- send_photo: 로컬 파일 또는 URL을 사용자에게 사진으로 전송
- send_document: 로컬 파일 또는 URL을 사용자에게 문서로 전송
- memory_save: 중요 정보를 영구 메모리에 저장
- memory_search: 저장된 메모리 검색
- memory_delete: 저장된 메모리 삭제

행동 원칙:
1. 요청을 분석하고 필요한 정보를 도구로 수집하세요.
2. 중요한 정보(사용자 선호, 프로젝트 정보, 기억해야 할 사항)는 memory_save로 저장하세요.
3. 이전 대화에서 언급된 정보가 필요하면 memory_search로 찾으세요.
4. 작업 결과를 명확하고 간결하게 보고하세요.
5. 파일(사진, 문서 등)을 생성/다운로드했으면 send_photo 또는 send_document로 사용자에게 직접 전송하세요.
6. 한국어로 응답하세요.

웹 스크래핑 규칙:
- 웹 데이터 수집은 반드시 정식 브라우저 도구를 사용하세요.
- BeautifulSoup, requests, scrapy 등 스크립트 작성 및 실행 절대 금지.`;

// 에이전트 코어 (LLM-도구 루프, 스트리밍, 컨텍스트 압축, 메모리)
class Agent {
    constructor() {
        this.llm = new CodexClient();
        this.moduleLoader = new ModuleLoader();
        this.conversations = new Map();
        this.pendingMessages = new Map();
        this.running = new Map();

        // 텔레그램 봇 인터페이스 (index.js에서 주입)
        this.bot = null;
    }

    async init() {
        await this.moduleLoader.loadTools();
        logger.info(`에이전트 초기화 완료 (도구 ${this.moduleLoader.tools.size}개)`);
    }

    // 스킬 지시문(SKILL.md 본문)을 시스템 프롬프트에 추가
    addSkillSection(section) {
        if (!section) return;
        this._skillSection = section;
    }

    getConversation(chatId) {
        if (!this.conversations.has(chatId)) {
            this.conversations.set(chatId, []);
        }
        return this.conversations.get(chatId);
    }

    resetConversation(chatId) {
        this.conversations.delete(chatId);
        this.pendingMessages.delete(chatId);
        this.llm.resetSession();
        logger.info(`대화 초기화: ${chatId}`);
    }

    // 대기 중인 새 메시지를 컨텍스트에 반영
    _drainPendingMessages(chatId, messages) {
        const queue = this.pendingMessages.get(chatId);
        if (!queue || queue.length === 0) return [];

        const drainedMessages = [];
        while (queue.length > 0) {
            const msg = queue.shift();
            messages.push({ role: "user", content: msg.text || `[${msg.type}]` });
            drainedMessages.push(msg);
        }
        return drainedMessages;
    }

    // 사용자 메시지 처리 (실행 중이면 큐에 적재)
    async handleMessage(chatId, userMsg) {
        const messageText = typeof userMsg === "string" ? userMsg : userMsg.text || `[${userMsg.type}]`;
        const messageId = typeof userMsg === "object" ? userMsg.messageId : null;
        const processedMessageIds = new Set();

        if (messageId) {
            processedMessageIds.add(messageId);
            if (this.bot) {
                await this.bot.setReaction(chatId, messageId, "👀");
            }
        }

        // 이미 에이전트가 실행 중이면 큐에 추가
        if (this.running.get(chatId)) {
            if (!this.pendingMessages.has(chatId)) {
                this.pendingMessages.set(chatId, []);
            }
            this.pendingMessages.get(chatId).push(typeof userMsg === "string" ? { type: "text", text: userMsg } : userMsg);
            logger.info(`[${chatId}] 에이전트 실행 중 — 대기 큐에 추가: ${messageText.slice(0, 50)}`);
            return;
        }

        this.running.set(chatId, true);

        try {
            const idsFromRun = await this._runAgentLoop(chatId, userMsg);
            if (Array.isArray(idsFromRun)) {
                for (const id of idsFromRun) {
                    if (id) processedMessageIds.add(id);
                }
            }
        } finally {
            if (this.bot) {
                for (const id of processedMessageIds) {
                    await this.bot.clearReaction(chatId, id);
                }
            }
            this.running.set(chatId, false);

            // 대기 큐에 남은 메시지가 있으면 다시 실행
            const queue = this.pendingMessages.get(chatId);
            if (queue && queue.length > 0) {
                const nextMsg = queue.shift();
                // 재귀적으로 실행 (비동기)
                this.handleMessage(chatId, nextMsg).catch((err) => {
                    logger.error("대기 메시지 처리 오류:", err);
                });
            }
        }
    }

    // 실제 에이전트 루프
    async _runAgentLoop(chatId, userMsg) {
        const messages = this.getConversation(chatId);
        const messageText = typeof userMsg === "string" ? userMsg : userMsg.text || `[${userMsg.type}]`;

        // 사진 메시지는 vision 배열 content로, 문서/음성은 텍스트로
        let userContent;
        if (userMsg.type === "photo" && userMsg.photoUrl) {
            // LLM이 이미지를 직접 볼 수 있도록 input_image 타입 포함
            userContent = [
                { type: "input_image", image_url: userMsg.photoUrl },
                { type: "input_text", text: messageText || "이 이미지를 분석해주세요." },
            ];
        } else if (userMsg.type === "document" && userMsg.fileUrl) {
            userContent = `[문서 업로드됨: ${userMsg.fileName} — ${userMsg.fileUrl}]\n${messageText}`;
        } else if (userMsg.type === "voice") {
            userContent = `[음성 메시지: ${userMsg.fileUrl || ""}]\n${messageText}`;
        } else {
            userContent = messageText;
        }

        messages.push({ role: "user", content: userContent });

        // 메모리를 시스템 프롬프트에 포함
        const memorySummary = memoryStore.getSummaryForPrompt(chatId);
        const instructions = SYSTEM_PROMPT + (this._skillSection || "") + memorySummary;

        const tools = this.moduleLoader.getToolSchemas();
        const maxIterations = config.agent.maxIterations;
        let iteration = 0;
        const processedMessageIds = new Set();
        const workingReactionMessageIds = new Set();
        if (typeof userMsg === "object" && userMsg.messageId) {
            processedMessageIds.add(userMsg.messageId);
        }

        // 도구 사용 기록
        const toolHistory = [];

        // API에서 반환된 실제 input 토큰 수 (마지막 성공한 호출 기준)
        let lastActualInputTokens = null;

        // 스트리밍 메시지
        let streamMsgId = null;
        if (this.bot) {
            streamMsgId = await this.bot.startStream(chatId);
        }

        // 스트리밍 업데이트 throttle
        let lastStreamUpdate = 0;
        const STREAM_INTERVAL = 1500; // ms

        while (iteration < maxIterations) {
            iteration++;
            logger.info(`에이전트 루프 ${iteration}/${maxIterations}`);

            // 이번 모델 호출 전에 도착한 메시지를 우선 컨텍스트에 반영
            const preDrained = this._drainPendingMessages(chatId, messages);
            for (const msg of preDrained) {
                if (msg?.messageId) processedMessageIds.add(msg.messageId);
            }
            if (preDrained.length > 0) {
                lastActualInputTokens = null;
            }

            // 컨텍스트 압축 체크 (실제 API 토큰값 우선 사용)
            // 우선순위: 직전 동일 컨텍스트의 모델 API 실제값 > 추정값
            const contextWindowLimit = this.llm.contextWindow ?? config.agent.contextWindow;
            if (needsCompression(messages, contextWindowLimit, lastActualInputTokens)) {
                logger.info("컨텍스트 압축 시작...");
                if (this.bot && streamMsgId) {
                    await this.bot.updateStream(chatId, streamMsgId, "🔄 대화 내용을 정리하고 있습니다...");
                }
                const compressed = await compressContext(messages, this.llm);
                messages.length = 0;
                messages.push(...compressed);
                this.conversations.set(chatId, messages);
                lastActualInputTokens = null;
            }

            // typing 표시
            if (this.bot) await this.bot.sendTyping(chatId);

            try {
                if (this.bot) {
                    for (const id of processedMessageIds) {
                        if (!workingReactionMessageIds.has(id)) {
                            await this.bot.setWorkingReaction(chatId, id);
                            workingReactionMessageIds.add(id);
                        }
                    }
                }

                // 스트리밍 콜백 설정
                const onDelta = (text) => {
                    if (this.bot && streamMsgId) {
                        const now = Date.now();
                        if (now - lastStreamUpdate > STREAM_INTERVAL) {
                            lastStreamUpdate = now;
                            this.bot.updateStream(chatId, streamMsgId, text).catch(() => {});
                        }
                    }
                };

                const response = await this.llm.chat({
                    instructions,
                    messages,
                    tools,
                    onDelta,
                });

                // 실제 토큰 사용량 기록 (다음 반복의 압축 판단에 사용)
                if (response.usage?.input_tokens) {
                    lastActualInputTokens = response.usage.input_tokens;
                }

                // 도구 호출
                if (response.toolCalls.length > 0) {
                    // 도구 호출이 있으면 메시지 컨텍스트가 바뀌므로 이전 토큰값 무효화
                    lastActualInputTokens = null;

                    // 스트리밍 메시지에 도구 사용 중 표시
                    if (this.bot && streamMsgId) {
                        const toolNames = response.toolCalls.map((t) => t.name).join(", ");
                        await this.bot.updateStream(chatId, streamMsgId, `🔧 도구 사용 중: ${toolNames}`);
                    }

                    let interruptedByPending = false;
                    const flushPendingAfterTool = () => {
                        const drainedMessages = this._drainPendingMessages(chatId, messages);
                        for (const msg of drainedMessages) {
                            if (msg?.messageId) processedMessageIds.add(msg.messageId);
                        }
                        const drained = drainedMessages.length > 0;
                        if (drained) {
                            lastActualInputTokens = null;
                            logger.info(`[${chatId}] 새 대기 메시지 우선 처리 — 남은 도구 호출 보류`);
                        }
                        return drained;
                    };

                    for (const toolCall of response.toolCalls) {
                        logger.info(`도구 호출: ${toolCall.name}`);

                        messages.push({
                            type: "function_call",
                            name: toolCall.name,
                            arguments: toolCall.arguments,
                            call_id: toolCall.call_id,
                        });

                        let args;
                        try {
                            args = typeof toolCall.arguments === "string" ? JSON.parse(toolCall.arguments) : toolCall.arguments;
                        } catch {
                            const errMsg = `도구 인자 파싱 실패: ${toolCall.arguments}`;
                            messages.push({ role: "tool", call_id: toolCall.call_id, content: errMsg });
                            toolHistory.push({ name: toolCall.name, args: toolCall.arguments, result: errMsg });
                            if (flushPendingAfterTool()) {
                                interruptedByPending = true;
                                break;
                            }
                            continue;
                        }

                        // 승인 필요 여부 (트러스트 모드이면 자동 승인)
                        const tool = this.moduleLoader.getTool(toolCall.name);
                        const yolo = this.bot?.yoloRuns?.has(chatId);
                        if (tool?.requiresApproval && this.bot && !yolo) {
                            const approved = await this.bot.requestApproval(chatId, toolCall.name, args);
                            if (!approved) {
                                const denyMsg = "사용자가 실행을 거부했습니다.";
                                messages.push({ role: "tool", call_id: toolCall.call_id, content: denyMsg });
                                toolHistory.push({ name: toolCall.name, args, result: denyMsg });
                                if (flushPendingAfterTool()) {
                                    interruptedByPending = true;
                                    break;
                                }
                                continue;
                            }
                        }

                        // 도구 실행
                        try {
                            const result = await this.moduleLoader.executeTool(toolCall.name, args, { chatId, bot: this.bot });
                            const resultStr = typeof result === "string" ? result : JSON.stringify(result);

                            messages.push({ role: "tool", call_id: toolCall.call_id, content: resultStr });
                            toolHistory.push({ name: toolCall.name, args, result: resultStr });
                        } catch (err) {
                            logger.error(`도구 실행 오류: ${toolCall.name}`, err);
                            const errStr = `도구 실행 오류: ${err.message}`;
                            messages.push({ role: "tool", call_id: toolCall.call_id, content: errStr });
                            toolHistory.push({ name: toolCall.name, args, result: errStr });
                        }

                        if (flushPendingAfterTool()) {
                            interruptedByPending = true;
                            break;
                        }
                    }

                    // 중단되지 않았다면 마지막으로 한 번 더 대기 메시지 반영
                    if (!interruptedByPending) {
                        const drainedMessages = this._drainPendingMessages(chatId, messages);
                        for (const msg of drainedMessages) {
                            if (msg?.messageId) processedMessageIds.add(msg.messageId);
                        }
                    }

                    continue; // 다음 루프
                }

                // 텍스트 응답 (루프 종료)
                if (response.text) {
                    messages.push({ role: "assistant", content: response.text });

                    if (this.bot && streamMsgId) {
                        // 대기 중인 메시지가 있으면 현재 응답을 표시하지 않고
                        // 에이전트 컨텍스트에만 미표시 사실을 기록
                        const pendingQueue = this.pendingMessages.get(chatId);
                        if (pendingQueue && pendingQueue.length > 0) {
                            try {
                                await this.bot.bot.telegram.callApi("sendMessageDraft", {
                                    chat_id: chatId,
                                    draft_id: streamMsgId,
                                    text: " ",
                                });
                            } catch {}
                            streamMsgId = null;
                            // LLM이 다음 턴에 상황을 인지하도록 컨텍스트에 주입
                            messages.push({
                                role: "user",
                                content: "[시스템: 위 응답은 새 메시지 도착으로 인해 사용자에게 표시되지 않았습니다. 이어지는 메시지를 처리하세요.]",
                            });
                        } else {
                            await this.bot.finishStream(chatId, streamMsgId, response.text, toolHistory.length > 0 ? toolHistory : null);
                            streamMsgId = null;
                        }
                    }
                } else if (this.bot && streamMsgId) {
                    // 빈 응답 — 드래프트 제거
                    try {
                        await this.bot.bot.telegram.callApi("sendMessageDraft", {
                            chat_id: chatId,
                            draft_id: streamMsgId,
                            text: " ",
                        });
                    } catch {}
                    streamMsgId = null;
                }

                // 정상 완료 — yolo 해제
                this.bot?.yoloRuns?.delete(chatId);
                break;
            } catch (err) {
                logger.error("에이전트 루프 오류:", err);
                this.bot?.yoloRuns?.delete(chatId);
                if (this.bot) {
                    if (streamMsgId) {
                        // 드래프트 제거 후 에러 메시지 전송
                        try {
                            await this.bot.bot.telegram.callApi("sendMessageDraft", {
                                chat_id: chatId,
                                draft_id: streamMsgId,
                                text: " ",
                            });
                        } catch {}
                        streamMsgId = null;
                    }
                    await this.bot.send(chatId, `⚠️ 에이전트 오류: ${err.message}`);
                }
                break;
            }
        }

        if (iteration >= maxIterations) {
            logger.warn("에이전트 최대 반복 도달");
            this.bot?.yoloRuns?.delete(chatId);
            if (this.bot) {
                if (streamMsgId) {
                    try {
                        await this.bot.bot.telegram.callApi("sendMessageDraft", {
                            chat_id: chatId,
                            draft_id: streamMsgId,
                            text: " ",
                        });
                    } catch {}
                }
                await this.bot.send(chatId, "⚠️ 최대 작업 반복에 도달했습니다.");
            }
        }

        return Array.from(processedMessageIds);
    }
}

export default Agent;
