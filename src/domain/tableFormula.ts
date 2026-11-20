// 표 칸 식 (P48-3 - PLAN 5장 'P48' ⓖ·ⓗ). 쓰는 칸의 고치는 표만 부른다(domain/tableEdit → features/notes/TableEditor) -
//   카드·보기 칸·검색·연결 창·옛 판 앱은 칸 v(셈한 결과)만 읽는다.
//   - '='로 시작하는 글 = 식: 칸 f에 친 그대로(함수 이름·칸 주소만 대문자로), 결과는 v(숫자 서식대로)·n - 표를 고칠 때마다 표 전체를 다시 셈한다(recalcTable).
//   - 칸 주소 A1 · 범위 B2:B10 · 고정 $A$1 · 셈표 + - * / ^ & % · 견주기 = <> < > <= >= · 글 "…" · TRUE / FALSE · 괄호
//   - 함수 열둘(엑셀과 같은 답): SUM · AVERAGE · COUNT · COUNTA · COUNTIF · MAX · MIN · RANK · ROUND · ROUNDUP · ROUNDDOWN · IF
//   - 오류는 엑셀 글 그대로(#DIV/0! · #REF! · #NAME? · #VALUE! · #N/A · #NUM!) + 서로 부르는 칸 '#순환!' · 읽지 못한 식 '#식오류!'
//   - 행·열을 넣고 빼면 식 주소가 따라간다(shiftFormulas - 범위 안에 넣으면 늘고, 가리키던 칸이 빠지면 #REF!).
//   - 셈은 직접 짠다(계산 라이브러리 HyperFormula는 gzip 170KB·GPL - 5장 'P48'). 날마다 바뀌는 함수(TODAY·NOW)·다른 표는 없다.
import type { EntryTable, TableCell, TableCellStyle } from '../data/types';
import { numberCell, setNumberFormat, styleOf, type NumFormat } from './tableFormat';
import { cellNumber, parseNum, plainText } from './tableNumber';

// ───────────────────────── 값 ─────────────────────────

/** 오류 값 (엑셀 글 그대로) */
export interface FormulaError {
  err: string;
}
/** 칸 하나의 값: 수 · 글 · 참거짓 · 빈 칸(null) · 오류 */
export type Scalar = number | string | boolean | null | FormulaError;

const E = (err: string): FormulaError => ({ err });
const isErr = (v: unknown): v is FormulaError => typeof v === 'object' && v !== null && 'err' in v;
const DIV0 = '#DIV/0!';
const REF = '#REF!';
const NAME = '#NAME?';
const VALUE = '#VALUE!';
const NA = '#N/A';
const NUM = '#NUM!';
const CYCLE = '#순환!';
const SYNTAX = '#식오류!';

/** 오류 칸에 마우스를 올리면 보이는 쉬운 까닭 */
export const FORMULA_ERRORS: Record<string, string> = {
  [DIV0]: '0으로 나눴습니다 (빈 칸은 0으로 셉니다 - 평균을 낼 수가 없을 때도)',
  [REF]: '가리키던 칸이 빠졌습니다 (행·열 빼기) - 식을 다시 적어 주세요',
  [NAME]: '모르는 이름입니다 - 함수 이름·칸 주소를 확인하세요 (글은 "따옴표" 안에)',
  [VALUE]: '수가 와야 할 자리에 글이 있습니다',
  [NA]: '찾는 값이 목록에 없습니다',
  [NUM]: '셈할 수 없는 수입니다 (너무 크거나 음수의 제곱근 등)',
  [CYCLE]: '식이 (돌고 돌아) 자기 칸을 가리킵니다',
  [SYNTAX]: '식을 읽지 못했습니다 - 괄호·따옴표·쉼표와 함수에 넣은 값의 수를 확인하세요',
};

/** 식 칸 글이 오류면 그 까닭 (아니면 undefined) */
export const formulaErrorReason = (cell: Pick<TableCell, 'f' | 'v'>): string | undefined => (cell.f ? FORMULA_ERRORS[cell.v] : undefined);

/** 식으로 볼 글인가 - '='로 시작하고 '=' 하나만은 아닌 것 (글로 두려면 앞에 ') */
export const isFormulaText = (text: string) => text.startsWith('=') && text.trim().length > 1;

// ───────────────────────── 칸 주소 ─────────────────────────

