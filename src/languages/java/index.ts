import type { Language } from '../types';
import { parse } from './parser';
import { formatJava } from './formatter';
import { javaHighlight } from './highlight';
import { examples } from './examples';

export const javaLanguage: Language = {
  id: 'java',
  name: 'Java',
  parse,
  format: formatJava,
  highlight: javaHighlight,
  examples,
};
