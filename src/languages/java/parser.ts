// Parser recursivo descendente para Java (subset didático).
// Produz o mesmo AST usado pelo interpretador compartilhado.

import { Token, tokenize } from './lexer';
import {
  Program, FunctionDecl, Param, Stmt, Expr, BlockStmt, VarDecl, Initializer, DeclStmt,
} from '../../interpreter/ast';
import { CType, tInt, tFloat, tChar, tVoid } from '../../interpreter/types';

export function parse(source: string): Program {
  const tokens = tokenize(source);
  return new Parser(tokens).parseProgram();
}

class Parser {
  pos = 0;
  constructor(public tokens: Token[]) {}

  // ----- helpers -----
  peek(k = 0): Token { return this.tokens[this.pos + k]; }
  eof(): boolean { return this.peek().kind === 'EOF'; }
  next(): Token { return this.tokens[this.pos++]; }
  match(kind: string, value?: string): boolean {
    const t = this.peek();
    if (t.kind !== kind) return false;
    if (value !== undefined && t.value !== value) return false;
    this.pos++; return true;
  }
  expect(kind: string, value?: string): Token {
    const t = this.peek();
    if (t.kind !== kind || (value !== undefined && t.value !== value)) {
      throw new SyntaxError(
        `Esperado '${value ?? kind}', encontrado '${t.value}' (linha ${t.line}, col ${t.col})`
      );
    }
    return this.next();
  }
  is(kind: string, value?: string): boolean {
    const t = this.peek();
    if (t.kind !== kind) return false;
    if (value !== undefined && t.value !== value) return false;
    return true;
  }

  isModifier(): boolean {
    const t = this.peek();
    if (t.kind !== 'KEYWORD') return false;
    return ['public','private','protected','static','final'].includes(t.value);
  }

  skipModifiers() {
    while (this.isModifier()) this.next();
  }

  isTypeStart(): boolean {
    const t = this.peek();
    if (t.kind !== 'KEYWORD') return false;
    return ['int','float','double','char','void','boolean','String','long','short','byte'].includes(t.value);
  }

  // ----- programa -----
  // Pula wrapper de classe: [modifiers] class Name { ... }
  parseProgram(): Program {
    const functions: FunctionDecl[] = [];
    this.skipModifiers();
    let hasClass = false;
    if (this.match('KEYWORD', 'class')) {
      this.expect('IDENT');
      this.expect('PUNCT', '{');
      hasClass = true;
    }
    while (!this.eof() && !(hasClass && this.is('PUNCT', '}'))) {
      functions.push(this.parseFunction());
    }
    if (hasClass) this.match('PUNCT', '}');
    return { kind: 'Program', functions, includes: new Set<string>() };
  }

  parseBaseType(): CType {
    const t = this.peek();
    if (t.kind !== 'KEYWORD') throw new SyntaxError(`Esperado tipo na linha ${t.line}`);
    let base: CType;
    switch (t.value) {
      case 'int':     base = tInt; break;
      case 'long':    base = tInt; break;
      case 'short':   base = tInt; break;
      case 'byte':    base = tInt; break;
      case 'float':   base = tFloat; break;
      case 'double':  base = tFloat; break;
      case 'char':    base = tChar; break;
      case 'void':    base = tVoid; break;
      case 'boolean': base = tInt; break;
      case 'String':  base = { kind: 'array', of: tChar, size: 256 }; break;
      default:
        throw new SyntaxError(`Tipo não suportado: ${t.value} (linha ${t.line})`);
    }
    this.next();
    return base;
  }

  // Conta os [] após o tipo ou nome (Java style: int[], int[][])
  countArrayBrackets(): number {
    let dims = 0;
    while (this.is('PUNCT', '[') && this.peek(1).kind === 'PUNCT' && this.peek(1).value === ']') {
      this.next(); this.next();
      dims++;
    }
    return dims;
  }

