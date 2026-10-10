import { describe, expect, it } from 'vitest';
import {
  bareSummary,
  composeSummary,
  gcalOn,
  invisiblePrefix,
  isSameItem,
  itemPayloads,
  nextDayStr,
  planItemSync,
  spIdOf,
  summaryCore,
  type GoogleEvent,
  type ItemPayloadContext,
} from './gcal';

// 구글 캘린더 (V4 calendarSync·gcalPlan 테스트에서 옮긴 것 + V5 항목 맞추기)

describe('글·날짜 (V4 그대로)', () => {
  it('종일 일정 끝 = 다음 날 (달·해 넘김)', () => {
    expect(nextDayStr('2026-02-28')).toBe('2026-03-01');
    expect(nextDayStr('2026-12-31')).toBe('2027-01-01');
  });
  it('제목: 라벨은 뒤, 완료 ✅는 앞, 수업은 라벨 먼저 · 알맹이는 앞뒤 [묶음]을 뗀다', () => {
    const s = composeSummary(3, true, '학년 협의회', '회의');
    expect(s.startsWith(invisiblePrefix(3))).toBe(true);
    expect(bareSummary(s)).toBe('학년 협의회 [회의]');
    expect(bareSummary(composeSummary(1, false, '국어', '1교시', true))).toBe('[1교시] 국어');
    expect(summaryCore('[회의] 학년 협의회')).toBe(summaryCore(s));
    expect(summaryCore('[통째로]')).toBe('[통째로]');
  });
  it('손으로 보내기 짝: 둘 다 id가 있으면 id, 없으면 제목', () => {
    const p = { summary: composeSummary(1, false, '상담', '일정'), description: '', start: { date: 'x' }, end: { date: 'y' }, extendedProperties: { private: { type: 'event', dateStr: '2026-10-05', sp_id: 'a' } } };
    expect(isSameItem({ id: 'g', extendedProperties: { private: { type: 'event', dateStr: '2026-10-05', sp_id: 'b' } } }, p)).toBe(false);
    expect(isSameItem({ id: 'g', summary: '상담 [다른 라벨]', extendedProperties: { private: { type: 'event', dateStr: '2026-10-05' } } }, p)).toBe(true);
  });
});

describe('보낼 일정인가', () => {
  const labelGcal = (ids: readonly string[]) => ids.includes('L_g');
  it('일정에 적은 값 먼저, 없으면 라벨 - 지운 것·메모·빈 글은 아니다', () => {
    const ev = { id: 'a', kind: 'event', date: '2026-10-05', text: '상담', labelIds: ['L_g'] };
    expect(gcalOn(ev, labelGcal)).toBe(true);
    expect(gcalOn({ ...ev, props: { gcal: false } }, labelGcal)).toBe(false);
    expect(gcalOn({ ...ev, labelIds: [], props: { gcal: true } }, labelGcal)).toBe(true);
    expect(gcalOn({ ...ev, deletedAt: 1 }, labelGcal)).toBe(false);
    expect(gcalOn({ ...ev, kind: 'note' }, labelGcal)).toBe(false);
    expect(gcalOn({ ...ev, text: ' ' }, labelGcal)).toBe(false);
    expect(gcalOn(null, labelGcal)).toBe(false);
  });
  it('sp_id: 가져온 것은 V4 id (기간은 V5 id)', () => {
    expect(spIdOf({ id: 'v5', src: { from: 'v4', id: 'ev_1' } })).toBe('ev_1');
    expect(spIdOf({ id: 'v5', src: { from: 'v4', id: 'period:g1' } })).toBe('v5');
    expect(spIdOf({ id: 'v5' })).toBe('v5');
  });
});

const ctx = (over: Partial<ItemPayloadContext> = {}): ItemPayloadContext => ({
  dates: ['2026-10-05'],
  doneOn: () => false,
  labelNames: ['회의'],
  seqOf: () => 2,
  ...over,
});

