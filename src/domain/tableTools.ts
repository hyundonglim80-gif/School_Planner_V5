// 표 Σ 자동 합계 · ⇣ 아래로 채우기 · 정렬 (P48-4 - PLAN 5장 'P48' ⓘ·ⓙ·ⓚ). 쓰는 칸의 고치는 표(features/notes/TableEditor)만 부른다.
//   - Σ: 한 칸이면 위로 이어진 수(없으면 왼쪽)를 묶은 식, 범위면 열마다 범위 아래 칸에(빈 칸이 없으면 행을 하나 넣고).
//     바로 위 합계·평균 줄과 옆 합계 열은 건너뛴다(평균이 합계를 섞지 않게) - '묶어 세는 줄·열' = 범위를 묶는 식(SUM·AVERAGE …)이나 이름('합계'·'평균'·'총점' …).
//   - ⇣ 채우기: 맨 위 칸을 아래로 베낀다(한 줄만 고르면 바로 위 칸을) - 식은 $ 없는 주소만 따라간다(엑셀 Ctrl+D).
//   - 정렬: 고른 칸의 열로 행째 옮긴다 - 2행 이상 고른 범위(표 높이 전체가 아니면)는 그 행들, 아니면 첫 행(제목)과 맨 아래 합계·평균 줄을 뺀 나머지.
//     수 → 글(가나다) → 빈 칸은 늘 맨 아래 · 같은 값은 처음 차례 · 옮긴 행의 식은 베낀 것처럼, 밖의 식은 그대로(엑셀처럼).
//   셈한 표는 다시 셈해서 돌려준다(domain/tableFormula recalcTable).
import type { EntryTable, TableCell, TableRow } from '../data/types';
import { anchorOf, canGrow, GROW_LIMIT_TEXT, insertRow, type CellRange } from './tableEdit';
import { clearNumberFormat } from './tableFormat';
import { adoptFormat, aggregateAxes, colName, FORMULA_ERRORS, moveFormula, recalcTable } from './tableFormula';
import { cellNumber } from './tableNumber';

/** 고치는 표가 받는 결과 - 바뀐 표와 고를 칸(없으면 고른 그대로)·안내, 못 하면 error = 안내 글 */
export type ToolResult = { table: EntryTable; sel?: CellRange; note?: string } | { error: string };

/** 병합 칸 안내 */
export const MERGED_TEXT = '병합된 칸이 있어 할 수 없습니다 - 병합하지 않은 칸을 골라 주세요';

const cellAt = (t: EntryTable, r: number, c: number): TableCell | undefined => t.rows[r]?.cells[c];
const isBlank = (cell: TableCell) => cell.v === '' && !cell.f;
const isNum = (cell: TableCell) => cellNumber(cell) !== null;
const refName = (r: number, c: number) => `${colName(c)}${r + 1}`;
const rangeText = (r1: number, c1: number, r2: number, c2: number) => (r1 === r2 && c1 === c2 ? refName(r1, c1) : `${refName(r1, c1)}:${refName(r2, c2)}`);

// ───────────────────────── 묶어 세는 줄·열 (합계·평균) ─────────────────────────

/** 묶어 세는 줄·열의 이름 ('합계'·'반 평균'·'총점'·'최고점' …) */
const AGG_LABEL = /^(?:총|소|전체|학급|반|학년)?(?:합계|총계|계|합|총점|평균|최고점?|최저점?|최대값?|최댓값|최소값?|최솟값)$|^(?:total|sum|average|avg|mean|max|min)$/i;
export const isAggregateLabel = (text: string) => AGG_LABEL.test(text.replace(/\s+/g, ''));

/** 이름 칸 - 그 줄(열)에서 처음 나오는, 수가 아닌 글 칸 */
function labelOf(cells: (TableCell | undefined)[]): string | null {
  for (const cell of cells) if (cell && !cell.x && cell.v.trim() !== '' && !isNum(cell)) return cell.v;
  return null;
}

