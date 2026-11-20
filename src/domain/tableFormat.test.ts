import { describe, expect, it } from 'vitest';
import type { EntryTable } from '../data/types';
import { clearRange, insertRow, newEmptyTable, setCellText, tableForSave } from './tableEdit';
import { baseCellCss } from './tableCss';
import {
  cellWithInput,
  editText,
  formatNum,
  generalText,
  setAlign,
  setFill,
  setNumberFormat,
  shownDecimals,
  stepDecimals,
  styleOf,
  toggleBold,
} from './tableFormat';

/** 한 행 표 (칸 글) */
const row = (...vs: string[]): EntryTable => {
  let t = newEmptyTable(1, vs.length, 1);
  vs.forEach((v, c) => (t = setCellText(t, 0, c, v)));
  return t;
};
const all = (t: EntryTable) => ({ r1: 0, c1: 0, r2: t.rows.length - 1, c2: (t.rows[0]?.cells.length ?? 1) - 1 });
const vs = (t: EntryTable) => t.rows.map((r) => r.cells.map((c) => c.v));

describe('수 보이기 (P48-2 ⓔ)', () => {
  it('일반 - 유효 숫자 10자리, 끝 0 없음', () => {
    expect(generalText(1234)).toBe('1234');
    expect(generalText(1 / 3)).toBe('0.3333333333');
    expect(generalText(0.1 + 0.2)).toBe('0.3');
    expect(generalText(12345678901)).toBe('12345678901');
  });

  it('1,000 · 원 · % · 소수 자리', () => {
    expect(formatNum(1234, 'comma')).toBe('1,234');
    expect(formatNum(1234, 'won')).toBe('1,234원');
    expect(formatNum(-1234, 'won')).toBe('-1,234원');
    expect(formatNum(1234567.5, 'comma')).toBe('1,234,567.5');
    expect(formatNum(0.125, 'pct')).toBe('12.5%');
    expect(formatNum(85, 'pct')).toBe('8500%');
    expect(formatNum(0.07, 'pct')).toBe('7%');
    expect(formatNum(1234.5, 'won', 0)).toBe('1,235원');
    expect(formatNum(1.005, undefined, 2)).toBe('1.01');
    expect(formatNum(1234, undefined, 2)).toBe('1234.00');
    expect(formatNum(-0.001, 'comma', 2)).toBe('0.00');
    expect(formatNum(0.125, 'pct', 0)).toBe('13%');
  });

  it('보이는 소수 자리', () => {
    expect(shownDecimals(1234.5)).toBe(1);
    expect(shownDecimals(0.125, 'pct')).toBe(1);
    expect(shownDecimals(1234, 'won', 2)).toBe(2);
    expect(shownDecimals(1 / 3)).toBe(10);
  });
});

