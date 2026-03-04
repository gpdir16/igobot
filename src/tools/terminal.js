import { exec } from 'node:child_process';

/**
 * 터미널 명령 실행 도구
 * 쓰기/실행 작업이므로 승인 필요
 */
export default {
  name: 'run_terminal',
  description: '터미널에서 셸 명령을 실행합니다. 명령 결과(stdout/stderr)를 반환합니다.',
  requiresApproval: true,
  schema: {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: '실행할 셸 명령어'
      },
      cwd: {
        type: 'string',
        description: '작업 디렉토리 (선택, 기본값: 현재 디렉토리)'
      },
      timeout: {
        type: 'number',
        description: '타임아웃(ms) (선택, 기본값: 30000)'
      }
    },
    required: ['command']
  },

  /**
   * @param {object} args
   * @param {object} context
   * @returns {Promise<string>}
   */
  execute(args, context = {}) {
    const { command, cwd, timeout = 30000 } = args;

    return new Promise((resolve) => {
      exec(command, {
        cwd: cwd || process.cwd(),
        timeout,
        maxBuffer: 1024 * 1024, // 1MB
        shell: '/bin/zsh'
      }, (error, stdout, stderr) => {
        let result = '';
        if (stdout) result += stdout;
        if (stderr) result += `\n[stderr]\n${stderr}`;
        if (error && error.killed) result += '\n[타임아웃으로 종료됨]';
        else if (error) result += `\n[종료 코드: ${error.code}]`;

        // 출력 길이 제한 (LLM 컨텍스트 보호)
        if (result.length > 10000) {
          result = result.slice(0, 5000) + '\n\n... [출력 생략] ...\n\n' + result.slice(-3000);
        }

        resolve(result.trim() || '(출력 없음)');
      });
    });
  }
};
