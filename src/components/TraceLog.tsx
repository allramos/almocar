import React, { useEffect, useRef } from 'react';
import { Step } from '../interpreter';

interface Props {
  steps: Step[];
  current: number;
  onSelect: (i: number) => void;
  fontSize?: number;
}

export function TraceLog({ steps, current, onSelect, fontSize = 12.5 }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current?.querySelector(`[data-i="${current}"]`) as HTMLElement | null;
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [current]);

  const numSz = `${fontSize - 2.5}px`;
  const lineSz = `${fontSize - 2.5}px`;
  const descSz = `${fontSize - 0.5}px`;

  return (
    <div className="panel flex flex-col h-full">
      <div className="panel-title">
        <span className="chapter">V</span>
        <span className="label">Trace</span>
        <span className="meta">{steps.length} passos</span>
      </div>
      <div ref={ref} className="px-2 py-1 overflow-auto flex-1">
        {steps.length === 0 && (
          <div className="text-ink-fade text-xs font-mono py-2 px-2">
            Nenhum passo registrado.
          </div>
        )}
        {steps.map((s, i) => {
          const active = i === current;
          const isErr = s.status === 'error';
          const isOk  = s.status === 'success';
          return (
            <button
              key={i}
              data-i={i}
              onClick={() => onSelect(i)}
              className={`group w-full text-left px-2 py-1 flex items-baseline gap-2 rounded transition-colors
                ${active ? 'bg-ember/10' : 'hover:bg-bg-soft'}`}
            >
              <span
                className={`font-mono tabular-nums min-w-[26px] text-right
                  ${active ? 'text-ember' : isErr ? 'text-wine' : isOk ? 'text-herb' : 'text-ink-fade'}`}
                style={{ fontSize: numSz }}
              >
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="text-ink-fade font-mono min-w-[24px]" style={{ fontSize: lineSz }}>
                L{s.line}
              </span>
              <span className={`leading-snug flex-1 font-mono ${active ? 'text-ink' : 'text-ink-dim'}`} style={{ fontSize: descSz }}>
                {s.description}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Algarismos romanos curtos para a "tasting menu" feel
function romanize(n: number): string {
  if (n > 999) return String(n);
  const map: [number, string][] = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
    [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
    [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ];
  let out = '';
  for (const [v, s] of map) {
    while (n >= v) { out += s; n -= v; }
  }
  return out;
}
