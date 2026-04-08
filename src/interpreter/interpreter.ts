// Interpretador (tree-walking) que executa o AST e grava uma sequência de "passos"
// para que a UI possa reproduzir a execução passo a passo.

import {
  Program, FunctionDecl, Stmt, Expr, BlockStmt, VarDecl, Initializer, Param,
} from './ast';
import {
  CType, tInt, tFloat, tChar, tPtr, typeName, sizeOf,
  Step, VarSnapshot, CellSnapshot,
} from './types';
import { Memory, logicalSize, offsetOf, arrayDims, arrayElementBase } from './memory';

// ----- L-values -----
// Um l-value referencia uma posição de memória que pode ser lida ou escrita.
interface LValue {
  address: number;
  type: CType;
}

// ----- Erros / sinais de fluxo -----
class BreakSignal { }
class ContinueSignal { }
class ReturnSignal { constructor(public value: number) {} }
export class RuntimeError extends Error {
  constructor(message: string, public line: number) { super(message); }
}
export class InputNeededSignal extends Error {
  constructor(public prompt: string, public conv: string, public line: number) { super('Input needed'); }
}

// ----- Escopo -----
interface Binding { type: CType; address: number; }
class Scope {
  vars = new Map<string, Binding>();
  constructor(public parent?: Scope) {}
  define(name: string, b: Binding) { this.vars.set(name, b); }
  lookup(name: string): Binding | undefined {
    return this.vars.get(name) ?? this.parent?.lookup(name);
  }
  // Coleta todas as variáveis visíveis (mais internas sobrescrevem as externas).
  collect(): Map<string, Binding> {
    const m = this.parent ? this.parent.collect() : new Map<string, Binding>();
    for (const [k, v] of this.vars) m.set(k, v);
    return m;
  }
}

// ----- Resultado da execução -----
export interface RunResult {
  steps: Step[];
  output: string;
  ok: boolean;
  error?: string;
  needsInput?: boolean;
  inputPrompt?: string;
  inputConv?: string;
  finalStorage?: Record<string, string>;
}

// ----- Configuração -----
const MAX_STEPS = 5000;

// Opções de execução. `inputs` pré-alimenta a fila de entrada usada por scanf.
// Quando a fila está vazia e ainda há leituras, recorremos a `requestMoreInput`
// (por padrão, window.prompt) para solicitar mais valores.
export interface RunOptions {
  inputs?: string;
  requestMoreInput?: (message: string) => string | null;
  initialStorage?: Record<string, string>;
}

export function run(program: Program, options: RunOptions = {}): RunResult {
  const interp = new Interpreter(program, options);
  return interp.run();
}

class Interpreter {
  memory = new Memory();
  globalScope = new Scope();
  output = '';
  steps: Step[] = [];
  functions = new Map<string, FunctionDecl>();
  // Lista de focos acumulados desde o último step (reads e writes).
  pendingFoci: NonNullable<Step['focus']>[] = [];
  // Último escopo "vivo" (de uma função em execução), preservado para o passo final.
  lastLiveScope: Scope | undefined;
  // Escopo do chamador (para que a função enxergue as variáveis do chamador).
  callerScope: Scope | undefined;
  // Fila de tokens de entrada para scanf. Pré-alimentada por options.inputs.
  inputQueue: string[] = [];
  requestMoreInput: (message: string) => string | null;
  // localStorage simulado (JavaScript)
  simulatedStorage = new Map<string, string>();

  constructor(public program: Program, options: RunOptions = {}) {
    for (const f of program.functions) this.functions.set(f.name, f);
    if (options.inputs) {
      this.inputQueue = options.inputs.split(/\s+/).filter((s) => s.length > 0);
    }
    if (options.initialStorage) {
      for (const [k, v] of Object.entries(options.initialStorage)) {
        this.simulatedStorage.set(k, v);
      }
    }
    this.requestMoreInput =
      options.requestMoreInput ??
      ((msg) => (typeof window !== 'undefined' ? window.prompt(msg) : null));
  }

  run(): RunResult {
    const main = this.functions.get('main');
    if (!main) {
      return { steps: [], output: '', ok: false, error: 'Função main() não encontrada' };
    }
    try {
      this.recordStep(main.line, 'Início de main()', this.globalScope);
      this.execFunction(main, []);
      // Reaproveita o último escopo "vivo" para que as variáveis finais permaneçam visíveis.
      const finalScope = this.lastLiveScope ?? this.globalScope;
      this.recordStep(main.line, 'Execução concluída', finalScope, 'success');
      return { steps: this.steps, output: this.output, ok: true, finalStorage: Object.fromEntries(this.simulatedStorage) };
    } catch (e: any) {
      if (e instanceof InputNeededSignal) {
        const scope = this.lastLiveScope ?? this.globalScope;
        this.recordStep(e.line, 'Aguardando entrada do usuário…', scope);
        return {
          steps: this.steps, output: this.output, ok: true,
          needsInput: true, inputPrompt: e.prompt, inputConv: e.conv,
          finalStorage: Object.fromEntries(this.simulatedStorage),
        };
      }
      const msg = e instanceof RuntimeError ? e.message : (e?.message ?? String(e));
      const line = e instanceof RuntimeError ? e.line : (this.steps[this.steps.length - 1]?.line ?? 1);
      this.recordStep(line, `Erro: ${msg}`, this.globalScope, 'error', msg);
      return { steps: this.steps, output: this.output, ok: false, error: msg, finalStorage: Object.fromEntries(this.simulatedStorage) };
    }
  }

