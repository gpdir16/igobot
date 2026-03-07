import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import logger from "../utils/logger.js";

const MEMORY_DIR = resolve(process.cwd(), "data", "memory");

// 메모리 시스템 (마크다운 파일 기반 저장/검색/삭제)
class MemoryStore {
    constructor() {
        if (!existsSync(MEMORY_DIR)) {
            mkdirSync(MEMORY_DIR, { recursive: true });
        }
    }

    _filePath(name) {
        return join(MEMORY_DIR, `${name}.md`);
    }

    // 모든 메모리 파일 목록 가져오기
    _listFiles() {
        if (!existsSync(MEMORY_DIR)) return [];
        return readdirSync(MEMORY_DIR)
            .filter(f => f.endsWith(".md"))
            .map(f => f.slice(0, -3)); // .md 제거
    }

    // 메모리 저장 (마크다운 파일)
    add(chatId, name, content) {
        // 파일명 정리 (공백, 특수문자 처리)
        const safeName = name
            .toLowerCase()
            .replace(/[^a-z0-9가-힣_-]/g, "-")
            .replace(/-+/g, "-")
            .slice(0, 50);

        const fp = this._filePath(safeName);
        writeFileSync(fp, content, "utf-8");
        logger.info(`메모리 저장: ${safeName}.md`);
        return { name: safeName, path: fp };
    }

    // 메모리 읽기
    get(name) {
        const fp = this._filePath(name);
        if (!existsSync(fp)) return null;
        return readFileSync(fp, "utf-8");
    }

    // 메모리 검색 (내용에서 검색)
    search(query) {
        const files = this._listFiles();
        if (!query) {
            return files.map(name => ({
                name,
                content: this.get(name)
            }));
        }

        const q = query.toLowerCase();
        return files
            .map(name => ({
                name,
                content: this.get(name)
            }))
            .filter(m => m.name.toLowerCase().includes(q) || m.content.toLowerCase().includes(q));
    }

    // 메모리 삭제
    remove(name) {
        const fp = this._filePath(name);
        if (!existsSync(fp)) return false;
        unlinkSync(fp);
        logger.info(`메모리 삭제: ${name}.md`);
        return true;
    }

    // 전체 메모리 목록
    list() {
        return this._listFiles();
    }

    // 모든 메모리 내용을 컨텍스트용으로 반환
    getAllForContext() {
        const files = this._listFiles();
        if (files.length === 0) return "";

        let context = "\n\n[저장된 메모리]\n";
        for (const name of files) {
            const content = this.get(name);
            context += `\n### ${name}.md\n${content}\n`;
        }
        return context;
    }
}

// 싱글턴
const memoryStore = new MemoryStore();
export default memoryStore;