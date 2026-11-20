// 표 칸 숫자 서식·꾸밈 (P48-2 - PLAN 5장 'P48' ⓔ·ⓕ). 쓰는 칸의 고치는 표(features/notes/TableEditor)만 부른다.
//   - 칸 v는 늘 보이는 글('1,234원'), 서식을 입힌 칸은 원래 수를 n에 (ⓐ) - 카드·검색·옛 판 앱은 v만 읽는다.
//   - 서식(nf·dp)·굵게(b)·맞춤(ha)·칸 색(bg)은 styles에 한 번, 칸은 번호(s) - 붙여넣은 서식과 같은 자리.
//   - 글 칸은 서식을 입혀도 그대로(서식은 남아 나중에 친 수에 입는다 - 엑셀처럼).
import type { EntryTable, TableCell, TableCellStyle } from '../data/types';
import { cellNumber, parseNum, plainText, roundTo } from './tableNumber';
import type { CellPos, CellRange } from './tableEdit';

export type NumFormat = NonNullable<TableCellStyle['nf']>;

/** 소수 자리 한도 (일반 보이기의 유효 숫자 10자리와 같게) */
export const MAX_DECIMALS = 10;

/** '일반' 보이기 - 유효 숫자 10자리까지, 끝 0 없음 (정수는 15자리까지 그대로) */
export function generalText(n: number): string {
  if (n === 0) return '0';
  if (Number.isInteger(n) && Math.abs(n) < 1e15) return String(n);
  return String(Number(n.toPrecision(10)));
}

/** 세 자리마다 쉼표 ('1234567.5' → '1,234,567.5') */
function groupThousands(body: string): string {
  if (/e/i.test(body)) return body;
  const [int, frac] = body.split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return frac === undefined ? grouped : `${grouped}.${frac}`;
}

/**
 * 수를 서식대로 보인다.
 *   nf 없음 = 일반(dp가 있으면 그 자리까지, 쉼표 없음) · 'comma' = 1,234 · 'won' = 1,234원(음수 -1,234원) · 'pct' = ×100 + '%'(0.125 → 12.5%)
 *   dp를 정하면 그만큼 반올림(0에서 먼 쪽), 아니면 그 수가 가진 만큼.
 */
export function formatNum(x: number, nf?: NumFormat, dp?: number): string {
  const val = nf === 'pct' ? x * 100 : x;
  const abs = Math.abs(val);
  let body = dp === undefined ? generalText(abs) : roundTo(abs, dp).toFixed(dp);
  if (nf === 'comma' || nf === 'won') body = groupThousands(body);
  // 반올림해 0이 된 음수는 부호 없이 (-0.001 → 0.00)
  const sign = val < 0 && /[1-9]/.test(body) ? '-' : '';
  return nf === 'won' ? `${sign}${body}원` : nf === 'pct' ? `${sign}${body}%` : sign + body;
}

/** 지금 보이는 소수 자리 수 (소수 −/+가 여기서 하나 빼고 더한다) */
export function shownDecimals(x: number, nf?: NumFormat, dp?: number): number {
  if (dp !== undefined) return dp;
  const body = generalText(Math.abs(nf === 'pct' ? x * 100 : x));
  return /e/i.test(body) ? 0 : (body.split('.')[1]?.length ?? 0);
}

/** 숫자 서식이 있나 (nf 또는 소수 자리) */
const hasNumFormat = (s?: TableCellStyle) => !!s && (s.nf !== undefined || s.dp !== undefined);

/** 칸 서식 */
export const styleOf = (t: EntryTable, cell: TableCell): TableCellStyle | undefined => (cell.s !== undefined ? t.styles?.[cell.s] : undefined);

/**
 * 칸을 고칠 때 보이는 글 - 식 칸은 식(P48-3), 서식을 입힌 수는 원래 수('1,234원' → 1234, '12.5%' → 12.5%), 나머지는 보이는 글 그대로.
 * '='로 시작하는 글 칸은 앞에 '를 붙인다 - 고친 뒤 다시 넣어도 식이 되지 않게 (엑셀처럼).
 */
