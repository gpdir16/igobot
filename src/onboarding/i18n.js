// ── 지원 언어 목록 ────────────────────────────────────────────────────────────
// 새 언어 추가 시: SUPPORTED_LANGUAGES에 항목 추가 + translations에 동일 키 추가
export const SUPPORTED_LANGUAGES = [
    { value: "ko", label: "한국어", hint: "ko-KR" },
    { value: "en", label: "English", hint: "en-US" },
];

// ── 번역 데이터 ───────────────────────────────────────────────────────────────
const translations = {
    ko: {
        // 언어 선택
        lang: {
            select: "Select your language / 언어를 선택하세요",
        },

        // 온보딩 시작
        intro: {
            title: " igobot 초기 설정 마법사",
        },

        // 환영 메시지
        welcome: {
            first_body:
                "환영합니다!\n" +
                "이 마법사는 Telegram API와 Codex 연결 등의 작업을 도와줍니다.\n" +
                "언제든지 'igobot setup'을 입력해 이 설정을 다시 진행할 수 있습니다.\n\n" +
                "도중에 중지하려면 Ctrl+C를 누르십시오.",
            first_title: "환영합니다!",
            reconfigure_body: "이미 설정값이 있는것 같습니다.\nEnter키를 누르면 그 값은 기존 값을 유지합니다..",
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

        // 에이전트 설정
        agent: {
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

        // Codex 로그인
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

        // 완료 / 취소
        outro: "설정 완료! 'igobot start'로 봇을 시작하세요.",
        cancel: "설정을 취소했습니다.",
        error_prefix: "설정 중 오류 발생",
    },

    en: {
        lang: {
            select: "Select your language / 언어를 선택하세요",
        },

        intro: {
            title: " igobot Setup Wizard ",
        },

        welcome: {
            first_body:
                "Welcome!\n" +
                "This wizard will help you set up things like the Telegram API and Codex connection.\n" +
                "You can rerun this setup at any time with 'igobot setup'.\n\n" +
                "Press Ctrl+C at any time to cancel.",
            first_title: "Welcome!",
            reconfigure_body:
                "Existing settings were found.\nPress Enter to keep the current values.",
            fresh_body: "Starting the setup from scratch.",
            title: "igobot Setup",
        },

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

        agent: {
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

        save: {
            saving: "Saving configuration...",
            saved: "Configuration saved!",
        },

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

        outro: "Setup complete! Run 'igobot start' to launch the bot.",
        cancel: "Setup cancelled.",
        error_prefix: "Error during setup",
    },
};

// ── t() 함수 생성 ─────────────────────────────────────────────────────────────
// 점 표기법(dot notation)으로 중첩 키 접근: t('telegram.token_new')
export function createT(lang) {
    const msgs = translations[lang] ?? translations["ko"];
    return function t(key) {
        const parts = key.split(".");
        let val = msgs;
        for (const part of parts) {
            val = val?.[part];
            if (val === undefined) break;
        }
        // 찾지 못한 경우 한국어 fallback → 키 자체 반환
        if (val === undefined) {
            let fallback = translations["ko"];
            for (const part of parts) {
                fallback = fallback?.[part];
                if (fallback === undefined) break;
            }
            return fallback ?? key;
        }
        return val;
    };
}
