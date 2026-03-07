import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { resolve, join } from "node:path";
import logger from "../utils/logger.js";

// SKILL.md 상단의 YAML frontmatter 파싱 (--- 블록)
function parseFrontmatter(content) {
    const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
    if (!match) return { meta: {}, body: content };

    const yamlStr = match[1];
    const body = match[2].trim();
    const meta = {};

    // 간단한 YAML 파서 (name, description 지원)
    for (const line of yamlStr.split("\n")) {
        const topMatch = line.match(/^(\w[\w-]*):\s*(.*)$/);
        if (topMatch && !line.startsWith(" ")) {
            const key = topMatch[1];
            const val = topMatch[2].trim();
            if (val) {
                meta[key] = val.replace(/^["']|["']$/g, "");
            }
        }
    }

    return { meta, body };
}

// src/skills/ 하위 폴더를 스캔하여 SKILL.md 파일을 읽어 에이전트 지시문으로 주입하는 로더
class SkillLoader {
    constructor() {
        this.skills = new Map(); // name → { meta, body, rawContent }
    }

    // src/skills/ 하위 폴더를 스캔하여 SKILL.md 파일 로드
    async loadSkills(skillsDir) {
        const dir = skillsDir || resolve(process.cwd(), "src", "skills");

        if (!existsSync(dir)) {
            logger.warn(`스킬 디렉토리 없음: ${dir}`);
            return;
        }

        // 하위 폴더 스캔
        const entries = readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            if (!entry.isDirectory()) continue;

            const skillMdPath = join(dir, entry.name, "SKILL.md");
            if (!existsSync(skillMdPath)) {
                logger.debug(`SKILL.md 없음 (스킵): ${skillMdPath}`);
                continue;
            }

            try {
                const rawContent = readFileSync(skillMdPath, "utf-8");
                const { meta, body } = parseFrontmatter(rawContent);
                const name = meta.name || entry.name;
                this.skills.set(name, { meta, body, rawContent });
                logger.info(`스킬 로드 완료: ${name} [${skillMdPath}]`);
            } catch (err) {
                logger.error(`스킬 로드 실패: ${entry.name}`, err);
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
}

export default SkillLoader;
