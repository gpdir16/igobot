import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// 앱 설정 로더 (.env + auth.json 통합)
class Config {
    constructor() {
        this._cache = {};
        this.load();
    }

    load() {
        // auth.json에서 Codex 토큰 로드
        const authPath = resolve(process.cwd(), "auth.json");
        if (existsSync(authPath)) {
            try {
                const raw = readFileSync(authPath, "utf-8");
                this._cache.auth = JSON.parse(raw);
            } catch {
                this._cache.auth = null;
            }
        }
    }

    get telegram() {
        return {
            token: process.env.TELEGRAM_BOT_TOKEN,
            allowedUsers: (process.env.TELEGRAM_ALLOWED_USERS || "")
                .split(",")
                .map((id) => id.trim())
                .filter(Boolean),
        };
    }

    get llm() {
        return {
            model: process.env.LLM_MODEL || "codex-mini-latest",
            reasoningEffort: process.env.LLM_REASONING_EFFORT || "medium",
        };
    }

    get auth() {
        return this._cache.auth?.tokens || null;
    }

    get agent() {
        return {
            maxIterations: parseInt(process.env.AGENT_MAX_ITERATIONS || "20", 10),
        };
    }
}

// 싱글턴
const config = new Config();
export default config;