/** 한 표에서 여러 번 묻는 것은 한 번만 센다 (표는 바뀌면 새 객체라 그 표에 붙여 둔다) */
interface Facts {
  aggRow: Map<number, boolean>;
  aggCol: Map<number, boolean>;
  nums: Map<number, boolean>;
}
const factsOf = new WeakMap<EntryTable, Facts>();
function remember(t: EntryTable, which: keyof Facts, k: number, get: () => boolean): boolean {
  let f = factsOf.get(t);
  if (!f) factsOf.set(t, (f = { aggRow: new Map(), aggCol: new Map(), nums: new Map() }));
  let v = f[which].get(k);
  if (v === undefined) f[which].set(k, (v = get()));
  return v;
}

/** 합계·평균 줄인가 - 위아래 여러 행을 묶는 식(제 행 빼고)이 있거나, 이름이 '합계'·'평균' 같은 줄 (엑셀에서 값만 붙여넣은 표도) */
export function isAggregateRow(t: EntryTable, r: number): boolean {
  return remember(t, 'aggRow', r, () => {
    const row = t.rows[r];
    if (!row) return false;
    if (row.cells.some((cell, c) => !cell.x && !!cell.f && aggregateAxes(cell.f, r, c).down)) return true;
    const label = labelOf(row.cells);
    return label !== null && isAggregateLabel(label);
  });
}

/** 합계·평균 열인가 - 옆 여러 열을 묶는 식(제 열 빼고)이 있거나, 머리 이름이 '합계'·'총점' 같은 열 */
export function isAggregateCol(t: EntryTable, c: number): boolean {
  return remember(t, 'aggCol', c, () => {
    if (t.rows.some((row, r) => !!row.cells[c] && !row.cells[c].x && !!row.cells[c].f && aggregateAxes(row.cells[c].f!, r, c).across)) return true;
    const label = labelOf(t.rows.map((row) => row.cells[c]));
    return label !== null && isAggregateLabel(label);
  });
}

/** 열에 수가 있나 (합계·평균 줄 빼고) - 이름 열(글만)과 점수 열('결석'이 섞여도)을 나눈다 */
const colHasNumbers = (t: EntryTable, c: number) =>
  remember(t, 'nums', c, () => t.rows.some((row, r) => !!row.cells[c] && !row.cells[c].x && isNum(row.cells[c]) && !isAggregateRow(t, r)));

/** 빈 줄인가 */
const rowIsBlank = (t: EntryTable, r: number) => t.rows[r].cells.every((cell) => cell.x || isBlank(cell));

// ───────────────────────── Σ 자동 합계 (ⓘ) ─────────────────────────

/** Σ 함수 다섯 (합계·평균·개수·최대·최소) - op = 단추 data-table-op */
export type AutoFn = 'SUM' | 'AVERAGE' | 'COUNT' | 'MAX' | 'MIN';
export const AUTO_FNS: { fn: AutoFn; label: string; op: string }[] = [
  { fn: 'SUM', label: '합계', op: 'autosum-sum' },
  { fn: 'AVERAGE', label: '평균', op: 'autosum-average' },
  { fn: 'COUNT', label: '개수', op: 'autosum-count' },
  { fn: 'MAX', label: '최대', op: 'autosum-max' },
  { fn: 'MIN', label: '최소', op: 'autosum-min' },
];

/**
 * 칸 (r, c) 위로 묶을 행 [위, 아래] - 바로 위 합계·평균 줄은 건너뛰고, 다음 합계·평균 줄이나 표 맨 위까지
 * (점수 사이의 글 '결석'·빈 칸도 함께 - 합계가 건너뛴다). 맨 위 쪽 수 아닌 칸(머리 이름)은 뺀다. 수가 없으면 null
 */
function upRange(t: EntryTable, r: number, c: number): [number, number] | null {
  let i = r - 1;
  while (i >= 0 && isAggregateRow(t, i)) i--;
  const end = i;
  let top = -1;
  for (; i >= 0; i--) {
    const cell = cellAt(t, i, c);
    if (!cell || cell.x || isAggregateRow(t, i)) break;
    if (isNum(cell)) top = i;
  }
  return top >= 0 ? [top, end] : null;
}

