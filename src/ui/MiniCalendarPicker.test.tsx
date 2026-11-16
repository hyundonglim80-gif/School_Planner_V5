import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import MiniCalendarPicker from './MiniCalendarPicker';

// 둘째 줄 📅 - 올려도 눌러도 열린다. 올리자마자 누르면(휴대폰 톡·빠른 클릭) 열었다 닫는 일이 있었다(P36-1 CI가 다섯에 한 번 찾음).
const btn = (c: HTMLElement) => c.querySelector('[data-date-picker]') as HTMLElement;
const popover = () => document.querySelector('[data-date-picker-popover]');

describe('MiniCalendarPicker 올리기·누르기', () => {
  afterEach(() => vi.useRealTimers());

  it('올려서 막 연 것을 곧바로 누르면 열린 채로 둔다', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 16, 9, 0, 0));
    const { container } = render(<MiniCalendarPicker date="2026-10-08" onSelectDate={() => {}} />);
    fireEvent.mouseEnter(btn(container).parentElement!);
    expect(popover()).not.toBeNull();
    vi.setSystemTime(new Date(2026, 10, 16, 9, 0, 0, 100));
    fireEvent.click(btn(container));
    expect(popover()).not.toBeNull();
    // 열린 달력은 보는 날의 달 - 그 달의 날을 누를 수 있다
    expect(document.querySelector('[data-picker-day="2026-10-20"]')).not.toBeNull();
  });

  it('열려 있은 지 오래면 누르기 = 닫기 (그대로)', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 16, 9, 0, 0));
    const { container } = render(<MiniCalendarPicker date="2026-10-08" onSelectDate={() => {}} />);
    fireEvent.mouseEnter(btn(container).parentElement!);
    vi.setSystemTime(new Date(2026, 10, 16, 9, 0, 1));
    fireEvent.click(btn(container));
    expect(popover()).toBeNull();
  });

  it('누르기만 하면 열고, 다시 누르면 닫는다', () => {
    const { container } = render(<MiniCalendarPicker date="2026-10-08" onSelectDate={() => {}} />);
    fireEvent.click(btn(container));
    expect(popover()).not.toBeNull();
    fireEvent.click(btn(container));
    expect(popover()).toBeNull();
  });

  it('날을 누르면 그 날로 가고 닫힌다', () => {
    const onSelectDate = vi.fn();
    const { container } = render(<MiniCalendarPicker date="2026-10-08" onSelectDate={onSelectDate} />);
    fireEvent.click(btn(container));
    act(() => {
      (document.querySelector('[data-picker-day="2026-10-20"]') as HTMLElement).click();
    });
    expect(onSelectDate).toHaveBeenCalledWith('2026-10-20');
    expect(popover()).toBeNull();
  });
});
