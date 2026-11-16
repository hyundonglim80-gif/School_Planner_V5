import { describe, expect, it } from 'vitest';
import { cutPieces, effectiveSegments, FAR_END, fillGrid, fillPieces, isAppliedTimetable, isSavedTimetable, planApplied } from './timetableApply';

const tt = (id: string, from: string, to: string, over: Record<string, unknown> = {}) => ({ id, name: id, from, to, grid: {}, ...over });

describe('저장된 시간표 / 적용된 시간표', () => {
  it("kind 'saved'와 기간 없는 옛 표는 저장된 것, 기간이 있으면 적용된 것", () => {
    expect(isSavedTimetable({ kind: 'saved', from: '' })).toBe(true);
    expect(isSavedTimetable({ from: '' })).toBe(true);
    expect(isAppliedTimetable({ from: '2026-03-01' })).toBe(true);
    expect(isAppliedTimetable({ kind: 'saved', from: '2026-03-01' })).toBe(false);
  });
});

describe('날마다 쓰이는 조각', () => {
  it('늦게 시작한 것이 이긴다 - 1학기 · 2학기', () => {
    expect(effectiveSegments([tt('a', '2026-03-01', '2027-02-28'), tt('b', '2026-09-01', '2027-02-28')])).toEqual([
      { id: 'a', from: '2026-03-01', to: '2026-08-31' },
      { id: 'b', from: '2026-09-01', to: '2027-02-28' },
    ]);
  });

  it('안에 든 짧은 표가 끝나면 앞 표가 다시 이어진다', () => {
    expect(effectiveSegments([tt('a', '2026-03-01', '2027-02-28'), tt('w', '2026-12-01', '2026-12-31')])).toEqual([
      { id: 'a', from: '2026-03-01', to: '2026-11-30' },
      { id: 'w', from: '2026-12-01', to: '2026-12-31' },
      { id: 'a', from: '2027-01-01', to: '2027-02-28' },
    ]);
  });

  it('끝 날 없음 · 저장된 시간표는 빼고 · 같은 날 시작하면 나중에 만든 것', () => {
    expect(effectiveSegments([tt('a', '2026-03-01', ''), tt('s', '', '', { kind: 'saved' })])).toEqual([{ id: 'a', from: '2026-03-01', to: FAR_END }]);
    const twins = [tt('old', '2026-08-17', '2027-02-28', { createdAt: 1 }), tt('new', '2026-08-17', '2027-02-28', { createdAt: 2 })];
    expect(effectiveSegments(twins)).toEqual([{ id: 'new', from: '2026-08-17', to: '2027-02-28' }]);
  });

  it('조각에서 기간 빼기 - 앞·뒤가 남으면 둘로', () => {
    const p = [{ id: 'a', from: '2026-03-01', to: '2027-02-28' }];
    expect(cutPieces(p, { from: '2026-05-01', to: '2026-05-31' })).toEqual([
      { id: 'a', from: '2026-03-01', to: '2026-04-30' },
      { id: 'a', from: '2026-06-01', to: '2027-02-28' },
    ]);
    expect(cutPieces(p, { from: '2026-01-01', to: '2027-12-31' })).toEqual([]);
    expect(cutPieces(p, { from: '2027-03-01', to: '2027-03-31' })).toEqual(p);
  });
});