describe('숫자 서식 단추 - 사용자 말 그대로 (1234 → 쉼표 → 원)', () => {
  it('1234 → 1,000 = 1,234 → 원 = 1,234원 (n에 원래 수) → 다시 원 = 풀림', () => {
    const t = row('1234');
    const comma = setNumberFormat(t, all(t), 'comma');
    expect(vs(comma)).toEqual([['1,234']]);
    expect(comma.rows[0].cells[0].n).toBe(1234);
    expect(styleOf(comma, comma.rows[0].cells[0])).toEqual({ nf: 'comma' });
    const won = setNumberFormat(comma, all(comma), 'won');
    expect(vs(won)).toEqual([['1,234원']]);
    expect(won.rows[0].cells[0].n).toBe(1234);
    const off = setNumberFormat(won, all(won), 'won');
    expect(vs(off)).toEqual([['1234']]);
    expect(off.rows[0].cells[0].n).toBeUndefined();
    expect(off.styles).toBeUndefined();
    expect(off.rows[0].cells[0].s).toBeUndefined();
  });

  it('붙여넣은 글도 읽어 입힌다 - ₩5,000·1,234원·12.5%·(1,234) · 글 칸은 그대로', () => {
    const t = row('₩5,000', '1,234원', '12.5%', '(1,234)', '홍길동', '');
    const won = setNumberFormat(t, all(t), 'won');
    expect(vs(won)).toEqual([['5,000원', '1,234원', '0.125원', '-1,234원', '홍길동', '']]);
    expect(won.rows[0].cells.map((c) => c.n)).toEqual([5000, 1234, 0.125, -1234, undefined, undefined]);
    // 글 칸·빈 칸에도 서식은 남는다 - 나중에 친 수에 입는다
    expect(styleOf(won, won.rows[0].cells[4])).toEqual({ nf: 'won' });
    const typed = setCellText(won, 0, 5, '3000');
    expect(typed.rows[0].cells[5]).toMatchObject({ v: '3,000원', n: 3000 });
  });

  it('% - 0.125 → 12.5% · 85 → 8500% · % 칸에 15를 치면 15%', () => {
    const t = row('0.125', '85');
    const pct = setNumberFormat(t, all(t), 'pct');
    expect(vs(pct)).toEqual([['12.5%', '8500%']]);
    expect(pct.rows[0].cells.map((c) => c.n)).toEqual([0.125, 85]);
    const typed = setCellText(pct, 0, 0, '15');
    expect(typed.rows[0].cells[0]).toMatchObject({ v: '15%', n: 0.15 });
    expect(setCellText(pct, 0, 0, '7.5%').rows[0].cells[0]).toMatchObject({ v: '7.5%', n: 0.075 });
  });

  it('고른 수 칸이 모두 그 서식일 때만 푼다 - 섞였으면 모두 입힌다', () => {
    let t = row('1000', '2000');
    t = setNumberFormat(t, { r1: 0, c1: 0, r2: 0, c2: 0 }, 'won');
    const both = setNumberFormat(t, all(t), 'won');
    expect(vs(both)).toEqual([['1,000원', '2,000원']]);
    // 원 → 1,000은 바꾸기 (풀지 않는다)
    expect(vs(setNumberFormat(both, all(both), 'comma'))).toEqual([['1,000', '2,000']]);
  });

  it('소수 −/+ - 고른 칸에 보이는 자리에서 하나씩, 셈은 원래 수로', () => {
    const t = row('1.23456', '2');
    const less = stepDecimals(t, all(t), { r: 0, c: 0 }, -1);
    expect(vs(less)).toEqual([['1.2346', '2.0000']]);
    expect(less.rows[0].cells[0].n).toBe(1.23456);
    const two = stepDecimals(stepDecimals(less, all(less), { r: 0, c: 0 }, -1), all(less), { r: 0, c: 0 }, -1);
    expect(vs(two)).toEqual([['1.23', '2.00']]);
    expect(two.rows[0].cells[0].n).toBe(1.23456);
    const more = stepDecimals(row('1234'), { r1: 0, c1: 0, r2: 0, c2: 0 }, { r: 0, c: 0 }, 1);
    expect(vs(more)).toEqual([['1234.0']]);
    // 0 아래·10 위로는 가지 않는다
    const zero = stepDecimals(row('5'), { r1: 0, c1: 0, r2: 0, c2: 0 }, { r: 0, c: 0 }, -1);
    expect(styleOf(zero, zero.rows[0].cells[0])?.dp).toBe(0);
  });

  it('원 + 소수 2자리 = 1,234.50원, 다시 고칠 때 보이는 글 = 원래 수', () => {
    let t = setNumberFormat(row('1234.5'), { r1: 0, c1: 0, r2: 0, c2: 0 }, 'won');
    t = stepDecimals(t, { r1: 0, c1: 0, r2: 0, c2: 0 }, { r: 0, c: 0 }, 1);
    const cell = t.rows[0].cells[0];
    expect(cell.v).toBe('1,234.50원');
    expect(editText(cell, styleOf(t, cell))).toBe('1234.5');
    const pct = setNumberFormat(row('0.125'), { r1: 0, c1: 0, r2: 0, c2: 0 }, 'pct');
    expect(editText(pct.rows[0].cells[0], styleOf(pct, pct.rows[0].cells[0]))).toBe('12.5%');
    // 서식 없는 칸은 친 그대로
    expect(editText({ v: '1,234원' })).toBe('1,234원');
  });

  it('수를 글로 고치면 원래 수(n)는 빠진다 · 비우기도', () => {
    const won = setNumberFormat(row('1234'), { r1: 0, c1: 0, r2: 0, c2: 0 }, 'won');
    const text = setCellText(won, 0, 0, '없음');
    expect(text.rows[0].cells[0]).toEqual({ v: '없음', s: 0 });
    const cleared = clearRange(won, { r1: 0, c1: 0, r2: 0, c2: 0 });
    expect(cleared.rows[0].cells[0]).toEqual({ v: '', s: 0 });
    expect(cellWithInput({ v: '1', n: 1 }, '2')).toEqual({ v: '2' });
  });

  it('새 행은 위 행 서식(원)을 따른다 · 저장 모양에 n·nf·dp', () => {
    const won = setNumberFormat(row('1234'), { r1: 0, c1: 0, r2: 0, c2: 0 }, 'won');
    const grown = setCellText(insertRow(won, 1), 1, 0, '500');
    expect(grown.rows[1].cells[0]).toMatchObject({ v: '500원', n: 500 });
    const saved = tableForSave(grown);
    expect(saved.rows[0].cells[0]).toEqual({ v: '1,234원', n: 1234, s: 0 });
    expect(saved.styles).toEqual([{ nf: 'won' }]);
    expect(JSON.stringify(saved)).not.toContain('undefined');
  });
});

