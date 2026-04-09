import React from 'react';

type Mood = 'idle' | 'cooking' | 'success' | 'error';

interface Props {
  mood: Mood;
  message?: string;
  stepIndex?: number;
  totalSteps?: number;
}

// Tira de status compacta — exibe estado, mensagem do passo e contador.
// Sem mascote ilustrado, sem emojis, sem metáfora de cozinha.
export function Mascot({ mood, message, stepIndex, totalSteps }: Props) {
  const hasSteps = totalSteps !== undefined && totalSteps > 0;
  return (
    <div className={`panel flex items-center gap-4 px-4 py-2.5 ${mood === 'error' ? 'status-bar-error' : ''}`}>
      <span className={`status-dot ${mood}`} />
      <span className="smallcaps text-ink-mute whitespace-nowrap">
        {labelFor(mood)}
      </span>
      <span className="h-4 w-px bg-bg-crust" />
      <span className="status-bar-message truncate flex-1">
        {message ?? defaultMessage(mood)}
      </span>
      {hasSteps && (
        <span className="flex items-baseline gap-1.5 whitespace-nowrap">
          <span className="serif-num text-ember text-[20px] leading-none">
            {(stepIndex ?? 0) + 1}
          </span>
          <span className="font-mono text-[10px] text-ink-fade tabular-nums">
            / {totalSteps}
          </span>
        </span>
      )}
    </div>
  );
}

function labelFor(mood: Mood): string {
  switch (mood) {
    case 'cooking': return 'Executando';
    case 'success': return 'Concluído';
    case 'error':   return 'Erro';
    default:        return 'Pronto';
  }
}
function defaultMessage(mood: Mood): string {
  switch (mood) {
    case 'cooking': return 'Avaliando passo…';
    case 'success': return 'Execução finalizada sem erros.';
    case 'error':   return 'A execução foi interrompida.';
    default:        return 'Edite o código e clique em Executar.';
  }
}