export function editText(cell: TableCell, style?: TableCellStyle): string {
  if (cell.f) return cell.f;
  if (cell.v.startsWith('=')) return `'${cell.v}`;
  if (!hasNumFormat(style)) return cell.v;
  const x = cellNumber(cell);
  if (x === null) return cell.v;
  return style!.nf === 'pct' ? `${plainText(x * 100)}%` : plainText(x);
}

/** 수 x를 서식 s로 입힌 칸 (v = 보이는 글, n = 보이는 글이 바탕 글과 다를 때만) - 식 결과(domain/tableFormula)도 */
export function numberCell(cell: TableCell, x: number, s?: TableCellStyle): TableCell {
  const v = hasNumFormat(s) ? formatNum(x, s!.nf, s!.dp) : generalText(x);
  const out: TableCell = { ...cell, v };
  if (v !== plainText(x)) out.n = x;
  else delete out.n;
  return out;
}

/**
 * 칸에 친 글을 넣은 칸. 숫자 서식이 있는 칸에 수를 치면 서식을 입힌다('1234' → '1,234원'),
 * % 칸에 % 없이 친 수는 그 % ('15' → 15%). 글·빈 칸·서식 없는 칸은 친 그대로(원래 수 n은 뺀다).
 */
export function cellWithInput(cell: TableCell, text: string, style?: TableCellStyle): TableCell {
  if (hasNumFormat(style)) {
    const x = parseNum(text);
    if (x !== null) {
      const bare = style!.nf === 'pct' && !text.trim().endsWith('%');
      return numberCell(cell, bare ? x / 100 : x, style);
    }
  }
  const out: TableCell = { ...cell, v: text };
  delete out.n;
  return out;
}

/** 같은 모양 찾기 열쇠 (붙여넣기 domain/entryTable styleKey와 같은 꼴) */
const keyOf = (s: TableCellStyle) =>
  JSON.stringify(
    Object.keys(s)
      .sort()
      .map((k) => [k, s[k as keyof TableCellStyle]])
  );

/**
 * 범위 칸의 서식을 바꾼다. change(앞 서식 사본, 칸) → [새 서식, 새 칸].
 * styles는 쓰는 것만 다시 모은다(같은 모양은 한 번) - 바꾸다 남은 서식이 쌓이지 않게.
 */
function restyleRange(t: EntryTable, g: CellRange, change: (s: TableCellStyle, cell: TableCell) => [TableCellStyle, TableCell]): EntryTable {
  const styles: TableCellStyle[] = [];
  const index = new Map<string, number>();
  const intern = (s: TableCellStyle): number | undefined => {
    const clean: TableCellStyle = {};
    for (const [k, v] of Object.entries(s)) if (v !== undefined) (clean as Record<string, unknown>)[k] = v;
    if (!Object.keys(clean).length) return undefined;
    const k = keyOf(clean);
    let i = index.get(k);
    if (i === undefined) {
      i = styles.length;
      styles.push(clean);
      index.set(k, i);
    }
    return i;
  };
  const rows = t.rows.map((row, r) => ({
    ...row,
    cells: row.cells.map((cell, c) => {
      if (cell.x) return cell;
      const old = styleOf(t, cell) ?? {};
      const inside = r >= g.r1 && r <= g.r2 && c >= g.c1 && c <= g.c2;
      const [s, next] = inside ? change({ ...old }, cell) : [old, cell];
      const si = intern(s);
      const out = { ...next };
      if (si === undefined) delete out.s;
      else out.s = si;
      return out;
    }),
  }));
  const out: EntryTable = { ...t, rows };
  if (styles.length) out.styles = styles;
  else delete out.styles;
  return out;
}

