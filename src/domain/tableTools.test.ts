// 표 Σ 자동 합계 · ⇣ 아래로 채우기 · 정렬 (P48-4 ■1 - PLAN 5장 'P48' ⓘ~ⓚ)
import { describe, expect, it } from 'vitest';
import type { EntryTable } from '../data/types';
import { insertCol, insertRow, newEmptyTable, setCellText } from './tableEdit';
import { setNumberFormat, styleOf } from './tableFormat';
import { aggregateAxes, moveFormula } from './tableFormula';
import { autoSum, fillDown, isAggregateCol, isAggregateLabel, isAggregateRow, sortNote, sortRowsOf, sortTable, type AutoFn } from './tableTools';

/** 글 격자로 표 (식도 setCellText로 넣는다) */
function grid(...rows: string[][]): EntryTable {
  let t = newEmptyTable(rows.length, Math.max(...rows.map((r) => r.length)), 1);
  rows.forEach((row, r) => row.forEach((v, c) => v && (t = setCellText(t, r, c, v))));
  return t;
}
/** 칸 이름('B3')으로 칸 */
const at = (t: EntryTable, name: string) => {
  const m = /^([A-Z])(\d+)$/.exec(name)!;
  return t.rows[Number(m[2]) - 1].cells[m[1].charCodeAt(0) - 65];
};
const v = (t: EntryTable, name: string) => at(t, name).v;
const f = (t: EntryTable, name: string) => at(t, name).f;
/** 범위 'B2:C5' (한 칸 'B6') */
const R = (name: string) => {
  const [a, b = a] = name.split(':');
  const p = (s: string) => ({ r: Number(s.slice(1)) - 1, c: s.charCodeAt(0) - 65 });
  return { r1: p(a).r, c1: p(a).c, r2: p(b).r, c2: p(b).c };
};
/** 된 결과의 표 (안 되면 시험을 깨뜨린다) */
function ok(res: ReturnType<typeof autoSum> | ReturnType<typeof fillDown>): EntryTable {
  if ('error' in res) throw new Error(res.error);
  if ('edit' in res) throw new Error(`edit ${res.edit}`);
  return res.table;
}
const sum = (t: EntryTable, name: string, fn: AutoFn = 'SUM') => autoSum(t, R(name), fn);

// 점수 표 (맨 아래는 빈 줄)
const scores = () =>
  grid(
    ['이름', '국어', '수학', '합계'],
    ['가', '90', '80', ''],
    ['나', '70', '95', ''],
    ['다', '85', '85', ''],
    ['라', '60', '', ''],
    ['', '', '', '']
  );

describe('식 베끼기·묶어 세는 식 (tableFormula)', () => {
  it('$ 없는 주소만 따라가고, 표 위·왼쪽 밖은 #REF!', () => {
    expect(moveFormula('=A1+B$2+$C3+$D$4', 2, 1)).toBe('=B3+C$2+$C5+$D$4');
    expect(moveFormula('=SUM(B2:C2) * 2', 1, 0)).toBe('=SUM(B3:C3) * 2');
    expect(moveFormula('=RANK(D2,$D$2:$D$5)', 3, 0)).toBe('=RANK(D5,$D$2:$D$5)');
    expect(moveFormula('=A1', -1, 0)).toBe('=#REF!');
    expect(moveFormula('=SUM(A2:B3)', 0, -1)).toBe('=SUM(#REF!)');
    expect(moveFormula('=1+(', 1, 0)).toBe('=1+(');
  });

  it('묶어 세는 쪽: 합계 줄 = 위아래 · 합계 열 = 옆 · 제 칸이 든 범위(누적 합)·RANK는 아니다', () => {
    expect(aggregateAxes('=SUM(B2:B5)', 5, 1)).toEqual({ down: true, across: false });
    expect(aggregateAxes('=SUM(B2:C2)', 1, 3)).toEqual({ down: false, across: true });
    expect(aggregateAxes('=SUM(B$2:B3)', 2, 1)).toEqual({ down: false, across: false });
    expect(aggregateAxes('=RANK(D2,$D$2:$D$5)', 1, 4)).toEqual({ down: false, across: false });
    expect(aggregateAxes('=ROUND(AVERAGE(B2:B5),1)', 5, 1).down).toBe(true);
    expect(aggregateAxes('=B2+C2', 1, 3)).toEqual({ down: false, across: false });
  });

  it('합계·평균 이름', () => {
    for (const s of ['합계', '총계', '소계', '계', '총점', '평균', '반 평균', '학급평균', '최고점', '최저', 'Total', 'AVG']) expect(isAggregateLabel(s), s).toBe(true);
    for (const s of ['국어', '이름', '합계표', '평균점수 비고', '인원', '']) expect(isAggregateLabel(s), s).toBe(false);
  });
});

