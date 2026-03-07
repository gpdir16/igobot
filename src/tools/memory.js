import memoryStore from "../core/memory.js";

// 메모리 저장 도구
export const memorySave = {
    name: "memory_save",
    description: "중요한 정보를 영구 메모리에 저장합니다. 마크다운 파일로 저장되며, 파일명은 모델이 결정합니다. 사용자 선호도, 프로젝트 정보, 기억해야 할 사항 등을 저장하세요.",
    requiresApproval: false,
    schema: {
        type: "object",
        properties: {
            name: { type: "string", description: "메모리 파일명 (확장자 제외, 영문/한글/숫자/-_ 사용 가능). 예: user-preferences, project-info, coding-style" },
            content: { type: "string", description: "저장할 마크다운 내용" },
        },
        required: ["name", "content"],
    },
    execute(args, context) {
        const { name, content } = args;
        const result = memoryStore.add(context.chatId, name, content);
        return `메모리 저장 완료: "${result.name}.md"`;
    },
};

// 메모리 검색 도구
export const memorySearch = {
    name: "memory_search",
    description: "저장된 메모리를 검색합니다. 파일명 또는 내용에서 검색합니다. 빈 검색어로 전체 목록을 볼 수 있습니다.",
    requiresApproval: false,
    schema: {
        type: "object",
        properties: {
            query: { type: "string", description: "검색어 (빈 문자열이면 전체 목록)" },
        },
        required: ["query"],
    },
    execute(args, context) {
        const results = memoryStore.search(args.query);
        if (results.length === 0) return "검색 결과 없음";

        return results
            .map(m => `### ${m.name}.md\n${m.content}`)
            .join("\n\n---\n\n");
    },
};

// 메모리 목록 도구 (내용 포함)
export const memoryList = {
    name: "memory_list",
    description: "모든 메모리 파일과 그 내용을 반환합니다. 컨텍스트에 메모리를 다시 주입할 때 사용하세요.",
    requiresApproval: false,
    schema: {
        type: "object",
        properties: {},
        required: [],
    },
    execute(args, context) {
        const files = memoryStore.list();
        if (files.length === 0) return "저장된 메모리가 없습니다.";

        // 파일 목록과 내용 모두 반환
        let result = "메모리 파일 목록:\n";
        for (const name of files) {
            const content = memoryStore.get(name);
            result += `\n### ${name}.md\n${content}\n`;
        }
        return result;
    },
};

// 메모리 삭제 도구
export const memoryDelete = {
    name: "memory_delete",
    description: "저장된 메모리 파일을 삭제합니다.",
    requiresApproval: false,
    schema: {
        type: "object",
        properties: {
            name: { type: "string", description: "삭제할 메모리 파일명 (확장자 제외)" },
        },
        required: ["name"],
    },
    execute(args, context) {
        const removed = memoryStore.remove(args.name);
        return removed ? `메모리 삭제 완료: "${args.name}.md"` : `메모리를 찾을 수 없음: "${args.name}.md"`;
    },
};

export default [memorySave, memorySearch, memoryList, memoryDelete];