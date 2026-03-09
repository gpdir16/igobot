import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const APP_ROOT = resolve(__dirname, "..", "..");
export const DATA_DIR = resolve(APP_ROOT, "data");
export const AUTH_DIR = resolve(DATA_DIR, "auth");
export const LOG_DIR = resolve(DATA_DIR, "logs");
export const MEMORY_DIR = resolve(DATA_DIR, "memory");
export const WORKSPACE_DIR = resolve(DATA_DIR, "workspace");
export const SKILLS_DIR = resolve(APP_ROOT, "src", "skills");
export const TOOLS_DIR = resolve(APP_ROOT, "src", "tools");
export const MODEL_FILE = resolve(APP_ROOT, "model.json");
export const TOOL_LOG_DIR = resolve(WORKSPACE_DIR, "tool_logs");

export function resolveAppPath(...segments) {
    return resolve(APP_ROOT, ...segments);
}
