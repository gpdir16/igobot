import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import logger from "../utils/logger.js";

let _playwright = null;
let _browser = null;

// 세션 맵: sessionId -> { context, page }
const _sessions = new Map();

// Firefox가 설치되어 있지 않으면 자동 설치
async function ensureFirefoxInstalled() {
    const pw = await import("playwright");
    _playwright = pw.default || pw;

    // 실제 파일 존재 여부 확인
    const firefoxPath = _playwright.firefox.executablePath();
    if (existsSync(firefoxPath)) {
        logger.debug(`Firefox 이미 설치됨: ${firefoxPath}`);
        return;
    }

    // 파일이 없으면 설치
    logger.info("Firefox(Playwright) 미설치 — 자동 설치 중...");
    try {
        execSync("npx playwright install firefox", { stdio: "inherit" });
        logger.info("Firefox 설치 완료");
    } catch (err) {
        logger.error("Firefox 설치 실패:", err.message);
        throw new Error("Playwright Firefox를 설치할 수 없습니다. 'npx playwright install firefox'를 수동으로 실행해주세요.");
    }
}

// Playwright 브라우저 인스턴스를 가져오기 (lazy 로딩)
async function getBrowser() {
    if (_browser?.isConnected()) return _browser;

    await ensureFirefoxInstalled();

    _browser = await _playwright.firefox.launch();

    logger.info("Firefox 브라우저 시작됨");
    return _browser;
}

// 세션(BrowserContext + Page)을 가져오고 없으면 새로 생성
async function getSession(sessionId = "default") {
    if (_sessions.has(sessionId)) {
        const session = _sessions.get(sessionId);
        // 페이지가 닫혀있으면 새 페이지 열기 (컨텍스트는 유지 → 쿠키 보존)
        if (session.page.isClosed()) {
            session.page = await session.context.newPage();
        }
        return session;
    }

    const browser = await getBrowser();
    const context = await browser.newContext({
        viewport: { width: 1280, height: 800 },
    });
    const page = await context.newPage();
    const session = { context, page };
    _sessions.set(sessionId, session);
    logger.info(`새 브라우저 세션 생성: ${sessionId}`);
    return session;
}

// 모든 세션 및 브라우저 정리
async function closeBrowser() {
    for (const [, { context }] of _sessions) {
        await context.close().catch(() => {});
    }
    _sessions.clear();
    if (_browser) {
        await _browser.close();
        _browser = null;
        logger.info("브라우저 종료됨");
    }
}

// 프로세스 종료 시 정리
process.on("exit", () => {
    _browser?.close();
});

// 브라우저 도구: 웹페이지 열기 및 내용 가져오기
export const browseFetch = {
    name: "browser_fetch",
    description: "웹페이지를 열고 텍스트 내용을 가져옵니다. sessionId를 지정하면 쿠키/로그인 상태 등 세션이 유지됩니다.",
    requiresApproval: false,
    schema: {
        type: "object",
        properties: {
            url: { type: "string", description: "접속할 URL" },
            waitFor: { type: "string", description: "대기할 CSS 선택자 (선택)" },
            timeout: { type: "number", description: "타임아웃(ms) (선택, 기본값: 15000)" },
            sessionId: { type: "string", description: "세션 ID (선택, 기본값: 'default'). 동일 세션으로 쿠키/로그인 상태 유지" },
        },
        required: ["url"],
    },
    async execute(args) {
        const { url, waitFor, timeout = 15000, sessionId = "default" } = args;
        const { page } = await getSession(sessionId);

        try {
            await page.goto(url, { waitUntil: "domcontentloaded", timeout });
            if (waitFor) {
                await page.waitForSelector(waitFor, { timeout: timeout / 2 });
            }
            await page.waitForTimeout(1000);

            const title = await page.title();
            const text = await page.evaluate(() => {
                document.querySelectorAll("script, style, nav, footer, header, iframe, noscript").forEach((el) => el.remove());
                return document.body?.innerText || "";
            });

            let content = `제목: ${title}\nURL: ${url}\n세션: ${sessionId}\n\n${text}`;
            if (content.length > 15000) {
                content = content.slice(0, 7000) + "\n\n... [내용 생략] ...\n\n" + content.slice(-5000);
            }
            return content;
        } catch (err) {
            return `페이지 로드 실패: ${err.message}`;
        }
    },
};

// 브라우저 도구: 페이지 인터랙션 (클릭, 입력 등)
export const browserInteract = {
    name: "browser_interact",
    description: "웹페이지에서 클릭, 텍스트 입력 등의 인터랙션을 수행합니다. sessionId로 로그인 세션 유지 가능.",
    requiresApproval: true,
    schema: {
        type: "object",
        properties: {
            url: { type: "string", description: "접속할 URL (현재 페이지 유지 시 생략 가능)" },
            actions: {
                type: "array",
                description: "수행할 액션 목록",
                items: {
                    type: "object",
                    properties: {
                        action: { type: "string", enum: ["click", "fill", "select", "wait", "evaluate"], description: "액션 종류" },
                        selector: { type: "string", description: "CSS 선택자" },
                        value: { type: "string", description: "입력값 또는 JavaScript 코드" },
                    },
                    required: ["action"],
                },
            },
            sessionId: { type: "string", description: "세션 ID (선택, 기본값: 'default'). 쿠키/로그인 상태 유지" },
        },
        required: ["actions"],
    },
    async execute(args) {
        const { url, actions, sessionId = "default" } = args;
        const { page } = await getSession(sessionId);
        const results = [];

        try {
            if (url) {
                await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
            }

            for (const act of actions) {
                switch (act.action) {
                    case "click":
                        await page.click(act.selector);
                        results.push(`클릭: ${act.selector}`);
                        break;
                    case "fill":
                        await page.fill(act.selector, act.value || "");
                        results.push(`입력: ${act.selector} = "${act.value}"`);
                        break;
                    case "select":
                        await page.selectOption(act.selector, act.value);
                        results.push(`선택: ${act.selector} = "${act.value}"`);
                        break;
                    case "wait":
                        await page.waitForSelector(act.selector, { timeout: 10000 });
                        results.push(`대기 완료: ${act.selector}`);
                        break;
                    case "evaluate": {
                        const evalResult = await page.evaluate(act.value);
                        results.push(`실행 결과: ${JSON.stringify(evalResult)}`);
                        break;
                    }
                }
            }

            const finalText = await page.evaluate(() => document.body?.innerText?.slice(0, 3000) || "");
            results.push(`\n최종 페이지 내용:\n${finalText}`);

            return results.join("\n");
        } catch (err) {
            return `인터랙션 실패: ${err.message}\n수행된 액션:\n${results.join("\n")}`;
        }
    },
};

export { closeBrowser };

export default [browseFetch, browserInteract];