/**
 * 칸 (r, c) 왼쪽으로 묶을 열 [왼쪽, 오른쪽] - 바로 옆 합계 열은 건너뛰고, 수가 없는 열(이름 - 그 앞 번호까지 가지 않게)에서 멈춘다
 * (점수 열의 '결석'·빈 칸은 지나간다). 수 있는 열이 없으면 null
 */
function leftRange(t: EntryTable, r: number, c: number): [number, number] | null {
  let j = c - 1;
  while (j >= 0 && isAggregateCol(t, j)) j--;
  const end = j;
  let left = -1;
  for (; j >= 0; j--) {
    const cell = cellAt(t, r, j);
    if (!cell || cell.x || isAggregateCol(t, j) || !colHasNumbers(t, j)) break;
    left = j;
  }
  return left >= 0 ? [left, end] : null;
}

/**
 * 한 칸에 넣을 Σ 식 - 위로 이어진 수(없으면 왼쪽). 둘 다 있으면 위가 먼저(엑셀처럼),
 * 다만 그 칸이 합계 열이고 그 줄이 합계 줄이 아니면 왼쪽(두 번째 학생의 합계가 위 학생 합계를 더하지 않게).
 */
function autoFormula(t: EntryTable, r: number, c: number, fn: AutoFn): string | null {
  const up = upRange(t, r, c);
  const left = leftRange(t, r, c);
  if (left && (!up || (isAggregateCol(t, c) && !isAggregateRow(t, r)))) return `=${fn}(${rangeText(r, left[0], r, left[1])})`;
  if (up) return `=${fn}(${rangeText(up[0], c, up[1], c)})`;
  return null;
}

/** 범위에 병합 칸이 있나 */
function hasMerge(t: EntryTable, g: CellRange): boolean {
  for (let r = g.r1; r <= g.r2; r++)
    for (let c = g.c1; c <= g.c2; c++) {
      const cell = cellAt(t, r, c);
      if (!cell || cell.x || (cell.rs ?? 1) > 1 || (cell.cs ?? 1) > 1) return true;
    }
  return false;
}

/** 식을 칸들에 넣고 다시 셈한다 (처음 넣는 식은 처음 가리킨 칸의 1,000·원·% - 개수는 서식 없이: 위 칸의 원을 물려받지 않게) */
function putFormulas(t: EntryTable, cells: { r: number; c: number; f: string }[], fn: AutoFn): EntryTable {
  const rows = t.rows.map((row) => ({ ...row, cells: [...row.cells] }));
  for (const { r, c, f } of cells) {
    const next: TableCell = { ...rows[r].cells[c], f };
    delete next.n;
    rows[r].cells[c] = next;
  }
  let out: EntryTable = { ...t, rows };
  for (const { r, c } of cells) out = fn === 'COUNT' ? clearNumberFormat(out, { r1: r, c1: c, r2: r, c2: c }) : adoptFormat(out, r, c);
  return recalcTable(out);
}

/** 넣은 칸들을 두르는 범위 */
function boxOf(cells: { r: number; c: number }[]): CellRange {
  return {
    r1: Math.min(...cells.map((x) => x.r)),
    c1: Math.min(...cells.map((x) => x.c)),
    r2: Math.max(...cells.map((x) => x.r)),
    c2: Math.max(...cells.map((x) => x.c)),
  };
}

