import React from 'react';

interface Props {
  step: number;
  total: number;
  playing: boolean;
  speed: number;
  onPlay: () => void;
  onPause: () => void;
  onPrev: () => void;
  onNext: () => void;
  onReset: () => void;
  onJump: (i: number) => void;
  onSpeedChange: (s: number) => void;
  disabled?: boolean;
}

export function Controls({
  step, total, playing, speed,
  onPlay, onPause, onPrev, onNext, onReset, onJump, onSpeedChange, disabled,
}: Props) {
  const progress = total > 0 ? Math.round(((step + 1) / total) * 100) : 0;

  return (
    <div className="panel px-4 py-2 flex items-center gap-2 flex-wrap">
      <button onClick={onReset} disabled={disabled} className="btn" title="Reiniciar">
        Reiniciar
      </button>
      <button onClick={onPrev} disabled={disabled || step <= 0} className="btn" title="Passo anterior (←)">
        Anterior
      </button>

      {playing ? (
        <button onClick={onPause} disabled={disabled} className="btn btn-primary" title="Pausar">
          Pausar
        </button>
      ) : (
        <button onClick={onPlay} disabled={disabled || total === 0} className="btn btn-primary" title="Reproduzir">
          Play
        </button>
      )}

      <button onClick={onNext} disabled={disabled || step >= total - 1} className="btn" title="Próximo passo (→)">
        Próximo
      </button>

      <div className="flex items-center gap-2 ml-2">
        <span className="smallcaps text-ink-fade">velocidade</span>
        <select
          value={speed}
          onChange={(e) => onSpeedChange(Number(e.target.value))}
          className="menu-select"
        >
          <option value={1500}>0.5×</option>
          <option value={800}>1×</option>
          <option value={350}>2×</option>
          <option value={100}>4×</option>
        </select>
      </div>

      <div className="flex-1 flex items-center gap-3 min-w-[200px] ml-2">
        <input
          type="range"
          min={0}
          max={Math.max(0, total - 1)}
          value={step}
          onChange={(e) => onJump(Number(e.target.value))}
          disabled={disabled || total === 0}
          className="flex-1"
          style={{ ['--progress' as any]: `${progress}%` }}
        />
        <span className="font-mono text-[11px] tabular-nums whitespace-nowrap text-ink-mute">
          {total === 0 ? '00 / 00' : `${String(step + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}`}
        </span>
      </div>
    </div>
  );
}
