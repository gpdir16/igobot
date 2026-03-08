import "dotenv/config";
import Agent from "./src/core/agent.js";
import TelegramBot from "./src/telegram/bot.js";
import SkillLoader from "./src/core/skill-loader.js";
import logger from "./src/utils/logger.js";
import { needsOnboarding, runOnboarding } from "./src/onboarding/index.js";

async function main() {
    // 첫 실행 감지: 필수 설정이 없으면 온보딩 실행
    if (needsOnboarding()) {
        console.log("\n⚙️  igobot 초기 설정이 필요합니다.\n");
        await runOnboarding({ isFirstRun: true });
        console.log("\n봇을 다시 시작합니다...\n");
        // 환경변수 재로드를 위해 dotenv 재실행 후 계속 진행
        const { config: dotenvConfig } = await import("dotenv");
        dotenvConfig({ override: true });
    }

    logger.info("igobot 시작 중...");

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

    // SKILL.md 본문을 에이전트 시스템 프롬프트에 주입
    agent.addSkillSection(skillLoader.getSystemPromptSection());

    // 메시지 핸들러 등록 및 봇 시작
    const messageHandler = (chatId, msg) => agent.handleMessage(chatId, msg);
    await bot.start(messageHandler);

    logger.info("igobot 준비 완료!");
}

main().catch((err) => {
    logger.error("치명적 오류:", err);
    process.exit(1);
});
