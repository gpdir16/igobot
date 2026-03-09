import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { LOG_DIR as APP_LOG_DIR } from "./app-paths.js";

export const LOG_DIR = APP_LOG_DIR;
export const APP_LOG_FILE = resolve(LOG_DIR, "igobot.log");
export const CLI_LOG_FILE = resolve(LOG_DIR, "igobot-cli.log");

export function ensureLogDir() {
    mkdirSync(LOG_DIR, { recursive: true });
}
