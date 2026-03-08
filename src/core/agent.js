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
        // sessionId → Map<skillName, skillBody> — 대화별 로드된 스킬 추적
        this.loadedSkills = new Map();

        this.messengers = new Map();
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

    registerMessenger(messenger) {
        if (!messenger?.key) {
            throw new Error("Messenger key is required.");
        }
        this.messengers.set(messenger.key, messenger);
    }

    registerMessengers(messengers = []) {
        for (const messenger of messengers) {
            this.registerMessenger(messenger);
        }
    }

    getMessenger(messengerKey) {
        return this.messengers.get(messengerKey) || null;
    }

    getDefaultMessenger() {
        return this.messengers.size === 1 ? Array.from(this.messengers.values())[0] : null;
    }

    getSessionId(messengerKey, chatId) {
        return `${messengerKey}:${String(chatId)}`;
    }

    getConversation(sessionId) {
        if (!this.conversations.has(sessionId)) {
            this.conversations.set(sessionId, []);
        }
        return this.conversations.get(sessionId);
    }

    resetConversation(sessionIdOrMessengerKey, chatId = null) {
        const sessionId = chatId === null ? sessionIdOrMessengerKey : this.getSessionId(sessionIdOrMessengerKey, chatId);
        this.conversations.delete(sessionId);
        this.pendingMessages.delete(sessionId);
        this.loadedSkills.delete(sessionId);
        this.llm.resetSession();
        logger.info(`Conversation reset: ${sessionId}`);
    }

    // 대기 중인 새 메시지를 컨텍스트에 반영
    _drainPendingMessages(sessionId, messages) {
        const queue = this.pendingMessages.get(sessionId);
        if (!queue || queue.length === 0) return [];

        const drainedMessages = [];
        while (queue.length > 0) {
            const msg = queue.shift();
            messages.push({ role: "user", content: msg.text || `[${msg.type}]` });
            drainedMessages.push(msg);
        }
        return drainedMessages;
    }

    _normalizeMessageContext(messageContextOrChatId, userMsg) {
        if (typeof messageContextOrChatId === "object" && messageContextOrChatId !== null && "message" in messageContextOrChatId) {
            const messenger = messageContextOrChatId.messenger || this.getMessenger(messageContextOrChatId.messengerKey);
            const messengerKey = messageContextOrChatId.messengerKey || messenger?.key || "default";
            const chatId = messageContextOrChatId.chatId;
            return {
                messenger,
                messengerKey,
                chatId,
                sessionId: messageContextOrChatId.sessionId || this.getSessionId(messengerKey, chatId),
                message: messageContextOrChatId.message,
            };
        }

        const messenger = this.getDefaultMessenger();
        const messengerKey = messenger?.key || "default";
        const chatId = messageContextOrChatId;
        return {
            messenger,
            messengerKey,
            chatId,
            sessionId: this.getSessionId(messengerKey, chatId),
            message: userMsg,
        };
    }

    // 사용자 메시지 처리 (실행 중이면 큐에 적재)
    async handleMessage(messageContextOrChatId, userMsg) {
        const context = this._normalizeMessageContext(messageContextOrChatId, userMsg);
        const { messenger, chatId, sessionId, message } = context;
        const messageText = typeof message === "string" ? message : message.text || `[${message.type}]`;
        const messageId = typeof message === "object" ? message.messageId : null;
        const processedMessageIds = new Set();

        if (messageId) {
            processedMessageIds.add(messageId);
            if (messenger) {
                await messenger.setReaction(chatId, messageId, "👀");
            }
        }

        // 이미 에이전트가 실행 중이면 큐에 추가
        if (this.running.get(sessionId)) {
            if (!this.pendingMessages.has(sessionId)) {
                this.pendingMessages.set(sessionId, []);
            }
            this.pendingMessages.get(sessionId).push(typeof message === "string" ? { type: "text", text: message } : message);
            logger.info(`[${sessionId}] Agent running — queued: ${messageText.slice(0, 50)}`);
            return;
        }

        this.running.set(sessionId, true);

        try {
            const idsFromRun = await this._runAgentLoop({ messenger, chatId, sessionId, userMsg: message });
            if (Array.isArray(idsFromRun)) {
                for (const id of idsFromRun) {
                    if (id) processedMessageIds.add(id);
                }
            }
        } finally {
            if (messenger) {
                for (const id of processedMessageIds) {
                    await messenger.clearReaction(chatId, id);
                }
            }
            this.running.set(sessionId, false);

            // 대기 큐에 남은 메시지가 있으면 다시 실행
            const queue = this.pendingMessages.get(sessionId);
            if (queue && queue.length > 0) {
                const nextMsg = queue.shift();
                this.handleMessage({ messenger, messengerKey: messenger?.key, chatId, sessionId, message: nextMsg }).catch((err) => {
                    logger.error("Pending message processing error:", err);
                });
            }
        }
    }

    // 실제 에이전트 루프
    async _runAgentLoop({ messenger, chatId, sessionId, userMsg }) {
        const t = getT();
        const messages = this.getConversation(sessionId);
        const messageText = typeof userMsg === "string" ? userMsg : userMsg.text || `[${userMsg.type}]`;
        const messageType = typeof userMsg === "object" ? userMsg.type : "text";

        // 사진 메시지는 vision 배열 content로, 문서/음성은 텍스트로
        let userContent;
        if (messageType === "photo" && userMsg.photoUrl) {
            userContent = [
                { type: "input_image", image_url: userMsg.photoUrl },
                { type: "input_text", text: messageText || t("agent.image_prompt") },
            ];
        } else if (messageType === "document" && userMsg.fileUrl) {
            userContent = t("agent.document_label", { name: userMsg.fileName, url: userMsg.fileUrl }) + "\n" + messageText;
        } else if (messageType === "voice") {
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
                const listStr = skillList.map((skill) => `- **${skill.name}**: ${skill.description}`).join("\n");
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
        if (messenger) {
            streamMsgId = await messenger.startStream(chatId);
        }

        // 스트리밍 업데이트 throttle
        let lastStreamUpdate = 0;
        const STREAM_INTERVAL = 1500;

        while (iteration < maxIterations) {
            iteration++;
            logger.info(`Agent loop ${iteration}/${maxIterations}`);

            // 매 이터레이션마다 instructions 재구성 (스킬이 로드될 때 즉시 반영)
            const chatLoadedSkills = this.loadedSkills.get(sessionId);
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
            const preDrained = this._drainPendingMessages(sessionId, messages);
            for (const msg of preDrained) {
                if (msg?.messageId) processedMessageIds.add(msg.messageId);
            }
            if (preDrained.length > 0) {
                lastActualInputTokens = null;
            }

            // 컨텍스트 압축 체크 (실제 API 토큰값 우선 사용)
            const contextWindowLimit = this.llm.contextWindow ?? config.agent.contextWindow;
            if (needsCompression(messages, contextWindowLimit, lastActualInputTokens)) {
                logger.info("Starting context compression...");
                if (messenger && streamMsgId) {
                    await messenger.updateStream(chatId, streamMsgId, t("agent.context_compressing"));
                }
                const compressed = await compressContext(messages, this.llm);
                messages.length = 0;
                messages.push(...compressed);
                this.conversations.set(sessionId, messages);
                lastActualInputTokens = null;
            }

            if (messenger) await messenger.sendTyping(chatId);

            try {
                if (messenger) {
                    for (const id of processedMessageIds) {
                        if (!workingReactionMessageIds.has(id)) {
                            await messenger.setWorkingReaction(chatId, id);
                            workingReactionMessageIds.add(id);
                        }
                    }
                }

                const onDelta = (text) => {
                    if (messenger && streamMsgId) {
                        const now = Date.now();
                        if (now - lastStreamUpdate > STREAM_INTERVAL) {
                            lastStreamUpdate = now;
                            messenger.updateStream(chatId, streamMsgId, text).catch(() => {});
                        }
                    }
                };

                const response = await this.llm.chat({
                    instructions,
                    messages,
                    tools,
                    onDelta,
                });

                if (response.usage?.input_tokens) {
                    lastActualInputTokens = response.usage.input_tokens;
                }

                if (response.toolCalls.length > 0) {
                    lastActualInputTokens = null;

                    let interruptedByPending = false;
                    const flushPendingAfterTool = () => {
                        const drainedMessages = this._drainPendingMessages(sessionId, messages);
                        for (const msg of drainedMessages) {
                            if (msg?.messageId) processedMessageIds.add(msg.messageId);
                        }
                        const drained = drainedMessages.length > 0;
                        if (drained) {
                            lastActualInputTokens = null;
                            logger.info(`[${sessionId}] New pending message — deferring remaining tool calls`);
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

                        const tool = this.moduleLoader.getTool(toolCall.name);
                        const yolo = messenger?.hasYoloRun(chatId);
                        if (tool?.requiresApproval && messenger && !yolo) {
                            const approved = await messenger.requestApproval(chatId, toolCall.name, args);
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

                        try {
                            const result = await this.moduleLoader.executeTool(toolCall.name, args, {
                                chatId,
                                bot: messenger,
                                messenger,
                                messengerKey: messenger?.key,
                                sessionId,
                                skillLoader: this._skillLoader,
                            });

                            let resultStr;
                            if (result && typeof result === "object" && result.__skillContent) {
                                if (!this.loadedSkills.has(sessionId)) {
                                    this.loadedSkills.set(sessionId, new Map());
                                }
                                this.loadedSkills.get(sessionId).set(result.__skillName, result.__skillContent);
                                resultStr = result.message;
                                logger.info(`[${sessionId}] Skill loaded: ${result.__skillName}`);
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

                    if (!interruptedByPending) {
                        const drainedMessages = this._drainPendingMessages(sessionId, messages);
                        for (const msg of drainedMessages) {
                            if (msg?.messageId) processedMessageIds.add(msg.messageId);
                        }
                    }

                    continue;
                }

                if (response.text) {
                    messages.push({ role: "assistant", content: response.text });

                    if (messenger && streamMsgId) {
                        const pendingQueue = this.pendingMessages.get(sessionId);
                        if (pendingQueue && pendingQueue.length > 0) {
                            await messenger.clearStream(chatId, streamMsgId);
                            streamMsgId = null;
                            messages.push({
                                role: "user",
                                content: t("agent.interrupted"),
                            });
                        } else {
                            await messenger.finishStream(chatId, streamMsgId, response.text, toolHistory.length > 0 ? toolHistory : null);
                            streamMsgId = null;
                        }
                    }
                } else if (messenger && streamMsgId) {
                    await messenger.clearStream(chatId, streamMsgId);
                    streamMsgId = null;
                }

                messenger?.clearYoloRun(chatId);
                break;
            } catch (err) {
                logger.error("Agent loop error:", err);
                messenger?.clearYoloRun(chatId);
                if (messenger) {
                    if (streamMsgId) {
                        await messenger.clearStream(chatId, streamMsgId);
                        streamMsgId = null;
                    }
                    await messenger.send(chatId, t("agent.error", { msg: err.message }));
                }
                break;
            }
        }

        if (iteration >= maxIterations) {
            logger.warn("Agent max iterations reached");
            messenger?.clearYoloRun(chatId);
            if (messenger) {
                if (streamMsgId) {
                    await messenger.clearStream(chatId, streamMsgId);
                }
                await messenger.send(chatId, t("agent.max_iter"));
            }
        }

        return Array.from(processedMessageIds);
    }
}

export default Agent;
