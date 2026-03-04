import { existsSync } from "node:fs";
import { resolve } from "node:path";

const WORKSPACE_DIR = resolve(process.cwd(), "data", "workspace");

/**
 * 사용자에게 사진 파일 전송
 * context.bot (TelegramBot 인스턴스) 이 필요함
 */
export const sendPhoto = {
    name: "send_photo",
    description: "로컬 파일을 사용자에게 텔레그램 사진으로 전송합니다. 이미지 파일 경로를 지정하세요.",
    requiresApproval: false,
    schema: {
        type: "object",
        properties: {
            path: { type: "string", description: "전송할 이미지 파일 경로 (절대 또는 data/workspace/ 기준 상대 경로)" },
            caption: { type: "string", description: "사진 설명 (선택)" },
        },
        required: ["path"],
    },
    async execute(args, context = {}) {
        const { path: filePath, caption = "" } = args;
        const { chatId, bot } = context;

        if (!bot) return "오류: 봇 인스턴스가 없습니다.";
        if (!chatId) return "오류: chatId가 없습니다.";

        const absPath = filePath.startsWith("/") ? resolve(filePath) : resolve(WORKSPACE_DIR, filePath);
        if (!existsSync(absPath)) return `파일을 찾을 수 없습니다: ${absPath}`;

        try {
            await bot.sendPhoto(chatId, absPath, caption);
            return `사진 전송 완료: ${absPath}`;
        } catch (err) {
            return `사진 전송 실패: ${err.message}`;
        }
    },
};

/**
 * 사용자에게 문서/파일 전송
 */
export const sendDocument = {
    name: "send_document",
    description: "로컬 파일을 사용자에게 텔레그램 문서로 전송합니다. 모든 파일 형식 지원.",
    requiresApproval: false,
    schema: {
        type: "object",
        properties: {
            path: { type: "string", description: "전송할 파일 경로 (절대 또는 data/workspace/ 기준 상대 경로)" },
            caption: { type: "string", description: "파일 설명 (선택)" },
        },
        required: ["path"],
    },
    async execute(args, context = {}) {
        const { path: filePath, caption = "" } = args;
        const { chatId, bot } = context;

        if (!bot) return "오류: 봇 인스턴스가 없습니다.";
        if (!chatId) return "오류: chatId가 없습니다.";

        const absPath = filePath.startsWith("/") ? resolve(filePath) : resolve(WORKSPACE_DIR, filePath);
        if (!existsSync(absPath)) return `파일을 찾을 수 없습니다: ${absPath}`;

        const fileName = absPath.split("/").pop();
        try {
            await bot.sendDocument(chatId, absPath, fileName, caption);
            return `문서 전송 완료: ${absPath}`;
        } catch (err) {
            return `문서 전송 실패: ${err.message}`;
        }
    },
};

export default [sendPhoto, sendDocument];
