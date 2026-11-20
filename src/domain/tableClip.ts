// 메모 표와 엑셀·한셀·구글 시트 오가기 (P48-5 - PLAN 5장 'P48' ⓛ).
//   - 고른 범위 Ctrl+C = 보이는 값을 탭 글 + HTML 표(서식째)로 → 엑셀·한셀·구글 시트·다른 메모 본문(새 표)에 붙는다.
//     수 칸은 x:num(원래 수)과 mso-number-format(1,000·원·%·소수 자리)도 함께 - 엑셀이 글이 아닌 수로 받게(엑셀 HTML과 같은 꼴).
//   - 표 칸에 Ctrl+V = 칸이 둘 이상이면 고른 칸부터 값만 채운다(서식은 붙이는 칸 것 그대로) · 모자라면 행·열을 늘린다(3,000칸) ·
//     병합 칸과 겹치면 안내하고 붙이지 않는다 · 한 칸 값에 여러 칸을 고르면 고른 칸 모두에(엑셀처럼).
//   쓰는 칸의 고치는 표(features/notes/TableEditor)만 부른다 - 첫 화면에 들지 않는다.
import type { EntryTable, TableCell, TableCellStyle } from '../data/types';
import { MAX_TABLE_JSON, parseClipboardTable } from './entryTable';
import { cellCss } from './tableCss';
import { canGrow, GROW_LIMIT_TEXT, type CellPos, type CellRange } from './tableEdit';
import { cellWithInput, styleOf } from './tableFormat';
import { adoptFormat, isFormulaText, normalizeFormula, recalcTable } from './tableFormula';
import { cellNumber } from './tableNumber';

/** 병합 칸과 겹칠 때 안내 */
export const PASTE_MERGED_TEXT = '병합된 칸이 있는 자리에는 여러 칸을 붙일 수 없습니다 - 병합하지 않은 칸을 골라 주세요';

// ───────────────────────── 복사 (범위 → 탭 글·HTML) ─────────────────────────

/** 범위 칸들 (가려진 칸은 null) */
function rangeCells(t: EntryTable, g: CellRange): (TableCell | null)[][] {
  const out: (TableCell | null)[][] = [];
  for (let r = g.r1; r <= g.r2; r++) {
    const row: (TableCell | null)[] = [];
    for (let c = g.c1; c <= g.c2; c++) {
      const cell = t.rows[r]?.cells[c];
      row.push(cell && !cell.x ? cell : null);
    }
    out.push(row);
  }
  return out;
}

/** 탭 글 한 칸 - 탭·줄 바꿈이 들었거나 따옴표로 시작하면 따옴표로 묶는다 (엑셀과 같은 꼴, 안의 따옴표는 두 번) */
const tsvField = (v: string) => (/[\t\n\r]/.test(v) || v.startsWith('"') ? `"${v.replace(/"/g, '""')}"` : v);

/** 범위를 탭 글로 (칸 = 탭, 행 = 줄 바꿈 · 병합으로 가려진 칸은 빈 칸) */
export function rangeTsv(t: EntryTable, g: CellRange): string {
  return rangeCells(t, g)
    .map((row) => row.map((cell) => tsvField(cell?.v ?? '')).join('\t'))
    .join('\n');
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** 칸 글 → HTML (줄 바꿈 = <br>, 앞뒤·잇단 빈칸은 &nbsp; - 붙인 쪽이 빈칸을 하나로 줄이지 않게) */
const cellHtml = (v: string) =>
  v
    .split('\n')
    .map((line) => esc(line).replace(/^ | $| (?= )/g, '&nbsp;'))
    .join('<br>');

/** camelCase → kebab-case */
const kebab = (k: string) => k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());

/** 엑셀 표시 형식 - 보이는 글의 소수 자리만큼 ('1,234.50원' → #,##0.00"원"). 서식이 없으면 없음(일반) */
function excelFormat(cell: TableCell, s?: TableCellStyle): string | undefined {
  if (!s || (s.nf === undefined && s.dp === undefined)) return undefined;
  const m = /\.(\d+)/.exec(cell.v);
  const dp = m ? m[1].length : 0;
  const body = (s.nf === 'comma' || s.nf === 'won' ? '#,##0' : '0') + (dp ? '.' + '0'.repeat(dp) : '');
  if (s.nf === 'pct') return body + '%';
  if (s.nf === 'won') return body + '"원"';
  return body;
}

/** 칸 서식 → style 글 (대각선 그림 대신 엑셀의 mso-diagonal, 수 칸은 표시 형식) */
function cellStyleText(cell: TableCell, s: TableCellStyle | undefined, isNum: boolean): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(cellCss(s))) {
    if (k.startsWith('background') && k !== 'backgroundColor') continue;
    parts.push(`${kebab(k)}:${v}`);
  }
  if (s?.dd) parts.push(`mso-diagonal-down:${s.dd}`);
  if (s?.du) parts.push(`mso-diagonal-up:${s.du}`);
  if (s?.wrap) parts.push('white-space:normal');
  const nf = isNum ? excelFormat(cell, s) : undefined;
  // 엑셀 HTML처럼 따옴표는 \0022 (CSS 글자 안의 따옴표)
  if (nf) parts.push(`mso-number-format:"${nf.replace(/"/g, '\\0022')}"`);
  return parts.join(';');
}