  parseFunction(): FunctionDecl {
    const startLine = this.peek().line;
    this.skipModifiers();
    const returnType = this.parseBaseType();
    this.countArrayBrackets();
    const nameTok = this.expect('IDENT');
    this.expect('PUNCT', '(');
    // Consome os parâmetros da assinatura mas descarta String[] args (main)
    // pois o interpretador não precisa deles.
    if (!this.is('PUNCT', ')')) {
      this.parseParam();
      while (this.match('PUNCT', ',')) this.parseParam();
    }
    this.expect('PUNCT', ')');
    const body = this.parseBlock();
    return { kind: 'FunctionDecl', name: nameTok.value, returnType, params: [], body, line: startLine };
  }

  parseParam(): Param {
    const type = this.parseBaseType();
    this.countArrayBrackets();
    const name = this.expect('IDENT').value;
    this.countArrayBrackets();
    return { name, type };
  }

  parseBlock(): BlockStmt {
    const tok = this.expect('PUNCT', '{');
    const stmts: Stmt[] = [];
    while (!this.is('PUNCT', '}') && !this.eof()) {
      stmts.push(this.parseStmt());
    }
    this.expect('PUNCT', '}');
    return { kind: 'BlockStmt', stmts, line: tok.line };
  }

  parseStmt(): Stmt {
    const t = this.peek();
    if (t.kind === 'PUNCT' && t.value === '{') return this.parseBlock();

    // Pula declarações de Scanner: Scanner <nome> = ...;
    if (t.kind === 'IDENT' && t.value === 'Scanner') {
      const line = t.line;
      while (!this.is('PUNCT', ';') && !this.eof()) this.next();
      this.expect('PUNCT', ';');
      return { kind: 'ExprStmt', expr: { kind: 'IntLit', value: 0, line }, line };
    }

    if (t.kind === 'KEYWORD') {
      switch (t.value) {
        case 'if':       return this.parseIf();
        case 'for':      return this.parseFor();
        case 'while':    return this.parseWhile();
        case 'do':       return this.parseDoWhile();
        case 'return':   return this.parseReturn();
        case 'break':    this.next(); this.expect('PUNCT', ';');
                         return { kind: 'BreakStmt', line: t.line };
        case 'continue': this.next(); this.expect('PUNCT', ';');
                         return { kind: 'ContinueStmt', line: t.line };
        case 'final':    this.next(); return this.parseDeclStmt();
      }
      if (this.isTypeStart()) return this.parseDeclStmt();
    }

    // expression statement
    const expr = this.parseExpr();
    this.expect('PUNCT', ';');
    return { kind: 'ExprStmt', expr, line: t.line };
  }

  parseDeclStmt(): DeclStmt {
    const startLine = this.peek().line;
    const baseType = this.parseBaseType();
    const arrayDims = this.countArrayBrackets();
    const decls: VarDecl[] = [this.parseDeclarator(baseType, arrayDims)];
    while (this.match('PUNCT', ',')) {
      decls.push(this.parseDeclarator(baseType, arrayDims));
    }
    this.expect('PUNCT', ';');
    return { kind: 'DeclStmt', decls, line: startLine };
  }

