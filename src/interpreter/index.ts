export { run, RuntimeError } from './interpreter';
export type { RunResult, RunOptions } from './interpreter';
export type { Step, VarSnapshot, CellSnapshot } from './types';

import { run, RunResult, RunOptions } from './interpreter';
import type { Language } from '../languages/types';

export function compileAndRun(source: string, language: Language, options: RunOptions = {}): RunResult {
  try {
    const program = language.parse(source);
    return run(program, options);
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    // Tenta extrair número de linha da mensagem de erro do parser.
    const lineMatch = msg.match(/linha\s+(\d+)/);
    const errorLine = lineMatch ? parseInt(lineMatch[1], 10) : 1;
    return {
      steps: [{
        index: 0, line: errorLine, description: `Erro de compilação: ${msg}`,
        scope: [], output: '', status: 'error', error: msg,
      }],
      output: '',
      ok: false,
      error: msg,
    };
  }
}