describe('Σ 자동 합계 - 한 칸 (ⓘ)', () => {
  it('맨 아래 빈 칸 = 위로 이어진 수 (머리 이름은 빼고, 사이의 빈 칸·글도 함께)', () => {
    const t = ok(sum(scores(), 'B6'));
    expect(f(t, 'B6')).toBe('=SUM(B2:B5)');
    expect(v(t, 'B6')).toBe('305');
    // 수학 '라'는 빈 칸 · 글('결석')도 범위 안에 (합계가 건너뛴다)
    expect(f(ok(sum(scores(), 'C6')), 'C6')).toBe('=SUM(C2:C5)');
    const absent = setCellText(scores(), 2, 1, '결석');
    expect(f(ok(sum(absent, 'B6')), 'B6')).toBe('=SUM(B2:B5)');
    expect(v(ok(sum(absent, 'B6', 'AVERAGE')), 'B6')).toBe('78.33333333');
  });

  it('머리 이름 아래 칸(합계 열) = 왼쪽 수 · 두 번째 학생도 위 합계가 아니라 왼쪽', () => {
    let t = ok(sum(scores(), 'D2'));
    expect(f(t, 'D2')).toBe('=SUM(B2:C2)');
    expect(v(t, 'D2')).toBe('170');
    t = ok(sum(t, 'D3'));
    expect(f(t, 'D3')).toBe('=SUM(B3:C3)');
    // 머리 이름이 '합계'가 아니어도 (위 칸이 옆을 묶는 식이면)
    const plain = setCellText(scores(), 0, 3, '점수');
    expect(f(ok(sum(ok(sum(plain, 'D2')), 'D3')), 'D3')).toBe('=SUM(B3:C3)');
  });

  it('이름 열에서 멈춘다 (앞 번호 열까지 가지 않는다) · 점수 열의 결석은 지나간다', () => {
    const t = grid(['번호', '이름', '국어', '수학', '합계'], ['1', '가', '90', '80', ''], ['2', '나', '결석', '70', '']);
    expect(f(ok(sum(t, 'E2')), 'E2')).toBe('=SUM(C2:D2)');
    expect(f(ok(sum(t, 'E3')), 'E3')).toBe('=SUM(C3:D3)');
    expect(v(ok(sum(t, 'E3')), 'E3')).toBe('70');
  });

  it('합계 줄 아래 평균 = 합계 줄은 건너뛴다 · 합계 열 옆 평균 = 합계 열은 건너뛴다', () => {
    let t = ok(sum(scores(), 'B6'));
    t = setCellText(insertRow(setCellText(t, 5, 0, '합계'), 6), 6, 0, '평균');
    const avg = ok(sum(t, 'B7', 'AVERAGE'));
    expect(f(avg, 'B7')).toBe('=AVERAGE(B2:B5)');
    expect(v(avg, 'B7')).toBe('76.25');
    // 옆: D = 합계(식), E = 평균
    let w = grid(['이름', '국어', '수학', '합계', '평균'], ['가', '90', '80', '', '']);
    w = ok(sum(w, 'D2'));
    expect(f(ok(sum(w, 'E2', 'AVERAGE')), 'E2')).toBe('=AVERAGE(B2:C2)');
  });

  it('값만 붙여넣은 합계 줄(이름 \'합계\')도 건너뛴다', () => {
    const t = grid(['이름', '국어'], ['가', '90'], ['나', '70'], ['합계', '160'], ['평균', '']);
    expect(f(ok(sum(t, 'B5', 'AVERAGE')), 'B5')).toBe('=AVERAGE(B2:B3)');
  });

  it('합계 줄의 합계 열 모서리 = 위 합계들 (옆 합계 줄이 아니라)', () => {
    let t = scores();
    for (const r of ['D2', 'D3', 'D4', 'D5']) t = ok(sum(t, r));
    t = setCellText(t, 5, 0, '합계');
    t = ok(sum(t, 'B6'));
    t = ok(sum(t, 'C6'));
    const d = ok(sum(t, 'D6'));
    expect(f(d, 'D6')).toBe('=SUM(D2:D5)');
    expect(v(d, 'D6')).toBe('565');
  });

  it('식 칸은 다시 고른다 (합계 → 평균) · 글이 든 칸은 하지 않는다 · 묶을 것이 없으면 =SUM()을 연다', () => {
    const t = ok(sum(scores(), 'B6'));
    expect(f(ok(sum(t, 'B6', 'AVERAGE')), 'B6')).toBe('=AVERAGE(B2:B5)');
    expect(sum(scores(), 'B2')).toEqual({ error: expect.stringContaining('비어 있지 않습니다') });
    expect(autoSum(grid(['이름', ''], ['가', '']), R('B2'), 'MAX')).toEqual({ edit: '=MAX()' });
  });

  it('원 칸의 합계는 원 · 개수는 원 없이', () => {
    let t = setNumberFormat(scores(), R('B2:B5'), 'won');
    expect(v(t, 'B2')).toBe('90원');
    expect(v(ok(sum(t, 'B6')), 'B6')).toBe('305원');
    const n = ok(sum(t, 'B6', 'COUNT'));
    expect(v(n, 'B6')).toBe('4');
    // 위 칸 서식을 물려받은 새 줄에서도 개수는 원 없이
    t = setNumberFormat(t, R('B6'), 'won');
    const n2 = ok(sum(t, 'B6', 'COUNT'));
    expect(v(n2, 'B6')).toBe('4');
    expect(styleOf(n2, at(n2, 'B6'))?.nf).toBeUndefined();
  });
});

