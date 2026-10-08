import { describe, expect, it } from 'vitest';
import type { WriteOp } from '../../data/repo/ops';
import type { Stored } from '../../data/types';
import { v4id } from './ids';
import { planItems, type V4ItemDocs } from './items';
import type { V4LabelDocs } from './labels';

const SID = 'u_me';
type Create = Extract<WriteOp, { type: 'create' }>;

const labelDocs: V4LabelDocs = {
  labels: {
    eventLabels: [
      { id: 'ev_1', name: '달력', color: 'red', calendar: true },
      { id: 'ev_3', name: '이월', color: 'green', calendar: false, forward: true },
    ],
    journalLabels: [{ id: 'j_1', name: '학급활동', color: 'green' }],
    memoLabels: ['긴급'],
  },
};
const labelMap = { event: { 달력: 'L_cal', 이월: 'L_fwd' }, note: { 학급활동: 'L_cls', 긴급: 'L_urg' } };
const none = { items: {}, series: {} };

const plan = (docs: Partial<V4ItemDocs>, existing = none) =>
  planItems(SID, { events: {}, journals: {}, tasks: {}, ...docs }, labelDocs, labelMap, existing as never);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = { id: string; coll: string } & Record<string, any>;
const created = (ops: WriteOp[]): Row[] => ops.filter((o): o is Create => o.type === 'create').map((o) => ({ id: o.at.id, coll: o.at.coll, ...o.data }));

describe('일정 가져오기', () => {
  it('라벨 → id, 속성은 라벨과 다른 것만, 완료·알림·기한, 본문은 그대로', () => {
    const r = plan({
      events: {
        '2026-10-05': {
          eventList: [
            { id: 'a', content: '공문', label: '이월', labelIds: ['ev_3'], completed: true, time: '2026-10-05T09:30', alarmTriggered: true, due: '2026-10-09' },
            { id: 'b', content: '협의회', label: '달력', calendar: false, forward: false },
          ],
        },
      },
    });
    const [a, b] = created(r.ops);
    expect(a).toMatchObject({ id: v4id('item.event', SID, 'events/2026-10-05', 'a'), kind: 'event', date: '2026-10-05', text: '공문', labelIds: ['L_fwd'], done: true, time: '09:30', alarmDone: true, due: '2026-10-09' });
    expect(a).not.toHaveProperty('props');
    // calendar: false는 '달력' 라벨과 다르다, forward: false는 V4가 믿지 않는 값(늘 적었다)
    expect(b).toMatchObject({ text: '협의회', labelIds: ['L_cal'], props: { calendar: false } });
    expect(a.src).toMatchObject({ from: 'v4', path: 'events/2026-10-05', id: 'a' });
    expect(r.counts['items.event']).toMatchObject({ added: 2, years: { '2026': 2 } });
  });

  it('id 없는 일정(V3 글 모양)은 날짜|글|라벨로 셈한다 - 공휴일·빈 글은 뺀다, 알림 날이 다르면 수를 적는다', () => {
    const r = plan({
      events: {
        '2026-10-06': { eventText: '[v] [이월] 청소\n청소\n[공휴일] 개천절' },
        '2026-10-07': { eventList: [{ content: '' }, { content: '상담', time: '2026-10-08T10:00' }] },
      },
    });
    const items = created(r.ops);
    expect(items.map((i) => i.text)).toEqual(['청소', '청소', '상담']);
    expect(items[0].id).toBe(v4id('item.event', SID, 'events/2026-10-06', '2026-10-06|청소|이월'));
    expect(items[1].id).toBe(v4id('item.event', SID, 'events/2026-10-06', '2026-10-06|청소|'));
    expect(r.notes).toMatchObject({ holidays: 1, empty: 1, alarmMoved: 1 });
  });

  it('이월 사슬: 끝내지 않았으면 처음 날 + carrying (사슬로 셈한 id), 끝냈으면 carriedFrom', () => {
    const r = plan({
      events: {
        '2026-10-08': {
          eventList: [
            { id: 'x9', content: '보고서', labelIds: ['ev_3'], forwardChainId: 'c1', originalDate: '2026-10-01' },
            { id: 'y9', content: '정리', labelIds: ['ev_3'], forwardChainId: 'c2', originalDate: '2026-10-02', completed: true },
          ],
        },
      },
      dues: { dues: { c1: '2026-10-20' } },
    });
    const [x, y] = created(r.ops);
    expect(x).toMatchObject({ id: v4id('item.event', SID, 'events/chain', 'chain:c1'), date: '2026-10-01', carrying: true, due: '2026-10-20' });
    expect(y).toMatchObject({ date: '2026-10-08', carriedFrom: '2026-10-02', done: true });
    expect(y).not.toHaveProperty('carrying');
  });

  it('기간 조각 → 한 항목 (글 끝 떼기·평일만이면 workdays·빈 날 skipDates·날마다 완료)', () => {
    // 10/14(수) ~ 10/20(화): 10/16 조각이 없다
    const piece = (d: string, i: number, done = false) => [d, { eventList: [{ id: `p${i}`, content: `기말고사 (${i}/5)`, groupId: 'g1', label: '달력', completed: done }] }];
    const r = plan({ events: Object.fromEntries([piece('2026-10-14', 1, true), piece('2026-10-15', 2), piece('2026-10-19', 4), piece('2026-10-20', 5)]) });
    const items = created(r.ops);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: v4id('item.event', SID, 'events/period', 'g1|기말고사|5'),
      text: '기말고사',
      date: '2026-10-14',
      endDate: '2026-10-20',
      workdays: true,
      skipDates: ['2026-10-16'],
      doneDates: ['2026-10-14'],
    });
    expect(r.notes.periods).toBe(1);
  });

  it('반복 묶음 → series(imported) + seriesId·seriesIndex', () => {
    const r = plan({
      events: {
        '2026-10-13': { eventList: [{ id: 'r2', content: '협의회', groupId: 'g2' }] },
        '2026-10-06': { eventList: [{ id: 'r1', content: '협의회', groupId: 'g2' }] },
        '2026-10-07': { eventList: [{ id: 'solo', content: '혼자', groupId: 'g3' }] },
      },
    });
    const all = created(r.ops);
    const series = all.find((i) => i.coll === 'series')!;
    expect(series).toMatchObject({ id: v4id('series', SID, 'events', 'g2'), imported: true, start: '2026-10-06', until: '2026-10-13', count: 2, template: { text: '협의회' } });
    const items = all.filter((i) => i.coll === 'items');
    expect(items.find((i) => i.text === '혼자')).not.toHaveProperty('seriesId');
    expect(items.filter((i) => i.seriesId === series.id).map((i) => [i.date, i.seriesIndex])).toEqual([
      ['2026-10-06', 0],
      ['2026-10-13', 1],
    ]);
  });
});

