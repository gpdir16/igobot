// ── 지원 언어 목록 ────────────────────────────────────────────────────────────
// 새 언어 추가 방법:
//   1. SUPPORTED_LANGUAGES에 항목 추가
//   2. translations에 동일 키로 번역 객체 추가
//   번역이 없는 키는 자동으로 영어로 폴백됩니다.
export const SUPPORTED_LANGUAGES = [
    { value: "en", label: "English", hint: "en-US" },
    { value: "ko", label: "한국어", hint: "ko-KR" },
];

// ── 번역 데이터 ───────────────────────────────────────────────────────────────
const translations = {
    // ── 영어 (기본값) ──────────────────────────────────────────────────────
    en: {
        // 언어 선택
        lang: {
            select: "Select your language",
        },

        // 온보딩 시작
        intro: {
            title: "igobot Setup Wizard",
        },

        // 환영 메시지
        welcome: {
            first_body:
                "Welcome!\n" +
                "This wizard will help you set up things like the Telegram API and Codex connection.\n" +
                "You can rerun this setup at any time with 'igobot setup'.\n\n" +
                "Press Ctrl+C at any time to cancel.",
            first_title: "Welcome!",
            reconfigure_body: "Existing settings were found.\nPress Enter to keep the current values.",
            fresh_body: "Starting the setup from scratch.",
            title: "igobot Setup",
        },

        // 텔레그램 설정
        telegram: {
            token_new: "[1/4] Enter your Telegram bot token (get it from @BotFather)",
            token_existing: "[1/4] Enter your Telegram bot token from @BotFather (press Enter to keep the current value)",
            token_required: "Bot token is required.",
            token_invalid: "Invalid bot token format. (e.g. 123456789:ABC...)",
            users: "[2/4] Allowed Telegram user IDs (comma-separated)",
            users_placeholder: "123456789,987654321",
            users_required: "User ID is required. (Find it in Telegram Web URL)",
            users_invalid: "Enter numbers and commas only. (e.g. 123456789)",
        },

        // 에이전트 설정 (온보딩용 — 런타임 agent.*와 구분)
        agent_setup: {
            max_iter: "[3/4] Max agent iterations (LLM call limit per task)",
            max_iter_invalid: "Enter a number of 1 or more.",
            max_iter_too_large: "Too large. Recommended range: 1–1000.",
            log_level: "Select log level",
            log_hints: {
                error: "Critical issues only (recommended)",
                warn: "Log all issues",
                info: "Log all issues and usage information",
                debug: "Log as much as possible (ONLY FOR DEBUGGING!)",
            },
        },

        // 저장
        save: {
            saving: "Saving configuration...",
            saved: "Configuration saved!",
        },

        // Codex 로그인 (온보딩)
        login: {
            confirm_existing: "[4/4] Codex auth already exists. Re-login?",
            confirm_new: "[4/4] Proceed with Codex OAuth login? (ChatGPT Plus/Pro required)",
            note_body:
                "Open the URL in your browser and\n" +
                "sign in with your ChatGPT account.\n\n" +
                "Continues automatically after login.",
            note_title: "Codex Login",
            spinner_start: "Starting OAuth server...",
            spinner_stop: "Please complete login in your browser.",
            success_body: "Login successful! Credentials saved.",
            success_title: "Done",
            error_body: "You can try again later with 'igobot login'.",
            error_title: "Login Failed",
            skip_note: "You can login later with 'igobot login'.",
            skip_title: "Login Skipped",
        },

        // 온보딩 완료 / 취소
        outro: "Setup complete! Run 'igobot start' to launch the bot.",
        cancel: "Setup cancelled.",
        error_prefix: "Error during setup",

        // ── 봇 런타임 메시지 ──────────────────────────────────────────────
        bot: {
            token_missing: "TELEGRAM_BOT_TOKEN is not set.",
            access_denied: "⛔ Access denied.",
            start:
                "<b>🤖 igobot</b> activated\n\n" +
                "Send a message and the AI agent will respond.\n" +
                "Write/execute operations will request approval.\n\n" +
                "<b>Commands:</b>\n" +
                "/reset — Reset conversation\n" +
                "/status — Check status",
            reset: "🔄 Conversation reset.",
            status: "✅ Agent is running",
            approved: "✅ Approved",
            yolo_on: "🚀 YOLO mode ON",
            denied: "❌ Denied",
            error: "⚠️ Error: {msg}",
            photo: "[Photo]",
            document: "[Document: {name}]",
            sticker: "[Sticker: {emoji}]",
            voice: "[Voice message]",
            location: "[Location: {lat}, {lon}]",
            approval_title: "🔐 Approval Request",
            approval_tool: "Tool:",
            approval_args: "Args:",
            approval_truncated: "...[truncated]...",
            approval_btn_yolo: "🚀 YOLO",
            approval_btn_approve: "✅ Approve",
            approval_btn_deny: "❌ Deny",
            tool_log_title: "Tool History",
            tool_log_args: "Args:",
            tool_log_result: "Result:",
        },

        // ── 에이전트 런타임 메시지 ────────────────────────────────────────
        agent: {
            context_compressing: "🔄 Organizing conversation...",
            denied: "User denied execution.",
            tool_error: "Tool execution error: {msg}",
            error: "⚠️ Agent error: {msg}",
            max_iter: "⚠️ Maximum task iterations reached.",
            interrupted:
                "[System: The above response was not shown due to a new incoming message. Please process the following messages.]",
            image_prompt: "Please analyze this image.",
            document_label: "[Document uploaded: {name} — {url}]",
            voice_label: "[Voice message: {url}]",
        },

        // ── 인증 메시지 ───────────────────────────────────────────────────
        auth: {
            login_header: "===== igobot Codex OAuth Login =====",
            login_instruction: "Open the URL below in your browser and sign in with your ChatGPT account:",
            callback_waiting: "Waiting for callback...",
            success_page: "<h1>✅ igobot Authentication Complete!</h1><p>You may close this window.</p>",
            login_timeout: "Login timeout (5 minutes)",
            no_refresh_token: "No refresh_token. Please login again.",
            token_exchange_failed: "Token exchange failed: {status} {body}",
            token_refresh_failed: "Token refresh failed: {status} {body}",
            no_auth: "No credentials found. Please run `igobot login`.",
            login_complete: "\nLogin complete! Run `igobot start` to launch the bot.",
            login_failed: "Login failed:",
            invalid_jwt: "Invalid JWT",
        },

        // ── CLI 메시지 ────────────────────────────────────────────────────
        cli: {
            first_run: "\nFirst run detected. Starting setup...\n",
        },

        // ── 시스템 프롬프트 (LLM 지시문) ─────────────────────────────────
        system_prompt: `You are an autonomous AI agent called igobot.
Use the provided tools freely to fulfill user requests.

**Important — Runtime Environment:**
- This is an agent running on a server. There is no GUI or screen.
- Everything you want to show the user must be sent as a Telegram message.
- Code execution results, file contents, etc. should be delivered as text.
- **File operations (write_file, delete_file) are only allowed within the data/workspace/ directory.** Use relative paths from this base.
- If the user sends an image, you can see it directly. Image analysis is supported.

Available tools:
- run_terminal: Run shell commands in the terminal
- read_file: Read file contents
- list_directory: List directory contents
- search_files: Search for text in files
- write_file: Create/modify files (relative to data/workspace/)
- delete_file: Delete files (relative to data/workspace/)
- browser_fetch: Fetch web page content
- browser_interact: Interact with web pages
- send_photo: Send a local file or URL to the user as a photo
- send_document: Send a local file or URL to the user as a document
- memory_save: Save important information to persistent memory (markdown file)
- memory_search: Search saved memory
- memory_list: List all memory files
- memory_delete: Delete saved memory

Guidelines:
1. Analyze the request and gather necessary information using tools.
2. Save important information (user preferences, project info, things to remember) with memory_save. Use a descriptive filename.
3. To review saved memory, call memory_list. All memory contents will be returned.
4. To find specific memory, use memory_search.
5. Report task results clearly and concisely.
6. If you created/downloaded a file (photo, document, etc.), send it to the user with send_photo or send_document.
7. Respond in English.

Web scraping rules:
- Always use official browser tools for web data collection.
- Never write or run scripts using BeautifulSoup, requests, scrapy, etc.`,
    },

    // ── 한국어 ─────────────────────────────────────────────────────────────
    ko: {
        // 언어 선택
        lang: {
            select: "언어를 선택하세요",
        },

        // 온보딩 시작
        intro: {
            title: "igobot 초기 설정 마법사",
        },

        // 환영 메시지
        welcome: {
            first_body:
                "환영합니다!\n" +
                "이 마법사는 Telegram API와 Codex 연결 등의 작업을 도와줍니다.\n" +
                "언제든지 'igobot setup'을 입력해 이 설정을 다시 진행할 수 있습니다.\n\n" +
                "도중에 중지하려면 Ctrl+C를 누르십시오.",
            first_title: "환영합니다!",
            reconfigure_body: "이미 설정값이 있습니다.\nEnter키를 누르면 기존 값을 유지합니다.",
            fresh_body: "설정을 처음부터 진행합니다.",
            title: "igobot 설정",
        },

        // 텔레그램 설정
        telegram: {
            token_new: "[1/4] @BotFather에서 발급한 Telegram 봇 토큰을 입력하세요",
            token_existing: "[1/4] @BotFather에서 발급한 Telegram 봇 토큰을 입력하세요 (Enter로 기존 값 유지)",
            token_required: "봇 토큰은 필수입니다.",
            token_invalid: "올바르지 않은 봇 토큰 형식입니다. (예: 123456789:ABC...)",
            users: "[2/4] 허용할 텔레그램 사용자 ID (쉼표로 구분)",
            users_placeholder: "123456789,987654321",
            users_required: "사용자 ID는 필수입니다. (텔레그램 웹 주소창에서 확인)",
            users_invalid: "숫자와 쉼표만 입력하세요. (예: 123456789)",
        },

        // 에이전트 설정 (온보딩용)
        agent_setup: {
            max_iter: "[3/4] 에이전트 최대 반복 횟수 (작업 하나당 LLM 호출 한도)",
            max_iter_invalid: "1 이상의 숫자를 입력하세요.",
            max_iter_too_large: "너무 큰 값입니다. 1~1000 사이를 권장합니다.",
            log_level: "로그 레벨을 선택하세요",
            log_hints: {
                error: "심각한 문제만 기록 (권장)",
                warn: "모든 문제를 기록",
                info: "모든 문제와 사용량 정보도 기록",
                debug: "프라이버시는 고려도 안하고 가능한 모든것을 기록",
            },
        },

        // 저장
        save: {
            saving: "설정을 저장하는 중...",
            saved: "설정 저장 완료!",
        },

        // Codex 로그인 (온보딩)
        login: {
            confirm_existing: "[4/4] Codex 인증이 이미 있습니다. 다시 로그인하시겠습니까?",
            confirm_new: "[4/4] Codex OAuth 로그인을 진행하시겠습니까? (ChatGPT Plus/Pro 계정 필요)",
            note_body:
                "브라우저에서 열리는 URL에 접속하여\n" +
                "ChatGPT 계정으로 로그인해주세요.\n\n" +
                "로그인 완료 후 자동으로 진행됩니다.",
            note_title: "Codex 로그인",
            spinner_start: "OAuth 서버 시작 중...",
            spinner_stop: "브라우저에서 로그인을 완료해주세요.",
            success_body: "로그인 성공! 인증 정보가 저장되었습니다.",
            success_title: "완료",
            error_body: "나중에 'igobot login' 명령어로 다시 시도하세요.",
            error_title: "로그인 실패",
            skip_note: "나중에 'igobot login' 명령어로 로그인할 수 있습니다.",
            skip_title: "로그인 건너뜀",
        },

        // 온보딩 완료 / 취소
        outro: "설정 완료! 'igobot start'로 봇을 시작하세요.",
        cancel: "설정을 취소했습니다.",
        error_prefix: "설정 중 오류 발생",

        // ── 봇 런타임 메시지 ──────────────────────────────────────────────
        bot: {
            token_missing: "TELEGRAM_BOT_TOKEN이 설정되지 않았습니다.",
            access_denied: "⛔ 접근 권한이 없습니다.",
            start:
                "<b>🤖 igobot</b> 활성화됨\n\n" +
                "메시지를 보내면 AI 에이전트가 응답합니다.\n" +
                "쓰기/실행 작업은 승인을 요청합니다.\n\n" +
                "<b>명령어:</b>\n" +
                "/reset — 대화 초기화\n" +
                "/status — 상태 확인",
            reset: "🔄 대화가 초기화되었습니다.",
            status: "✅ 에이전트 작동 중",
            approved: "✅ 승인됨",
            yolo_on: "🚀 YOLO 모드 ON",
            denied: "❌ 거부됨",
            error: "⚠️ 오류: {msg}",
            photo: "[사진]",
            document: "[문서: {name}]",
            sticker: "[스티커: {emoji}]",
            voice: "[음성 메시지]",
            location: "[위치: {lat}, {lon}]",
            approval_title: "🔐 실행 승인 요청",
            approval_tool: "도구:",
            approval_args: "인자:",
            approval_truncated: "...[생략]...",
            approval_btn_yolo: "🚀 YOLO",
            approval_btn_approve: "✅ 승인",
            approval_btn_deny: "❌ 거부",
            tool_log_title: "도구 사용 기록",
            tool_log_args: "인자:",
            tool_log_result: "결과:",
        },

        // ── 에이전트 런타임 메시지 ────────────────────────────────────────
        agent: {
            context_compressing: "🔄 대화 내용을 정리하고 있습니다...",
            denied: "사용자가 실행을 거부했습니다.",
            tool_error: "도구 실행 오류: {msg}",
            error: "⚠️ 에이전트 오류: {msg}",
            max_iter: "⚠️ 최대 작업 반복에 도달했습니다.",
            interrupted:
                "[시스템: 위 응답은 새 메시지 도착으로 인해 사용자에게 표시되지 않았습니다. 이어지는 메시지를 처리하세요.]",
            image_prompt: "이 이미지를 분석해주세요.",
            document_label: "[문서 업로드됨: {name} — {url}]",
            voice_label: "[음성 메시지: {url}]",
        },

        // ── 인증 메시지 ───────────────────────────────────────────────────
        auth: {
            login_header: "===== igobot Codex OAuth 로그인 =====",
            login_instruction: "아래 URL을 브라우저에서 열어 ChatGPT 계정으로 로그인하세요:",
            callback_waiting: "콜백 대기 중...",
            success_page: "<h1>✅ igobot 인증 완료!</h1><p>이 창을 닫아도 됩니다.</p>",
            login_timeout: "로그인 타임아웃 (5분)",
            no_refresh_token: "refresh_token이 없습니다. 다시 로그인하세요.",
            token_exchange_failed: "토큰 교환 실패: {status} {body}",
            token_refresh_failed: "토큰 갱신 실패: {status} {body}",
            no_auth: "인증 정보가 없습니다. `igobot login`으로 로그인하세요.",
            login_complete: "\n로그인 완료! `igobot start`로 봇을 시작하세요.",
            login_failed: "로그인 실패:",
            invalid_jwt: "올바르지 않은 JWT",
        },

        // ── CLI 메시지 ────────────────────────────────────────────────────
        cli: {
            first_run: "\n첫 실행입니다. 설정을 시작합니다...\n",
        },

        // ── 시스템 프롬프트 (LLM 지시문) ─────────────────────────────────
        system_prompt: `당신은 igobot이라는 자율 AI 에이전트입니다.
사용자의 요청을 수행하기 위해 제공된 도구들을 자유롭게 사용하세요.

**중요 — 실행 환경:**
- 이것은 서버에서 실행되는 에이전트입니다. GUI나 화면이 없습니다.
- 사용자에게 보여줄 모든 내용은 반드시 텔레그램 메시지로 전송해야 합니다.
- 코드 실행 결과, 파일 내용 등도 사용자에게 텍스트로 전달하세요.
- **파일 작업(write_file, delete_file)은 data/workspace/ 디렉토리 내에서만 가능합니다.** 이 경로를 기준으로 상대 경로를 사용하세요.
- 사용자가 이미지를 보내면 직접 볼 수 있습니다. 이미지 분석이 가능합니다.

사용 가능한 도구:
- run_terminal: 터미널에서 셸 명령 실행
- read_file: 파일 내용 읽기
- list_directory: 디렉토리 내용 목록
- search_files: 파일에서 텍스트 검색
- write_file: 파일 생성/수정 (data/workspace/ 기준)
- delete_file: 파일 삭제 (data/workspace/ 기준)
- browser_fetch: 웹페이지 내용 가져오기
- browser_interact: 웹페이지 인터랙션
- send_photo: 로컬 파일 또는 URL을 사용자에게 사진으로 전송
- send_document: 로컬 파일 또는 URL을 사용자에게 문서로 전송
- memory_save: 중요 정보를 영구 메모리에 저장 (마크다운 파일)
- memory_search: 저장된 메모리 검색
- memory_list: 모든 메모리 파일 목록 확인
- memory_delete: 저장된 메모리 삭제

행동 원칙:
1. 요청을 분석하고 필요한 정보를 도구로 수집하세요.
2. 중요한 정보(사용자 선호, 프로젝트 정보, 기억해야 할 사항)는 memory_save로 저장하세요. 파일명은 내용을 잘 나타내는 이름으로 정하세요.
3. 저장된 메모리를 확인하려면 memory_list를 호출하세요. 모든 메모리 내용이 반환됩니다.
4. 특정 메모리를 찾으려면 memory_search를 사용하세요.
5. 작업 결과를 명확하고 간결하게 보고하세요.
6. 파일(사진, 문서 등)을 생성/다운로드했으면 send_photo 또는 send_document로 사용자에게 직접 전송하세요.
7. 한국어로 응답하세요.

웹 스크래핑 규칙:
- 웹 데이터 수집은 반드시 정식 브라우저 도구를 사용하세요.
- BeautifulSoup, requests, scrapy 등 스크립트 작성 및 실행 절대 금지.`,
    },
};

