// LLM 마크다운을 Telegram HTML로 변환하는 유틸

// HTML 특수문자 이스케이프
export function escapeHtml(str) {
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// 마크다운을 Telegram HTML로 변환 (긴 텍스트는 splitAndConvert 사용)
export function markdownToTelegramHtml(text) {
    if (!text) return "";

    // 코드 블록을 먼저 추출하여 보호
    const codeBlocks = [];
    let processed = text.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, _lang, code) => {
        const idx = codeBlocks.length;
        codeBlocks.push(`<pre><code>${escapeHtml(code.trimEnd())}</code></pre>`);
        return `\x00CODEBLOCK${idx}\x00`;
    });

    // 인라인 코드 추출
    const inlineCodes = [];
    processed = processed.replace(/`([^`\n]+)`/g, (_, code) => {
        const idx = inlineCodes.length;
        inlineCodes.push(`<code>${escapeHtml(code)}</code>`);
        return `\x00INLINE${idx}\x00`;
    });

    // HTML 이스케이프 (코드 블록/인라인 코드 제외 영역)
    processed = escapeHtml(processed);

    // 코드 블록/인라인 코드 복원
    processed = processed.replace(/\x00CODEBLOCK(\d+)\x00/g, (_, idx) => codeBlocks[parseInt(idx)]);
    processed = processed.replace(/\x00INLINE(\d+)\x00/g, (_, idx) => inlineCodes[parseInt(idx)]);

    // 헤딩 → 볼드
    processed = processed.replace(/^#{1,6}\s+(.+)$/gm, "<b>$1</b>");

    // 볼드 (**text** 또는 __text__)
    processed = processed.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
    processed = processed.replace(/__(.+?)__/g, "<b>$1</b>");

    // 이탤릭 (*text* 또는 _text_)
    processed = processed.replace(/(?<!\w)\*([^*\n]+?)\*(?!\w)/g, "<i>$1</i>");
    processed = processed.replace(/(?<!\w)_([^_\n]+?)_(?!\w)/g, "<i>$1</i>");

    // 취소선
    processed = processed.replace(/~~(.+?)~~/g, "<s>$1</s>");

    // 링크 [text](url)
    processed = processed.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

    // 블록 인용 (> text)
    processed = processed.replace(/^&gt;\s?(.+)$/gm, "<blockquote>$1</blockquote>");
    processed = processed.replace(/<\/blockquote>\n<blockquote>/g, "\n");

    return processed;
}

// 마크다운 텍스트를 청크로 나눈 뒤 각각 HTML로 변환
export function splitAndConvert(text, maxLen = 3000) {
    if (!text) return [""];

    // 1. 코드 블록 (```...```) 전체를 플레이스홀더로 치환하여 보호
    const codeBlocks = [];
    let src = text.replace(/```[\w]*\n?[\s\S]*?```/g, (m) => {
        codeBlocks.push(m);
        return `\x00CB${codeBlocks.length - 1}\x00`;
    });

    // 2. 빈 줄(본단락 구분자) 기준으로 세그먼트 분할
    const segments = src.split(/(\n\n+)/);

    // 3. 세그먼트를 maxLen 이하로 조립
    const rawChunks = [];
    let cur = "";

    for (const seg of segments) {
        const candidate = cur + seg;
        if (candidate.length <= maxLen) {
            cur = candidate;
        } else if (seg.length > maxLen) {
            // 너무 긴 세그먼트: 줄바꿈 단위로 추가 분할
            if (cur) {
                rawChunks.push(cur);
                cur = "";
            }
            const lines = seg.split("\n");
            for (const line of lines) {
                const c2 = cur ? cur + "\n" + line : line;
                if (c2.length <= maxLen) {
                    cur = c2;
                } else {
                    if (cur) rawChunks.push(cur);
                    // 한 줄 자체가 너무 길면: 강제로 자름
                    cur = line.slice(0, maxLen);
                }
            }
        } else {
            if (cur) rawChunks.push(cur);
            cur = seg;
        }
    }
    if (cur) rawChunks.push(cur);

    // 4. 각 청크 코드블록 복원 후 HTML 변환
    return rawChunks
        .map((chunk) => chunk.replace(/\x00CB(\d+)\x00/g, (_, i) => codeBlocks[parseInt(i)]))
        .map((chunk) => markdownToTelegramHtml(chunk))
        .filter((html) => html.trim());
}

// 텍스트가 마크다운인지 판별
export function hasMarkdown(text) {
    return /(\*\*|__|~~|```|`[^`]+`|^#{1,6}\s|^\s*>|\[.+\]\(.+\))/m.test(text);
}
