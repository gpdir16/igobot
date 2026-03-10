import memoryStore from "../core/memory.js";

// 메모리 저장 도구
export const memorySave = {
    name: "memory_save",
    description: "Saves important information to persistent memory as a markdown file. Use for user preferences, project details, or anything worth remembering across conversations.",
    requiresApproval: false,
    schema: {
        type: "object",
        properties: {
            name: { type: "string", description: "Memory file name (no extension). Examples: user-preferences, project-info, coding-style" },
            content: { type: "string", description: "Markdown content to save" },
        },
        required: ["name", "content"],
    },
    execute(args, context) {
        const { name, content } = args;
        const result = memoryStore.add(context.chatId, name, content);
        return `Memory saved: "${result.name}.md"`;
    },
};

// 메모리 검색 도구
export const memorySearch = {
    name: "memory_search",
    description: "Searches saved memories by file name or content. Use an empty query to list all memories.",
    requiresApproval: false,
    schema: {
        type: "object",
        properties: {
            query: { type: "string", description: "Search query (empty string to list all)" },
        },
        required: ["query"],
    },
    execute(args, context) {
        const results = memoryStore.search(args.query);
        if (results.length === 0) return "No results found.";

        return results
            .map(m => `### ${m.name}.md\n${m.content}`)
            .join("\n\n---\n\n");
    },
};

// 메모리 목록 도구 (내용 포함)
export const memoryList = {
    name: "memory_list",
    description: "Returns all memory files and their contents for inspection.",
    requiresApproval: false,
    schema: {
        type: "object",
        properties: {},
        required: [],
    },
    execute(args, context) {
        const files = memoryStore.list();
        if (files.length === 0) return "No saved memories.";

        // 파일 목록과 내용 모두 반환
        let result = "Memory files:\n";
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
    description: "Deletes a saved memory file.",
    requiresApproval: false,
    schema: {
        type: "object",
        properties: {
            name: { type: "string", description: "Memory file name to delete (no extension)" },
        },
        required: ["name"],
    },
    execute(args, context) {
        const removed = memoryStore.remove(args.name);
        return removed ? `Memory deleted: "${args.name}.md"` : `Memory not found: "${args.name}.md"`;
    },
};

export default [memorySave, memorySearch, memoryList, memoryDelete];
