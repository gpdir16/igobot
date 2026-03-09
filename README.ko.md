[English](README.md) / **한국어**

# igobot

Telegram, Discord 같은 여러 메신저를 통해 상호작용하는 AI 에이전트입니다. OpenAI의 Codex OAuth 인증을 사용하여 ChatGPT 모델과 통신하며, 다양한 도구를 자율적으로 활용할 수 있습니다.

OpenClaw와 비슷하지만 더 안전하고, 가볍고, 단순합니다.

> **이 프로젝트는 OpenAI의 공식이 아닙니다.** — Codex OAuth 방식은 OpenAI가 암묵적으로 허용하고 있지만, 언제든 변경될 수 있습니다.

## 대표 기능

- 에이전트가 자율적으로 작동합니다
- 쓰기 작업 전 권한을 묻습니다
- 스킬과 도구를 지원합니다
- 격리된 작업 환경에서 작업합니다
- 자체 Firefox 브라우저를 제어할수 있습니다
- 웹페이지 스크린샷을 찍어 메신저로 다시 보낼수 있습니다
- 터미널/파일/브라우저를 포함한 많은 도구를 사용할수 있습니다
- 그 외에도 더...

## 메신저 구조

- 메신저 연결 코드는 `src/messengers/` 아래에 있습니다.
- 현재 구현된 메신저는 `src/messengers/telegram/`, `src/messengers/discord/` 입니다.
- `ACTIVE_MESSENGER=telegram` 또는 `ACTIVE_MESSENGER=discord` 형태로 하나만 선택해서 사용할 수 있습니다.
- 새 메신저를 추가하려면 `src/messengers/<name>/` 폴더를 만들고 `src/messengers/index.js`에 등록하면 됩니다.

## 요구사항

- ChatGPT Plus 또는 Pro 구독
- 텔레그램 봇 토큰 ([BotFather](https://t.me/BotFather)에서 발급) 또는 Discord 봇 토큰
- NodeJS 20+ (자동으로 설치됨)
- macOS 또는 Debian, Pedora, Arch
- GUI 데스크톱 환경 (Linux의 경우에만 해당)

## 설치 방법

```bash
curl -fsSL https://raw.githubusercontent.com/gpdir16/igobot/refs/heads/main/install.sh | bash
```

1. 위 스크립트를 macOS 또는 Debian, Fedora, Arch에서 실행합니다.
2. 운영체제 정보가 표시되면 엔터를 눌러 계속합니다.
3. 설치가 끝나면 자동으로 설정 페이지로 진입합니다. 텔레그램 또는 Discord 봇 토큰과 언어 등 설정을 진행합니다.
4. Discord를 사용할 경우 Discord Developer Portal에서 Message Content intent도 켜주세요. Discord는 서버 채널이 아니라 DM에서만 지원합니다.
5. 설정 마지막에 Codex OAuth에 로그인하라는 안내가 표시되면 브라우저에서 링크를 열어 로그인합니다.
6. 터미널에서 `igobot start`를 실행합니다.
7. Telegram 또는 Discord로 처음 메시지를 보내면 승인 명령어가 표시됩니다. 이를 igobot이 실행중인 컴퓨터의 터미널에서 실행하세요.
