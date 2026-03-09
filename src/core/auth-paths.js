import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { AUTH_DIR } from "./app-paths.js";

export const CODEX_AUTH_FILE = resolve(AUTH_DIR, "codex.json");
export const TELEGRAM_AUTH_FILE = resolve(AUTH_DIR, "telegram.json");
export const DISCORD_AUTH_FILE = resolve(AUTH_DIR, "discord.json");

export function ensureAuthDir() {
    mkdirSync(AUTH_DIR, { recursive: true });
}

export function getCodexAuthFile() {
    return CODEX_AUTH_FILE;
}

export function getTelegramAuthFile() {
    return TELEGRAM_AUTH_FILE;
}

export function getDiscordAuthFile() {
    return DISCORD_AUTH_FILE;
}
