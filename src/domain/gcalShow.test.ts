// 구글 캘린더 겹쳐 그리기 셈 (P36-4) - 캘린더 붙이기·그날 시각 글·그날 차례·달력 칸(하루짜리/막대)·창의 때 글
import { describe, expect, it } from 'vitest';
import type { OverlayCalendar, OverlayEvent } from './gcalOverlay';
import { gcalCalendar, gcalKey, gcalListOn, gcalOnDay, gcalPlainText, gcalPosition, gcalShownList, gcalTimeOn, gcalWhenLabel, isGcalMulti } from './gcalShow';

const CALS: OverlayCalendar[] = [
  { id: 'c1', name: '학교', color: '#0b8043' },
  { id: 'c2', name: '집', color: '#d50000' },
];
const ev = (id: string, start: string, end: string, cal = 'c1', title = id): OverlayEvent => ({ id, cal, title, allDay: start.length === 10, start, end });
const shown = (...events: OverlayEvent[]) => gcalShownList(events, CALS);

describe('캘린더 붙이기', () => {
  it('고른 캘린더 이름·색과 보이는 날을 붙이고, 고르기에서 빠진 캘린더 것은 버린다', () => {
    const list = shown(ev('a', '2026-11-16', '2026-11-17'), ev('b', '2026-11-16T09:00', '2026-11-16T10:00', 'c2'), ev('x', '2026-11-16', '2026-11-17', 'gone'));
    expect(list.map((s) => [s.ev.id, s.cal.name, s.first, s.last])).toEqual([
      ['a', '학교', '2026-11-16', '2026-11-16'],
      ['b', '집', '2026-11-16', '2026-11-16'],
    ]);
    expect(gcalKey(list[0])).toBe('c1\na');
  });

  it('종일 끝 날은 구글 그대로 다음 날이라 하루 뺀다 · 자정에 끝나는 시각 일정은 그 앞날까지', () => {
    const [allDay3, tillMidnight, overnight] = shown(
      ev('a', '2026-11-16', '2026-11-19'),
      ev('b', '2026-11-16T22:00', '2026-11-17T00:00'),
      ev('c', '2026-11-16T22:00', '2026-11-17T02:00'),
    );
    expect([allDay3.first, allDay3.last, isGcalMulti(allDay3)]).toEqual(['2026-11-16', '2026-11-18', true]);
    expect([tillMidnight.last, isGcalMulti(tillMidnight)]).toEqual(['2026-11-16', false]);
    expect([overnight.last, isGcalMulti(overnight)]).toEqual(['2026-11-17', true]);
    expect(gcalOnDay(allDay3, '2026-11-18')).toBe(true);
    expect(gcalOnDay(allDay3, '2026-11-19')).toBe(false);
    // 그날 차례 '(2/3)' - 하루짜리·범위 밖은 없다
    expect(gcalPosition(allDay3, '2026-11-17')).toEqual({ k: 2, n: 3 });
    expect(gcalPosition(allDay3, '2026-11-19')).toBeNull();
    expect(gcalPosition(tillMidnight, '2026-11-16')).toBeNull();
  });
});

describe('그날 시각 글', () => {
  it('종일은 없다 · 하루짜리는 시작~끝(같으면 시작만) · short는 시작만', () => {
    const [allDay, meeting, point] = shown(ev('a', '2026-11-16', '2026-11-17'), ev('b', '2026-11-16T09:00', '2026-11-16T10:30'), ev('c', '2026-11-16T15:00', '2026-11-16T15:00'));
    expect(gcalTimeOn(allDay, '2026-11-16')).toBe('');
    expect(gcalTimeOn(meeting, '2026-11-16')).toBe('09:00~10:30');
    expect(gcalTimeOn(meeting, '2026-11-16', true)).toBe('09:00');
    expect(gcalTimeOn(point, '2026-11-16')).toBe('15:00');
  });

  it('여러 날 시각 일정 = 첫날 22:00~ · 가운데 날 없음 · 끝날 ~02:00 (자정에 끝나면 끝날 없음)', () => {
    const [trip, tillMidnight] = shown(ev('a', '2026-11-16T22:00', '2026-11-18T02:00'), ev('b', '2026-11-16T20:00', '2026-11-18T00:00'));
    expect(['2026-11-16', '2026-11-17', '2026-11-18'].map((d) => gcalTimeOn(trip, d))).toEqual(['22:00~', '', '~02:00']);
    expect(gcalTimeOn(trip, '2026-11-18', true)).toBe('');
    expect(tillMidnight.last).toBe('2026-11-17');
    expect(['2026-11-16', '2026-11-17'].map((d) => gcalTimeOn(tillMidnight, d))).toEqual(['20:00~', '']);
  });
});

