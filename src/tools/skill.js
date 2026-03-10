// 스킬 지연 로딩(Lazy Loading) 도구
// list_skills: 사용 가능한 스킬 목록 반환
// load_skill: 특정 스킬 내용을 반환

export const listSkills = {
    name: "list_skills",
    description: "Returns the list of available skills with their descriptions. If a skill seems relevant, load it with load_skill.",
    requiresApproval: false,
    schema: {
        type: "object",
        properties: {},
        required: [],
    },
    execute(args, context) {
        const { skillLoader } = context;
        if (!skillLoader) return "Skill loader is not available.";

        const skills = skillLoader.getSkillList();
        if (skills.length === 0) return "No skills available.";

        return skills.map((s) => `- **${s.name}**: ${s.description} (${s.path})`).join("\n");
    },
};

export const loadSkill = {
    name: "load_skill",
    description: "Returns the full content of a skill document for immediate use in the current conversation. It does not modify the system prompt.",
    requiresApproval: false,
    schema: {
        type: "object",
        properties: {
            name: { type: "string", description: "Skill name to load (use the name field from list_skills)" },
        },
        required: ["name"],
    },
    execute(args, context) {
        const { skillLoader } = context;
        if (!skillLoader) return "Skill loader is not available.";

        const skill = skillLoader.getSkill(args.name);
        if (!skill) {
            const available = skillLoader.getSkillList().map((s) => s.name).join(", ");
            return `Skill not found: "${args.name}". Available: ${available || "none"}`;
        }

        return `## Skill: ${args.name}\nPath: ${skill.path}\n\n${skill.body}`;
    },
};

export default [listSkills, loadSkill];