/**
 * Σ 자동 합계 (ⓘ). g = 고른 범위, fn = 합계·평균·개수·최대·최소.
 *   - 고른 칸이 모두 빈 칸(또는 식)이면 칸마다 위(없으면 왼쪽)를 묶는다 - 합계 줄의 빈 칸들을 한 번에, 넣은 식을 평균으로 바꾸기도.
 *   - 수가 든 범위면: 맨 아래 줄이 비었으면 거기에 열마다, 맨 오른쪽 열이 비었으면 거기에 행마다(둘 다면 모서리에 전체),
 *     아니면 범위 바로 아래 줄에 열마다(그 칸들이 비어 있지 않으면 행을 하나 넣고). 수가 없는 열·행과 맨 아래 합계 줄은 묶지 않는다
 *     (합계 줄까지 골라 평균을 누르면 합계 줄 아래에 평균 줄 - 합계를 바꾸려면 그 칸들만 골라서).
 *   한 칸인데 묶을 수가 없으면 { edit } - 고치는 표가 '=SUM()'을 열어 둔다(엑셀처럼).
 */
export function autoSum(t: EntryTable, g: CellRange, fn: AutoFn): ToolResult | { edit: string } {
  const k = anchorOf(t, g.r1, g.c1);
  if (k.r === g.r1 && k.c === g.c1 && k.r + k.rs - 1 === g.r2 && k.c + k.cs - 1 === g.c2) {
    // 한 칸 (병합된 한 칸도)
    const cell = cellAt(t, k.r, k.c)!;
    if (!isBlank(cell) && !cell.f) return { error: '고른 칸이 비어 있지 않습니다 - 합계를 넣을 빈 칸을 골라 주세요' };
    const f = autoFormula(t, k.r, k.c, fn);
    if (!f) return { edit: `=${fn}()` };
    return { table: putFormulas(t, [{ r: k.r, c: k.c, f }], fn), sel: { r1: k.r, c1: k.c, r2: k.r, c2: k.c } };
  }
  if (hasMerge(t, g)) return { error: MERGED_TEXT };

  const free = (r: number, c: number) => isBlank(cellAt(t, r, c)!);
  const cells: { r: number; c: number; f: string }[] = [];

  // 고른 칸이 모두 빈 칸(또는 식 - 합계를 평균으로 바꾸기) - 칸마다
  let allFree = true;
  for (let r = g.r1; r <= g.r2 && allFree; r++) for (let c = g.c1; c <= g.c2 && allFree; c++) allFree = free(r, c) || !!cellAt(t, r, c)!.f;
  if (allFree) {
    for (let r = g.r1; r <= g.r2; r++)
      for (let c = g.c1; c <= g.c2; c++) {
        const f = autoFormula(t, r, c, fn);
        if (f) cells.push({ r, c, f });
      }
    if (!cells.length) return { error: '묶을 수를 찾지 못했습니다 - 수가 든 범위를 골라 주세요' };
    return { table: putFormulas(t, cells, fn), sel: g };
  }

  // 수가 든 범위 - 맨 아래 줄·맨 오른쪽 열이 비었나
  let bottomFree = g.r2 > g.r1;
  for (let c = g.c1; c <= g.c2 && bottomFree; c++) bottomFree = free(g.r2, c);
  let rightFree = g.c2 > g.c1;
  for (let r = g.r1; r <= g.r2 && rightFree; r++) rightFree = free(r, g.c2);
  const numIn = (r1: number, c1: number, r2: number, c2: number) => {
    for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) if (isNum(cellAt(t, r, c)!)) return true;
    return false;
  };
  // 묶을 칸 = 마지막 줄·열(rLast·cLast)까지에서 수가 없는 맨 위 줄(머리 이름)·맨 왼쪽 열(이름)을 뺀 것.
  //   열마다 묶을 때는 맨 아래 합계·평균 줄을(rData), 행마다 묶을 때는 맨 오른쪽 합계 열을(cData) 빼고 묶는다 - 합계 열의 열 합계(전체 합)는 넣는다
  const rLast = bottomFree ? g.r2 - 1 : g.r2;
  const cLast = rightFree ? g.c2 - 1 : g.c2;
  let top = g.r1;
  while (top < rLast && !numIn(top, g.c1, top, cLast)) top++;
  let left = g.c1;
  while (left < cLast && !numIn(g.r1, left, rLast, left)) left++;
  let rData = rLast;
  while (rData > top && isAggregateRow(t, rData)) rData--;
  let cData = cLast;
  while (cData > left && isAggregateCol(t, cData)) cData--;
  if (!numIn(top, left, rLast, cLast)) return { error: '묶을 수가 없습니다 - 수가 든 범위를 골라 주세요' };

  let base = t;
  let note: string | undefined;
  if (bottomFree || rightFree) {
    if (bottomFree) for (let c = left; c <= cLast; c++) if (numIn(top, c, rData, c)) cells.push({ r: g.r2, c, f: `=${fn}(${rangeText(top, c, rData, c)})` });
    if (rightFree) for (let r = top; r <= rLast; r++) if (numIn(r, left, r, cData)) cells.push({ r, c: g.c2, f: `=${fn}(${rangeText(r, left, r, cData)})` });
    if (bottomFree && rightFree) cells.push({ r: g.r2, c: g.c2, f: `=${fn}(${rangeText(top, left, rData, cData)})` });
  } else {
    // 범위 바로 아래 줄 - 넣을 칸이 모두 비어 있지 않으면 행을 하나 넣는다
    const targets: number[] = [];
    for (let c = left; c <= cLast; c++) if (numIn(top, c, rData, c)) targets.push(c);
    const below = g.r2 + 1;
    const open = targets.every((c) => {
      const cell = cellAt(t, below, c);
      return !!cell && !cell.x && isBlank(cell);
    });
    if (!open) {
      if (!canGrow(t, 1, 0)) return { error: GROW_LIMIT_TEXT };
      base = insertRow(t, below);
      note = `${below + 1}행을 넣어 적었습니다`;
    }
    for (const c of targets) cells.push({ r: below, c, f: `=${fn}(${rangeText(top, c, rData, c)})` });
  }
  return { table: putFormulas(base, cells, fn), sel: boxOf(cells), ...(note ? { note } : {}) };
}

