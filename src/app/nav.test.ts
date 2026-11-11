import { act, cleanup, renderHook } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { dateLabel, setScope, setSemesterFilter, stepDate, stepScope, useFollowToday, useNav, useSemesterFollow } from './nav';
import { DENSE_ATTR } from '../domain/fontScale';
import type { Scope } from './route';

// ◀ ▶ 날짜 이동 (V4 store/dateNav.test). 월간에서 31일에 ▶를 누르면 2월을 건너뛰어 3월로 갔다(Date.setMonth: 1/31 + 1달 = 3/3).
const at = (scope: Scope, date: string) => useNav.setState({ scope, date, showWeekend: true });
const shown = () => useNav.getState().date;

beforeEach(() => at('day', '2026-10-02'));

describe('자정 넘김 (P22-4)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    vi.setSystemTime(new Date(2026, 10, 6, 23, 59, 50));
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('오늘을 보던 사람은 날이 바뀌면 따라간다 (화면은 그대로)', () => {
    at('week', '2026-11-06');
    renderHook(() => useFollowToday());
    act(() => {
      vi.advanceTimersByTime(15_000);
    });
    expect(shown()).toBe('2026-11-07');
    expect(useNav.getState().scope).toBe('week');
  });

  it('다른 날을 보던 사람은 그대로', () => {
    at('day', '2026-10-20');
    renderHook(() => useFollowToday());
    act(() => {
      vi.advanceTimersByTime(15_000);
    });
    expect(shown()).toBe('2026-10-20');
  });

  it('탭이 며칠 잠들었다 깨어나도 오늘로', () => {
    at('day', '2026-11-06');
    renderHook(() => useFollowToday());
    vi.setSystemTime(new Date(2026, 10, 9, 8, 0, 0));
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(shown()).toBe('2026-11-09');
  });
});

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

  it('한눈에도 한 주씩 - 고른 날의 요일은 그대로 (P24)', () => {
    at('board', '2026-11-06'); // 금
    stepDate(1);
    expect(shown()).toBe('2026-11-13');
    stepDate(-1);
    expect(shown()).toBe('2026-11-06');
  });

  it('메모·학급은 날짜가 없다 - 옮기지 않는다', () => {
    at('memo', '2026-10-02');
    stepDate(1);
    expect(shown()).toBe('2026-10-02');
  });
});

describe('이전·다음 화면', () => {
  it('끝에서 돌아 처음으로 (처음 = 한눈에 - 11-09 차례)', () => {
    at('class', '2026-10-02');
    stepScope(1);
    expect(useNav.getState().scope).toBe('board');
    stepScope(-1);
    expect(useNav.getState().scope).toBe('class');
  });

  it('한눈에는 맨 앞·하루가 그 다음 - 휴대폰 밀기(phone)는 건너뛴다, 주소로 한눈에를 연 채 밀면 그 앞뒤 (11-09 사용자 요청 - P24-3에는 년간 뒤)', () => {
    at('class', '2026-10-02');
    stepScope(1);
    expect(useNav.getState().scope).toBe('board');
    stepScope(1);
    expect(useNav.getState().scope).toBe('day');
    stepScope(-1);
    expect(useNav.getState().scope).toBe('board');
    at('class', '2026-10-02');
    stepScope(1, true);
    expect(useNav.getState().scope).toBe('day');
    stepScope(-1, true);
    expect(useNav.getState().scope).toBe('class');
    at('board', '2026-10-02');
    stepScope(1, true);
    expect(useNav.getState().scope).toBe('day');
    at('board', '2026-10-02');
    stepScope(-1, true);
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
    // 한눈에도 주 이름 (P24)
    expect(dateLabel('board', '2026-11-06')).toBe('2026년 11월 1주');
  });

  it('달을 걸친 주는 목요일이 든 달로 (일요일도 그 주 - 월~일)', () => {
    expect(dateLabel('week', '2026-09-28')).toBe('2026년 10월 1주'); // 9/28 월 ~ 10/4 일, 목 = 10/1
    expect(dateLabel('week', '2026-10-04')).toBe('2026년 10월 1주');
  });

  it('1일이 금·토요일인 달도 1주부터 (목요일이 1~7일인 주 = 1주 - P14-4)', () => {
    expect(dateLabel('week', '2027-01-04')).toBe('2027년 1월 1주'); // 1/1 금
    expect(dateLabel('week', '2027-05-03')).toBe('2027년 5월 1주'); // 5/1 토
    expect(dateLabel('week', '2027-01-25')).toBe('2027년 1월 4주');
    expect(dateLabel('week', '2027-03-01')).toBe('2027년 3월 1주');
    expect(dateLabel('week', '2027-03-29')).toBe('2027년 4월 1주'); // 목 = 4/1
    expect(dateLabel('week', '2027-04-26')).toBe('2027년 4월 5주');
    expect(dateLabel('week', '2027-12-27')).toBe('2027년 12월 5주');
    expect(dateLabel('week', '2028-12-25')).toBe('2028년 12월 4주');
  });
});

describe('한눈에만 PC 글자 90% - html 표시 (P29-1)', () => {
  afterEach(() => setScope('day'));
  const dense = () => document.documentElement.hasAttribute(DENSE_ATTR);

  it('화면이 한눈에가 되면 곧바로(그리기 전에) 붙고, 다른 화면이면 뗀다', () => {
    setScope('day');
    expect(dense()).toBe(false);
    setScope('board');
    expect(dense()).toBe(true);
    for (const scope of ['week', 'month', 'year', 'memo', 'class'] as Scope[]) {
      setScope(scope);
      expect(dense(), scope).toBe(false);
    }
  });
});

describe('년간 학기 칩 따라가기 (P26-3)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    useNav.setState({ semesterFilter: 'all', semesterFilterAt: '' });
  });

  it('1·2학기를 고르면 고른 때의 학기를 적고, 전체면 비운다', () => {
    vi.setSystemTime(new Date(2026, 10, 11, 9));
    setSemesterFilter(2);
    expect(useNav.getState()).toMatchObject({ semesterFilter: 2, semesterFilterAt: '2026-2' });
    setSemesterFilter('all');
    expect(useNav.getState()).toMatchObject({ semesterFilter: 'all', semesterFilterAt: '' });
  });

  it('11월에 고른 2학기 → 새 학년도 3월에 열면 1학기 (실제 자료: 3~8월이 숨었다)', () => {
    vi.setSystemTime(new Date(2027, 2, 2, 9));
    useNav.setState({ semesterFilter: 2, semesterFilterAt: '2026-2' });
    renderHook(() => useSemesterFollow());
    expect(useNav.getState()).toMatchObject({ semesterFilter: 1, semesterFilterAt: '2027-1' });
  });

  it('고른 때를 모르는 옛 설정은 지금 학기만 적고 칩은 그대로 · 같은 학기 안에서는 그대로', () => {
    vi.setSystemTime(new Date(2026, 10, 11, 9));
    useNav.setState({ semesterFilter: 1, semesterFilterAt: '' });
    renderHook(() => useSemesterFollow());
    expect(useNav.getState()).toMatchObject({ semesterFilter: 1, semesterFilterAt: '2026-2' });
  });
});
