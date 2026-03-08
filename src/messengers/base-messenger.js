class BaseMessenger {
    constructor({ key }) {
        this.key = key;
        this.yoloRuns = new Set();
        this.onMessage = null;
        this.onReset = null;
    }

    buildSessionId(chatId) {
        return `${this.key}:${String(chatId)}`;
    }

    createMessageContext(chatId, message) {
        return {
            messenger: this,
            messengerKey: this.key,
            chatId,
            sessionId: this.buildSessionId(chatId),
            message,
        };
    }

    async emitMessage(chatId, message) {
        if (!this.onMessage) return;
        return this.onMessage(this.createMessageContext(chatId, message));
    }

    hasYoloRun(chatId) {
        return this.yoloRuns.has(String(chatId));
    }

    enableYoloRun(chatId) {
        this.yoloRuns.add(String(chatId));
    }

    clearYoloRun(chatId) {
        this.yoloRuns.delete(String(chatId));
    }

    async clearStream() {}
}

export default BaseMessenger;
