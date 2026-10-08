// 끌어 옮기기의 쓰기 - 하루짜리는 date·차례만, 기간은 이 날만(떼어 내기)·통째로, 반복은 같은 날 수만큼
import { describe, expect, it } from 'vitest';
import type { WriteOp } from '../../data/repo/ops';
import type { ItemDoc } from './eventOps';
import { moveOnlyOps, needsMoveScope, periodMovePreview, seriesMovePreview, shiftLabel, shiftPeriodOps, shiftSeriesOps } from './moveOps';

const SID = 'u_me';
const ev = (id: string, more: Partial<ItemDoc> = {}) => ({ id, kind: 'event', date: '2026-10-08', text: id, labelIds: ['L'], order: 'a0', ...more }) as ItemDoc;
type Patch = Extract<WriteOp, { type: 'patch' }>;
type Create = Extract<WriteOp, { type: 'create' }>;
const newId = () => 'n1';

describe('하루짜리', () => {
  it('date·차례만 (알림은 다시 울린다), 같은 날이면 쓰지 않는다', () => {
    const a = ev('a', { time: '09:00', alarmDone: true, done: true, linkIds: ['x'] });
    const ops = moveOnlyOps(SID, a, '2026-10-08', '2026-10-12', 'b5', newId) as Patch[];
    expect(ops).toHaveLength(1);
    expect(ops[0].changes).toEqual({ date: '2026-10-12', order: 'b5', alarmDone: undefined });
    expect(moveOnlyOps(SID, a, '2026-10-08', '2026-10-08', 'b5', newId)).toEqual([]);
    expect(needsMoveScope(a)).toBe(false);
  });
});

describe('기간', () => {
  // 10/7(수)~10/13(화) 주말 빼기 = 5일, 10/8 끝냄
  const p = ev('p', { date: '2026-10-07', endDate: '2026-10-13', workdays: true, doneDates: ['2026-10-08'], skipDates: ['2026-10-12'] });
  it('이 날만 = 그날을 빼고 그 날에 하루 일정 (끝냈으면 끝낸 채로)', () => {
    const ops = moveOnlyOps(SID, p, '2026-10-08', '2026-10-15', 'c0', newId);
    expect(ops.map((o) => o.type)).toEqual(['patch', 'create']);
    expect((ops[0] as Patch).changes.skipDates).toEqual(['2026-10-08', '2026-10-12']);
    expect((ops[1] as Create).data).toMatchObject({ kind: 'event', date: '2026-10-15', text: 'p', order: 'c0', done: true });
    expect(needsMoveScope(p)).toBe(true);
  });
  it('통째로 = 끝 날·뺀 날·끝낸 날도 같은 날 수만큼', () => {
    const ops = shiftPeriodOps(SID, p, 7) as Patch[];
    expect(ops[0].changes).toEqual({ date: '2026-10-14', endDate: '2026-10-20', skipDates: ['2026-10-19'], doneDates: ['2026-10-15'] });
    expect(shiftPeriodOps(SID, p, 0)).toEqual([]);
  });
  it('미리 보기: 범위·옮긴 뒤 날 수 (주말 빼기면 다시 센다)', () => {
    // 하루 뒤로: 10/8(목)~10/14(수), 10/13 뺌 → 8·9·12·14 = 4일
    expect(periodMovePreview(p, 1)).toEqual({ count: 4, from: ['2026-10-07', '2026-10-13'], to: ['2026-10-08', '2026-10-14'], offDays: 0, daysAfter: 4 });
    // 주말 빼기가 아니면 주말에 놓이는 날을 센다: 10/9(금)~10/11(일) → 이틀 뒤 10/11(일)~10/13(화)
    const q = ev('q', { date: '2026-10-09', endDate: '2026-10-11' });
    expect(periodMovePreview(q, 2)).toMatchObject({ count: 3, offDays: 1, daysAfter: 3 });
  });
});

describe('반복', () => {
  const s1 = ev('s1', { date: '2026-10-05', seriesId: 'S', seriesIndex: 0 });
  const s2 = ev('s2', { date: '2026-10-12', seriesId: 'S', seriesIndex: 1 });
  const s3 = ev('s3', { date: '2026-10-19', seriesId: 'S', seriesIndex: 2, time: '09:00', alarmDone: true });
  const list = [s1, s2, s3];
  it('이 날부터 = 그 뒤 항목을 같은 날 수만큼, 전부 = 모두', () => {
    const after = shiftSeriesOps(SID, s2, '2026-10-14', 'after', list, undefined) as Patch[];
    expect(after.map((o) => [o.at.id, o.changes])).toEqual([
      ['s2', { date: '2026-10-14' }],
      ['s3', { date: '2026-10-21', alarmDone: undefined }],
    ]);
    expect((shiftSeriesOps(SID, s2, '2026-10-11', 'all', list, undefined) as Patch[]).map((o) => o.changes.date)).toEqual(['2026-10-04', '2026-10-11', '2026-10-18']);
    expect(shiftSeriesOps(SID, s2, '2026-10-12', 'all', list, undefined)).toEqual([]);
  });
  it('미리 보기: 주말에 놓이는 수, 며칠 옮기나', () => {
    expect(seriesMovePreview(list, -1)).toEqual({ count: 3, from: ['2026-10-05', '2026-10-19'], to: ['2026-10-04', '2026-10-18'], offDays: 3 });
    expect(shiftLabel('2026-10-12', '2026-10-14')).toBe('2일 뒤로');
    expect(shiftLabel('2026-10-12', '2026-10-11')).toBe('1일 앞으로');
  });
});
