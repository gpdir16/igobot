import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

export const AUTH_DIR = resolve(process.cwd(), "data", "auth");
export const CODEX_AUTH_FILE = resolve(AUTH_DIR, "codex.json");
export const TELEGRAM_AUTH_FILE = resolve(AUTH_DIR, "telegram.json");

export function ensureAuthDir() {
    mkdirSync(AUTH_DIR, { recursive: true });
}

export function getCodexAuthFile() {
    return CODEX_AUTH_FILE;
}

export function getTelegramAuthFile() {
    return TELEGRAM_AUTH_FILE;
}