  // ===== Execução de função =====
  execFunction(fn: FunctionDecl, args: number[], argBindings?: (Binding | undefined)[]): number {
    const scope = new Scope(this.callerScope ?? this.globalScope);
    fn.params.forEach((p, i) => {
      const binding = argBindings?.[i];
      if (binding && binding.type.kind === 'array') {
        // Pass-by-reference: parâmetro aponta direto para o array do chamador
        scope.define(p.name, { type: binding.type, address: binding.address });
      } else {
        const addr = this.memory.allocLogical(1);
        this.memory.write(addr, args[i] ?? 0);
        scope.define(p.name, { type: p.type, address: addr });
      }
    });
    this.lastLiveScope = scope;
    try {
      this.execBlock(fn.body, scope);
    } catch (e) {
      if (e instanceof ReturnSignal) return e.value;
      throw e;
    }
    return 0;
  }

  // ===== Statements =====
  execBlock(block: BlockStmt, parent: Scope) {
    const scope = new Scope(parent);
    for (const s of block.stmts) this.execStmt(s, scope);
  }

  execStmt(stmt: Stmt, scope: Scope) {
    if (this.steps.length > MAX_STEPS) {
      throw new RuntimeError(`Limite de passos atingido (${MAX_STEPS}). Possível laço infinito.`, stmt.line);
    }
    switch (stmt.kind) {
      case 'BlockStmt': this.execBlock(stmt, scope); return;
      case 'DeclStmt': {
        for (const d of stmt.decls) this.execDecl(d, scope);
        return;
      }
      case 'ExprStmt': {
        this.evalExpr(stmt.expr, scope);
        this.recordStep(stmt.line, this.describeExprStmt(stmt.expr, scope), scope);
        return;
      }
      case 'IfStmt': {
        const c = this.evalExpr(stmt.cond, scope);
        this.recordStep(stmt.line, `Avaliando condição do if → ${c !== 0 ? 'verdadeiro' : 'falso'}`, scope);
        if (c !== 0) this.execStmt(stmt.then, scope);
        else if (stmt.else) this.execStmt(stmt.else, scope);
        return;
      }
      case 'WhileStmt': {
        while (true) {
          const c = this.evalExpr(stmt.cond, scope);
          this.recordStep(stmt.line, `Condição do while → ${c !== 0 ? 'verdadeiro' : 'falso'}`, scope);
          if (c === 0) break;
          try { this.execStmt(stmt.body, scope); }
          catch (e) {
            if (e instanceof BreakSignal) break;
            if (e instanceof ContinueSignal) continue;
            throw e;
          }
        }
        return;
      }
      case 'DoWhileStmt': {
        do {
          try { this.execStmt(stmt.body, scope); }
          catch (e) {
            if (e instanceof BreakSignal) break;
            if (e instanceof ContinueSignal) { /* avalia condição */ }
            else throw e;
          }
          const c = this.evalExpr(stmt.cond, scope);
          this.recordStep(stmt.line, `Condição do do/while → ${c !== 0 ? 'verdadeiro' : 'falso'}`, scope);
          if (c === 0) break;
        } while (true);
        return;
      }
      case 'ForStmt': {
        const forScope = new Scope(scope);
        if (stmt.init) {
          if ((stmt.init as Stmt).kind === 'DeclStmt') this.execStmt(stmt.init as Stmt, forScope);
          else this.evalExpr(stmt.init as Expr, forScope);
        }
        while (true) {
          let c = 1;
          if (stmt.cond) {
            c = this.evalExpr(stmt.cond, forScope);
            this.recordStep(stmt.line, `Condição do for → ${c !== 0 ? 'verdadeiro' : 'falso'}`, forScope);
          }
          if (c === 0) break;
          try { this.execStmt(stmt.body, forScope); }
          catch (e) {
            if (e instanceof BreakSignal) break;
            if (e instanceof ContinueSignal) { /* segue para o step */ }
            else throw e;
          }
          if (stmt.step) {
            this.evalExpr(stmt.step, forScope);
            this.recordStep(stmt.line, `Atualização do for executada`, forScope);
          }
        }
        return;
      }
      case 'ReturnStmt': {
        const v = stmt.value ? this.evalExpr(stmt.value, scope) : 0;
        this.recordStep(stmt.line, `return ${v}`, scope);
        throw new ReturnSignal(v);
      }
      case 'BreakStmt':
        this.recordStep(stmt.line, 'break — saindo do laço', scope);
        throw new BreakSignal();
      case 'ContinueStmt':
        this.recordStep(stmt.line, 'continue — próxima iteração', scope);
        throw new ContinueSignal();
    }
  }

  // ===== Declarações =====
  execDecl(decl: VarDecl, scope: Scope) {
    const size = logicalSize(decl.type);
    const addr = this.memory.allocLogical(size);
    scope.define(decl.name, { type: decl.type, address: addr });
    if (decl.init) {
      this.execInitializer(decl.init, decl.type, addr, scope);
    }
    this.recordStep(
      decl.line,
      decl.init
        ? `Declarada variável ${typeName(decl.type)} ${decl.name} já inicializada`
        : `Declarada variável ${typeName(decl.type)} ${decl.name}`,
      scope,
      'running', undefined,
      { varName: decl.name, kind: 'write' }
    );
  }