  parseDeclarator(baseType: CType, arrayDims: number): VarDecl {
    const nameTok = this.expect('IDENT');
    arrayDims += this.countArrayBrackets();

    let type: CType = baseType;
    let init: Initializer | undefined;

    if (this.match('PUNCT', '=')) {
      if (this.is('KEYWORD', 'new')) {
        this.next();
        // Pula o tipo após new (int, String, etc.)
        if (this.isTypeStart()) {
          this.parseBaseType();
        } else if (this.peek().kind === 'IDENT') {
          this.next();
        }
        // Coleta dimensões: new int[d1][d2]...
        const dims: number[] = [];
        while (this.is('PUNCT', '[')) {
          this.next();
          const sizeTok = this.peek();
          if (sizeTok.kind !== 'INT') {
            throw new SyntaxError(`Tamanho de array deve ser literal inteiro (linha ${sizeTok.line})`);
          }
          this.next();
          dims.push(parseInt(sizeTok.value, 10));
          this.expect('PUNCT', ']');
        }
        // Pula possível construtor: new Scanner(System.in)
        if (this.match('PUNCT', '(')) {
          let depth = 1;
          while (depth > 0 && !this.eof()) {
            if (this.is('PUNCT', '(')) depth++;
            if (this.is('PUNCT', ')')) depth--;
            if (depth > 0) this.next();
          }
          this.expect('PUNCT', ')');
        }
        if (dims.length > 0) {
          let t: CType = baseType;
          for (let i = dims.length - 1; i >= 0; i--) {
            t = { kind: 'array', of: t, size: dims[i] };
          }
          type = t;
        }
      } else {
        init = this.parseInitializer();
        if (arrayDims > 0 && init.kind === 'List') {
          type = this.inferArrayType(baseType, init);
        }
      }
    }

    if (arrayDims > 0 && type === baseType && !init) {
      let t: CType = baseType;
      for (let i = 0; i < arrayDims; i++) {
        t = { kind: 'array', of: t, size: 0 };
      }
      type = t;
    }

    return { kind: 'VarDecl', type, name: nameTok.value, init, line: nameTok.line };
  }

  inferArrayType(baseType: CType, init: Initializer): CType {
    if (init.kind === 'List') {
      if (init.items.length > 0 && init.items[0].kind === 'List') {
        const innerType = this.inferArrayType(baseType, init.items[0]);
        return { kind: 'array', of: innerType, size: init.items.length };
      }
      return { kind: 'array', of: baseType, size: init.items.length };
    }
    return baseType;
  }

  parseInitializer(): Initializer {
    if (this.is('PUNCT', '{')) {
      const tok = this.next();
      const items: Initializer[] = [];
      if (!this.is('PUNCT', '}')) {
        items.push(this.parseInitializer());
        while (this.match('PUNCT', ',')) {
          if (this.is('PUNCT', '}')) break;
          items.push(this.parseInitializer());
        }
      }
      this.expect('PUNCT', '}');
      return { kind: 'List', items, line: tok.line };
    }
    return { kind: 'Single', expr: this.parseAssign() };
  }

  parseIf(): Stmt {
    const tok = this.expect('KEYWORD', 'if');
    this.expect('PUNCT', '(');
    const cond = this.parseExpr();
    this.expect('PUNCT', ')');
    const then = this.parseStmt();
    let els: Stmt | undefined;
    if (this.match('KEYWORD', 'else')) els = this.parseStmt();
    return { kind: 'IfStmt', cond, then, else: els, line: tok.line };
  }

  parseFor(): Stmt {
    const tok = this.expect('KEYWORD', 'for');
    this.expect('PUNCT', '(');
    let init: Stmt | Expr | undefined;
    if (!this.is('PUNCT', ';')) {
      if (this.isTypeStart() || (this.is('KEYWORD', 'final'))) {
        if (this.match('KEYWORD', 'final')) { /* consume */ }
        init = this.parseDeclStmt();
      } else {
        init = this.parseExpr();
        this.expect('PUNCT', ';');
      }
    } else {
      this.next();
    }
    let cond: Expr | undefined;
    if (!this.is('PUNCT', ';')) cond = this.parseExpr();
    this.expect('PUNCT', ';');
    let step: Expr | undefined;
    if (!this.is('PUNCT', ')')) step = this.parseExpr();
    this.expect('PUNCT', ')');
    const body = this.parseStmt();
    return { kind: 'ForStmt', init, cond, step, body, line: tok.line };
  }

  parseWhile(): Stmt {
    const tok = this.expect('KEYWORD', 'while');
    this.expect('PUNCT', '(');
    const cond = this.parseExpr();
    this.expect('PUNCT', ')');
    const body = this.parseStmt();
    return { kind: 'WhileStmt', cond, body, line: tok.line };
  }

