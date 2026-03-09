import { Telegraf, Markup } from "telegraf";
import { createReadStream, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import config from "../../core/config.js";
import { TOOL_LOG_DIR } from "../../core/app-paths.js";
import { getT } from "../../i18n.js";
import logger from "../../utils/logger.js";
import { escapeHtml, markdownToTelegramHtml, splitAndConvert } from "../../utils/markdown.js";
import BaseMessenger from "../base-messenger.js";
import { createTelegramAccessRequest } from "./auth-store.js";

class TelegramMessenger extends BaseMessenger {
    constructor() {
        super({ key: "telegram" });
        this.bot = null;
        this._pendingApprovals = new Map();
    }

    async start(messageHandler) {
        const token = config.messengers.telegram.token;
        if (!token) throw new Error(getT()("bot.token_missing"));

        this.bot = new Telegraf(token);
        this.onMessage = messageHandler;

        this.bot.use(async (ctx, next) => {
            if (!ctx.from) return next();
            if (ctx.from.is_bot) return next();

            const access = createTelegramAccessRequest({
                userId: ctx.from.id,
                chatId: ctx.chat?.id ?? ctx.from.id,
                username: ctx.from.username,
                firstName: ctx.from.first_name,
                lastName: ctx.from.last_name,
            });

            if (access.status === "authorized") {
                return next();
            }

            if (access.isNew) {
                logger.info(
                    `Telegram access request created: ${ctx.from.id} (${ctx.from.username || "no_username"}) code=${access.request.code}`,
                );
            }

            if (ctx.callbackQuery) {
                try {
                    await ctx.answerCbQuery(getT()("access.pending_short"), { show_alert: true });
                } catch {}
                return;
            }

            if (ctx.chat?.id) {
                try {
                    await ctx.replyWithHTML(this.buildAccessRequestMessage(access.request));
                } catch (err) {
                    logger.warn(`Failed to send Telegram access request message: ${err.message}`);
                }
            }
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

        this.bot.action(/^yolo:(.+)$/, async (ctx) => {
            const id = ctx.match[1];
            const pending = this._pendingApprovals.get(id);
            if (pending) {
                this.enableYoloRun(pending.chatId);
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

        this.bot.on("text", (ctx) => {
            const msg = {
                type: "text",
                text: ctx.message.text,
                replyToMessageId: ctx.message.reply_to_message?.message_id || null,
                messageId: ctx.message.message_id,
            };
            this.emitMessage(ctx.chat.id, msg).catch((err) => {
                logger.error("Message handling error:", err);
                this.send(ctx.chat.id, getT()("bot.error", { msg: err.message })).catch(() => {});
            });
        });

        this.bot.on("photo", async (ctx) => {
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
            this.emitMessage(ctx.chat.id, msg).catch(() => {});
        });

        this.bot.on("document", async (ctx) => {
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
            this.emitMessage(ctx.chat.id, msg).catch(() => {});
        });

        this.bot.on("sticker", (ctx) => {
            const msg = {
                type: "sticker",
                text: getT()("bot.sticker", { emoji: ctx.message.sticker.emoji || "" }),
                replyToMessageId: ctx.message.reply_to_message?.message_id || null,
                messageId: ctx.message.message_id,
            };
            this.emitMessage(ctx.chat.id, msg).catch(() => {});
        });

        this.bot.on("voice", async (ctx) => {
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
            this.emitMessage(ctx.chat.id, msg).catch(() => {});
        });

        this.bot.on("location", (ctx) => {
            const loc = ctx.message.location;
            const msg = {
                type: "location",
                text: getT()("bot.location", { lat: loc.latitude, lon: loc.longitude }),
                latitude: loc.latitude,
                longitude: loc.longitude,
                replyToMessageId: ctx.message.reply_to_message?.message_id || null,
                messageId: ctx.message.message_id,
            };
            this.emitMessage(ctx.chat.id, msg).catch(() => {});
        });

        await this.bot.launch();
        logger.info("Telegram messenger started");
    }

    stop(reason = "shutdown") {
        this.bot?.stop(reason);
    }

    async sendTyping(chatId) {
        if (!this.bot) return;
        try {
            await this.bot.telegram.sendChatAction(chatId, "typing");
        } catch {}
    }

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

    async sendHtml(chatId, html, options = {}) {
        if (!this.bot) return;
        const maxLength = 4000;
        const parts = [];
        for (let i = 0; i < html.length; i += maxLength) parts.push(html.slice(i, i + maxLength));
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

    async sendPhoto(chatId, photoSource, caption = "") {
        if (!this.bot) return;
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

    async requestApproval(chatId, toolName, args) {
        if (!this.bot) return false;
        const t = getT();
        const approvalId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const raw = typeof args === "string" ? args : JSON.stringify(args, null, 2);
        const argsStr = raw.length > 1500 ? `${raw.slice(0, 1500)}\n${t("bot.approval_truncated")}` : raw;

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
            this._pendingApprovals.set(approvalId, { resolve, chatId, msgId: sent.message_id });
            setTimeout(() => {
                if (this._pendingApprovals.has(approvalId)) {
                    this._pendingApprovals.delete(approvalId);
                    this.deleteMessage(chatId, sent.message_id).catch(() => {});
                    resolve(false);
                }
            }, 3 * 60 * 1000);
        });
    }

    saveToolLogToFile(toolHistory) {
        if (!toolHistory || toolHistory.length === 0) return null;
        const t = getT();

        try {
            const lines = [t("bot.tool_log_title"), "=".repeat(50), ""];
            for (const entry of toolHistory) {
                lines.push(`[${entry.name}]`);
                if (entry.args) {
                    const value = typeof entry.args === "string" ? entry.args : JSON.stringify(entry.args, null, 2);
                    lines.push(`${t("bot.tool_log_args")}\n${value}`);
                }
                if (entry.result) {
                    lines.push(`${t("bot.tool_log_result")}\n${entry.result}`);
                }
                lines.push("");
            }
            const content = lines.join("\n");

            const dir = TOOL_LOG_DIR;
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

    async startStream(chatId) {
        await this.sendTyping(chatId);
        const draftId = (Date.now() % 2147483647) + 1;
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

    async clearStream(chatId, draftId) {
        if (!this.bot || !draftId) return;
        try {
            await this.bot.telegram.callApi("sendMessageDraft", {
                chat_id: chatId,
                draft_id: draftId,
                text: " ",
            });
        } catch {}
    }

    async updateStream(chatId, draftId, text) {
        if (!this.bot || !text) return;
        const raw = text.length > 3800 ? `...${text.slice(-3700)}` : text;
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

    async finishStream(chatId, draftId, text, toolHistory = null) {
        await this.clearStream(chatId, draftId);

        if (toolHistory && toolHistory.length > 0) {
            this.saveToolLogToFile(toolHistory);
        }
        return this.send(chatId, text);
    }

    buildAccessRequestMessage(request) {
        const t = getT();
        return (
            `<b>${escapeHtml(t("access.request_title"))}</b>\n\n` +
            `${escapeHtml(t("access.request_body", { code: request.code }))}`
                .replace(/igobot ok ([A-Z0-9]+)/g, "<code>igobot ok $1</code>")
                .replace(/\n/g, "\n")
        );
    }
}

export default TelegramMessenger;
