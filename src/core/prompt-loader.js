import { existsSync, readFileSync } from "node:fs";
import { SOUL_PROMPT_FILE, SYSTEM_PROMPT_FILE } from "./app-paths.js";

function readPromptFile(filePath, label, { required = false } = {}) {
    if (!existsSync(filePath)) {
        if (required) {
            throw new Error(`${label} file is missing: ${filePath}`);
        }
        return "";
    }

    const content = readFileSync(filePath, "utf-8").trim();
    if (required && !content) {
        throw new Error(`${label} file is empty: ${filePath}`);
    }
    return content;
}

function formatTools(tools = []) {
    if (tools.length === 0) return "- No tools are currently loaded.";

    return tools
        .map((tool) => {
            const approval = tool.requiresApproval ? "approval required" : "no approval";
            return `- \`${tool.name}\`: ${tool.description} (${approval})`;
        })
        .join("\n");
}

function formatSkills(skills = []) {
    if (skills.length === 0) return "- No skills are currently installed.";

    return skills
        .map((skill) => `- \`${skill.name}\`: ${skill.description}`)
        .join("\n");
}

function applyTemplate(content, variables) {
    return content.replace(/\{([A-Z0-9_]+)\}/g, (match, key) => {
        return Object.prototype.hasOwnProperty.call(variables, key) ? variables[key] : match;
    });
}

export function buildAgentInstructions({ tools = [], skills = [], memoryContext = "" } = {}) {
    const templateVars = {
        AVAILABLE_TOOLS: formatTools(tools),
        AVAILABLE_SKILLS: formatSkills(skills),
        MEMORY_CONTEXT: memoryContext || "- No saved memory.",
    };

    const systemPrompt = applyTemplate(readPromptFile(SYSTEM_PROMPT_FILE, "SYSTEM.md", { required: true }), templateVars);
    const soulPrompt = applyTemplate(readPromptFile(SOUL_PROMPT_FILE, "SOUL.md"), templateVars);

    const sections = [systemPrompt, soulPrompt].filter(Boolean);

    return sections.join("\n\n");
}