  parseDoWhile(): Stmt {
    const tok = this.expect('KEYWORD', 'do');
    const body = this.parseStmt();
    this.expect('KEYWORD', 'while');
    this.expect('PUNCT', '(');
    const cond = this.parseExpr();
    this.expect('PUNCT', ')');
    this.expect('PUNCT', ';');
    return { kind: 'DoWhileStmt', cond, body, line: tok.line };
  }

  parseReturn(): Stmt {
    const tok = this.expect('KEYWORD', 'return');
    let value: Expr | undefined;
    if (!this.is('PUNCT', ';')) value = this.parseExpr();
    this.expect('PUNCT', ';');
    return { kind: 'ReturnStmt', value, line: tok.line };
  }

  // ===== Expressões — mesma precedência do C =====
  parseExpr(): Expr { return this.parseAssign(); }

  parseAssign(): Expr {
    const left = this.parseTernary();
    const t = this.peek();
    if (t.kind === 'PUNCT') {
      if (t.value === '=') {
        this.next();
        const value = this.parseAssign();
        return { kind: 'Assign', target: left, value, line: t.line };
      }
      const compound = ['+=','-=','*=','/=','%=','&=','|=','^=','<<=','>>='];
      if (compound.includes(t.value)) {
        this.next();
        const value = this.parseAssign();
        return { kind: 'CompoundAssign', op: t.value.slice(0, -1), target: left, value, line: t.line };
      }
    }
    return left;
  }

  parseTernary(): Expr {
    const cond = this.parseLogicalOr();
    if (this.match('PUNCT', '?')) {
      const then = this.parseExpr();
      this.expect('PUNCT', ':');
      const els = this.parseAssign();
      return { kind: 'Ternary', cond, then, else: els, line: cond.line };
    }
    return cond;
  }

  parseLogicalOr(): Expr {
    let left = this.parseLogicalAnd();
    while (this.is('PUNCT', '||')) {
      const op = this.next().value;
      const right = this.parseLogicalAnd();
      left = { kind: 'BinaryOp', op, left, right, line: left.line };
    }
    return left;
  }
  parseLogicalAnd(): Expr {
    let left = this.parseBitOr();
    while (this.is('PUNCT', '&&')) {
      const op = this.next().value;
      const right = this.parseBitOr();
      left = { kind: 'BinaryOp', op, left, right, line: left.line };
    }
    return left;
  }
  parseBitOr(): Expr {
    let left = this.parseBitXor();
    while (this.is('PUNCT', '|')) {
      const op = this.next().value;
      const right = this.parseBitXor();
      left = { kind: 'BinaryOp', op, left, right, line: left.line };
    }
    return left;
  }
  parseBitXor(): Expr {
    let left = this.parseBitAnd();
    while (this.is('PUNCT', '^')) {
      const op = this.next().value;
      const right = this.parseBitAnd();
      left = { kind: 'BinaryOp', op, left, right, line: left.line };
    }
    return left;
  }
  parseBitAnd(): Expr {
    let left = this.parseEquality();
    while (this.is('PUNCT', '&')) {
      const op = this.next().value;
      const right = this.parseEquality();
      left = { kind: 'BinaryOp', op, left, right, line: left.line };
    }
    return left;
  }
  parseEquality(): Expr {
    let left = this.parseRelational();
    while (this.is('PUNCT', '==') || this.is('PUNCT', '!=')) {
      const op = this.next().value;
      const right = this.parseRelational();
      left = { kind: 'BinaryOp', op, left, right, line: left.line };
    }
    return left;
  }
  parseRelational(): Expr {
    let left = this.parseShift();
    while (['<','>','<=','>='].some(o => this.is('PUNCT', o))) {
      const op = this.next().value;
      const right = this.parseShift();
      left = { kind: 'BinaryOp', op, left, right, line: left.line };
    }
    return left;
  }
  parseShift(): Expr {
    let left = this.parseAdd();
    while (this.is('PUNCT', '<<') || this.is('PUNCT', '>>')) {
      const op = this.next().value;
      const right = this.parseAdd();
      left = { kind: 'BinaryOp', op, left, right, line: left.line };
    }
    return left;
  }
  parseAdd(): Expr {
    let left = this.parseMul();
    while (this.is('PUNCT', '+') || this.is('PUNCT', '-')) {
      const op = this.next().value;
      const right = this.parseMul();
      left = { kind: 'BinaryOp', op, left, right, line: left.line };
    }
    return left;
  }
  parseMul(): Expr {
    let left = this.parseUnary();
    while (['*','/','%'].some(o => this.is('PUNCT', o))) {
      const op = this.next().value;
      const right = this.parseUnary();
      left = { kind: 'BinaryOp', op, left, right, line: left.line };
    }
    return left;
  }

