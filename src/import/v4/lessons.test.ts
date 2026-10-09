import { describe, expect, it } from 'vitest';
import type { WriteOp } from '../../data/repo/ops';
import type { Stored } from '../../data/types';
import { planLessons, timetableRanges, v4Cells, v4Templates, type V4LessonDocs } from './lessons';
import { changedTotal } from './plan';

// V4 수업 → V5 (P6-4). 2026-10-12 월 · 10-14 수 · 10-09 금(한글날)

const SID = 'u_me';
const SEM = { summerStart: '2026-07-25', summerEnd: '2026-08-16', winterStart: '2027-01-09', winterEnd: '2027-02-28' };
const T1 = { names: ['1교시', '2교시'], data: { mon: { 1: '국어', 2: '수학' }, tue: {}, wed: { 1: '과학' }, thu: {}, fri: {} } };
const T2 = { names: ['1교시', '2교시'], data: { mon: { 1: '영어', 2: '수학' }, tue: {}, wed: {}, thu: {}, fri: {} } };
const cell = (subject: string, extra: Record<string, unknown> = {}) => ({ subject, content: '', memo: '', supplies: '', linkedItems: [], attachments: [], ...extra });
const NONE = { timetables: {}, lessonDays: {}, progress: {} };
const opts = { offDay: (d: string) => d === '2026-10-09', linkOf: (l: unknown) => ((l as { targetId?: string }).targetId === 'ev1' ? 'V5EV1' : undefined), today: '2026-10-09' };

const dataOf = (ops: WriteOp[], coll: string, id: string) => {
  const op = ops.find((o) => o.at.coll === coll && o.at.id === id);
  return op && (op.type === 'create' || op.type === 'patch') ? (op.type === 'create' ? op.data : op.changes) : undefined;
};
const createdOf = (ops: WriteOp[], coll: string) => ops.filter((o) => o.at.coll === coll && o.type === 'create').map((o) => (o.type === 'create' ? o.data : null));

describe('V4 시간표·칸 읽기', () => {
  it('표: 요일 mon~fri → 1~5, 빈 칸은 뺀다', () => {
    expect(v4Templates({ templates: { '1학기 시간표': T1, ' ': { data: {} } } })).toEqual([
      { name: '1학기 시간표', grid: { '1': { '1': '국어', '2': '수학' }, '3': { '1': '과학' } }, names: ['1교시', '2교시'] },
      { name: '시간표', grid: {}, names: [] },
    ]);
    expect(v4Templates(undefined)).toEqual([]);
  });

  it('칸: 새 모양·옛 글자, 메모는 memo 먼저(없으면 옛 content)', () => {
    expect(v4Cells({ periods: { 1: cell('국어', { content: '옛 메모' }), 2: '수학', 3: cell('', { memo: '자습', supplies: '공책' }), x: '?' } })).toEqual({
      '1': { subject: '국어', memo: '옛 메모', supplies: '', attachments: [], links: [] },
      '2': { subject: '수학', memo: '', supplies: '', attachments: [], links: [] },
      '3': { subject: '', memo: '자습', supplies: '공책', attachments: [], links: [] },
    });
  });
});

describe('표마다 기간 (학기마다 가장 많이 맞는 표)', () => {
  const templates = v4Templates({ templates: { '1학기 시간표': T1, '2학기 시간표': T2, 쓰지않음: { data: { mon: { 1: '체육' } } } } });
  it('2학기 수업이 2학기 표와 맞으면 2학기부터, 1학기 표는 이름으로 올해 1학기', () => {
    const cells = { '2026-10-12': v4Cells({ periods: { 1: cell('영어'), 2: cell('수학') } }) };
    const r = timetableRanges(templates, cells, SEM, '2026-10-09');
    expect(r.map((x) => [x.template.name, x.from, x.to])).toEqual([
      ['1학기 시간표', '2026-03-01', '2027-02-28'],
      ['2학기 시간표', '2026-08-17', '2027-02-28'],
      ['쓰지않음', '', ''],
    ]);
  });
  it('1학기 수업도 1학기 표가 맞으면 그것으로 - 같은 학년도에 같은 표는 한 장', () => {
    const cells = { '2026-04-06': v4Cells({ periods: { 1: cell('국어') } }), '2026-09-07': v4Cells({ periods: { 1: cell('국어'), 2: cell('수학') } }) };
    const r = timetableRanges(templates, cells, SEM, '2026-10-09');
    expect(r.filter((x) => x.from).map((x) => [x.template.name, x.from])).toEqual([['1학기 시간표', '2026-03-01']]);
  });
});

