// Formatador C minimalista — re-indentação por chaves.
// Não tenta ser um clang-format completo: apenas normaliza indentação,
// remove espaços à direita e preserva strings/comentários como literais.

const INDENT = '    ';

export function formatC(source: string): string {
  // Pré-processa: normaliza CRLF e remove trailing whitespace.
  const raw = source.replace(/\r\n?/g, '\n').split('\n').map(l => l.replace(/\s+$/, ''));

  let depth = 0;
  let inBlockComment = false;
  let bracelessIndent = false; // próxima linha recebe +1 indent (for/while/if sem chaves)
  const out: string[] = [];

  for (let i = 0; i < raw.length; i++) {
    const original = raw[i];
    const trimmed = original.trim();

    // Linhas em branco: preserva mas sem indentação.
    if (trimmed.length === 0) {
      out.push('');
      continue;
    }

    // Se estamos dentro de um comentário de bloco, preserva linha original.
    if (inBlockComment) {
      out.push(original);
      if (trimmed.includes('*/')) inBlockComment = false;
      continue;
    }

    // Diretivas de pré-processador sempre coladas à esquerda.
    if (trimmed.startsWith('#')) {
      out.push(trimmed);
      continue;
    }

    // Conta chaves *fora* de strings/char/comentários para ajustar profundidade.
    const { open, close, closesFirst, opensBlockComment } = scanLine(trimmed);

    // Se a linha começa fechando bloco(s), reduz indentação antes de imprimir.
    const effectiveDepth = Math.max(0, depth - closesFirst) + (bracelessIndent ? 1 : 0);
    const indent = INDENT.repeat(effectiveDepth);

    // Consome o indent temporário (vale só para 1 linha)
    if (bracelessIndent) bracelessIndent = false;

    // Caso especial: rótulos de case/default e labels com `:` no fim,
    // costumam ficar um nível à esquerda do bloco.
    if (/^(case\s.+|default)\s*:/.test(trimmed)) {
      const labelDepth = Math.max(0, depth - 1);
      out.push(INDENT.repeat(labelDepth) + trimmed);
    } else {
      out.push(indent + trimmed);
    }

    depth += open - close;
    if (depth < 0) depth = 0;
    if (opensBlockComment) inBlockComment = true;

    // Detecta for/while/if/else sem chaves → próxima linha indenta
    if (open === 0 && close === 0) {
      if (/^(for|while|if|else\s+if)\s*\(.*\)\s*$/.test(trimmed)
          || /^else\s*$/.test(trimmed)) {
        bracelessIndent = true;
      }
    }
  }

  // Garante exatamente uma quebra final.
  while (out.length > 1 && out[out.length - 1] === '') out.pop();
  return out.join('\n') + '\n';
}

interface LineScan {
  open: number;          // chaves abertas no total da linha
  close: number;         // chaves fechadas no total da linha
  closesFirst: number;   // fechamentos antes de qualquer abertura (afetam indent da própria linha)
  opensBlockComment: boolean;
}

function scanLine(line: string): LineScan {
  let open = 0, close = 0, closesFirst = 0;
  let sawOpen = false;
  let opensBlockComment = false;

  let i = 0;
  while (i < line.length) {
    const c = line[i];
    const next = line[i + 1];

    // Linha de comentário: ignora restante.
    if (c === '/' && next === '/') break;

    // Comentário de bloco.
    if (c === '/' && next === '*') {
      const end = line.indexOf('*/', i + 2);
      if (end < 0) { opensBlockComment = true; break; }
      i = end + 2;
      continue;
    }

    // String literal.
    if (c === '"') { i = skipString(line, i, '"'); continue; }
    if (c === "'") { i = skipString(line, i, "'"); continue; }

    if (c === '{') {
      open++;
      sawOpen = true;
    } else if (c === '}') {
      close++;
      if (!sawOpen) closesFirst++;
    }
    i++;
  }
  return { open, close, closesFirst, opensBlockComment };
}

function skipString(line: string, start: number, quote: string): number {
  let i = start + 1;
  while (i < line.length && line[i] !== quote) {
    if (line[i] === '\\' && i + 1 < line.length) i += 2;
    else i++;
  }
  return i + 1;
}
