import { randomBytes, createHash } from "node:crypto";
import { createServer } from "node:http";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import logger from "../utils/logger.js";
import { getT } from "../i18n.js";
import { ensureAuthDir, getCodexAuthFile } from "../core/auth-paths.js";

const CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann";
const AUTH_BASE = "https://auth.openai.com";
const REDIRECT_PORT = 1455;
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/auth/callback`;
const SCOPES = "openid profile email offline_access";
// PKCE code_verifier / code_challenge 생성
function generatePKCE() {
    const verifier = randomBytes(64).toString("hex");
    const digest = createHash("sha256").update(verifier).digest();
    const challenge = digest.toString("base64url");
    return { verifier, challenge };
}

// JWT payload 디코딩 (서명 검증 없음)
function decodeJwtPayload(token) {
    const parts = token.split(".");
    if (parts.length < 2) throw new Error(getT()("auth.invalid_jwt"));
    const payload = Buffer.from(parts[1], "base64url").toString("utf-8");
    return JSON.parse(payload);
}

// 저장된 인증 정보 로드
export function loadAuth() {
    const authFile = getCodexAuthFile();
    if (!existsSync(authFile)) return null;
    try {
        return JSON.parse(readFileSync(authFile, "utf-8"));
    } catch {
        return null;
    }
}

// 인증 정보 저장
function saveAuth(data) {
    ensureAuthDir();
    writeFileSync(getCodexAuthFile(), JSON.stringify(data, null, 2), "utf-8");
    logger.info("Credentials saved");
}

// OAuth 로그인 (PKCE Authorization Code Flow)
export async function login() {
    const t = getT();
    const { verifier, challenge } = generatePKCE();
    const state = randomBytes(16).toString("hex");

    const authUrl = new URL(`${AUTH_BASE}/oauth/authorize`);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("client_id", CLIENT_ID);
    authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
    authUrl.searchParams.set("scope", SCOPES);
    authUrl.searchParams.set("code_challenge", challenge);
    authUrl.searchParams.set("code_challenge_method", "S256");
    authUrl.searchParams.set("id_token_add_organizations", "true");
    authUrl.searchParams.set("codex_cli_simplified_flow", "true");
    authUrl.searchParams.set("state", state);

    console.log(`\n${t("auth.login_header")}`);
    console.log(t("auth.login_instruction") + "\n");
    console.log(authUrl.toString());
    console.log(`\n${t("auth.callback_waiting")}\n`);

    return new Promise((resolvePromise, reject) => {
        let timeoutId;
        const server = createServer(async (req, res) => {
            try {
                const url = new URL(req.url, `http://localhost:${REDIRECT_PORT}`);
                if (url.pathname !== "/auth/callback") {
                    res.writeHead(404);
                    res.end("Not Found");
                    return;
                }

                const code = url.searchParams.get("code");
                const returnedState = url.searchParams.get("state");

                if (returnedState !== state) {
                    res.writeHead(400);
                    res.end("State mismatch");
                    reject(new Error("State mismatch"));
                    server.close();
                    return;
                }

                // Authorization code → Token 교환
                const tokenRes = await fetch(`${AUTH_BASE}/oauth/token`, {
                    method: "POST",
                    headers: { "Content-Type": "application/x-www-form-urlencoded" },
                    body: new URLSearchParams({
                        grant_type: "authorization_code",
                        code,
                        redirect_uri: REDIRECT_URI,
                        client_id: CLIENT_ID,
                        code_verifier: verifier,
                    }),
                });

                if (!tokenRes.ok) {
                    const errBody = await tokenRes.text();
                    throw new Error(t("auth.token_exchange_failed", { status: tokenRes.status, body: errBody }));
                }

                const tokenData = await tokenRes.json();

                // id_token에서 account_id 추출
                const idPayload = decodeJwtPayload(tokenData.id_token);
                const accountId = idPayload["https://api.openai.com/auth"]?.chatgpt_account_id;

                const authData = {
                    tokens: {
                        id_token: tokenData.id_token,
                        access_token: tokenData.access_token,
                        refresh_token: tokenData.refresh_token,
                        account_id: accountId,
                    },
                    last_refresh: new Date().toISOString(),
                };

                saveAuth(authData);

                res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
                res.end(t("auth.success_page"));

                clearTimeout(timeoutId);
                server.close();
                logger.info(`Login successful (account: ${accountId})`);
                resolvePromise(authData);
            } catch (err) {
                res.writeHead(500);
                res.end("Error");
                clearTimeout(timeoutId);
                server.close();
                reject(err);
            }
        });

        server.on("error", (err) => {
            clearTimeout(timeoutId);
            reject(err);
        });
        server.listen(REDIRECT_PORT);

        // 5분 타임아웃
        timeoutId = setTimeout(
            () => {
                server.close();
                reject(new Error(getT()("auth.login_timeout")));
            },
            5 * 60 * 1000,
        );
    });
}

// access_token 갱신
export async function refreshToken(authData) {
    const t = getT();
    const refreshTk = authData?.tokens?.refresh_token;
    if (!refreshTk) throw new Error(t("auth.no_refresh_token"));

    const res = await fetch(`${AUTH_BASE}/oauth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            grant_type: "refresh_token",
            refresh_token: refreshTk,
            client_id: CLIENT_ID,
            scope: SCOPES,
        }),
    });

    if (!res.ok) {
        const errBody = await res.text();
        throw new Error(t("auth.token_refresh_failed", { status: res.status, body: errBody }));
    }

    const tokenData = await res.json();
    const idPayload = decodeJwtPayload(tokenData.id_token);
    const accountId = idPayload["https://api.openai.com/auth"]?.chatgpt_account_id;

    authData.tokens = {
        id_token: tokenData.id_token,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        account_id: accountId,
    };
    authData.last_refresh = new Date().toISOString();

    saveAuth(authData);
    logger.info("Token refreshed");
    return authData;
}

// 유효한 access_token 보장 (필요 시 자동 갱신)
export async function ensureValidToken() {
    const t = getT();
    let authData = loadAuth();
    if (!authData?.tokens?.access_token) {
        throw new Error(t("auth.no_auth"));
    }

    // access_token JWT exp 확인
    try {
        const payload = decodeJwtPayload(authData.tokens.access_token);
        const expMs = payload.exp * 1000;
        const now = Date.now();
        // 만료 5분 전이면 갱신
        if (now > expMs - 5 * 60 * 1000) {
            logger.info("access_token expiring soon, refreshing...");
            authData = await refreshToken(authData);
        }
    } catch {
        // JWT 파싱 실패 시 갱신 시도
        logger.warn("access_token parse failed, attempting refresh...");
        authData = await refreshToken(authData);
    }

    return authData.tokens;
}

// CLI에서 직접 실행 시 로그인 수행
const isMain = process.argv[1]?.endsWith("codex-auth.js");
if (isMain) {
    // CLI 단독 실행 시 .env 로드 (언어 설정 반영)
    await import("dotenv/config");
    login()
        .then(() => {
            console.log(getT()("auth.login_complete"));
            process.exit(0);
        })
        .catch((err) => {
            console.error(getT()("auth.login_failed"), err.message);
            process.exit(1);
        });
}