describe('planLessons', () => {
  const docs: V4LessonDocs = {
    timetable: { templates: { '1학기 시간표': T1 }, semesterConfig: SEM },
    schedules: {
      // 시간표와 같다 → 수업 칸 없음
      '2026-10-12': { periods: { 1: cell('국어'), 2: cell('수학') } },
      // 1교시만 바꿈 + 2교시 칸이 없다(시간표에는 없음) + 메모·링크
      '2026-10-14': { periods: { 1: cell('과학', { memo: '실험', linkedItems: [{ targetType: 'event', targetId: 'ev1', targetDate: '2026-10-14' }, { targetType: 'memo', targetId: 'gone' }] }), 3: cell('창체') } },
      // 2026-10-19 월: V4에 1교시가 없다 → 시간표 국어를 지운다
      '2026-10-19': { periods: { 2: cell('수학') } },
      // 공휴일에 적은 과목은 그대로
      '2026-10-09': { periods: { 1: cell('보충') } },
    },
    progress: { p1: { key: '국어', startDate: '2026-10-12', lessons: [{ unit: '1', no: '1', content: '시', page: '', supplies: '' }], bumps: ['2026-10-14#1'], updatedAt: 1 } },
  };

  it('그날 시간표와 같은 칸은 빼고 다른 것만', () => {
    const { ops, counts } = planLessons(SID, docs, NONE, opts);
    const days = Object.fromEntries(createdOf(ops, 'lessonDays').map((d) => [JSON.stringify(d!.periods), d]));
    expect(dataOf(ops, 'lessonDays', '2026-10-12')).toBeUndefined();
    expect(dataOf(ops, 'lessonDays', '2026-10-14')?.periods).toEqual({ '3': { subject: '창체' }, '1': { memo: '실험', linkIds: ['V5EV1'] } });
    expect(dataOf(ops, 'lessonDays', '2026-10-19')?.periods).toEqual({ '1': { subject: '' } });
    expect(dataOf(ops, 'lessonDays', '2026-10-09')?.periods).toEqual({ '1': { subject: '보충' } });
    expect(counts.lessonDays.added).toBe(3);
    expect(Object.keys(days)).toHaveLength(3);
  });

  it('시간표 한 장(쓴 학기부터 - 2학기에 쓴 표면 2학기부터) · 진도는 모양 그대로', () => {
    const { ops, counts } = planLessons(SID, docs, NONE, opts);
    expect(createdOf(ops, 'timetables')).toEqual([
      expect.objectContaining({ name: '1학기 시간표', from: '2026-08-17', to: '2027-02-28', grid: { '1': { '1': '국어', '2': '수학' }, '3': { '1': '과학' } } }),
    ]);
    expect(createdOf(ops, 'progress')).toEqual([
      expect.objectContaining({ key: '국어', startDate: '2026-10-12', bumps: ['2026-10-14#1'], lessons: [{ unit: '1', no: '1', content: '시', page: '', supplies: '' }] }),
    ]);
    expect(counts.timetables.added).toBe(1);
    expect(counts.progress.added).toBe(1);
  });

  it('두 번째는 바뀐 것 0, V4에서 없어진 날은 칸을 비운다(지우지 않는다)', () => {
    const first = planLessons(SID, docs, NONE, opts);
    const asStored = <C extends 'timetables' | 'lessonDays' | 'progress'>(coll: C) =>
      Object.fromEntries(
        first.ops
          .filter((o) => o.at.coll === coll && o.type === 'create')
          .map((o) => [o.at.id, { ...(o.type === 'create' ? o.data : {}), id: o.at.id, deletedAt: null } as unknown as Stored<C>]),
      );
    const existing = { timetables: asStored('timetables'), lessonDays: asStored('lessonDays'), progress: asStored('progress') };
    const again = planLessons(SID, docs, existing, opts);
    expect(again.ops).toEqual([]);
    expect(changedTotal(again.counts.lessonDays) + changedTotal(again.counts.timetables) + changedTotal(again.counts.progress)).toBe(0);

    const { '2026-10-09': _gone, ...rest } = docs.schedules;
    void _gone;
    const later = planLessons(SID, { ...docs, schedules: rest }, existing, opts);
    expect(later.ops).toHaveLength(1);
    expect(later.ops[0]).toMatchObject({ type: 'patch', at: { coll: 'lessonDays', id: '2026-10-09' }, changes: { periods: {} } });
    expect(later.counts.lessonDays.removed).toBe(1);
  });

  it('V5에서 고친 날 문서는 두고(지문이 다르다), 시간표가 없으면 과목을 그대로', () => {
    const first = planLessons(SID, { ...docs, timetable: undefined }, NONE, opts);
    expect(dataOf(first.ops, 'lessonDays', '2026-10-12')?.periods).toEqual({ '1': { subject: '국어' }, '2': { subject: '수학' } });
    const mine = { '2026-10-12': { id: '2026-10-12', periods: { '1': { subject: '도덕' } }, src: { from: 'v4', path: 'schedules/2026-10-12', id: '2026-10-12', h: 'x' } } as unknown as Stored<'lessonDays'> };
    const again = planLessons(SID, { ...docs, timetable: undefined }, { ...NONE, lessonDays: mine }, opts);
    expect(dataOf(again.ops, 'lessonDays', '2026-10-12')).toBeUndefined();
    expect(again.counts.lessonDays.kept).toBe(1);
  });
});

describe('우연히 몇 칸 맞는 표는 그 학기 시간표가 아니다', () => {
  it('과목 칸의 절반 넘게 맞아야', () => {
    const templates = v4Templates({ templates: { 점검: T1 } });
    const cells = {
      '2026-10-12': v4Cells({ periods: { 1: cell('국어'), 2: cell('영어'), 3: cell('체육') } }),
      '2026-10-19': v4Cells({ periods: { 1: cell('사회'), 2: cell('음악'), 3: cell('미술') } }),
    };
    expect(timetableRanges(templates, cells, SEM, '2025-10-01').map((x) => x.from)).toEqual(['']);
  });
});
