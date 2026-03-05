# igobot

Telegram 메신저를 통해 상호작용하는 AI 에이전트입니다. OpenAI의 Codex OAuth 인증을 사용하여 ChatGPT 모델과 통신하며, 다양한 도구를 자율적으로 활용할 수 있습니다.

> **이 프로젝트는 OpenAI의 공식이 아닙니다.** — Codex OAuth 방식은 OpenAI가 암묵적으로 허용하고 있지만, 언제든 변경될 수 있습니다.

## 기능

- 🤖 **자율 에이전트** — LLM이 도구를 자율적으로 선택하고 실행
- 💬 **텔레그램 인터페이스** — 텔레그램 봇을 통한 대화
- 🔐 **승인 시스템** — 읽기 작업은 자율, 쓰기/실행은 사용자 승인 필요
- 🧩 **모듈화** — 도구를 자유롭게 추가/수정/제거 가능

### 내장 도구

| 도구 | 설명 | 승인 필요 |
|------|------|-----------|
| `run_terminal` | 셸 명령 실행 | ✅ |
| `read_file` | 파일 읽기 | ❌ |
| `list_directory` | 디렉토리 목록 | ❌ |
| `search_files` | 텍스트 검색 | ❌ |
| `write_file` | 파일 작성 | ✅ |
| `delete_file` | 파일 삭제 | ✅ |
| `browser_fetch` | 웹페이지 가져오기 | ❌ |
| `browser_screenshot` | 스크린샷 | ✅ |
| `browser_interact` | 웹 인터랙션 | ✅ |

## 요구사항

- Node.js 20+
- ChatGPT Plus 또는 Pro 구독
- 텔레그램 봇 토큰 ([BotFather](https://t.me/BotFather)에서 발급)

## 설치

```bash
git clone https://github.com/gpdir16/igobot.git
cd igobot
npm install
npx playwright install firefox
```

## 설정

```bash
cp .env.example .env
```

`.env` 파일을 편집하여 설정합니다:

```env
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_ALLOWED_USERS=your_telegram_user_id (텔레그램 웹에서 저장한 메시지 채팅방에들어가면 주소창에 뜨는 숫자)
```

LLM 설정은 프로젝트 루트의 `model.json`에서 관리합니다:

```json
{
  "model": "gpt-5.2",
  "contextWindow": 400000,
  "reasoningEffort": "medium"
}
```

## 사용법

### 1. Codex OAuth 로그인

```bash
npm run login
```

브라우저에서 표시된 URL을 열고 ChatGPT 계정으로 로그인합니다.
인증 정보는 `auth.json`에 저장됩니다.

### 2. 봇 시작

```bash
npm start
```

### 3. 텔레그램에서 대화

봇에게 메시지를 보내면 에이전트가 작업을 수행합니다.

**명령어:**
- `/start` — 봇 시작 안내
- `/reset` — 대화 초기화
- `/status` — 상태 확인

## 커스텀 도구 추가

`src/tools/` 디렉토리에 `.js` 파일을 추가하면 자동으로 로드됩니다.

```javascript
// src/tools/my-tool.js
export default {
  name: 'my_tool',
  description: '도구 설명',
  requiresApproval: false,  // true면 실행 전 텔레그램에서 승인 요청
  schema: {
    type: 'object',
    properties: {
      param1: { type: 'string', description: '파라미터 설명' }
    },
    required: ['param1']
  },
  async execute(args, context) {
    // args.param1 사용
    return '결과 문자열';
  }
};
```

하나의 파일에서 여러 도구를 배열로 export할 수도 있습니다:

```javascript
export default [tool1, tool2, tool3];
```

## 프로젝트 구조

```
igobot/
├── index.js                  # 엔트리포인트
├── auth.json                 # Codex OAuth 토큰 (자동 생성)
├── .env                      # 환경 설정
├── package.json
└── src/
    ├── core/
    │   ├── agent.js          # 에이전트 루프 (LLM ↔ 도구)
    │   ├── config.js         # 설정 로더
    │   └── module-loader.js  # 동적 도구 로더
    ├── llm/
    │   ├── codex-auth.js     # OAuth PKCE 인증
    │   └── codex-client.js   # Codex API 클라이언트
    ├── telegram/
    │   └── bot.js            # 텔레그램 봇 + 승인 시스템
    ├── tools/
    │   ├── terminal.js       # 터미널 명령 실행
    │   ├── filesystem.js     # 파일 읽기/쓰기/검색
    │   └── browser.js        # Playwright Firefox 자동화
    └── utils/
        └── logger.js         # 로깅
```

## 사용 권장 모델

| 모델 | 설명 |
|------|------|
| `gpt-5.2` | GPT-5.2 기본 |
| `gpt-5.3-codex` | GPT-5.3 코딩 특화 (추천 모델) |