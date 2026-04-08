// Lexer para Portugol Studio (subset didático).

export type TokenKind =
  | 'IDENT' | 'INT' | 'FLOAT' | 'CHAR' | 'STRING' | 'KEYWORD' | 'PUNCT' | 'EOF';

export interface Token {
  kind: TokenKind;
  value: string;
  line: number;
  col: number;
}

const KEYWORDS = new Set([
  'programa', 'funcao', 'vazio',
  'inteiro', 'real', 'caractere', 'logico', 'cadeia',
  'se', 'senao',
  'para', 'enquanto', 'faca',
  'escolha', 'caso', 'contrario',
  'retorne', 'pare', 'continue',
  'verdadeiro', 'falso',
  'e', 'ou', 'nao',
  'const',
  'escreva', 'escreval', 'leia',
]);

const PUNCT_2 = [
  '==', '!=', '<=', '>=', '&&', '||',
  '++', '--', '+=', '-=', '*=', '/=', '%=',
];
const PUNCT_1 = '+-*/%=<>!?:.,;()[]{}';

export function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0, line = 1, col = 1;
  const n = source.length;

  const at = (k = 0) => source[i + k];
  const advance = (k = 1) => {
    for (let j = 0; j < k; j++) {
      if (source[i] === '\n') { line++; col = 1; } else { col++; }
      i++;
    }
  };

  while (i < n) {
    const ch = at();

    // Espaços
    if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') { advance(); continue; }

    // Comentário de linha
    if (ch === '/' && at(1) === '/') {
      while (i < n && at() !== '\n') advance();
      continue;
    }
    // Comentário de bloco
    if (ch === '/' && at(1) === '*') {
      advance(2);
      while (i < n && !(at() === '*' && at(1) === '/')) advance();
      if (i < n) advance(2);
      continue;
    }

    const startLine = line, startCol = col;

    // Identificador / palavra-chave
    if (isIdentStart(ch)) {
      let s = '';
      while (i < n && isIdentCont(at())) { s += at(); advance(); }
      // Mapeamento de operadores textuais para pontuação
      if (s === 'e') {
        tokens.push({ kind: 'PUNCT', value: '&&', line: startLine, col: startCol });
        continue;
      }
      if (s === 'ou') {
        tokens.push({ kind: 'PUNCT', value: '||', line: startLine, col: startCol });
        continue;
      }
      if (s === 'nao') {
        tokens.push({ kind: 'PUNCT', value: '!', line: startLine, col: startCol });
        continue;
      }
      if (s === 'verdadeiro') {
        tokens.push({ kind: 'INT', value: '1', line: startLine, col: startCol });
        continue;
      }
      if (s === 'falso') {
        tokens.push({ kind: 'INT', value: '0', line: startLine, col: startCol });
        continue;
      }
      tokens.push({
        kind: KEYWORDS.has(s) ? 'KEYWORD' : 'IDENT',
        value: s, line: startLine, col: startCol,
      });
      continue;
    }

    // Número
    if (isDigit(ch) || (ch === '.' && i + 1 < n && isDigit(at(1)))) {
      let s = '';
      let isFloat = false;
      while (i < n && isDigit(at())) { s += at(); advance(); }
      if (i < n && at() === '.') {
        isFloat = true;
        s += '.'; advance();
        while (i < n && isDigit(at())) { s += at(); advance(); }
      }
      tokens.push({ kind: isFloat ? 'FLOAT' : 'INT', value: s, line: startLine, col: startCol });
      continue;
    }

    // String
    if (ch === '"') {
      advance();
      let s = '';
      while (i < n && at() !== '"') {
        if (at() === '\\' && i + 1 < n) {
          const e = at(1);
          advance(2);
          switch (e) {
            case 'n': s += '\n'; break;
            case 't': s += '\t'; break;
            case 'r': s += '\r'; break;
            case '0': s += '\0'; break;
            case '\\': s += '\\'; break;
            case '"': s += '"'; break;
            default: s += e;
          }
        } else { s += at(); advance(); }
      }
      if (i < n && at() === '"') advance();
      tokens.push({ kind: 'STRING', value: s, line: startLine, col: startCol });
      continue;
    }

    // Char literal
    if (ch === "'") {
      advance();
      let v = 0;
      if (i < n && at() === '\\') {
        advance();
        const e = at(); advance();
        const map: Record<string, number> = { n: 10, t: 9, r: 13, '0': 0, '\\': 92, "'": 39, '"': 34 };
        v = map[e] ?? e.charCodeAt(0);
      } else if (i < n) { v = at().charCodeAt(0); advance(); }
      if (i < n && at() === "'") advance();
      tokens.push({ kind: 'CHAR', value: String(v), line: startLine, col: startCol });
      continue;
    }

    // Pontuação multi-char
    let matched = false;
    for (const p of PUNCT_2) {
      if (source.startsWith(p, i)) {
        tokens.push({ kind: 'PUNCT', value: p, line: startLine, col: startCol });
        advance(p.length); matched = true; break;
      }
    }
    if (matched) continue;
    if (PUNCT_1.includes(ch)) {
      tokens.push({ kind: 'PUNCT', value: ch, line: startLine, col: startCol });
      advance(); continue;
    }

    throw new SyntaxError(`Caractere inesperado '${ch}' na linha ${line}, coluna ${col}`);
  }

  tokens.push({ kind: 'EOF', value: '', line, col });
  return tokens;
}

function isIdentStart(c: string) { return /[a-zA-Z_\u00C0-\u024F]/.test(c); }
function isIdentCont(c: string)  { return /[a-zA-Z0-9_\u00C0-\u024F]/.test(c); }
function isDigit(c: string)      { return c >= '0' && c <= '9'; }
