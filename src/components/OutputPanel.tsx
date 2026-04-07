import React from 'react';

interface Props {
  output: string;
}

export function OutputPanel({ output }: Props) {
  return (
    <div className="panel flex flex-col h-full">
      <div className="panel-title">
        <span className="chapter">IV</span>
        <span className="label">Saída</span>
        <span className="meta">stdout</span>
      </div>
      <div className="receipt flex-1 overflow-auto">
        {output || <span className="text-ink-fade font-mono text-[11px]">sem saída</span>}
      </div>
    </div>
  );
}
