import React, { useMemo, useRef } from 'react';

interface Props {
  source: string;
  activeLine?: number;
  editable: boolean;
  onChange?: (s: string) => void;
}

export function CodeView({ source, activeLine, editable, onChange }: Props) {
  const tokenizedLines = useMemo(() => tokenizeC(source), [source]);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);

  function syncScroll() {
    const ta = taRef.current; const pre = preRef.current;
    if (!ta || !pre) return;
    pre.style.transform = `translate(${-ta.scrollLeft}px, ${-ta.scrollTop}px)`;
  }

  // Tab → indentação de 4 espaços. Shift+Tab → des-indentar.
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== 'Tab') return;
    e.preventDefault();
    const ta = e.currentTarget;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const value = ta.value;
    const INDENT = '    ';

    // Sem seleção: insere INDENT na posição do cursor.
    if (start === end && !e.shiftKey) {
      const next = value.slice(0, start) + INDENT + value.slice(end);
      onChange?.(next);
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + INDENT.length;
      });
      return;
    }

    // Seleção: indenta/des-indenta cada linha selecionada.
    const lineStart = value.lastIndexOf('\n', start - 1) + 1;
    const lineEnd = end;
    const block = value.slice(lineStart, lineEnd);
    let newBlock: string;
    let delta = 0;
    let firstLineDelta = 0;
    if (e.shiftKey) {
      const lines = block.split('\n');
      newBlock = lines.map((l, i) => {
        if (l.startsWith(INDENT)) {
          if (i === 0) firstLineDelta = -INDENT.length;
          delta -= INDENT.length;
          return l.slice(INDENT.length);
        }
        if (l.startsWith('\t')) {
          if (i === 0) firstLineDelta = -1;
          delta -= 1;
          return l.slice(1);
        }
        return l;
      }).join('\n');
    } else {
      const lines = block.split('\n');
      newBlock = lines.map((l, i) => {
        if (i === 0) firstLineDelta = INDENT.length;
        delta += INDENT.length;
        return INDENT + l;
      }).join('\n');
    }
    const next = value.slice(0, lineStart) + newBlock + value.slice(lineEnd);
    onChange?.(next);
    requestAnimationFrame(() => {
      ta.selectionStart = start + firstLineDelta;
      ta.selectionEnd = end + delta;
    });
  }

  if (editable) {
    // Editor com sintaxe colorida via overlay.
    return (
      <div className="code-editor">
        <pre ref={preRef} className="code-overlay" aria-hidden>
          {tokenizedLines.map((tokens, i) => (
            <React.Fragment key={i}>
              {tokens.map((t, k) => (
                <span key={k} className={`tok tok-${t.kind}`}>{t.text}</span>
              ))}
              {'\n'}
            </React.Fragment>
          ))}
        </pre>
        <textarea
          ref={taRef}
          className="code-input"
          value={source}
          spellCheck={false}
          onChange={(e) => onChange?.(e.target.value)}
          onKeyDown={handleKeyDown}
          onScroll={syncScroll}
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
        />
      </div>
    );
  }

  // Modo de execução: linhas numeradas + linha ativa destacada.
  return (
    <div className="w-full h-full overflow-auto py-3">
      {tokenizedLines.map((tokens, i) => {
        const ln = i + 1;
        const active = ln === activeLine;
        return (
          <div key={i} className={`code-line ${active ? 'active' : ''}`}>
            <span className="num">{ln}</span>
            <span className="flex-1 pr-4">
              {tokens.length === 0 ? ' ' : tokens.map((t, k) => (
                <span key={k} className={`tok tok-${t.kind}`}>{t.text}</span>
              ))}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// =====================================================================
// Tokenizador C minimalista
// =====================================================================

type TokKind = 'kw' | 'type' | 'num' | 'str' | 'chr' | 'cmt' | 'pre' | 'fn' | 'op' | 'pun' | 'id' | 'ws';
interface Tok { kind: TokKind; text: string; }

const KEYWORDS = new Set([
  'if','else','for','while','do','return','break','continue','switch','case','default',
  'struct','union','enum','typedef','sizeof','goto','static','extern','const','volatile','register','inline',
]);
const TYPES = new Set([
  'int','float','double','char','void','long','short','unsigned','signed','bool','size_t','FILE',
]);
const PUNCT = new Set(['(',')','{','}','[',']',',',';',':','?']);
const OP_CHARS = '+-*/%=<>!&|^~';

function tokenizeC(source: string): Tok[][] {
  const lines = source.split('\n');
  const result: Tok[][] = [];
  let inBlockComment = false;
  for (const line of lines) {
    const [tokens, stillInComment] = tokenizeLine(line, inBlockComment);
    result.push(tokens);
    inBlockComment = stillInComment;
  }
  return result;
}

function tokenizeLine(line: string, inBlockComment: boolean): [Tok[], boolean] {
  const out: Tok[] = [];
  let i = 0;

  // Continuação de comentário de bloco de linhas anteriores
  if (inBlockComment) {
    const end = line.indexOf('*/', i);
    if (end >= 0) {
      out.push({ kind: 'cmt', text: line.slice(i, end + 2) });
      i = end + 2;
      inBlockComment = false;
    } else {
      out.push({ kind: 'cmt', text: line.slice(i) });
      return [out, true];
    }
  }

  const trimmedStart = line.slice(i).match(/^(\s*)(#.*)$/);
  if (trimmedStart) {
    if (trimmedStart[1]) out.push({ kind: 'ws', text: trimmedStart[1] });
    out.push({ kind: 'pre', text: trimmedStart[2] });
    return [out, false];
  }
  while (i < line.length) {
    const c = line[i];
    if (c === ' ' || c === '\t') {
      let j = i;
      while (j < line.length && (line[j] === ' ' || line[j] === '\t')) j++;
      out.push({ kind: 'ws', text: line.slice(i, j) });
      i = j;
      continue;
    }
    if (c === '/' && line[i + 1] === '/') {
      out.push({ kind: 'cmt', text: line.slice(i) });
      i = line.length;
      continue;
    }
    if (c === '/' && line[i + 1] === '*') {
      const end = line.indexOf('*/', i + 2);
      if (end >= 0) {
        out.push({ kind: 'cmt', text: line.slice(i, end + 2) });
        i = end + 2;
        continue;
      } else {
        out.push({ kind: 'cmt', text: line.slice(i) });
        return [out, true];
      }
    }
    if (c === '"') {
      let j = i + 1;
      while (j < line.length && line[j] !== '"') {
        if (line[j] === '\\' && j + 1 < line.length) j += 2;
        else j++;
      }
      out.push({ kind: 'str', text: line.slice(i, Math.min(j + 1, line.length)) });
      i = j + 1;
      continue;
    }
    if (c === "'") {
      let j = i + 1;
      while (j < line.length && line[j] !== "'") {
        if (line[j] === '\\' && j + 1 < line.length) j += 2;
        else j++;
      }
      out.push({ kind: 'chr', text: line.slice(i, Math.min(j + 1, line.length)) });
      i = j + 1;
      continue;
    }
    if (/[0-9]/.test(c)) {
      let j = i;
      while (j < line.length && /[0-9.xXa-fA-F]/.test(line[j])) j++;
      out.push({ kind: 'num', text: line.slice(i, j) });
      i = j;
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i;
      while (j < line.length && /[A-Za-z0-9_]/.test(line[j])) j++;
      const word = line.slice(i, j);
      let kind: TokKind = 'id';
      if (KEYWORDS.has(word)) kind = 'kw';
      else if (TYPES.has(word)) kind = 'type';
      else if (line[j] === '(') kind = 'fn';
      out.push({ kind, text: word });
      i = j;
      continue;
    }
    if (PUNCT.has(c)) {
      out.push({ kind: 'pun', text: c });
      i++;
      continue;
    }
    if (OP_CHARS.includes(c)) {
      let j = i;
      while (j < line.length && OP_CHARS.includes(line[j])) j++;
      out.push({ kind: 'op', text: line.slice(i, j) });
      i = j;
      continue;
    }
    out.push({ kind: 'id', text: c });
    i++;
  }
  return [out, false];
}
