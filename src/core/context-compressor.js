import logger from "../utils/logger.js";

// 컨텍스트 압축기: 오래된 대화를 요약해 토큰 사용량을 줄임

// 폴백용 토큰 추정 (API 실제값이 없을 때만 사용)
function estimateTokens(text) {
    if (!text) return 0;
    const koreanChars = (text.match(/[\u3131-\uD79D]/g) || []).length;
    const otherChars = text.length - koreanChars;
    return Math.ceil(koreanChars * 2 + otherChars * 0.4);
}

function estimateMessagesTokens(messages) {
    let total = 0;
    for (const msg of messages) {
        if (typeof msg.content === "string") {
            total += estimateTokens(msg.content);
        } else if (msg.arguments) {
            total += estimateTokens(typeof msg.arguments === "string" ? msg.arguments : JSON.stringify(msg.arguments));
        }
        total += 10; // 메시지 오버헤드
    }
    return total;
}

// 컨텍스트 압축 필요 여부 판단
// actualInputTokens: Codex API usage.input_tokens 실제값 (없으면 추정값 폴백)
export function needsCompression(messages, maxTokens = 80000, actualInputTokens = null) {
    const tokenCount = actualInputTokens !== null && actualInputTokens > 0 ? actualInputTokens : estimateMessagesTokens(messages);
    const label = actualInputTokens !== null && actualInputTokens > 0 ? "실제" : "추정";
    logger.debug(`컨텍스트 토큰 ${label}: ${tokenCount}/${maxTokens}`);
    return tokenCount > maxTokens * 0.85; // 85% 이상이면 압축
}

// 오래된 메시지는 요약으로 대체하고 최근 메시지는 유지
export async function compressContext(messages, llmClient, keepRecent = 20) {
    if (messages.length <= keepRecent + 5) return messages;

    const toSummarize = messages.slice(0, messages.length - keepRecent);
    const toKeep = messages.slice(messages.length - keepRecent);

    // 요약 대상을 텍스트로 변환
    let summaryInput = "";
    for (const msg of toSummarize) {
        if (msg.role === "user") {
            summaryInput += `사용자: ${msg.content}\n`;
        } else if (msg.role === "assistant") {
            summaryInput += `에이전트: ${msg.content}\n`;
        } else if (msg.role === "tool") {
            summaryInput += `[도구 결과: ${msg.content?.slice(0, 200)}]\n`;
        } else if (msg.type === "function_call") {
            summaryInput += `[도구 호출: ${msg.name}(${typeof msg.arguments === "string" ? msg.arguments.slice(0, 100) : ""})]\n`;
        }
    }

    // 너무 길면 자르기
    if (summaryInput.length > 20000) {
        summaryInput = summaryInput.slice(0, 10000) + "\n...\n" + summaryInput.slice(-8000);
    }

    logger.info(`컨텍스트 압축: ${toSummarize.length}개 메시지 요약 중...`);

    try {
        const response = await llmClient.chat({
            instructions:
                "당신은 대화 요약 전문가입니다. 제공된 대화 내용을 핵심만 간결하게 요약하세요. 중요한 정보(이름, 숫자, 결정사항, 코드 등)는 반드시 포함하세요. 한국어로 작성하세요.",
            messages: [{ role: "user", content: `다음 대화 내용을 핵심만 요약해주세요:\n\n${summaryInput}` }],
            tools: [],
        });

        const summary = response.text || "(요약 실패)";
        logger.info(`컨텍스트 압축 완료: ${toSummarize.length}개 → 요약 1개 (${summary.length}자)`);

        // 요약 메시지 + 유지할 최근 메시지
        return [{ role: "assistant", content: `[이전 대화 요약]\n${summary}` }, ...toKeep];
    } catch (err) {
        logger.error("컨텍스트 압축 실패:", err);
        // 압축 실패 시 단순 잘라내기
        return [{ role: "assistant", content: "[이전 대화가 길어서 일부가 생략되었습니다.]" }, ...toKeep];
    }
}

export { estimateTokens, estimateMessagesTokens };
