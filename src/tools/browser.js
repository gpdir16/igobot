import logger from '../utils/logger.js';

let _playwright = null;
let _browser = null;

/**
 * Playwright 인스턴스를 가져오기 (lazy 로딩)
 */
async function getBrowser() {
  if (_browser?.isConnected()) return _browser;

  if (!_playwright) {
    const pw = await import('playwright');
    _playwright = pw.default || pw;
  }

  _browser = await _playwright.firefox.launch({
    headless: false,
    args: ['--no-remote']
  });

  logger.info('Firefox 브라우저 시작됨 (headful)');
  return _browser;
}

/**
 * 브라우저 정리
 */
async function closeBrowser() {
  if (_browser) {
    await _browser.close();
    _browser = null;
    logger.info('브라우저 종료됨');
  }
}

// 프로세스 종료 시 정리
process.on('exit', () => { _browser?.close(); });

/**
 * 브라우저 도구: 웹페이지 열기 및 내용 가져오기
 */
export const browseFetch = {
  name: 'browser_fetch',
  description: '웹페이지를 열고 텍스트 내용을 가져옵니다. JavaScript가 실행된 후의 결과를 반환합니다.',
  requiresApproval: false,
  schema: {
    type: 'object',
    properties: {
      url: { type: 'string', description: '접속할 URL' },
      waitFor: { type: 'string', description: '대기할 CSS 선택자 (선택)' },
      timeout: { type: 'number', description: '타임아웃(ms) (선택, 기본값: 15000)' }
    },
    required: ['url']
  },
  async execute(args) {
    const { url, waitFor, timeout = 15000 } = args;
    const browser = await getBrowser();
    const page = await browser.newPage();

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
      if (waitFor) {
        await page.waitForSelector(waitFor, { timeout: timeout / 2 });
      }
      // 약간의 추가 대기 (동적 렌더링)
      await page.waitForTimeout(1000);

      const title = await page.title();
      const text = await page.evaluate(() => {
        // 불필요한 요소 제거
        document.querySelectorAll('script, style, nav, footer, header, iframe, noscript').forEach(el => el.remove());
        return document.body?.innerText || '';
      });

      let content = `제목: ${title}\nURL: ${url}\n\n${text}`;
      if (content.length > 15000) {
        content = content.slice(0, 7000) + '\n\n... [내용 생략] ...\n\n' + content.slice(-5000);
      }
      return content;
    } catch (err) {
      return `페이지 로드 실패: ${err.message}`;
    } finally {
      await page.close();
    }
  }
};

/**
 * 브라우저 도구: 스크린샷 촬영
 */
export const browserScreenshot = {
  name: 'browser_screenshot',
  description: '웹페이지의 스크린샷을 촬영합니다. 촬영 후 자동으로 사용자에게 텔레그램 사진으로 전송됩니다.',
  requiresApproval: false,
  schema: {
    type: 'object',
    properties: {
      url: { type: 'string', description: '접속할 URL' },
      caption: { type: 'string', description: '사진 설명 (선택)' },
      fullPage: { type: 'boolean', description: '전체 페이지 캡처 여부 (선택, 기본값: false)' }
    },
    required: ['url']
  },
  async execute(args) {
    const { url, caption = '', fullPage = false } = args;
    const browser = await getBrowser();
    const page = await browser.newPage();

    // 저장 경로 자동 생성 (data/workspace/screenshots/)
    const { mkdirSync, existsSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const dir = resolve(process.cwd(), 'data', 'workspace', 'screenshots');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const filename = `screenshot_${Date.now()}.png`;
    const savePath = resolve(dir, filename);

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(2000);
      await page.screenshot({ path: savePath, fullPage });
      // 특수 객체 반환 → agent.js가 bot.sendPhoto로 자동 전송
      return { __type: 'photo', path: savePath, caption: caption || `${url} 스크린샷` };
    } catch (err) {
      return `스크린샷 실패: ${err.message}`;
    } finally {
      await page.close();
    }
  }
};

/**
 * 브라우저 도구: 페이지 인터랙션 (클릭, 입력 등)
 */
export const browserInteract = {
  name: 'browser_interact',
  description: '웹페이지에서 클릭, 텍스트 입력 등의 인터랙션을 수행합니다.',
  requiresApproval: true,
  schema: {
    type: 'object',
    properties: {
      url: { type: 'string', description: '접속할 URL' },
      actions: {
        type: 'array',
        description: '수행할 액션 목록',
        items: {
          type: 'object',
          properties: {
            action: { type: 'string', enum: ['click', 'fill', 'select', 'wait', 'evaluate'], description: '액션 종류' },
            selector: { type: 'string', description: 'CSS 선택자' },
            value: { type: 'string', description: '입력값 또는 JavaScript 코드' }
          },
          required: ['action']
        }
      }
    },
    required: ['url', 'actions']
  },
  async execute(args) {
    const { url, actions } = args;
    const browser = await getBrowser();
    const page = await browser.newPage();
    const results = [];

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });

      for (const act of actions) {
        switch (act.action) {
          case 'click':
            await page.click(act.selector);
            results.push(`클릭: ${act.selector}`);
            break;
          case 'fill':
            await page.fill(act.selector, act.value || '');
            results.push(`입력: ${act.selector} = "${act.value}"`);
            break;
          case 'select':
            await page.selectOption(act.selector, act.value);
            results.push(`선택: ${act.selector} = "${act.value}"`);
            break;
          case 'wait':
            await page.waitForSelector(act.selector, { timeout: 10000 });
            results.push(`대기 완료: ${act.selector}`);
            break;
          case 'evaluate':
            const evalResult = await page.evaluate(act.value);
            results.push(`실행 결과: ${JSON.stringify(evalResult)}`);
            break;
        }
      }

      // 최종 페이지 텍스트
      const finalText = await page.evaluate(() => document.body?.innerText?.slice(0, 3000) || '');
      results.push(`\n최종 페이지 내용:\n${finalText}`);

      return results.join('\n');
    } catch (err) {
      return `인터랙션 실패: ${err.message}\n수행된 액션:\n${results.join('\n')}`;
    } finally {
      await page.close();
    }
  }
};

/**
 * 브라우저 정리 함수도 export
 */
export { closeBrowser };

export default [browseFetch, browserScreenshot, browserInteract];