/** 범위를 HTML 표로 (서식·병합·열 너비·줄 높이째) - 엑셀·한셀·구글 시트, 그리고 V5 다른 메모 본문(붙여넣기 읽기 parseClipboardTable)이 받는다 */
export function rangeHtml(t: EntryTable, g: CellRange): string {
  const cols = t.cols?.slice(g.c1, g.c2 + 1);
  const colgroup = cols?.some((w) => w > 0) ? `<colgroup>${cols.map((w) => (w > 0 ? `<col width="${w}">` : '<col>')).join('')}</colgroup>` : '';
  const body = rangeCells(t, g)
    .map((row, i) => {
      const r = g.r1 + i;
      const h = t.rows[r]?.h;
      const tds = row
        .map((cell, j) => {
          if (!cell) return '';
          const c = g.c1 + j;
          const s = styleOf(t, cell);
          const attrs: string[] = [];
          // 병합은 범위 안까지만 (범위가 병합을 통째로 품게 고르지만 - rangeOf - 혹시 모를 때)
          const cs = Math.min(cell.cs ?? 1, g.c2 - c + 1);
          const rs = Math.min(cell.rs ?? 1, g.r2 - r + 1);
          if (cs > 1) attrs.push(`colspan="${cs}"`);
          if (rs > 1) attrs.push(`rowspan="${rs}"`);
          const n = cell.v.trim() ? cellNumber(cell) : null;
          if (n !== null) attrs.push(`x:num="${n}"`);
          const style = cellStyleText(cell, s, n !== null);
          if (style) attrs.push(`style="${esc(style)}"`);
          return `<td${attrs.length ? ' ' + attrs.join(' ') : ''}>${cellHtml(cell.v)}</td>`;
        })
        .join('');
      return `<tr${h ? ` height="${h}"` : ''}>${tds}</tr>`;
    })
    .join('');
  return `<meta charset="utf-8"><table style="border-collapse:collapse">${colgroup}<tbody>${body}</tbody></table>`;
}

// ───────────────────────── 붙여넣기 (클립보드 → 칸 값 격자) ─────────────────────────

/** 다음 탭·줄 바꿈 자리 */
function nextDelim(s: string, i: number): number {
  for (let k = i; k < s.length; k++) if (s[k] === '\t' || s[k] === '\n') return k;
  return s.length;
}

/**
 * 탭 글 → 칸 값 격자. 칸 = 탭, 행 = 줄 바꿈, 따옴표로 묶은 칸은 안의 탭·줄 바꿈·"" 그대로(엑셀이 칸 안 줄 바꿈을 이렇게 준다) ·
 * 맨 끝 줄 바꿈 하나는 버린다(엑셀은 줄마다 끝에 붙인다) · 탭·줄 바꿈이 없는 한 줄은 그대로 한 칸(따옴표도 그대로).
 */
export function parseTsv(text: string): string[][] {
  const s = text.replace(/\r\n?/g, '\n');
  if (!/[\t\n]/.test(s)) return [[s]];
  const rows: string[][] = [];
  let row: string[] = [];
  let i = 0;
  for (;;) {
    let field = '';
    let quoted = false;
    if (s[i] === '"') {
      let j = i + 1;
      let buf = '';
      let closed = false;
      while (j < s.length) {
        if (s[j] === '"') {
          if (s[j + 1] === '"') {
            buf += '"';
            j += 2;
            continue;
          }
          closed = true;
          j++;
          break;
        }
        buf += s[j++];
      }
      // 닫는 따옴표 바로 뒤가 칸·줄 끝일 때만 묶은 칸 - 아니면 따옴표째 글
      if (closed && (j >= s.length || s[j] === '\t' || s[j] === '\n')) {
        field = buf;
        i = j;
        quoted = true;
      }
    }
    if (!quoted) {
      const k = nextDelim(s, i);
      field = s.slice(i, k);
      i = k;
    }
    row.push(field);
    if (i >= s.length) {
      rows.push(row);
      break;
    }
    if (s[i] === '\t') {
      i++;
      continue;
    }
    rows.push(row);
    row = [];
    i++;
    if (i >= s.length) break;
  }
  return rows;
}

/** 붙여넣은 것 → 칸 값 격자. HTML 표가 먼저(엑셀·한셀·구글 시트·V5), 없으면 글. 붙일 것이 없으면 null · 너무 큰 표는 { error } */
export function clipGrid(html: string, text: string): { grid: string[][]; table: boolean } | { error: string } | null {
  const parsed = html ? parseClipboardTable(html) : null;
  if (parsed && 'error' in parsed) return parsed;
  if (parsed) return { grid: parsed.rows.map((row) => row.cells.map((cell) => (cell.x ? '' : cell.v))), table: true };
  if (!text) return null;
  return { grid: parseTsv(text), table: false };
}

