import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { ensureAuthDir, getTelegramAuthFile } from "../../core/auth-paths.js";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 8;
const MAX_CODE_HISTORY = 2000;

function createEmptyStore() {
    return {
        version: 1,
        authorizedUsers: [],
        pendingRequests: [],
        codeHistory: [],
    };
}

function normalizeEntryArray(value) {
    return Array.isArray(value) ? value.filter((entry) => entry && typeof entry === "object") : [];
}

function normalizeStore(raw) {
    const store = raw && typeof raw === "object" ? raw : {};
    return {
        version: 1,
        authorizedUsers: normalizeEntryArray(store.authorizedUsers),
        pendingRequests: normalizeEntryArray(store.pendingRequests),
        codeHistory: normalizeEntryArray(store.codeHistory).slice(-MAX_CODE_HISTORY),
    };
}

function ensureStoreDir() {
    ensureAuthDir();
}

export function loadTelegramAuthStore() {
    const storeFile = getTelegramAuthFile();
    if (!existsSync(storeFile)) return createEmptyStore();

    try {
        return normalizeStore(JSON.parse(readFileSync(storeFile, "utf-8")));
    } catch {
        return createEmptyStore();
    }
}

export function saveTelegramAuthStore(store) {
    ensureStoreDir();
    const normalized = normalizeStore(store);
    const storeFile = getTelegramAuthFile();
    const tmpFile = `${storeFile}.${process.pid}.tmp`;
    writeFileSync(tmpFile, JSON.stringify(normalized, null, 2) + "\n", "utf-8");
    renameSync(tmpFile, storeFile);
}

function normalizeCode(value) {
    return String(value || "")
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "");
}

function generateUniqueCode(store) {
    const usedCodes = new Set([
        ...store.pendingRequests.map((entry) => normalizeCode(entry.code)),
        ...store.codeHistory.map((entry) => normalizeCode(entry.code)),
    ]);

    for (let attempt = 0; attempt < 1000; attempt++) {
        const bytes = randomBytes(CODE_LENGTH);
        let code = "";
        for (let i = 0; i < CODE_LENGTH; i++) {
            code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
        }
        if (!usedCodes.has(code)) return code;
    }

    throw new Error("Failed to generate a unique Telegram approval code.");
}

function trimHistory(store) {
    if (store.codeHistory.length > MAX_CODE_HISTORY) {
        store.codeHistory = store.codeHistory.slice(-MAX_CODE_HISTORY);
    }
}

function pickUserFields(user) {
    return {
        userId: String(user.userId),
        chatId: String(user.chatId),
        username: user.username || null,
        firstName: user.firstName || null,
        lastName: user.lastName || null,
    };
}

export function isTelegramUserAuthorized(userId) {
    const normalizedUserId = String(userId);
    const store = loadTelegramAuthStore();
    return store.authorizedUsers.some((entry) => String(entry.userId) === normalizedUserId);
}

export function createTelegramAccessRequest(user) {
    const normalizedUserId = String(user.userId);
    const normalizedChatId = String(user.chatId);
    const store = loadTelegramAuthStore();

    const existingAuthorizedUser = store.authorizedUsers.find((entry) => String(entry.userId) === normalizedUserId);
    if (existingAuthorizedUser) {
        return {
            status: "authorized",
            authorizedUser: existingAuthorizedUser,
        };
    }

    const now = new Date().toISOString();
    const existingPendingRequest = store.pendingRequests.find((entry) => String(entry.userId) === normalizedUserId);

    if (existingPendingRequest) {
        existingPendingRequest.chatId = normalizedChatId;
        existingPendingRequest.username = user.username || null;
        existingPendingRequest.firstName = user.firstName || null;
        existingPendingRequest.lastName = user.lastName || null;
        existingPendingRequest.lastRequestedAt = now;
        saveTelegramAuthStore(store);

        return {
            status: "pending",
            isNew: false,
            request: existingPendingRequest,
        };
    }

    const code = generateUniqueCode(store);
    const request = {
        code,
        ...pickUserFields({ ...user, chatId: normalizedChatId }),
        requestedAt: now,
        lastRequestedAt: now,
    };

    store.pendingRequests.push(request);
    store.codeHistory.push({
        code,
        userId: normalizedUserId,
        chatId: normalizedChatId,
        status: "pending",
        createdAt: now,
        updatedAt: now,
    });
    trimHistory(store);
    saveTelegramAuthStore(store);

    return {
        status: "pending",
        isNew: true,
        request,
    };
}

export function approveTelegramAccessCode(code) {
    const normalizedCode = normalizeCode(code);
    if (!normalizedCode) {
        return { status: "invalid_code" };
    }

    const store = loadTelegramAuthStore();
    const pendingIndex = store.pendingRequests.findIndex((entry) => normalizeCode(entry.code) === normalizedCode);

    if (pendingIndex === -1) {
        const codeRecord = store.codeHistory.find((entry) => normalizeCode(entry.code) === normalizedCode);
        if (codeRecord?.status === "approved") {
            return { status: "already_approved", codeRecord };
        }
        return { status: "not_found" };
    }

    const request = store.pendingRequests[pendingIndex];
    const now = new Date().toISOString();
    const authorizedUser = {
        ...pickUserFields(request),
        approvedAt: now,
        approvedCode: request.code,
    };

    const authorizedIndex = store.authorizedUsers.findIndex((entry) => String(entry.userId) === String(request.userId));
    if (authorizedIndex >= 0) {
        store.authorizedUsers[authorizedIndex] = authorizedUser;
    } else {
        store.authorizedUsers.push(authorizedUser);
    }

    store.pendingRequests.splice(pendingIndex, 1);

    const historyEntry = store.codeHistory.find((entry) => normalizeCode(entry.code) === normalizedCode);
    if (historyEntry) {
        historyEntry.status = "approved";
        historyEntry.updatedAt = now;
        historyEntry.resolvedAt = now;
    }

    saveTelegramAuthStore(store);

    return {
        status: "approved",
        request,
        authorizedUser,
    };
}

export function formatTelegramAccountLabel(entry) {
    const name = [entry.firstName, entry.lastName].filter(Boolean).join(" ").trim();
    if (entry.username && name) return `@${entry.username} (${name})`;
    if (entry.username) return `@${entry.username}`;
    if (name) return name;
    return `user ${entry.userId}`;
}

export function getTelegramAuthStorePath() {
    return getTelegramAuthFile();
}
