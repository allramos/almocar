export { parse } from './parser';
export { run, RuntimeError } from './interpreter';
export type { RunResult } from './interpreter';
export type { Step, VarSnapshot, CellSnapshot } from './types';

import { parse } from './parser';
import { run, RunResult } from './interpreter';

export function compileAndRun(source: string): RunResult {
  try {
    const program = parse(source);
    return run(program);
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    return {
      steps: [{
        index: 0, line: 1, description: `Erro de compilação: ${msg}`,
        scope: [], output: '', status: 'error', error: msg,
      }],
      output: '',
      ok: false,
      error: msg,
    };
  }
}
