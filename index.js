import "dotenv/config";
import Agent from "./src/core/agent.js";
import SkillLoader from "./src/core/skill-loader.js";
import { createEnabledMessengers } from "./src/messengers/index.js";
import logger from "./src/utils/logger.js";

async function main() {
    logger.info("igobot starting...");

    // 에이전트 초기화 (기본 도구 로드)
    const agent = new Agent();
    await agent.init();

    // 스킬 로드 (SKILL.md 기반)
    const skillLoader = new SkillLoader();
    await skillLoader.loadSkills();

    // 스킬 로더를 에이전트에 주입 (지연 로딩 — 필요시에만 스킬 본문 로드)
    agent.setSkillLoader(skillLoader);

    const messengers = createEnabledMessengers();
    if (messengers.length === 0) {
        throw new Error("No active messenger found. Check ACTIVE_MESSENGER and the selected messenger token.");
    }

    agent.registerMessengers(messengers);

    const messageHandler = (context) => agent.handleMessage(context);
    await Promise.all(
        messengers.map(async (messenger) => {
            messenger.onReset = (chatId) => agent.resetConversation(messenger.key, chatId);
            await messenger.start(messageHandler);
        }),
    );

    const stopAll = (signal) => {
        for (const messenger of messengers) {
            messenger.stop?.(signal);
        }
    };

    process.once("SIGINT", () => stopAll("SIGINT"));
    process.once("SIGTERM", () => stopAll("SIGTERM"));

    logger.info("igobot ready!");
}

main().catch((err) => {
    logger.error("Fatal error:", err);
    process.exit(1);
});
