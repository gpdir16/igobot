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
                "This wizard will help you set up messenger bot tokens and the Codex connection.\n" +
                "You can rerun this setup at any time with 'igobot setup'.\n\n" +
                "Press Ctrl+C at any time to cancel.",
            first_title: "Welcome!",
            reconfigure_body: "Existing settings were found.\nPress Enter to keep the current values.",
            fresh_body: "Starting the setup from scratch.",
            title: "igobot Setup",
        },

        // 텔레그램 설정
        telegram: {
            token_new: "[2/4] Enter your Telegram bot token (get it from @BotFather)",
            token_existing: "[2/4] Enter your Telegram bot token from @BotFather (press Enter to keep the current value)",
            token_invalid: "Invalid bot token format. (e.g. 123456789:ABC...)",
            approval_flow_title: "Telegram Access",
            approval_flow:
                "Allowed users are no longer pre-registered in setup.\n" +
                "When a new Telegram account sends a message, igobot creates a unique approval code.\n" +
                "Approve that account from this machine with: igobot ok {code}",
        },
        discord: {
            token_new: "[2/4] Enter your Discord bot token",
            token_existing: "[2/4] Enter your Discord bot token (press Enter to keep the current value)",
            token_invalid: "Discord bot token looks too short.",
            approval_flow_title: "Discord Access",
            approval_flow:
                "When a new Discord account sends a message, igobot creates a unique approval code.\n" +
                "Approve that account from this machine with: igobot ok {code}\n\n" +
                "For Discord bots, enable the Message Content intent in the Discord Developer Portal.",
        },
        messengers: {
            select: "[1/4] Choose the messenger to use",
            token_ready: "token saved",
            token_missing: "no token yet",
            selected_token_required: "{messenger} bot token is required for the selected messenger.",
        },

        // 에이전트 설정 (온보딩용 — 런타임 agent.*와 구분)
        agent_setup: {
            log_level: "[3/4] Select log level",
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
        outro: "👉 Run 'igobot start' to start igobot.",
        cancel: "Setup cancelled.",
        error_prefix: "Error during setup",

        access: {
            pending_short: "Approval is still required for this account.",
            request_title: "🔐 Approval is required for this account for security.",
            request_body:
                "This looks like an account igobot has not seen before.\n" +
                "For security, approval is required before using igobot.\n\n" +
                "Run the command below in the terminal on the computer where igobot is running:\n" +
                "igobot ok {code}\n\n" +
                "After approval, you are ready to chat with igobot.",
            approved:
                "✅ This account has been approved.\n\n" +
                "You are ready to chat with igobot.\n" +
                "Send any message to start.",
        },

        // ── 봇 런타임 메시지 ──────────────────────────────────────────────
        bot: {
            token_missing: "TELEGRAM_BOT_TOKEN is not set.",
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
        discord_bot: {
            token_missing: "DISCORD_BOT_TOKEN is not set.",
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
            approve_usage: "Usage: igobot ok <approval-code>",
            approve_not_found: "No pending messenger approval was found for code: {code}",
            approve_already_done: "This approval code was already used: {code}",
            approve_success: "Approved {messenger} account: {account} (userId: {userId})",
            approve_success_next: "This account can now send messages to igobot.",
            approve_notify_failed: "Approval succeeded, but the confirmation message could not be sent.",
        },

        // ── 시스템 프롬프트 (LLM 지시문) ─────────────────────────────────
        system_prompt: `You are an autonomous AI agent called igobot.
Use the provided tools freely to fulfill user requests.

**Important — Runtime Environment:**
- This is an agent running on a server. There is no GUI or screen.
- Everything you want to show the user must be sent through the active messenger.
- Code execution results, file contents, etc. should be delivered as text.
- **For file operations (write_file, delete_file), use \`inWorkspace: true\` for normal data/workspace/ edits.** Set \`inWorkspace: false\` only when you must edit a path outside the workspace.
- If the user sends an image, you can see it directly. Image analysis is supported.

Available tools:
- run_terminal: Run shell commands in the terminal
- read_file: Read file contents
- list_directory: List directory contents
- search_files: Search for text in files
- write_file: Create/modify files (\`inWorkspace:true\` => data/workspace/ relative, \`false\` => project-root-relative or absolute path)
- delete_file: Delete files (\`inWorkspace:true\` => data/workspace/ relative, \`false\` => project-root-relative or absolute path)
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
                "이 마법사는 메신저 봇 토큰과 Codex 연결 설정을 도와줍니다.\n" +
                "언제든지 'igobot setup'을 입력해 이 설정을 다시 진행할 수 있습니다.\n\n" +
                "도중에 중지하려면 Ctrl+C를 누르십시오.",
            first_title: "환영합니다!",
            reconfigure_body: "이미 설정값이 있습니다.\nEnter키를 누르면 기존 값을 유지합니다.",
            fresh_body: "설정을 처음부터 진행합니다.",
            title: "igobot 설정",
        },

        // 텔레그램 설정
        telegram: {
            token_new: "[2/4] @BotFather에서 발급한 Telegram 봇 토큰을 입력하세요",
            token_existing: "[2/4] @BotFather에서 발급한 Telegram 봇 토큰을 입력하세요 (Enter로 기존 값 유지)",
            token_invalid: "올바르지 않은 봇 토큰 형식입니다. (예: 123456789:ABC...)",
            approval_flow_title: "텔레그램 접근 승인",
            approval_flow:
                "이제 허용 사용자 ID를 setup에서 미리 등록하지 않습니다.\n" +
                "새 텔레그램 계정이 메시지를 보내면 igobot이 고유 승인 코드를 발급합니다.\n" +
                "이 컴퓨터에서 `igobot ok {코드}`를 실행해 해당 계정을 승인하세요.",
        },
        discord: {
            token_new: "[2/4] Discord 봇 토큰을 입력하세요",
            token_existing: "[2/4] Discord 봇 토큰을 입력하세요 (Enter로 기존 값 유지)",
            token_invalid: "Discord 봇 토큰이 너무 짧아 보입니다.",
            approval_flow_title: "디스코드 접근 승인",
            approval_flow:
                "새 Discord 계정이 메시지를 보내면 igobot이 고유 승인 코드를 발급합니다.\n" +
                "이 컴퓨터에서 `igobot ok {코드}`를 실행해 해당 계정을 승인하세요.\n\n" +
                "Discord Developer Portal에서 Message Content intent도 켜주세요.",
        },
        messengers: {
            select: "[1/4] 사용할 메신저를 선택하세요",
            token_ready: "토큰 있음",
            token_missing: "토큰 없음",
            selected_token_required: "선택한 메신저({messenger})의 봇 토큰이 필요합니다.",
        },

        // 에이전트 설정 (온보딩용)
        agent_setup: {
            log_level: "[3/4] 로그 레벨을 선택하세요",
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
        outro: "👉 'igobot start'를 입력해 igobot을 시작하세요.",
        cancel: "설정을 취소했습니다.",
        error_prefix: "설정 중 오류 발생",

        access: {
            pending_short: "이 계정은 아직 승인이 필요합니다.",
            request_title: "🔐 보안을 위해 이 계정에 대한 승인이 필요합니다.",
            request_body:
                "이 계정은 처음 보는 계정인 것 같습니다.\n" +
                "보안을 위해 igobot을 사용하기 전에 승인이 필요합니다.\n\n" +
                "igobot이 실행 중인 컴퓨터의 터미널에서 아래 명령어를 실행하세요:\n" +
                "igobot ok {code}\n\n" +
                "승인 후 igobot과 대화할 수 있습니다.",
            approved:
                "✅ 이 계정이 승인되었습니다.\n\n" +
                "이제 igobot과 대화할 준비가 되었습니다.\n" +
                "아무 메시지나 보내서 시작하세요.",
        },

        // ── 봇 런타임 메시지 ──────────────────────────────────────────────
        bot: {
            token_missing: "TELEGRAM_BOT_TOKEN이 설정되지 않았습니다.",
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
        discord_bot: {
            token_missing: "DISCORD_BOT_TOKEN이 설정되지 않았습니다.",
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
            approve_usage: "사용법: igobot ok <인증코드>",
            approve_not_found: "해당 코드의 대기 중인 메신저 승인 요청이 없습니다: {code}",
            approve_already_done: "이미 사용된 승인 코드입니다: {code}",
            approve_success: "{messenger} 계정을 승인했습니다: {account} (userId: {userId})",
            approve_success_next: "이제 이 계정이 igobot에 메시지를 보낼 수 있습니다.",
            approve_notify_failed: "승인은 완료됐지만 확인 메시지 전송에는 실패했습니다.",
        },

        // ── 시스템 프롬프트 (LLM 지시문) ─────────────────────────────────
        system_prompt: `당신은 igobot이라는 자율 AI 에이전트입니다.
사용자의 요청을 수행하기 위해 제공된 도구들을 자유롭게 사용하세요.

**중요 — 실행 환경:**
- 이것은 서버에서 실행되는 에이전트입니다. GUI나 화면이 없습니다.
- 사용자에게 보여줄 모든 내용은 반드시 현재 메신저를 통해 전송해야 합니다.
- 코드 실행 결과, 파일 내용 등도 사용자에게 텍스트로 전달하세요.
- **파일 작업(write_file, delete_file)은 기본적으로 \`inWorkspace: true\`로 \`data/workspace/\` 안에서 처리하세요.** 워크스페이스 밖 경로를 꼭 수정해야 할 때만 \`inWorkspace: false\`를 사용하세요.
- 사용자가 이미지를 보내면 직접 볼 수 있습니다. 이미지 분석이 가능합니다.

사용 가능한 도구:
- run_terminal: 터미널에서 셸 명령 실행
- read_file: 파일 내용 읽기
- list_directory: 디렉토리 내용 목록
- search_files: 파일에서 텍스트 검색
- write_file: 파일 생성/수정 (\`inWorkspace:true\`면 data/workspace/ 기준, \`false\`면 프로젝트 루트 기준 상대 경로 또는 절대 경로)
- delete_file: 파일 삭제 (\`inWorkspace:true\`면 data/workspace/ 기준, \`false\`면 프로젝트 루트 기준 상대 경로 또는 절대 경로)
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
// 점 표기법으로 중첩 키 접근: t('bot.error')
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
