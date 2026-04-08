// Tipos compartilhados pelo interpretador

export type CType =
  | { kind: 'int' }
  | { kind: 'float' }
  | { kind: 'char' }
  | { kind: 'void' }
  | { kind: 'pointer'; to: CType }
  | { kind: 'array'; of: CType; size: number };

export const tInt: CType = { kind: 'int' };
export const tFloat: CType = { kind: 'float' };
export const tChar: CType = { kind: 'char' };
export const tVoid: CType = { kind: 'void' };
export const tPtr = (to: CType): CType => ({ kind: 'pointer', to });
export const tArr = (of: CType, size: number): CType => ({ kind: 'array', of, size });

export function typeName(t: CType): string {
  switch (t.kind) {
    case 'int': return 'int';
    case 'float': return 'float';
    case 'char': return 'char';
    case 'void': return 'void';
    case 'pointer': return typeName(t.to) + '*';
    case 'array': {
      // Em C, `int m[3][5]` é "array de 3 arrays de 5 ints". A recursão
      // simples imprimia as dimensões na ordem inversa (`int[5][3]`); aqui
      // achatamos da camada mais externa para a mais interna.
      const dims: number[] = [];
      let cur: CType = t;
      while (cur.kind === 'array') { dims.push(cur.size); cur = cur.of; }
      return typeName(cur) + dims.map(d => `[${d}]`).join('');
    }
  }
}

export function sizeOf(t: CType): number {
  switch (t.kind) {
    case 'char': return 1;
    case 'int': return 4;
    case 'float': return 4;
    case 'void': return 0;
    case 'pointer': return 4;
    case 'array': return t.size * sizeOf(t.of);
  }
}

export function elementType(t: CType): CType {
  if (t.kind === 'array') return t.of;
  if (t.kind === 'pointer') return t.to;
  throw new Error(`Tipo ${typeName(t)} não é indexável`);
}

// Snapshot serializável de uma variável (para a UI)
export interface VarSnapshot {
  name: string;
  type: string;
  address: number;
  // Para escalares: o valor primitivo. Para arrays/ponteiros: representação textual.
  value: string;
  // Se for array, decompõe em células visuais.
  cells?: CellSnapshot[];
  shape?: number[]; // dimensões (para arrays multi-dimensionais)
  scalar?: boolean;
  // Estados de foco no passo atual (apenas escalares).
  read?: boolean;
  written?: boolean;
  highlighted?: boolean;
}

export interface CellSnapshot {
  index: number[];      // ex.: [i, j]
  flatIndex: number;    // posição linear
  address: number;
  value: string;
  highlighted?: boolean;
  written?: boolean;
  read?: boolean;
}

export type StepStatus = 'running' | 'success' | 'error';

export interface Step {
  index: number;
  line: number;          // 1-based
  description: string;   // texto pt-BR explicando o que aconteceu
  scope: VarSnapshot[];  // variáveis visíveis no escopo
  output: string;        // stdout acumulada
  status: StepStatus;
  error?: string;
  // Pista para a UI: qual variável/célula está em foco
  focus?: { varName: string; cellIndex?: number[]; kind: 'read' | 'write' };
  // localStorage simulado (apenas para JavaScript)
  storage?: Record<string, string>;
}
