import { basename } from "node:path";
import { existsSync } from "node:fs";
import { Client, GatewayIntentBits, Partials } from "discord.js";
import BaseMessenger from "../base-messenger.js";
import config from "../../core/config.js";
import logger from "../../utils/logger.js";
import { getT } from "../../i18n.js";
import { createDiscordAccessRequest } from "./auth-store.js";

function toDiscordContent(text, maxLength = 1900) {
    const value = String(text || "");
    if (!value.trim()) return ["\u200b"];

    const parts = [];
    let current = "";

    for (const line of value.split("\n")) {
        const candidate = current ? `${current}\n${line}` : line;
        if (candidate.length <= maxLength) {
            current = candidate;
            continue;
        }

        if (current) {
            parts.push(current);
            current = "";
        }

        let remaining = line;
        while (remaining.length > maxLength) {
            parts.push(remaining.slice(0, maxLength));
            remaining = remaining.slice(maxLength);
        }
        current = remaining;
    }

    if (current) parts.push(current);
    return parts.length > 0 ? parts : ["\u200b"];
}

class DiscordMessenger extends BaseMessenger {
    constructor() {
        super({ key: "discord" });
        this.client = null;
        this._pendingApprovals = new Map();
    }

    async start(messageHandler) {
        const token = config.messengers.discord.token;
        if (!token) throw new Error(getT()("discord_bot.token_missing"));

        this.onMessage = messageHandler;
        this.client = new Client({
            intents: [GatewayIntentBits.DirectMessages, GatewayIntentBits.MessageContent],
            partials: [Partials.Channel],
        });

        this.client.once("ready", (client) => {
            logger.info(`Discord messenger started as ${client.user?.tag || client.user?.id || "unknown"}`);
        });

        this.client.on("messageCreate", async (message) => {
            if (message.author?.bot) return;
            if (message.inGuild()) {
                return;
            }

            if (await this._consumeApprovalResponse(message)) {
                return;
            }

            const access = createDiscordAccessRequest({
                userId: message.author.id,
                chatId: message.channelId,
                username: message.author.username,
                displayName: message.member?.displayName || message.author.globalName || message.author.username,
            });

            if (access.status !== "authorized") {
                if (access.isNew) {
                    logger.info(`Discord access request created: ${message.author.id} (${message.author.username}) code=${access.request.code}`);
                }
                await this.send(message.channelId, this.buildAccessRequestMessage(access.request)).catch(() => {});
                return;
            }

            const content = message.content.trim();
            if (content === "/reset") {
                this.onReset?.(message.channelId);
                await this.send(message.channelId, getT()("bot.reset"));
                return;
            }

            if (content === "/status") {
                await this.send(message.channelId, getT()("bot.status"));
                return;
            }

            const attachment = message.attachments.first();
            let normalizedMessage;

            if (attachment?.contentType?.startsWith("image/")) {
                normalizedMessage = {
                    type: "photo",
                    text: message.content || getT()("bot.photo"),
                    photoUrl: attachment.url,
                    fileId: attachment.id,
                    replyToMessageId: message.reference?.messageId || null,
                    messageId: message.id,
                };
            } else if (attachment) {
                normalizedMessage = {
                    type: "document",
                    text: message.content || getT()("bot.document", { name: attachment.name || attachment.id }),
                    fileName: attachment.name || attachment.id,
                    mimeType: attachment.contentType || null,
                    fileUrl: attachment.url,
                    fileId: attachment.id,
                    replyToMessageId: message.reference?.messageId || null,
                    messageId: message.id,
                };
            } else {
                normalizedMessage = {
                    type: "text",
                    text: message.content,
                    replyToMessageId: message.reference?.messageId || null,
                    messageId: message.id,
                };
            }

            this.emitMessage(message.channelId, normalizedMessage).catch((err) => {
                logger.error("Discord message handling error:", err);
                this.send(message.channelId, getT()("bot.error", { msg: err.message })).catch(() => {});
            });
        });

        await this.client.login(token);
    }

    async stop() {
        await this.client?.destroy();
    }

    async _getChannel(chatId) {
        if (!this.client) return null;
        return this.client.channels.cache.get(chatId) || this.client.channels.fetch(chatId).catch(() => null);
    }

    async _getMessage(chatId, messageId) {
        const channel = await this._getChannel(chatId);
        if (!channel?.messages?.fetch) return null;
        return channel.messages.fetch(messageId).catch(() => null);
    }

    async _consumeApprovalResponse(message) {
        const match = message.content.trim().match(/^(approve|deny|yolo)\s+([A-Za-z0-9_-]+)$/i);
        if (!match) return false;

        const [, action, approvalId] = match;
        const pending = this._pendingApprovals.get(approvalId);
        if (!pending || String(pending.chatId) !== String(message.channelId)) {
            return false;
        }

        if (action.toLowerCase() === "yolo") {
            this.enableYoloRun(pending.chatId);
            pending.resolve(true);
            await this.send(message.channelId, getT()("bot.yolo_on")).catch(() => {});
        } else if (action.toLowerCase() === "approve") {
            pending.resolve(true);
            await this.send(message.channelId, getT()("bot.approved")).catch(() => {});
        } else {
            pending.resolve(false);
            await this.send(message.channelId, getT()("bot.denied")).catch(() => {});
        }

        this._pendingApprovals.delete(approvalId);
        return true;
    }