  execInitializer(init: Initializer, type: CType, addr: number, scope: Scope) {
    if (init.kind === 'Single') {
      const v = this.evalExpr(init.expr, scope);
      this.memory.write(addr, v);
      return;
    }
    // Lista — só faz sentido para arrays
    if (type.kind !== 'array') {
      throw new RuntimeError(`Inicializador em chaves para tipo não-array`, init.line);
    }
    const stride = logicalSize(type.of);
    for (let i = 0; i < init.items.length && i < type.size; i++) {
      this.execInitializer(init.items[i], type.of, addr + i * stride, scope);
    }
  }

  // ===== Expressões =====
  evalExpr(expr: Expr, scope: Scope): number {
    switch (expr.kind) {
      case 'IntLit': case 'FloatLit': case 'CharLit':
        return expr.value;
      case 'StringLit': {
        // Aloca a string na memória e retorna o endereço (apenas para uso por printf).
        const addr = this.memory.allocLogical(expr.value.length + 1);
        for (let i = 0; i < expr.value.length; i++) this.memory.write(addr + i, expr.value.charCodeAt(i));
        this.memory.write(addr + expr.value.length, 0);
        // Codifica como número negativo para distinguir de int normal? Não — vamos usar registry.
        this.stringTable.set(addr, expr.value);
        return addr;
      }
      case 'Ident': {
        const lv = this.evalLValue(expr, scope);
        // Arrays "decaem" para ponteiro (endereço base) quando usados como rvalue
        if (lv.type.kind === 'array') return lv.address;
        this.pushFocus({ varName: expr.name, kind: 'read' });
        return this.memory.read(lv.address);
      }
      case 'BinaryOp': {
        const l = this.evalExpr(expr.left, scope);
        // Curto-circuito
        if (expr.op === '&&') return l !== 0 && this.evalExpr(expr.right, scope) !== 0 ? 1 : 0;
        if (expr.op === '||') return l !== 0 || this.evalExpr(expr.right, scope) !== 0 ? 1 : 0;
        const r = this.evalExpr(expr.right, scope);
        switch (expr.op) {
          case '+': return l + r;
          case '-': return l - r;
          case '*': return l * r;
          case '/': if (r === 0) throw new RuntimeError('Divisão por zero', expr.line);
                    return Math.trunc(l / r);
          case '%': if (r === 0) throw new RuntimeError('Módulo por zero', expr.line);
                    return l % r;
          case '==': return l === r ? 1 : 0;
          case '!=': return l !== r ? 1 : 0;
          case '<':  return l <  r ? 1 : 0;
          case '>':  return l >  r ? 1 : 0;
          case '<=': return l <= r ? 1 : 0;
          case '>=': return l >= r ? 1 : 0;
          case '&':  return l & r;
          case '|':  return l | r;
          case '^':  return l ^ r;
          case '<<': return l << r;
          case '>>': return l >> r;
        }
        throw new RuntimeError(`Operador binário não suportado: ${expr.op}`, expr.line);
      }
      case 'UnaryOp': {
        const v = this.evalExpr(expr.operand, scope);
        switch (expr.op) {
          case '+': return +v;
          case '-': return -v;
          case '!': return v === 0 ? 1 : 0;
          case '~': return ~v;
        }
        throw new RuntimeError(`Unário não suportado: ${expr.op}`, expr.line);
      }
      case 'Assign': {
        const lv = this.evalLValue(expr.target, scope);
        const v = this.evalExpr(expr.value, scope);
        this.memory.write(lv.address, v);
        const f = this.focusFor(expr.target, scope, 'write');
        if (f) this.pushFocus(f);
        return v;
      }
      case 'CompoundAssign': {
        const lv = this.evalLValue(expr.target, scope);
        const cur = this.memory.read(lv.address);
        const r = this.evalExpr(expr.value, scope);
        const nv = this.applyBinop(expr.op, cur, r, expr.line);
        this.memory.write(lv.address, nv);
        const f = this.focusFor(expr.target, scope, 'write');
        if (f) this.pushFocus(f);
        return nv;
      }
      case 'Index': {
        const lv = this.evalLValue(expr, scope);
        if (lv.type.kind === 'array') return lv.address;
        const f = this.focusFor(expr, scope, 'read');
        if (f) this.pushFocus(f);
        return this.memory.read(lv.address);
      }
      case 'AddrOf': {
        const lv = this.evalLValue(expr.operand, scope);
        return lv.address;
      }
      case 'Deref': {
        const addr = this.evalExpr(expr.operand, scope);
        return this.memory.read(addr);
      }
      case 'Prefix': {
        const lv = this.evalLValue(expr.operand, scope);
        const cur = this.memory.read(lv.address);
        const nv = expr.op === '++' ? cur + 1 : cur - 1;
        this.memory.write(lv.address, nv);
        return nv;
      }
      case 'Postfix': {
        const lv = this.evalLValue(expr.operand, scope);
        const cur = this.memory.read(lv.address);
        const nv = expr.op === '++' ? cur + 1 : cur - 1;
        this.memory.write(lv.address, nv);
        return cur;
      }
      case 'Ternary': {
        return this.evalExpr(expr.cond, scope) !== 0
          ? this.evalExpr(expr.then, scope)
          : this.evalExpr(expr.else, scope);
      }
      case 'Call': return this.evalCall(expr.callee, expr.args, scope, expr.line);
      case 'Cast': return this.evalExpr(expr.operand, scope);
      case 'SizeofExpr': return 4;
      case 'SizeofType': return sizeOf(expr.type);
    }
    throw new RuntimeError(`Expressão não suportada: ${(expr as any).kind}`, (expr as any).line ?? 1);
  }

