import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';

const WORKSPACE_DIR = resolve(process.cwd(), 'data', 'workspace');
// 시작 시 workspace 디렉토리 보장
if (!existsSync(WORKSPACE_DIR)) mkdirSync(WORKSPACE_DIR, { recursive: true });

/**
 * 파일시스템 도구 모음
 * 읽기 작업은 자율, 쓰기 작업은 승인 필요
 */

/** 읽기 도구: 파일 내용 읽기 */
export const readFile = {
  name: 'read_file',
  description: '파일의 내용을 읽어 반환합니다. 경로와 선택적으로 줄 범위를 지정할 수 있습니다.',
  requiresApproval: false,
  schema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: '파일 경로' },
      startLine: { type: 'number', description: '시작 줄 번호 (1부터, 선택)' },
      endLine: { type: 'number', description: '끝 줄 번호 (포함, 선택)' }
    },
    required: ['path']
  },
  execute(args) {
    const { path: filePath, startLine, endLine } = args;
    const absPath = resolve(filePath);
    if (!existsSync(absPath)) return `파일을 찾을 수 없습니다: ${filePath}`;
    let content = readFileSync(absPath, 'utf-8');
    if (startLine || endLine) {
      const lines = content.split('\n');
      const start = (startLine || 1) - 1;
      const end = endLine || lines.length;
      content = lines.slice(start, end).join('\n');
    }
    if (content.length > 15000) {
      content = content.slice(0, 7000) + '\n\n... [내용 생략] ...\n\n' + content.slice(-5000);
    }
    return content;
  }
};

/** 읽기 도구: 디렉토리 내용 목록 */
export const listDir = {
  name: 'list_directory',
  description: '디렉토리의 파일과 폴더 목록을 반환합니다.',
  requiresApproval: false,
  schema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: '디렉토리 경로' },
      recursive: { type: 'boolean', description: '하위 디렉토리까지 포함 (선택, 기본값: false)' }
    },
    required: ['path']
  },
  execute(args) {
    const { path: dirPath, recursive = false } = args;
    const absPath = resolve(dirPath);
    if (!existsSync(absPath)) return `디렉토리를 찾을 수 없습니다: ${dirPath}`;

    const entries = [];
    function walk(dir, depth = 0) {
      if (depth > 5) return; // 깊이 제한
      const items = readdirSync(dir);
      for (const item of items) {
        if (item.startsWith('.') || item === 'node_modules') continue;
        const fullPath = join(dir, item);
        const stat = statSync(fullPath);
        const rel = relative(absPath, fullPath);
        entries.push(stat.isDirectory() ? `${rel}/` : rel);
        if (recursive && stat.isDirectory()) walk(fullPath, depth + 1);
      }
    }
    walk(absPath);
    return entries.join('\n') || '(빈 디렉토리)';
  }
};

/** 읽기 도구: 텍스트 검색 */
export const searchFiles = {
  name: 'search_files',
  description: '파일들에서 텍스트 패턴을 검색합니다.',
  requiresApproval: false,
  schema: {
    type: 'object',
    properties: {
      pattern: { type: 'string', description: '검색할 텍스트 또는 정규식' },
      path: { type: 'string', description: '검색 디렉토리 (선택, 기본값: 현재)' },
      filePattern: { type: 'string', description: '파일 확장자 필터 (예: .js, .py)' }
    },
    required: ['pattern']
  },
  execute(args) {
    const { pattern, path: searchPath = '.', filePattern } = args;
    const absPath = resolve(searchPath);
    const results = [];
    const regex = new RegExp(pattern, 'gi');

    function walk(dir, depth = 0) {
      if (depth > 8 || results.length > 50) return;
      try {
        const items = readdirSync(dir);
        for (const item of items) {
          if (item.startsWith('.') || item === 'node_modules') continue;
          const fullPath = join(dir, item);
          const stat = statSync(fullPath);
          if (stat.isDirectory()) {
            walk(fullPath, depth + 1);
          } else if (!filePattern || item.endsWith(filePattern)) {
            try {
              const content = readFileSync(fullPath, 'utf-8');
              const lines = content.split('\n');
              for (let i = 0; i < lines.length; i++) {
                if (regex.test(lines[i])) {
                  results.push(`${relative(absPath, fullPath)}:${i + 1}: ${lines[i].trim()}`);
                  regex.lastIndex = 0;
                }
              }
            } catch { /* 바이너리 파일 등 무시 */ }
          }
        }
      } catch { /* 권한 오류 무시 */ }
    }
    walk(absPath);
    return results.join('\n') || '검색 결과 없음';
  }
};

/** 쓰기 도구: 파일 생성/덮어쓰기 (data/workspace/ 한정) */
export const writeFile = {
  name: 'write_file',
  description: '파일을 생성하거나 내용을 덮어씁니다. data/workspace/ 내의 경로만 허용됩니다. 상대 경로 사용 시 data/workspace/ 기준으로 해석됩니다.',
  requiresApproval: true,
  schema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: '파일 경로 (예: report.txt 또는 subdir/file.py)' },
      content: { type: 'string', description: '파일 내용' }
    },
    required: ['path', 'content']
  },
  execute(args) {
    const { path: filePath, content } = args;
    const absPath = filePath.startsWith('/') ? resolve(filePath) : resolve(WORKSPACE_DIR, filePath);
    if (!absPath.startsWith(WORKSPACE_DIR + '/') && absPath !== WORKSPACE_DIR) {
      return `오류: 쓰기 작업은 data/workspace/ 내에서만 가능합니다. (요청 경로: ${filePath})`;
    }
    const dir = resolve(absPath, '..');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(absPath, content, 'utf-8');
    return `파일 작성 완료: ${absPath}`;
  }
};

/** 쓰기 도구: 파일 삭제 (data/workspace/ 한정) */
export const deleteFile = {
  name: 'delete_file',
  description: '파일을 삭제합니다. data/workspace/ 내의 파일만 삭제 가능합니다.',
  requiresApproval: true,
  schema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: '삭제할 파일 경로' }
    },
    required: ['path']
  },
  execute(args) {
    const absPath = args.path.startsWith('/') ? resolve(args.path) : resolve(WORKSPACE_DIR, args.path);
    if (!absPath.startsWith(WORKSPACE_DIR + '/') && absPath !== WORKSPACE_DIR) {
      return `오류: 삭제 작업은 data/workspace/ 내에서만 가능합니다. (요청 경로: ${args.path})`;
    }
    if (!existsSync(absPath)) return `파일이 존재하지 않습니다: ${args.path}`;
    unlinkSync(absPath);
    return `파일 삭제 완료: ${absPath}`;
  }
};

/** 파일시스템 도구를 개별 모듈로 export하지 않고, 배열로 묶어 export */
export default [readFile, listDir, searchFiles, writeFile, deleteFile];
