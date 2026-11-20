// 쓰는 칸 고치는 표 - 고르기·키·되돌리기 (P48-1 ■3)
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EntryTable } from '../../data/types';
import { newEmptyTable, setCellText } from '../../domain/tableEdit';
import TableEditor from './TableEditor';

afterEach(cleanup);

/** 3행 × 3열, 칸 = 'r,c' 글 */
function filled(): EntryTable {
  let t = newEmptyTable(3, 3, 1);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) t = setCellText(t, r, c, `${r},${c}`);
  return t;
}

/** 마지막으로 바뀐 표 (onChange가 받은 것 - 처음은 넘긴 표) */
const seen: { latest: EntryTable } = { latest: newEmptyTable() };
function Host({ start, autoEdit }: { start: EntryTable; autoEdit?: boolean }) {
  const [t, setT] = useState(start);
  return (
    <TableEditor
      table={t}
      onChange={(next) => {
        seen.latest = next;
        setT(next);
      }}
      autoEdit={autoEdit}
    />
  );
}

const q = (s: string) => document.querySelector<HTMLElement>(s)!;
const input = () => q('[data-table-input]') as HTMLTextAreaElement;
const nameBox = () => q('[data-table-name]').getAttribute('data-table-name');
const key = (k: string, more: Partial<KeyboardEventInit> = {}) => act(() => void fireEvent.keyDown(input(), { key: k, ...more }));
const values = () => seen.latest.rows.map((r) => r.cells.map((c) => c.v));