describe('적용 계획', () => {
  const a = tt('a', '2026-03-01', '2027-02-28');

  it('뒤를 덮으면 앞 문서의 끝을 줄인다 · 가운데면 둘로 · 다 덮이면 지운다', () => {
    expect(planApplied([a], { from: '2026-10-14', to: '2027-02-28' })).toEqual({ reshape: [{ id: 'a', pieces: [{ from: '2026-03-01', to: '2026-10-13' }] }], drop: [] });
    expect(planApplied([a], { from: '2026-05-01', to: '2026-05-31' }).reshape[0].pieces).toHaveLength(2);
    expect(planApplied([a], { from: '2026-03-01', to: '2027-02-28' })).toEqual({ reshape: [], drop: ['a'] });
    expect(planApplied([a], { from: '2027-03-01', to: '2027-03-31' })).toEqual({ reshape: [], drop: [] });
  });

  it('옛 자료의 겹침은 날마다 쓰이던 대로 겹치지 않게 다듬는다 (늘 가려지던 표는 지운다)', () => {
    const old = [a, tt('b', '2026-09-01', '2027-02-28'), tt('hidden', '2026-09-01', '2026-12-31', { createdAt: -1 })];
    expect(planApplied(old, { from: '2026-09-10', to: '2026-09-20' })).toEqual({
      reshape: [
        { id: 'a', pieces: [{ from: '2026-03-01', to: '2026-08-31' }] },
        { id: 'b', pieces: [{ from: '2026-09-01', to: '2026-09-09' }, { from: '2026-09-21', to: '2027-02-28' }] },
      ],
      drop: ['hidden'],
    });
  });
});

describe('빈 칸만 채우기 (P39)', () => {
  it('앞 표에 과목이 있는 칸은 그대로, 빈 칸에만 채운다 · 채운 칸 수', () => {
    const base = { '1': { '1': '국어', '2': '  ', '3': '수학' }, '3': { '1': '음악' } };
    const add = { '1': { '1': '체육', '2': '과학' }, '2': { '4': '미술' }, '3': { '1': '' } };
    expect(fillGrid(base, add)).toEqual({ grid: { '1': { '1': '국어', '2': '과학', '3': '수학' }, '3': { '1': '음악' }, '2': { '4': '미술' } }, added: 2 });
    expect(fillGrid(base, { '1': { '1': '체육' } }).added).toBe(0);
  });

  it('앞 표마다 채운 조각 · 적용된 표가 없는 날은 새 표 그대로 · 채울 칸이 없는 조각은 뺀다', () => {
    const add = { '1': { '5': '방과후' } };
    const list = [
      tt('a', '2026-03-02', '2026-05-31', { grid: { '1': { '1': '국어' } } }),
      tt('full', '2026-06-01', '2026-06-30', { grid: { '1': { '5': '창체' } } }),
      tt('b', '2026-08-01', '', { grid: { '2': { '1': '수학' } } }),
    ];
    expect(fillPieces(list, { from: '2026-05-01', to: '2026-09-30' }, add)).toEqual([
      { from: '2026-05-01', to: '2026-05-31', baseId: 'a', grid: { '1': { '1': '국어', '5': '방과후' } } },
      { from: '2026-07-01', to: '2026-07-31', baseId: null, grid: add },
      { from: '2026-08-01', to: '2026-09-30', baseId: 'b', grid: { '2': { '1': '수학' }, '1': { '5': '방과후' } } },
    ]);
    // 적용된 표가 하나도 없으면 기간 전체가 새 표
    expect(fillPieces([], { from: '2026-03-02', to: '2026-07-20' }, add)).toEqual([{ from: '2026-03-02', to: '2026-07-20', baseId: null, grid: add }]);
    // 모든 날의 앞 표에 이미 그 칸이 있으면 채울 것이 없다
    expect(fillPieces(list, { from: '2026-06-03', to: '2026-06-20' }, add)).toEqual([]);
  });

  it('여러 기간을 한 번에 빼기 (채운 조각만 앞 문서에서 빠진다)', () => {
    const list = [tt('a', '2026-03-01', '2027-02-28')];
    expect(planApplied(list, [{ from: '2026-04-01', to: '2026-04-30' }, { from: '2026-06-01', to: '2026-06-30' }])).toEqual({
      reshape: [{ id: 'a', pieces: [{ from: '2026-03-01', to: '2026-03-31' }, { from: '2026-05-01', to: '2026-05-31' }, { from: '2026-07-01', to: '2027-02-28' }] }],
      drop: [],
    });
  });
});
