// Modelo de memória plana usado pelo interpretador.
// Cada "endereço" é um índice em um array. Variáveis ocupam uma faixa contígua.

import { CType, sizeOf, typeName } from './types';

export class Memory {
  // valores armazenados — números (int/float/char) ou ponteiros (endereços)
  cells: (number | undefined)[] = [];
  next = 0;

  alloc(type: CType): number {
    const size = sizeOf(type);
    const addr = this.next;
    for (let k = 0; k < size; k++) this.cells.push(0);
    this.next += size;
    return addr;
  }

  // No nosso modelo, cada "célula primitiva" mora em uma posição (e não em N bytes).
  // Isso simplifica drasticamente: 1 unidade lógica = 1 valor.
  allocLogical(count: number): number {
    const addr = this.next;
    for (let k = 0; k < count; k++) this.cells.push(0);
    this.next += count;
    return addr;
  }

  read(addr: number): number {
    if (addr < 0 || addr >= this.cells.length) {
      throw new Error(`Acesso inválido de memória no endereço ${addr}`);
    }
    return this.cells[addr] ?? 0;
  }

  write(addr: number, value: number): void {
    if (addr < 0 || addr >= this.cells.length) {
      throw new Error(`Escrita inválida de memória no endereço ${addr}`);
    }
    this.cells[addr] = value;
  }
}

// Conta quantas células lógicas o tipo ocupa (cada elemento primitivo conta como 1).
export function logicalSize(type: CType): number {
  switch (type.kind) {
    case 'array': return type.size * logicalSize(type.of);
    default: return 1;
  }
}

// Calcula deslocamento para um índice multi-dimensional.
export function offsetOf(arrType: CType, indices: number[]): number {
  let offset = 0;
  let t: CType = arrType;
  for (const i of indices) {
    if (t.kind !== 'array') throw new Error(`Indexação demais em ${typeName(arrType)}`);
    if (i < 0 || i >= t.size) throw new Error(`Índice ${i} fora dos limites [0, ${t.size - 1}]`);
    offset += i * logicalSize(t.of);
    t = t.of;
  }
  return offset;
}

// Retorna as dimensões de um array (ex.: int[3][5] => [3,5]).
export function arrayDims(t: CType): number[] {
  const dims: number[] = [];
  let cur: CType = t;
  while (cur.kind === 'array') { dims.push(cur.size); cur = cur.of; }
  return dims;
}

// Retorna o tipo escalar interno de um array.
export function arrayElementBase(t: CType): CType {
  let cur: CType = t;
  while (cur.kind === 'array') cur = cur.of;
  return cur;
}