describe('Σ 자동 합계 - 범위 (ⓘ)', () => {
  it('수가 든 범위 = 바로 아래 빈 줄에 열마다 · 넣은 칸을 고른다', () => {
    const res = sum(scores(), 'B2:C5');
    const t = ok(res);
    expect([f(t, 'B6'), f(t, 'C6')]).toEqual(['=SUM(B2:B5)', '=SUM(C2:C5)']);
    expect([v(t, 'B6'), v(t, 'C6')]).toEqual(['305', '260']);
    expect('sel' in res && res.sel).toEqual(R('B6:C6'));
    expect('note' in res && res.note).toBeFalsy();
  });

  it('아래 칸이 비어 있지 않으면(또는 표 끝) 행을 하나 넣는다 · 머리 줄·이름 열을 함께 골라도 수만', () => {
    const full = grid(['이름', '국어', '수학'], ['가', '90', '80'], ['나', '70', '95']);
    const res = sum(full, 'A1:C3', 'AVERAGE');
    const t = ok(res);
    expect(t.rows).toHaveLength(4);
    expect([f(t, 'A4'), f(t, 'B4'), f(t, 'C4')]).toEqual([undefined, '=AVERAGE(B2:B3)', '=AVERAGE(C2:C3)']);
    expect('note' in res && res.note).toBe('4행을 넣어 적었습니다');
  });

  it('맨 아래 줄이 빈 범위 = 그 줄에 · 맨 오른쪽 열이 빈 범위 = 그 열에 · 둘 다 = 모서리에 전체', () => {
    const down = ok(sum(scores(), 'B2:C6'));
    expect([f(down, 'B6'), f(down, 'C6')]).toEqual(['=SUM(B2:B5)', '=SUM(C2:C5)']);
    const right = ok(sum(scores(), 'B2:D5'));
    expect([f(right, 'D2'), f(right, 'D5'), f(right, 'B6')]).toEqual(['=SUM(B2:C2)', '=SUM(B5:C5)', undefined]);
    const both = ok(sum(scores(), 'B2:D6', 'MAX'));
    expect([f(both, 'B6'), f(both, 'D3'), f(both, 'D6')]).toEqual(['=MAX(B2:B5)', '=MAX(B3:C3)', '=MAX(B2:C5)']);
    expect(v(both, 'D6')).toBe('95');
  });

  it('합계 열이 든 범위: 열마다는 합계 열도(전체 합) · 행마다(평균 열)는 합계 열을 빼고', () => {
    let t = scores();
    for (const r of ['D2', 'D3', 'D4', 'D5']) t = ok(sum(t, r));
    const cols = ok(sum(t, 'B2:D5'));
    expect([f(cols, 'B6'), f(cols, 'D6'), v(cols, 'D6')]).toEqual(['=SUM(B2:B5)', '=SUM(D2:D5)', '565']);
    const wide = setCellText(insertCol(t, 4), 0, 4, '평균');
    const avg = ok(sum(wide, 'B2:E5', 'AVERAGE'));
    expect([f(avg, 'E2'), v(avg, 'E2'), f(avg, 'E5')]).toEqual(['=AVERAGE(B2:C2)', '85', '=AVERAGE(B5:C5)']);
  });

  it('빈 칸만 고르면 칸마다 (합계 줄의 빈 칸들을 한 번에)', () => {
    const t = ok(sum(scores(), 'B6:D6'));
    // D6(합계 열의 합계 줄) = 위는 비었고 왼쪽 B6·C6 = 모두 더한 것
    expect([f(t, 'B6'), f(t, 'C6'), f(t, 'D6')]).toEqual(['=SUM(B2:B5)', '=SUM(C2:C5)', '=SUM(B6:C6)']);
    expect(v(t, 'D6')).toBe('565');
    const rows = ok(sum(scores(), 'D2:D5'));
    expect([f(rows, 'D2'), f(rows, 'D5')]).toEqual(['=SUM(B2:C2)', '=SUM(B5:C5)']);
  });

  it('범위 맨 아래 합계 줄은 묶지 않는다', () => {
    let t = ok(sum(scores(), 'B6:C6'));
    t = setCellText(t, 5, 0, '합계');
    const res = sum(t, 'B2:C6', 'AVERAGE');
    const avg = ok(res);
    // 아래 칸(B6·C6)은 식이라 '빈 줄'로 보지 않는다 - 합계 줄을 빼고 그 아래에 한 줄
    expect(avg.rows).toHaveLength(7);
    expect([f(avg, 'B6'), f(avg, 'B7'), f(avg, 'C7')]).toEqual(['=SUM(B2:B5)', '=AVERAGE(B2:B5)', '=AVERAGE(C2:C5)']);
    expect('note' in res && res.note).toBe('7행을 넣어 적었습니다');
  });
});

