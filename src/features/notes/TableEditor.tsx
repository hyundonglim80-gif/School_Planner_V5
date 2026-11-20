// 쓰는 칸(NotePanel)에서 고치는 표 (P48-1 - V4 EntryTableView의 고치기 부분을 나눔, 쓰는 칸만 받는다).
//   - 칸을 누르면 고친다(그대로). Enter = 넣고 아래 칸, Tab / Shift+Tab = 옆 칸(마지막 칸에서 Tab = 새 행 - 워드처럼),
//     Alt+Enter = 칸 안 줄 바꿈, ESC = 고치기 취소. 행·열을 늘려도 표 하나 3,000칸까지(붙여넣기와 같은 한도).
//   - 고르기(엑셀처럼 - PLAN 5장 'P48' ⓒ): 위 A·B·C / 왼쪽 1·2·3 띠 · 띠 왼쪽 칸 이름 줄 · Shift+누르기 = 범위 · 열 머리·행 번호 = 그 열·행(Shift로 여러 개).
//     고르기 상태(ESC로 고치기를 멈춘 뒤·Enter/Tab으로 넣은 뒤): 방향키·Shift+방향키 = 옮기기·늘리기, Enter·F2 = 고치기, 글자를 치면 그 칸을 새로,
//     Delete·Backspace = 비우기, Ctrl+Z = ↶ 되돌리기(표 안에서만 50번), Ctrl+A = 표 전체, ESC = 고르기 풀기(한 번 더 = 전역 ESC - 쓰는 칸이 닫힌다).
//   - 글 칸은 표 위에 하나만 떠 있다(고른 칸 자리). 고르기 상태에서도 초점은 그 글 칸(보이지 않게) - 앱의 글자 단축키(숫자·Space)가 끼어들지 않고,
//     한글 첫 글자도 그 칸에서 조합이 이어진다(칸마다 글 칸을 새로 그리면 조합이 끊긴다).
//   - 고치던 글은 Ctrl+S에도 함께 저장된다(누른 그때 표에 넣는다 - 쓰는 칸의 Ctrl+S는 document에서 받는다).
//   - 띠 둘째 줄(P48-2 - PLAN 5장 'P48' ⓔ·ⓕ): 1,000 · 원 · % · 소수 −/+ · 굵게 · 맞춤 ▾ · 칸 색 ▾ - 고른 칸·범위에, 다시 누르면 풂, ↶로 되돌림.
//     서식을 입힌 칸은 보이는 글('1,234원')을 v에, 원래 수를 n에 - 고칠 때는 원래 수(1234)가 보인다. Ctrl+B = 굵게(엑셀처럼).
//   - 식(P48-3 - PLAN 5장 'P48' ⓖ·ⓗ, 셈은 domain/tableFormula): '='로 시작하면 식 - 칸을 누르면 식, 떠나면 결과, 칸 이름 줄에 식.
//     표를 바꿀 때마다(칸·행/열·서식·↶) 표 전체를 다시 셈한다 · 오류 칸에 마우스를 올리면 쉬운 까닭 · '로 시작하면 글.
//   - Σ ▾ · ⇣ 채우기 · 정렬 ▾ (P48-4 - PLAN 5장 'P48' ⓘ~ⓚ, 셈은 domain/tableTools): Σ = 위(없으면 왼쪽)의 수를 묶은 식, 범위면 그 아래에 열마다 ·
//     ⇣ = 맨 위 칸을 아래로(식은 주소를 따라) · 정렬 = 고른 칸의 열로 행째(제목·합계 줄은 그대로), 끝나면 안내. 모두 ↶로 되돌린다.
//   단추의 data-table-op 이름은 '단추 대신 누르기' 키가 쓴다 - 바꾸지 않는다.
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent } from 'react';
import { flushSync } from 'react-dom';
import { showToast } from '../../app/toast';
import { isSaveKey } from '../../ui/useSaveKey';
import { baseCellCss, TABLE_STYLE, tableSize } from '../../domain/tableCss';
import {
  anchorOf,
  canGrow,
  cellName,
  clearRange,
  colName,
  deleteCols,
  deleteRows,
  GROW_LIMIT_TEXT,
  inRange,
  insertCol,
  insertRow,
  moveCell,
  rangeName,
  rangeOf,
  setCellText,
  type CellPos,
  type CellRange,
} from '../../domain/tableEdit';
import { editText, FILL_COLORS, setAlign, setFill, setNumberFormat, stepDecimals, styleOf, toggleBold, type NumFormat } from '../../domain/tableFormat';
import { formulaErrorReason, recalcTable } from '../../domain/tableFormula';
import { AUTO_FNS, autoSum, fillDown, sortNote, sortRowsOf, sortTable, type AutoFn, type ToolResult } from '../../domain/tableTools';
import type { EntryTable } from '../../data/types';
import { TableColGroup } from './EntryTableView';

