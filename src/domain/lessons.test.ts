import { describe, expect, it } from 'vitest';
import { classOffReason, eventSkipsClass, gridSubject, lessonsOn, subjectsBetween, timetableOn, type LessonSource, type TimetableLike } from './lessons';
import { readTerms } from './semester';

// 수업 칸 계산 (DESIGN 5-2) - V4 classDays.test의 수업 없는 날 + 기간별 시간표 + 그날 바꾼 칸

const terms = readTerms({
  '2026': { summer: { from: '2026-07-21', to: '2026-08-16' }, winter: { from: '2027-01-05', to: '2027-02-28' } },
})!;
const labels = new Map([
  ['ev_1', false],
  ['lbl_skip', true],
]);
const holidays = new Set(['2026-10-09']);

const sem1: TimetableLike = { id: 'a', name: '1학기', from: '2026-03-01', to: '2027-02-28', grid: { '1': { '1': '국어', '2': '수학' }, '3': { '1': '과학' } }, createdAt: 1 };
const sem2: TimetableLike = { id: 'b', name: '2학기', from: '2026-08-17', to: '2027-02-28', grid: { '1': { '1': '영어', '2': '수학' }, '5': { '1': '체육' } }, createdAt: 2 };
const oct: TimetableLike = { id: 'c', name: '10/14부터', from: '2026-10-14', to: '2026-10-31', grid: { '3': { '1': '음악' } }, createdAt: 3 };

function source(over: Partial<LessonSource> = {}): LessonSource {
  return {
    timetables: [sem1, sem2, oct],
    days: {},
    count: 6,
    terms,
    isHoliday: (d) => holidays.has(d),
    eventsOn: () => [],
    labels,
    ...over,
  };
}

describe('수업이 없는 날 (V4 classDays)', () => {
  it('방학·공휴일', () => {
    expect(classOffReason('2026-07-21', source())).toBe('vacation');
    expect(classOffReason('2027-01-20', source())).toBe('vacation');
    expect(classOffReason('2026-10-09', source())).toBe('holiday');
    expect(classOffReason('2026-10-08', source())).toBeNull();
  });

  it("수업X 일정 - 일정에 정한 값, 라벨, 글의 '휴업'", () => {
    const on = (items: Parameters<typeof eventSkipsClass>[0][]) => source({ eventsOn: () => items });
    expect(classOffReason('2026-10-08', on([{ kind: 'event', text: '운동회', props: { skip: true } }]))).toBe('skip');
    expect(classOffReason('2026-10-08', on([{ kind: 'event', text: '운동회', labelIds: ['lbl_skip'] }]))).toBe('skip');
    expect(classOffReason('2026-10-08', on([{ kind: 'event', text: '재량휴업일' }]))).toBe('skip');
    expect(classOffReason('2026-10-08', on([{ kind: 'event', text: '학년 회의', labelIds: ['ev_1'] }]))).toBeNull();
    // 기록·메모의 '휴업'은 보지 않는다
    expect(classOffReason('2026-10-08', on([{ kind: 'note', text: '휴업 안내' }]))).toBeNull();
  });

  it('일정마다 끈 수업X는 라벨보다 앞선다, 모르는 라벨은 없는 셈', () => {
    expect(eventSkipsClass({ kind: 'event', text: '운동회', labelIds: ['lbl_skip'], props: { skip: false } }, labels)).toBe(false);
    expect(eventSkipsClass({ kind: 'event', text: '운동회', labelIds: ['지운 라벨'] }, labels)).toBe(false);
    expect(eventSkipsClass({ kind: 'event', text: '휴업', props: { skip: false } }, labels)).toBe(true);
  });

  it('주말은 여기서 보지 않는다 (시간표에 칸이 없다)', () => {
    expect(classOffReason('2026-10-10', source())).toBeNull();
  });
});

