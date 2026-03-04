import { readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import logger from '../utils/logger.js';

/**
 * 동적 모듈 로더
 * tools/ 디렉토리의 모듈을 자동으로 탐색하고 로드한다.
 * 각 모듈은 { name, description, schema, execute } 형태를 export해야 한다.
 */
class ModuleLoader {
  constructor() {
    /** @type {Map<string, object>} */
    this.tools = new Map();
  }

  /**
   * 기본 tools 디렉토리에서 모든 도구 모듈을 로드
   */
  async loadTools(toolsDir) {
    const dir = toolsDir || resolve(process.cwd(), 'src', 'tools');
    const files = readdirSync(dir).filter(f => f.endsWith('.js') && f !== 'index.js');

    for (const file of files) {
      try {
        const modulePath = join(dir, file);
        const mod = await import(`file://${modulePath}`);
        const exported = mod.default;

        // 배열인 경우 (여러 도구를 하나의 파일에서 export)
        const toolList = Array.isArray(exported) ? exported : [exported];

        for (const tool of toolList) {
          if (!tool?.name || !tool?.execute) {
            logger.warn(`도구 모듈 ${file}에 유효하지 않은 도구가 있습니다. 건너뜁니다.`);
            continue;
          }
          this.tools.set(tool.name, tool);
          logger.info(`도구 로드 완료: ${tool.name} (${file})`);
        }
      } catch (err) {
        logger.error(`도구 로드 실패: ${file}`, err);
      }
    }
  }

  /**
   * 도구 이름으로 도구 가져오기
   */
  getTool(name) {
    return this.tools.get(name) || null;
  }

  /**
   * LLM에 전달할 도구 스키마 목록 생성
   */
  getToolSchemas() {
    return Array.from(this.tools.values()).map(tool => ({
      type: 'function',
      name: tool.name,
      description: tool.description,
      parameters: tool.schema || {}
    }));
  }

  /**
   * 도구 실행
   */
  async executeTool(name, args, context = {}) {
    const tool = this.getTool(name);
    if (!tool) throw new Error(`알 수 없는 도구: ${name}`);
    return tool.execute(args, context);
  }
}

export default ModuleLoader;
