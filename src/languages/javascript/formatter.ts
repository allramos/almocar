// Formatador JavaScript minimalista — re-indentação por chaves.

const INDENT = '    ';

export function formatJavaScript(source: string): string {
  const raw = source.replace(/\r\n?/g, '\n').split('\n').map(l => l.replace(/\s+$/, ''));

  let depth = 0;
  let inBlockComment = false;
  const out: string[] = [];

  for (let i = 0; i < raw.length; i++) {
    const original = raw[i];
    const trimmed = original.trim();

    if (trimmed.length === 0) {
      out.push('');
      continue;
    }

    if (inBlockComment) {
      out.push(original);
      if (trimmed.includes('*/')) inBlockComment = false;
      continue;
    }

    const { open, close, closesFirst, opensBlockComment } = scanLine(trimmed);

    const effectiveDepth = Math.max(0, depth - closesFirst);
    const indent = INDENT.repeat(effectiveDepth);

    if (/^(case\s.+|default)\s*:/.test(trimmed)) {
      const labelDepth = Math.max(0, depth - 1);
      out.push(INDENT.repeat(labelDepth) + trimmed);
    } else {
      out.push(indent + trimmed);
    }

    depth += open - close;
    if (depth < 0) depth = 0;
    if (opensBlockComment) inBlockComment = true;
  }

  while (out.length > 1 && out[out.length - 1] === '') out.pop();
  return out.join('\n') + '\n';
}

interface LineScan {
  open: number;
  close: number;
  closesFirst: number;
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

    if (c === '/' && next === '/') break;
    if (c === '/' && next === '*') {
      const end = line.indexOf('*/', i + 2);
      if (end < 0) { opensBlockComment = true; break; }
      i = end + 2;
      continue;
    }
    if (c === '"') { i = skipString(line, i, '"'); continue; }
    if (c === "'") { i = skipString(line, i, "'"); continue; }
    if (c === '`') { i = skipString(line, i, '`'); continue; }

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
