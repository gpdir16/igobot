import { existsSync } from "node:fs";
import { resolve } from "node:path";

const WORKSPACE_DIR = resolve(process.cwd(), "data", "workspace");

// 경로 또는 URL을 sendPhoto/sendDocument에 넘길 수 있는 소스로 변환
function resolveSource(filePath, fileName = "") {
    // HTTP URL이면 그대로 반환 (Telegram Bot API가 직접 다운로드)
    if (filePath.startsWith("http://") || filePath.startsWith("https://")) {
        return { type: "url", value: filePath };
    }
    // 절대 경로 또는 workspace 기준 상대 경로
    const absPath = filePath.startsWith("/") ? resolve(filePath) : resolve(WORKSPACE_DIR, filePath);
    return { type: "local", value: absPath };
}

// 사용자에게 사진 파일 전송 (context.bot 필요)
export const sendPhoto = {
    name: "send_photo",
    description: "Sends an image file or URL to the user as a Telegram photo.",
    requiresApproval: false,
    schema: {
        type: "object",
        properties: {
            path: { type: "string", description: "Image file path (absolute, data/workspace/-relative, or HTTP URL)" },
            caption: { type: "string", description: "Photo caption (optional)" },
        },
        required: ["path"],
    },
    async execute(args, context = {}) {
        const { path: filePath, caption = "" } = args;
        const { chatId, bot } = context;

        if (!bot) return "Error: bot instance not available.";
        if (!chatId) return "Error: chatId not available.";

        const src = resolveSource(filePath);

        if (src.type === "local" && !existsSync(src.value)) {
            return `File not found: ${src.value}`;
        }

        try {
            await bot.sendPhoto(chatId, src.value, caption);
            return `Photo sent: ${filePath}`;
        } catch (err) {
            return `Failed to send photo: ${err.message}`;
        }
    },
};

// 사용자에게 문서/파일 전송
export const sendDocument = {
    name: "send_document",
    description: "Sends a file or URL to the user as a Telegram document. Supports all file types.",
    requiresApproval: false,
    schema: {
        type: "object",
        properties: {
            path: { type: "string", description: "File path (absolute, data/workspace/-relative, or HTTP URL)" },
            caption: { type: "string", description: "File caption (optional)" },
        },
        required: ["path"],
    },
    async execute(args, context = {}) {
        const { path: filePath, caption = "" } = args;
        const { chatId, bot } = context;

        if (!bot) return "Error: bot instance not available.";
        if (!chatId) return "Error: chatId not available.";

        const src = resolveSource(filePath);

        if (src.type === "local" && !existsSync(src.value)) {
            return `File not found: ${src.value}`;
        }

        const fileName = src.type === "local" ? src.value.split("/").pop() : filePath.split("/").pop();
        try {
            await bot.sendDocument(chatId, src.value, fileName, caption);
            return `Document sent: ${filePath}`;
        } catch (err) {
            return `Failed to send document: ${err.message}`;
        }
    },
};

export default [sendPhoto, sendDocument];
