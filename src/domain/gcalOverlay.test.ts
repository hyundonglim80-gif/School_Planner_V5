// 구글 캘린더 겹쳐 보기 셈 (P36-3) - 고른 캘린더 읽기·고르기 줄·일정 읽기·날 수·달 묶기·다시 받을 달·달마다 나누기·기간 읽기
import { describe, expect, it } from 'vitest';
import {
  addMonthKey,
  eventSpan,
  MAX_OVERLAY_CALENDARS,
  monthRowKey,
  monthsBetween,
  neededMonths,
  OVERLAY_DEFAULT_COLOR,
  OVERLAY_DESC_MAX,
  OVERLAY_STALE_MS,
  overlayBetween,
  pickableCalendars,
  readGoogleEvent,
  runRange,
  runsOf,
  sanitizeOverlayCalendars,
  splitByMonth,
  staleMonths,
  type OverlayEvent,
} from './gcalOverlay';

const ev = (id: string, start: string, end: string, allDay = start.length === 10, cal = 'c1'): OverlayEvent => ({ id, cal, title: id, allDay, start, end });

describe('고른 캘린더 (계정 칸)', () => {
  it('배열이 아니면 기본(빈 목록)으로, 모르는 칸·빈 id·같은 id는 버리고 색은 #rrggbb만', () => {
    expect(sanitizeOverlayCalendars('x')).toBeUndefined();
    expect(sanitizeOverlayCalendars({})).toBeUndefined();
    expect(
      sanitizeOverlayCalendars([
        { id: 'a', name: ' 학교 ', color: '#AABBCC' },
        { id: 'a', name: '같은 것' },
        { id: '', name: '빈 것' },
        null,
        { id: 'b', color: 'red' },
      ]),
    ).toEqual([
      { id: 'a', name: '학교', color: '#aabbcc' },
      { id: 'b', name: 'b', color: OVERLAY_DEFAULT_COLOR },
    ]);
  });

  it(`${MAX_OVERLAY_CALENDARS}개까지`, () => {
    const many = Array.from({ length: 15 }, (_, i) => ({ id: `c${i}`, name: `캘린더 ${i}`, color: '#000000' }));
    expect(sanitizeOverlayCalendars(many)).toHaveLength(MAX_OVERLAY_CALENDARS);
  });
});

describe('고르기 줄', () => {
  it('앱이 보내는 캘린더(SP(work)·SP(class)·SP(commentary))와 지운 캘린더는 빼고, 기본 캘린더 먼저 그다음 이름 차례', () => {
    const list = pickableCalendars([
      { id: 'w', summary: 'SP(work)' },
      { id: 'k', summary: 'SP(class)' },
      { id: 'j', summary: 'SP(commentary)' },
      { id: 'o', summary: '남이 준 이름', summaryOverride: 'SP(work)' },
      { id: 'gone', summary: '지운 것', deleted: true },
      { id: 'h', summary: '학년 협의', backgroundColor: '#16A765' },
      { id: 'me@x', summary: 'me@x', summaryOverride: '내 캘린더', primary: true, backgroundColor: '#9fe1e7' },
      { id: 'g', summary: '가족' },
    ]);
    expect(list.map((c) => c.id)).toEqual(['me@x', 'g', 'h']);
    expect(list[0]).toEqual({ id: 'me@x', name: '내 캘린더', color: '#9fe1e7', primary: true });
    expect(list[1].color).toBe(OVERLAY_DEFAULT_COLOR);
  });

  it('기본 캘린더 이름이 메일 주소(구글이 주는 그대로)면 내 캘린더 - 다른 캘린더·바꾼 이름은 그대로 (P36-4 PC 확인)', () => {
    const list = pickableCalendars([
      { id: 't@school.kr', summary: 't@school.kr', primary: true },
      { id: 'a@group.calendar.google.com', summary: 'a@group.calendar.google.com' },
      { id: 'p@x', summary: 'p@x', summaryOverride: '학교 일정', primary: true },
    ]);
    expect(list.find((c) => c.id === 't@school.kr')?.name).toBe('내 캘린더');
    expect(list.find((c) => c.id === 'p@x')?.name).toBe('학교 일정');
    expect(list.find((c) => c.id === 'a@group.calendar.google.com')?.name).toBe('a@group.calendar.google.com');
  });
});

