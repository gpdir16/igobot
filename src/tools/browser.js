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
        logger.debug(`Firefox already installed: ${firefoxPath}`);
        return;
    }

    // 파일이 없으면 설치
    logger.info("Firefox (Playwright) not found — installing...");
    try {
        execSync("npx playwright install firefox", { stdio: "inherit" });
        logger.info("Firefox installed.");
    } catch (err) {
        logger.error("Firefox installation failed:", err.message);
        throw new Error("Could not install Playwright Firefox. Run 'npx playwright install firefox' manually.");
    }
}

// Playwright 브라우저 인스턴스를 가져오기 (lazy 로딩)
async function getBrowser() {
    if (_browser?.isConnected()) return _browser;

    await ensureFirefoxInstalled();

    _browser = await _playwright.firefox.launch();

    logger.info("Firefox browser started.");
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
    logger.info(`New browser session created: ${sessionId}`);
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
        logger.info("Browser closed.");
    }
}

// 프로세스 종료 시 정리
process.on("exit", () => {
    _browser?.close();
});

// 브라우저 도구: 웹페이지 열기 및 내용 가져오기
export const browseFetch = {
    name: "browser_fetch",
    description: "Opens a webpage and returns its text content. Specify sessionId to preserve cookies/login state across calls.",
    requiresApproval: false,
    schema: {
        type: "object",
        properties: {
            url: { type: "string", description: "URL to navigate to" },
            waitFor: { type: "string", description: "CSS selector to wait for (optional)" },
            timeout: { type: "number", description: "Timeout in ms (optional, default: 15000)" },
            sessionId: { type: "string", description: "Session ID (optional, default: 'default'). Use the same session to keep cookies/login state." },
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

            let content = `Title: ${title}\nURL: ${url}\nSession: ${sessionId}\n\n${text}`;
            if (content.length > 15000) {
                content = content.slice(0, 7000) + "\n\n... [content truncated] ...\n\n" + content.slice(-5000);
            }
            return content;
        } catch (err) {
            return `Page load failed: ${err.message}`;
        }
    },
};

// 브라우저 도구: 페이지 인터랙션 (클릭, 입력 등)
export const browserInteract = {
    name: "browser_interact",
    description: "Performs interactions on a webpage such as clicking, typing, or selecting. Use sessionId to maintain login sessions.",
    requiresApproval: true,
    schema: {
        type: "object",
        properties: {
            url: { type: "string", description: "URL to navigate to (omit to stay on current page)" },
            actions: {
                type: "array",
                description: "List of actions to perform",
                items: {
                    type: "object",
                    properties: {
                        action: { type: "string", enum: ["click", "fill", "select", "wait", "evaluate"], description: "Action type" },
                        selector: { type: "string", description: "CSS selector" },
                        value: { type: "string", description: "Input value or JavaScript code" },
                    },
                    required: ["action"],
                },
            },
            sessionId: { type: "string", description: "Session ID (optional, default: 'default'). Preserves cookies/login state." },
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
                        results.push(`Clicked: ${act.selector}`);
                        break;
                    case "fill":
                        await page.fill(act.selector, act.value || "");
                        results.push(`Filled: ${act.selector} = "${act.value}"`);
                        break;
                    case "select":
                        await page.selectOption(act.selector, act.value);
                        results.push(`Selected: ${act.selector} = "${act.value}"`);
                        break;
                    case "wait":
                        await page.waitForSelector(act.selector, { timeout: 10000 });
                        results.push(`Waited for: ${act.selector}`);
                        break;
                    case "evaluate": {
                        const evalResult = await page.evaluate(act.value);
                        results.push(`Evaluated: ${JSON.stringify(evalResult)}`);
                        break;
                    }
                }
            }

            const finalText = await page.evaluate(() => document.body?.innerText?.slice(0, 3000) || "");
            results.push(`\nFinal page content:\n${finalText}`);

            return results.join("\n");
        } catch (err) {
            return `Interaction failed: ${err.message}\nCompleted actions:\n${results.join("\n")}`;
        }
    },
};

export { closeBrowser };

export default [browseFetch, browserInteract];
