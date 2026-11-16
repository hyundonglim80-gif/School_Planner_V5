// 겹쳐 그린 구글 캘린더 일정 (P36-4) - 누르면 그 일정 창(여러 개 고르는 동안은 아무 일 없음) · 시각·이름 칩 · 둘째 줄 '📅 구글' 토글(고른 캘린더가 있을 때만, 이 기기)
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { useCommonSettings } from '../../app/prefs';
import { gcalShownList } from '../../domain/gcalShow';
import { useMulti } from '../events/multi';
import { useGcalView } from './gcalView';
import { GcalDayCard, GcalLine } from './GcalItems';
import GcalToggle from './GcalToggle';

vi.mock('../../data/firebase', () => ({ auth: { currentUser: null }, db: {}, GOOGLE_SCOPES: [] }));
const w = vi.hoisted(() => ({ open: vi.fn() }));
vi.mock('../../app/windows', () => ({ openWindow: w.open }));

const [meeting] = gcalShownList(
  [{ id: 'm1', cal: 'c1', title: '학년 협의', allDay: false, start: '2026-11-16T15:00', end: '2026-11-16T16:30', location: '3층 회의실' }],
  [{ id: 'c1', name: '학교', color: '#0b8043' }],
);
const q = (c: HTMLElement, s: string) => c.querySelector<HTMLElement>(s);

beforeEach(() => {
  w.open.mockClear();
  useMulti.setState({ on: false, picks: [], anchor: null });
  useGcalView.setState({ on: true });
  useCommonSettings.setState({ gcalOverlay: [] });
});

describe('구글 일정 줄', () => {
  it('하루 카드 = 이름 칩 + 시각 + 제목 + 장소, 누르면 그 일정 창(그날·그 일정을 창 값에)', () => {
    const { container } = render(<GcalDayCard s={meeting} date="2026-11-16" />);
    const card = q(container, '[data-gcal-event="m1"]')!;
    expect(card.getAttribute('data-gcal-at')).toBe('day');
    expect(q(card, '[data-gcal-chip]')!.textContent).toBe('학교');
    expect(q(card, '[data-gcal-time]')!.textContent).toBe('15:00~16:30');
    expect(card.textContent).toContain('3층 회의실');
    fireEvent.click(card);
    expect(w.open).toHaveBeenCalledWith('gcalEvent', { date: '2026-11-16', shown: meeting });
  });

  it('여러 개 고르는 동안은 눌러도 아무 일 없음 · 감싼 칸으로 누르기가 번지지 않는다', () => {
    const outer = vi.fn();
    const { container } = render(
      <div role="button" tabIndex={0} onClick={outer} onKeyDown={outer}>
        <GcalLine s={meeting} date="2026-11-16" at="week" />
      </div>,
    );
    useMulti.setState({ on: true });
    fireEvent.click(q(container, '[data-gcal-event]')!);
    expect(w.open).not.toHaveBeenCalled();
    expect(outer).not.toHaveBeenCalled();
  });

  it('월간 칸은 이름 칩 대신 색 점·시작 시각만, 휴대폰 칸은 instead(그날 목록)로', () => {
    const instead = vi.fn();
    const { container } = render(
      <>
        <GcalLine s={meeting} date="2026-11-16" at="month" />
        <GcalLine s={meeting} date="2026-11-16" at="compact" instead={instead} />
      </>,
    );
    const [month, compact] = [...container.querySelectorAll<HTMLElement>('[data-gcal-event]')];
    expect(q(month, '[data-gcal-chip]')).toBeNull();
    expect(q(month, '[data-gcal-time]')!.textContent).toBe('15:00');
    fireEvent.click(compact);
    expect(instead).toHaveBeenCalled();
    expect(w.open).not.toHaveBeenCalled();
  });
});

describe("둘째 줄 '📅 구글'", () => {
  it('고른 캘린더가 없으면 없고, 있으면 누를 때마다 이 기기에서 끄고 켠다', () => {
    const { container, rerender } = render(<GcalToggle />);
    expect(q(container, '[data-gcal-toggle]')).toBeNull();
    useCommonSettings.setState({ gcalOverlay: [{ id: 'c1', name: '학교', color: '#0b8043' }] });
    rerender(<GcalToggle />);
    const t = q(container, '[data-gcal-toggle]')!;
    expect(t.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(t);
    expect(useGcalView.getState().on).toBe(false);
    expect(q(container, '[data-gcal-toggle]')!.getAttribute('aria-pressed')).toBe('false');
  });
});
