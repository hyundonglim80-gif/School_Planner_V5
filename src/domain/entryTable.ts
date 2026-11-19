// 메모·기록에 붙이는 표 (V4 lib/entryTable.ts 그대로 - 2026-09-30 사용자와 정함).
//   - 엑셀·한셀·구글 시트에서 복사해 본문에 붙여넣으면 서식째 표로 붙는다.
//     살리는 것: 보이는 값, 병합, 배경색, 글자색·굵게·기울임·밑줄·크기, 정렬, 테두리, 대각선, 열 너비, 줄 높이.
//     못 살리는 것: 수식(계산된 값만 온다), 차트·그림, 메모(주석), 데이터 유효성.
//   - 붙인 뒤에는 칸 글자만 고치고, 줄·열을 더하고 뺀다(domain/tableEdit). 서식을 크게 바꿀 때는 다시 붙여넣는다.
//   - 본문 아래 첨부처럼 둔다(항목의 tables 칸). V5는 글 없이 표만 있어도 저장한다(V4의 '[표]' 글은 없다).
//   - 그리기(칸 서식 → 화면 스타일·칸 수)는 domain/tableCss - 카드가 부르는 첫 화면 몫이라 이 파일(붙여넣기 읽기)과 나눴다(P48-1).
//
// 저장 모양(data/types EntryTable): Firestore는 배열 안의 배열을 받지 않으므로 rows는 { cells: [...] }의 배열이다.
// 칸은 표 전체를 채우는 격자로 둔다. 병합된 칸의 나머지 자리는 { v: '', x: 1 } (가려진 칸).
// 같은 서식은 styles에 한 번만 두고 칸은 번호(s)로 가리킨다 - 크기를 줄인다.
import type { EntryTable, TableCell, TableCellStyle, TableRow } from '../data/types';
import { tableSize } from './tableCss';

export type { EntryTable, TableCell, TableCellStyle, TableRow };

/** 표 하나에 둘 수 있는 칸 수 (V4와 같게 - 문서 하나 최대 1MB) */
export const MAX_TABLE_CELLS = 3000;
/** 저장 모양(JSON)의 글자 수 한도 */
export const MAX_TABLE_JSON = 200_000;

export const newTableId = () => 'tb_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);

// ───────────────────────── 붙여넣은 HTML 읽기 ─────────────────────────

type Decls = Record<string, string>;

/** 'a:b; c:d' → { a: 'b', c: 'd' } (소문자 키) */
function parseDecls(text: string): Decls {
  const out: Decls = {};
  for (const part of text.split(';')) {
    const i = part.indexOf(':');
    if (i < 0) continue;
    const k = part.slice(0, i).trim().toLowerCase();
    const v = part.slice(i + 1).trim();
    if (k) out[k] = v;
  }
  return out;
}

/** <style> 안의 '.xl65 {…}', 'td {…}' 규칙. 엑셀은 칸 서식을 거의 모두 클래스로 준다 */
function parseStyleRules(doc: Document): { byClass: Record<string, Decls>; td: Decls } {
  const byClass: Record<string, Decls> = {};
  let td: Decls = {};
  const css = [...doc.querySelectorAll('style')].map((s) => s.textContent || '').join('\n');
  // 주석(<!-- -->, /* */)을 걷어낸다
  const text = css.replace(/<!--|-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const decls = parseDecls(m[2]);
    for (const sel of m[1].split(',').map((s) => s.trim())) {
      if (sel === 'td' || sel === 'th') td = { ...td, ...decls };
      else {
        const cm = /^(?:td)?\.([\w-]+)$/.exec(sel);
        if (cm) byClass[cm[1]] = { ...(byClass[cm[1]] || {}), ...decls };
      }
    }
  }
  return { byClass, td };
}

const NAMED: Record<string, string> = {
  black: '#000000',
  white: '#ffffff',
  red: '#ff0000',
  green: '#008000',
  blue: '#0000ff',
  yellow: '#ffff00',
  gray: '#808080',
  grey: '#808080',
  silver: '#c0c0c0',
  windowtext: '#000000',
  window: '#ffffff',
};

