import CodexClient from "../llm/codex-client.js";
import ModuleLoader from "./module-loader.js";
import config from "./config.js";
import memoryStore from "./memory.js";
import { needsCompression, compressContext } from "./context-compressor.js";
import logger from "../utils/logger.js";
import { getT } from "../i18n.js";

// 에이전트 코어 (LLM-도구 루프, 스트리밍, 컨텍스트 압축, 메모리)
class Agent {
    constructor() {
        this.llm = new CodexClient();
        this.moduleLoader = new ModuleLoader();
        this.conversations = new Map();
        this.pendingMessages = new Map();
        this.running = new Map();
        // chatId → Map<skillName, skillBody> — 대화별 로드된 스킬 추적
        this.loadedSkills = new Map();

        // 텔레그램 봇 인터페이스 (index.js에서 주입)
        this.bot = null;
        // 스킬 로더 (index.js에서 주입)
        this._skillLoader = null;
    }

    async init() {
        await this.moduleLoader.loadTools();
        logger.info(`Agent initialized (${this.moduleLoader.tools.size} tools)`);
    }

    // 스킬 로더 주입 (지연 로딩 방식)
    setSkillLoader(skillLoader) {
        this._skillLoader = skillLoader;
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
        this.loadedSkills.delete(chatId);
        this.llm.resetSession();
        logger.info(`Conversation reset: ${chatId}`);
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
            logger.info(`[${chatId}] Agent running — queued: ${messageText.slice(0, 50)}`);
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
                    logger.error("Pending message processing error:", err);
                });
            }
        }
    }

    // 실제 에이전트 루프
    async _runAgentLoop(chatId, userMsg) {
        const t = getT();
        const messages = this.getConversation(chatId);
        const messageText = typeof userMsg === "string" ? userMsg : userMsg.text || `[${userMsg.type}]`;

        // 사진 메시지는 vision 배열 content로, 문서/음성은 텍스트로
        let userContent;
        if (userMsg.type === "photo" && userMsg.photoUrl) {
            // LLM이 이미지를 직접 볼 수 있도록 input_image 타입 포함
            userContent = [
                { type: "input_image", image_url: userMsg.photoUrl },
                { type: "input_text", text: messageText || t("agent.image_prompt") },
            ];
        } else if (userMsg.type === "document" && userMsg.fileUrl) {
            userContent = t("agent.document_label", { name: userMsg.fileName, url: userMsg.fileUrl }) + "\n" + messageText;
        } else if (userMsg.type === "voice") {
            userContent = t("agent.voice_label", { url: userMsg.fileUrl || "" }) + "\n" + messageText;
        } else {
            userContent = messageText;
        }

        messages.push({ role: "user", content: userContent });

        // 메모리를 시스템 프롬프트에 포함 (모든 메모리 파일 내용 주입)
        const memoryContext = memoryStore.getAllForContext();

        // 스킬 레지스트리 섹션 (항상 포함 — 이름+설명만, 토큰 최소화)
        let skillRegistrySection = "";
        if (this._skillLoader) {
            const skillList = this._skillLoader.getSkillList();
            if (skillList.length > 0) {
                const listStr = skillList.map((s) => `- **${s.name}**: ${s.description}`).join("\n");
                skillRegistrySection = `\n\n---\n# 스킬 시스템\n필요한 스킬은 \`list_skills\`로 목록을 확인하고 \`load_skill\`로 로드하세요.\n\n${listStr}`;
            }
        }

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
            logger.info(`Agent loop ${iteration}/${maxIterations}`);

            // 매 이터레이션마다 instructions 재구성 (스킬이 로드될 때 즉시 반영)
            const chatLoadedSkills = this.loadedSkills.get(chatId);
            let loadedSkillSection = "";
            if (chatLoadedSkills && chatLoadedSkills.size > 0) {
                const sections = [];
                for (const [name, body] of chatLoadedSkills) {
                    sections.push(`## 스킬: ${name}\n${body}`);
                }
                loadedSkillSection = `\n\n---\n# 로드된 스킬\n\n${sections.join("\n\n---\n\n")}`;
            }
            const instructions = t("system_prompt") + skillRegistrySection + loadedSkillSection + memoryContext;

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
                logger.info("Starting context compression...");
                if (this.bot && streamMsgId) {
                    await this.bot.updateStream(chatId, streamMsgId, t("agent.context_compressing"));
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
                    lastActualInputTokens = null;

                    let interruptedByPending = false;
                    const flushPendingAfterTool = () => {
                        const drainedMessages = this._drainPendingMessages(chatId, messages);
                        for (const msg of drainedMessages) {
                            if (msg?.messageId) processedMessageIds.add(msg.messageId);
                        }
                        const drained = drainedMessages.length > 0;
                        if (drained) {
                            lastActualInputTokens = null;
                            logger.info(`[${chatId}] New pending message — deferring remaining tool calls`);
                        }
                        return drained;
                    };

                    for (const toolCall of response.toolCalls) {
                        logger.info(`Tool call: ${toolCall.name}`);

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
                            const errMsg = `Tool args parse error: ${toolCall.arguments}`;
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
                                const denyMsg = t("agent.denied");
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
                            const result = await this.moduleLoader.executeTool(toolCall.name, args, {
                                chatId,
                                bot: this.bot,
                                skillLoader: this._skillLoader,
                            });

                            // 스킬 로드 결과 감지: __skillContent가 있으면 loadedSkills에 저장
                            let resultStr;
                            if (result && typeof result === "object" && result.__skillContent) {
                                if (!this.loadedSkills.has(chatId)) {
                                    this.loadedSkills.set(chatId, new Map());
                                }
                                this.loadedSkills.get(chatId).set(result.__skillName, result.__skillContent);
                                resultStr = result.message;
                                logger.info(`[${chatId}] Skill loaded: ${result.__skillName}`);
                            } else {
                                resultStr = typeof result === "string" ? result : JSON.stringify(result);
                            }

                            messages.push({ role: "tool", call_id: toolCall.call_id, content: resultStr });
                            toolHistory.push({ name: toolCall.name, args, result: resultStr });
                        } catch (err) {
                            logger.error(`Tool execution error: ${toolCall.name}`, err);
                            const errStr = t("agent.tool_error", { msg: err.message });
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
                                content: t("agent.interrupted"),
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
                logger.error("Agent loop error:", err);
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
                    await this.bot.send(chatId, t("agent.error", { msg: err.message }));
                }
                break;
            }
        }

        if (iteration >= maxIterations) {
            logger.warn("Agent max iterations reached");
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
                await this.bot.send(chatId, t("agent.max_iter"));
            }
        }

        return Array.from(processedMessageIds);
    }
}

export default Agent;