// ───────────────────────── ⇣ 아래로 채우기 (ⓙ) ─────────────────────────

/** 맨 위 칸을 아래로 베낀다 (한 줄만 골랐으면 바로 위 칸을 그 줄에) - 글·수·서식·식(주소는 따라간다). 고른 범위는 그대로 */
export function fillDown(t: EntryTable, g: CellRange): ToolResult {
  const src = g.r1 === g.r2 ? g.r1 - 1 : g.r1;
  if (src < 0) return { error: '베낄 위 칸이 없습니다 - 베낄 칸부터 채울 칸까지 함께 골라 주세요' };
  if (hasMerge(t, { ...g, r1: src })) return { error: MERGED_TEXT };
  const from = g.r1 === g.r2 ? g.r1 : g.r1 + 1;
  const rows: TableRow[] = t.rows.map((row, r) =>
    r < from || r > g.r2
      ? row
      : {
          ...row,
          cells: row.cells.map((cell, c) => {
            if (c < g.c1 || c > g.c2) return cell;
            const s = t.rows[src].cells[c];
            const out: TableCell = { v: s.v };
            if (s.f) out.f = moveFormula(s.f, r - src, 0);
            if (s.n !== undefined) out.n = s.n;
            if (s.s !== undefined) out.s = s.s;
            return out;
          }),
        }
  );
  return { table: recalcTable({ ...t, rows }) };
}

// ───────────────────────── 정렬 (ⓚ) ─────────────────────────

/**
 * 정렬할 행 [r1, r2]. 2행 이상 고른 범위면 그 행들(표 높이 전체를 고른 것 - 열 머리·전체 고르기 - 은 빼고),
 * 아니면 첫 행(제목 - 위에서 내려온 병합 줄까지)과 맨 아래 합계·평균 줄·빈 줄을 뺀 나머지.
 */
