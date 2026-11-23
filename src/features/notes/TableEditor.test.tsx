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
/** 띠의 칸 이름 줄 (띠가 없으면 null - P49-2 칸을 고른 표에만) */
const nameBox = () => document.querySelector('[data-table-name]')?.getAttribute('data-table-name') ?? null;
const bars = () => document.querySelectorAll('[data-table-bar]').length;
const key = (k: string, more: Partial<KeyboardEventInit> = {}) => act(() => void fireEvent.keyDown(input(), { key: k, ...more }));
const values = () => seen.latest.rows.map((r) => r.cells.map((c) => c.v));

describe('고치는 표 - 고르기 (P48-1)', () => {
  it('위 A·B·C / 왼쪽 1·2·3 띠, 칸을 누르면 고치기 + 칸 이름 줄', () => {
    seen.latest = filled();
  render(<Host start={filled()} />);
    expect([...document.querySelectorAll('[data-table-col]')].map((e) => e.textContent)).toEqual(['A', 'B', 'C']);
    expect([...document.querySelectorAll('[data-table-row]')].map((e) => e.textContent)).toEqual(['1', '2', '3']);
    expect(nameBox()).toBeNull();
    expect(bars()).toBe(0);
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
    expect(nameBox()).toBeNull();
    expect(bars()).toBe(0);
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

describe('띠는 칸을 고른 표에만 (P49-2)', () => {
  const barOf = (root: Element) => root.querySelector('[data-table-bar]');

  it('고르지 않은 표 = 제목 줄만 · 칸을 누르면 띠 두 줄이 표 칸 묶음 위(제목 줄 자리)에 · 띠의 빈 곳을 눌러도 초점 그대로', () => {
    seen.latest = filled();
    render(<Host start={filled()} />);
    expect(bars()).toBe(0);
    expect(document.querySelectorAll('[data-table-op]')).toHaveLength(0);
    fireEvent.click(q('[data-cell="1-1"]'));
    expect(bars()).toBe(1);
    const bar = q('[data-table-bar]');
    expect(bar.querySelector('[data-table-format-bar]')).not.toBeNull();
    expect(bar.querySelectorAll('[data-table-op]').length).toBeGreaterThanOrEqual(18);
    // 겹쳐 뜬다 - 표 칸 묶음(글 칸이 서는 상자) 바로 위, 제목 줄과 같은 부모가 아니다
    expect(bar.className).toContain('absolute');
    expect(bar.className).toContain('bottom-full');
    expect(bar.parentElement?.contains(input())).toBe(true);
    // 띠의 빈 곳을 눌러도 (mousedown을 막아) 글 칸 초점이 그대로
    expect(fireEvent.mouseDown(bar)).toBe(false);
  });

  it('표 밖으로 초점이 가면 띠가 접히고 고른 칸은 남는다 · 글 칸에 초점이 돌아오면 다시 (📋 클립보드 탭 붙이기)', () => {
    seen.latest = filled();
    render(
      <>
        <Host start={filled()} />
        <textarea data-other />
      </>
    );
    fireEvent.click(q('[data-cell="0-1"]'));
    fireEvent.change(input(), { target: { value: '넣을 글' } });
    act(() => q('[data-other]').focus());
    expect(bars()).toBe(0);
    expect(values()[0][1]).toBe('넣을 글');
    expect(input().getAttribute('data-table-input')).toBe('0-1');
    act(() => input().focus());
    expect(bars()).toBe(1);
    expect(nameBox()).toBe('B1');
  });

  it('표가 둘이면 누른 표에만 띠 · ESC 둘째(고르기 풀기)에 접힌다', () => {
    seen.latest = filled();
    render(
      <>
        <div data-one>
          <Host start={filled()} />
        </div>
        <div data-two>
          <Host start={filled()} />
        </div>
      </>
    );
    const one = q('[data-one]');
    const two = q('[data-two]');
    fireEvent.click(one.querySelector('[data-cell="0-0"]')!);
    expect(barOf(one)).not.toBeNull();
    expect(barOf(two)).toBeNull();
    fireEvent.click(two.querySelector('[data-cell="2-2"]')!);
    expect(barOf(one)).toBeNull();
    expect(barOf(two)?.querySelector('[data-table-name]')?.getAttribute('data-table-name')).toBe('C3');
    const twoInput = () => two.querySelector('[data-table-input]')!;
    act(() => void fireEvent.keyDown(twoInput(), { key: 'Escape' }));
    expect(barOf(two)).not.toBeNull();
    act(() => void fireEvent.keyDown(twoInput(), { key: 'Escape' }));
    expect(bars()).toBe(0);
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

describe('고치는 표 - 식 (P48-3)', () => {
  const op = (name: string) => act(() => void fireEvent.click(q(`[data-table-op="${name}"]`)));
  /** 점수 표: A = 이름, B = 점수 (3명) + 빈 줄 */
  function scores(): EntryTable {
    let t = newEmptyTable(5, 2, 1);
    [['이름', '점수'], ['가', '90'], ['나', '70'], ['다', '85']].forEach((row, r) => row.forEach((v, c) => (t = setCellText(t, r, c, v))));
    return t;
  }

  it('=SUM(…)을 치면 결과, 칸을 누르면 식, 칸 이름 줄에 식 · 위 칸을 고치면 곧바로 다시 셈', () => {
    seen.latest = scores();
    render(<Host start={scores()} />);
    fireEvent.click(q('[data-cell="4-1"]'));
    fireEvent.change(input(), { target: { value: '=sum(b2:b4)' } });
    key('Enter');
    expect(values()[4][1]).toBe('245');
    expect(seen.latest.rows[4].cells[1].f).toBe('=SUM(B2:B4)');
    expect(q('[data-cell="4-1"]').textContent).toBe('245');
    expect(q('[data-cell="4-1"]').hasAttribute('data-cell-formula')).toBe(true);
    // 고르기 상태로 돌아와 칸 이름 줄에 식
    key('ArrowUp');
    key('ArrowDown');
    expect(q('[data-table-name]').textContent).toContain('=SUM(B2:B4)');
    // 칸을 누르면 식
    fireEvent.click(q('[data-cell="4-1"]'));
    expect(input().value).toBe('=SUM(B2:B4)');
    key('Escape');
    // 위 칸을 고치면 곧바로
    fireEvent.click(q('[data-cell="1-1"]'));
    fireEvent.change(input(), { target: { value: '100' } });
    key('Enter');
    expect(values()[4][1]).toBe('255');
    expect(q('[data-cell="4-1"]').textContent).toBe('255');
  });

  it('행을 넣으면 범위가 따라가고 · 오류 칸에는 쉬운 까닭 · ↶로 되돌림', () => {
    let t = setCellText(scores(), 4, 1, '=SUM(B2:B4)');
    t = setCellText(t, 4, 0, '=B2/0');
    seen.latest = t;
    render(<Host start={t} />);
    expect(q('[data-cell="4-0"]').textContent).toBe('#DIV/0!');
    expect(q('[data-cell="4-0"]').title).toContain('0으로 나눴습니다');
    expect(q('[data-cell="4-1"]').title).toBe('');
    // 3행(나) 위에 행 넣기
    fireEvent.click(q('[data-cell="2-1"]'));
    key('Escape');
    op('row-above');
    expect(seen.latest.rows[5].cells[1]).toMatchObject({ f: '=SUM(B2:B5)', v: '245' });
    fireEvent.change(input(), { target: { value: '5' } });
    key('Enter');
    expect(values()[5][1]).toBe('250');
    // ↶ 두 번 = 행 넣기 전
    op('undo');
    op('undo');
    expect(seen.latest.rows[4].cells[1]).toMatchObject({ f: '=SUM(B2:B4)', v: '245' });
  });

  it("서식을 바꾸면 식 결과도 그 서식 · '로 시작하면 글 · Delete = 식도 지움", () => {
    let t = setCellText(scores(), 4, 1, '=AVERAGE(B2:B4)');
    seen.latest = t;
    render(<Host start={t} />);
    expect(values()[4][1]).toBe('81.66666667');
    fireEvent.click(q('[data-cell="4-1"]'));
    key('Escape');
    op('dp-less');
    expect(values()[4][1]).toBe('81.6666667');
    op('num-comma');
    for (let i = 0; i < 6; i++) op('dp-less');
    expect(values()[4][1]).toBe('81.7');
    op('num-won');
    op('dp-less');
    expect(values()[4][1]).toBe('82원');
    // '로 시작하면 글
    key('Delete');
    expect(seen.latest.rows[4].cells[1].f).toBeUndefined();
    fireEvent.click(q('[data-cell="4-0"]'));
    fireEvent.change(input(), { target: { value: "'=합계" } });
    key('Enter');
    expect(seen.latest.rows[4].cells[0]).toEqual({ v: '=합계' });
    fireEvent.click(q('[data-cell="4-0"]'));
    expect(input().value).toBe("'=합계");
  });
});

describe('고치는 표 - Σ·채우기·정렬 (P48-4)', () => {
  const op = (name: string) => act(() => void fireEvent.click(q(`[data-table-op="${name}"]`)));
  const toasts = () => document.getElementById('sp5-toast-container')?.textContent ?? '';
  /** 이름·국어·수학·합계 (4명) + 빈 줄 */
  function scores(): EntryTable {
    let t = newEmptyTable(6, 4, 1);
    [['이름', '국어', '수학', '합계'], ['가', '90', '80'], ['나', '70', '95'], ['다', '85', '85'], ['라', '60', '70']].forEach((row, r) =>
      row.forEach((v, c) => (t = setCellText(t, r, c, v)))
    );
    return t;
  }

  it('Σ ▾ 합계: 빈 칸 = 위의 수를 묶은 식, 그 칸을 골라 칸 이름 줄에 식 · 범위 = 아래 줄에 열마다', () => {
    seen.latest = scores();
    render(<Host start={scores()} />);
    fireEvent.click(q('[data-cell="5-1"]'));
    op('autosum');
    expect(document.querySelectorAll('[data-table-op^="autosum-"]')).toHaveLength(5);
    op('autosum-sum');
    expect(document.querySelector('[data-table-op="autosum-sum"]')).toBeNull();
    expect(seen.latest.rows[5].cells[1]).toMatchObject({ f: '=SUM(B2:B5)', v: '305' });
    expect(nameBox()).toBe('B6');
    expect(q('[data-table-name]').textContent).toContain('=SUM(B2:B5)');
    expect(document.activeElement).toBe(input());
    // 범위 C2:C5 → 아래 빈 칸 C6
    fireEvent.click(q('[data-cell="1-2"]'));
    fireEvent.click(q('[data-cell="4-2"]'), { shiftKey: true });
    op('autosum');
    op('autosum-average');
    expect(seen.latest.rows[5].cells[2]).toMatchObject({ f: '=AVERAGE(C2:C5)', v: '82.5' });
    expect(nameBox()).toBe('C6');
    // ↶ 두 번 = 처음
    op('undo');
    op('undo');
    expect(values()[5]).toEqual(['', '', '', '']);
  });

  it('Σ: 합계 열(D2)은 왼쪽 · 묶을 수가 없으면 =SUM()을 열어 괄호 안에 커서 · 글이 든 칸은 안내', () => {
    seen.latest = scores();
    render(<Host start={scores()} />);
    fireEvent.click(q('[data-cell="1-3"]'));
    op('autosum');
    op('autosum-sum');
    expect(seen.latest.rows[1].cells[3]).toMatchObject({ f: '=SUM(B2:C2)', v: '170' });
    // 이름 열 빈 칸 A6 - 위는 글뿐, 왼쪽은 없다
    fireEvent.click(q('[data-cell="5-0"]'));
    op('autosum');
    op('autosum-max');
    expect(input().getAttribute('data-table-editing')).toBe('true');
    expect(input().value).toBe('=MAX()');
    expect(input().selectionStart).toBe(5);
    expect(toasts()).toContain('괄호 안에 범위');
    key('Escape');
    expect(seen.latest.rows[5].cells[0].v).toBe('');
    fireEvent.click(q('[data-cell="2-1"]'));
    op('autosum');
    op('autosum-sum');
    expect(toasts()).toContain('비어 있지 않습니다');
    expect(values()[2][1]).toBe('70');
  });

  it('⇣ 채우기: 맨 위 식을 아래로 (주소가 행을 따라) · 한 칸만 고르면 바로 위 칸을', () => {
    const t = setCellText(scores(), 1, 3, '=B2+C2');
    seen.latest = t;
    render(<Host start={t} />);
    expect(document.querySelector('[data-table-op="copy-down"]')).toBeNull();
    fireEvent.click(q('[data-cell="1-3"]'));
    fireEvent.click(q('[data-cell="3-3"]'), { shiftKey: true });
    op('copy-down');
    expect(seen.latest.rows[2].cells[3]).toMatchObject({ f: '=B3+C3', v: '165' });
    expect(seen.latest.rows[3].cells[3]).toMatchObject({ f: '=B4+C4', v: '170' });
    expect(nameBox()).toBe('D2:D4');
    fireEvent.click(q('[data-cell="4-3"]'));
    key('Escape');
    op('copy-down');
    expect(seen.latest.rows[4].cells[3]).toMatchObject({ f: '=B5+C5', v: '130' });
  });

  it('정렬 ▾ 큰 것부터: 고른 칸의 열로 행째 - 제목 줄은 그대로, 고른 칸 그대로, 안내 · 작은 것부터(가나다)', () => {
    seen.latest = scores();
    render(<Host start={scores()} />);
    fireEvent.click(q('[data-cell="2-2"]'));
    key('Escape');
    op('sort');
    op('sort-desc');
    expect(values().map((r) => r[0])).toEqual(['이름', '나', '다', '가', '라', '']);
    expect(values()[1]).toEqual(['나', '70', '95', '']);
    expect(nameBox()).toBe('C3');
    expect(toasts()).toContain('2~5행을 C열 큰 것부터 정렬했습니다');
    // 이름 열 가나다 (작은 것부터)
    fireEvent.click(q('[data-cell="1-0"]'));
    key('Escape');
    op('sort');
    op('sort-asc');
    expect(values().map((r) => r[0])).toEqual(['이름', '가', '나', '다', '라', '']);
    op('undo');
    expect(values().map((r) => r[0])).toEqual(['이름', '나', '다', '가', '라', '']);
  });
});

describe('막 만든 표만 A1을 곧바로 고친다 (P48-2 찾아 고침)', () => {
  it('A1에 글이 있는 표는 autoEdit이어도 고치지 않는다 - 다시 그려져도 A1을 빈 글로 덮지 않게', () => {
    seen.latest = filled();
    render(<Host start={filled()} autoEdit />);
    expect(document.querySelector('[data-table-input]')).toBeNull();
    expect(nameBox()).toBeNull();
    expect(q('[data-cell="0-0"]').textContent).toBe('0,0');
  });
});

describe('고치는 표 - 엑셀과 오가기 (P48-5)', () => {
  const toasts = () => document.getElementById('sp5-toast-container')?.textContent ?? '';
  /** 붙여넣기·복사 이벤트의 clipboardData 흉내 (jsdom에는 DataTransfer가 없다) */
  function clip(data: Record<string, string> = {}) {
    const store: Record<string, string> = { ...data };
    return { store, getData: (t: string) => store[t] ?? '', setData: (t: string, v: string) => void (store[t] = v) };
  }
  /** 붙여넣고 막았나(preventDefault - 표가 맡았다) */
  const paste = (data: Record<string, string>) => {
    let handled = false;
    act(() => {
      handled = !fireEvent.paste(input(), { clipboardData: clip(data) });
    });
    return handled;
  };

  it('고르기 상태 Ctrl+C = 고른 범위를 탭 글 + HTML 표로 · 고치는 중에는 글 칸 그대로 · Ctrl+X = 복사하고 비움', () => {
    seen.latest = filled();
    render(<Host start={filled()} />);
    fireEvent.click(q('[data-cell="0-0"]'));
    // 고치는 중 - 표가 막지 않는다(글 칸 안 고른 글)
    const editingCopy = clip();
    expect(fireEvent.copy(input(), { clipboardData: editingCopy })).toBe(true);
    expect(editingCopy.store['text/plain']).toBeUndefined();
    key('Escape');
    fireEvent.click(q('[data-cell="1-1"]'), { shiftKey: true });
    const c = clip();
    expect(fireEvent.copy(input(), { clipboardData: c })).toBe(false);
    expect(c.store['text/plain']).toBe('0,0\t0,1\n1,0\t1,1');
    expect(c.store['text/html']).toContain('<td x:str>1,1</td>');
    const x = clip();
    act(() => void fireEvent.cut(input(), { clipboardData: x }));
    expect(x.store['text/plain']).toBe('0,0\t0,1\n1,0\t1,1');
    expect(values()).toEqual([
      ['', '', '0,2'],
      ['', '', '1,2'],
      ['2,0', '2,1', '2,2'],
    ]);
  });

  it('엑셀 범위 Ctrl+V = 고른 칸부터 값만 채우고 그 범위를 고른다 · 모자라면 늘리고 안내 · ↶로 되돌림', () => {
    seen.latest = filled();
    render(<Host start={filled()} />);
    fireEvent.click(q('[data-cell="1-1"]'));
    // 칸을 누르면 곧 고치는 중 - 그래도 탭 글(엑셀 범위)이면 채운다
    expect(paste({ 'text/plain': '가\t나\t다\r\n라\t마\t바\r\n' })).toBe(true);
    expect(values()).toEqual([
      ['0,0', '0,1', '0,2', ''],
      ['1,0', '가', '나', '다'],
      ['2,0', '라', '마', '바'],
    ]);
    expect(nameBox()).toBe('B2:D3');
    expect(input().hasAttribute('data-table-editing')).toBe(false);
    expect(toasts()).toContain('표를 늘려 붙였습니다 (3행 × 4열)');
    act(() => void fireEvent.click(q('[data-table-op="undo"]')));
    expect(values()).toEqual(filled().rows.map((r) => r.cells.map((c) => c.v)));
  });

  it('엑셀 HTML이 먼저 · 고르기 상태 한 칸 값 = 고른 칸 모두에 · 병합과 겹치면 안내', () => {
    seen.latest = filled();
    render(<Host start={filled()} />);
    fireEvent.click(q('[data-cell="0-0"]'));
    key('Escape');
    fireEvent.click(q('[data-cell="0-1"]'), { shiftKey: true });
    expect(paste({ 'text/html': '<table><tr><td>○</td></tr></table>', 'text/plain': '○\r\n' })).toBe(true);
    expect(values()[0]).toEqual(['○', '○', '0,2']);
    expect(paste({ 'text/html': '<table><tr><td>엑셀</td><td x:num>7</td></tr></table>', 'text/plain': '무시\t됨' })).toBe(true);
    expect(values()[0]).toEqual(['엑셀', '7', '0,2']);
  });

  it('고치는 중 여러 줄 글(탭 없음) = 칸 안 줄 바꿈 그대로(브라우저) · 엑셀 한 칸 = 끝 줄 바꿈을 걷고 커서 자리에', () => {
    seen.latest = filled();
    render(<Host start={filled()} />);
    fireEvent.click(q('[data-cell="0-0"]'));
    expect(paste({ 'text/plain': '첫 줄\n둘째 줄' })).toBe(false);
    fireEvent.change(input(), { target: { value: '' } });
    expect(paste({ 'text/html': '<table><tr><td>95</td></tr></table>', 'text/plain': '95\r\n' })).toBe(true);
    expect(input().value).toBe('95');
    key('Enter');
    expect(values()[0][0]).toBe('95');
  });
});
