import React, { useEffect, useRef, useState } from 'react';

function convLabel(conv: string): string {
  switch (conv) {
    case 'd': case 'i': return 'inteiro';
    case 'u': return 'uint';
    case 'f': case 'e': case 'g': case 'E': case 'G': return 'real';
    case 'c': return 'char';
    case 's': return 'texto';
    case 'x': case 'X': return 'hex';
    default: return '';
  }
}

interface Props {
  output: string;
  waitingForInput: boolean;
  inputConv: string;
  onSubmit: (value: string) => void;
}

export function TerminalPanel({ output, waitingForInput, inputConv, onSubmit }: Props) {
  const [currentValue, setCurrentValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Foco automático quando entra em modo de espera
  useEffect(() => {
    if (waitingForInput) {
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [waitingForInput]);

  // Auto-scroll para o final
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [output, waitingForInput]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = currentValue.trim();
      if (val) {
        onSubmit(val);
        setCurrentValue('');
      }
    }
  }

  // Clique em qualquer lugar do terminal foca o input
  function handleContainerClick() {
    if (waitingForInput) {
      inputRef.current?.focus();
    }
  }

  const typeLabel = convLabel(inputConv);

  return (
    <div className="panel flex flex-col h-full">
      <div className="panel-title">
        <span className="chapter">III</span>
        <span className="label">Terminal</span>
        <span className="meta">stdin/stdout</span>
      </div>

      <div
        ref={scrollRef}
        className="term-body flex-1 min-h-0 overflow-auto"
        onClick={handleContainerClick}
      >
        {/* Saída acumulada do printf */}
        {output && <span className="term-output">{output}</span>}

        {/* Prompt de entrada inline */}
        {waitingForInput && (
          <span className="term-input-line">
            <input
              ref={inputRef}
              type="text"
              className="term-input"
              value={currentValue}
              onChange={(e) => setCurrentValue(e.target.value)}
              onKeyDown={handleKeyDown}
              size={Math.max(1, currentValue.length || 1)}
              spellCheck={false}
              autoComplete="off"
            />
            {typeLabel && (
              <span className="term-type-badge">%{inputConv} {typeLabel}</span>
            )}
          </span>
        )}

        {/* Placeholder quando vazio */}
        {!output && !waitingForInput && (
          <span className="term-empty">sem saída</span>
        )}
      </div>
    </div>
  );
}
