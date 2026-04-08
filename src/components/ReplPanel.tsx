import React, { useEffect, useRef, useState } from 'react';
import { compileAndRun } from '../interpreter';
import type { Language } from '../languages';
import type { VarSnapshot } from '../interpreter';

interface ReplEntry {
  input: string;
  output: string | null;
  error: string | null;
}

interface Props {
  language: Language;
  fontSize?: number;
  onChangeFontSize?: (delta: number) => void;
  onScopeChange?: (scope: VarSnapshot[], storage?: Record<string, string>) => void;
}

function isExpressionLine(line: string): boolean {
  const trimmed = line.trim().replace(/;$/, '');
  if (!trimmed) return false;
  if (/^(let |const |var |function |if |for |while |do |return |break|continue|\/\/)/.test(trimmed)) return false;
  if (/^[a-zA-Z_$][\w$.]*(\[.*\])?\s*(\+|-|\*|\/|%)?=$/.test(trimmed)) return false;
  if (/^[a-zA-Z_$][\w$.]*(\[.*\])?\s*=\s/.test(trimmed)) return false;
  if (/^console\.log\s*\(/.test(trimmed)) return false;
  if (/^[a-zA-Z_$][\w$.]*(\[.*\])?\s*(\+|-|\*|\/|%)=/.test(trimmed)) return false;
  if (/^[a-zA-Z_$][\w$.]*\s*(\+\+|--)$/.test(trimmed)) return false;
  if (/^(\+\+|--)[a-zA-Z_$]/.test(trimmed)) return false;
  return true;
}

/** Checa se os delimitadores estão balanceados (para detectar bloco incompleto) */
function isIncomplete(code: string): boolean {
  let parens = 0, brackets = 0, braces = 0;
  let inStr: string | null = null;
  for (let i = 0; i < code.length; i++) {
    const ch = code[i];
    if (inStr) {
      if (ch === '\\') { i++; continue; }
      if (ch === inStr) inStr = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { inStr = ch; continue; }
    if (ch === '(') parens++;
    else if (ch === ')') parens--;
    else if (ch === '[') brackets++;
    else if (ch === ']') brackets--;
    else if (ch === '{') braces++;
    else if (ch === '}') braces--;
  }
  return parens > 0 || brackets > 0 || braces > 0 || inStr !== null;
}

export function ReplPanel({ language, fontSize = 12.5, onChangeFontSize, onScopeChange }: Props) {
  const [history, setHistory] = useState<ReplEntry[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [cmdIndex, setCmdIndex] = useState(-1);
  const [savedInput, setSavedInput] = useState('');
  const taRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const accCodeRef = useRef<string[]>([]);
  const storageRef = useRef<Record<string, string>>({});

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history, inputValue]);

  useEffect(() => {
    taRef.current?.focus();
  }, []);

  // Redimensiona o textarea automaticamente
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = '0';
    ta.style.height = `${ta.scrollHeight}px`;
  }, [inputValue, fontSize]);

  function execute(code: string) {
    setCmdHistory(prev => [...prev, code]);
    setCmdIndex(-1);
    setSavedInput('');
    setInputValue('');

    const prevCode = accCodeRef.current.join('\n');
    const lines = code.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const lastLine = lines[lines.length - 1] || '';
    const isExpr = lines.length === 1 && isExpressionLine(lastLine);
    const execCode = isExpr ? `console.log(${code.trim().replace(/;$/, '')});` : code;
    const fullCode = prevCode ? `${prevCode}\n${execCode}` : execCode;

    const result = compileAndRun(fullCode, language, {
      inputs: '',
      requestMoreInput: () => null,
      initialStorage: storageRef.current,
    });

    if (result.ok || (result.steps.length > 0 && result.steps[result.steps.length - 1].status !== 'error')) {
      const stored = execCode.endsWith(';') || execCode.endsWith('}') ? execCode : `${execCode};`;
      accCodeRef.current.push(stored);
      if (result.finalStorage) storageRef.current = result.finalStorage;
      const prevOutput = history.reduce((acc, e) => acc + (e.output ?? ''), '');
      const newOutput = result.output.slice(prevOutput.length) || null;
      setHistory(prev => [...prev, { input: code, output: newOutput, error: null }]);
      if (onScopeChange) {
        const lastStep = result.steps[result.steps.length - 1];
        onScopeChange(lastStep?.scope ?? [], lastStep?.storage);
      }
    } else {
      setHistory(prev => [...prev, { input: code, output: null, error: result.error ?? 'Erro desconhecido' }]);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    const ta = e.currentTarget;
    const value = ta.value;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;

    // Enter (sem Shift): enviar se código está completo
    if (e.key === 'Enter' && !e.shiftKey) {
      const trimmed = value.trim();
      if (trimmed && !isIncomplete(trimmed)) {
        e.preventDefault();
        execute(trimmed);
        return;
      }
      // Se incompleto, Enter insere nova linha normalmente (como Shift+Enter)
    }

    // Ctrl+L: limpar console
    if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
      e.preventDefault();
      handleClear();
      return;
    }

    // Tab: inserir 2 espaços
    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      const newVal = value.slice(0, start) + '  ' + value.slice(end);
      setInputValue(newVal);
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + 2;
      });
      return;
    }

    // ArrowUp no início: navegar histórico para trás
    if (e.key === 'ArrowUp' && start === 0 && end === 0) {
      if (cmdHistory.length === 0) return;
      e.preventDefault();
      if (cmdIndex < 0) setSavedInput(value);
      const newIdx = cmdIndex < 0 ? cmdHistory.length - 1 : Math.max(0, cmdIndex - 1);
      setCmdIndex(newIdx);
      setInputValue(cmdHistory[newIdx]);
      return;
    }

    // ArrowDown no final: navegar histórico para frente
    if (e.key === 'ArrowDown' && start === value.length && end === value.length) {
      if (cmdIndex < 0) return;
      e.preventDefault();
      const newIdx = cmdIndex + 1;
      if (newIdx >= cmdHistory.length) {
        setCmdIndex(-1);
        setInputValue(savedInput);
      } else {
        setCmdIndex(newIdx);
        setInputValue(cmdHistory[newIdx]);
      }
      return;
    }

    // Escape: limpar input
    if (e.key === 'Escape') {
      e.preventDefault();
      setInputValue('');
      setCmdIndex(-1);
      return;
    }

    // Auto-closing de delimitadores
    const pairs: Record<string, string> = { '(': ')', '[': ']', '{': '}', '"': '"', "'": "'" };
    const closing = pairs[e.key];
    if (closing && start === end) {
      e.preventDefault();
      const newVal = value.slice(0, start) + e.key + closing + value.slice(end);
      setInputValue(newVal);
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + 1;
      });
      return;
    }
    if (')]}"\''.includes(e.key) && start === end && value[start] === e.key) {
      e.preventDefault();
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + 1;
      });
      return;
    }
    if (e.key === 'Backspace' && start === end && start > 0) {
      const charBefore = value[start - 1];
      const charAfter = value[start];
      if (pairs[charBefore] && pairs[charBefore] === charAfter) {
        e.preventDefault();
        const newVal = value.slice(0, start - 1) + value.slice(start + 1);
        setInputValue(newVal);
        requestAnimationFrame(() => {
          ta.selectionStart = ta.selectionEnd = start - 1;
        });
        return;
      }
    }
  }

  function handleClear() {
    setHistory([]);
    accCodeRef.current = [];
    storageRef.current = {};
    setCmdHistory([]);
    setCmdIndex(-1);
    setSavedInput('');
    setInputValue('');
    if (onScopeChange) onScopeChange([], undefined);
  }

  function handleContainerClick(e: React.MouseEvent) {
    if (e.target !== taRef.current) {
      taRef.current?.focus();
    }
  }

  const lineH = Math.round(fontSize * 1.6);
  const isMultiline = inputValue.includes('\n');

  return (
    <div className="panel code-panel flex flex-col h-full">
      <div className="panel-title">
        <span className="chapter">I</span>
        <span className="label">Console</span>
        <span className="meta">REPL interativo</span>
        <span className="flex items-center gap-1 ml-auto">
          <button
            onClick={() => onChangeFontSize?.(-1)}
            className="panel-action"
            title="Diminuir fonte"
            style={{ padding: '0 5px', minWidth: 0 }}
          >
            A−
          </button>
          <span className="text-[10px] tabular-nums text-ink-mute" style={{ minWidth: 28, textAlign: 'center' }}>
            {fontSize}px
          </span>
          <button
            onClick={() => onChangeFontSize?.(1)}
            className="panel-action"
            title="Aumentar fonte"
            style={{ padding: '0 5px', minWidth: 0 }}
          >
            A+
          </button>
        </span>
        <button onClick={handleClear} className="panel-action" title="Limpar console (Ctrl+L)">
          Limpar
        </button>
      </div>

      <div
        ref={scrollRef}
        className="repl-body flex-1 min-h-0 overflow-auto font-mono"
        onClick={handleContainerClick}
        style={{ fontSize: `${fontSize}px`, lineHeight: `${lineH}px`, padding: '8px 12px' }}
      >
        {history.map((entry, i) => (
          <div key={i} className="repl-entry">
            {entry.input.split('\n').map((line, j) => (
              <div key={j} className="repl-input-line">
                <span className="repl-prompt">{j === 0 ? '> ' : '... '}</span>
                <span className="repl-code">{line}</span>
              </div>
            ))}
            {entry.output && (
              <div className="repl-output">{entry.output}</div>
            )}
            {entry.error && (
              <div className="repl-error">{entry.error}</div>
            )}
          </div>
        ))}

        {/* Área de input atual */}
        <div className="repl-input-area">
          <span className="repl-prompt repl-prompt-input">{isMultiline ? '...' : '>'} </span>
          <textarea
            ref={taRef}
            className="repl-input"
            value={inputValue}
            onChange={(e) => { setInputValue(e.target.value); setCmdIndex(-1); }}
            onKeyDown={handleKeyDown}
            rows={1}
            spellCheck={false}
            autoComplete="off"
            placeholder="Digite uma expressão..."
            style={{ fontSize: `${fontSize}px`, lineHeight: `${lineH}px` }}
          />
        </div>

        {history.length === 0 && !inputValue && (
          <div className="repl-hint">
            <div>Dica: expressões são avaliadas automaticamente.</div>
            <div><kbd>Enter</kbd> enviar · <kbd>Shift+Enter</kbd> nova linha · <kbd>↑↓</kbd> histórico</div>
            <div><kbd>Tab</kbd> indentar · <kbd>Esc</kbd> limpar · <kbd>Ctrl+L</kbd> limpar tudo</div>
          </div>
        )}
      </div>
    </div>
  );
}