/** 믿을 수 있는 색만 받는다 (#rgb, #rrggbb, rgb(), 이름 몇 개). 나머지는 버린다 */
export function safeColor(raw?: string): string | undefined {
  if (!raw) return undefined;
  const v = raw.trim().toLowerCase().replace(/\s*!important$/, '');
  if (/^#[0-9a-f]{3}$|^#[0-9a-f]{6}$/.test(v)) return v;
  const rgb = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*([\d.]+)\s*)?\)$/.exec(v);
  if (rgb) {
    if (rgb[4] !== undefined && Number(rgb[4]) === 0) return undefined; // 투명
    const hex = [rgb[1], rgb[2], rgb[3]].map((n) => Math.min(255, Number(n)).toString(16).padStart(2, '0')).join('');
    return `#${hex}`;
  }
  return NAMED[v];
}

/** 길이 → px. 엑셀은 pt(.5pt 등), 시트는 px */
function toPx(raw: string): number | undefined {
  const m = /^([\d.]+)\s*(pt|px)?$/.exec(raw.trim());
  if (!m) return undefined;
  const n = Number(m[1]);
  return m[2] === 'pt' ? n * (4 / 3) : n;
}

/** 'border-top: .5pt solid windowtext' 같은 값 → '1px solid #000000'. 없음이면 undefined */
function parseBorder(raw?: string): string | undefined {
  if (!raw) return undefined;
  const v = raw.trim().toLowerCase();
  if (!v || v === 'none' || v.startsWith('0 ') || v === '0') return undefined;
  const parts = v.split(/\s+/);
  let width = 1;
  let style = 'solid';
  let color = '#000000';
  for (const p of parts) {
    if (/^(solid|dashed|dotted|double)$/.test(p)) style = p;
    else if (p === 'none' || p === 'hidden') return undefined;
    else if (p === 'thin') width = 1;
    else if (p === 'medium') width = 2;
    else if (p === 'thick') width = 3;
    else if (/^[\d.]+(pt|px)?$/.test(p)) {
      const px = toPx(p);
      if (px !== undefined) width = px <= 1.2 ? 1 : px <= 2.2 ? 2 : 3;
    } else {
      const c = safeColor(p);
      if (c) color = c;
    }
  }
  if (style === 'double') width = 3;
  return `${width}px ${style} ${color}`;
}

function styleFromDecls(d: Decls, attrs: { align?: string | null; valign?: string | null; isNum: boolean }): TableCellStyle {
  const s: TableCellStyle = {};
  const bg = safeColor(d['background-color'] || d['background']?.split(/\s+/)[0]);
  if (bg && bg !== '#ffffff') s.bg = bg;
  const c = safeColor(d['color']);
  if (c && c !== '#000000') s.c = c;
  const fw = (d['font-weight'] || '').toLowerCase();
  if (fw === 'bold' || fw === 'bolder' || Number(fw) >= 600) s.b = 1;
  if ((d['font-style'] || '').toLowerCase() === 'italic') s.i = 1;
  const deco = `${d['text-decoration'] || ''} ${d['text-decoration-line'] || ''}`.toLowerCase();
  const msoU = (d['text-underline-style'] || '').toLowerCase();
  if (deco.includes('underline') || (msoU && msoU !== 'none')) s.u = 1;
  const fs = d['font-size'] ? toPx(d['font-size'].replace(/\s*!important$/, '')) : undefined;
  // 표준 크기(11pt·10pt 언저리)는 적지 않는다 - 크기가 다른 칸만
  if (fs !== undefined && fs > 0) {
    const pt = Math.round((fs * 3) / 4 * 2) / 2;
    if (pt < 9.5 || pt > 11.5) s.fs = Math.min(36, Math.max(6, pt));
  }
  const ta = (d['text-align'] || attrs.align || '').toLowerCase();
  if (ta === 'center' || ta === 'centre' || ta === 'center-across') s.ha = 'center';
  else if (ta === 'right') s.ha = 'right';
  else if (ta === 'left') s.ha = 'left';
  else if (attrs.isNum) s.ha = 'right'; // 엑셀 '일반' 맞춤: 숫자는 오른쪽
  const va = (d['vertical-align'] || attrs.valign || '').toLowerCase();
  if (va === 'top') s.va = 'top';
  else if (va === 'middle' || va === 'center') s.va = 'middle';
  const ws = (d['white-space'] || '').toLowerCase();
  if (ws === 'normal' || ws === 'pre-wrap') s.wrap = 1;
  const all = parseBorder(d['border']);
  const bt = parseBorder(d['border-top']) ?? all;
  const br = parseBorder(d['border-right']) ?? all;
  const bb = parseBorder(d['border-bottom']) ?? all;
  const bl = parseBorder(d['border-left']) ?? all;
  if (bt) s.bt = bt;
  if (br) s.br = br;
  if (bb) s.bb = bb;
  if (bl) s.bl = bl;
  // 대각선: 엑셀은 mso-diagonal-down/up으로 준다 (구글 시트에는 대각선이 없다)
  const dd = parseBorder(d['mso-diagonal-down']);
  const du = parseBorder(d['mso-diagonal-up']);
  if (dd) s.dd = dd;
  if (du) s.du = du;
  return s;
}