  parseUnary(): Expr {
    const t = this.peek();
    if (t.kind === 'PUNCT') {
      if (t.value === '+' || t.value === '-' || t.value === '!' || t.value === '~') {
        this.next();
        return { kind: 'UnaryOp', op: t.value, operand: this.parseUnary(), line: t.line };
      }
      if (t.value === '++' || t.value === '--') {
        this.next();
        return { kind: 'Prefix', op: t.value as '++' | '--', operand: this.parseUnary(), line: t.line };
      }
    }
    // Cast: (int) expr, (double) expr, etc.
    if (t.kind === 'PUNCT' && t.value === '(' && this.peek(1).kind === 'KEYWORD' && this.isTypeName(this.peek(1).value)) {
      const parenPos = this.pos;
      this.next(); // (
      const type = this.parseBaseType();
      if (this.match('PUNCT', ')')) {
        return { kind: 'Cast', type, operand: this.parseUnary(), line: t.line };
      }
      // Não era cast, volta atrás
      this.pos = parenPos;
    }
    return this.parsePostfix();
  }

  isTypeName(v: string): boolean {
    return ['int','float','double','char','void','boolean','String','long','short','byte'].includes(v);
  }

  parsePostfix(): Expr {
    let e = this.parsePrimary();
    while (true) {
      const t = this.peek();
      if (t.kind === 'PUNCT' && t.value === '[') {
        this.next();
        const idx = this.parseExpr();
        this.expect('PUNCT', ']');
        e = { kind: 'Index', array: e, index: idx, line: t.line };
      } else if (t.kind === 'PUNCT' && t.value === '(') {
        if (e.kind !== 'Ident') throw new SyntaxError(`Chamada inválida na linha ${t.line}`);
        this.next();
        const args: Expr[] = [];
        if (!this.is('PUNCT', ')')) {
          args.push(this.parseAssign());
          while (this.match('PUNCT', ',')) args.push(this.parseAssign());
        }
        this.expect('PUNCT', ')');
        e = { kind: 'Call', callee: e.name, args, line: t.line };
      } else if (t.kind === 'PUNCT' && (t.value === '++' || t.value === '--')) {
        this.next();
        e = { kind: 'Postfix', op: t.value as '++' | '--', operand: e, line: t.line };
      } else {
        break;
      }
    }
    return e;
  }

  parsePrimary(): Expr {
    const t = this.peek();
    if (t.kind === 'INT')    { this.next(); return { kind: 'IntLit', value: parseInt(t.value, 10), line: t.line }; }
    if (t.kind === 'FLOAT')  { this.next(); return { kind: 'FloatLit', value: parseFloat(t.value), line: t.line }; }
    if (t.kind === 'CHAR')   { this.next(); return { kind: 'CharLit', value: parseInt(t.value, 10), line: t.line }; }
    if (t.kind === 'STRING') { this.next(); return { kind: 'StringLit', value: t.value, line: t.line }; }
    if (t.kind === 'IDENT')  { this.next(); return { kind: 'Ident', name: t.value, line: t.line }; }
    if (t.kind === 'PUNCT' && t.value === '(') {
      this.next();
      const e = this.parseExpr();
      this.expect('PUNCT', ')');
      return e;
    }
    throw new SyntaxError(`Expressão inesperada: '${t.value}' (linha ${t.line})`);
  }
}
