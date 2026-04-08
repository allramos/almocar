import type { Language } from './types';
import { cLanguage } from './c';
import { portugolLanguage } from './portugol';
import { javaLanguage } from './java';

export type { Language, HighlightConfig, Tok, TokKind } from './types';

const languages: Record<string, Language> = {
  c: cLanguage,
  portugol: portugolLanguage,
  java: javaLanguage,
};

export function getLanguage(id: string): Language {
  const lang = languages[id];
  if (!lang) throw new Error(`Linguagem '${id}' não encontrada`);
  return lang;
}

export function getLanguageIds(): string[] {
  return Object.keys(languages);
}

export function getAllLanguages(): Language[] {
  return Object.values(languages);
}
