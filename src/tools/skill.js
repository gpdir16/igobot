// 스킬 지연 로딩(Lazy Loading) 도구
// list_skills: 사용 가능한 스킬 목록 반환
// load_skill: 특정 스킬을 대화 컨텍스트에 동적 주입

export const listSkills = {
    name: "list_skills",
    description: "사용 가능한 스킬 목록과 설명을 반환합니다. 특정 스킬이 필요하다고 판단되면 load_skill로 로드하세요.",
    requiresApproval: false,
    schema: {
        type: "object",
        properties: {},
        required: [],
    },
    execute(args, context) {
        const { skillLoader } = context;
        if (!skillLoader) return "스킬 로더를 사용할 수 없습니다.";

        const skills = skillLoader.getSkillList();
        if (skills.length === 0) return "사용 가능한 스킬이 없습니다.";

        return skills.map((s) => `- **${s.name}**: ${s.description}`).join("\n");
    },
};

export const loadSkill = {
    name: "load_skill",
    description: "특정 스킬을 로드하여 현재 대화에 적용합니다. 로드된 스킬의 지시문이 다음 응답부터 반영됩니다. list_skills로 이름을 먼저 확인하세요.",
    requiresApproval: false,
    schema: {
        type: "object",
        properties: {
            name: { type: "string", description: "로드할 스킬 이름 (list_skills 결과의 name 필드)" },
        },
        required: ["name"],
    },
    execute(args, context) {
        const { skillLoader } = context;
        if (!skillLoader) return "스킬 로더를 사용할 수 없습니다.";

        const skill = skillLoader.getSkill(args.name);
        if (!skill) {
            const available = skillLoader.getSkillList().map((s) => s.name).join(", ");
            return `스킬을 찾을 수 없습니다: "${args.name}". 사용 가능: ${available || "없음"}`;
        }

        // __skillContent를 포함한 객체 반환 → agent.js에서 감지하여 loadedSkills에 저장
        return {
            __skillName: args.name,
            __skillContent: skill.body,
            message: `스킬 "${args.name}" 로드 완료. 지시문이 다음 응답부터 적용됩니다.`,
        };
    },
};

export default [listSkills, loadSkill];