  applyBinop(op: string, l: number, r: number, line: number): number {
    switch (op) {
      case '+': return l + r;
      case '-': return l - r;
      case '*': return l * r;
      case '/': if (r === 0) throw new RuntimeError('Divisão por zero', line);
                return Math.trunc(l / r);
      case '%': if (r === 0) throw new RuntimeError('Módulo por zero', line);
                return l % r;
      case '&': return l & r;
      case '|': return l | r;
      case '^': return l ^ r;
      case '<<': return l << r;
      case '>>': return l >> r;
    }
    throw new RuntimeError(`Operador composto não suportado: ${op}=`, line);
  }

  evalLValue(expr: Expr, scope: Scope): LValue {
    if (expr.kind === 'Ident') {
      const b = scope.lookup(expr.name);
      if (!b) throw new RuntimeError(`Variável '${expr.name}' não declarada`, expr.line);
      return { address: b.address, type: b.type };
    }
    if (expr.kind === 'Index') {
      const baseLv = this.evalLValueOrPointer(expr.array, scope);
      const idx = this.evalExpr(expr.index, scope);
      let elemType: CType;
      let baseAddr: number;
      if (baseLv.type.kind === 'array') {
        elemType = baseLv.type.of;
        baseAddr = baseLv.address;
      } else if (baseLv.type.kind === 'pointer') {
        elemType = baseLv.type.to;
        baseAddr = this.memory.read(baseLv.address);
      } else {
        throw new RuntimeError(`Tipo ${typeName(baseLv.type)} não é indexável`, expr.line);
      }
      // checagem de limites em arrays estáticos
      if (baseLv.type.kind === 'array' && (idx < 0 || idx >= baseLv.type.size)) {
        throw new RuntimeError(`Índice ${idx} fora dos limites [0, ${baseLv.type.size - 1}]`, expr.line);
      }
      return { address: baseAddr + idx * logicalSize(elemType), type: elemType };
    }
    if (expr.kind === 'Deref') {
      const addr = this.evalExpr(expr.operand, scope);
      // tipo do alvo: se o operando for um identificador ponteiro, descobrimos.
      // Para o MVP, retornamos como int.
      return { address: addr, type: tInt };
    }
    throw new RuntimeError(`Expressão inválida como l-value`, (expr as any).line ?? 1);
  }

  // Como evalLValue, mas para o caso especial de array indexado: precisamos preservar
  // o tipo array em sub-expressões aninhadas (matriz[i][j]).
  evalLValueOrPointer(expr: Expr, scope: Scope): LValue {
    if (expr.kind === 'Ident') {
      const b = scope.lookup(expr.name);
      if (!b) throw new RuntimeError(`Variável '${expr.name}' não declarada`, expr.line);
      return { address: b.address, type: b.type };
    }
    if (expr.kind === 'Index') {
      return this.evalLValue(expr, scope);
    }
    return this.evalLValue(expr, scope);
  }

  // ===== Funções (built-ins) =====
  stringTable = new Map<number, string>();

