import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, join } from "node:path";
import logger from "../utils/logger.js";

const MEMORY_DIR = resolve(process.cwd(), "data", "memory");

// 메모리 시스템 (chatId별 JSON 기반 저장/검색/삭제)
class MemoryStore {
    constructor() {
        if (!existsSync(MEMORY_DIR)) {
            mkdirSync(MEMORY_DIR, { recursive: true });
        }
    }

    _filePath(chatId) {
        return join(MEMORY_DIR, `${chatId}.json`);
    }

    _load(chatId) {
        const fp = this._filePath(chatId);
        if (!existsSync(fp)) return [];
        try {
            return JSON.parse(readFileSync(fp, "utf-8"));
        } catch {
            return [];
        }
    }

    _save(chatId, entries) {
        writeFileSync(this._filePath(chatId), JSON.stringify(entries, null, 2), "utf-8");
    }

    // 메모리 저장
    add(chatId, key, value, tags = []) {
        const entries = this._load(chatId);
        // 같은 키가 있으면 업데이트
        const idx = entries.findIndex((e) => e.key === key);
        const entry = {
            key,
            value,
            tags,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        if (idx >= 0) {
            entry.createdAt = entries[idx].createdAt;
            entries[idx] = entry;
        } else {
            entries.push(entry);
        }
        this._save(chatId, entries);
        logger.info(`메모리 저장: [${chatId}] ${key}`);
        return entry;
    }

    // 메모리 검색
    search(chatId, query) {
        const entries = this._load(chatId);
        if (!query) return entries;
        const q = query.toLowerCase();
        return entries.filter(
            (e) => e.key.toLowerCase().includes(q) || e.value.toLowerCase().includes(q) || e.tags.some((t) => t.toLowerCase().includes(q)),
        );
    }

    // 메모리 삭제
    remove(chatId, key) {
        const entries = this._load(chatId);
        const filtered = entries.filter((e) => e.key !== key);
        this._save(chatId, filtered);
        return entries.length !== filtered.length;
    }

    // 전체 메모리 목록
    list(chatId) {
        return this._load(chatId);
    }

    // 메모리 전체 삭제
    clear(chatId) {
        this._save(chatId, []);
    }

    // 시스템 프롬프트에 포함할 메모리 요약 생성
    getSummaryForPrompt(chatId) {
        const entries = this._load(chatId);
        if (entries.length === 0) return "";

        let summary = "\n\n[저장된 메모리]\n";
        for (const e of entries) {
            summary += `- ${e.key}: ${e.value}`;
            if (e.tags.length > 0) summary += ` [${e.tags.join(", ")}]`;
            summary += "\n";
        }
        return summary;
    }
}

// 싱글턴
const memoryStore = new MemoryStore();
export default memoryStore;
