import { CType } from './types';

// Cada nó tem o número da linha onde aparece no fonte (1-based).
export interface NodeBase {
  line: number;
}

// ----- Expressões -----

export type Expr =
  | IntLit | FloatLit | CharLit | StringLit
  | Ident
  | BinaryOp | UnaryOp | Assign | CompoundAssign
  | Index | Call | Ternary
  | AddrOf | Deref
  | Postfix | Prefix
  | Cast | SizeofExpr | SizeofType;

export interface IntLit   extends NodeBase { kind: 'IntLit'; value: number; }
export interface FloatLit extends NodeBase { kind: 'FloatLit'; value: number; }
export interface CharLit  extends NodeBase { kind: 'CharLit'; value: number; }
export interface StringLit extends NodeBase { kind: 'StringLit'; value: string; }
export interface Ident    extends NodeBase { kind: 'Ident'; name: string; }
export interface BinaryOp extends NodeBase { kind: 'BinaryOp'; op: string; left: Expr; right: Expr; }
export interface UnaryOp  extends NodeBase { kind: 'UnaryOp'; op: string; operand: Expr; }
export interface Assign   extends NodeBase { kind: 'Assign'; target: Expr; value: Expr; }
export interface CompoundAssign extends NodeBase { kind: 'CompoundAssign'; op: string; target: Expr; value: Expr; }
export interface Index    extends NodeBase { kind: 'Index'; array: Expr; index: Expr; }
export interface Call     extends NodeBase { kind: 'Call'; callee: string; args: Expr[]; }
export interface Ternary  extends NodeBase { kind: 'Ternary'; cond: Expr; then: Expr; else: Expr; }
export interface AddrOf   extends NodeBase { kind: 'AddrOf'; operand: Expr; }
export interface Deref    extends NodeBase { kind: 'Deref'; operand: Expr; }
export interface Postfix  extends NodeBase { kind: 'Postfix'; op: '++' | '--'; operand: Expr; }
export interface Prefix   extends NodeBase { kind: 'Prefix'; op: '++' | '--'; operand: Expr; }
export interface Cast     extends NodeBase { kind: 'Cast'; type: CType; operand: Expr; }
export interface SizeofExpr extends NodeBase { kind: 'SizeofExpr'; operand: Expr; }
export interface SizeofType extends NodeBase { kind: 'SizeofType'; type: CType; }

// ----- Inicializadores -----
export type Initializer = { kind: 'Single'; expr: Expr } | { kind: 'List'; items: Initializer[]; line: number };

// ----- Declarações de variáveis -----
export interface VarDecl extends NodeBase {
  kind: 'VarDecl';
  type: CType;
  name: string;
  init?: Initializer;
}

// ----- Statements -----
export type Stmt =
  | DeclStmt | ExprStmt | BlockStmt | IfStmt | ForStmt | WhileStmt | DoWhileStmt
  | ReturnStmt | BreakStmt | ContinueStmt;

export interface DeclStmt    extends NodeBase { kind: 'DeclStmt'; decls: VarDecl[]; }
export interface ExprStmt    extends NodeBase { kind: 'ExprStmt'; expr: Expr; }
export interface BlockStmt   extends NodeBase { kind: 'BlockStmt'; stmts: Stmt[]; }
export interface IfStmt      extends NodeBase { kind: 'IfStmt'; cond: Expr; then: Stmt; else?: Stmt; }
export interface ForStmt     extends NodeBase { kind: 'ForStmt'; init?: Stmt | Expr; cond?: Expr; step?: Expr; body: Stmt; }
export interface WhileStmt   extends NodeBase { kind: 'WhileStmt'; cond: Expr; body: Stmt; }
export interface DoWhileStmt extends NodeBase { kind: 'DoWhileStmt'; cond: Expr; body: Stmt; }
export interface ReturnStmt  extends NodeBase { kind: 'ReturnStmt'; value?: Expr; }
export interface BreakStmt   extends NodeBase { kind: 'BreakStmt'; }
export interface ContinueStmt extends NodeBase { kind: 'ContinueStmt'; }

// ----- Função / Programa -----
export interface Param { name: string; type: CType; }
export interface FunctionDecl extends NodeBase {
  kind: 'FunctionDecl';
  name: string;
  returnType: CType;
  params: Param[];
  body: BlockStmt;
}
export interface Program {
  kind: 'Program';
  functions: FunctionDecl[];
}
