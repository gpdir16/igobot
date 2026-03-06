import { readFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import logger from "../utils/logger.js";

// SKILL.md 상단의 YAML frontmatter 파싱 (--- 블록)
function parseFrontmatter(content) {
    const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
    if (!match) return { meta: {}, body: content };

    const yamlStr = match[1];
    const body = match[2].trim();
    const meta = {};

    // 간단한 YAML 파서 (name, description, commands 배열 지원)
    let currentList = null;
    let currentItem = null;

    for (const line of yamlStr.split("\n")) {
        // 최상위 키: value
        const topMatch = line.match(/^(\w[\w-]*):\s*(.*)$/);
        if (topMatch && !line.startsWith(" ")) {
            currentList = null;
            currentItem = null;
            const key = topMatch[1];
            const val = topMatch[2].trim();
            if (val) {
                meta[key] = val.replace(/^["']|["']$/g, "");
            } else {
                meta[key] = [];
                currentList = key;
            }
            continue;
        }

        // 배열 항목 시작 (  - command: ...)
        const listItemMatch = line.match(/^  - (\w[\w-]*):\s*(.*)$/);
        if (listItemMatch && currentList) {
            currentItem = { [listItemMatch[1]]: listItemMatch[2].replace(/^["']|["']$/g, "") };
            meta[currentList].push(currentItem);
            continue;
        }

        // 배열 항목 내 추가 필드 (    description: ...)
        const itemFieldMatch = line.match(/^    (\w[\w-]*):\s*(.*)$/);
        if (itemFieldMatch && currentItem) {
            currentItem[itemFieldMatch[1]] = itemFieldMatch[2].replace(/^["']|["']$/g, "");
        }
    }

    return { meta, body };
}

// src/skills/ 하위 SKILL.md 파일을 읽어 에이전트 지시문으로 주입하는 로더
class SkillLoader {
    constructor() {
        this.skills = new Map(); // name → { meta, body, rawContent }
    }

    // src/skills/manifest.json을 기준으로 스킬 로드
    async loadSkills(skillsDir) {
        const dir = skillsDir || resolve(process.cwd(), "src", "skills");
        const manifestPath = join(dir, "manifest.json");

        if (!existsSync(manifestPath)) {
            logger.warn(`스킬 manifest 없음: ${manifestPath}`);
            return;
        }

        let manifest;
        try {
            manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
        } catch (err) {
            logger.error("스킬 manifest 파싱 실패:", err);
            return;
        }

        for (const entry of manifest.skills || []) {
            const skillMdPath = join(dir, entry.path, "SKILL.md");
            if (!existsSync(skillMdPath)) {
                logger.warn(`SKILL.md 없음: ${skillMdPath}`);
                continue;
            }
            try {
                const rawContent = readFileSync(skillMdPath, "utf-8");
                const { meta, body } = parseFrontmatter(rawContent);
                const name = meta.name || entry.name;
                this.skills.set(name, { meta, body, rawContent });
                const cmdCount = Array.isArray(meta.commands) ? meta.commands.length : 0;
                logger.info(`스킬 로드 완료: ${name} (명령어 ${cmdCount}개) [${skillMdPath}]`);
            } catch (err) {
                logger.error(`스킬 로드 실패: ${entry.path}`, err);
            }
        }
    }

    // 에이전트 시스템 프롬프트에 주입할 스킬 지시문 반환
    getSystemPromptSection() {
        if (this.skills.size === 0) return null;

        const sections = [];
        for (const [name, skill] of this.skills) {
            sections.push(`## 스킬: ${name}\n${skill.body}`);
        }
        return `\n\n---\n# 사용 가능한 스킬\n\n${sections.join("\n\n---\n\n")}`;
    }

    // frontmatter의 commands 배열로 텔레그램 슬래시 명령어 핸들러 생성
    // 각 명령어는 지정된 message를 에이전트에 그대로 전달
    getCommandHandlers(onMessage) {
        const handlers = [];
        for (const [, skill] of this.skills) {
            if (!Array.isArray(skill.meta.commands)) continue;
            for (const cmd of skill.meta.commands) {
                if (!cmd.command) continue;
                handlers.push({
                    command: cmd.command,
                    description: cmd.description || cmd.command,
                    handler: (ctx) => {
                        if (!onMessage) return;
                        // "/command@botname args" 에서 앞부분 제거하고 인자만 추출
                        const rawText = ctx.message?.text || "";
                        const extra = rawText.replace(/^\/\S+\s*/, "").trim();
                        const baseMessage = cmd.message || `/${cmd.command}`;
                        const text = extra ? `${baseMessage} (${extra})` : baseMessage;
                        const msg = {
                            type: "text",
                            text,
                            messageId: ctx.message?.message_id,
                        };
                        onMessage(ctx.chat.id, msg).catch(() => {});
                    },
                });
            }
        }
        return handlers;
    }
}

export default SkillLoader;