interface Props {
  table: EntryTable;
  onChange: (next: EntryTable) => void;
  onRemove?: () => void;
  /** 제목 줄에 보일 이름 (예: '표 1') */
  title?: string;
  /** 처음 그릴 때 A1을 고치는 상태로 (▦ 표로 막 만든 빈 표) */
  autoEdit?: boolean;
}

/** 고른 칸: a = 처음 고른 칸(글 칸이 서는 곳), b = 범위의 다른 끝 */
interface Sel {
  a: CellPos;
  b: CellPos;
}

/** ↶ 되돌리기 - 쓰는 칸을 닫으면 사라진다 */
const UNDO_LIMIT = 50;
/** 행 번호 칸 폭 (열 너비가 있는 표의 colgroup 앞자리) */
const ROW_HEAD_W = 28;
const SEL_TINT = 'inset 0 0 0 9999px rgba(37, 99, 235, 0.12)';
const ARROWS: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };

export default function TableEditor({ table, onChange, onRemove, title, autoEdit }: Props) {
  const { rows: nRows, cols: nCols } = tableSize(table);
  // 막 만든 빈 표만 (A1이 비었을 때) - 화면 폭이 바뀌어 칸이 다시 그려질 때 적어 둔 A1을 빈 글로 덮지 않게 (P48-2 찾아 고침)
  const firstOk = !!autoEdit && !!table.rows[0]?.cells[0] && !table.rows[0].cells[0].x && table.rows[0].cells[0].v === '';
  const [sel, setSel] = useState<Sel | null>(() => (firstOk ? { a: { r: 0, c: 0 }, b: { r: 0, c: 0 } } : null));
  /** 고른 칸(sel.a)의 글을 고치는 중 */
  const [editing, setEditing] = useState(firstOk);
  const [draft, setDraft] = useState('');
  const [history, setHistory] = useState<EntryTable[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  /** 다음 그림 뒤에 글 칸에 초점 ('end' = 글 끝에 커서, 수 = 그 자리에 커서) · 고른 칸이 보이게 스크롤 */
  const wantFocus = useRef<false | 'keep' | 'end' | number>(firstOk ? 'end' : false);
  const wantScroll = useRef(false);

  // 줄·열이 줄어 고른 칸이 표 밖이면 맞춘다 (되돌리기 뒤)
  const clamp = (p: CellPos): CellPos => ({ r: Math.max(0, Math.min(p.r, nRows - 1)), c: Math.max(0, Math.min(p.c, nCols - 1)) });
  const live = sel && nRows > 0 && nCols > 0 ? { a: clamp(sel.a), b: clamp(sel.b) } : null;
  const active = live ? anchorOf(table, live.a.r, live.a.c) : null;
  const range = live ? rangeOf(table, live.a, live.b) : null;
  const activeCell = active ? table.rows[active.r]?.cells[active.c] : undefined;
  const activeStyle = activeCell ? styleOf(table, activeCell) : undefined;
  /** 고른 칸을 고칠 때 보이는 글 (서식을 입힌 수는 원래 수 - '1,234원' → 1234) */
  const activeValue = activeCell ? editText(activeCell, activeStyle) : '';
  /** 열린 ▾ 고르기 (맞춤·칸 색·Σ·정렬) */
  const [menu, setMenu] = useState<'align' | 'fill' | 'autosum' | 'sort' | null>(null);
  const menuRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!menu) return;
    // 고르기 밖을 누르면 닫는다 (▾ 단추도 안쪽 - 다시 누르면 닫기)
    const close = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenu(null);
    };
    document.addEventListener('pointerdown', close, true);
    return () => document.removeEventListener('pointerdown', close, true);
  }, [menu]);

  // 글 칸을 고른 칸 위에 둔다 (고르기 상태에서는 보이지 않게 - 초점만)
  useLayoutEffect(() => {
    const input = inputRef.current;
    const box = boxRef.current;
    if (!input || !box || !active) return;
    const td = box.querySelector<HTMLElement>(`[data-cell="${active.r}-${active.c}"]`);
    if (td) {
      const br = box.getBoundingClientRect();
      const tr = td.getBoundingClientRect();
      input.style.left = `${tr.left - br.left + box.scrollLeft - box.clientLeft}px`;
      input.style.top = `${tr.top - br.top + box.scrollTop - box.clientTop}px`;
      input.style.minWidth = editing ? `${tr.width}px` : '0';
      input.style.minHeight = editing ? `${tr.height}px` : '0';
      if (wantScroll.current) td.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    }
    wantScroll.current = false;
    if (wantFocus.current) {
      const caret = wantFocus.current;
      wantFocus.current = false;
      input.focus({ preventScroll: true });
      if (caret === 'end') input.setSelectionRange(input.value.length, input.value.length);
      else if (typeof caret === 'number') input.setSelectionRange(caret, caret);
    }
  });

  /** 표를 바꾼다 (↶로 되돌릴 수 있게 앞 모습을 둔다). 식이 있으면 표 전체를 다시 셈한다 - 서식을 바꿔도 식 결과가 그 서식으로 */
  const apply = (next: EntryTable) => {
    if (next === table) return;
    setHistory((h) => [...h.slice(-(UNDO_LIMIT - 1)), table]);
    onChange(recalcTable(next));
  };

  /** 칸을 고른다 (고치기는 멈춘다) */
  const pick = (a: CellPos, b: CellPos = a, focus = true) => {
    setSel({ a, b });
    setEditing(false);
    setDraft('');
    if (focus) wantFocus.current = 'keep';
    wantScroll.current = true;
  };

  const startEdit = (p: CellPos) => {
    const k = anchorOf(table, p.r, p.c);
    setSel({ a: { r: k.r, c: k.c }, b: { r: k.r, c: k.c } });
    setEditing(true);
    const cell = table.rows[k.r].cells[k.c];
    setDraft(editText(cell, styleOf(table, cell)));
    wantFocus.current = 'end';
  };

  /** 고치던 글을 넣은 표 (안 바뀌었으면 그대로) */
  const withDraft = (t: EntryTable) => (editing && active && draft !== activeValue ? setCellText(t, active.r, active.c, draft) : t);

  /** Tab 차례의 다음 칸 (가려진 칸은 건너뛴다, 줄 끝이면 다음 줄) */
  const nextInOrder = (t: EntryTable, p: CellPos, back: boolean): CellPos | null => {
    const rows = t.rows.length;
    const cols = t.rows[0]?.cells.length ?? 0;
    let { r, c } = p;
    for (let i = 0; i < rows * cols; i++) {
      c += back ? -1 : 1;
      if (c >= cols) {
        c = 0;
        r++;
      } else if (c < 0) {
        c = cols - 1;
        r--;
      }
      if (r < 0 || r >= rows) return null;
      if (!t.rows[r].cells[c]?.x) return { r, c };
    }
    return null;
  };

  /** 넣고 옮기기: Enter = 아래, Tab = 옆 (마지막 칸에서 Tab = 새 행). 옮긴 칸은 고르기 상태 */
  const commitMove = (how: 'down' | 'tab' | 'back') => {
    if (!active) return;
    let next = withDraft(table);
    let target: CellPos | null = null;
    if (how === 'down') {
      const m = moveCell(next, { r: active.r, c: active.c }, 1, 0);
      target = m.r !== active.r ? m : null;
    } else {
      target = nextInOrder(next, { r: active.r, c: active.c }, how === 'back');
      if (!target && how === 'tab') {
        if (canGrow(next, 1, 0)) {
          next = insertRow(next, next.rows.length);
          target = nextInOrder(next, { r: active.r, c: active.c }, false);
        } else showToast(GROW_LIMIT_TEXT);
      }
    }
    apply(next);
    const k = target ? anchorOf(next, target.r, target.c) : active;
    pick({ r: k.r, c: k.c });
  };

  const undo = () => {
    // 고치던 글이 있으면 그것부터 (칸 고치기 취소)
    if (editing && draft !== activeValue) {
      setDraft(activeValue);
      wantFocus.current = 'end';
      return;
    }
    const prev = history[history.length - 1];
    if (!prev) return;
    setHistory((h) => h.slice(0, -1));
    onChange(prev);
    setEditing(false);
    setDraft('');
    if (document.activeElement === inputRef.current) wantFocus.current = 'keep';
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing || e.key === 'Process') return;
    if (isSaveKey(e.nativeEvent)) {
      // 고치던 글을 그때 표에 넣는다 - 쓰는 칸의 Ctrl+S(document에서 받는다)가 넣은 표로 저장하게. 키는 막지 않는다
      if (editing) flushSync(() => apply(withDraft(table)));
      return;
    }
    const mod = e.ctrlKey || e.metaKey;
    /** 이 키는 표가 맡았다 - 앱 단축키·브라우저로 가지 않게 */
    const take = () => {
      e.preventDefault();
      e.stopPropagation();
    };
    if (menu && e.key === 'Escape') {
      // 열린 ▾ 고르기만 닫는다
      take();
      setMenu(null);
      return;
    }
    if (mod && !e.altKey && !e.shiftKey && e.code === 'KeyB') {
      // 굵게 (엑셀처럼 - 고치는 중이면 적던 글을 넣고)
      take();
      format(toggleBold);
      return;
    }
    if (editing) {
      if (e.key === 'Escape') {
        // 칸 고치기만 멈춘다(적던 글은 버린다). 쓰는 칸 전체가 닫히면(전역 ESC - window에서 받는다) 적던 것이 사라진다.
        take();
        if (active) pick({ r: active.r, c: active.c });
      } else if (e.key === 'Enter' && e.altKey) {
        // 엑셀처럼 Alt+Enter는 칸 안 줄 바꿈
        take();
        const el = e.currentTarget;
        const { selectionStart: a, selectionEnd: b } = el;
        flushSync(() => setDraft((d) => d.slice(0, a) + '\n' + d.slice(b)));
        el.setSelectionRange(a + 1, a + 1);
      } else if (e.key === 'Enter' && !e.shiftKey && !mod) {
        take();
        commitMove('down');
      } else if (e.key === 'Tab' && !mod) {
        take();
        commitMove(e.shiftKey ? 'back' : 'tab');
      }
      // 방향키·Ctrl+Z 등은 글 칸 그대로 (글 안 커서·글 되돌리기)
      return;
    }
    if (!active || !live) return;
    const dir = ARROWS[e.key];
    if (dir && !mod && !e.altKey) {
      take();
      if (e.shiftKey) {
        setSel({ a: live.a, b: moveCell(table, live.b, dir[0], dir[1]) });
        wantScroll.current = true;
      } else {
        const m = moveCell(table, { r: active.r, c: active.c }, dir[0], dir[1]);
        const k = anchorOf(table, m.r, m.c);
        pick({ r: k.r, c: k.c });
      }
    } else if ((e.key === 'Enter' && !e.shiftKey && !mod && !e.altKey) || e.key === 'F2') {
      take();
      startEdit({ r: active.r, c: active.c });
    } else if (e.key === 'Tab' && !mod) {
      take();
      commitMove(e.shiftKey ? 'back' : 'tab');
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && !mod && !e.altKey) {
      take();
      if (range) apply(clearRange(table, range));
    } else if (e.key === 'Escape') {
      // 고르기 풀기 - 한 번 더 누르면 전역 ESC
      take();
      setSel(null);
    } else if (mod && !e.altKey && !e.shiftKey && e.code === 'KeyZ') {
      take();
      undo();
    } else if (mod && !e.altKey && !e.shiftKey && e.code === 'KeyA') {
      take();
      pick({ r: 0, c: 0 }, { r: nRows - 1, c: nCols - 1 });
    }
  };

  /** 고르기 상태에서 글자를 치면 그 칸을 새로 고친다 (한글 조합도 이 칸에서 이어진다) */
  const onInput = (value: string) => {
    if (!editing) {
      if (!value || !active) return;
      setEditing(true);
      setSel({ a: { r: active.r, c: active.c }, b: { r: active.r, c: active.c } });
    }
    setDraft(value);
  };

  const onBlur = () => {
    // 표 밖을 누르면 고치던 글을 넣는다 (고른 칸은 그대로 둔다 - 단추가 그 칸을 쓴다)
    if (!editing) return;
    apply(withDraft(table));
    setEditing(false);
    setDraft('');
  };

  const onCellClick = (e: MouseEvent, r: number, c: number) => {
    if (e.shiftKey && live) {
      // 범위: 처음 고른 칸은 그대로 (고치던 글은 넣는다)
      apply(withDraft(table));
      setSel({ a: live.a, b: { r, c } });
      setEditing(false);
      setDraft('');
      wantFocus.current = 'keep';
      return;
    }
    apply(withDraft(table));
    startEdit({ r, c });
  };

  /** 열 머리·행 번호 = 그 열·행 전체 (Shift = 처음 고른 칸부터 여러 개) */
  const pickCols = (e: MouseEvent, c: number) => {
    apply(withDraft(table));
    pick({ r: 0, c: e.shiftKey && live ? live.a.c : c }, { r: nRows - 1, c });
  };
  const pickRows = (e: MouseEvent, r: number) => {
    apply(withDraft(table));
    pick({ r: e.shiftKey && live ? live.a.r : r, c: 0 }, { r, c: nCols - 1 });
  };

  const g = range;
  const rowCount = g ? g.r2 - g.r1 + 1 : 0;
  const colCount = g ? g.c2 - g.c1 + 1 : 0;

  /** 행·열 단추 (고친 글을 먼저 넣고) - 바꾼 뒤 고를 칸. 늘리면 3,000칸 한도 */
  const op = (grow: [number, number] | null, fn: (t: EntryTable) => EntryTable, after: (t: EntryTable) => Sel) => {
    const base = withDraft(table);
    if (grow && !canGrow(base, grow[0], grow[1])) {
      showToast(GROW_LIMIT_TEXT);
      return;
    }
    const next = fn(base);
    apply(next);
    const s = after(next);
    pick(s.a, s.b, document.activeElement === inputRef.current);
  };
  /** 서식 단추 (고친 글을 먼저 넣고) - 고른 칸은 그대로, 고치기는 멈춘다 */
  function format(fn: (t: EntryTable, g: CellRange) => EntryTable) {
    setMenu(null);
    if (!g || !live) return;
    apply(fn(withDraft(table), g));
    pick(live.a, live.b, document.activeElement === inputRef.current);
  }
  const numFormat = (nf: NumFormat) => format((t, r) => setNumberFormat(t, r, nf));
  const decimals = (delta: 1 | -1) => format((t, r) => stepDecimals(t, r, live ? live.a : { r: r.r1, c: r.c1 }, delta));

  /** Σ·채우기·정렬의 결과를 표에 (P48-4) - 고를 칸이 오면 그 칸을, 아니면 고른 그대로 · 못 하면 고친 글만 넣고 안내 */
  const finish = (base: EntryTable, res: ToolResult, focused: boolean, done?: string) => {
    if ('error' in res) {
      apply(base);
      showToast(res.error);
    } else {
      apply(res.table);
      const note = res.note ?? done;
      if (note) showToast(note);
    }
    const s = 'error' in res ? undefined : res.sel;
    if (s) pick({ r: s.r1, c: s.c1 }, { r: s.r2, c: s.c2 }, focused);
    else if (live) pick(live.a, live.b, focused);
  };
  /** Σ 자동 합계 (합계·평균·개수·최대·최소) */
  const runAutoSum = (fn: AutoFn) => {
    setMenu(null);
    if (!g || !active) return;
    const focused = document.activeElement === inputRef.current;
    const base = withDraft(table);
    const res = autoSum(base, g, fn);
    if ('edit' in res) {
      // 묶을 수가 없다 - '=SUM()'을 열어 괄호 안에 범위를 적게 (엑셀처럼)
      apply(base);
      setSel({ a: { r: active.r, c: active.c }, b: { r: active.r, c: active.c } });
      setEditing(true);
      setDraft(res.edit);
      wantFocus.current = res.edit.length - 1;
      showToast('묶을 수를 찾지 못했습니다 - 괄호 안에 범위(예: B2:B5)를 적어 주세요');
      return;
    }
    finish(base, res, focused);
  };
  /** ⇣ 아래로 채우기 */
  const runFillDown = () => {
    setMenu(null);
    if (!g) return;
    const focused = document.activeElement === inputRef.current;
    const base = withDraft(table);
    finish(base, fillDown(base, g), focused);
  };
  /** 정렬 (desc = 큰 것부터) - 고른 칸의 열로 */
  const runSort = (desc: boolean) => {
    setMenu(null);
    if (!g || !active) return;
    const focused = document.activeElement === inputRef.current;
    const base = withDraft(table);
    const [r1, r2] = sortRowsOf(base, g);
    const res = sortTable(base, r1, r2, active.c, desc);
    finish(base, res, focused, sortNote(r1, r2, active.c, desc));
  };
  type OpKind = 'rowAbove' | 'rowBelow' | 'rowDelete' | 'colLeft' | 'colRight' | 'colDelete';
  const runOp = (kind: OpKind) => {
    if (!g) return;
    const one = (r: number, c: number): Sel => ({ a: { r, c }, b: { r, c } });
    if (kind === 'rowAbove') op([1, 0], (t) => insertRow(t, g.r1), () => ({ a: { r: g.r1, c: g.c1 }, b: { r: g.r1, c: g.c2 } }));
    else if (kind === 'rowBelow') op([1, 0], (t) => insertRow(t, g.r2 + 1), () => ({ a: { r: g.r2 + 1, c: g.c1 }, b: { r: g.r2 + 1, c: g.c2 } }));
    else if (kind === 'rowDelete') op(null, (t) => deleteRows(t, g.r1, g.r2), (t) => one(Math.min(g.r1, t.rows.length - 1), g.c1));
    else if (kind === 'colLeft') op([0, 1], (t) => insertCol(t, g.c1), () => ({ a: { r: g.r1, c: g.c1 }, b: { r: g.r2, c: g.c1 } }));
    else if (kind === 'colRight') op([0, 1], (t) => insertCol(t, g.c2 + 1), () => ({ a: { r: g.r1, c: g.c2 + 1 }, b: { r: g.r2, c: g.c2 + 1 } }));
    else op(null, (t) => deleteCols(t, g.c1, g.c2), (t) => one(g.r1, Math.min(g.c1, (t.rows[0]?.cells.length ?? 1) - 1)));
  };

  const btn =
    'px-2 py-1 rounded-md text-2xs font-bold border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white cursor-pointer disabled:cursor-default';
  /** 단추·띠를 눌러도 글 칸 초점이 그대로 (고르기 상태가 이어지게) */
  const keepFocus = (e: MouseEvent) => e.preventDefault();
  const canUndo = history.length > 0 || (editing && draft !== activeValue);
  /** 켠 서식 단추 모양 (고른 칸의 서식) */
  const on = (pressed: boolean) => (pressed ? btn.replace('border-slate-200 bg-white text-slate-600', 'border-blue-300 bg-blue-100 text-blue-700') : btn);
  /** ▾ 고르기 상자·줄 */
  const menuBox = 'absolute left-0 top-full mt-1 z-20 flex flex-col min-w-28 p-1 rounded-lg border border-slate-200 bg-white shadow-lg';
  const menuItem = (picked: boolean) =>
    `flex items-center gap-1.5 px-2 py-1 rounded text-left text-2xs font-bold whitespace-nowrap cursor-pointer ${picked ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'}`;
  const head = 'border border-slate-200 bg-slate-100 text-slate-500 font-semibold select-none cursor-pointer hover:bg-slate-200';
  const headOn = 'border border-blue-300 bg-blue-100 text-blue-700 font-bold select-none cursor-pointer';
  const name = g ? rangeName(g) : '';
  const many = rowCount * colCount > 1;

  return (
    // overflow-hidden 없음 - 띠의 ▾ 고르기(맞춤·칸 색)가 표 아래로 펼쳐진다
    <div className="bg-slate-50 border border-slate-200 rounded-xl" data-note-table={table.id}>
      <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 border-b border-slate-200">
        <span className="text-xs font-bold text-slate-600">
          ▦ {title || '표'} <span className="font-normal text-slate-400">· {nRows}행 × {nCols}열</span>
        </span>
        {onRemove && (
          <button
            type="button"
            data-note-table-remove={table.id}
            onClick={onRemove}
            className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0"
            title="표 삭제"
            aria-label={`${title || '표'} 삭제`}
          >
            ✕
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-1 px-2.5 py-1.5 border-b border-slate-200 bg-white/60">
        {/* 칸 이름 줄 - 고른 칸·범위 이름과 그 칸 글 */}
        <span data-table-name={name} className={`mr-1 inline-flex items-center gap-1.5 min-w-0 max-w-full text-2xs ${g ? 'text-slate-600' : 'text-slate-400'}`}>
          {g ? (
            <>
              <b className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-700 tabular-nums">{name}</b>
              {many ? (
                <span className="text-slate-400">
                  {rowCount}행 × {colCount}열
                </span>
              ) : activeValue ? (
                <span className="truncate max-w-40" title={activeValue}>
                  {activeValue.split('\n')[0]}
                </span>
              ) : null}
            </>
          ) : (
            '칸을 누르면 고칩니다'
          )}
        </span>
        <button type="button" onMouseDown={keepFocus} className={btn} disabled={!canUndo} onClick={undo} title="표에서 한 것 되돌리기 (50번까지)" aria-label="표 되돌리기" data-table-op="undo">
          ↶
        </button>
        <button type="button" onMouseDown={keepFocus} className={btn} disabled={!g} onClick={() => runOp('rowAbove')} title="고른 칸 위에 행 넣기" data-table-op="row-above">
          ↑ 행
        </button>
        <button type="button" onMouseDown={keepFocus} className={btn} disabled={!g} onClick={() => runOp('rowBelow')} title="고른 칸 아래에 행 넣기" data-table-op="row-below">
          ↓ 행
        </button>
        <button type="button" onMouseDown={keepFocus} className={btn} disabled={!g || rowCount >= nRows} onClick={() => runOp('rowDelete')} title="고른 칸의 행 빼기" data-table-op="row-delete">
          행 빼기
        </button>
        <button type="button" onMouseDown={keepFocus} className={btn} disabled={!g} onClick={() => runOp('colLeft')} title="고른 칸 왼쪽에 열 넣기" data-table-op="col-left">
          ← 열
        </button>
        <button type="button" onMouseDown={keepFocus} className={btn} disabled={!g} onClick={() => runOp('colRight')} title="고른 칸 오른쪽에 열 넣기" data-table-op="col-right">
          → 열
        </button>
        <button type="button" onMouseDown={keepFocus} className={btn} disabled={!g || colCount >= nCols} onClick={() => runOp('colDelete')} title="고른 칸의 열 빼기" data-table-op="col-delete">
          열 빼기
        </button>
        <span className="relative" ref={menu === 'sort' ? menuRef : undefined}>
          <button
            type="button"
            onMouseDown={keepFocus}
            className={btn}
            aria-expanded={menu === 'sort'}
            disabled={!g || nRows < 2}
            onClick={() => setMenu(menu === 'sort' ? null : 'sort')}
            title="고른 칸의 열로 행을 정렬합니다 (첫 행 제목·맨 아래 합계 줄은 그대로 - 몇 행만 하려면 그 행들을 골라서)"
            data-table-op="sort"
          >
            정렬 ▾
          </button>
          {menu === 'sort' && (
            <span role="menu" className={menuBox}>
              <button type="button" role="menuitem" onMouseDown={keepFocus} onClick={() => runSort(false)} className={menuItem(false)} data-table-op="sort-asc">
                작은 것부터 <span className="font-normal text-slate-400">(가나다)</span>
              </button>
              <button type="button" role="menuitem" onMouseDown={keepFocus} onClick={() => runSort(true)} className={menuItem(false)} data-table-op="sort-desc">
                큰 것부터
              </button>
            </span>
          )}
        </span>
      </div>
      {/* 띠 둘째 줄 - 숫자 서식·꾸밈 (P48-2) */}
      <div className="flex flex-wrap items-center gap-1 px-2.5 py-1.5 border-b border-slate-200 bg-white/60" data-table-format-bar>
        {/* Σ ▾ · ⇣ 채우기 (P48-4) */}
        <span className="relative" ref={menu === 'autosum' ? menuRef : undefined}>
          <button
            type="button"
            onMouseDown={keepFocus}
            className={btn}
            aria-expanded={menu === 'autosum'}
            disabled={!g}
            onClick={() => setMenu(menu === 'autosum' ? null : 'autosum')}
            title="자동 합계 - 빈 칸을 고르면 위(없으면 왼쪽)의 수를, 수가 든 범위를 고르면 그 아래에 열마다"
            data-table-op="autosum"
          >
            Σ ▾
          </button>
          {menu === 'autosum' && (
            <span role="menu" className={menuBox}>
              {AUTO_FNS.map((a) => (
                <button key={a.op} type="button" role="menuitem" onMouseDown={keepFocus} onClick={() => runAutoSum(a.fn)} className={menuItem(false)} data-table-op={a.op}>
                  {a.label} <span className="ml-auto pl-2 font-normal text-slate-400">{a.fn}</span>
                </button>
              ))}
            </span>
          )}
        </span>
        <button
          type="button"
          onMouseDown={keepFocus}
          className={btn}
          disabled={!g || (g.r1 === g.r2 && g.r1 === 0)}
          onClick={runFillDown}
          title="아래로 채우기 - 맨 위 칸을 고른 칸들에 베낍니다 (식은 주소를 따라 바뀝니다 · 한 줄만 고르면 바로 위 칸을)"
          data-table-op="copy-down"
        >
          ⇣ 채우기
        </button>
        <button type="button" onMouseDown={keepFocus} className={on(activeStyle?.nf === 'comma')} aria-pressed={activeStyle?.nf === 'comma'} disabled={!g} onClick={() => numFormat('comma')} title="세 자리 쉼표 (1234 → 1,234) - 다시 누르면 풉니다" data-table-op="num-comma">
          1,000
        </button>
        <button type="button" onMouseDown={keepFocus} className={on(activeStyle?.nf === 'won')} aria-pressed={activeStyle?.nf === 'won'} disabled={!g} onClick={() => numFormat('won')} title="원 (1234 → 1,234원) - 다시 누르면 풉니다" data-table-op="num-won">
          원
        </button>
        <button type="button" onMouseDown={keepFocus} className={on(activeStyle?.nf === 'pct')} aria-pressed={activeStyle?.nf === 'pct'} disabled={!g} onClick={() => numFormat('pct')} title="백분율 (0.125 → 12.5%) - 다시 누르면 풉니다" data-table-op="num-pct">
          %
        </button>
        <button type="button" onMouseDown={keepFocus} className={btn} disabled={!g} onClick={() => decimals(-1)} title="소수 자리 하나 줄이기 (반올림해 보입니다 - 셈은 원래 수로)" data-table-op="dp-less">
          소수 −
        </button>
        <button type="button" onMouseDown={keepFocus} className={btn} disabled={!g} onClick={() => decimals(1)} title="소수 자리 하나 늘리기" data-table-op="dp-more">
          소수 +
        </button>
        <button type="button" onMouseDown={keepFocus} className={`${on(activeStyle?.b === 1)} font-black`} aria-pressed={activeStyle?.b === 1} disabled={!g} onClick={() => format(toggleBold)} title="굵게 (Ctrl + B) - 다시 누르면 풉니다" data-table-op="bold">
          굵게
        </button>
        <span className="relative" ref={menu === 'align' ? menuRef : undefined}>
          <button type="button" onMouseDown={keepFocus} className={btn} aria-expanded={menu === 'align'} disabled={!g} onClick={() => setMenu(menu === 'align' ? null : 'align')} title="맞춤" data-table-op="align">
            맞춤 ▾
          </button>
          {menu === 'align' && (
            <span role="menu" className={menuBox}>
              {(
                [
                  ['left', '왼쪽', 'align-left'],
                  ['center', '가운데', 'align-center'],
                  ['right', '오른쪽', 'align-right'],
                  [undefined, '처음대로', 'align-reset'],
                ] as const
              ).map(([ha, label, op]) => (
                <button
                  key={op}
                  type="button"
                  role="menuitemradio"
                  aria-checked={activeStyle?.ha === ha}
                  onMouseDown={keepFocus}
                  onClick={() => format((t, r) => setAlign(t, r, ha))}
                  className={menuItem(activeStyle?.ha === ha)}
                  title={ha ? undefined : '글은 왼쪽, 수는 오른쪽'}
                  data-table-op={op}
                >
                  {label}
                </button>
              ))}
            </span>
          )}
        </span>
        <span className="relative" ref={menu === 'fill' ? menuRef : undefined}>
          <button type="button" onMouseDown={keepFocus} className={btn} aria-expanded={menu === 'fill'} disabled={!g} onClick={() => setMenu(menu === 'fill' ? null : 'fill')} title="칸 색" data-table-op="fill">
            <span className="inline-block w-2.5 h-2.5 mr-1 rounded-sm border border-slate-300 align-[-1px]" style={{ backgroundColor: activeStyle?.bg ?? '#ffffff' }} />
            칸 색 ▾
          </button>
          {menu === 'fill' && (
            <span role="menu" className={menuBox}>
              {[...FILL_COLORS, { key: 'none', name: '없음', bg: undefined }].map((f) => (
                <button
                  key={f.key}
                  type="button"
                  role="menuitemradio"
                  aria-checked={activeStyle?.bg === f.bg}
                  onMouseDown={keepFocus}
                  onClick={() => format((t, r) => setFill(t, r, f.bg))}
                  className={menuItem(activeStyle?.bg === f.bg)}
                  data-table-op={`fill-${f.key}`}
                >
                  <span className="inline-block w-3.5 h-3.5 rounded-sm border border-slate-300" style={{ backgroundColor: f.bg ?? '#ffffff' }} />
                  {f.name}
                </button>
              ))}
            </span>
          )}
        </span>
      </div>
      {/* 세로는 칸 안에서 따로 스크롤하지 않고 쓰는 칸 전체로 (P10-5 사용자 의견 6f), 넓은 표는 가로만 */}
      <div ref={boxRef} className="relative overflow-x-auto overflow-y-hidden p-2">
        <table className="border-collapse" style={TABLE_STYLE as CSSProperties}>
          <TableColGroup table={table} lead={ROW_HEAD_W} />
          <thead>
            <tr>
              <th
                data-table-all
                onMouseDown={keepFocus}
                onClick={() => {
                  apply(withDraft(table));
                  pick({ r: 0, c: 0 }, { r: nRows - 1, c: nCols - 1 });
                }}
                className={`${head} w-7 min-w-7`}
                title="표 전체 고르기"
                aria-label="표 전체 고르기"
              />
              {Array.from({ length: nCols }, (_, c) => (
                <th
                  key={c}
                  data-table-col={c}
                  onMouseDown={keepFocus}
                  onClick={(e) => pickCols(e, c)}
                  className={`${g && c >= g.c1 && c <= g.c2 ? headOn : head} px-1 py-0`}
                  style={{ fontSize: 10, lineHeight: 1.6 }}
                  title={`${colName(c)}열 고르기 (Shift = 여러 열)`}
                >
                  {colName(c)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, r) => (
              <tr key={r} style={row.h ? { height: row.h } : undefined}>
                <th
                  data-table-row={r}
                  onMouseDown={keepFocus}
                  onClick={(e) => pickRows(e, r)}
                  className={`${g && r >= g.r1 && r <= g.r2 ? headOn : head} px-1 py-0 tabular-nums`}
                  style={{ fontSize: 10 }}
                  title={`${r + 1}행 고르기 (Shift = 여러 행)`}
                >
                  {r + 1}
                </th>
                {row.cells.map((cell, c) => {
                  if (cell.x) return null;
                  const on = inRange(g, r, c);
                  const isActive = active?.r === r && active?.c === c;
                  const css: CSSProperties = {
                    ...(baseCellCss(table.styles?.[cell.s ?? -1], cell) as CSSProperties),
                    ...(on && many ? { boxShadow: SEL_TINT } : {}),
                    ...(isActive ? { outline: '2px solid #2563eb', outlineOffset: -2 } : {}),
                    cursor: 'cell',
                  };
                  return (
                    <td
                      key={c}
                      colSpan={cell.cs}
                      rowSpan={cell.rs}
                      style={css}
                      title={formulaErrorReason(cell)}
                      data-cell={`${r}-${c}`}
                      data-cell-formula={cell.f ? '' : undefined}
                      data-cell-on={on || undefined}
                      onMouseDown={keepFocus}
                      onClick={(e) => onCellClick(e, r, c)}
                    >
                      {cell.v}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {active && (
          // 글 칸 하나 - 고른 칸 위에 뜬다. 고르기 상태에서는 보이지 않게(초점만), 고치는 동안 칸을 덮는다
          <textarea
            ref={inputRef}
            value={editing ? draft : ''}
            data-table-input={`${active.r}-${active.c}`}
            data-table-editing={editing || undefined}
            aria-label={`${cellName(active)} 칸`}
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => onInput(e.target.value)}
            onKeyDown={onKeyDown}
            onBlur={onBlur}
            rows={Math.max(1, (editing ? draft : '').split('\n').length)}
            className={`absolute z-10 box-border resize-none m-0 outline-none ${editing ? 'border-2 border-blue-600 bg-blue-50 shadow-md' : 'opacity-0 pointer-events-none border-0'}`}
            style={
              {
                ...TABLE_STYLE,
                backgroundColor: editing ? '#eff6ff' : 'transparent',
                ...(editing ? {} : { width: 1, height: 1 }),
                padding: editing ? '0 4px' : 0,
                textAlign: table.styles?.[activeCell?.s ?? -1]?.ha ?? 'left',
                whiteSpace: 'pre',
                overflow: 'hidden',
                // 글 길이만큼 넓어진다 (크롬 123+)
                fieldSizing: 'content',
              } as CSSProperties
            }
          />
        )}
      </div>
    </div>
  );
}
