import memoryStore from "../core/memory.js";

// 메모리 저장 도구
export const memorySave = {
    name: "memory_save",
    description: "중요한 정보를 영구 메모리에 저장합니다. 사용자 선호도, 프로젝트 정보, 기억해야 할 사항 등을 저장하세요.",
    requiresApproval: false,
    schema: {
        type: "object",
        properties: {
            key: { type: "string", description: "메모리 키 (간략한 제목)" },
            value: { type: "string", description: "저장할 내용" },
            tags: {
                type: "array",
                items: { type: "string" },
                description: "태그 (선택, 검색용)",
            },
        },
        required: ["key", "value"],
    },
    execute(args, context) {
        const chatId = context.chatId;
        const { key, value, tags = [] } = args;
        memoryStore.add(chatId, key, value, tags);
        return `메모리 저장 완료: "${key}"`;
    },
};

// 메모리 검색 도구
export const memorySearch = {
    name: "memory_search",
    description: "저장된 메모리를 검색합니다. 이전에 저장한 정보를 찾을 때 사용하세요.",
    requiresApproval: false,
    schema: {
        type: "object",
        properties: {
            query: { type: "string", description: "검색어 (빈 문자열이면 전체 목록)" },
        },
        required: ["query"],
    },
    execute(args, context) {
        const chatId = context.chatId;
        const results = memoryStore.search(chatId, args.query);
        if (results.length === 0) return "검색 결과 없음";
        return results.map((e) => `[${e.key}] ${e.value}${e.tags.length > 0 ? ` (${e.tags.join(", ")})` : ""}`).join("\n");
    },
};

// 메모리 삭제 도구
export const memoryDelete = {
    name: "memory_delete",
    description: "저장된 메모리를 삭제합니다.",
    requiresApproval: false,
    schema: {
        type: "object",
        properties: {
            key: { type: "string", description: "삭제할 메모리 키" },
        },
        required: ["key"],
    },
    execute(args, context) {
        const chatId = context.chatId;
        const removed = memoryStore.remove(chatId, args.key);
        return removed ? `메모리 삭제 완료: "${args.key}"` : `메모리를 찾을 수 없음: "${args.key}"`;
    },
};

export default [memorySave, memorySearch, memoryDelete];
