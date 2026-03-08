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
import { SUPPORTED_LANGUAGES, createT } from "./i18n.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, "..", "..");

const ENV_FILE = resolve(ROOT, ".env");
const AUTH_FILE = resolve(ROOT, "auth.json");

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
        "# Allowed Telegram user IDs (comma-separated)",
        `TELEGRAM_ALLOWED_USERS=${env.TELEGRAM_ALLOWED_USERS ?? ""}`,
        "",
        "# Agent settings",
        `AGENT_MAX_ITERATIONS=${env.AGENT_MAX_ITERATIONS ?? "100"}`,
        "",
        "# Log level: error, warn, info, debug",
        `LOG_LEVEL=${env.LOG_LEVEL ?? "error"}`,
        "",
        "# Language: en, ko",
        `LANGUAGE=${env.LANGUAGE ?? "en"}`,
    ];
    writeFileSync(ENV_FILE, lines.join("\n") + "\n", "utf-8");
}

// ── 첫 실행 여부 확인 ─────────────────────────────────────────────────────────
export function needsOnboarding() {
    if (!existsSync(ENV_FILE)) return true;
    const env = parseEnv(readFileSync(ENV_FILE, "utf-8"));
    return !env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_ALLOWED_USERS;
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

    // ── 언어 선택 (이중언어 표시 — 아직 언어를 모르므로) ─────────────────────
    intro(" igobot Setup Wizard / 설정 마법사 ");

    const langValue = await select({
        message: "Select your language / 언어를 선택하세요",
        options: SUPPORTED_LANGUAGES,
        initialValue: existingEnv.LANGUAGE || "en",
    });

    // 언어 선택 취소는 이중언어 메시지로 처리
    if (isCancel(langValue)) {
        cancel("Setup cancelled. / 설정을 취소했습니다.");
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

    // ── [1/5] 텔레그램 봇 토큰 ───────────────────────────────────────────────
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

    // ── [2/5] 허용된 사용자 ID ────────────────────────────────────────────────
    const allowedUsers = abortIfCancel(
        await text({
            message: t("telegram.users"),
            placeholder: existingEnv.TELEGRAM_ALLOWED_USERS || t("telegram.users_placeholder"),
            defaultValue: existingEnv.TELEGRAM_ALLOWED_USERS || "",
            validate(value) {
                if (!value && !existingEnv.TELEGRAM_ALLOWED_USERS) {
                    return t("telegram.users_required");
                }
                if (value && !/^[\d,\s]+$/.test(value)) {
                    return t("telegram.users_invalid");
                }
            },
        }),
        t,
    );

    // ── [3/4] 에이전트 설정 ──────────────────────────────────────────────────
    const maxIterations = abortIfCancel(
        await text({
            message: t("agent.max_iter"),
            placeholder: "100",
            defaultValue: existingEnv.AGENT_MAX_ITERATIONS || "100",
            validate(value) {
                const n = parseInt(value, 10);
                if (isNaN(n) || n < 1) return t("agent.max_iter_invalid");
                if (n > 1000) return t("agent.max_iter_too_large");
            },
        }),
        t,
    );

    const logHints = t("agent.log_hints");
    const logLevel = abortIfCancel(
        await select({
            message: t("agent.log_level"),
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
        TELEGRAM_ALLOWED_USERS: allowedUsers || existingEnv.TELEGRAM_ALLOWED_USERS,
        AGENT_MAX_ITERATIONS: maxIterations,
        LOG_LEVEL: logLevel,
        LANGUAGE: langValue,
    });

    s.stop(t("save.saved"));

    // ── [5/5] Codex OAuth 로그인 ──────────────────────────────────────────────
    const alreadyLoggedIn = existsSync(AUTH_FILE);
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
        console.error(`\n오류 / Error: ${err.message}`);
        process.exit(1);
    });
}
