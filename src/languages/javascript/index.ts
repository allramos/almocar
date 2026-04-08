import type { Language } from '../types';
import { parse } from './parser';
import { formatJavaScript } from './formatter';
import { javascriptHighlight } from './highlight';
import { examples } from './examples';

export const javascriptLanguage: Language = {
  id: 'javascript',
  name: 'JavaScript',
  parse,
  format: formatJavaScript,
  highlight: javascriptHighlight,
  examples,
};
