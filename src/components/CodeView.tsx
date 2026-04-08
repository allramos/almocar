import React, { useMemo, useRef } from 'react';
import type { HighlightConfig, Tok } from '../languages';

interface Props {
  source: string;
  activeLine?: number;
  errorLine?: number;
  editable: boolean;
  onChange?: (s: string) => void;
  onFormat?: () => void;
  highlight: HighlightConfig;
  fontSize?: number;
}

export function CodeView({ source, activeLine, errorLine, editable, onChange, onFormat, highlight, fontSize = 12.5 }: Props) {
  const tokenizedLines = useMemo(() => highlight.tokenize(source), [source, highlight]);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);

  function syncScroll() {
    const ta = taRef.current; const pre = preRef.current; const gutter = gutterRef.current;
    if (!ta || !pre) return;
    pre.style.transform = `translate(${-ta.scrollLeft}px, ${-ta.scrollTop}px)`;
    if (gutter) gutter.style.transform = `translateY(${-ta.scrollTop}px)`;
  }

  // Atalhos do editor:
  // Tab / Shift+Tab → indentar / des-indentar
  // Ctrl+Shift+F → formatar código
  // Ctrl+Shift+K → remover linha(s)
  // Ctrl+; → comentar/descomentar linha(s)
  // Alt+↑/↓ → mover linha(s)
  // Shift+Alt+↑/↓ → copiar linha(s)
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    const ta = e.currentTarget;
    const value = ta.value;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;

    // Alt+Shift+F → formatar
    if ((e.altKey || e.metaKey) && e.shiftKey && e.key === 'F') {
      e.preventDefault();
      onFormat?.();
      return;
    }

    // Ctrl+Shift+K → remover linha(s)
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'K') {
      e.preventDefault();
      const lineStart = value.lastIndexOf('\n', start - 1) + 1;
      let lineEnd = value.indexOf('\n', end);
      if (lineEnd < 0) lineEnd = value.length;
      else lineEnd += 1; // inclui o \n
      // Se apagou até o fim e sobrou \n antes, remove-o.
      const newText = lineStart === 0 && lineEnd >= value.length
        ? ''
        : value.slice(0, lineStart) + value.slice(lineEnd);
      onChange?.(newText);
      requestAnimationFrame(() => {
        const pos = Math.min(lineStart, newText.length);
        ta.selectionStart = ta.selectionEnd = pos;
      });
      return;
    }

    // Ctrl+; → comentar/descomentar linha(s)
    if ((e.ctrlKey || e.metaKey) && e.key === ';') {
      e.preventDefault();
      const lineStart = value.lastIndexOf('\n', start - 1) + 1;
      let lineEnd = value.indexOf('\n', end);
      if (lineEnd < 0) lineEnd = value.length;
      const block = value.slice(lineStart, lineEnd);
      const lines = block.split('\n');
      // Se todas as linhas (não-vazias) começam com "//", descomenta; senão, comenta.
      const allCommented = lines.every(l => l.trimStart() === '' || l.trimStart().startsWith('//'));
      let newBlock: string;
      let firstDelta = 0;
      let totalDelta = 0;
      if (allCommented) {
        // Descomentar: remove o primeiro "// " ou "//" de cada linha.
        newBlock = lines.map((l, i) => {
          const idx = l.indexOf('//');
          if (idx < 0) return l;
          const hasSpace = l[idx + 2] === ' ';
          const removed = hasSpace ? 3 : 2;
          if (i === 0) firstDelta = -removed;
          totalDelta -= removed;
          return l.slice(0, idx) + l.slice(idx + removed);
        }).join('\n');
      } else {
        // Comentar: insere "// " após a indentação de cada linha.
        // Calcula a menor indentação entre linhas não-vazias.
        let minIndent = Infinity;
        for (const l of lines) {
          if (l.trim().length === 0) continue;
          const indent = l.match(/^\s*/)?.[0].length ?? 0;
          if (indent < minIndent) minIndent = indent;
        }
        if (!Number.isFinite(minIndent)) minIndent = 0;
        newBlock = lines.map((l, i) => {
          if (l.trim().length === 0) return l;
          const result = l.slice(0, minIndent) + '// ' + l.slice(minIndent);
          if (i === 0) firstDelta = 3;
          totalDelta += 3;
          return result;
        }).join('\n');
      }
      const newText = value.slice(0, lineStart) + newBlock + value.slice(lineEnd);
      onChange?.(newText);
      requestAnimationFrame(() => {
        ta.selectionStart = Math.max(lineStart, start + firstDelta);
        ta.selectionEnd = Math.max(lineStart, end + totalDelta);
      });
      return;
    }

    // Alt+↑/↓ → mover linhas | Shift+Alt+↑/↓ → copiar linhas
    if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      const up = e.key === 'ArrowUp';
      const copy = e.shiftKey;

      // Encontra limites das linhas selecionadas.
      const lineStart = value.lastIndexOf('\n', start - 1) + 1;
      let lineEnd = value.indexOf('\n', end);
      if (lineEnd < 0) lineEnd = value.length;

      const block = value.slice(lineStart, lineEnd);

      if (copy) {
        // Copiar: duplica o bloco na direção indicada.
        const newText = up
          ? value.slice(0, lineStart) + block + '\n' + value.slice(lineStart)
          : value.slice(0, lineEnd) + '\n' + block + value.slice(lineEnd);
        onChange?.(newText);
        if (up) {
          // Cursor permanece nas linhas originais (que agora estão abaixo).
          requestAnimationFrame(() => {
            ta.selectionStart = start;
            ta.selectionEnd = end;
          });
        } else {
          // Cursor vai para as linhas copiadas abaixo.
          const offset = lineEnd - lineStart + 1;
          requestAnimationFrame(() => {
            ta.selectionStart = start + offset;
            ta.selectionEnd = end + offset;
          });
        }
      } else {
        // Mover: troca o bloco com a linha adjacente.
        if (up) {
          if (lineStart === 0) return; // já é a primeira linha
          const prevLineStart = value.lastIndexOf('\n', lineStart - 2) + 1;
          const prevLine = value.slice(prevLineStart, lineStart - 1);
          const newText = value.slice(0, prevLineStart) + block + '\n' + prevLine + value.slice(lineEnd);
          onChange?.(newText);
          const shift = lineStart - prevLineStart;
          requestAnimationFrame(() => {
            ta.selectionStart = start - shift;
            ta.selectionEnd = end - shift;
          });
        } else {
          if (lineEnd >= value.length) return; // já é a última linha
          const nextLineEnd = value.indexOf('\n', lineEnd + 1);
          const nextEnd = nextLineEnd < 0 ? value.length : nextLineEnd;
          const nextLine = value.slice(lineEnd + 1, nextEnd);
          const newText = value.slice(0, lineStart) + nextLine + '\n' + block + value.slice(nextEnd);
          onChange?.(newText);
          const shift = nextEnd - lineEnd;
          requestAnimationFrame(() => {
            ta.selectionStart = start + shift;
            ta.selectionEnd = end + shift;
          });
        }
      }
      return;
    }

    // Auto-closing: parênteses, colchetes, chaves, aspas
    const pairs: Record<string, string> = { '(': ')', '[': ']', '{': '}', '"': '"', "'": "'" };
    const closing = pairs[e.key];
    if (closing && start === end) {
      e.preventDefault();
      const newText = value.slice(0, start) + e.key + closing + value.slice(end);
      onChange?.(newText);
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + 1;
      });
      return;
    }
    // Pular o caractere de fechamento se já está na frente do cursor
    if (')]}"\''.includes(e.key) && start === end && value[start] === e.key) {
      e.preventDefault();
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + 1;
      });
      return;
    }
    // Backspace: remover par se cursor está entre par de caracteres
    if (e.key === 'Backspace' && start === end && start > 0) {
      const charBefore = value[start - 1];
      const charAfter = value[start];
      if (pairs[charBefore] && pairs[charBefore] === charAfter) {
        e.preventDefault();
        const newText = value.slice(0, start - 1) + value.slice(start + 1);
        onChange?.(newText);
        requestAnimationFrame(() => {
          ta.selectionStart = ta.selectionEnd = start - 1;
        });
        return;
      }
    }

    // Enter após '{' → auto-fechar com '}'
    if (e.key === 'Enter') {
      const before = value.slice(0, start);
      const after = value.slice(end);
      const charBefore = before.trimEnd().slice(-1);
      if (charBefore === '{') {
        e.preventDefault();
        // Calcula indentação da linha atual.
        const lineStart = before.lastIndexOf('\n') + 1;
        const currentLine = before.slice(lineStart);
        const indent = currentLine.match(/^\s*/)?.[0] ?? '';
        const inner = indent + '    ';
        const newText = before + '\n' + inner + '\n' + indent + '}' + after;
        onChange?.(newText);
        const cursorPos = before.length + 1 + inner.length;
        requestAnimationFrame(() => {
          ta.selectionStart = ta.selectionEnd = cursorPos;
        });
        return;
      }
    }

    // Tab / Shift+Tab → indentação
    if (e.key !== 'Tab') return;
    e.preventDefault();
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
    const lineCount = tokenizedLines.length;
    const lineH = Math.round(fontSize * 1.6);
    const fontStyle = { fontSize: `${fontSize}px`, lineHeight: `${lineH}px` };
    return (
      <div className="code-editor" style={fontStyle}>
        <div className="code-gutter" ref={gutterRef}>
          {Array.from({ length: lineCount }, (_, i) => (
            <div key={i} className={`code-gutter-num${i + 1 === errorLine ? ' error' : ''}`} style={{ height: lineH, lineHeight: `${lineH}px`, fontSize: `${fontSize - 1.5}px` }}>{i + 1}</div>
          ))}
        </div>
        <div className="code-editor-body">
          <pre ref={preRef} className="code-overlay" aria-hidden>
            {tokenizedLines.map((tokens, i) => {
              const ln = i + 1;
              const hasError = ln === errorLine;
              return (
                <span key={i} className={hasError ? 'code-error-line' : undefined}>
                  {tokens.map((t, k) => (
                    <span key={k} className={`tok tok-${t.kind}`}>{t.text}</span>
                  ))}
                  {'\n'}
                </span>
              );
            })}
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
      </div>
    );
  }

  // Modo de execução: linhas numeradas + linha ativa destacada.
  const lineH = Math.round(fontSize * 1.6);
  const fontStyle = { fontSize: `${fontSize}px`, lineHeight: `${lineH}px` };
  return (
    <div className="w-full h-full overflow-auto py-3">
      {tokenizedLines.map((tokens, i) => {
        const ln = i + 1;
        const active = ln === activeLine;
        const hasError = ln === errorLine;
        return (
          <div key={i} className={`code-line ${active ? 'active' : ''} ${hasError ? 'error' : ''}`} style={fontStyle}>
            <span className="num" style={{ fontSize: `${fontSize - 1.5}px` }}>{ln}</span>
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

