import { execFile, spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";
import { WORKSPACE_DIR } from "../core/app-paths.js";
import { getT } from "../i18n.js";
import logger from "../utils/logger.js";

const execFileAsync = promisify(execFile);
const SCREENSHOT_DIR = resolve(WORKSPACE_DIR, "screenshots");
const MIN_NOTIFICATION_DELAY_MS = 1500;

function isWithinDir(targetPath, baseDir) {
    return targetPath === baseDir || targetPath.startsWith(baseDir + "/");
}

function resolveScreenshotPath(outputPath) {
    const absPath = outputPath
        ? outputPath.startsWith("/")
            ? resolve(outputPath)
            : resolve(WORKSPACE_DIR, outputPath)
        : resolve(SCREENSHOT_DIR, `screen-${Date.now()}.png`);

    if (!isWithinDir(absPath, WORKSPACE_DIR)) {
        throw new Error("Screenshot path must stay inside data/workspace/.");
    }
    if (!absPath.toLowerCase().endsWith(".png")) {
        throw new Error("Screenshot path must end with .png.");
    }

    const dir = dirname(absPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    return absPath;
}

function commandExists(command) {
    const result = spawnSync("which", [command], { stdio: "ignore" });
    return result.status === 0;
}

function getLinuxCommand(outputPath) {
    if (commandExists("gnome-screenshot")) {
        return { command: "gnome-screenshot", args: ["-f", outputPath] };
    }
    if (commandExists("grim")) {
        return { command: "grim", args: [outputPath] };
    }
    if (commandExists("scrot")) {
        return { command: "scrot", args: [outputPath] };
    }
    throw new Error("No supported Linux screenshot command found. Install gnome-screenshot, grim, or scrot.");
}

function getNotificationCommand(title, message) {
    if (process.platform === "darwin") {
        const script =
            "const app = Application.currentApplication();" +
            "app.includeStandardAdditions = true;" +
            "app.beep();" +
            "try {" +
            `app.displayDialog(${JSON.stringify(message)}, { withTitle: ${JSON.stringify(title)}, buttons: [\"OK\"], defaultButton: \"OK\", givingUpAfter: 2 });` +
            "} catch (error) {" +
            "if (!String(error).includes('User canceled')) throw error;" +
            "}";
        return {
            command: "/usr/bin/osascript",
            args: ["-l", "JavaScript", "-e", script],
        };
    }

    if (process.platform === "linux" && commandExists("notify-send")) {
        return {
            command: "notify-send",
            args: [title, message],
        };
    }

    return null;
}

function getCaptureCommand(outputPath, display, includeCursor) {
    if (process.platform === "darwin") {
        const args = ["-x"];
        if (includeCursor) args.push("-C");
        if (Number.isInteger(display) && display > 0) {
            args.push("-D", String(display));
        }
        args.push(outputPath);
        return { command: "/usr/sbin/screencapture", args };
    }

    if (process.platform === "linux") {
        return getLinuxCommand(outputPath);
    }

    throw new Error(`Unsupported platform for screenshots: ${process.platform}`);
}

function sleep(ms) {
    return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}

async function notifyBeforeCapture(message, delayMs, timeout) {
    const notification = getNotificationCommand("igobot", message);
    if (!notification) {
        throw new Error("Visible desktop warning is not available on this host.");
    }

    await execFileAsync(notification.command, notification.args, { timeout });

    await sleep(delayMs);
}

export default {
    name: "screenshot",
    description: "Captures the current computer screen as a PNG file.",
    requiresApproval: true,
    schema: {
        type: "object",
        properties: {
            path: {
                type: "string",
                description: "Output PNG path. Relative paths are resolved inside data/workspace/ (optional).",
            },
            display: {
                type: "number",
                description: "Display number to capture on macOS (optional, 1-based).",
            },
            delayMs: {
                type: "number",
                description: "Delay before capture in milliseconds (optional).",
            },
            includeCursor: {
                type: "boolean",
                description: "Include the mouse cursor when supported (optional, default: false).",
            },
            timeout: {
                type: "number",
                description: "Timeout in ms for the capture command (optional, default: 15000).",
            },
        },
    },
    async execute(args) {
        const {
            path,
            display,
            delayMs,
            includeCursor = false,
            timeout = 15000,
        } = args;

        const outputPath = resolveScreenshotPath(path);
        const requestedDelayMs = typeof delayMs === "number" ? delayMs : MIN_NOTIFICATION_DELAY_MS;
        const effectiveDelayMs = Math.max(MIN_NOTIFICATION_DELAY_MS, requestedDelayMs);
        const t = getT();

        try {
            await notifyBeforeCapture(t("security.screenshot_notice"), effectiveDelayMs, timeout);
        } catch (err) {
            logger.warn(`Screenshot pre-capture warning skipped: ${err.stderr?.trim() || err.message}`);
        }

        const { command, args: commandArgs } = getCaptureCommand(outputPath, display, includeCursor);

        try {
            await execFileAsync(command, commandArgs, { timeout });
        } catch (err) {
            const reason = err.stderr?.trim() || err.message;
            return `Screenshot failed: ${reason}`;
        }

        if (!existsSync(outputPath)) {
            return "Screenshot failed: capture command finished but no PNG file was created.";
        }

        return `Screenshot saved: ${outputPath}`;
    },
};
