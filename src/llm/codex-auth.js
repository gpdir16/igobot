import { randomBytes, createHash } from "node:crypto";
import { createServer } from "node:http";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import logger from "../utils/logger.js";

const CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann";
const AUTH_BASE = "https://auth.openai.com";
const REDIRECT_PORT = 1455;
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/auth/callback`;
const SCOPES = "openid profile email offline_access";
const AUTH_FILE = resolve(process.cwd(), "auth.json");

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
    if (parts.length < 2) throw new Error("올바르지 않은 JWT");
    const payload = Buffer.from(parts[1], "base64url").toString("utf-8");
    return JSON.parse(payload);
}

// 저장된 인증 정보 로드
export function loadAuth() {
    if (!existsSync(AUTH_FILE)) return null;
    try {
        return JSON.parse(readFileSync(AUTH_FILE, "utf-8"));
    } catch {
        return null;
    }
}

// 인증 정보 저장
function saveAuth(data) {
    writeFileSync(AUTH_FILE, JSON.stringify(data, null, 2), "utf-8");
    logger.info("인증 정보 저장 완료");
}

// OAuth 로그인 (PKCE Authorization Code Flow)
export async function login() {
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

    console.log("\n===== igobot Codex OAuth 로그인 =====");
    console.log("아래 URL을 브라우저에서 열어 ChatGPT 계정으로 로그인하세요:\n");
    console.log(authUrl.toString());
    console.log("\n콜백 대기 중...\n");

    return new Promise((resolvePromise, reject) => {
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
                    throw new Error(`토큰 교환 실패: ${tokenRes.status} ${errBody}`);
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
                res.end("<h1>✅ igobot 인증 완료!</h1><p>이 창을 닫아도 됩니다.</p>");

                server.close();
                logger.info(`로그인 성공 (account: ${accountId})`);
                resolvePromise(authData);
            } catch (err) {
                res.writeHead(500);
                res.end("Error");
                server.close();
                reject(err);
            }
        });

        server.listen(REDIRECT_PORT, () => {
            logger.info(`OAuth 콜백 서버 대기 중: http://localhost:${REDIRECT_PORT}`);
        });

        // 5분 타임아웃
        setTimeout(
            () => {
                server.close();
                reject(new Error("로그인 타임아웃 (5분)"));
            },
            5 * 60 * 1000,
        );
    });
}

// access_token 갱신
export async function refreshToken(authData) {
    const refreshTk = authData?.tokens?.refresh_token;
    if (!refreshTk) throw new Error("refresh_token이 없습니다. 다시 로그인하세요.");

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
        throw new Error(`토큰 갱신 실패: ${res.status} ${errBody}`);
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
    logger.info("토큰 갱신 완료");
    return authData;
}

// 유효한 access_token 보장 (필요 시 자동 갱신)
export async function ensureValidToken() {
    let authData = loadAuth();
    if (!authData?.tokens?.access_token) {
        throw new Error("인증 정보가 없습니다. `igobot login`으로 로그인하세요.");
    }

    // access_token JWT exp 확인
    try {
        const payload = decodeJwtPayload(authData.tokens.access_token);
        const expMs = payload.exp * 1000;
        const now = Date.now();
        // 만료 5분 전이면 갱신
        if (now > expMs - 5 * 60 * 1000) {
            logger.info("access_token 만료 임박, 갱신 중...");
            authData = await refreshToken(authData);
        }
    } catch {
        // JWT 파싱 실패 시 갱신 시도
        logger.warn("access_token 파싱 실패, 갱신 시도...");
        authData = await refreshToken(authData);
    }

    return authData.tokens;
}

// CLI에서 직접 실행 시 로그인 수행
const isMain = process.argv[1]?.endsWith("codex-auth.js");
if (isMain) {
    login()
        .then(() => {
            console.log("\n로그인 완료! `igobot start`로 봇을 시작하세요.");
            process.exit(0);
        })
        .catch((err) => {
            console.error("로그인 실패:", err.message);
            process.exit(1);
        });
}