  evalCall(name: string, args: Expr[], scope: Scope, line: number): number {
    // ===== Built-ins C =====
    if (name === 'printf') return this.execPrintf(args, scope, line);
    if (name === 'scanf') return this.execScanf(args, scope, line);
    if (name === 'putchar') {
      const v = this.evalExpr(args[0], scope);
      this.output += String.fromCharCode(v);
      return v;
    }
    if (name === 'puts') {
      const addr = this.evalExpr(args[0], scope);
      const s = this.stringTable.get(addr) ?? '';
      this.output += s + '\n';
      return s.length + 1;
    }
    // ===== Built-ins Portugol =====
    if (name === 'escreva' || name === 'escreval') return this.execEscreva(args, scope, line, name === 'escreval');
    if (name === 'leia') return this.execLeia(args, scope, line);
    // ===== Built-ins Java =====
    if (name === 'System.out.println' || name === 'System.out.print')
      return this.execSystemOut(args, scope, line, name === 'System.out.println');
    if (name === 'scanner.nextInt') return this.execScannerNext(line, 'd');
    if (name === 'scanner.nextFloat' || name === 'scanner.nextDouble')
      return this.execScannerNext(line, 'f');
    if (name === 'scanner.close') return 0;
    // ===== Built-ins JavaScript =====
    if (name === 'console.log') return this.execConsoleLog(args, scope, line);
    if (name === 'prompt') return this.execPrompt(args, scope, line);
    if (name === 'parseInt') return this.execParseInt(args, scope, line);
    if (name === 'parseFloat') return this.execParseFloat(args, scope, line);
    if (name === 'localStorage.setItem') return this.execStorageSetItem(args, scope, line);
    if (name === 'localStorage.getItem') return this.execStorageGetItem(args, scope, line);
    if (name === 'localStorage.removeItem') return this.execStorageRemoveItem(args, scope, line);
    if (name === 'localStorage.clear') return this.execStorageClear(line);
    if (name === 'Math.floor') {
      const v = this.evalExpr(args[0], scope);
      return Math.floor(v);
    }
    if (name === 'Math.ceil') {
      const v = this.evalExpr(args[0], scope);
      return Math.ceil(v);
    }
    if (name === 'Math.round') {
      const v = this.evalExpr(args[0], scope);
      return Math.round(v);
    }
    if (name === 'Math.abs') {
      const v = this.evalExpr(args[0], scope);
      return Math.abs(v);
    }
    if (name === 'Math.max') {
      const vals = args.map(a => this.evalExpr(a, scope));
      return Math.max(...vals);
    }
    if (name === 'Math.min') {
      const vals = args.map(a => this.evalExpr(a, scope));
      return Math.min(...vals);
    }
    if (name === 'Math.sqrt') {
      const v = this.evalExpr(args[0], scope);
      return Math.sqrt(v);
    }
    if (name === 'Math.pow') {
      const base = this.evalExpr(args[0], scope);
      const exp = this.evalExpr(args[1], scope);
      return Math.pow(base, exp);
    }
    // ===== Funções do usuário =====
    const fn = this.functions.get(name);
    if (!fn) throw new RuntimeError(`Função '${name}' não definida`, line);
    const argVals: number[] = [];
    const argBindings: (Binding | undefined)[] = [];
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (a.kind === 'Ident') {
        const b = scope.lookup(a.name);
        if (b && b.type.kind === 'array') {
          argVals.push(b.address);
          argBindings.push(b);
          continue;
        }
      }
      argVals.push(this.evalExpr(a, scope));
      argBindings.push(undefined);
    }
    const prevCaller = this.callerScope;
    this.callerScope = scope;
    const result = this.execFunction(fn, argVals, argBindings);
    this.callerScope = prevCaller;
    return result;
  }

  execPrintf(args: Expr[], scope: Scope, line: number): number {
    if (args.length === 0) return 0;
    const fmtAddr = this.evalExpr(args[0], scope);
    const fmt = this.stringTable.get(fmtAddr);
    if (fmt === undefined) throw new RuntimeError(`printf: formato inválido`, line);
    let out = '';
    let argi = 1;
    for (let i = 0; i < fmt.length; i++) {
      const c = fmt[i];
      if (c !== '%') { out += c; continue; }
      i++;
      // ignora flags/width simples
      let spec = '';
      while (i < fmt.length && /[0-9.\-+# ]/.test(fmt[i])) { spec += fmt[i]; i++; }
      const conv = fmt[i];
      const v = argi < args.length ? this.evalExpr(args[argi++], scope) : 0;
      switch (conv) {
        case 'd': case 'i': out += String(Math.trunc(v)); break;
        case 'u': out += String(v >>> 0); break;
        case 'f': out += Number(v).toFixed(parseSpecPrecision(spec, 6)); break;
        case 'c': out += String.fromCharCode(v); break;
        case 's': out += this.stringTable.get(v) ?? ''; break;
        case 'x': out += (v >>> 0).toString(16); break;
        case 'X': out += (v >>> 0).toString(16).toUpperCase(); break;
        case '%': out += '%'; break;
        default: out += '%' + spec + (conv ?? '');
      }
    }
    this.output += out;
    return out.length;
  }

  // Lê o próximo token da fila de entrada. Se a fila estiver vazia, solicita
  // mais valores ao usuário (window.prompt por padrão) e re-tokeniza.
  nextInputToken(promptMsg: string, line: number, conv: string = '?'): string {
    while (this.inputQueue.length === 0) {
      const raw = this.requestMoreInput(promptMsg);
      if (raw === null) {
        throw new InputNeededSignal(promptMsg, conv, line);
      }
      const tokens = raw.split(/\s+/).filter((s) => s.length > 0);
      if (tokens.length === 0) continue;
      this.inputQueue.push(...tokens);
    }
    return this.inputQueue.shift()!;
  }

  execScanf(args: Expr[], scope: Scope, line: number): number {
    if (args.length === 0) return 0;
    const fmtAddr = this.evalExpr(args[0], scope);
    const fmt = this.stringTable.get(fmtAddr);
    if (fmt === undefined) throw new RuntimeError(`scanf: formato inválido`, line);
    let argi = 1;
    let read = 0;
    let echo = '';
    for (let i = 0; i < fmt.length; i++) {
      const c = fmt[i];
      if (c !== '%') continue;
      i++;
      // ignora largura/modificadores: dígitos, '.', 'l', 'h'
      while (i < fmt.length && /[0-9.lhL]/.test(fmt[i])) i++;
      const conv = fmt[i];
      if (conv === '%') continue;
      if (argi >= args.length) {
        throw new RuntimeError(`scanf: faltam argumentos para o formato`, line);
      }
      const destAddr = this.evalExpr(args[argi++], scope);
      const promptMsg = `Entrada para scanf("${fmt.replace(/\n/g, '\\n')}") — valor #${read + 1} (%${conv})`;
      if (conv === 's') {
        const tok = this.nextInputToken(promptMsg, line, conv);
        for (let k = 0; k < tok.length; k++) {
          this.memory.write(destAddr + k, tok.charCodeAt(k));
        }
        this.memory.write(destAddr + tok.length, 0);
        echo += (echo ? ' ' : '') + tok;
        read++;
        continue;
      }
      const tok = this.nextInputToken(promptMsg, line, conv);
      let value: number;
      switch (conv) {
        case 'd': case 'i': {
          const n = parseInt(tok, 10);
          if (Number.isNaN(n)) throw new RuntimeError(`scanf: valor inteiro inválido '${tok}'`, line);
          value = n;
          break;
        }
        case 'u': {
          const n = parseInt(tok, 10);
          if (Number.isNaN(n)) throw new RuntimeError(`scanf: valor inteiro inválido '${tok}'`, line);
          value = n >>> 0;
          break;
        }
        case 'f': case 'e': case 'g': {
          const n = parseFloat(tok);
          if (Number.isNaN(n)) throw new RuntimeError(`scanf: valor real inválido '${tok}'`, line);
          value = n;
          break;
        }
        case 'c': {
          value = tok.charCodeAt(0);
          break;
        }
        case 'x': case 'X': {
          const n = parseInt(tok, 16);
          if (Number.isNaN(n)) throw new RuntimeError(`scanf: valor hex inválido '${tok}'`, line);
          value = n;
          break;
        }
        default:
          throw new RuntimeError(`scanf: conversão '%${conv}' não suportada`, line);
      }
      this.memory.write(destAddr, value);
      echo += (echo ? ' ' : '') + tok;
      read++;
    }
    // Ecoa as entradas na saída para que o aluno veja os valores lidos no painel.
    if (echo.length > 0) this.output += echo + '\n';
    return read;
  }

  // ===== Built-ins Portugol =====

  /** escreva(arg1, arg2, ...) — imprime cada argumento concatenado. escreval adiciona \n. */
  execEscreva(args: Expr[], scope: Scope, line: number, newline: boolean): number {
    let out = '';
    for (const arg of args) {
      const v = this.evalExpr(arg, scope);
      // Se o valor é um endereço de string na tabela, imprime a string.
      if (this.stringTable.has(v) && arg.kind === 'StringLit') {
        out += this.stringTable.get(v)!;
      } else if (Number.isInteger(v)) {
        out += String(Math.trunc(v));
      } else {
        out += Number(v).toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
      }
    }
    if (newline) out += '\n';
    this.output += out;
    return out.length;
  }

  /** leia(var1, var2, ...) — lê valores do teclado para as variáveis. */
  execLeia(args: Expr[], scope: Scope, line: number): number {
    let read = 0;
    let echo = '';
    for (let i = 0; i < args.length; i++) {
      const lv = this.evalLValue(args[i], scope);
      const promptMsg = `Entrada para leia() — valor #${read + 1}`;
      // Detecta o tipo para conversão adequada.
      const isFloat = lv.type.kind === 'float';
      const conv = isFloat ? 'f' : 'd';
      const tok = this.nextInputToken(promptMsg, line, conv);
      let value: number;
      if (isFloat) {
        value = parseFloat(tok);
        if (Number.isNaN(value)) throw new RuntimeError(`leia: valor real inválido '${tok}'`, line);
      } else {
        value = parseInt(tok, 10);
        if (Number.isNaN(value)) throw new RuntimeError(`leia: valor inteiro inválido '${tok}'`, line);
      }
      this.memory.write(lv.address, value);
      echo += (echo ? ' ' : '') + tok;
      read++;
    }
    if (echo.length > 0) this.output += echo + '\n';
    return read;
  }

  // ===== Built-ins Java =====

  /** System.out.println / System.out.print — imprime args concatenados, println adiciona \n. */
  execSystemOut(args: Expr[], scope: Scope, line: number, newline: boolean): number {
    let out = '';
    for (const arg of args) {
      const v = this.evalExpr(arg, scope);
      if (this.stringTable.has(v) && arg.kind === 'StringLit') {
        out += this.stringTable.get(v)!;
      } else if (Number.isInteger(v)) {
        out += String(Math.trunc(v));
      } else {
        out += Number(v).toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
      }
    }
    if (newline) out += '\n';
    this.output += out;
    return out.length;
  }

  /** scanner.nextInt / scanner.nextFloat — lê valores do teclado. */
  execScannerNext(line: number, conv: string): number {
    const promptMsg = conv === 'd'
      ? 'Entrada para scanner.nextInt()'
      : 'Entrada para scanner.nextFloat()';
    const tok = this.nextInputToken(promptMsg, line, conv);
    let value: number;
    if (conv === 'f') {
      value = parseFloat(tok);
      if (Number.isNaN(value)) throw new RuntimeError(`scanner.nextFloat(): valor real inválido '${tok}'`, line);
    } else {
      value = parseInt(tok, 10);
      if (Number.isNaN(value)) throw new RuntimeError(`scanner.nextInt(): valor inteiro inválido '${tok}'`, line);
    }
    this.output += tok + '\n';
    return value;
  }

  // ===== Built-ins JavaScript =====

  /** console.log — imprime args separados por espaço + \n. */
  execConsoleLog(args: Expr[], scope: Scope, line: number): number {
    const parts: string[] = [];
    for (const arg of args) {
      const v = this.evalExpr(arg, scope);
      if (this.stringTable.has(v)) {
        parts.push(this.stringTable.get(v)!);
      } else if (Number.isInteger(v)) {
        parts.push(String(Math.trunc(v)));
      } else {
        parts.push(Number(v).toFixed(6).replace(/0+$/, '').replace(/\.$/, ''));
      }
    }
    const out = parts.join(' ') + '\n';
    this.output += out;
    return out.length;
  }

  /** prompt — lê entrada do usuário, retorna endereço de string na memória. */
  execPrompt(args: Expr[], scope: Scope, line: number): number {
    let promptMsg = 'Entrada para prompt()';
    if (args.length > 0) {
      const v = this.evalExpr(args[0], scope);
      if (this.stringTable.has(v)) {
        promptMsg = this.stringTable.get(v)!;
      }
    }
    const tok = this.nextInputToken(promptMsg, line, 's');
    this.output += tok + '\n';
    // Aloca a string na memória e retorna o endereço.
    const addr = this.memory.allocLogical(tok.length + 1);
    for (let i = 0; i < tok.length; i++) this.memory.write(addr + i, tok.charCodeAt(i));
    this.memory.write(addr + tok.length, 0);
    this.stringTable.set(addr, tok);
    return addr;
  }

  /** parseInt — converte string ou número para inteiro. */
  execParseInt(args: Expr[], scope: Scope, line: number): number {
    const v = this.evalExpr(args[0], scope);
    if (this.stringTable.has(v)) {
      const s = this.stringTable.get(v)!;
      const n = parseInt(s, 10);
      if (Number.isNaN(n)) throw new RuntimeError(`parseInt: valor inválido '${s}'`, line);
      return n;
    }
    return Math.trunc(v);
  }

  /** parseFloat — converte string ou número para float. */
  execParseFloat(args: Expr[], scope: Scope, line: number): number {
    const v = this.evalExpr(args[0], scope);
    if (this.stringTable.has(v)) {
      const s = this.stringTable.get(v)!;
      const n = parseFloat(s);
      if (Number.isNaN(n)) throw new RuntimeError(`parseFloat: valor inválido '${s}'`, line);
      return n;
    }
    return v;
  }

  // ===== localStorage simulado (JavaScript) =====
  private getStringArg(expr: Expr, scope: Scope): string {
    const v = this.evalExpr(expr, scope);
    const s = this.stringTable.get(v);
    if (s !== undefined) {
      // Limpa entradas temporárias de StringLit para não poluir console.log
      if (expr.kind === 'StringLit') this.stringTable.delete(v);
      return s;
    }
    return String(v);
  }

  execStorageSetItem(args: Expr[], scope: Scope, line: number): number {
    if (args.length < 2) throw new RuntimeError('localStorage.setItem requer 2 argumentos (chave, valor)', line);
    const key = this.getStringArg(args[0], scope);
    const value = this.getStringArg(args[1], scope);
    this.simulatedStorage.set(key, value);
    this.recordStep(line, `localStorage.setItem("${key}", "${value}")`, scope, 'running');
    return 0;
  }

  execStorageGetItem(args: Expr[], scope: Scope, line: number): number {
    if (args.length < 1) throw new RuntimeError('localStorage.getItem requer 1 argumento (chave)', line);
    const key = this.getStringArg(args[0], scope);
    const value = this.simulatedStorage.get(key);
    if (value === undefined) {
      this.recordStep(line, `localStorage.getItem("${key}") → null`, scope, 'running');
      return 0; // simula null como 0
    }
    // Armazena resultado como string na stringTable
    const addr = this.memory.allocLogical(value.length + 1);
    for (let i = 0; i < value.length; i++) this.memory.write(addr + i, value.charCodeAt(i));
    this.memory.write(addr + value.length, 0);
    this.stringTable.set(addr, value);
    this.recordStep(line, `localStorage.getItem("${key}") → "${value}"`, scope, 'running');
    return addr;
  }

  execStorageRemoveItem(args: Expr[], scope: Scope, line: number): number {
    if (args.length < 1) throw new RuntimeError('localStorage.removeItem requer 1 argumento (chave)', line);
    const key = this.getStringArg(args[0], scope);
    this.simulatedStorage.delete(key);
    this.recordStep(line, `localStorage.removeItem("${key}")`, scope, 'running');
    return 0;
  }

  execStorageClear(line: number): number {
    this.simulatedStorage.clear();
    this.recordStep(line, `localStorage.clear()`, this.globalScope, 'running');
    return 0;
  }

  // ===== Snapshot do escopo =====
  snapshotScope(scope: Scope): VarSnapshot[] {
    const result: VarSnapshot[] = [];
    const vars = scope.collect();
    for (const [name, b] of vars) {
      const snap = this.snapshotVar(name, b.type, b.address);
      // Aplica todos os focos pendentes para esta variável.
      for (const f of this.pendingFoci) {
        if (f.varName !== name) continue;
        if (snap.cells && f.cellIndex) {
          for (const c of snap.cells) {
            if (sameIndex(c.index, f.cellIndex)) {
              if (f.kind === 'write') c.written = true;
              else c.read = true;
              c.highlighted = true;
            }
          }
        } else if (snap.scalar) {
          if (f.kind === 'write') snap.written = true;
          else snap.read = true;
          snap.highlighted = true;
        }
      }
      result.push(snap);
    }
    return result;
  }

  pushFocus(f: NonNullable<Step['focus']>) {
    this.pendingFoci.push(f);
  }

  snapshotVar(name: string, type: CType, addr: number): VarSnapshot {
    if (type.kind === 'array') {
      const dims = arrayDims(type);
      const total = dims.reduce((a, b) => a * b, 1);
      const cells: CellSnapshot[] = [];
      for (let i = 0; i < total; i++) {
        const idx = unflatten(i, dims);
        cells.push({
          index: idx,
          flatIndex: i,
          address: addr + i,
          value: String(this.memory.read(addr + i)),
        });
      }
      return {
        name, type: typeName(type), address: addr,
        value: `array ${dims.join('×')}`, cells, shape: dims, scalar: false,
      };
    }
    if (type.kind === 'pointer') {
      const v = this.memory.read(addr);
      return { name, type: typeName(type), address: addr, value: `→ ${v}`, scalar: true };
    }
    const rawVal = this.memory.read(addr);
    const strVal = this.stringTable.get(rawVal);
    return {
      name, type: typeName(type), address: addr,
      value: strVal !== undefined ? `"${strVal}"` : String(rawVal), scalar: true,
    };
  }

  // ===== Steps =====
  recordStep(line: number, description: string, scope: Scope, status: 'running' | 'success' | 'error' = 'running', error?: string, focus?: Step['focus']) {
    if (focus) this.pushFocus(focus);
    // Foco "principal" do passo: o último escrito tem prioridade, senão o último lido.
    const writes = this.pendingFoci.filter(f => f.kind === 'write');
    const primary = writes[writes.length - 1] ?? this.pendingFoci[this.pendingFoci.length - 1];
    // Captura escopo "vivo" mais recente para reuso no passo de sucesso.
    if (status === 'running') this.lastLiveScope = scope;
    this.steps.push({
      index: this.steps.length,
      line,
      description,
      scope: this.snapshotScope(scope),
      output: this.output,
      status,
      error,
      focus: primary,
      storage: this.simulatedStorage.size > 0
        ? Object.fromEntries(this.simulatedStorage)
        : undefined,
    });
    this.pendingFoci = [];
  }

  // ===== Helpers =====
  describeExprStmt(expr: Expr, scope: Scope): string {
    if (expr.kind === 'Assign') {
      const t = this.describeTarget(expr.target);
      const cur = (() => { try { return this.evalExprNoSideEffect(expr.target, scope); } catch { return '?'; } })();
      return `Atribuição: ${t} = ${cur}`;
    }
    if (expr.kind === 'CompoundAssign') {
      const t = this.describeTarget(expr.target);
      return `${t} ${expr.op}= ...`;
    }
    if (expr.kind === 'Call') return `Chamada: ${expr.callee}(...)`;
    if (expr.kind === 'Postfix' || expr.kind === 'Prefix') {
      return `${this.describeTarget(expr.operand)}${expr.op}`;
    }
    return 'Expressão avaliada';
  }

  describeTarget(e: Expr): string {
    if (e.kind === 'Ident') return e.name;
    if (e.kind === 'Index') {
      const idxs: string[] = [];
      let cur: Expr = e;
      while (cur.kind === 'Index') {
        idxs.unshift(this.exprToString(cur.index));
        cur = cur.array;
      }
      const base = cur.kind === 'Ident' ? cur.name : '?';
      return `${base}[${idxs.join('][')}]`;
    }
    if (e.kind === 'Deref') return `*${this.describeTarget(e.operand)}`;
    return '?';
  }

  exprToString(e: Expr): string {
    if (e.kind === 'IntLit') return String(e.value);
    if (e.kind === 'Ident') return e.name;
    if (e.kind === 'BinaryOp') return `${this.exprToString(e.left)}${e.op}${this.exprToString(e.right)}`;
    return '…';
  }

  // Avaliação sem efeitos colaterais (best-effort para mensagens descritivas).
  evalExprNoSideEffect(expr: Expr, scope: Scope): number | string {
    try {
      const before = this.memory.cells.slice();
      const beforeOut = this.output;
      const beforeFoci = this.pendingFoci.slice();
      const v = this.evalExpr(expr, scope);
      this.memory.cells = before;
      this.output = beforeOut;
      this.pendingFoci = beforeFoci;
      return v;
    } catch { return '?'; }
  }

  focusFor(target: Expr, scope: Scope, kind: 'read' | 'write'): Step['focus'] | undefined {
    if (target.kind === 'Ident') return { varName: target.name, kind };
    if (target.kind === 'Index') {
      const idxs: number[] = [];
      let cur: Expr = target;
      while (cur.kind === 'Index') {
        try { idxs.unshift(this.evalExprNoSideEffect(cur.index, scope) as number); }
        catch { idxs.unshift(0); }
        cur = cur.array;
      }
      if (cur.kind === 'Ident') return { varName: cur.name, cellIndex: idxs, kind };
    }
    return undefined;
  }
}

// ===== utilidades =====
function unflatten(flat: number, dims: number[]): number[] {
  const out: number[] = new Array(dims.length).fill(0);
  let rem = flat;
  for (let i = 0; i < dims.length; i++) {
    let stride = 1;
    for (let j = i + 1; j < dims.length; j++) stride *= dims[j];
    out[i] = Math.floor(rem / stride);
    rem = rem % stride;
  }
  return out;
}
function sameIndex(a: number[] | undefined, b: number[] | undefined): boolean {
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
function parseSpecPrecision(spec: string, def: number): number {
  const m = spec.match(/\.(\d+)/);
  return m ? parseInt(m[1], 10) : def;
}
