import { Telegraf, Markup } from "telegraf";
import { createReadStream, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import config from "../core/config.js";
import logger from "../utils/logger.js";
import { markdownToTelegramHtml, escapeHtml, splitAndConvert } from "../utils/markdown.js";
import { getT } from "../i18n.js";

// 텔레그램 봇 모듈 (메시지 수신, 승인, 스트리밍, 도구기록 처리)
class TelegramBot {
    constructor() {
        this.bot = null;
        this._pendingApprovals = new Map();
        this.yoloRuns = new Set();
        this.onMessage = null;
        this.onReset = null;
    }

    async start(messageHandler) {
        const token = config.telegram.token;
        if (!token) throw new Error(getT()("bot.token_missing"));

        this.bot = new Telegraf(token);
        this.onMessage = messageHandler;
        const allowedUsers = config.telegram.allowedUsers;

        // 사용자 인증 미들웨어
        this.bot.use((ctx, next) => {
            // from 없는 서비스 메시지 통과
            if (!ctx.from) return next();
            // 봇 자신이 from인 경우 통과 (pin 알림 등 서비스 메시지)
            if (ctx.from.is_bot) return next();
            const userId = String(ctx.from.id);
            if (allowedUsers.length > 0 && !allowedUsers.includes(userId)) {
                logger.warn(`Unauthorized access attempt: ${userId} (${ctx.from?.username})`);
                // 메시지가 있을 때만 접근 거부 응답
                if (ctx.message || ctx.callbackQuery) {
                    return ctx.reply(getT()("bot.access_denied"));
                }
                return;
            }
            return next();
        });

        this.bot.start((ctx) => {
            ctx.replyWithHTML(getT()("bot.start"));
        });

        this.bot.command("reset", (ctx) => {
            if (this.onReset) this.onReset(ctx.chat.id);
            ctx.reply(getT()("bot.reset"));
        });

        this.bot.command("status", (ctx) => {
            ctx.reply(getT()("bot.status"));
        });

        // ===== 승인 콜백 =====
        this.bot.action(/^approve:(.+)$/, async (ctx) => {
            const id = ctx.match[1];
            const pending = this._pendingApprovals.get(id);
            if (pending) {
                pending.resolve(true);
                this._pendingApprovals.delete(id);
                await ctx.answerCbQuery(getT()("bot.approved"));
                try {
                    await ctx.deleteMessage();
                } catch {}
            }
        });

        // YOLO: 현재 승인 + 이 작업의 나머지 도구 모두 자동 승인
        this.bot.action(/^yolo:(.+)$/, async (ctx) => {
            const id = ctx.match[1];
            const pending = this._pendingApprovals.get(id);
            if (pending) {
                this.yoloRuns.add(pending.chatId);
                pending.resolve(true);
                this._pendingApprovals.delete(id);
                await ctx.answerCbQuery(getT()("bot.yolo_on"));
                try {
                    await ctx.deleteMessage();
                } catch {}
            }
        });

        this.bot.action(/^deny:(.+)$/, async (ctx) => {
            const id = ctx.match[1];
            const pending = this._pendingApprovals.get(id);
            if (pending) {
                pending.resolve(false);
                this._pendingApprovals.delete(id);
                await ctx.answerCbQuery(getT()("bot.denied"));
                try {
                    await ctx.deleteMessage();
                } catch {}
            }
        });

        // ===== 메시지 수신 (모든 타입) — fire-and-forget =====

        this.bot.on("text", (ctx) => {
            if (!this.onMessage) return;
            const msg = {
                type: "text",
                text: ctx.message.text,
                replyToMessageId: ctx.message.reply_to_message?.message_id || null,
                messageId: ctx.message.message_id,
            };
            this.onMessage(ctx.chat.id, msg).catch((err) => {
                logger.error("Message handling error:", err);
                this.send(ctx.chat.id, getT()("bot.error", { msg: err.message })).catch(() => {});
            });
        });

        this.bot.on("photo", async (ctx) => {
            if (!this.onMessage) return;
            const photos = ctx.message.photo;
            const largest = photos[photos.length - 1];
            let photoUrl = null;
            try {
                const link = await ctx.telegram.getFileLink(largest.file_id);
                photoUrl = link.href;
            } catch {}
            const msg = {
                type: "photo",
                text: ctx.message.caption || getT()("bot.photo"),
                photoUrl,
                fileId: largest.file_id,
                replyToMessageId: ctx.message.reply_to_message?.message_id || null,
                messageId: ctx.message.message_id,
            };
            this.onMessage(ctx.chat.id, msg).catch(() => {});
        });

        this.bot.on("document", async (ctx) => {
            if (!this.onMessage) return;
            const doc = ctx.message.document;
            let fileUrl = null;
            try {
                const link = await ctx.telegram.getFileLink(doc.file_id);
                fileUrl = link.href;
            } catch {}
            const msg = {
                type: "document",
                text: ctx.message.caption || getT()("bot.document", { name: doc.file_name }),
                fileName: doc.file_name,
                mimeType: doc.mime_type,
                fileUrl,
                fileId: doc.file_id,
                replyToMessageId: ctx.message.reply_to_message?.message_id || null,
                messageId: ctx.message.message_id,
            };
            this.onMessage(ctx.chat.id, msg).catch(() => {});
        });

        this.bot.on("sticker", (ctx) => {
            if (!this.onMessage) return;
            const msg = {
                type: "sticker",
                text: getT()("bot.sticker", { emoji: ctx.message.sticker.emoji || "" }),
                replyToMessageId: ctx.message.reply_to_message?.message_id || null,
                messageId: ctx.message.message_id,
            };
            this.onMessage(ctx.chat.id, msg).catch(() => {});
        });

        this.bot.on("voice", async (ctx) => {
            if (!this.onMessage) return;
            let fileUrl = null;
            try {
                const link = await ctx.telegram.getFileLink(ctx.message.voice.file_id);
                fileUrl = link.href;
            } catch {}
            const msg = {
                type: "voice",
                text: getT()("bot.voice"),
                fileUrl,
                duration: ctx.message.voice.duration,
                replyToMessageId: ctx.message.reply_to_message?.message_id || null,
                messageId: ctx.message.message_id,
            };
            this.onMessage(ctx.chat.id, msg).catch(() => {});
        });

        this.bot.on("location", (ctx) => {
            if (!this.onMessage) return;
            const loc = ctx.message.location;
            const msg = {
                type: "location",
                text: getT()("bot.location", { lat: loc.latitude, lon: loc.longitude }),
                latitude: loc.latitude,
                longitude: loc.longitude,
                replyToMessageId: ctx.message.reply_to_message?.message_id || null,
                messageId: ctx.message.message_id,
            };
            this.onMessage(ctx.chat.id, msg).catch(() => {});
        });

        // 봇 시작
        await this.bot.launch();
        logger.info("Telegram bot started");

        process.once("SIGINT", () => this.bot.stop("SIGINT"));
        process.once("SIGTERM", () => this.bot.stop("SIGTERM"));
    }

    // ==================== 전송 API ====================

    async sendTyping(chatId) {
        if (!this.bot) return;
        try {
            await this.bot.telegram.sendChatAction(chatId, "typing");
        } catch {}
    }

    // 메시지 전송 (마크다운 자동 변환 → HTML)
    async send(chatId, text, options = {}) {
        if (!this.bot) return;
        const chunks = splitAndConvert(text, 3000);
        if (chunks.length === 0) return;
        const sendOpts = { parse_mode: "HTML", ...options };
        let lastMsgId;
        for (const chunk of chunks) {
            const msg = await this.bot.telegram.sendMessage(chatId, chunk, sendOpts);
            lastMsgId = msg.message_id;
        }
        return lastMsgId;
    }

    // 이미 HTML인 텍스트 전송 (변환 없음)
    async sendHtml(chatId, html, options = {}) {
        if (!this.bot) return;
        // HTML은 이미 변환됨 — 4000자 초과 시만 자름 (입력이 유효 HTML임을 전제)
        const MAX = 4000;
        const parts = [];
        for (let i = 0; i < html.length; i += MAX) parts.push(html.slice(i, i + MAX));
        let lastMsgId;
        for (const part of parts) {
            const msg = await this.bot.telegram.sendMessage(chatId, part, {
                parse_mode: "HTML",
                ...options,
            });
            lastMsgId = msg.message_id;
        }
        return lastMsgId;
    }

    async editMessage(chatId, messageId, text) {
        if (!this.bot) return;
        try {
            const html = markdownToTelegramHtml(text);
            await this.bot.telegram.editMessageText(chatId, messageId, undefined, html, {
                parse_mode: "HTML",
            });
        } catch (err) {
            if (!err.message?.includes("not modified")) {
                logger.debug(`editMessage failed: ${err.message}`);
            }
        }
    }

    async deleteMessage(chatId, messageId) {
        if (!this.bot) return;
        try {
            await this.bot.telegram.deleteMessage(chatId, messageId);
        } catch {}
    }

    async setReaction(chatId, messageId, emoji = "👍") {
        if (!this.bot || !messageId) return false;
        try {
            await this.bot.telegram.callApi("setMessageReaction", {
                chat_id: chatId,
                message_id: messageId,
                reaction: [{ type: "emoji", emoji }],
            });
            return true;
        } catch (err) {
            logger.debug(`setReaction failed (${emoji}): ${err.message}`);
            return false;
        }
    }

    async setWorkingReaction(chatId, messageId) {
        const ok = await this.setReaction(chatId, messageId, "⚡");
        return ok ? "⚡" : null;
    }

    async clearReaction(chatId, messageId) {
        if (!this.bot || !messageId) return;
        try {
            await this.bot.telegram.callApi("setMessageReaction", {
                chat_id: chatId,
                message_id: messageId,
                reaction: [],
            });
        } catch {}
    }

    async pinMessage(chatId, messageId, silent = true) {
        if (!this.bot) return;
        try {
            await this.bot.telegram.pinChatMessage(chatId, messageId, {
                disable_notification: silent,
            });
        } catch {}
    }

    async unpinMessage(chatId, messageId) {
        if (!this.bot) return;
        try {
            await this.bot.telegram.unpinChatMessage(chatId, { message_id: messageId });
        } catch {}
    }

    async reply(chatId, replyToMessageId, text) {
        if (!this.bot) return;
        const html = markdownToTelegramHtml(text);
        const msg = await this.bot.telegram.sendMessage(chatId, html, {
            parse_mode: "HTML",
            reply_parameters: { message_id: replyToMessageId },
        });
        return msg.message_id;
    }

    async sendPhoto(chatId, photoSource, caption = "") {
        if (!this.bot) return;
        // 로컬 파일 경로면 스트림으로 변환
        const source =
            typeof photoSource === "string" && !photoSource.startsWith("http") && existsSync(photoSource)
                ? { source: createReadStream(photoSource) }
                : photoSource;
        const msg = await this.bot.telegram.sendPhoto(chatId, source, {
            caption: caption ? markdownToTelegramHtml(caption) : undefined,
            parse_mode: "HTML",
        });
        return msg.message_id;
    }

    async sendDocument(chatId, docSource, fileName = "", caption = "") {
        if (!this.bot) return;
        // 로컬 파일 경로면 스트림으로 변환
        const source =
            typeof docSource === "string" && !docSource.startsWith("http") && existsSync(docSource)
                ? { source: createReadStream(docSource), filename: fileName || docSource.split("/").pop() }
                : docSource;
        const msg = await this.bot.telegram.sendDocument(chatId, source, {
            caption: caption ? markdownToTelegramHtml(caption) : undefined,
            parse_mode: "HTML",
        });
        return msg.message_id;
    }

    // ==================== 승인 ====================

    // 승인 요청 (HTML + 코드블록, 승인/거부 후 메시지 삭제)
    async requestApproval(chatId, toolName, args) {
        const t = getT();
        const approvalId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const raw = typeof args === "string" ? args : JSON.stringify(args, null, 2);
        const argsStr = raw.length > 1500 ? raw.slice(0, 1500) + "\n" + t("bot.approval_truncated") : raw;

        const message =
            `${t("bot.approval_title")}\n\n` +
            `<b>${t("bot.approval_tool")}</b> <code>${escapeHtml(toolName)}</code>\n` +
            `<b>${t("bot.approval_args")}</b>\n<pre>${escapeHtml(argsStr)}</pre>`;

        const sent = await this.bot.telegram.sendMessage(chatId, message, {
            parse_mode: "HTML",
            reply_markup: Markup.inlineKeyboard([
                Markup.button.callback(t("bot.approval_btn_yolo"), `yolo:${approvalId}`),
                Markup.button.callback(t("bot.approval_btn_approve"), `approve:${approvalId}`),
                Markup.button.callback(t("bot.approval_btn_deny"), `deny:${approvalId}`),
            ]).reply_markup,
        });

        return new Promise((resolve) => {
            this._pendingApprovals.set(approvalId, { resolve, msgId: sent.message_id, chatId });
            setTimeout(
                () => {
                    if (this._pendingApprovals.has(approvalId)) {
                        this._pendingApprovals.delete(approvalId);
                        this.deleteMessage(chatId, sent.message_id).catch(() => {});
                        resolve(false);
                    }
                },
                3 * 60 * 1000,
            );
        });
    }

    // ==================== 도구 기록 ====================

    // 도구 기록을 파일로만 저장
    saveToolLogToFile(toolHistory) {
        if (!toolHistory || toolHistory.length === 0) return null;
        const t = getT();

        try {
            const lines = [t("bot.tool_log_title"), "=".repeat(50), ""];
            for (const entry of toolHistory) {
                lines.push(`[${entry.name}]`);
                if (entry.args) {
                    const s = typeof entry.args === "string" ? entry.args : JSON.stringify(entry.args, null, 2);
                    lines.push(`${t("bot.tool_log_args")}\n${s}`);
                }
                if (entry.result) {
                    lines.push(`${t("bot.tool_log_result")}\n${entry.result}`);
                }
                lines.push("");
            }
            const content = lines.join("\n");

            const dir = resolve(process.cwd(), "data", "workspace", "tool_logs");
            if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
            const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
            const filename = `toollog_${timestamp}.txt`;
            const filePath = resolve(dir, filename);
            writeFileSync(filePath, content, "utf-8");

            logger.info(`Tool log saved: ${filePath}`);
            return filePath;
        } catch (err) {
            logger.error("Failed to save tool log:", err);
            return null;
        }
    }

    // ==================== 스트리밍 (공식 sendMessageDraft API) ====================

    // 스트리밍 시작: draft_id 생성/반환
    async startStream(chatId) {
        await this.sendTyping(chatId);
        // draft_id는 0이 아닌 고유 정수
        const draftId = (Date.now() % 2147483647) + 1;
        // 초기 드래프트 전송
        try {
            await this.bot.telegram.callApi("sendMessageDraft", {
                chat_id: chatId,
                draft_id: draftId,
                text: "⏳",
            });
        } catch (err) {
            logger.debug(`sendMessageDraft failed (init): ${err.message}`);
        }
        return draftId;
    }

    // 스트리밍 업데이트: 같은 draft_id로 텍스트 갱신
    async updateStream(chatId, draftId, text) {
        if (!text || text.length === 0) return;
        const raw = text.length > 3800 ? "..." + text.slice(-3700) : text;
        const html = markdownToTelegramHtml(raw);
        try {
            await this.bot.telegram.callApi("sendMessageDraft", {
                chat_id: chatId,
                draft_id: draftId,
                text: html,
                parse_mode: "HTML",
            });
        } catch (err) {
            logger.debug(`sendMessageDraft update failed: ${err.message}`);
        }
    }

    // 스트리밍 종료: 최종 메시지를 sendMessage로 확정
    async finishStream(chatId, draftId, text, toolHistory = null) {
        // 드래프트를 빈 텍스트로 제거 (선택적)
        try {
            await this.bot.telegram.callApi("sendMessageDraft", {
                chat_id: chatId,
                draft_id: draftId,
                text: " ",
            });
        } catch {}

        // 도구 기록이 있으면 파일로만 저장 (전송하지 않음)
        if (toolHistory && toolHistory.length > 0) {
            this.saveToolLogToFile(toolHistory);
        }
        return this.send(chatId, text);
    }
}

export default TelegramBot;
