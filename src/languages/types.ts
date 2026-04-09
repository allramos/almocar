import type { Program } from '../interpreter/ast';

export type TokKind = 'kw' | 'type' | 'num' | 'str' | 'chr' | 'cmt' | 'pre' | 'fn' | 'op' | 'pun' | 'id' | 'ws';
export interface Tok { kind: TokKind; text: string; }

export interface HighlightConfig {
  keywords: Set<string>;
  types: Set<string>;
  /** Tokeniza o código-fonte em linhas de tokens para syntax highlighting. */
  tokenize(source: string): Tok[][];
}

export interface Language {
  id: string;
  name: string;
  /** Converte código-fonte em AST. */
  parse(source: string): Program;
  /** Formata (re-indenta) o código. */
  format(source: string): string;
  /** Configuração de syntax highlighting para o editor. */
  highlight: HighlightConfig;
  /** Exemplos disponíveis para o selector. */
  examples: Record<string, { name: string; code: string; description?: string }>;
}
