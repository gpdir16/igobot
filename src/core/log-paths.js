import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

export const LOG_DIR = resolve(process.cwd(), "data", "logs");
export const APP_LOG_FILE = resolve(LOG_DIR, "igobot.log");
export const CLI_LOG_FILE = resolve(LOG_DIR, "igobot-cli.log");

export function ensureLogDir() {
    mkdirSync(LOG_DIR, { recursive: true });
}