export function sortRowsOf(t: EntryTable, g: CellRange): [number, number] {
  const last = t.rows.length - 1;
  if (g.r2 > g.r1 && !(g.r1 === 0 && g.r2 === last)) return [g.r1, g.r2];
  let r1 = 1;
  while (r1 <= last && t.rows[r1].cells.some((cell, c) => cell.x && anchorOf(t, r1, c).r < r1)) r1++;
  let r2 = last;
  while (r2 >= r1 && (isAggregateRow(t, r2) || rowIsBlank(t, r2))) r2--;
  return [r1, r2];
}

/** 정렬 차례 열쇠: 수 → 글 → 참거짓 → 오류, 빈 칸은 늘 맨 아래 */
type SortKey = { kind: 0; n: number } | { kind: 1 | 3; s: string } | { kind: 2; b: boolean } | { kind: 4 };

function sortKey(t: EntryTable, r: number, c: number): SortKey {
  const k = anchorOf(t, r, c);
  const cell = cellAt(t, k.r, k.c);
  if (!cell || cell.v === '') return { kind: 4 };
  const n = cellNumber(cell);
  if (n !== null) return { kind: 0, n };
  if (cell.f && (cell.v === 'TRUE' || cell.v === 'FALSE')) return { kind: 2, b: cell.v === 'TRUE' };
  if (cell.f && FORMULA_ERRORS[cell.v]) return { kind: 3, s: cell.v };
  return { kind: 1, s: cell.v };
}

/** 글 견주기 - 가나다, 숫자 섞인 글은 수 차례('2번' < '10번'), 대소문자 없이 */
const collator = new Intl.Collator('ko', { numeric: true, sensitivity: 'accent' });

function compareKeys(a: SortKey, b: SortKey, desc: boolean): number {
  if (a.kind === 4 || b.kind === 4) return a.kind === b.kind ? 0 : a.kind === 4 ? 1 : -1;
  const sign = desc ? -1 : 1;
  if (a.kind !== b.kind) return sign * (a.kind - b.kind);
  if (a.kind === 0) return sign * Math.sign(a.n - (b as { n: number }).n);
  if (a.kind === 2) return sign * (Number(a.b) - Number((b as { b: boolean }).b));
  return sign * collator.compare(a.s, (b as { s: string }).s);
}

/**
 * 행 r1~r2를 열 key로 정렬한다 (desc = 큰 것부터). 위아래로 병합된 칸이 걸치면 하지 않는다(옆 병합은 행과 함께 옮긴다).
 * 고른 칸은 그대로(엑셀처럼), 바뀐 것이 없으면 그 표 그대로.
 */
export function sortTable(t: EntryTable, r1: number, r2: number, key: number, desc: boolean): ToolResult {
  if (r2 <= r1) return { error: '정렬할 행이 둘 이상이어야 합니다 - 정렬할 행들을 골라 주세요' };
  for (let r = r1; r <= r2; r++)
    if (t.rows[r].cells.some((cell, c) => (cell.rs ?? 1) > 1 || (cell.x && anchorOf(t, r, c).r !== r))) return { error: MERGED_TEXT };
  const items = t.rows.slice(r1, r2 + 1).map((row, i) => ({ row, from: r1 + i, k: sortKey(t, r1 + i, key) }));
  items.sort((a, b) => compareKeys(a.k, b.k, desc));
  if (items.every((it, i) => it.from === r1 + i)) return { table: t };
  const rows = [...t.rows];
  items.forEach((it, i) => {
    const dr = r1 + i - it.from;
    rows[r1 + i] =
      dr && it.row.cells.some((cell) => cell.f)
        ? { ...it.row, cells: it.row.cells.map((cell) => (cell.f ? { ...cell, f: moveFormula(cell.f, dr, 0) } : cell)) }
        : it.row;
  });
  return { table: recalcTable({ ...t, rows }) };
}

/** 정렬 뒤 안내 ('2~31행을 B열 큰 것부터 정렬했습니다') */
export const sortNote = (r1: number, r2: number, key: number, desc: boolean) =>
  `${r1 + 1}~${r2 + 1}행을 ${colName(key)}열 ${desc ? '큰 것부터' : '작은 것부터'} 정렬했습니다 (↶로 되돌립니다)`;
