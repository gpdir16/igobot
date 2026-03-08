import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const APP_ROOT = resolve(__dirname, "..", "..");

export const AUTH_DIR = resolve(APP_ROOT, "data", "auth");
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
