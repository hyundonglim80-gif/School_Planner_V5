import { describe, it, expect, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HeaderFoldHandle from './HeaderFoldHandle';
import { setHeaderFolded, toggleHeaderFold, useHeaderFold } from './headerFold';
import { canRun, handleAppKeyDown, runShortcut, setShortcutOverrides } from './keys';
import { useNav } from './nav';
import { SHORTCUT_ACTIONS } from '../domain/shortcuts';

// 머리줄 접기 (메모 요청 #142 - '필요시 상단 고정바를 접어서 내용만 전체화면으로'). 껍데기에 붙인 모습은 App.test.

beforeEach(() => {
  setHeaderFolded(false);
  setShortcutOverrides({});
  useNav.setState({ scope: 'day', date: '2026-10-08' });
});

describe('접은 상태 (app/headerFold)', () => {
  it('처음에는 펴져 있고, 뒤집을 때마다 접고 편다', () => {
    expect(useHeaderFold.getState().folded).toBe(false);
    toggleHeaderFold();
    expect(useHeaderFold.getState().folded).toBe(true);
    toggleHeaderFold();
    expect(useHeaderFold.getState().folded).toBe(false);
  });

  it('이 기기에 기억한다 (sp5-header-fold)', () => {
    setHeaderFolded(true);
    expect(JSON.parse(localStorage.getItem('sp5-header-fold') ?? '{}').state).toEqual({ folded: true });
    setHeaderFolded(false);
    expect(JSON.parse(localStorage.getItem('sp5-header-fold') ?? '{}').state).toEqual({ folded: false });
  });
});

describe('손잡이 (app/HeaderFoldHandle)', () => {
  it('펴져 있으면 ▲ 머리줄 접기 - 누르면 접는다', async () => {
    const user = userEvent.setup();
    const { container } = render(<HeaderFoldHandle folded={false} />);
    const btn = container.querySelector<HTMLElement>('[data-header-fold]')!;
    expect(btn.dataset.headerFold).toBe('open');
    expect(btn).toHaveTextContent('▲');
    expect(btn).toHaveAttribute('aria-label', '머리줄 접기 (내용만 크게 보기)');
    expect(btn).toHaveAttribute('aria-expanded', 'true');
    // 펴져 있을 때는 날짜를 적지 않는다 (둘째 줄에 있다)
    expect(container.querySelector('[data-header-fold-date]')).toBeNull();
    await user.click(btn);
    expect(useHeaderFold.getState().folded).toBe(true);
  });

  it('접혀 있으면 ▼ 머리줄 펴기 + 보는 날짜 - 누르면 편다', async () => {
    const user = userEvent.setup();
    setHeaderFolded(true);
    const { container } = render(<HeaderFoldHandle folded />);
    const btn = container.querySelector<HTMLElement>('[data-header-fold]')!;
    expect(btn.dataset.headerFold).toBe('folded');
    expect(btn).toHaveTextContent('▼');
    expect(btn).toHaveAttribute('aria-label', '머리줄 펴기');
    expect(btn).toHaveAttribute('aria-expanded', 'false');
    // 하루 화면은 본문에 날짜가 없다 - 손잡이가 알려 준다 (둘째 줄 날짜 글자와 같은 글)
    expect(container.querySelector('[data-header-fold-date]')).toHaveTextContent('2026년 10월 8일 (목)');
    // 날을 옮기면 따라 바뀐다
    act(() => useNav.setState({ date: '2026-10-09' }));
    expect(container.querySelector('[data-header-fold-date]')).toHaveTextContent('2026년 10월 9일 (금)');
    act(() => useNav.setState({ scope: 'month' }));
    expect(container.querySelector('[data-header-fold-date]')).toHaveTextContent('2026년 10월');
    await user.click(btn);
    expect(useHeaderFold.getState().folded).toBe(false);
  });

  it('날짜가 없는 화면(메모·학급)에서는 ▼만', () => {
    useNav.setState({ scope: 'memo' });
    const { container } = render(<HeaderFoldHandle folded />);
    expect(container.querySelector('[data-header-fold]')).toHaveTextContent('▼');
    expect(container.querySelector('[data-header-fold-date]')).toBeNull();
  });

  it('단축키 설정이 고를 수 있는 단추다 (data-shortcut-target = toggleHeader) · 키를 정하면 툴팁에 보인다', () => {
    const { container, rerender } = render(<HeaderFoldHandle folded={false} />);
    const btn = () => container.querySelector<HTMLElement>('[data-header-fold]')!;
    expect(btn().dataset.shortcutTarget).toBe('toggleHeader');
    expect(btn()).toHaveAttribute('title', '머리줄 접기 (내용만 크게 보기)');
    act(() => setShortcutOverrides({ toggleHeader: { ctrl: true, alt: true, shift: false, key: 'H' } }));
    expect(btn()).toHaveAttribute('title', '머리줄 접기 (내용만 크게 보기) (단축키: Ctrl + Alt + H)');
    rerender(<HeaderFoldHandle folded />);
    expect(btn().dataset.shortcutTarget).toBe('toggleHeader');
    expect(btn()).toHaveAttribute('title', '머리줄 펴기 (단축키: Ctrl + Alt + H)');
  });

  it('눌러도 쓰던 칸의 초점을 가져가지 않는다 (mousedown을 막는다)', () => {
    const { container } = render(<HeaderFoldHandle folded={false} />);
    const down = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    container.querySelector('[data-header-fold]')!.dispatchEvent(down);
    expect(down.defaultPrevented).toBe(true);
  });
});

describe("단축키 '머리줄 접기 / 펴기' (toggleHeader)", () => {
  it('기본 키는 없다 - 정해 둔 키와 겹치지 않게, 단축키 설정에서 정한다', () => {
    const action = SHORTCUT_ACTIONS.find((a) => a.id === 'toggleHeader');
    expect(action?.def.key).toBe('');
    expect(canRun('toggleHeader')).toBe(true);
  });

  it('정한 키로 접고 편다 (글 칸 안에서도 - Ctrl·Alt 키)', () => {
    setShortcutOverrides({ toggleHeader: { ctrl: true, alt: true, shift: false, key: 'H' } });
    const press = () => {
      const e = new KeyboardEvent('keydown', { key: 'h', code: 'KeyH', ctrlKey: true, altKey: true, cancelable: true });
      handleAppKeyDown(e);
      return e.defaultPrevented;
    };
    expect(press()).toBe(true);
    expect(useHeaderFold.getState().folded).toBe(true);
    expect(press()).toBe(true);
    expect(useHeaderFold.getState().folded).toBe(false);
  });

  it('runShortcut으로도 (단추·메뉴가 부르는 길)', () => {
    expect(runShortcut('toggleHeader')).toBe(true);
    expect(useHeaderFold.getState().folded).toBe(true);
  });
});