/** 격자가 칸 둘 이상인가 */
export const isManyCells = (grid: string[][]) => grid.length > 1 || (grid[0]?.length ?? 0) > 1;

export type PasteResult = { table: EntryTable; sel: CellRange; grown: boolean } | { error: string };

/** 붙일 자리에 병합 칸(가려진 칸·여러 칸을 차지하는 칸)이 있나 (표 안 부분만) */
function hasMerged(t: EntryTable, g: CellRange): boolean {
  for (let r = g.r1; r <= Math.min(g.r2, t.rows.length - 1); r++) {
    const cells = t.rows[r].cells;
    for (let c = g.c1; c <= Math.min(g.c2, cells.length - 1); c++) {
      const cell = cells[c];
      if (cell.x || (cell.cs ?? 1) > 1 || (cell.rs ?? 1) > 1) return true;
    }
  }
  return false;
}

/**
 * 고른 범위(g)의 왼쪽 위 칸부터 값 격자를 채운다 (칸에 친 것과 같게 - 숫자 서식 칸은 서식대로, '='는 식, '로 시작하면 글).
 * 한 칸 값에 여러 칸을 골랐으면 고른 칸 모두에 · 표가 모자라면 아래·오른쪽으로 늘린다(새 칸은 마지막 행·열의 서식 - 식 주소는 그대로).
 * 돌려주는 sel = 채운 범위.
 */
export function pasteGrid(t: EntryTable, g: CellRange, grid: string[][]): PasteResult {
  const nRows = t.rows.length;
  const nCols = t.rows[0]?.cells.length ?? 0;
  const gh = grid.length;
  const gw = Math.max(1, ...grid.map((row) => row.length));
  const one = gh === 1 && gw === 1;
  // 한 칸 값: 한 칸을 골랐으면 그 칸(병합 칸이어도 - 칸에 친 것처럼), 여러 칸이면 고른 칸 모두
  const single = one && g.r1 === g.r2 && g.c1 === g.c2;
  const area: CellRange = one ? g : { r1: g.r1, c1: g.c1, r2: g.r1 + gh - 1, c2: g.c1 + gw - 1 };
  if (single) {
    const k = t.rows[g.r1]?.cells[g.c1];
    if (!k || k.x) return { error: PASTE_MERGED_TEXT };
  } else if (hasMerged(t, area)) return { error: PASTE_MERGED_TEXT };
  const addR = Math.max(0, area.r2 + 1 - nRows);
  const addC = Math.max(0, area.c2 + 1 - nCols);
  if ((addR || addC) && !canGrow(t, addR, addC)) return { error: GROW_LIMIT_TEXT };

  // 표를 한 번 베끼고 늘린다 (붙이기는 끝에 덧대기 - 행 넣기와 달리 식 주소는 옮기지 않는다)
  const rows = t.rows.map((row) => ({ ...row, cells: row.cells.map((cell) => ({ ...cell })) }));
  if (addC) {
    for (const row of rows) {
      const last = row.cells[row.cells.length - 1];
      const s = last && !last.x ? last.s : undefined;
      for (let i = 0; i < addC; i++) row.cells.push(s !== undefined ? { v: '', s } : { v: '' });
    }
  }
  const model = rows[rows.length - 1];
  for (let i = 0; i < addR; i++) {
    const cells: TableCell[] = model.cells.map((cell) => (cell.s !== undefined && !cell.x ? { v: '', s: cell.s } : { v: '' }));
    rows.push(model.h ? { h: model.h, cells } : { cells });
  }
  let out: EntryTable = { ...t, rows };
  if (addC && t.cols) out.cols = [...t.cols, ...Array(addC).fill(t.cols[t.cols.length - 1] ?? 0)];

  const fresh: CellPos[] = [];
  for (let r = area.r1; r <= area.r2; r++) {
    for (let c = area.c1; c <= area.c2; c++) {
      const v = one ? grid[0][0] : grid[r - area.r1]?.[c - area.c1];
      if (v === undefined) continue;
      const cell = rows[r].cells[c];
      if (!cell || cell.x) continue;
      if (isFormulaText(v)) {
        if (!cell.f) fresh.push({ r, c });
        const next: TableCell = { ...cell, f: normalizeFormula(v) };
        rows[r].cells[c] = next;
      } else {
        const next = cellWithInput(cell, v.startsWith("'") ? v.slice(1) : v, styleOf(out, cell));
        delete next.f;
        rows[r].cells[c] = next;
      }
    }
  }
  // 처음 넣는 식은 처음 가리킨 수 칸의 1,000·원·%를 따른다 (칸에 친 것과 같게 - P48-3)
  for (const p of fresh) out = adoptFormat(out, p.r, p.c);
  out = recalcTable(out);
  if (JSON.stringify(out).length > MAX_TABLE_JSON) return { error: '표가 너무 큽니다. 범위를 나눠서 붙여 주세요.' };
  return { table: out, sel: area, grown: addR > 0 || addC > 0 };
}
