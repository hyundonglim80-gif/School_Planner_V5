// 주간·한눈에 요일 카드 - 일정을 처음 받는 중이면 빈 날도 '일정을 받는 중…' (P32-2), 받은 뒤 빈 날은 '일정이 없습니다.'
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import WeekDayCard, { type WeekDayCardProps } from './WeekDayCard';

vi.mock('../../data/firebase', () => ({ auth: {}, db: {} }));

const nothing = () => {};
const props: WeekDayCardProps = {
  date: '2026-10-12',
  today: '2026-10-12',
  events: [],
  noteCount: 0,
  showEvents: true,
  labelsOf: () => [],
  pickedIds: new Set(),
  multiOn: false,
  onOpenDay: nothing,
  onAdd: nothing,
  onOpenNotes: nothing,
  onEventClick: nothing,
  onToggleDone: nothing,
  onDelete: nothing,
  onOpenLinks: nothing,
};

describe('요일 카드 일정 줄 - 받는 중 (P32-2)', () => {
  it('처음 받는 중이면 받는 중', () => {
    const { container } = render(<WeekDayCard {...props} eventsWaiting />);
    const box = container.querySelector('[data-week-events-waiting]');
    expect(box?.textContent).toBe('일정을 받는 중…');
  });

  it('받은 뒤 빈 날은 지금처럼 일정이 없습니다', () => {
    const { container } = render(<WeekDayCard {...props} />);
    expect(container.querySelector('[data-week-events-waiting]')).toBeNull();
    expect(container.textContent).toContain('일정이 없습니다.');
  });
});