describe('⇣ 아래로 채우기 (ⓙ)', () => {
  it('맨 위 식을 아래로 - 주소가 행을 따라가고 $는 그대로', () => {
    let t = setCellText(scores(), 1, 3, '=B2+C2');
    t = ok(fillDown(t, R('D2:D5')));
    expect([f(t, 'D3'), f(t, 'D4'), f(t, 'D5')]).toEqual(['=B3+C3', '=B4+C4', '=B5+C5']);
    expect([v(t, 'D3'), v(t, 'D5')]).toEqual(['165', '60']);
    const r = ok(fillDown(setCellText(t, 1, 3, '=RANK(B2,$B$2:$B$5)'), R('D2:D5')));
    expect([f(r, 'D4'), v(r, 'D2'), v(r, 'D3'), v(r, 'D5')]).toEqual(['=RANK(B4,$B$2:$B$5)', '1', '3', '4']);
  });

  it('한 줄만 고르면 바로 위 칸을 · 글·서식도 베낀다 · 맨 위 줄이면 안내', () => {
    let t = setCellText(scores(), 1, 3, '1234');
    t = setNumberFormat(t, R('D2'), 'won');
    t = ok(fillDown(t, R('D3')));
    expect(at(t, 'D3')).toMatchObject({ v: '1,234원', n: 1234 });
    expect(styleOf(t, at(t, 'D3'))?.nf).toBe('won');
    expect(v(t, 'D4')).toBe('');
    expect(fillDown(t, R('A1:B1'))).toEqual({ error: expect.stringContaining('위 칸이 없습니다') });
  });

  it('병합된 칸이 있으면 하지 않는다', () => {
    const t = scores();
    const merged = { ...t, rows: t.rows.map((row, r) => (r === 2 ? { ...row, cells: row.cells.map((c, i) => (i === 1 ? { ...c, cs: 2 } : i === 2 ? { v: '', x: 1 as const } : c)) } : row)) };
    expect(fillDown(merged, R('B2:C4'))).toEqual({ error: expect.stringContaining('병합') });
  });
});

