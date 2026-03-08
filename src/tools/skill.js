// 스킬 지연 로딩(Lazy Loading) 도구
// list_skills: 사용 가능한 스킬 목록 반환
// load_skill: 특정 스킬을 대화 컨텍스트에 동적 주입

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

        return skills.map((s) => `- **${s.name}**: ${s.description}`).join("\n");
    },
};

export const loadSkill = {
    name: "load_skill",
    description: "Loads a skill and applies it to the current conversation. The skill's instructions take effect from the next response. Check available skills with list_skills first.",
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

        // __skillContent를 포함한 객체 반환 → agent.js에서 감지하여 loadedSkills에 저장
        return {
            __skillName: args.name,
            __skillContent: skill.body,
            message: `Skill "${args.name}" loaded. Instructions will apply from the next response.`,
        };
    },
};

export default [listSkills, loadSkill];
