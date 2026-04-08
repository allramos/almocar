// Parser recursivo descendente para C (subset didático).

import { Token, tokenize } from './lexer';
import {
  Program, FunctionDecl, Param, Stmt, Expr, BlockStmt, VarDecl, Initializer, DeclStmt,
} from '../../interpreter/ast';
import { CType, tInt, tFloat, tChar, tVoid, tPtr } from '../../interpreter/types';

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

  // ----- programa -----
  parseProgram(): Program {
    const functions: FunctionDecl[] = [];
    while (!this.eof()) {
      functions.push(this.parseFunction());
    }
    return { kind: 'Program', functions };
  }

  // tipo simples (int, float, char, void) com possíveis '*'
  parseBaseType(): CType {
    const t = this.peek();
    if (t.kind !== 'KEYWORD') throw new SyntaxError(`Esperado tipo na linha ${t.line}`);
    let base: CType;
    switch (t.value) {
      case 'int': base = tInt; break;
      case 'float': base = tFloat; break;
      case 'double': base = tFloat; break;
      case 'char': base = tChar; break;
      case 'void': base = tVoid; break;
      // qualificadores ignorados (consome e tenta de novo)
      case 'const': case 'static': case 'unsigned': case 'signed': case 'short': case 'long':
        this.next(); return this.parseBaseType();
      default:
        throw new SyntaxError(`Tipo não suportado: ${t.value} (linha ${t.line})`);
    }
    this.next();
    // ponteiros: int *, int **, ...
    while (this.match('PUNCT', '*')) base = tPtr(base);
    return base;
  }

  isTypeStart(): boolean {
    const t = this.peek();
    if (t.kind !== 'KEYWORD') return false;
    return ['int','float','double','char','void','const','static','unsigned','signed','short','long']
      .includes(t.value);
  }

  parseFunction(): FunctionDecl {
    const startLine = this.peek().line;
    const returnType = this.parseBaseType();
    const nameTok = this.expect('IDENT');
    this.expect('PUNCT', '(');
    const params: Param[] = [];
    if (!this.is('PUNCT', ')')) {
      // void único?
      if (this.is('KEYWORD', 'void') && this.peek(1).kind === 'PUNCT' && this.peek(1).value === ')') {
        this.next();
      } else {
        params.push(this.parseParam());
        while (this.match('PUNCT', ',')) params.push(this.parseParam());
      }
    }
    this.expect('PUNCT', ')');
    const body = this.parseBlock();
    return { kind: 'FunctionDecl', name: nameTok.value, returnType, params, body, line: startLine };
  }

  parseParam(): Param {
    const type = this.parseBaseType();
    const name = this.expect('IDENT').value;
    // arrays como parâmetros: tratar como ponteiro
    if (this.match('PUNCT', '[')) {
      // pode ter expressão de tamanho — descarta
      while (!this.match('PUNCT', ']')) this.next();
      return { name, type: tPtr(type) };
    }
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
    const decls: VarDecl[] = [this.parseDeclarator(baseType)];
    while (this.match('PUNCT', ',')) {
      decls.push(this.parseDeclarator(baseType));
    }
    this.expect('PUNCT', ';');
    return { kind: 'DeclStmt', decls, line: startLine };
  }

  parseDeclarator(baseType: CType): VarDecl {
    // ponteiros adicionais (int *p, *q)
    let type = baseType;
    while (this.match('PUNCT', '*')) type = tPtr(type);
    const nameTok = this.expect('IDENT');
    // arrays: pode ser multi-dimensional
    const dims: number[] = [];
    while (this.match('PUNCT', '[')) {
      const sizeTok = this.peek();
      if (sizeTok.kind !== 'INT') {
        throw new SyntaxError(`Tamanho de array deve ser literal inteiro (linha ${sizeTok.line})`);
      }
      this.next();
      dims.push(parseInt(sizeTok.value, 10));
      this.expect('PUNCT', ']');
    }
    if (dims.length > 0) {
      // monta tipo array (do mais interno para o mais externo)
      let t: CType = type;
      for (let i = dims.length - 1; i >= 0; i--) {
        t = { kind: 'array', of: t, size: dims[i] };
      }
      type = t;
    }
    let init: Initializer | undefined;
    if (this.match('PUNCT', '=')) init = this.parseInitializer();
    return { kind: 'VarDecl', type, name: nameTok.value, init, line: nameTok.line };
  }

  parseInitializer(): Initializer {
    if (this.is('PUNCT', '{')) {
      const tok = this.next();
      const items: Initializer[] = [];
      if (!this.is('PUNCT', '}')) {
        items.push(this.parseInitializer());
        while (this.match('PUNCT', ',')) {
          if (this.is('PUNCT', '}')) break; // trailing comma
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
      if (this.isTypeStart()) {
        init = this.parseDeclStmt(); // já consome o ';'
      } else {
        init = this.parseExpr();
        this.expect('PUNCT', ';');
      }
    } else {
      this.next(); // consome ;
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

  // ===== Expressões — precedência ascendente =====
  parseExpr(): Expr { return this.parseComma(); }

  parseComma(): Expr {
    // No MVP, vírgula só aparece dentro de chamadas e for(); aqui delego para assign
    return this.parseAssign();
  }

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
      if (t.value === '*') {
        this.next();
        return { kind: 'Deref', operand: this.parseUnary(), line: t.line };
      }
      if (t.value === '&') {
        this.next();
        return { kind: 'AddrOf', operand: this.parseUnary(), line: t.line };
      }
      if (t.value === '++' || t.value === '--') {
        this.next();
        return { kind: 'Prefix', op: t.value as '++' | '--', operand: this.parseUnary(), line: t.line };
      }
    }
    if (t.kind === 'KEYWORD' && t.value === 'sizeof') {
      this.next();
      this.expect('PUNCT', '(');
      // só tipo simples por enquanto
      if (this.isTypeStart()) {
        const type = this.parseBaseType();
        this.expect('PUNCT', ')');
        return { kind: 'SizeofType', type, line: t.line };
      }
      const operand = this.parseExpr();
      this.expect('PUNCT', ')');
      return { kind: 'SizeofExpr', operand, line: t.line };
    }
    return this.parsePostfix();
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
        // chamada — só permite quando o callee é um identificador
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
