import type { Language } from '../types';
import { parse } from './parser';
import { formatC } from './formatter';
import { cHighlight } from './highlight';
import { examples } from './examples';

export const cLanguage: Language = {
  id: 'c',
  name: 'C',
  parse,
  format: formatC,
  highlight: cHighlight,
  examples,
};
