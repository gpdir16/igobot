import "dotenv/config";
import Agent from "./src/core/agent.js";
import TelegramBot from "./src/telegram/bot.js";
import SkillLoader from "./src/core/skill-loader.js";
import logger from "./src/utils/logger.js";

async function main() {
    logger.info("igobot starting...");

    // 에이전트 초기화 (기본 도구 로드)
    const agent = new Agent();
    await agent.init();

    // 텔레그램 봇 초기화
    const bot = new TelegramBot();

    // 에이전트 ↔ 텔레그램 연결
    agent.bot = bot;
    bot.onReset = (chatId) => agent.resetConversation(chatId);

    // 스킬 로드 (SKILL.md 기반)
    const skillLoader = new SkillLoader();
    await skillLoader.loadSkills();

    // 스킬 로더를 에이전트에 주입 (지연 로딩 — 필요시에만 스킬 본문 로드)
    agent.setSkillLoader(skillLoader);

    // 메시지 핸들러 등록 및 봇 시작
    const messageHandler = (chatId, msg) => agent.handleMessage(chatId, msg);
    await bot.start(messageHandler);

    logger.info("igobot ready!");
}

main().catch((err) => {
    logger.error("Fatal error:", err);
    process.exit(1);
});
