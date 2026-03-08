import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { getCodexAuthFile } from "./auth-paths.js";

// 앱 설정 로더 (.env + data/auth/codex.json + model.json 통합)
class Config {
    constructor() {
        this._cache = {};
        this.load();
    }

    load() {
        // data/auth/codex.json에서 Codex 토큰 로드
        const authPath = getCodexAuthFile();
        if (existsSync(authPath)) {
            try {
                const raw = readFileSync(authPath, "utf-8");
                this._cache.auth = JSON.parse(raw);
            } catch {
                this._cache.auth = null;
            }
        }

        // model.json에서 모델 설정 로드
        const modelPath = resolve(process.cwd(), "model.json");
        if (existsSync(modelPath)) {
            try {
                this._cache.model = JSON.parse(readFileSync(modelPath, "utf-8"));
            } catch {
                this._cache.model = {};
            }
        } else {
            this._cache.model = {};
        }
    }

    get telegram() {
        return {
            token: process.env.TELEGRAM_BOT_TOKEN,
        };
    }

    get llm() {
        const m = this._cache.model;
        return {
            model: m.model || "gpt-5.2",
            reasoningEffort: m.reasoningEffort || "medium",
        };
    }

    get auth() {
        return this._cache.auth?.tokens || null;
    }

    get agent() {
        return {
            maxIterations: parseInt(process.env.AGENT_MAX_ITERATIONS || "100", 10),
            // 실제 usage.input_tokens이 이 값의 85%를 넘으면 컨텍스트 압축 실행
            contextWindow: this._cache.model?.contextWindow || 100000,
        };
    }
}

// 싱글턴
const config = new Config();
export default config;
