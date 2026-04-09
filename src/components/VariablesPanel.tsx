import React from 'react';
import { VarSnapshot } from '../interpreter';

interface Props {
  vars: VarSnapshot[];
  fontSize?: number;
}

export function VariablesPanel({ vars, fontSize = 12.5 }: Props) {
  const scalars = vars.filter(v => v.scalar);
  return (
    <div className="panel flex flex-col h-full">
      <div className="panel-title">
        <span className="chapter">IV</span>
        <span className="label">Variáveis</span>
        <span className="meta">{scalars.length}</span>
      </div>
      <div className="px-4 pt-3 pb-3 overflow-auto flex-1 space-y-1" style={{ fontSize: `${fontSize}px` }}>
        {scalars.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">x</div>
            <div className="empty-state-text">
              Variáveis escalares aparecerão aqui durante a execução
            </div>
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
          const nameSz = `${fontSize + 0.5}px`;
          const typeSz = `${fontSize - 2.5}px`;
          const valSz = `${fontSize + 1.5}px`;
          return (
            <div
              key={v.name}
              className={`leader py-1.5 px-2 rounded-sm transition-colors ${stateClass}`}
            >
              <span className="name font-mono text-ink font-medium" style={{ fontSize: nameSz }}>
                {v.name}
                <span className="font-mono text-ink-fade ml-2" style={{ fontSize: typeSz }}>{v.type}</span>
              </span>
              <span className="dots" />
              <span
                className={`value font-mono tabular-nums ${valueColor}`}
                style={{ fontWeight: 600, fontSize: valSz }}
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
