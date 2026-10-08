import { describe, it, expect, beforeEach } from 'vitest';
import { dateLabel, stepDate, stepScope, useNav } from './nav';
import type { Scope } from './route';

// ◀ ▶ 날짜 이동 (V4 store/dateNav.test). 월간에서 31일에 ▶를 누르면 2월을 건너뛰어 3월로 갔다(Date.setMonth: 1/31 + 1달 = 3/3).
const at = (scope: Scope, date: string) => useNav.setState({ scope, date, showWeekend: true });
const shown = () => useNav.getState().date;

beforeEach(() => at('day', '2026-10-02'));

describe('◀ ▶ 날짜 이동', () => {
  it('월간: 31일에 ▶ 를 눌러도 다음 달로 (달을 건너뛰지 않는다)', () => {
    at('month', '2027-01-31');
    stepDate(1);
    expect(shown()).toBe('2027-02-28');
    stepDate(1);
    expect(shown().slice(0, 7)).toBe('2027-03');

    at('month', '2026-10-31');
    stepDate(1);
    expect(shown().slice(0, 7)).toBe('2026-11');
    stepDate(-1);
    expect(shown().slice(0, 7)).toBe('2026-10');

    at('month', '2026-03-31');
    stepDate(-1);
    expect(shown().slice(0, 7)).toBe('2026-02');
  });

  it('년간: 2월 29일에서 한 해 옮겨도 한 학년도씩', () => {
    at('year', '2028-02-29'); // 2027학년도
    stepDate(1);
    expect(shown()).toBe('2029-02-28'); // 2028학년도
    stepDate(-1);
    expect(shown()).toBe('2028-02-28');
  });

  it('하루: 주말을 감추면 토·일을 건너뛴다', () => {
    at('day', '2026-10-02'); // 금
    useNav.setState({ showWeekend: false });
    stepDate(1);
    expect(shown()).toBe('2026-10-05'); // 월
    stepDate(-1);
    expect(shown()).toBe('2026-10-02');
  });

  it('주간은 한 주씩', () => {
    at('week', '2026-10-02');
    stepDate(1);
    expect(shown()).toBe('2026-10-09');
  });

  it('메모·학급은 날짜가 없다 - 옮기지 않는다', () => {
    at('memo', '2026-10-02');
    stepDate(1);
    expect(shown()).toBe('2026-10-02');
  });
});

describe('이전·다음 화면', () => {
  it('끝에서 돌아 처음으로', () => {
    at('class', '2026-10-02');
    stepScope(1);
    expect(useNav.getState().scope).toBe('day');
    stepScope(-1);
    expect(useNav.getState().scope).toBe('class');
  });
});

describe('둘째 줄 날짜 글자', () => {
  it('화면마다', () => {
    expect(dateLabel('day', '2026-10-08')).toBe('2026년 10월 8일 (목)');
    expect(dateLabel('week', '2026-10-08')).toBe('2026년 10월 2주');
    expect(dateLabel('month', '2026-10-08')).toBe('2026년 10월');
    expect(dateLabel('year', '2027-02-08')).toBe('2026학년도');
    expect(dateLabel('memo', '2026-10-08')).toBe('');
  });

  it('달을 걸친 주는 목요일이 든 달로 (일요일도 그 주 - 월~일)', () => {
    expect(dateLabel('week', '2026-09-28')).toBe('2026년 10월 1주'); // 9/28 월 ~ 10/4 일, 목 = 10/1
    expect(dateLabel('week', '2026-10-04')).toBe('2026년 10월 1주');
  });
});
