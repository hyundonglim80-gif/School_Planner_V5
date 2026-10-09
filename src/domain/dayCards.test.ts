import { describe, expect, it } from 'vitest';
import { attendanceCard, noticeCard, searchDayCards } from './dayCards';

const classes = [{ id: '2026-5-2', year: 2026, grade: 5, num: 2, students: [{ sid: 's1', num: 1, name: '김하나', status: 'active' as const }] }];

describe('기록 칸 카드 (계산)', () => {
  it('알림장 카드 = 번호 붙인 줄, 줄이 없으면 없다', () => {
    expect(noticeCard('2026-10-08', ['색연필', '우유'])).toEqual({ key: 'notice:2026-10-08', kind: 'notice', date: '2026-10-08', title: '📢 알림장', lines: ['1. 색연필', '2. 우유'] });
    expect(noticeCard('2026-10-08', [])).toBeNull();
  });
  it('출결 카드 = 학급마다, 모두 출석이면 없다', () => {
    const card = attendanceCard({ classId: '2026-5-2', date: '2026-10-08', records: { s1: { kind: 'absent', reason: 'sick' } } }, classes);
    expect(card).toMatchObject({ kind: 'attendance', title: '📋 출결 5-2', lines: ['1번 김하나 결석(질병)'], classId: '2026-5-2' });
    expect(attendanceCard({ classId: '2026-5-2', date: '2026-10-08', records: {} }, classes)).toBeNull();
    expect(attendanceCard({ classId: '2025-1-1', date: '2026-10-08', records: { x: { kind: 'late', reason: 'other' } } }, classes)?.title).toBe('📋 출결 2025-1-1');
  });
  it('찾기 - 글·제목, 기간, 날짜 내림차순', () => {
    const cards = [noticeCard('2026-10-01', ['색연필'])!, noticeCard('2026-10-08', ['우유'])!, attendanceCard({ classId: '2026-5-2', date: '2026-10-05', records: { s1: { kind: 'late', reason: 'sick' } } }, classes)!];
    expect(searchDayCards(cards, '', null).map((c) => c.date)).toEqual(['2026-10-08', '2026-10-05', '2026-10-01']);
    expect(searchDayCards(cards, '색연', null).map((c) => c.key)).toEqual(['notice:2026-10-01']);
    expect(searchDayCards(cards, '출결', null).map((c) => c.kind)).toEqual(['attendance']);
    expect(searchDayCards(cards, '', { start: '2026-10-02', end: '2026-10-06' }).map((c) => c.date)).toEqual(['2026-10-05']);
  });
});