describe('정렬 (ⓚ)', () => {
  /** 이름·국어·수학·합계(행마다 식) + 맨 아래 평균 줄 */
  function withTotals(): EntryTable {
    let t = scores();
    for (let r = 1; r <= 4; r++) t = setCellText(t, r, 3, `=B${r + 1}+C${r + 1}`);
    t = setCellText(t, 5, 0, '평균');
    for (const c of ['B', 'C', 'D']) t = setCellText(t, 5, c.charCodeAt(0) - 65, `=AVERAGE(${c}2:${c}5)`);
    return t;
  }
  const names = (t: EntryTable) => t.rows.map((row) => row.cells[0].v);
  const sortBy = (t: EntryTable, pick: string, key: string, desc: boolean) => {
    const [r1, r2] = sortRowsOf(t, R(pick));
    const res = sortTable(t, r1, r2, key.charCodeAt(0) - 65, desc);
    return { t: ok(res), rows: [r1, r2] };
  };

  it('합계 큰 것부터 - 제목·평균 줄은 그대로, 같은 점수는 처음 차례, 행마다 식이 제 행, 평균 같음', () => {
    const t0 = withTotals();
    expect(isAggregateRow(t0, 5)).toBe(true);
    expect(isAggregateCol(t0, 3)).toBe(true);
    const { t, rows } = sortBy(t0, 'D3', 'D', true);
    expect(rows).toEqual([1, 4]);
    expect(names(t)).toEqual(['이름', '가', '다', '나', '라', '평균']);
    expect([f(t, 'D2'), f(t, 'D3'), f(t, 'D4'), f(t, 'D5')]).toEqual(['=B2+C2', '=B3+C3', '=B4+C4', '=B5+C5']);
    expect([v(t, 'D2'), v(t, 'D3'), v(t, 'D4'), v(t, 'D5')]).toEqual(['170', '170', '165', '60']);
    expect([f(t, 'B6'), v(t, 'B6'), v(t, 'D6')]).toEqual(['=AVERAGE(B2:B5)', '76.25', '141.25']);
    expect(sortNote(1, 4, 3, true)).toBe('2~5행을 D열 큰 것부터 정렬했습니다 (↶로 되돌립니다)');
  });

  it('빈 칸은 작은 것부터·큰 것부터 모두 맨 아래 · 글은 가나다 · 숫자 섞인 글은 수 차례', () => {
    expect(names(sortBy(withTotals(), 'C2', 'C', false).t)).toEqual(['이름', '가', '다', '나', '라', '평균']);
    expect(names(sortBy(withTotals(), 'C2', 'C', true).t)).toEqual(['이름', '나', '다', '가', '라', '평균']);
    expect(names(sortBy(withTotals(), 'A2', 'A', true).t)).toEqual(['이름', '라', '다', '나', '가', '평균']);
    const nums = grid(['번호'], ['10번'], ['2번'], ['1번'], ['']);
    expect(names(sortBy(nums, 'A2', 'A', false).t)).toEqual(['번호', '1번', '2번', '10번', '']);
    // 수 → 글 (작은 것부터), 큰 것부터는 거꾸로
    const mixed = grid(['값'], ['나'], ['5'], ['가'], ['12']);
    expect(names(sortBy(mixed, 'A2', 'A', false).t)).toEqual(['값', '5', '12', '가', '나']);
    expect(names(sortBy(mixed, 'A2', 'A', true).t)).toEqual(['값', '나', '가', '12', '5']);
  });

  it('행 몇 개만 고르면 그 행들만 · 표 높이 전체(열 머리)를 고르면 저절로 (제목 빼고)', () => {
    const { t, rows } = sortBy(withTotals(), 'B3:B4', 'B', true);
    expect(rows).toEqual([2, 3]);
    expect(names(t)).toEqual(['이름', '가', '다', '나', '라', '평균']);
    expect(sortRowsOf(withTotals(), R('C1:C6'))).toEqual([1, 4]);
    // 끝의 빈 줄·값만 붙인 합계 줄도 뺀다
    const pasted = grid(['이름', '점수'], ['가', '70'], ['나', '90'], ['합계', '160'], ['', '']);
    expect(sortRowsOf(pasted, R('B2'))).toEqual([1, 2]);
  });

  it('바뀐 것이 없으면 그 표 그대로 · 한 행뿐이면 안내 · 위아래 병합이 걸치면 하지 않는다', () => {
    const t = withTotals();
    expect(sortTable(t, 1, 4, 0, false)).toEqual({ table: t });
    expect(sortTable(t, 2, 2, 0, false)).toEqual({ error: expect.stringContaining('둘 이상') });
    const merged = { ...t, rows: t.rows.map((row, r) => (r === 1 ? { ...row, cells: row.cells.map((c, i) => (i === 0 ? { ...c, rs: 2 } : c)) } : r === 2 ? { ...row, cells: row.cells.map((c, i) => (i === 0 ? { v: '', x: 1 as const } : c)) } : row)) };
    expect(sortTable(merged, 1, 4, 1, true)).toEqual({ error: expect.stringContaining('병합') });
  });

  it('다른 행을 가리키는 식이 아니면 밖의 식은 그대로 맞다 (합계 범위)', () => {
    let t = insertCol(withTotals(), 4);
    t = setCellText(t, 0, 4, '석차');
    for (let r = 1; r <= 4; r++) t = setCellText(t, r, 4, `=RANK(D${r + 1},$D$2:$D$5)`);
    const s = sortBy(t, 'D2', 'D', false).t;
    expect(names(s)).toEqual(['이름', '라', '나', '가', '다', '평균']);
    expect([v(s, 'E2'), v(s, 'E3'), v(s, 'E4'), v(s, 'E5')]).toEqual(['4', '3', '1', '1']);
    expect(f(s, 'E2')).toBe('=RANK(D2,$D$2:$D$5)');
  });
});