/** 열 이름: 0 → A, 25 → Z, 26 → AA (엑셀과 같게) */
export function colName(c: number): string {
  let n = c + 1;
  let out = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    out = String.fromCharCode(65 + m) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

/** 칸 주소 한 끝 (0부터, ar·ac = $ 고정) */
interface RefPart {
  r: number;
  c: number;
  ar: boolean;
  ac: boolean;
}

const REF_RE = /^(\$?)([A-Za-z]{1,3})(\$?)([1-9]\d{0,6})$/;

function readRef(word: string): RefPart | null {
  const m = REF_RE.exec(word);
  if (!m) return null;
  let c = 0;
  for (const ch of m[2].toUpperCase()) c = c * 26 + (ch.charCodeAt(0) - 64);
  return { r: Number(m[4]) - 1, c: c - 1, ac: m[1] === '$', ar: m[3] === '$' };
}

const refText = (p: RefPart) => `${p.ac ? '$' : ''}${colName(p.c)}${p.ar ? '$' : ''}${p.r + 1}`;

// ───────────────────────── 읽기 (글 → 조각 → 나무) ─────────────────────────

type TokKind = 'num' | 'str' | 'bool' | 'err' | 'name' | 'fn' | 'ref' | 'range' | 'op' | '(' | ')' | ',';
interface Tok {
  k: TokKind;
  /** 식 글 안 자리 [s, e) */
  s: number;
  e: number;
  v?: string | number | boolean;
  a?: RefPart;
  b?: RefPart;
}

const WORD = /[$A-Za-z_\u0080-￿][$A-Za-z0-9_.\u0080-￿]*/y;
const NUMBER = /(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/y;
const ERROR_LIT = /#(?:REF!|DIV\/0!|N\/A|NAME\?|VALUE!|NUM!|NULL!|순환!|식오류!)/iy;
/** 식 글 한도 (엑셀은 8,192자 - 표 칸에는 넉넉하다) */
const MAX_FORMULA = 2000;

/** 식 글(앞 '=' 포함)을 조각으로. 모르는 글자가 있으면 null */
function tokenize(f: string): Tok[] | null {
  if (f.length > MAX_FORMULA) return null;
  const out: Tok[] = [];
  let i = 1;
  const sticky = (re: RegExp) => {
    re.lastIndex = i;
    const m = re.exec(f);
    return m ? m[0] : null;
  };
  while (i < f.length) {
    const ch = f[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    const s = i;
    if (ch === '"') {
      let v = '';
      i++;
      for (;;) {
        if (i >= f.length) return null;
        if (f[i] === '"') {
          if (f[i + 1] === '"') {
            v += '"';
            i += 2;
            continue;
          }
          i++;
          break;
        }
        v += f[i++];
      }
      out.push({ k: 'str', s, e: i, v });
      continue;
    }
    if (/[\d.]/.test(ch)) {
      const m = sticky(NUMBER);
      if (!m) return null;
      i += m.length;
      out.push({ k: 'num', s, e: i, v: Number(m) });
      continue;
    }
    if (ch === '#') {
      const m = sticky(ERROR_LIT);
      if (!m) return null;
      i += m.length;
      out.push({ k: 'err', s, e: i, v: m.toUpperCase() });
      continue;
    }
    const word = sticky(WORD);
    if (word) {
      i += word.length;
      let j = i;
      while (j < f.length && /\s/.test(f[j])) j++;
      if (f[j] === '(') {
        out.push({ k: 'fn', s, e: i, v: word.toUpperCase() });
        continue;
      }
      const a = readRef(word);
      if (a) {
        if (f[i] === ':') {
          i++;
          const w2 = sticky(WORD);
          const b = w2 ? readRef(w2) : null;
          if (!w2 || !b) return null;
          i += w2.length;
          out.push({ k: 'range', s, e: i, a, b });
        } else out.push({ k: 'ref', s, e: i, a });
        continue;
      }
      const up = word.toUpperCase();
      if (up === 'TRUE' || up === 'FALSE') out.push({ k: 'bool', s, e: i, v: up === 'TRUE' });
      else out.push({ k: 'name', s, e: i, v: word });
      continue;
    }
    const two = f.slice(i, i + 2);
    if (two === '<=' || two === '>=' || two === '<>') {
      i += 2;
      out.push({ k: 'op', s, e: i, v: two });
      continue;
    }
    if ('+-*/^&%=<>'.includes(ch)) {
      i++;
      out.push({ k: 'op', s, e: i, v: ch });
      continue;
    }
    if (ch === '(' || ch === ')' || ch === ',') {
      i++;
      out.push({ k: ch, s, e: i });
      continue;
    }
    return null;
  }
  return out;
}

/** 식 나무 */
type Node =
  | { k: 'num'; v: number }
  | { k: 'str'; v: string }
  | { k: 'bool'; v: boolean }
  | { k: 'err'; v: string }
  | { k: 'name'; v: string }
  | { k: 'ref'; r: number; c: number }
  | { k: 'range'; r1: number; c1: number; r2: number; c2: number }
  | { k: 'neg'; a: Node }
  | { k: 'pct'; a: Node }
  | { k: 'bin'; op: string; a: Node; b: Node }
  | { k: 'fn'; name: string; args: (Node | null)[] };

/** 함수마다 넣는 값의 수 [최소, 최대] - 틀리면 엑셀처럼 식을 받지 않는다(#식오류!) */
const ARITY: Record<string, [number, number]> = {
  SUM: [1, 255],
  AVERAGE: [1, 255],
  COUNT: [1, 255],
  COUNTA: [1, 255],
  MAX: [1, 255],
  MIN: [1, 255],
  COUNTIF: [2, 2],
  RANK: [2, 3],
  ROUND: [2, 2],
  ROUNDUP: [2, 2],
  ROUNDDOWN: [2, 2],
  IF: [2, 3],
};

/** 식을 나무로 읽는다 (엑셀 차례: 견주기 < & < + - < * / < ^ < % < 부호). 읽지 못하면 null */
function parseTokens(toks: Tok[]): Node | null {
  let p = 0;
  let depth = 0;
  const isOp = (...ops: string[]) => p < toks.length && toks[p].k === 'op' && ops.includes(toks[p].v as string);
  const fail = (): never => {
    throw new Error('식');
  };

  const binary = (next: () => Node, ops: string[]) => (): Node => {
    let a = next();
    while (isOp(...ops)) {
      const op = toks[p++].v as string;
      a = { k: 'bin', op, a, b: next() };
    }
    return a;
  };
  const primary = (): Node => {
    const t = toks[p];
    if (!t) return fail();
    p++;
    switch (t.k) {
      case 'num':
        return { k: 'num', v: t.v as number };
      case 'str':
        return { k: 'str', v: t.v as string };
      case 'bool':
        return { k: 'bool', v: t.v as boolean };
      case 'err':
        return { k: 'err', v: t.v as string };
      case 'name':
        return { k: 'name', v: t.v as string };
      case 'ref':
        return { k: 'ref', r: t.a!.r, c: t.a!.c };
      case 'range':
        return {
          k: 'range',
          r1: Math.min(t.a!.r, t.b!.r),
          c1: Math.min(t.a!.c, t.b!.c),
          r2: Math.max(t.a!.r, t.b!.r),
          c2: Math.max(t.a!.c, t.b!.c),
        };
      case '(': {
        if (++depth > 100) fail();
        const inner = compare();
        depth--;
        if (toks[p]?.k !== ')') fail();
        p++;
        return inner;
      }
      case 'fn': {
        const name = t.v as string;
        p++; // (
        if (++depth > 100) fail();
        const args: (Node | null)[] = [];
        if (toks[p]?.k === ')') p++;
        else {
          for (;;) {
            const k = toks[p]?.k;
            args.push(k === ',' || k === ')' ? null : compare());
            if (toks[p]?.k === ',') {
              p++;
              continue;
            }
            if (toks[p]?.k !== ')') fail();
            p++;
            break;
          }
        }
        depth--;
        const ar = ARITY[name];
        if (ar && (args.length < ar[0] || args.length > ar[1] || args[0] === null)) fail();
        return { k: 'fn', name, args };
      }
      default:
        return fail();
    }
  };
  const unary = (): Node => {
    if (isOp('-', '+')) {
      const neg = toks[p++].v === '-';
      if (++depth > 100) fail();
      const a = unary();
      depth--;
      return neg ? { k: 'neg', a } : a;
    }
    return primary();
  };
  const postfix = (): Node => {
    let a = unary();
    while (isOp('%')) {
      p++;
      a = { k: 'pct', a };
    }
    return a;
  };
  const power = binary(postfix, ['^']);
  const mul = binary(power, ['*', '/']);
  const add = binary(mul, ['+', '-']);
  const concat = binary(add, ['&']);
  const compare: () => Node = binary(concat, ['=', '<>', '<', '>', '<=', '>=']);

  try {
    const root = compare();
    return p === toks.length ? root : null;
  } catch {
    return null;
  }
}

/** 읽은 식 (같은 식은 한 번만 읽는다) */
const parsed = new Map<string, Node | null>();
function parseFormula(f: string): Node | null {
  let n = parsed.get(f);
  if (n === undefined) {
    const toks = tokenize(f);
    n = toks && toks.length ? parseTokens(toks) : null;
    if (parsed.size > 2000) parsed.clear();
    parsed.set(f, n);
  }
  return n;
}

/** 식 글을 다시 짓는다 - 바꿀 조각만 바꾸고 나머지(띄어쓰기 등)는 친 그대로. 읽지 못하면 null */
function rewrite(f: string, change: (t: Tok) => string | null): string | null {
  const toks = tokenize(f);
  if (!toks) return null;
  let out = '';
  let at = 0;
  for (const t of toks) {
    const next = change(t);
    if (next === null) continue;
    out += f.slice(at, t.s) + next;
    at = t.e;
  }
  return out + f.slice(at);
}

/** 친 식을 다듬는다 - 함수 이름·칸 주소·TRUE/FALSE를 대문자로 (엑셀처럼). 읽지 못하는 식은 친 그대로 */
export function normalizeFormula(text: string): string {
  const out = rewrite(text, (t) => {
    if (t.k === 'ref') return refText(t.a!);
    if (t.k === 'range') return `${refText(t.a!)}:${refText(t.b!)}`;
    if (t.k === 'bool') return t.v ? 'TRUE' : 'FALSE';
    if (t.k === 'fn' && ARITY[t.v as string]) return t.v as string;
    return null;
  });
  return out ?? text;
}

// ───────────────────────── 셈 ─────────────────────────

interface Ctx {
  rows: number;
  cols: number;
  /** 칸 값 (표 밖 = 빈 칸) */
  get(r: number, c: number): Scalar;
}

/** 수로 (빈 칸 = 0, 참거짓 = 1·0, 글은 읽어서 - '1,234원' 같은 글도) */
function toNum(v: Scalar): number | FormulaError {
  if (typeof v === 'number') return v;
  if (v === null) return 0;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (isErr(v)) return v;
  return parseNum(v) ?? E(VALUE);
}

/** 글로 (& 잇기 - 수는 유효 숫자 15자리) */
function toText(v: Exclude<Scalar, FormulaError>): string {
  if (typeof v === 'number') return plainText(v);
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  return v ?? '';
}

/** 수 견주기는 유효 숫자 15자리로 (0.1 + 0.2 = 0.3 → TRUE - 엑셀처럼) */
const n15 = (x: number) => Number(x.toPrecision(15));

/** 셈 결과 다듬기 - 넘친 수는 #NUM!, -0은 0 */
const fin = (x: number): number | FormulaError => (Number.isFinite(x) ? (x === 0 ? 0 : x) : E(NUM));

/** 엑셀 견주기: 수 < 글 < 참거짓, 글은 대소문자 없이, 빈 칸은 상대 모양의 빈 값 */
function cmp(a: Scalar, b: Scalar): number | FormulaError {
  if (isErr(a)) return a;
  if (isErr(b)) return b;
  const blank = (o: Scalar) => (typeof o === 'number' ? 0 : typeof o === 'boolean' ? false : '');
  if (a === null) a = blank(b);
  if (b === null) b = blank(a);
  const rank = (v: Scalar) => (typeof v === 'number' ? 0 : typeof v === 'string' ? 1 : 2);
  if (rank(a) !== rank(b)) return rank(a) - rank(b);
  if (typeof a === 'number' && typeof b === 'number') return Math.sign(n15(a) - n15(b));
  if (typeof a === 'string' && typeof b === 'string') {
    const x = a.toLowerCase();
    const y = b.toLowerCase();
    return x < y ? -1 : x > y ? 1 : 0;
  }
  return Number(a) - Number(b);
}

/** 범위·칸 주소의 값들 (표 밖은 건너뛴다) */
function* cellsOf(n: Node, x: Ctx): Generator<Scalar> {
  if (n.k === 'ref') {
    yield x.get(n.r, n.c);
    return;
  }
  if (n.k !== 'range') return;
  const r2 = Math.min(n.r2, x.rows - 1);
  const c2 = Math.min(n.c2, x.cols - 1);
  for (let r = n.r1; r <= r2; r++) for (let c = n.c1; c <= c2; c++) yield x.get(r, c);
}

const isRefNode = (n: Node | null): n is Extract<Node, { k: 'ref' | 'range' }> => !!n && (n.k === 'ref' || n.k === 'range');

/** SUM·AVERAGE·MAX·MIN의 수 - 칸에서는 수만(글·빈 칸·참거짓은 건너뜀), 직접 넣은 값은 수로 읽는다(못 읽으면 #VALUE!) */
function numbersOf(args: (Node | null)[], x: Ctx): number[] | FormulaError {
  const out: number[] = [];
  for (const a of args) {
    if (isRefNode(a)) {
      for (const v of cellsOf(a, x)) {
        if (isErr(v)) return v;
        if (typeof v === 'number') out.push(v);
      }
      continue;
    }
    const v = a ? val(a, x) : 0;
    const n = toNum(v);
    if (isErr(n)) return n;
    out.push(n);
  }
  return out;
}

/** 반올림·올림·내림 (자리 d - 음수면 십의 자리 위로). 2진수 오차는 유효 숫자 15자리로 걷는다 */
function roundBy(n: number, d: number, how: 'round' | 'up' | 'down'): number {
  const k = 10 ** Math.abs(d);
  const scaled = n15(d >= 0 ? Math.abs(n) * k : Math.abs(n) / k);
  const m = how === 'round' ? Math.round(scaled) : how === 'up' ? Math.ceil(scaled) : Math.floor(scaled);
  const r = d >= 0 ? m / k : m * k;
  return n < 0 && r !== 0 ? -r : r;
}

/** COUNTIF 조건 - 수·참거짓은 같은 것, 글은 앞 견주기(= <> < > <= >=) + 값('>=80'·'○'·'김*') */
function criterion(crit: Scalar): (v: Scalar) => boolean {
  if (typeof crit === 'number') return (v) => typeof v === 'number' && n15(v) === n15(crit);
  if (typeof crit === 'boolean') return (v) => v === crit;
  const text = typeof crit === 'string' ? crit : '';
  const m = /^(<=|>=|<>|<|>|=)?([\s\S]*)$/.exec(text)!;
  const op = m[1] ?? '=';
  const rest = m[2];
  const test = (c: number) => (op === '=' ? c === 0 : op === '<>' ? c !== 0 : op === '<' ? c < 0 : op === '>' ? c > 0 : op === '<=' ? c <= 0 : c >= 0);
  const num = rest.trim() ? parseNum(rest) : null;
  if (num !== null) {
    return (v) => {
      const same = typeof v === 'number';
      if (op === '<>') return !same || n15(v) !== n15(num);
      return same && test(Math.sign(n15(v) - n15(num)));
    };
  }
  if (rest === '') {
    const empty = (v: Scalar) => v === null || v === '';
    return op === '=' ? empty : op === '<>' ? (v) => !empty(v) : () => false;
  }
  const up = rest.toUpperCase();
  if (up === 'TRUE' || up === 'FALSE') {
    const b = up === 'TRUE';
    return op === '<>' ? (v) => v !== b : (v) => op === '=' && v === b;
  }
  if (op === '=' || op === '<>') {
    // 별표 * = 아무 글, ? = 한 글자, ~ = 그 다음 글자 그대로
    let re = '';
    for (let i = 0; i < rest.length; i++) {
      const ch = rest[i];
      if (ch === '~' && i + 1 < rest.length) re += rest[++i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      else if (ch === '*') re += '[\\s\\S]*';
      else if (ch === '?') re += '[\\s\\S]';
      else re += ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    const rx = new RegExp(`^${re}$`, 'i');
    const hit = (v: Scalar) => typeof v === 'string' && rx.test(v);
    return op === '=' ? hit : (v) => !hit(v);
  }
  const low = rest.toLowerCase();
  return (v) => typeof v === 'string' && test(v.toLowerCase() < low ? -1 : v.toLowerCase() > low ? 1 : 0);
}

type Fn = (args: (Node | null)[], x: Ctx) => Scalar;

const FNS: Record<string, Fn> = {
  SUM: (args, x) => {
    const ns = numbersOf(args, x);
    return isErr(ns) ? ns : fin(ns.reduce((s, n) => s + n, 0));
  },
  AVERAGE: (args, x) => {
    const ns = numbersOf(args, x);
    if (isErr(ns)) return ns;
    return ns.length ? fin(ns.reduce((s, n) => s + n, 0) / ns.length) : E(DIV0);
  },
  MAX: (args, x) => {
    const ns = numbersOf(args, x);
    return isErr(ns) ? ns : ns.length ? Math.max(...ns) : 0;
  },
  MIN: (args, x) => {
    const ns = numbersOf(args, x);
    return isErr(ns) ? ns : ns.length ? Math.min(...ns) : 0;
  },
  COUNT: (args, x) => {
    let n = 0;
    for (const a of args) {
      if (isRefNode(a)) {
        for (const v of cellsOf(a, x)) if (typeof v === 'number') n++;
      } else if (a) {
        const v = val(a, x);
        if (typeof v === 'number' || typeof v === 'boolean' || (typeof v === 'string' && parseNum(v) !== null)) n++;
      }
    }
    return n;
  },
  COUNTA: (args, x) => {
    let n = 0;
    for (const a of args) {
      if (isRefNode(a)) {
        for (const v of cellsOf(a, x)) if (v !== null) n++;
      } else n++;
    }
    return n;
  },
  COUNTIF: ([range, crit], x) => {
    if (!isRefNode(range)) return E(VALUE);
    const c = crit ? val(crit, x) : '';
    if (isErr(c)) return c;
    const hit = criterion(c);
    let n = 0;
    for (const v of cellsOf(range, x)) if (hit(v)) n++;
    return n;
  },
  RANK: ([num, ref, order], x) => {
    if (!isRefNode(ref)) return E(VALUE);
    const target = toNum(val(num!, x));
    if (isErr(target)) return target;
    const asc = order ? toNum(val(order, x)) : 0;
    if (isErr(asc)) return asc;
    const t = n15(target);
    let found = false;
    let before = 0;
    for (const v of cellsOf(ref, x)) {
      if (isErr(v)) return v;
      if (typeof v !== 'number') continue;
      const n = n15(v);
      if (n === t) found = true;
      else if (asc ? n < t : n > t) before++;
    }
    return found ? before + 1 : E(NA);
  },
  ROUND: (args, x) => rounding(args, x, 'round'),
  ROUNDUP: (args, x) => rounding(args, x, 'up'),
  ROUNDDOWN: (args, x) => rounding(args, x, 'down'),
  IF: ([test, yes, no], x) => {
    const c = val(test!, x);
    if (isErr(c)) return c;
    let ok: boolean;
    if (c === null) ok = false;
    else if (typeof c === 'number') ok = c !== 0;
    else if (typeof c === 'boolean') ok = c;
    else {
      const up = c.toUpperCase();
      if (up !== 'TRUE' && up !== 'FALSE') return E(VALUE);
      ok = up === 'TRUE';
    }
    // 고른 쪽만 셈한다 (엑셀처럼 - 고르지 않은 쪽의 오류는 나오지 않는다)
    const branch = ok ? yes : no;
    if (branch === undefined) return false;
    if (branch === null) return 0;
    return val(branch, x);
  },
};

function rounding([num, digits]: (Node | null)[], x: Ctx, how: 'round' | 'up' | 'down'): Scalar {
  const n = toNum(val(num!, x));
  if (isErr(n)) return n;
  const d = digits ? toNum(val(digits, x)) : 0;
  if (isErr(d)) return d;
  return fin(roundBy(n, Math.trunc(d), how));
}

/** 나무 하나의 값 (범위 그대로는 #VALUE! - 함수 안에서만) */
function val(n: Node, x: Ctx): Scalar {
  switch (n.k) {
    case 'num':
    case 'str':
    case 'bool':
      return n.v;
    case 'err':
      return E(n.v);
    case 'name':
      return E(NAME);
    case 'ref':
      return x.get(n.r, n.c);
    case 'range':
      return E(VALUE);
    case 'neg': {
      const a = toNum(val(n.a, x));
      return isErr(a) ? a : fin(-a);
    }
    case 'pct': {
      const a = toNum(val(n.a, x));
      return isErr(a) ? a : fin(a / 100);
    }
    case 'fn': {
      const fn = FNS[n.name];
      return fn ? fn(n.args, x) : E(NAME);
    }
    case 'bin': {
      const a = val(n.a, x);
      const b = val(n.b, x);
      if (n.op === '&') {
        if (isErr(a)) return a;
        if (isErr(b)) return b;
        return toText(a) + toText(b);
      }
      if (['=', '<>', '<', '>', '<=', '>='].includes(n.op)) {
        const c = cmp(a, b);
        if (isErr(c)) return c;
        return n.op === '=' ? c === 0 : n.op === '<>' ? c !== 0 : n.op === '<' ? c < 0 : n.op === '>' ? c > 0 : n.op === '<=' ? c <= 0 : c >= 0;
      }
      const p = toNum(a);
      if (isErr(p)) return p;
      const q = toNum(b);
      if (isErr(q)) return q;
      if (n.op === '+') return fin(p + q);
      if (n.op === '-') return fin(p - q);
      if (n.op === '*') return fin(p * q);
      if (n.op === '/') return q === 0 ? E(DIV0) : fin(p / q);
      // ^ : 0의 음수 제곱은 #DIV/0!, 음수의 분수 제곱은 #NUM!
      if (p === 0 && q < 0) return E(DIV0);
      const r = p ** q;
      return Number.isNaN(r) ? E(NUM) : fin(r);
    }
  }
}

/** 식 하나를 셈한 값 (칸 하나를 가리켜 빈 칸이면 0 - 엑셀처럼) */
function resultOf(node: Node | null, x: Ctx): Scalar {
  if (!node) return E(SYNTAX);
  const v = val(node, x);
  return v === null ? 0 : v;
}

/** 식에 든 칸 주소·범위 (나오는 차례대로) */
function refsOf(n: Node | null, out: { r1: number; c1: number; r2: number; c2: number }[] = []) {
  if (!n) return out;
  if (n.k === 'ref') out.push({ r1: n.r, c1: n.c, r2: n.r, c2: n.c });
  else if (n.k === 'range') out.push(n);
  else if (n.k === 'neg' || n.k === 'pct') refsOf(n.a, out);
  else if (n.k === 'bin') {
    refsOf(n.a, out);
    refsOf(n.b, out);
  } else if (n.k === 'fn') for (const a of n.args) refsOf(a, out);
  return out;
}

/** 식이 아닌 칸의 값 - 수로 읽히면 수('1,234원' → 1234), 빈 칸은 null, 나머지는 글 */
const plainValue = (cell: TableCell): Scalar => cellNumber(cell) ?? (cell.v === '' ? null : cell.v);

/** 식 결과를 칸에 (수는 그 칸 숫자 서식대로 v·n, 글·참거짓·오류는 그 글) */
function shownCell(cell: TableCell, value: Scalar, style?: TableCellStyle): TableCell {
  if (typeof value === 'number') return numberCell(cell, value, style);
  const out: TableCell = { ...cell, v: isErr(value) ? value.err : typeof value === 'boolean' ? (value ? 'TRUE' : 'FALSE') : (value ?? '') };
  delete out.n;
  return out;
}

/**
 * 표 전체를 다시 셈한다 - 식 칸(f)의 v·n. 식 칸끼리 부르는 차례대로 셈하고(Kahn), 차례를 정하지 못한 칸(서로 부름)은 #순환!.
 * 바뀐 칸이 없으면 그 표 그대로(같은 객체).
 */
export function recalcTable(t: EntryTable): EntryTable {
  const R = t.rows.length;
  const C = t.rows[0]?.cells.length ?? 0;
  const list: { r: number; c: number; node: Node | null }[] = [];
  const index = new Map<number, number>();
  t.rows.forEach((row, r) =>
    row.cells.forEach((cell, c) => {
      if (!cell.f || cell.x) return;
      index.set(r * C + c, list.length);
      list.push({ r, c, node: parseFormula(cell.f) });
    })
  );
  if (!list.length) return t;

  // 식 칸끼리의 부름: users[j] = j를 부르는 칸들, need[i] = i가 기다리는 칸 수
  const users: number[][] = list.map(() => []);
  const need = list.map(() => 0);
  list.forEach((item, i) => {
    const deps = new Set<number>();
    for (const g of refsOf(item.node)) {
      const r2 = Math.min(g.r2, R - 1);
      const c2 = Math.min(g.c2, C - 1);
      if (g.r1 > r2 || g.c1 > c2) continue;
      if ((r2 - g.r1 + 1) * (c2 - g.c1 + 1) <= list.length) {
        for (let r = g.r1; r <= r2; r++)
          for (let c = g.c1; c <= c2; c++) {
            const j = index.get(r * C + c);
            if (j !== undefined) deps.add(j);
          }
      } else list.forEach((o, j) => o.r >= g.r1 && o.r <= r2 && o.c >= g.c1 && o.c <= c2 && deps.add(j));
    }
    for (const j of deps) {
      users[j].push(i);
      need[i]++;
    }
  });

  const values: (Scalar | undefined)[] = list.map(() => undefined);
  const x: Ctx = {
    rows: R,
    cols: C,
    get(r, c) {
      const cell = t.rows[r]?.cells[c];
      if (!cell || cell.x) return null;
      if (cell.f) {
        const j = index.get(r * C + c);
        return j === undefined ? null : (values[j] ?? E(CYCLE));
      }
      return plainValue(cell);
    },
  };
  const queue = list.flatMap((_, i) => (need[i] === 0 ? [i] : []));
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q];
    values[i] = resultOf(list[i].node, x);
    for (const u of users[i]) if (--need[u] === 0) queue.push(u);
  }

  let changed = false;
  const rows = t.rows.map((row, r) => {
    let rowChanged = false;
    const cells = row.cells.map((cell, c) => {
      if (!cell.f || cell.x) return cell;
      const j = index.get(r * C + c)!;
      const next = shownCell(cell, values[j] ?? E(CYCLE), styleOf(t, cell));
      if (next.v === cell.v && next.n === cell.n) return cell;
      rowChanged = true;
      return next;
    });
    if (!rowChanged) return row;
    changed = true;
    return { ...row, cells };
  });
  return changed ? { ...t, rows } : t;
}

/** 표에 식 칸이 있나 */
export const hasFormula = (t: EntryTable) => t.rows.some((row) => row.cells.some((c) => !!c.f));

// ───────────────────────── 처음 가리킨 칸 모양 (ⓖ) ─────────────────────────

/** 세는 함수(개수·석차)의 답은 숫자 서식을 따르지 않는다 */
const PLAIN_RESULT = new Set(['COUNT', 'COUNTA', 'COUNTIF', 'RANK']);

/**
 * 식을 처음 넣은 칸이 따를 숫자 서식 - 처음 가리킨 수 칸의 1,000·원·% (엑셀처럼 - 학급비 합계가 원이면 원).
 * 그 칸에 서식이 없거나 세는 함수면 없음.
 */
export function formulaFormat(t: EntryTable, f: string): NumFormat | undefined {
  const node = parseFormula(f);
  if (!node || (node.k === 'fn' && PLAIN_RESULT.has(node.name))) return undefined;
  for (const g of refsOf(node)) {
    const r2 = Math.min(g.r2, t.rows.length - 1);
    const c2 = Math.min(g.c2, (t.rows[0]?.cells.length ?? 0) - 1);
    for (let r = g.r1; r <= r2; r++)
      for (let c = g.c1; c <= c2; c++) {
        const cell = t.rows[r]?.cells[c];
        if (!cell || cell.x || cellNumber(cell) === null) continue;
        return styleOf(t, cell)?.nf;
      }
  }
  return undefined;
}

/** 칸 (r, c)에 식이 처음 들어갈 때 숫자 서식을 따르게 한다 (그 칸에 숫자 서식이 없을 때만) */
export function adoptFormat(t: EntryTable, r: number, c: number): EntryTable {
  const cell = t.rows[r]?.cells[c];
  if (!cell?.f) return t;
  const s = styleOf(t, cell);
  if (s?.nf !== undefined || s?.dp !== undefined) return t;
  const nf = formulaFormat(t, cell.f);
  return nf ? setNumberFormat(t, { r1: r, c1: c, r2: r, c2: c }, nf) : t;
}

// ───────────────────────── 행·열을 넣고 빼면 주소가 따라간다 (ⓗ) ─────────────────────────

/** 행(axis 'r')·열('c')을 at 자리에 넣거나(+1) 뺐을(-1) 때 식 하나의 주소. 고칠 것이 없으면 그 글 그대로 */
export function shiftFormula(f: string, axis: 'r' | 'c', at: number, delta: 1 | -1): string {
  const pos = (p: RefPart) => (axis === 'r' ? p.r : p.c);
  const moved = (p: RefPart, by: number): RefPart => (axis === 'r' ? { ...p, r: p.r + by } : { ...p, c: p.c + by });
  let touched = false;
  const out = rewrite(f, (t) => {
    if (t.k === 'ref') {
      const p = pos(t.a!);
      if (p < at) return null;
      touched = true;
      if (delta < 0 && p === at) return REF;
      return refText(moved(t.a!, delta));
    }
    if (t.k !== 'range') return null;
    // 범위는 위·왼쪽 끝(lo)과 아래·오른쪽 끝(hi)으로 다룬다 (B5:B2도 B2:B5로)
    let [lo, hi] = pos(t.a!) <= pos(t.b!) ? [t.a!, t.b!] : [t.b!, t.a!];
    const l = pos(lo);
    const h = pos(hi);
    if (delta > 0) {
      if (h < at) return null;
      if (l >= at) lo = moved(lo, 1);
      hi = moved(hi, 1);
    } else {
      if (h < at) return null;
      if (l === at && h === at) {
        touched = true;
        return REF;
      }
      if (l > at) lo = moved(lo, -1);
      hi = moved(hi, -1);
    }
    touched = true;
    return `${refText(lo)}:${refText(hi)}`;
  });
  return touched && out !== null ? out : f;
}

/** 표 안 모든 식의 주소를 옮긴다 (tableEdit의 행·열 넣고 빼기가 부른다) */
export function shiftFormulas(t: EntryTable, axis: 'r' | 'c', at: number, delta: 1 | -1): EntryTable {
  if (!hasFormula(t)) return t;
  return {
    ...t,
    rows: t.rows.map((row) =>
      row.cells.some((c) => c.f)
        ? {
            ...row,
            cells: row.cells.map((cell) => {
              if (!cell.f) return cell;
              const f = shiftFormula(cell.f, axis, at, delta);
              return f === cell.f ? cell : { ...cell, f };
            }),
          }
        : row
    ),
  };
}
