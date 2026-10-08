import { describe, it, expect } from 'vitest';
import { dateForRoute, parseRoute, routeHash, SCOPES } from './route';

describe('주소 ↔ 화면 (DESIGN 7-3)', () => {
  it('화면마다 주소 모양', () => {
    expect(routeHash('day', '2026-10-08')).toBe('#/day/2026-10-08');
    expect(routeHash('week', '2026-10-08')).toBe('#/week/2026-10-05');
    expect(routeHash('month', '2026-10-08')).toBe('#/month/2026-10');
    expect(routeHash('year', '2027-02-10')).toBe('#/year/2026');
    expect(routeHash('memo', '2026-10-08')).toBe('#/memo');
    expect(routeHash('class', '2026-10-08')).toBe('#/class');
    expect(routeHash('class', '2026-10-08', '2026-5-2')).toBe('#/class/2026-5-2');
  });

  it('주소를 읽으면 그 기간', () => {
    expect(parseRoute('#/day/2026-10-08')).toEqual({ scope: 'day', range: ['2026-10-08', '2026-10-08'] });
    expect(parseRoute('#/week/2026-10-08')).toEqual({ scope: 'week', range: ['2026-10-05', '2026-10-11'] });
    expect(parseRoute('#/month/2028-02')).toEqual({ scope: 'month', range: ['2028-02-01', '2028-02-29'] });
    expect(parseRoute('#/year/2026')).toEqual({ scope: 'year', range: ['2026-03-01', '2027-02-28'] });
    expect(parseRoute('#/memo')).toEqual({ scope: 'memo' });
    expect(parseRoute('#/class/2026-5-2')).toEqual({ scope: 'class', classId: '2026-5-2' });
  });

  it('모르는 주소는 null (그때는 보던 화면의 주소로 바꾼다)', () => {
    for (const h of ['', '#', '#/', '#/day', '#/day/2026-02-30', '#/month/2026-13', '#/year/26', '#/memo/x', '#/foo/1', '#/day/2026-10-08/x']) {
      expect(parseRoute(h)).toBeNull();
    }
  });

  it('화면 여섯 모두 주소로 오간다', () => {
    for (const scope of SCOPES) {
      const route = parseRoute(routeHash(scope, '2026-10-08'));
      expect(route?.scope).toBe(scope);
    }
  });
});

describe('주소로 왔을 때 볼 날', () => {
  const today = '2026-10-08';
  it('보던 날이 그 기간 안이면 그대로 (하루 → 월간 → 하루)', () => {
    expect(dateForRoute(parseRoute('#/month/2026-10')!, '2026-10-20', today)).toBe('2026-10-20');
  });
  it('아니면 오늘이 그 안이면 오늘', () => {
    expect(dateForRoute(parseRoute('#/week/2026-10-05')!, '2026-01-01', today)).toBe(today);
  });
  it('아니면 첫날', () => {
    expect(dateForRoute(parseRoute('#/month/2027-01')!, '2026-10-20', today)).toBe('2027-01-01');
    expect(dateForRoute(parseRoute('#/day/2027-01-05')!, today, today)).toBe('2027-01-05');
  });
  it('메모·학급은 보던 날 그대로', () => {
    expect(dateForRoute(parseRoute('#/memo')!, '2026-01-01', today)).toBe('2026-01-01');
  });
});
