export { parse } from './parser';
export { run, RuntimeError } from './interpreter';
export type { RunResult, RunOptions } from './interpreter';
export type { Step, VarSnapshot, CellSnapshot } from './types';

import { parse } from './parser';
import { run, RunResult, RunOptions } from './interpreter';

export function compileAndRun(source: string, options: RunOptions = {}): RunResult {
  try {
    const program = parse(source);
    return run(program, options);
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
