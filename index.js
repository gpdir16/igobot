import 'dotenv/config';
import Agent from './src/core/agent.js';
import TelegramBot from './src/telegram/bot.js';
import logger from './src/utils/logger.js';

async function main() {
  logger.info('igobot 시작 중...');

  // 에이전트 초기화
  const agent = new Agent();
  await agent.init();

  // 텔레그램 봇 초기화
  const bot = new TelegramBot();

  // 에이전트 ↔ 텔레그램 연결
  agent.bot = bot;

  // 대화 초기화 핸들러
  bot.onReset = (chatId) => agent.resetConversation(chatId);

  // 메시지 핸들러 등록 및 봇 시작
  await bot.start(async (chatId, msg) => {
    await agent.handleMessage(chatId, msg);
  });

  logger.info('igobot 준비 완료!');
}

main().catch(err => {
  logger.error('치명적 오류:', err);
  process.exit(1);
});
