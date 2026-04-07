import React from 'react';
import { VarSnapshot } from '../interpreter';

interface Props {
  vars: VarSnapshot[];
}

export function VariablesPanel({ vars }: Props) {
  const scalars = vars.filter(v => v.scalar);
  return (
    <div className="panel flex flex-col h-full">
      <div className="panel-title">
        <span className="chapter">III</span>
        <span className="label">Variáveis</span>
        <span className="meta">{scalars.length}</span>
      </div>
      <div className="px-4 pt-3 pb-3 overflow-auto flex-1 space-y-1">
        {scalars.length === 0 && (
          <div className="text-ink-fade text-xs font-mono py-2">
            Nenhuma variável escalar no escopo.
          </div>
        )}
        {scalars.map(v => {
          const written = !!v.written;
          const read = !!v.read && !written;
          const stateClass = written
            ? 'var-written'
            : read
              ? 'var-read'
              : '';
          const valueColor = written
            ? 'text-ember'
            : read
              ? 'text-herb'
              : 'text-saffron';
          return (
            <div
              key={v.name}
              className={`leader py-1.5 px-2 rounded-sm transition-colors ${stateClass}`}
            >
              <span className="name font-mono text-ink text-[13px] font-medium">
                {v.name}
                <span className="font-mono text-ink-fade text-[10px] ml-2">{v.type}</span>
              </span>
              <span className="dots" />
              <span
                className={`value font-mono tabular-nums text-[14px] ${valueColor}`}
                style={{ fontWeight: 600 }}
              >
                {v.value}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