describe('일정 읽기', () => {
  it('종일 - 끝은 구글 그대로(다음 날), 장소·설명·주소', () => {
    expect(
      readGoogleEvent(
        { id: 'e1', summary: ' 체육대회 ', start: { date: '2026-11-20' }, end: { date: '2026-11-21' }, location: ' 운동장 ', description: '준비물', htmlLink: 'https://www.google.com/calendar/event?eid=1' },
        'c1',
      ),
    ).toEqual({ id: 'e1', cal: 'c1', title: '체육대회', allDay: true, start: '2026-11-20', end: '2026-11-21', location: '운동장', description: '준비물', link: 'https://www.google.com/calendar/event?eid=1' });
  });

  it('시각 - 이 기기 시각 YYYY-MM-DDTHH:mm', () => {
    const start = new Date(2026, 10, 16, 9, 30).toISOString();
    const end = new Date(2026, 10, 16, 10, 0).toISOString();
    const out = readGoogleEvent({ id: 'e2', start: { dateTime: start }, end: { dateTime: end } }, 'c1');
    expect(out).toMatchObject({ allDay: false, start: '2026-11-16T09:30', end: '2026-11-16T10:00', title: '(제목 없음)' });
  });

  it('취소된 것·id나 날이 없는 것은 버리고, 끝이 이상하면 하루짜리로, 설명은 줄이고, https가 아닌 주소는 버린다', () => {
    expect(readGoogleEvent({ id: 'x', status: 'cancelled', start: { date: '2026-11-20' } }, 'c1')).toBeNull();
    expect(readGoogleEvent({ start: { date: '2026-11-20' } }, 'c1')).toBeNull();
    expect(readGoogleEvent({ id: 'x' }, 'c1')).toBeNull();
    expect(readGoogleEvent({ id: 'x', start: { date: '2026-11-20' }, end: { date: '2026-11-20' } }, 'c1')?.end).toBe('2026-11-21');
    const long = readGoogleEvent({ id: 'x', start: { date: '2026-11-20' }, description: 'ㄱ'.repeat(5000), htmlLink: 'javascript:alert(1)' }, 'c1');
    expect(long?.description).toHaveLength(OVERLAY_DESC_MAX);
    expect(long?.link).toBeUndefined();
  });
});

describe('보이는 날', () => {
  it('종일은 끝 하루 앞까지 (구글 end.date = 다음 날)', () => {
    expect(eventSpan(ev('a', '2026-11-20', '2026-11-21'))).toEqual({ first: '2026-11-20', last: '2026-11-20' });
    expect(eventSpan(ev('a', '2026-11-30', '2026-12-03'))).toEqual({ first: '2026-11-30', last: '2026-12-02' });
  });

  it('시각은 자정에 끝나면 그 앞날까지, 넘어가면 다음 날까지', () => {
    expect(eventSpan(ev('a', '2026-11-20T23:00', '2026-11-21T00:00'))).toEqual({ first: '2026-11-20', last: '2026-11-20' });
    expect(eventSpan(ev('a', '2026-11-20T23:00', '2026-11-21T01:00'))).toEqual({ first: '2026-11-20', last: '2026-11-21' });
    expect(eventSpan(ev('a', '2026-11-20T00:00', '2026-11-20T00:00'))).toEqual({ first: '2026-11-20', last: '2026-11-20' });
  });
});