/** 범위 안 칸 (가려진 칸 빼고) */
function cellsIn(t: EntryTable, g: CellRange): TableCell[] {
  const out: TableCell[] = [];
  for (let r = g.r1; r <= g.r2; r++) for (let c = g.c1; c <= g.c2; c++) {
    const cell = t.rows[r]?.cells[c];
    if (cell && !cell.x) out.push(cell);
  }
  return out;
}

/** 서식을 바꾼 칸의 수를 새 서식으로 다시 보인다 (글 칸은 그대로) */
const reformat = (cell: TableCell, s: TableCellStyle): TableCell => {
  const x = cellNumber(cell);
  return x === null ? cell : numberCell(cell, x, s);
};

/**
 * 숫자 서식 단추 (1,000 · 원 · %). 고른 수 칸이 모두 이미 그 서식이면 푼다(일반 - 소수 자리는 그대로).
 * 수 칸이 없으면(빈 칸·글) 서식만 둔다 - 나중에 친 수에 입는다.
 */
export function setNumberFormat(t: EntryTable, g: CellRange, nf: NumFormat): EntryTable {
  const cells = cellsIn(t, g);
  const nums = cells.filter((c) => cellNumber(c) !== null);
  const off = (nums.length ? nums : cells).every((c) => styleOf(t, c)?.nf === nf);
  return restyleRange(t, g, (s, cell) => {
    s.nf = off ? undefined : nf;
    return [s, reformat(cell, s)];
  });
}

/** 소수 자리 −/+ (엑셀처럼 고른 칸(at)에 보이는 자리에서 하나 - 범위 모두 같은 자리로) */
export function stepDecimals(t: EntryTable, g: CellRange, at: CellPos, delta: 1 | -1): EntryTable {
  const cells = cellsIn(t, g);
  const first = t.rows[at.r]?.cells[at.c];
  const base = [first, ...cells].find((c): c is TableCell => !!c && !c.x && cellNumber(c) !== null);
  const st = base ? styleOf(t, base) : first && !first.x ? styleOf(t, first) : undefined;
  const shown = base ? shownDecimals(cellNumber(base)!, st?.nf, st?.dp) : (st?.dp ?? 0);
  const dp = Math.max(0, Math.min(MAX_DECIMALS, shown + delta));
  return restyleRange(t, g, (s, cell) => {
    s.dp = dp;
    return [s, reformat(cell, s)];
  });
}

/** 굵게 - 고른 칸이 모두 굵으면 푼다 */
export function toggleBold(t: EntryTable, g: CellRange): EntryTable {
  const off = cellsIn(t, g).every((c) => styleOf(t, c)?.b === 1);
  return restyleRange(t, g, (s, cell) => {
    s.b = off ? undefined : 1;
    return [s, cell];
  });
}

/** 맞춤 (undefined = 처음대로 - 글 왼쪽·수 오른쪽) */
export function setAlign(t: EntryTable, g: CellRange, ha: TableCellStyle['ha']): EntryTable {
  return restyleRange(t, g, (s, cell) => {
    s.ha = ha;
    return [s, cell];
  });
}

/** 칸 색 (undefined = 없음) */
export function setFill(t: EntryTable, g: CellRange, bg: string | undefined): EntryTable {
  return restyleRange(t, g, (s, cell) => {
    s.bg = bg;
    return [s, cell];
  });
}

/** 칸 색 고르기 (옅은 색 여섯 - 표 바탕은 어두운 화면에서도 흰 종이) */
export const FILL_COLORS: { key: string; name: string; bg: string }[] = [
  { key: 'yellow', name: '노랑', bg: '#fef9c3' },
  { key: 'green', name: '초록', bg: '#dcfce7' },
  { key: 'blue', name: '파랑', bg: '#dbeafe' },
  { key: 'pink', name: '분홍', bg: '#fce7f3' },
  { key: 'orange', name: '주황', bg: '#ffedd5' },
  { key: 'gray', name: '회색', bg: '#f1f5f9' },
];
