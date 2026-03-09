import { readdirSync } from "node:fs";
import { join } from "node:path";
import { TOOLS_DIR } from "./app-paths.js";
import logger from "../utils/logger.js";

// 동적 모듈 로더 (tools 디렉토리 자동 탐색/로드)
class ModuleLoader {
    constructor() {
        this.tools = new Map();
    }

    // 기본 tools 디렉토리에서 모든 도구 모듈 로드
    async loadTools(toolsDir) {
        const dir = toolsDir || TOOLS_DIR;
        const files = readdirSync(dir).filter((f) => f.endsWith(".js") && f !== "index.js");

        for (const file of files) {
            try {
                const modulePath = join(dir, file);
                const mod = await import(`file://${modulePath}`);
                const exported = mod.default;

                // 배열인 경우 (여러 도구를 하나의 파일에서 export)
                const toolList = Array.isArray(exported) ? exported : [exported];

                for (const tool of toolList) {
                    if (!tool?.name || !tool?.execute) {
                        logger.warn(`Invalid tool in ${file} — skipped.`);
                        continue;
                    }
                    this.tools.set(tool.name, tool);
                    logger.info(`Tool loaded: ${tool.name} (${file})`);
                }
            } catch (err) {
                logger.error(`Failed to load tool: ${file}`, err);
            }
        }
    }

    // 도구 이름으로 도구 가져오기
    getTool(name) {
        return this.tools.get(name) || null;
    }

    // LLM에 전달할 도구 스키마 목록 생성
    getToolSchemas() {
        return Array.from(this.tools.values()).map((tool) => ({
            type: "function",
            name: tool.name,
            description: tool.description,
            parameters: tool.schema || {},
        }));
    }

    // 도구 실행
    async executeTool(name, args, context = {}) {
        const tool = this.getTool(name);
        if (!tool) throw new Error(`Unknown tool: ${name}`);
        return tool.execute(args, context);
    }
}

export default ModuleLoader;