// ── t() 함수 생성 ─────────────────────────────────────────────────────────────
// 점 표기법으로 중첩 키 접근: t('bot.access_denied')
// 보간 지원: t('bot.error', { msg: '...' }) → {msg} 치환
// 폴백 순서: 선택 언어 → 영어(기본) → 키 그대로 반환
export function createT(lang) {
    const msgs = translations[lang] ?? translations["en"];

    return function t(key, vars = {}) {
        const parts = key.split(".");

        // 선택한 언어에서 먼저 탐색
        let val = msgs;
        for (const part of parts) {
            val = val?.[part];
            if (val === undefined) break;
        }

        // 영어로 폴백
        if (val === undefined) {
            let fallback = translations["en"];
            for (const part of parts) {
                fallback = fallback?.[part];
                if (fallback === undefined) break;
            }
            val = fallback ?? key;
        }

        // {varName} 보간 처리
        if (typeof val === "string" && Object.keys(vars).length > 0) {
            return val.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? String(vars[k]) : `{${k}}`));
        }

        return val;
    };
}

// ── 런타임 헬퍼 ──────────────────────────────────────────────────────────────
// 런타임 파일(bot.js, agent.js 등)에서 process.env.LANGUAGE를 자동으로 읽어 t() 생성
// dotenv가 로드된 이후(index.js 시작 후) 호출해야 합니다.
export function getT() {
    return createT(process.env.LANGUAGE || "en");
}
