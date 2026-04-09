import React from 'react';
import { VarSnapshot } from '../interpreter';

interface Props {
  vars: VarSnapshot[];
  zoom?: number;
  onZoomChange?: (delta: number) => void;
  storage?: Record<string, string>;
}

export function ArrayView({ vars, zoom = 1, onZoomChange, storage }: Props) {
  const arrays = vars.filter(v => v.cells && v.shape && v.shape.length > 0);
  const storageEntries = storage ? Object.entries(storage) : [];

  return (
    <div className="panel flex flex-col w-full min-h-0">
      <div className="panel-title">
        <span className="chapter">II</span>
        <span className="label">Estruturas</span>
        <span className="meta">{arrays.length + (storageEntries.length > 0 ? 1 : 0)} item{arrays.length + (storageEntries.length > 0 ? 1 : 0) === 1 ? '' : 's'}</span>
        {onZoomChange && (
          <span className="flex items-center gap-1 ml-auto">
            <button
              onClick={() => onZoomChange(-0.1)}
              className="panel-action"
              title="Diminuir zoom"
              style={{ padding: '0 5px', minWidth: 0 }}
            >
              −
            </button>
            <span className="text-[10px] tabular-nums text-ink-mute" style={{ minWidth: 32, textAlign: 'center' }}>
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => onZoomChange(0.1)}
              className="panel-action"
              title="Aumentar zoom"
              style={{ padding: '0 5px', minWidth: 0 }}
            >
              +
            </button>
          </span>
        )}
      </div>
      <div className="px-4 pb-4 pt-4 overflow-auto flex-1 flex flex-wrap gap-5 justify-center content-start" style={{ zoom }}>
        {arrays.length === 0 && storageEntries.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">[ ]</div>
            <div className="empty-state-text">
              Vetores e matrizes serão visualizados aqui com destaque de leitura e escrita
            </div>
          </div>
        )}
        {arrays.map(v => (
          <ArrayBlock key={v.name} variable={v} />
        ))}
        {storageEntries.length > 0 && (
          <StorageBlock entries={storageEntries} />
        )}
      </div>
    </div>
  );
}

function ArrayBlock({ variable }: { variable: VarSnapshot }) {
  const dims = variable.shape!;
  const cells = variable.cells!;

  return (
    <div className="board" style={{ flex: 'none' }}>
      <div className="flex items-baseline gap-3 mb-3">
        <span className="font-mono text-ink text-[13px] font-medium">
          {variable.name}
        </span>
        <span className="font-mono text-ink-mute text-[11px]">{variable.type}</span>
        <span className="border-b border-bg-crust translate-y-[-3px] min-w-[20px] flex-1" />
        <span className="font-mono text-ink-fade text-[10px]">{dims.join(' × ')}</span>
      </div>
      {dims.length === 1 && <Array1D cells={cells} />}
      {dims.length === 2 && <Array2D cells={cells} rows={dims[0]} cols={dims[1]} />}
      {dims.length > 2 && <Array1D cells={cells} />}
    </div>
  );
}

function Tile({ value, hl, written, read }: { value: string; hl?: boolean; written?: boolean; read?: boolean }) {
  const cls = `tile ${written ? 'write' : ''} ${read ? 'read' : ''} ${hl ? 'hl' : ''}`.trim();
  return <div className={cls}>{value}</div>;
}

function Array1D({ cells }: { cells: any[] }) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {cells.map((c, i) => (
        <div key={i} className="flex flex-col items-center">
          <span className="italic-num text-ink-fade text-[10px] mb-1">{i}</span>
          <Tile value={c.value} hl={c.highlighted} written={c.written} read={c.read} />
        </div>
      ))}
    </div>
  );
}

function Array2D({ cells, rows, cols }: { cells: any[]; rows: number; cols: number }) {
  const grid: any[][] = Array.from({ length: rows }, () => []);
  for (const c of cells) {
    const [r, k] = c.index;
    grid[r][k] = c;
  }
  return (
    <div className="inline-block">
      <div className="flex gap-1.5 mb-1.5" style={{ marginLeft: 'calc(1.25rem + 6px)' }}>
        {Array.from({ length: cols }).map((_, k) => (
          <div key={k} className="min-w-[42px] text-center italic-num text-ink-fade text-[10px]">{k}</div>
        ))}
      </div>
      {grid.map((row, r) => (
        <div key={r} className="flex items-center gap-1.5 mb-1.5">
          <div className="w-5 text-right italic-num text-ink-fade text-[10px] pr-1">{r}</div>
          {row.map((c, k) => (
            <Tile key={k} value={c?.value ?? '·'} hl={c?.highlighted} written={c?.written} read={c?.read} />
          ))}
        </div>
      ))}
    </div>
  );
}

function StorageBlock({ entries }: { entries: [string, string][] }) {
  return (
    <div className="board">
      <div className="flex items-baseline gap-3 mb-3">
        <span className="font-mono text-ink text-[13px] font-medium">
          localStorage
        </span>
        <span className="font-mono text-ink-mute text-[11px]">Storage</span>
        <span className="flex-1 border-b border-bg-crust translate-y-[-3px]" />
        <span className="font-mono text-ink-fade text-[10px]">{entries.length} {entries.length === 1 ? 'chave' : 'chaves'}</span>
      </div>
      <div className="flex flex-col gap-1.5">
        {entries.map(([key, value]) => (
          <div key={key} className="flex items-center gap-1.5">
            <div className="tile" style={{ minWidth: 60 }}>{key}</div>
            <span className="text-ink-fade text-[11px] font-mono">→</span>
            <div className="tile" style={{ minWidth: 60 }}>{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
