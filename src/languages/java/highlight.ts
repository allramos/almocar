import type { Tok, TokKind, HighlightConfig } from '../types';

const KEYWORDS = new Set([
  'if','else','for','while','do','return','break','continue','switch','case','default',
  'class','new','public','private','protected','static','final',
  'import','package','extends','implements','interface','abstract',
  'try','catch','finally','throw','throws',
]);
const TYPES = new Set([
  'int','float','double','char','void','boolean','long','short','byte',
  'String','Scanner','System',
]);
const PUNCT = new Set(['(',')','{','}','[',']',',',';',':','?','.']);
const OP_CHARS = '+-*/%=<>!&|^~';

function tokenizeJava(source: string): Tok[][] {
  const lines = source.split('\n');
  const result: Tok[][] = [];
  let inBlockComment = false;
  for (const line of lines) {
    const [tokens, stillInComment] = tokenizeLine(line, inBlockComment);
    result.push(tokens);
    inBlockComment = stillInComment;
  }
  return result;
}

function tokenizeLine(line: string, inBlockComment: boolean): [Tok[], boolean] {
  const out: Tok[] = [];
  let i = 0;

  if (inBlockComment) {
    const end = line.indexOf('*/', i);
    if (end >= 0) {
      out.push({ kind: 'cmt', text: line.slice(i, end + 2) });
      i = end + 2;
      inBlockComment = false;
    } else {
      out.push({ kind: 'cmt', text: line.slice(i) });
      return [out, true];
    }
  }

  while (i < line.length) {
    const c = line[i];
    if (c === ' ' || c === '\t') {
      let j = i;
      while (j < line.length && (line[j] === ' ' || line[j] === '\t')) j++;
      out.push({ kind: 'ws', text: line.slice(i, j) });
      i = j;
      continue;
    }
    if (c === '/' && line[i + 1] === '/') {
      out.push({ kind: 'cmt', text: line.slice(i) });
      i = line.length;
      continue;
    }
    if (c === '/' && line[i + 1] === '*') {
      const end = line.indexOf('*/', i + 2);
      if (end >= 0) {
        out.push({ kind: 'cmt', text: line.slice(i, end + 2) });
        i = end + 2;
        continue;
      } else {
        out.push({ kind: 'cmt', text: line.slice(i) });
        return [out, true];
      }
    }
    if (c === '"') {
      let j = i + 1;
      while (j < line.length && line[j] !== '"') {
        if (line[j] === '\\' && j + 1 < line.length) j += 2;
        else j++;
      }
      out.push({ kind: 'str', text: line.slice(i, Math.min(j + 1, line.length)) });
      i = j + 1;
      continue;
    }
    if (c === "'") {
      let j = i + 1;
      while (j < line.length && line[j] !== "'") {
        if (line[j] === '\\' && j + 1 < line.length) j += 2;
        else j++;
      }
      out.push({ kind: 'chr', text: line.slice(i, Math.min(j + 1, line.length)) });
      i = j + 1;
      continue;
    }
    if (/[0-9]/.test(c)) {
      let j = i;
      while (j < line.length && /[0-9.xXa-fA-FLlFfDd]/.test(line[j])) j++;
      out.push({ kind: 'num', text: line.slice(i, j) });
      i = j;
      continue;
    }
    if (/[A-Za-z_$]/.test(c)) {
      let j = i;
      while (j < line.length && /[A-Za-z0-9_$]/.test(line[j])) j++;
      const word = line.slice(i, j);
      let kind: TokKind = 'id';
      if (KEYWORDS.has(word)) kind = 'kw';
      else if (TYPES.has(word)) kind = 'type';
      else if (word === 'true' || word === 'false') kind = 'num';
      else if (word === 'null') kind = 'kw';
      else if (line[j] === '(') kind = 'fn';
      out.push({ kind, text: word });
      i = j;
      continue;
    }
    if (PUNCT.has(c)) {
      out.push({ kind: 'pun', text: c });
      i++;
      continue;
    }
    if (OP_CHARS.includes(c)) {
      let j = i;
      while (j < line.length && OP_CHARS.includes(line[j])) j++;
      out.push({ kind: 'op', text: line.slice(i, j) });
      i = j;
      continue;
    }
    out.push({ kind: 'id', text: c });
    i++;
  }
  return [out, false];
}

export const javaHighlight: HighlightConfig = {
  keywords: KEYWORDS,
  types: TYPES,
  tokenize: tokenizeJava,
};
