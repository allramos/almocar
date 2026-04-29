// Parser recursivo descendente para JavaScript (subset didático).
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

  // ----- programa -----
  // JavaScript: funções top-level + statements soltos (wrapped em main)
  parseProgram(): Program {
    const functions: FunctionDecl[] = [];
    const topStmts: Stmt[] = [];

    while (!this.eof()) {
      if (this.is('KEYWORD', 'function')) {
        functions.push(this.parseFunction());
      } else {
        topStmts.push(this.parseStmt());
      }
    }

    // Statements top-level viram o corpo de "main"
    // Mesmo sem statements, gera main() vazia para que o programa seja válido
    // (necessário para o REPL quando só se declaram funções).
    const mainBody: BlockStmt = { kind: 'BlockStmt', stmts: topStmts, line: 1 };
    functions.push({
      kind: 'FunctionDecl',
      name: 'main',
      returnType: tVoid,
      params: [],
      body: mainBody,
      line: 1,
    });

    return { kind: 'Program', functions, includes: new Set<string>() };
  }

  parseFunction(): FunctionDecl {
    const startLine = this.peek().line;
    this.expect('KEYWORD', 'function');
    const nameTok = this.expect('IDENT');
    this.expect('PUNCT', '(');
    const params: Param[] = [];
    if (!this.is('PUNCT', ')')) {
      params.push(this.parseParam());
      while (this.match('PUNCT', ',')) params.push(this.parseParam());
    }
    this.expect('PUNCT', ')');
    const body = this.parseBlock();
    return {
      kind: 'FunctionDecl',
      name: nameTok.value,
      returnType: tVoid,
      params,
      body,
      line: startLine,
    };
  }

  parseParam(): Param {
    const name = this.expect('IDENT').value;
    return { name, type: tInt };
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
        case 'break':    this.next(); this.match('PUNCT', ';');
                         return { kind: 'BreakStmt', line: t.line };
        case 'continue': this.next(); this.match('PUNCT', ';');
                         return { kind: 'ContinueStmt', line: t.line };
        case 'let': case 'const': case 'var':
                         return this.parseDeclStmt();
      }
    }
    // expression statement
    const expr = this.parseExpr();
    this.match('PUNCT', ';');
    return { kind: 'ExprStmt', expr, line: t.line };
  }

  // Em JS, let/const/var introduzem declarações.
  // Inferimos o tipo pelo inicializador ou defaultamos para int.
  parseDeclStmt(): DeclStmt {
    const startLine = this.peek().line;
    this.next(); // consome let/const/var
    const decls: VarDecl[] = [this.parseDeclarator()];
    while (this.match('PUNCT', ',')) {
      decls.push(this.parseDeclarator());
    }
    this.match('PUNCT', ';');
    return { kind: 'DeclStmt', decls, line: startLine };
  }

  parseDeclarator(): VarDecl {
    const nameTok = this.expect('IDENT');
    let type: CType = tInt;
    let init: Initializer | undefined;

    if (this.match('PUNCT', '=')) {
      // Verifica se é array literal
      if (this.is('PUNCT', '[')) {
        init = this.parseArrayInitializer();
        type = this.inferTypeFromInit(init);
      } else {
        const expr = this.parseAssign();
        init = { kind: 'Single', expr };
        type = this.inferTypeFromExpr(expr);
      }
    }

    return { kind: 'VarDecl', type, name: nameTok.value, init, line: nameTok.line };
  }

  parseArrayInitializer(): Initializer {
    const tok = this.expect('PUNCT', '[');
    const items: Initializer[] = [];
    if (!this.is('PUNCT', ']')) {
      items.push(this.parseSingleOrArrayInit());
      while (this.match('PUNCT', ',')) {
        if (this.is('PUNCT', ']')) break; // trailing comma
        items.push(this.parseSingleOrArrayInit());
      }
    }
    this.expect('PUNCT', ']');
    return { kind: 'List', items, line: tok.line };
  }

  parseSingleOrArrayInit(): Initializer {
    if (this.is('PUNCT', '[')) {
      return this.parseArrayInitializer();
    }
    return { kind: 'Single', expr: this.parseAssign() };
  }

  inferTypeFromInit(init: Initializer): CType {
    if (init.kind === 'List') {
      if (init.items.length > 0 && init.items[0].kind === 'List') {
        const innerType = this.inferTypeFromInit(init.items[0]);
        return { kind: 'array', of: innerType, size: init.items.length };
      }
      // Array simples: infere tipo do primeiro elemento
      let elemType: CType = tInt;
      if (init.items.length > 0 && init.items[0].kind === 'Single') {
        elemType = this.inferTypeFromExpr(init.items[0].expr);
      }
      return { kind: 'array', of: elemType, size: init.items.length };
    }
    if (init.kind === 'Single') return this.inferTypeFromExpr(init.expr);
    return tInt;
  }

  inferTypeFromExpr(expr: Expr): CType {
    if (expr.kind === 'FloatLit') return tFloat;
    if (expr.kind === 'StringLit') return { kind: 'array', of: tChar, size: 256 };
    if (expr.kind === 'CharLit') return tChar;
    return tInt;
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
      if (this.is('KEYWORD', 'let') || this.is('KEYWORD', 'const') || this.is('KEYWORD', 'var')) {
        init = this.parseDeclStmt(); // consome o ;
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
    this.match('PUNCT', ';');
    return { kind: 'DoWhileStmt', cond, body, line: tok.line };
  }

  parseReturn(): Stmt {
    const tok = this.expect('KEYWORD', 'return');
    let value: Expr | undefined;
    if (!this.is('PUNCT', ';') && !this.is('PUNCT', '}') && !this.eof()) {
      value = this.parseExpr();
    }
    this.match('PUNCT', ';');
    return { kind: 'ReturnStmt', value, line: tok.line };
  }

  // ===== Expressões — precedência ascendente =====
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
      const compound = ['+=', '-=', '*=', '/=', '%=', '&=', '|=', '^='];
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
    while (['<', '>', '<=', '>='].some(o => this.is('PUNCT', o))) {
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
    while (['*', '/', '%'].some(o => this.is('PUNCT', o))) {
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
    // Array literal como expressão
    if (t.kind === 'PUNCT' && t.value === '[') {
      return this.parseArrayExpr();
    }
    throw new SyntaxError(`Expressão inesperada: '${t.value}' (linha ${t.line})`);
  }

  parseArrayExpr(): Expr {
    // Trata [1, 2, 3] como expressão — retorna o primeiro elemento como placeholder
    // (arrays são tratados na declaração via Initializer)
    const tok = this.expect('PUNCT', '[');
    const items: Expr[] = [];
    if (!this.is('PUNCT', ']')) {
      items.push(this.parseAssign());
      while (this.match('PUNCT', ',')) {
        if (this.is('PUNCT', ']')) break;
        items.push(this.parseAssign());
      }
    }
    this.expect('PUNCT', ']');
    return items.length > 0 ? items[0] : { kind: 'IntLit', value: 0, line: tok.line };
  }
}