describe('그날 차례', () => {
  it('그날 시각이 없는 것(종일·가운데 날) 먼저, 그다음 시각 차례(이어 온 끝날은 0시), 같으면 제목', () => {
    const list = shown(
      ev('late', '2026-11-17T15:00', '2026-11-17T16:00'),
      ev('trip', '2026-11-16T22:00', '2026-11-17T02:00'),
      ev('nb', '2026-11-17', '2026-11-18', 'c1', '나'),
      ev('na', '2026-11-17', '2026-11-18', 'c2', '가'),
      ev('early', '2026-11-17T08:00', '2026-11-17T09:00'),
      ev('long', '2026-11-15', '2026-11-20'),
      ev('other', '2026-11-18', '2026-11-19'),
    );
    expect(gcalListOn(list, '2026-11-17').map((s) => s.ev.id)).toEqual(['na', 'nb', 'long', 'trip', 'early', 'late']);
    expect(gcalListOn(list, '2026-11-16').map((s) => s.ev.id)).toEqual(['long', 'trip']);
  });
});

describe('달력 칸 (월간·년간·한눈에 달 목록)', () => {
  it('하루짜리는 그날 칸에(그날 차례), 여러 날은 막대 자리로 - id는 앱 일정과 겹치지 않게', () => {
    const list = shown(
      ev('b', '2026-11-16T09:00', '2026-11-16T10:00'),
      ev('a', '2026-11-16', '2026-11-17'),
      ev('p', '2026-11-16', '2026-11-19'),
      ev('night', '2026-11-20T23:00', '2026-11-21T01:00'),
    );
    const cal = gcalCalendar(list, '2026-11-01', '2026-11-30');
    expect(cal.byDate.get('2026-11-16')?.map((s) => s.ev.id)).toEqual(['a', 'b']);
    expect(cal.periods.map((p) => [p.id, p.date, p.endDate])).toEqual([
      ['gcal:c1\np', '2026-11-16', '2026-11-18'],
      ['gcal:c1\nnight', '2026-11-20', '2026-11-21'],
    ]);
  });

  it('범위 밖은 버리고, 범위에 걸친 여러 날은 막대에 든다 (달 경계)', () => {
    const list = shown(ev('before', '2026-10-20', '2026-10-21'), ev('cross', '2026-10-30', '2026-11-03'), ev('after', '2026-12-01', '2026-12-02'));
    const cal = gcalCalendar(list, '2026-11-01', '2026-11-30');
    expect([...cal.byDate.keys()]).toEqual([]);
    expect(cal.periods.map((p) => p.gcal.ev.id)).toEqual(['cross']);
  });

  it('학년도 끝(2월 말 ~ 3월 초)에 걸친 종일 일정도 끝 날을 하루 빼 막대로', () => {
    const [s] = shown(ev('break', '2027-02-26', '2027-03-03'));
    expect([s.first, s.last]).toEqual(['2027-02-26', '2027-03-02']);
    expect(gcalCalendar([s], '2027-02-01', '2027-02-28').periods.map((p) => p.endDate)).toEqual(['2027-03-02']);
  });
});

describe('설명 글', () => {
  it('구글이 섞어 준 HTML은 글로 - 줄바꿈 꼴은 줄, 꼬리표는 걷고, 글자 표는 풀고, 빈 줄은 둘까지', () => {
    expect(gcalPlainText('준비물<br>- 실내화<br/><b>꼭</b> &amp; 물병')).toBe('준비물\n- 실내화\n꼭 & 물병');
    expect(gcalPlainText('<p>첫 줄</p><p>둘째</p>\n\n\n\n끝')).toBe('첫 줄\n둘째\n\n끝');
    expect(gcalPlainText('<ul><li>하나</li><li>둘</li></ul>')).toBe('• 하나\n• 둘');
    expect(gcalPlainText('<a href="https://x.test">회의 자료</a> &lt;3층&gt;')).toBe('회의 자료 <3층>');
    expect(gcalPlainText('<img src=x onerror=alert(1)>글')).toBe('글');
  });
});

describe('창의 때 글', () => {
  it('종일 하루 · 종일 여러 날(날 수) · 시각 하루 · 밤을 넘는 시각 · 이튿날 자정에 끝나면 24:00', () => {
    const [a, b, c, d, e] = shown(
      ev('a', '2026-11-16', '2026-11-17'),
      ev('b', '2026-11-16', '2026-11-19'),
      ev('c', '2026-11-16T09:00', '2026-11-16T10:30'),
      ev('d', '2026-11-16T22:00', '2026-11-17T02:00'),
      ev('e', '2026-11-16T20:00', '2026-11-17T00:00'),
    );
    expect(gcalWhenLabel(a)).toBe('11월 16일 (월) · 종일');
    expect(gcalWhenLabel(b)).toBe('11월 16일 (월) ~ 11월 18일 (수) · 3일');
    expect(gcalWhenLabel(c)).toBe('11월 16일 (월) 09:00 ~ 10:30');
    expect(gcalWhenLabel(d)).toBe('11월 16일 (월) 22:00 ~ 11월 17일 (화) 02:00');
    expect(gcalWhenLabel(e)).toBe('11월 16일 (월) 20:00 ~ 24:00');
  });
});
