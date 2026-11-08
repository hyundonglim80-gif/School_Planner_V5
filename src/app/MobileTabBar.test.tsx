import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, renderHook, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MobileTabBar from './MobileTabBar';
import { useIsMobile } from '../ui/useIsMobile';
import { setScope, useNav } from './nav';

describe('MobileTabBar (V4)', () => {
  beforeEach(() => setScope('day'));

  it('여섯 화면을 보여준다 - 한눈에는 없다 (P24-3 - 390px에 들어가지 않는다)', () => {
    const { container } = render(<MobileTabBar />);
    for (const label of ['하루', '주간', '월간', '년간', '메모', '학급']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(container.querySelectorAll('[data-tabbar-tab]')).toHaveLength(6);
    expect(container.querySelector('[data-tabbar-tab="board"]')).toBeNull();
  });

  it('누르면 화면이 바뀐다', async () => {
    const user = userEvent.setup();
    render(<MobileTabBar />);
    await user.click(screen.getByText('월간'));
    expect(useNav.getState().scope).toBe('month');
  });

  it('넓은 화면에서는 숨는다 (sm:hidden)', () => {
    const { container } = render(<MobileTabBar />);
    expect(container.querySelector('nav')!.className).toContain('sm:hidden');
  });
});

describe('useIsMobile', () => {
  const setWidth = (width: number) => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
    window.dispatchEvent(new Event('resize'));
  };

  it('화면 폭을 따라간다 (갤럭시 S25 Ultra / S26 폭 412px는 휴대폰)', () => {
    setWidth(1280);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
    act(() => setWidth(412));
    expect(result.current).toBe(true);
    act(() => setWidth(1280));
    expect(result.current).toBe(false);
  });
});