/**
 * 칸의 보이는 글.
 *   - <br>만 줄 바꿈이다. HTML 안의 줄 바꿈·들여쓰기(엑셀은 긴 칸을 여러 줄로 적는다)는 공백 하나.
 *   - &nbsp;(엑셀이 앞에 넣은 공백을 보내는 모양)는 그대로 살린다. 대각선 머리칸의 "    요일 / 교시"처럼
 *     공백으로 글자 자리를 맞춘 것이 흐트러지지 않게.
 *   - 공백뿐인 칸은 빈 칸.
 */
function cellText(el: Element): string {
  const BR = '\u2028';
  const clone = el.cloneNode(true) as Element;
  clone.querySelectorAll('br').forEach((br) => br.replaceWith(BR));
  // 엑셀은 숨긴 글(mso-hide)이나 <style>을 칸 안에 두지 않지만, 웹에서 복사한 표는 그럴 수 있다
  clone.querySelectorAll('style,script').forEach((n) => n.remove());
  const text = (clone.textContent || '').replace(/[ \t\r\n\f\v]+/g, ' ');
  const lines = text.split(BR).map((line) => line.replace(/^ +| +$/g, '').replace(/\u00a0/g, ' '));
  const joined = lines.join('\n').replace(/^\n+|\n+$/g, '');
  return joined.trim() === '' ? '' : joined;
}

function styleKey(s: TableCellStyle): string {
  return JSON.stringify(
    Object.keys(s)
      .sort()
      .map((k) => [k, s[k as keyof TableCellStyle]]),
  );
}

/**
 * 붙여넣은 HTML에서 첫 번째 표를 읽는다. 표가 없으면 null.
 * 칸이 너무 많으면 { error }를 돌려준다.
 */
