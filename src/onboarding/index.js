import {
    intro,
    outro,
    text,
    password,
    confirm,
    select,
    spinner,
    note,
    isCancel,
    cancel,
} from "@clack/prompts";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { SUPPORTED_LANGUAGES, createT } from "../i18n.js";
import { getCodexAuthFile } from "../core/auth-paths.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, "..", "..");

const ENV_FILE = resolve(ROOT, ".env");
// ── 헬퍼: .env 파싱 ──────────────────────────────────────────────────────────
function parseEnv(content) {
    const env = {};
    for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const idx = trimmed.indexOf("=");
        if (idx === -1) continue;
        env[trimmed.substring(0, idx).trim()] = trimmed.substring(idx + 1).trim();
    }
    return env;
}

// ── 헬퍼: .env 쓰기 ──────────────────────────────────────────────────────────
function writeEnv(env) {
    const lines = [
        "# igobot Configuration",
        "# WARNING: Never share this file externally!",
        "",
        "# Telegram bot token (from @BotFather)",
        `TELEGRAM_BOT_TOKEN=${env.TELEGRAM_BOT_TOKEN ?? ""}`,
        "",
        "# Agent settings",
        `AGENT_MAX_ITERATIONS=${env.AGENT_MAX_ITERATIONS ?? "100"}`,
        "",
        "# Log level: error, warn, info, debug",
        `LOG_LEVEL=${env.LOG_LEVEL ?? "error"}`,
        "",
        "# Language (e.g. en, ko — see SUPPORTED_LANGUAGES in i18n.js)",
        `LANGUAGE=${env.LANGUAGE ?? "en"}`,
    ];
    writeFileSync(ENV_FILE, lines.join("\n") + "\n", "utf-8");
}

// ── 첫 실행 여부 확인 ─────────────────────────────────────────────────────────
export function needsOnboarding() {
    if (!existsSync(ENV_FILE)) return true;
    const env = parseEnv(readFileSync(ENV_FILE, "utf-8"));
    return !env.TELEGRAM_BOT_TOKEN;
}

// ── cancel 헬퍼: isCancel이면 메시지 출력 후 종료 ────────────────────────────
function abortIfCancel(value, t) {
    if (isCancel(value)) {
        cancel(t("cancel"));
        process.exit(0);
    }
    return value;
}

// ── 메인 온보딩 ───────────────────────────────────────────────────────────────
export async function runOnboarding({ isFirstRun = false } = {}) {
    // 기존 설정 로드
    let existingEnv = {};
    if (existsSync(ENV_FILE)) {
        existingEnv = parseEnv(readFileSync(ENV_FILE, "utf-8"));
    }

    // ── 언어 선택 (언어 선택 전이므로 영어 표시) ──────────────────────────────
    intro("igobot Setup Wizard");

    const langValue = await select({
        message: "Select your language",
        options: SUPPORTED_LANGUAGES,
        initialValue: existingEnv.LANGUAGE || "en",
    });

    // 언어 선택 취소는 영어로 처리 (아직 t()를 사용할 수 없음)
    if (isCancel(langValue)) {
        cancel("Setup cancelled.");
        process.exit(0);
    }

    const t = createT(langValue);

    // ── 환영 메시지 ───────────────────────────────────────────────────────────
    if (isFirstRun) {
        note(t("welcome.first_body"), t("welcome.first_title"));
    } else {
        note(
            existingEnv.TELEGRAM_BOT_TOKEN
                ? t("welcome.reconfigure_body")
                : t("welcome.fresh_body"),
            t("welcome.title"),
        );
    }

    // ── [1/3] 텔레그램 봇 토큰 ───────────────────────────────────────────────
    const hasToken = !!existingEnv.TELEGRAM_BOT_TOKEN;
    const botToken = abortIfCancel(
        await password({
            message: hasToken ? t("telegram.token_existing") : t("telegram.token_new"),
            validate(value) {
                if (!value && !hasToken) return t("telegram.token_required");
                if (value && !/^\d+:[A-Za-z0-9_-]{35,}$/.test(value)) {
                    return t("telegram.token_invalid");
                }
            },
        }),
        t,
    );

    note(t("telegram.approval_flow"), t("telegram.approval_flow_title"));

    // ── [2/3] 에이전트 설정 ──────────────────────────────────────────────────
    const maxIterations = abortIfCancel(
        await text({
            message: t("agent_setup.max_iter"),
            placeholder: "100",
            defaultValue: existingEnv.AGENT_MAX_ITERATIONS || "100",
            validate(value) {
                const n = parseInt(value, 10);
                if (isNaN(n) || n < 1) return t("agent_setup.max_iter_invalid");
                if (n > 1000) return t("agent_setup.max_iter_too_large");
            },
        }),
        t,
    );

    const logHints = t("agent_setup.log_hints");
    const logLevel = abortIfCancel(
        await select({
            message: t("agent_setup.log_level"),
            options: [
                { value: "error", label: "error", hint: logHints.error },
                { value: "warn", label: "warn", hint: logHints.warn },
                { value: "info", label: "info", hint: logHints.info },
                { value: "debug", label: "debug", hint: logHints.debug },
            ],
            initialValue: existingEnv.LOG_LEVEL || "info",
        }),
        t,
    );

    // ── 설정 저장 ─────────────────────────────────────────────────────────────
    const s = spinner();
    s.start(t("save.saving"));

    writeEnv({
        TELEGRAM_BOT_TOKEN: botToken || existingEnv.TELEGRAM_BOT_TOKEN,
        AGENT_MAX_ITERATIONS: maxIterations,
        LOG_LEVEL: logLevel,
        LANGUAGE: langValue,
    });

    s.stop(t("save.saved"));

    // ── [3/3] Codex OAuth 로그인 ──────────────────────────────────────────────
    const alreadyLoggedIn = existsSync(getCodexAuthFile());
    const doLogin = abortIfCancel(
        await confirm({
            message: alreadyLoggedIn ? t("login.confirm_existing") : t("login.confirm_new"),
            initialValue: !alreadyLoggedIn,
        }),
        t,
    );

    if (doLogin) {
        note(t("login.note_body"), t("login.note_title"));

        const loginSpinner = spinner();
        loginSpinner.start(t("login.spinner_start"));

        try {
            const { login } = await import("../llm/codex-auth.js");
            loginSpinner.stop(t("login.spinner_stop"));
            await login();
            note(t("login.success_body"), t("login.success_title"));
        } catch (err) {
            loginSpinner.stop(t("login.error_title"));
            note(`${err.message}\n\n${t("login.error_body")}`, t("login.error_title"));
        }
    } else if (!alreadyLoggedIn) {
        note(t("login.skip_note"), t("login.skip_title"));
    }

    // ── 완료 ─────────────────────────────────────────────────────────────────
    outro(t("outro"));
}

// ── CLI 직접 실행 ─────────────────────────────────────────────────────────────
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
    runOnboarding().catch((err) => {
        console.error(`\nError: ${err.message}`);
        process.exit(1);
    });
}