describe('기간별 시간표', () => {
  it('기간이 겹치면 늦게 시작한 것', () => {
    expect(timetableOn('2026-03-02', [sem1, sem2, oct])?.id).toBe('a');
    expect(timetableOn('2026-08-17', [sem1, sem2, oct])?.id).toBe('b'); // 경계 첫날
    expect(timetableOn('2026-08-16', [sem1, sem2, oct])?.id).toBe('a'); // 경계 전날
    expect(timetableOn('2026-10-14', [sem1, sem2, oct])?.id).toBe('c');
    expect(timetableOn('2026-11-02', [sem1, sem2, oct])?.id).toBe('b'); // 10/31로 끝난 뒤
    expect(timetableOn('2027-03-02', [sem1, sem2, oct])).toBeNull();
    expect(timetableOn('2026-02-27', [sem1])).toBeNull();
  });

  it('같은 날 시작하면 나중에 만든 것', () => {
    const again = { ...sem1, id: 'z', createdAt: 9, grid: { '1': { '1': '도덕' } } };
    expect(timetableOn('2026-03-02', [sem1, again])?.id).toBe('z');
  });

  it('요일 칸 (월~금만)', () => {
    expect(gridSubject(sem1, '2026-03-02', 1)).toBe('국어'); // 월
    expect(gridSubject(sem1, '2026-03-04', 1)).toBe('과학'); // 수
    expect(gridSubject(sem1, '2026-03-07', 1)).toBe(''); // 토
    expect(gridSubject(null, '2026-03-02', 1)).toBe('');
  });
});

describe('그날 수업 칸 (lessonsOn)', () => {
  it('시간표를 따른다 - 고치지 않은 칸', () => {
    const v = lessonsOn('2026-10-12', source()); // 월, 2학기
    expect(v.off).toBeNull();
    expect(v.timetable?.id).toBe('b');
    expect(v.cells).toHaveLength(6);
    expect(v.cells.slice(0, 3).map((c) => [c.subject, c.changed])).toEqual([
      ['영어', false],
      ['수학', false],
      ['', false],
    ]);
  });

  it('그날 바꾼 과목이 이긴다 - 빈 글자면 그 교시 수업 없음', () => {
    const v = lessonsOn('2026-10-12', source({ days: { '2026-10-12': { periods: { '1': { subject: '국어' }, '2': { subject: '' }, '3': { memo: '실험' } } } } }));
    expect(v.cells.slice(0, 3).map((c) => [c.subject, c.base, c.changed, c.memo])).toEqual([
      ['국어', '영어', true, ''],
      ['', '수학', true, ''],
      ['', '', false, '실험'],
    ]);
  });

  it('방학·공휴일·수업X 날은 시간표가 비고, 그날 적은 과목·메모는 남는다', () => {
    const v = lessonsOn('2026-10-09', source({ days: { '2026-10-09': { periods: { '2': { subject: '보강 수학', supplies: '자' } } } } })); // 금, 한글날
    expect(v.off).toBe('holiday');
    expect(v.cells[0]).toMatchObject({ subject: '', base: '' });
    expect(v.cells[1]).toMatchObject({ subject: '보강 수학', supplies: '자', changed: true });
    expect(lessonsOn('2026-07-27', source()).off).toBe('vacation');
    expect(lessonsOn('2026-07-27', source()).cells[0].subject).toBe('');
  });

  it('설정보다 뒤 교시에 적어 둔 것이 있으면 그만큼 늘린다', () => {
    const v = lessonsOn('2026-10-12', source({ days: { '2026-10-12': { periods: { '8': { memo: '보충' }, '9': {} } } } }));
    expect(v.cells).toHaveLength(8);
    expect(v.cells[7].memo).toBe('보충');
  });

  it('주말은 시간표가 없고 그날 적은 것만', () => {
    const v = lessonsOn('2026-10-10', source({ days: { '2026-10-10': { periods: { '1': { subject: '토요 보강' } } } } }));
    expect(v.cells[0].subject).toBe('토요 보강');
    expect(v.cells[1].subject).toBe('');
  });
});

describe('subjectsBetween', () => {
  it('과목이 있는 칸만, 날짜 차례로', () => {
    const out = subjectsBetween('2026-10-09', '2026-10-14', source({ count: 2 }));
    expect(out).toEqual({
      '2026-10-12': { '1': '영어', '2': '수학' },
      '2026-10-14': { '1': '음악' },
    });
  });
});