describe('기록·메모·링크 가져오기', () => {
  it('기록: 라벨 id·이름 → V5, [표] → 빈 글, 자동 기록은 뺀다, 완료·즐겨찾기', () => {
    const table = { id: 't', rows: [{ cells: [{ v: '1' }] }], createdAt: 1 };
    const r = plan({
      journals: {
        '2026-10-05': {
          entries: [
            { id: 'j1', content: '모둠 활동', labelIds: ['j_1'], completed: true, favorite: true },
            { id: 'j2', content: '[표]', tables: [table], label: '긴급' },
            { id: 'notice_2026-10-05', content: '알림장' },
            { id: 'attendance_x', content: '출결' },
          ],
        },
      },
    });
    const [a, b] = created(r.ops);
    expect(a).toMatchObject({ kind: 'note', date: '2026-10-05', text: '모둠 활동', labelIds: ['L_cls'], done: true, favorite: true });
    expect(b).toMatchObject({ text: '', tables: [table], labelIds: ['L_urg'] });
    expect(r.notes.autoJournals).toBe(2);
  });

  it('메모: 이름 라벨, V4 차례(order 작은 것 먼저), fromDate·keepId, text 먼저', () => {
    const r = plan({
      tasks: {
        m1: { text: '나중', content: '무시', order: -100, createdAt: 100, labels: ['긴급'], fromDate: '2026-10-01', keepId: 'k1' },
        m2: { content: '먼저', order: -200, createdAt: 200 },
      },
    });
    const [first, second] = created(r.ops);
    expect(first).toMatchObject({ id: v4id('item.note', SID, 'tasks/m2', 'm2'), date: null, text: '먼저' });
    expect(second).toMatchObject({ text: '나중', labelIds: ['L_urg'], fromDate: '2026-10-01', keepId: 'k1' });
    expect(first.order < second.order).toBe(true);
  });

  it('링크: 결정적 id로 바로, 수업은 lesson:날짜:교시, 그룹 것·못 찾은 것은 뺀다', () => {
    const r = plan({
      events: {
        '2026-10-05': {
          eventList: [
            {
              id: 'e1',
              content: '상담',
              linkedItems: [
                { targetType: 'journal', targetId: 'j1', targetDate: '2026-10-05' },
                { targetType: 'memo', targetId: 'm1' },
                { targetType: 'schedule', targetId: 'x', targetDate: '2026-10-05', targetPeriod: 3 },
                { targetType: 'event', targetId: 'gone', targetDate: '2026-10-05' },
                { targetType: 'memo', targetId: 'm1', targetFId: 'grp' },
              ],
            },
          ],
        },
      },
      journals: { '2026-10-05': { entries: [{ id: 'j1', content: '기록', linkedItems: [{ targetType: 'event', targetId: 'e1', targetDate: '2026-10-05' }] }] } },
      tasks: { m1: { text: '메모' } },
    });
    const items = created(r.ops);
    const ev = items.find((i) => i.text === '상담')!;
    expect(ev.linkIds).toEqual([v4id('item.note', SID, 'journals/2026-10-05', 'j1'), v4id('item.note', SID, 'tasks/m1', 'm1'), 'lesson:2026-10-05:3']);
    expect(items.find((i) => i.text === '기록')!.linkIds).toEqual([ev.id]);
    expect(r.notes.linksDropped).toBe(2);
  });

  it('다시 가져오기: 그대로면 쓰지 않는다', () => {
    const docs = { tasks: { m1: { text: '메모', labels: ['긴급'] } } };
    const first = plan(docs);
    const [c] = first.ops as Create[];
    const existing = { items: { [c.at.id]: { ...c.data, id: c.at.id, deletedAt: null } as unknown as Stored<'items'> }, series: {} };
    const again = plan(docs, existing);
    expect(again.ops).toEqual([]);
    expect(again.counts['items.note']).toMatchObject({ same: 1, added: 0 });
  });
});
