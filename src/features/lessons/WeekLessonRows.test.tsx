// 주간 요일 카드의 수업 줄 - 받는 중 (P32-2): 빈 교시 줄('-') 대신 '수업을 받는 중…', 높이는 교시 줄과 같게
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import type { LessonDayView } from '../../domain/lessons';
import { CLASS_COLORS } from '../../domain/teachingSlot';
import WeekLessonRows from './WeekLessonRows';

const DAY = '2026-10-12';
const empty: LessonDayView = { date: DAY, off: null, timetable: null, cells: [] };
const props = {
  date: DAY,
  view: empty,
  rows: 6,
  nowPeriod: null,
  isClassUnit: false,
  classColorOf: () => CLASS_COLORS[0],
  marks: {},
  onOpen: () => {},
  onLinks: () => {},
};

describe('주간 수업 줄 - 받는 중 (P32-2)', () => {
  it('받는 중이면 교시 줄 대신 한 칸, 높이 = 줄 여섯 + 줄 사이 다섯', () => {
    const { container } = render(<WeekLessonRows {...props} loading />);
    const box = container.querySelector<HTMLElement>('[data-week-lessons-loading]');
    expect(box?.textContent).toContain('수업을 받는 중');
    expect(box?.style.height).toBe('11.75rem'); // 6 × 1.75 + 5 × 0.25
    expect(container.querySelectorAll('[data-week-lesson]')).toHaveLength(0);
  });

  it('받은 뒤에는 지금처럼 교시 줄 (빈 교시는 -)', () => {
    const { container } = render(<WeekLessonRows {...props} />);
    expect(container.querySelector('[data-week-lessons-loading]')).toBeNull();
    expect(container.querySelectorAll('[data-week-lesson]')).toHaveLength(6);
    expect(container.querySelector('[data-week-lesson="1"]')?.textContent).toContain('-');
  });
});
