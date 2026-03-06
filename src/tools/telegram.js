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
    description: "이미지 파일 또는 URL을 사용자에게 텔레그램 사진으로 전송합니다.",
    requiresApproval: false,
    schema: {
        type: "object",
        properties: {
            path: { type: "string", description: "전송할 이미지 파일 경로 (절대 경로, data/workspace/ 기준 상대 경로, 또는 HTTP URL)" },
            caption: { type: "string", description: "사진 설명 (선택)" },
        },
        required: ["path"],
    },
    async execute(args, context = {}) {
        const { path: filePath, caption = "" } = args;
        const { chatId, bot } = context;

        if (!bot) return "오류: 봇 인스턴스가 없습니다.";
        if (!chatId) return "오류: chatId가 없습니다.";

        const src = resolveSource(filePath);

        if (src.type === "local" && !existsSync(src.value)) {
            return `파일을 찾을 수 없습니다: ${src.value}`;
        }

        try {
            await bot.sendPhoto(chatId, src.value, caption);
            return `사진 전송 완료: ${filePath}`;
        } catch (err) {
            return `사진 전송 실패: ${err.message}`;
        }
    },
};

// 사용자에게 문서/파일 전송
export const sendDocument = {
    name: "send_document",
    description: "파일 또는 URL을 사용자에게 텔레그램 문서로 전송합니다. 모든 파일 형식 지원.",
    requiresApproval: false,
    schema: {
        type: "object",
        properties: {
            path: { type: "string", description: "전송할 파일 경로 (절대 경로, data/workspace/ 기준 상대 경로, 또는 HTTP URL)" },
            caption: { type: "string", description: "파일 설명 (선택)" },
        },
        required: ["path"],
    },
    async execute(args, context = {}) {
        const { path: filePath, caption = "" } = args;
        const { chatId, bot } = context;

        if (!bot) return "오류: 봇 인스턴스가 없습니다.";
        if (!chatId) return "오류: chatId가 없습니다.";

        const src = resolveSource(filePath);

        if (src.type === "local" && !existsSync(src.value)) {
            return `파일을 찾을 수 없습니다: ${src.value}`;
        }

        const fileName = src.type === "local" ? src.value.split("/").pop() : filePath.split("/").pop();
        try {
            await bot.sendDocument(chatId, src.value, fileName, caption);
            return `문서 전송 완료: ${filePath}`;
        } catch (err) {
            return `문서 전송 실패: ${err.message}`;
        }
    },
};

export default [sendPhoto, sendDocument];