describe('항목 → 보낼 것', () => {
  it('하루짜리: 그 날 하나, V4와 같은 표시 + sp_auto·sp_item', () => {
    const [p] = itemPayloads({ id: 'v5', kind: 'event', date: '2026-10-05', text: ' 협의회 ' }, ctx({ doneOn: () => true }));
    expect(p.start).toEqual({ date: '2026-10-05' });
    expect(p.end).toEqual({ date: '2026-10-06' });
    expect(bareSummary(p.summary)).toBe('협의회 [회의]');
    expect(p.summary.startsWith(`${invisiblePrefix(2)}✅ `)).toBe(true);
    expect(p.extendedProperties.private).toMatchObject({ app: 'SchoolPlannerV3', dateStr: '2026-10-05', type: 'event', labelStr: '회의', completed: 'true', sp_id: 'v5', sp_auto: 'true', sp_item: 'v5' });
  });
  it('기간: 보이는 날마다 (k/n)·그날 완료, 라벨이 없으면 [일정]', () => {
    const ps = itemPayloads(
      { id: 'p', kind: 'event', date: '2026-10-05', endDate: '2026-10-06', text: '기말고사' },
      ctx({ dates: ['2026-10-05', '2026-10-06'], position: (d) => ({ k: d === '2026-10-05' ? 1 : 2, n: 2 }), doneOn: (d) => d === '2026-10-06', labelNames: [] }),
    );
    expect(ps.map((p) => [bareSummary(p.summary), p.extendedProperties.private.completed])).toEqual([
      ['기말고사 (1/2) [일정]', 'false'],
      ['기말고사 (2/2) [일정]', 'true'],
    ]);
  });
});

const gev = (id: string, priv: Record<string, string>, summary = ''): GoogleEvent => ({ id, summary, description: '📌 School Planner에서 관리되는 일정입니다.', extendedProperties: { private: { type: 'event', app: 'SchoolPlannerV3', ...priv } } });

describe('구글의 것과 맞추기', () => {
  const [p] = itemPayloads({ id: 'v5', kind: 'event', date: '2026-10-05', text: '상담' }, ctx());
  it('처음: 넣기 · 같으면 그대로 · 바뀌면 고치기', () => {
    expect(planItemSync('v5', 'v5', [], [p])).toEqual({ post: [p], put: [], del: [] });
    const same = gev('g1', { ...p.extendedProperties.private }, p.summary);
    expect(planItemSync('v5', 'v5', [same], [p])).toEqual({ post: [], put: [], del: [] });
    const old = gev('g1', { ...p.extendedProperties.private, completed: 'true' }, '✅ 상담 [회의]');
    expect(planItemSync('v5', 'v5', [old], [p]).put.map((x) => x.id)).toEqual(['g1']);
  });
  it('옮겼으면(다른 날) 넣고 옛 날 것은 지운다 · 끄거나 지웠으면(보낼 것 없음) 지운다', () => {
    const moved = gev('g1', { ...p.extendedProperties.private, dateStr: '2026-10-01' }, p.summary);
    expect(planItemSync('v5', 'v5', [moved], [p])).toEqual({ post: [p], put: [], del: ['g1'] });
    expect(planItemSync('v5', 'v5', [moved], [])).toEqual({ post: [], put: [], del: ['g1'] });
  });
  it('두 기기가 함께 넣은 둘 - 하나는 지운다', () => {
    const a = gev('g1', { ...p.extendedProperties.private }, p.summary);
    const b = gev('g2', { ...p.extendedProperties.private }, p.summary);
    expect(planItemSync('v5', 'v5', [a, b], [p])).toEqual({ post: [], put: [], del: ['g2'] });
  });
  it('가져온 항목: V4가 보낸 것(같은 sp_id·같은 날)을 이어 맡는다(PUT) - 두 벌이 되지 않는다', () => {
    const [q] = itemPayloads({ id: 'v5', kind: 'event', date: '2026-10-05', text: '상담', src: { from: 'v4', id: 'ev_1' } }, ctx());
    const v4 = gev('g9', { dateStr: '2026-10-05', sp_id: 'ev_1', sp_auto: 'true', completed: 'false' }, q.summary);
    expect(planItemSync('v5', 'ev_1', [v4], [q])).toEqual({ post: [], put: [{ id: 'g9', payload: q }], del: [] });
  });
  it('V4 이월 사슬(날마다 다른 id) · 기간 조각: 같은 날 같은 글로 짝', () => {
    const v4 = gev('g9', { dateStr: '2026-10-05', sp_id: 'ev_other', sp_auto: 'true' }, `${invisiblePrefix(5)}상담 [회의]`);
    expect(planItemSync('v5', 'ev_1', [v4], [p]).put.map((x) => x.id)).toEqual(['g9']);
  });
  it('V4 것은 이 항목의 자동 보낸 것(같은 sp_id·sp_auto)만 지우고, 손으로 보낸 것·남의 것은 둔다', () => {
    const auto = gev('a', { dateStr: '2026-10-01', sp_id: 'ev_1', sp_auto: 'true' }, '상담 [회의]');
    const manual = gev('m', { dateStr: '2026-10-01', sp_id: 'ev_1' }, '상담 [회의]');
    const other = gev('o', { dateStr: '2026-10-05', sp_id: 'ev_2', sp_auto: 'true' }, '다른 일 [회의]');
    expect(planItemSync('v5', 'ev_1', [auto, manual, other], [])).toEqual({ post: [], put: [], del: ['a'] });
  });
});
