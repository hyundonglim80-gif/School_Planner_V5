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
    expect(v.cells.slice(0, 3).map((c) => [c.subject, c.base, c.changed, c.note])).toEqual([
      ['국어', '영어', true, ''],
      ['', '수학', true, ''],
      ['', '', false, '실험'],
    ]);
  });

  it('적힌 과목이 그날 시간표와 같으면 바꾼 것이 아니다 (시간표를 나중에 고쳤다 - P11-1)', () => {
    const v = lessonsOn('2026-10-12', source({ days: { '2026-10-12': { periods: { '1': { subject: '영어' }, '3': { subject: '' } } } } }));
    expect(v.cells.slice(0, 3).map((c) => [c.subject, c.base, c.changed])).toEqual([
      ['영어', '영어', false],
      ['수학', '수학', false],
      ['', '', false],
    ]);
  });

  it('방학·공휴일·수업X 날은 시간표가 비고, 그날 적은 과목·메모는 남는다', () => {
    const v = lessonsOn('2026-10-09', source({ days: { '2026-10-09': { periods: { '2': { subject: '보강 수학', supplies: '자' } } } } })); // 금, 한글날
    expect(v.off).toBe('holiday');
    expect(v.cells[0]).toMatchObject({ subject: '', base: '' });
    expect(v.cells[1]).toMatchObject({ subject: '보강 수학', note: '자', changed: true });
    expect(lessonsOn('2026-07-27', source()).off).toBe('vacation');
    expect(lessonsOn('2026-07-27', source()).cells[0].subject).toBe('');
  });

  it('수업 없는 날의 V4 옛 과목(날마다 적힌 옛 시간표)은 보이지 않는다 - 비고는 남고, V5에서 적은 과목은 보인다 (P38)', () => {
    const old = { src: { from: 'v4' }, periods: { '1': { subject: '401' }, '2': { subject: '402', supplies: '교과서' }, '7': { subject: '407' } } };
    // 방학 (월요일 - 2학기 시간표가 있는 날)
    const v = lessonsOn('2027-01-11', source({ days: { '2027-01-11': old } }));
    expect(v.off).toBe('vacation');
    expect(v.cells.map((c) => c.subject)).toEqual(['', '', '', '', '', '']); // 7교시 옛 과목으로 늘리지도 않는다
    expect(v.cells[1]).toMatchObject({ subject: '', base: '', changed: false, note: '교과서' });
    expect(v.hiddenOld).toEqual(['1', '2', '7']);
    // 공휴일·수업X 날도 같다
    expect(lessonsOn('2026-10-09', source({ days: { '2026-10-09': old } })).cells[0].subject).toBe('');
    // 수업하는 날의 V4 문서는 그대로 (그날 바꾼 과목)
    const school = lessonsOn('2026-10-12', source({ days: { '2026-10-12': old } }));
    expect(school.cells[0]).toMatchObject({ subject: '401', changed: true });
    expect(school.cells).toHaveLength(7);
    expect(school.hiddenOld).toEqual([]);
    // 주말은 수업 없는 날이 아니다 - V4 토요 보강도 보인다
    expect(lessonsOn('2026-10-10', source({ days: { '2026-10-10': old } })).cells[0].subject).toBe('401');
    // V5에서 적은 과목(src 없음)은 방학에도 보인다
    const mine = lessonsOn('2027-01-11', source({ days: { '2027-01-11': { periods: { '1': { subject: '방학 보충' } } } } }));
    expect(mine.cells[0]).toMatchObject({ subject: '방학 보충', changed: true });
    expect(mine.hiddenOld).toEqual([]);
  });

  it('방학 날 V4 옛 과목은 진도·지난 시간 세기에도 없다 (subjectsBetween)', () => {
    const out = subjectsBetween('2027-01-11', '2027-01-11', source({ days: { '2027-01-11': { src: { from: 'v4' }, periods: { '1': { subject: '401' } } } } }));
    expect(out).toEqual({});
  });

  it('설정보다 뒤 교시에 적어 둔 것이 있으면 그만큼 늘린다', () => {
    const v = lessonsOn('2026-10-12', source({ days: { '2026-10-12': { periods: { '8': { memo: '보충' }, '9': {} } } } }));
    expect(v.cells).toHaveLength(8);
    expect(v.cells[7].note).toBe('보충');
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