describe('꾸밈 - 굵게·맞춤·칸 색 (P48-2 ⓕ)', () => {
  it('굵게 = 모두 굵으면 풂 · 붙여넣은 서식은 그대로 둔다', () => {
    let t = row('a', 'b');
    t = { ...t, styles: [{ c: '#ff0000' }], rows: [{ cells: [{ v: 'a', s: 0 }, { v: 'b' }] }] };
    const bold = toggleBold(t, all(t));
    expect(bold.rows[0].cells.map((c) => styleOf(bold, c))).toEqual([{ b: 1, c: '#ff0000' }, { b: 1 }]);
    const unbold = toggleBold(bold, all(bold));
    expect(unbold.rows[0].cells.map((c) => styleOf(unbold, c))).toEqual([{ c: '#ff0000' }, undefined]);
    expect(unbold.styles).toEqual([{ c: '#ff0000' }]);
  });

  it('맞춤·칸 색 - 고른 칸만, 처음대로·없음 = 지운다 · 같은 모양은 한 번', () => {
    const t = row('1', '2', '3');
    const c = setAlign(t, { r1: 0, c1: 0, r2: 0, c2: 1 }, 'center');
    expect(c.rows[0].cells.map((x) => styleOf(c, x)?.ha)).toEqual(['center', 'center', undefined]);
    expect(c.styles).toEqual([{ ha: 'center' }]);
    const back = setAlign(c, all(c), undefined);
    expect(back.styles).toBeUndefined();
    const y = setFill(t, { r1: 0, c1: 2, r2: 0, c2: 2 }, '#fef9c3');
    expect(styleOf(y, y.rows[0].cells[2])).toEqual({ bg: '#fef9c3' });
    expect(setFill(y, all(y), undefined).styles).toBeUndefined();
  });
});

describe('그리기 - 맞춤을 정하지 않은 수 칸은 오른쪽', () => {
  it('수 = 오른쪽 · 글 = 그대로 · 정한 맞춤이 이긴다', () => {
    expect(baseCellCss(undefined, { v: '1,234원' }).textAlign).toBe('right');
    expect(baseCellCss(undefined, { v: '홍길동' }).textAlign).toBeUndefined();
    expect(baseCellCss({ ha: 'center' }, { v: '1234' }).textAlign).toBe('center');
    expect(baseCellCss(undefined, { v: '2027-03-02' }).textAlign).toBeUndefined();
  });
});
