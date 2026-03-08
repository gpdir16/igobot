import { exec } from "node:child_process";

// 터미널 명령 실행 도구 (쓰기/실행 작업이므로 승인 필요)
export default {
    name: "run_terminal",
    description: "Executes a shell command in the terminal and returns stdout/stderr output.",
    requiresApproval: true,
    schema: {
        type: "object",
        properties: {
            command: {
                type: "string",
                description: "Shell command to execute",
            },
            cwd: {
                type: "string",
                description: "Working directory (optional, defaults to current directory)",
            },
            timeout: {
                type: "number",
                description: "Timeout in ms (optional, default: 30000)",
            },
        },
        required: ["command"],
    },

    // args.command/cwd/timeout을 받아 셸 명령 실행 결과 문자열 반환
    execute(args, context = {}) {
        const { command, cwd, timeout = 30000 } = args;

        return new Promise((resolve) => {
            exec(
                command,
                {
                    cwd: cwd || process.cwd(),
                    timeout,
                    maxBuffer: 1024 * 1024, // 1MB
                    shell: "/bin/zsh",
                },
                (error, stdout, stderr) => {
                    let result = "";
                    if (stdout) result += stdout;
                    if (stderr) result += `\n[stderr]\n${stderr}`;
                    if (error && error.killed) result += "\n[Killed by timeout]";
                    else if (error) result += `\n[Exit code: ${error.code}]`;

                    // 출력 길이 제한 (LLM 컨텍스트 보호)
                    if (result.length > 10000) {
                        result = result.slice(0, 5000) + "\n\n... [output truncated] ...\n\n" + result.slice(-3000);
                    }

                    resolve(result.trim() || "(no output)");
                },
            );
        });
    },
};