describe('달', () => {
  it('달 더하기·사이 (해를 넘는다)', () => {
    expect(addMonthKey('2026-12', 1)).toBe('2027-01');
    expect(addMonthKey('2027-01', -1)).toBe('2026-12');
    expect(monthsBetween('2026-11', '2027-02')).toEqual(['2026-11', '2026-12', '2027-01', '2027-02']);
    expect(monthsBetween('2027-02', '2026-11')).toEqual([]);
  });

  it('화면이 쓰는 달 - 하루·주간·월간·한눈에 = ±1달, 년간 = 학년도 + 앞뒤 한 달, 메모·학급 = 없음', () => {
    for (const scope of ['day', 'week', 'month', 'board']) expect(neededMonths(scope, '2027-01-15')).toEqual(['2026-12', '2027-01', '2027-02']);
    const year = neededMonths('year', '2027-01-15');
    expect(year[0]).toBe('2026-02');
    expect(year[year.length - 1]).toBe('2027-03');
    expect(year).toHaveLength(14);
    // 3월은 새 학년도
    expect(neededMonths('year', '2027-03-02')[0]).toBe('2027-02');
    expect(neededMonths('memo', '2027-01-15')).toEqual([]);
    expect(neededMonths('class', '2027-01-15')).toEqual([]);
    expect(neededMonths('day', '')).toEqual([]);
  });

  it('다시 받을 달 - 없거나 15분이 지난 달만, maxAge 0 = 모두', () => {
    const now = 10_000_000;
    const rows = { [monthRowKey('c1', '2026-11')]: { at: now - 60_000 }, [monthRowKey('c1', '2026-12')]: { at: now - OVERLAY_STALE_MS } };
    expect(staleMonths(rows, ['c1', 'c2'], ['2026-11', '2026-12', '2027-01'], now)).toEqual([
      { cal: 'c1', months: ['2026-12', '2027-01'] },
      { cal: 'c2', months: ['2026-11', '2026-12', '2027-01'] },
    ]);
    expect(staleMonths(rows, ['c1'], ['2026-11'], now)).toEqual([]);
    expect(staleMonths(rows, ['c1'], ['2026-11'], now, 0)).toEqual([{ cal: 'c1', months: ['2026-11'] }]);
  });

  it('이어진 달끼리 묶기 (차례가 뒤섞여도, 같은 달은 하나)', () => {
    expect(runsOf(['2027-01', '2026-11', '2026-12', '2027-03', '2027-03', 'x'])).toEqual([
      { from: '2026-11', to: '2027-01' },
      { from: '2027-03', to: '2027-03' },
    ]);
    expect(runsOf([])).toEqual([]);
  });

  it('묶음의 기간 = 첫 달 1일 0시 ~ 끝 달 다음 달 1일 0시 (이 기기 시각)', () => {
    const r = runRange({ from: '2026-12', to: '2027-01' });
    expect(new Date(r.timeMin).getTime()).toBe(new Date(2026, 11, 1).getTime());
    expect(new Date(r.timeMax).getTime()).toBe(new Date(2027, 1, 1).getTime());
  });
});

describe('달마다 나누기·기간 읽기', () => {
  const events = [
    ev('long', '2026-11-28', '2026-12-03'), // 11/28 ~ 12/2 - 두 달
    ev('nov', '2026-11-10T09:00', '2026-11-10T10:00', false),
    ev('endExclusive', '2026-12-31', '2027-01-01'), // 12/31 하루 - 1월에는 없다
  ];

  it('걸친 달마다 담고, 물은 달은 일정이 없어도 빈 칸', () => {
    const out = splitByMonth(events, ['2026-11', '2026-12', '2027-01', '2027-02']);
    expect(out['2026-11'].map((e) => e.id)).toEqual(['long', 'nov']);
    expect(out['2026-12'].map((e) => e.id)).toEqual(['long', 'endExclusive']);
    expect(out['2027-01']).toEqual([]);
    expect(out['2027-02']).toEqual([]);
  });

  it('기간 읽기 - 고른 캘린더만, 두 달에 담긴 것은 하나, 종일 먼저 그다음 시각 차례', () => {
    const split = splitByMonth(events, ['2026-11', '2026-12']);
    const rows: Record<string, { events: OverlayEvent[] }> = {};
    for (const [m, list] of Object.entries(split)) rows[monthRowKey('c1', m)] = { events: list };
    rows[monthRowKey('c2', '2026-11')] = { events: [ev('other', '2026-11-30', '2026-12-01', true, 'c2'), ev('am', '2026-11-30T08:00', '2026-11-30T09:00', false, 'c2')] };

    expect(overlayBetween(rows, ['c1'], '2026-11-01', '2026-12-31').map((e) => e.id)).toEqual(['nov', 'long', 'endExclusive']);
    expect(overlayBetween(rows, ['c1', 'c2'], '2026-11-30', '2026-11-30').map((e) => e.id)).toEqual(['long', 'other', 'am']);
    expect(overlayBetween(rows, ['c2'], '2026-12-01', '2026-12-31')).toEqual([]);
    expect(overlayBetween(rows, [], '2026-11-01', '2026-12-31')).toEqual([]);
    expect(overlayBetween(rows, ['c1'], '2026-12-31', '2026-11-01')).toEqual([]);
  });
});
