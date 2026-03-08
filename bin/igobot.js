#!/usr/bin/env node

import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PID_FILE = join(__dirname, "..", "data", "igobot.pid");
const LOG_FILE = join(__dirname, "..", "logs", "igobot.log");

const command = process.argv[2];
const args = process.argv.slice(3);

async function runCommand(cmd, args) {
    switch (cmd) {
        case "start":
            await checkFirstRun();
            await startBot();
            break;
        case "stop":
            await stopBot();
            break;
        case "restart":
            await stopBot();
            await startBot();
            break;
        case "status":
            await showStatus();
            break;
        case "logs":
            await showLogs(args);
            break;
        case "login":
            await runLogin();
            break;
        case "setup":
            await runSetup();
            break;
        case "help":
        case "--help":
        case "-h":
            showHelp();
            break;
        default:
            if (!cmd) {
                showHelp();
            } else {
                console.error(`Unknown command: ${cmd}`);
                showHelp();
                process.exit(1);
            }
    }
}

function showHelp() {
    console.log(`
igobot - AI Agent for You

Usage:
  igobot <command> [options]

Commands:
  setup     Run interactive setup wizard (first-time or reconfiguration)
  start     Start igobot in background
  stop      Stop running igobot
  restart   Restart igobot
  status    Check igobot status
  logs      View logs (default: last 50 lines)
            --follow, -f: Follow log output
  login     Codex OAuth login (unofficial)
  help      Show this help

Examples:
  igobot setup      # Configure igobot (run this first!)
  igobot start      # Start in background
  igobot status     # Check status
  igobot logs -f    # Follow logs in real-time
  igobot stop       # Stop the bot
`);
}

async function startBot() {
    const { spawn } = await import("child_process");
    const { mkdirSync, writeFileSync, existsSync, readFileSync } = await import("fs");

    if (existsSync(PID_FILE)) {
        const pid = parseInt(readFileSync(PID_FILE, "utf-8").trim(), 10);
        if (isProcessRunning(pid)) {
            console.log(`igobot이 실행 중입니다 (PID: ${pid}). 재시작합니다...`);
            await stopBot();
        }
    }

    const logsDir = dirname(LOG_FILE);
    if (!existsSync(logsDir)) {
        mkdirSync(logsDir, { recursive: true });
    }

    const dataDir = dirname(PID_FILE);
    if (!existsSync(dataDir)) {
        mkdirSync(dataDir, { recursive: true });
    }

    const mainPath = join(__dirname, "..", "index.js");
    const { openSync, closeSync } = await import("fs");
    const out = openSync(LOG_FILE, "a");
    const err = openSync(LOG_FILE, "a");

    const child = spawn(process.execPath, [mainPath], {
        detached: true,
        stdio: ["ignore", out, err],
        cwd: join(__dirname, ".."),
    });

    child.unref();
    // 부모 프로세스의 fd 복사본을 닫아 이벤트 루프 참조 해제
    closeSync(out);
    closeSync(err);

    writeFileSync(PID_FILE, child.pid.toString());

    console.log(`igobot started (PID: ${child.pid})`);
    console.log(`Log file: ${LOG_FILE}`);
    // @clack/prompts 등이 TTY를 raw mode로 바꿨을 경우 복원
    if (process.stdin.isTTY) {
        try { process.stdin.setRawMode(false); } catch {}
    }
    process.stdin.pause();
    process.exit(0);
}

async function stopBot() {
    const { existsSync, readFileSync, unlinkSync } = await import("fs");

    if (!existsSync(PID_FILE)) {
        console.log("igobot is not running.");
        return;
    }

    const pid = parseInt(readFileSync(PID_FILE, "utf-8").trim(), 10);

    if (!isProcessRunning(pid)) {
        console.log("igobot is already stopped.");
        unlinkSync(PID_FILE);
        return;
    }

    try {
        process.kill(pid, "SIGTERM");

        let attempts = 0;
        while (isProcessRunning(pid) && attempts < 10) {
            await new Promise((r) => setTimeout(r, 500));
            attempts++;
        }

        if (isProcessRunning(pid)) {
            process.kill(pid, "SIGKILL");
            console.log(`igobot force killed (PID: ${pid})`);
        } else {
            console.log(`igobot stopped (PID: ${pid})`);
        }

        unlinkSync(PID_FILE);
    } catch (err) {
        if (err.code === "ESRCH") {
            console.log("igobot is already stopped.");
            unlinkSync(PID_FILE);
        } else {
            throw err;
        }
    }
}

async function showStatus() {
    const { existsSync, readFileSync, statSync } = await import("fs");

    console.log("igobot Status\n");

    if (!existsSync(PID_FILE)) {
        console.log("Status: Stopped");
        console.log("No PID file found.");
        return;
    }

    const pid = parseInt(readFileSync(PID_FILE, "utf-8").trim(), 10);
    const pidStat = statSync(PID_FILE);

    if (isProcessRunning(pid)) {
        console.log("Status: Running");
        console.log(`PID: ${pid}`);
        console.log(`Started: ${pidStat.birthtime.toLocaleString()}`);
        console.log(`Log file: ${LOG_FILE}`);
    } else {
        console.log("Status: Stopped (stale PID file)");
        console.log(`Previous PID: ${pid}`);
    }
}

async function showLogs(args) {
    const { spawn } = await import("child_process");
    const { existsSync } = await import("fs");

    if (!existsSync(LOG_FILE)) {
        console.log("No log file found. Start igobot first.");
        return;
    }

    const follow = args.includes("-f") || args.includes("--follow");

    if (follow) {
        const tail = spawn("tail", ["-f", LOG_FILE], {
            stdio: "inherit",
        });
        tail.on("error", (err) => {
            console.error("Log streaming error:", err.message);
        });
    } else {
        const tail = spawn("tail", ["-50", LOG_FILE], {
            stdio: "inherit",
        });
        tail.on("error", (err) => {
            console.error("Log output error:", err.message);
        });
    }
}

async function runLogin() {
    const { spawn } = await import("child_process");
    const loginPath = join(__dirname, "..", "src", "llm", "codex-auth.js");

    const child = spawn(process.execPath, [loginPath], {
        stdio: "inherit",
        cwd: join(__dirname, ".."),
    });

    child.on("exit", (code) => {
        process.exit(code || 0);
    });
}

async function runSetup() {
    const { runOnboarding } = await import("../src/onboarding/index.js");
    await runOnboarding();
    const { spawnSync } = await import("child_process");
    spawnSync(process.execPath, [__filename, "start"], { stdio: "inherit" });
    process.exit(0);
}

async function checkFirstRun() {
    const { needsOnboarding, runOnboarding } = await import("../src/onboarding/index.js");
    if (needsOnboarding()) {
        // .env 로드 후 설정된 언어로 메시지 출력
        await import("dotenv/config");
        const { getT } = await import("../src/i18n.js");
        console.log(getT()("cli.first_run"));
        await runOnboarding({ isFirstRun: true });
    }
}

function isProcessRunning(pid) {
    try {
        process.kill(pid, 0);
        return true;
    } catch (err) {
        return false;
    }
}

runCommand(command, args).catch((err) => {
    console.error("Error:", err.message);
    process.exit(1);
});