    async sendTyping(chatId) {
        const channel = await this._getChannel(chatId);
        if (!channel?.sendTyping) return;
        await channel.sendTyping().catch(() => {});
    }

    async send(chatId, text) {
        const channel = await this._getChannel(chatId);
        if (!channel?.send) return;

        const parts = toDiscordContent(text);
        let lastMessageId = null;
        for (const part of parts) {
            const sent = await channel.send({ content: part });
            lastMessageId = sent.id;
        }
        return lastMessageId;
    }

    async editMessage(chatId, messageId, text) {
        const message = await this._getMessage(chatId, messageId);
        if (!message?.edit) return;
        const [firstPart] = toDiscordContent(text);
        await message.edit({ content: firstPart }).catch(() => {});
    }

    async deleteMessage(chatId, messageId) {
        const message = await this._getMessage(chatId, messageId);
        await message?.delete().catch(() => {});
    }

    async setReaction(chatId, messageId, emoji = "👍") {
        const message = await this._getMessage(chatId, messageId);
        if (!message?.react) return false;
        try {
            await message.react(emoji);
            return true;
        } catch {
            return false;
        }
    }

    async setWorkingReaction(chatId, messageId) {
        const ok = await this.setReaction(chatId, messageId, "⚡");
        return ok ? "⚡" : null;
    }

    async clearReaction(chatId, messageId) {
        const message = await this._getMessage(chatId, messageId);
        if (!message?.reactions?.cache || !this.client?.user?.id) return;

        await Promise.allSettled(
            Array.from(message.reactions.cache.values()).map((reaction) => reaction.users.remove(this.client.user.id)),
        );
    }

    async sendPhoto(chatId, photoSource, caption = "") {
        const channel = await this._getChannel(chatId);
        if (!channel?.send) return;
        const file = typeof photoSource === "string" && existsSync(photoSource)
            ? { attachment: photoSource, name: basename(photoSource) }
            : photoSource;
        const sent = await channel.send({
            content: caption || undefined,
            files: [file],
        });
        return sent.id;
    }

    async sendDocument(chatId, docSource, fileName = "", caption = "") {
        const channel = await this._getChannel(chatId);
        if (!channel?.send) return;
        const file =
            typeof docSource === "string" && existsSync(docSource)
                ? { attachment: docSource, name: fileName || basename(docSource) }
                : typeof docSource === "string"
                  ? { attachment: docSource, name: fileName || basename(docSource) }
                  : docSource;
        const sent = await channel.send({
            content: caption || undefined,
            files: [file],
        });
        return sent.id;
    }

    async requestApproval(chatId, toolName, args) {
        const approvalId = Math.random().toString(36).slice(2, 8);
        const raw = typeof args === "string" ? args : JSON.stringify(args, null, 2);
        const preview = raw.length > 1200 ? `${raw.slice(0, 1200)}\n${getT()("bot.approval_truncated")}` : raw;
        const message =
            `${getT()("bot.approval_title")}\n\n` +
            `Tool: ${toolName}\n\n` +
            "```json\n" +
            `${preview}\n` +
            "```\n" +
            `Reply with \`approve ${approvalId}\`, \`deny ${approvalId}\`, or \`yolo ${approvalId}\`.`;

        await this.send(chatId, message);

        return new Promise((resolve) => {
            this._pendingApprovals.set(approvalId, { resolve, chatId });
            setTimeout(() => {
                if (this._pendingApprovals.has(approvalId)) {
                    this._pendingApprovals.delete(approvalId);
                    resolve(false);
                }
            }, 3 * 60 * 1000);
        });
    }

    async startStream(chatId) {
        return this.send(chatId, "⏳");
    }

    async clearStream(chatId, draftId) {
        if (!draftId) return;
        await this.deleteMessage(chatId, draftId);
    }

    async updateStream(chatId, draftId, text) {
        if (!draftId || !text) return;
        await this.editMessage(chatId, draftId, text.length > 1900 ? `...${text.slice(-1800)}` : text);
    }

    async finishStream(chatId, draftId, text, toolHistory = null) {
        const parts = toDiscordContent(text);
        if (draftId) {
            const [first, ...rest] = parts;
            await this.editMessage(chatId, draftId, first);
            for (const part of rest) {
                await this.send(chatId, part);
            }
        } else {
            await this.send(chatId, text);
        }
        return draftId;
    }

    buildAccessRequestMessage(request) {
        const t = getT();
        return `${t("access.request_title")}\n\n${t("access.request_body", { code: request.code })}`;
    }
}

export default DiscordMessenger;