describe('고치는 표 - 고르기 (P48-1)', () => {
  it('위 A·B·C / 왼쪽 1·2·3 띠, 칸을 누르면 고치기 + 칸 이름 줄', () => {
    seen.latest = filled();
  render(<Host start={filled()} />);
    expect([...document.querySelectorAll('[data-table-col]')].map((e) => e.textContent)).toEqual(['A', 'B', 'C']);
    expect([...document.querySelectorAll('[data-table-row]')].map((e) => e.textContent)).toEqual(['1', '2', '3']);
    expect(nameBox()).toBe('');
    fireEvent.click(q('[data-cell="1-1"]'));
    expect(nameBox()).toBe('B2');
    expect(input().getAttribute('data-table-editing')).toBe('true');
    expect(input().value).toBe('1,1');
    expect(document.activeElement).toBe(input());
  });

  it('ESC = 고치기 취소 → 고르기 상태(초점 그대로) · 방향키·Shift+방향키 · Delete = 범위 비우기 · Ctrl+Z = 되돌리기', () => {
    seen.latest = filled();
  render(<Host start={filled()} />);
    fireEvent.click(q('[data-cell="0-0"]'));
    fireEvent.change(input(), { target: { value: '버릴 글' } });
    key('Escape');
    expect(input().hasAttribute('data-table-editing')).toBe(false);
    expect(document.activeElement).toBe(input());
    expect(values()[0][0]).toBe('0,0');
    key('ArrowRight');
    expect(nameBox()).toBe('B1');
    key('ArrowDown', { shiftKey: true });
    key('ArrowRight', { shiftKey: true });
    expect(nameBox()).toBe('B1:C2');
    expect(document.querySelectorAll('[data-cell-on]')).toHaveLength(4);
    key('Delete');
    expect(values()).toEqual([['0,0', '', ''], ['1,0', '', ''], ['2,0', '2,1', '2,2']]);
    key('z', { ctrlKey: true, code: 'KeyZ' } as KeyboardEventInit);
    expect(values()[0][1]).toBe('0,1');
    expect(values()[1][2]).toBe('1,2');
    expect((q('[data-table-op="undo"]') as HTMLButtonElement).disabled).toBe(true);
  });

  it('고르기 상태에서 글자를 치면 그 칸을 새로 · Enter·F2 = 지금 글로 고치기 · Enter = 넣고 아래 칸', () => {
    seen.latest = filled();
  render(<Host start={filled()} />);
    fireEvent.click(q('[data-cell="0-1"]'));
    key('Escape');
    fireEvent.change(input(), { target: { value: '새' } });
    expect(input().getAttribute('data-table-editing')).toBe('true');
    key('Enter');
    expect(values()[0][1]).toBe('새');
    expect(nameBox()).toBe('B2');
    expect(input().hasAttribute('data-table-editing')).toBe(false);
    key('F2');
    expect(input().value).toBe('1,1');
    key('Escape');
    key('Enter');
    expect(input().getAttribute('data-table-editing')).toBe('true');
  });

  it('Shift+누르기 = 범위 · 열 머리·행 번호 = 그 열·행 (Shift = 여러 개) · ↖ = 표 전체', () => {
    seen.latest = filled();
  render(<Host start={filled()} />);
    fireEvent.click(q('[data-cell="0-0"]'));
    fireEvent.click(q('[data-cell="2-1"]'), { shiftKey: true });
    expect(nameBox()).toBe('A1:B3');
    fireEvent.click(q('[data-table-col="1"]'));
    expect(nameBox()).toBe('B1:B3');
    fireEvent.click(q('[data-table-col="2"]'), { shiftKey: true });
    expect(nameBox()).toBe('B1:C3');
    fireEvent.click(q('[data-table-row="2"]'));
    expect(nameBox()).toBe('A3:C3');
    fireEvent.click(q('[data-table-all]'));
    expect(nameBox()).toBe('A1:C3');
    expect(document.activeElement).toBe(input());
  });

  it('행·열 단추는 고른 범위로: 행 둘 빼기 · 위에 넣기 · 모두는 못 뺀다', () => {
    seen.latest = filled();
  render(<Host start={filled()} />);
    fireEvent.click(q('[data-table-row="0"]'));
    fireEvent.click(q('[data-table-row="1"]'), { shiftKey: true });
    fireEvent.click(q('[data-table-op="row-delete"]'));
    expect(values()).toEqual([['2,0', '2,1', '2,2']]);
    expect((q('[data-table-op="row-delete"]') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(q('[data-table-op="row-above"]'));
    expect(values()).toEqual([['', '', ''], ['2,0', '2,1', '2,2']]);
    fireEvent.click(q('[data-table-op="undo"]'));
    fireEvent.click(q('[data-table-op="undo"]'));
    expect(values()).toHaveLength(3);
  });

  it('ESC 두 번째 = 고르기 풀기, 세 번째는 앱(전역 ESC)으로 · 표가 맡은 키는 앱으로 가지 않는다', () => {
    const appKeys = vi.fn();
    window.addEventListener('keydown', appKeys);
    render(<Host start={setCellText(filled(), 0, 0, '')} autoEdit />);
    expect(input().getAttribute('data-table-input')).toBe('0-0');
    key('Escape');
    key('ArrowDown');
    key('Delete');
    key('z', { ctrlKey: true, code: 'KeyZ' } as KeyboardEventInit);
    expect(appKeys).not.toHaveBeenCalled();
    key('Escape');
    expect(document.querySelector('[data-table-input]')).toBeNull();
    expect(nameBox()).toBe('');
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(appKeys).toHaveBeenCalledTimes(1);
    window.removeEventListener('keydown', appKeys);
  });

  it('Alt+Enter = 칸 안 줄 바꿈 · 다른 칸을 누르면 고치던 글을 넣는다', () => {
    seen.latest = filled();
  render(<Host start={filled()} />);
    fireEvent.click(q('[data-cell="0-0"]'));
    fireEvent.change(input(), { target: { value: '첫줄' } });
    input().setSelectionRange(1, 1);
    key('Enter', { altKey: true });
    expect(input().value).toBe('첫\n줄');
    fireEvent.click(q('[data-cell="2-2"]'));
    expect(values()[0][0]).toBe('첫\n줄');
    expect(nameBox()).toBe('C3');
  });
});

describe('고치는 표 - 숫자 서식·꾸밈 (P48-2)', () => {
  const op = (name: string) => act(() => void fireEvent.click(q(`[data-table-op="${name}"]`)));
  const styleAt = (r: number, c: number) => {
    const cell = seen.latest.rows[r].cells[c];
    return cell.s === undefined ? undefined : seen.latest.styles?.[cell.s];
  };

  it('칸에 1234 → 1,000 → 원 = 1,234원 · 다시 고치면 1234가 보이고 · 고친 수에도 원이 입는다', () => {
    seen.latest = newEmptyTable(2, 2, 1);
    render(<Host start={newEmptyTable(2, 2, 1)} autoEdit />);
    fireEvent.change(input(), { target: { value: '1234' } });
    // 고치던 글을 넣고 서식을 입힌다
    op('num-comma');
    expect(values()[0][0]).toBe('1,234');
    expect(input().hasAttribute('data-table-editing')).toBe(false);
    expect(q('[data-table-op="num-comma"]').getAttribute('aria-pressed')).toBe('true');
    op('num-won');
    expect(values()[0][0]).toBe('1,234원');
    expect(seen.latest.rows[0].cells[0].n).toBe(1234);
    expect(q('[data-cell="0-0"]').textContent).toBe('1,234원');
    expect(q('[data-cell="0-0"]').style.textAlign).toBe('right');
    expect(q('[data-table-name]').textContent).toContain('1234');
    key('F2');
    expect(input().value).toBe('1234');
    fireEvent.change(input(), { target: { value: '5000' } });
    key('Enter');
    expect(values()[0][0]).toBe('5,000원');
    // 다시 누르면 풂
    key('ArrowUp');
    op('num-won');
    expect(values()[0][0]).toBe('5000');
    expect(seen.latest.styles).toBeUndefined();
  });

  it('% · 소수 −/+ · ↶로 되돌림', () => {
    let t = newEmptyTable(1, 2, 1);
    t = setCellText(setCellText(t, 0, 0, '0.125'), 0, 1, '1.23456');
    seen.latest = t;
    render(<Host start={t} />);
    fireEvent.click(q('[data-cell="0-0"]'));
    key('Escape');
    op('num-pct');
    expect(values()[0][0]).toBe('12.5%');
    op('dp-more');
    expect(values()[0][0]).toBe('12.50%');
    key('ArrowRight');
    op('dp-less');
    expect(values()[0][1]).toBe('1.2346');
    expect(seen.latest.rows[0].cells[1].n).toBe(1.23456);
    op('undo');
    expect(values()[0][1]).toBe('1.23456');
    op('undo');
    op('undo');
    expect(values()[0]).toEqual(['0.125', '1.23456']);
  });

  it('굵게(단추·Ctrl+B) · 맞춤 ▾ · 칸 색 ▾ - 범위에, ESC = ▾만 닫기', () => {
    seen.latest = filled();
    render(<Host start={filled()} />);
    fireEvent.click(q('[data-cell="0-0"]'));
    key('Escape');
    key('ArrowRight', { shiftKey: true });
    op('bold');
    expect([styleAt(0, 0)?.b, styleAt(0, 1)?.b, styleAt(0, 2)?.b]).toEqual([1, 1, undefined]);
    key('b', { ctrlKey: true, code: 'KeyB' } as KeyboardEventInit);
    expect(styleAt(0, 0)).toBeUndefined();
    op('align');
    expect(document.querySelector('[data-table-op="align-center"]')).not.toBeNull();
    key('Escape');
    expect(document.querySelector('[data-table-op="align-center"]')).toBeNull();
    expect(nameBox()).toBe('A1:B1');
    op('align');
    op('align-center');
    expect(styleAt(0, 1)?.ha).toBe('center');
    expect(document.querySelector('[data-table-op="align-center"]')).toBeNull();
    op('fill');
    op('fill-yellow');
    expect(styleAt(0, 0)).toEqual({ ha: 'center', bg: '#fef9c3' });
    expect(q('[data-cell="0-0"]').style.backgroundColor).toBe('rgb(254, 249, 195)');
    op('fill');
    op('fill-none');
    op('align');
    op('align-reset');
    expect(seen.latest.styles).toBeUndefined();
  });
});

describe('막 만든 표만 A1을 곧바로 고친다 (P48-2 찾아 고침)', () => {
  it('A1에 글이 있는 표는 autoEdit이어도 고치지 않는다 - 다시 그려져도 A1을 빈 글로 덮지 않게', () => {
    seen.latest = filled();
    render(<Host start={filled()} autoEdit />);
    expect(document.querySelector('[data-table-input]')).toBeNull();
    expect(nameBox()).toBe('');
    expect(q('[data-cell="0-0"]').textContent).toBe('0,0');
  });
});
