// 메모·기록 표를 그리는 데 쓰는 것 (P48-1 - domain/entryTable에서 나눔).
//   카드·보기 칸·연결 창이 부르는 표 그리기(features/notes/EntryTableView)는 첫 화면에 든다 → 그리기만 가볍게 여기에 두고,
//   붙여넣은 HTML 읽기(domain/entryTable)·고치기(domain/tableEdit)는 쓰는 칸만 받는다.
import type { EntryTable, TableCell, TableCellStyle } from '../data/types';
import { isNumberCell } from './tableNumber';

/** 칸이 모두 비었나 (글이 하나도 없다) - 저장 때 뺀다(빈 메모 규칙과 같게, P48-1 ▦ 표). 메모 저장 모양(noteForm)이 불러 여기(가벼운 쪽)에 둔다 */
export const isBlankTable = (t: EntryTable) => t.rows.every((row) => row.cells.every((c) => !c.v.trim() && !c.f));

/** 저장할 표 - 칸이 모두 빈 표는 뺀다 */
export const keptTables = (tables: EntryTable[]) => tables.filter((t) => !isBlankTable(t));

/** 표 칸 수 (가려진 칸 포함한 격자) */
export function tableSize(t: EntryTable): { rows: number; cols: number } {
  return { rows: t.rows.length, cols: t.rows[0]?.cells.length ?? 0 };
}

/**
 * 대각선을 칸 배경으로 그린다. 칸 크기에 맞춰 늘어나는 SVG 선이라, 굵기는 그대로 두고
 * 점선·파선도 그린다. 색은 safeColor를 거친 #rrggbb 뿐이라 URL에 그대로 넣어도 안전하다.
 */
function diagonalImage(spec: string, down: boolean): string | undefined {
  const m = /^(\d)px (solid|dashed|dotted|double) (#[0-9a-f]{3,6})$/.exec(spec);
  if (!m) return undefined;
  const width = m[2] === 'double' ? 1 : Number(m[1]);
  const dash = m[2] === 'dashed' ? " stroke-dasharray='6 3'" : m[2] === 'dotted' ? " stroke-dasharray='1 2'" : '';
  const [y1, y2] = down ? [0, 100] : [100, 0];
  const line = (offset: number) =>
    `<line x1='0' y1='${y1 + offset}' x2='100' y2='${y2 + offset}' stroke='${m[3]}' stroke-width='${width}' vector-effect='non-scaling-stroke'${dash}/>`;
  // 이중선은 가는 선 두 줄
  const lines = m[2] === 'double' ? line(-1.5) + line(1.5) : line(0);
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' preserveAspectRatio='none'>${lines}</svg>`;
  return `url("data:image/svg+xml,${svg.replace(/#/g, '%23').replace(/</g, '%3C').replace(/>/g, '%3E')}")`;
}

/** 칸 서식 → 화면 스타일 */
export function cellCss(s?: TableCellStyle): Record<string, string | number> {
  if (!s) return {};
  const css: Record<string, string | number> = {};
  if (s.bg) css.backgroundColor = s.bg;
  if (s.c) css.color = s.c;
  if (s.b) css.fontWeight = 700;
  if (s.i) css.fontStyle = 'italic';
  if (s.u) css.textDecoration = 'underline';
  if (s.fs) css.fontSize = `${s.fs}pt`;
  if (s.ha) css.textAlign = s.ha;
  if (s.va) css.verticalAlign = s.va;
  if (s.bt) css.borderTop = s.bt;
  if (s.br) css.borderRight = s.br;
  if (s.bb) css.borderBottom = s.bb;
  if (s.bl) css.borderLeft = s.bl;
  const diagonals = [s.dd && diagonalImage(s.dd, true), s.du && diagonalImage(s.du, false)].filter(Boolean);
  if (diagonals.length) {
    css.backgroundImage = diagonals.join(', ');
    css.backgroundSize = '100% 100%';
    css.backgroundRepeat = 'no-repeat';
  }
  return css;
}

/** 눈금선 - 테두리가 없는 칸에 엑셀처럼 옅은 선 (엑셀은 눈금선을 복사하지 않는다) */
export const GRID_LINE = '1px solid #e2e8f0';

/** 표 바탕 - 어두운 화면에서도 흰 종이 (엑셀에서 붙인 색이 그대로 보이게) */
export const TABLE_STYLE: Record<string, string | number> = { fontSize: '10pt', lineHeight: 1.35, color: '#1e293b', backgroundColor: '#ffffff' };

/** 칸 하나의 기본 모양 + 서식. 맞춤을 정하지 않은 수 칸은 오른쪽 (엑셀 '일반' 맞춤 - P48-2, 붙여넣기는 이미 적어 둔다) */
export function baseCellCss(style?: TableCellStyle, cell?: Pick<TableCell, 'v' | 'n'>): Record<string, string | number> {
  return {
    border: GRID_LINE,
    padding: '2px 6px',
    verticalAlign: 'bottom',
    whiteSpace: style?.wrap ? 'pre-wrap' : 'pre',
    ...(!style?.ha && cell && isNumberCell(cell) ? { textAlign: 'right' } : {}),
    ...cellCss(style),
  };
}