export function parseClipboardTable(html: string): EntryTable | { error: string } | null {
  if (!html || !/<table[\s>]/i.test(html)) return null;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const table = doc.querySelector('table');
  if (!table) return null;
  const { byClass, td: tdDefault } = parseStyleRules(doc);

  const trs = [...table.querySelectorAll('tr')].filter((tr) => tr.closest('table') === table);
  if (trs.length === 0) return null;

  // 격자 채우기 (colspan/rowspan)
  const grid: (TableCell | undefined)[][] = [];
  const heights: (number | undefined)[] = [];
  const styles: TableCellStyle[] = [];
  const styleIndex = new Map<string, number>();
  const styleOf = (s: TableCellStyle): number | undefined => {
    if (Object.keys(s).length === 0) return undefined;
    const k = styleKey(s);
    let i = styleIndex.get(k);
    if (i === undefined) {
      i = styles.length;
      styles.push(s);
      styleIndex.set(k, i);
    }
    return i;
  };

  let cellCount = 0;
  trs.forEach((tr, r) => {
    grid[r] = grid[r] || [];
    const trDecls = parseDecls(tr.getAttribute('style') || '');
    const h = tr.getAttribute('height') ? Number(tr.getAttribute('height')) : trDecls['height'] ? toPx(trDecls['height']) : undefined;
    heights[r] = h && Number.isFinite(h) ? Math.round(h) : undefined;
    let c = 0;
    for (const td of [...tr.children].filter((el) => /^(td|th)$/i.test(el.tagName))) {
      while (grid[r][c]) c++;
      const cs = Math.max(1, Math.min(100, Number(td.getAttribute('colspan')) || 1));
      const rs = Math.max(1, Math.min(500, Number(td.getAttribute('rowspan')) || 1));
      const classDecls = (td.getAttribute('class') || '')
        .split(/\s+/)
        .filter(Boolean)
        .reduce<Decls>((acc, cls) => ({ ...acc, ...(byClass[cls] || {}) }), {});
      const decls = { ...tdDefault, ...classDecls, ...parseDecls(td.getAttribute('style') || '') };
      const isNum = td.hasAttribute('x:num') || /^[-+]?[\d,]+(\.\d+)?%?$/.test(cellText(td));
      const style = styleFromDecls(decls, { align: td.getAttribute('align'), valign: td.getAttribute('valign'), isNum });
      if (td.tagName.toLowerCase() === 'th' && style.b === undefined) style.b = 1;
      const cell: TableCell = { v: cellText(td) };
      if (cs > 1) cell.cs = cs;
      if (rs > 1) cell.rs = rs;
      const si = styleOf(style);
      if (si !== undefined) cell.s = si;
      for (let dr = 0; dr < rs; dr++) {
        grid[r + dr] = grid[r + dr] || [];
        for (let dc = 0; dc < cs; dc++) {
          if (dr === 0 && dc === 0) grid[r][c] = cell;
          else grid[r + dr][c + dc] = { v: '', x: 1 };
        }
      }
      cellCount += cs * rs;
      if (cellCount > MAX_TABLE_CELLS * 2) break;
      c += cs;
    }
  });

  const nRows = grid.length;
  const nCols = Math.max(0, ...grid.map((row) => row.length));
  if (nRows * nCols > MAX_TABLE_CELLS) {
    return { error: `표가 너무 큽니다 (${nRows}줄 × ${nCols}열). ${MAX_TABLE_CELLS}칸까지 붙일 수 있습니다.` };
  }

  // 열 너비: <col width> (span 포함). 없으면 첫 줄 칸의 width
  const cols: number[] = [];
  for (const col of [...table.querySelectorAll('col')]) {
    const span = Math.max(1, Number(col.getAttribute('span')) || 1);
    const decls = parseDecls(col.getAttribute('style') || '');
    const w = col.getAttribute('width') ? Number(col.getAttribute('width')) : decls['width'] ? toPx(decls['width']) : 0;
    for (let i = 0; i < span; i++) cols.push(w && Number.isFinite(w) ? Math.round(w) : 0);
  }

  const rows: TableRow[] = grid.map((row, r) => {
    const cells: TableCell[] = [];
    for (let c = 0; c < nCols; c++) cells.push(row[c] ?? { v: '' });
    return heights[r] ? { h: heights[r], cells } : { cells };
  });

  const out: EntryTable = { id: newTableId(), rows, createdAt: Date.now() };
  const trimmedCols = cols.slice(0, nCols);
  if (trimmedCols.some((w) => w > 0)) out.cols = [...trimmedCols, ...Array(Math.max(0, nCols - trimmedCols.length)).fill(0)];
  if (styles.length) out.styles = styles;
  if (JSON.stringify(out).length > MAX_TABLE_JSON) {
    return { error: '표가 너무 큽니다. 범위를 나눠서 붙여 주세요.' };
  }
  return out;
}

/** 칸이 둘 이상인 표만 표로 붙인다. 한 칸만 복사했으면 글자로 붙이는 것이 자연스럽다 */
export function isRealTable(t: EntryTable): boolean {
  const { rows, cols } = tableSize(t);
  return rows * cols >= 2;
}

/** 저장된 값을 믿을 수 있는 표 목록으로 (모양이 이상한 것은 뺀다) */
export function normalizeTables(raw: unknown): EntryTable[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((t): t is EntryTable => {
    const rows = (t as { rows?: unknown } | null)?.rows;
    return !!t && typeof t === 'object' && Array.isArray(rows) && rows.every((r) => !!r && Array.isArray((r as { cells?: unknown }).cells));
  });
}
