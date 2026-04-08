import type { Language } from '../types';
import { parse } from './parser';
import { formatPortugol } from './formatter';
import { portugolHighlight } from './highlight';
import { examples } from './examples';

export const portugolLanguage: Language = {
  id: 'portugol',
  name: 'Portugol',
  parse,
  format: formatPortugol,
  highlight: portugolHighlight,
  examples,
};
