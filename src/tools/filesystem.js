import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, mkdirSync, unlinkSync } from "node:fs";
import { resolve, join, relative } from "node:path";

const WORKSPACE_DIR = resolve(process.cwd(), "data", "workspace");
// 시작 시 workspace 디렉토리 보장
if (!existsSync(WORKSPACE_DIR)) mkdirSync(WORKSPACE_DIR, { recursive: true });

function isWithinDir(targetPath, baseDir) {
    return targetPath === baseDir || targetPath.startsWith(baseDir + "/");
}

function resolveManagedPath(filePath, inWorkspace = true) {
    if (inWorkspace) {
        const absPath = filePath.startsWith("/") ? resolve(filePath) : resolve(WORKSPACE_DIR, filePath);
        if (!isWithinDir(absPath, WORKSPACE_DIR)) {
            return {
                error: `Error: when inWorkspace is true, the path must stay inside data/workspace/. (requested: ${filePath})`,
            };
        }
        return { absPath };
    }

    const absPath = filePath.startsWith("/") ? resolve(filePath) : resolve(process.cwd(), filePath);
    return { absPath };
}

// 파일시스템 도구 모음 (읽기 자율, 쓰기 승인 필요)

// 읽기 도구: 파일 내용 읽기
export const readFile = {
    name: "read_file",
    description: "Reads and returns the contents of a file. Optionally specify a line range.",
    requiresApproval: false,
    schema: {
        type: "object",
        properties: {
            path: { type: "string", description: "File path" },
            startLine: { type: "number", description: "Start line number (1-based, optional)" },
            endLine: { type: "number", description: "End line number (inclusive, optional)" },
        },
        required: ["path"],
    },
    execute(args) {
        const { path: filePath, startLine, endLine } = args;
        const absPath = resolve(filePath);
        if (!existsSync(absPath)) return `File not found: ${filePath}`;
        let content = readFileSync(absPath, "utf-8");
        if (startLine || endLine) {
            const lines = content.split("\n");
            const start = (startLine || 1) - 1;
            const end = endLine || lines.length;
            content = lines.slice(start, end).join("\n");
        }
        if (content.length > 15000) {
            content = content.slice(0, 7000) + "\n\n... [content truncated] ...\n\n" + content.slice(-5000);
        }
        return content;
    },
};

// 읽기 도구: 디렉토리 내용 목록
export const listDir = {
    name: "list_directory",
    description: "Returns the list of files and folders in a directory.",
    requiresApproval: false,
    schema: {
        type: "object",
        properties: {
            path: { type: "string", description: "Directory path" },
            recursive: { type: "boolean", description: "Include subdirectories (optional, default: false)" },
        },
        required: ["path"],
    },
    execute(args) {
        const { path: dirPath, recursive = false } = args;
        const absPath = resolve(dirPath);
        if (!existsSync(absPath)) return `Directory not found: ${dirPath}`;

        const entries = [];
        function walk(dir, depth = 0) {
            if (depth > 5) return; // 깊이 제한
            const items = readdirSync(dir);
            for (const item of items) {
                if (item.startsWith(".") || item === "node_modules") continue;
                const fullPath = join(dir, item);
                const stat = statSync(fullPath);
                const rel = relative(absPath, fullPath);
                entries.push(stat.isDirectory() ? `${rel}/` : rel);
                if (recursive && stat.isDirectory()) walk(fullPath, depth + 1);
            }
        }
        walk(absPath);
        return entries.join("\n") || "(empty directory)";
    },
};

// 읽기 도구: 텍스트 검색
export const searchFiles = {
    name: "search_files",
    description: "Searches for a text pattern across files in a directory.",
    requiresApproval: false,
    schema: {
        type: "object",
        properties: {
            pattern: { type: "string", description: "Text or regex pattern to search for" },
            path: { type: "string", description: "Search directory (optional, defaults to current)" },
            filePattern: { type: "string", description: "File extension filter (e.g. .js, .py)" },
        },
        required: ["pattern"],
    },
    execute(args) {
        const { pattern, path: searchPath = ".", filePattern } = args;
        const absPath = resolve(searchPath);
        const results = [];
        const regex = new RegExp(pattern, "gi");

        function walk(dir, depth = 0) {
            if (depth > 8 || results.length > 50) return;
            try {
                const items = readdirSync(dir);
                for (const item of items) {
                    if (item.startsWith(".") || item === "node_modules") continue;
                    const fullPath = join(dir, item);
                    const stat = statSync(fullPath);
                    if (stat.isDirectory()) {
                        walk(fullPath, depth + 1);
                    } else if (!filePattern || item.endsWith(filePattern)) {
                        try {
                            const content = readFileSync(fullPath, "utf-8");
                            const lines = content.split("\n");
                            for (let i = 0; i < lines.length; i++) {
                                if (regex.test(lines[i])) {
                                    results.push(`${relative(absPath, fullPath)}:${i + 1}: ${lines[i].trim()}`);
                                    regex.lastIndex = 0;
                                }
                            }
                        } catch {
                            // 바이너리 파일 등 무시
                        }
                    }
                }
            } catch {
                // 권한 오류 무시
            }
        }
        walk(absPath);
        return results.join("\n") || "No results found.";
    },
};

// 쓰기 도구: 파일 생성/덮어쓰기 (data/workspace/ 한정)
export const writeFile = {
    name: "write_file",
    description:
        "Creates or overwrites a file. By default, paths are resolved inside data/workspace/. Set inWorkspace to false to allow project-root-relative or absolute paths outside the workspace.",
    requiresApproval: true,
    schema: {
        type: "object",
        properties: {
            path: { type: "string", description: "File path (e.g. report.txt or subdir/file.py)" },
            content: { type: "string", description: "File content" },
            inWorkspace: {
                type: "boolean",
                description: "Whether the path should stay inside data/workspace/. Default: true",
            },
        },
        required: ["path", "content"],
    },
    execute(args) {
        const { path: filePath, content, inWorkspace = true } = args;
        const { absPath, error } = resolveManagedPath(filePath, inWorkspace);
        if (error) return error;
        const dir = resolve(absPath, "..");
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
        writeFileSync(absPath, content, "utf-8");
        return `File written: ${absPath}`;
    },
};

// 쓰기 도구: 파일 삭제 (data/workspace/ 한정)
export const deleteFile = {
    name: "delete_file",
    description:
        "Deletes a file. By default, only files inside data/workspace/ can be deleted. Set inWorkspace to false to allow project-root-relative or absolute paths outside the workspace.",
    requiresApproval: true,
    schema: {
        type: "object",
        properties: {
            path: { type: "string", description: "File path to delete" },
            inWorkspace: {
                type: "boolean",
                description: "Whether the path should stay inside data/workspace/. Default: true",
            },
        },
        required: ["path"],
    },
    execute(args) {
        const { absPath, error } = resolveManagedPath(args.path, args.inWorkspace ?? true);
        if (error) return error;
        if (!existsSync(absPath)) return `File not found: ${args.path}`;
        unlinkSync(absPath);
        return `File deleted: ${absPath}`;
    },
};

// 파일시스템 도구를 개별 모듈로 export하지 않고, 배열로 묶어 export
export default [readFile, listDir, searchFiles, writeFile, deleteFile];
