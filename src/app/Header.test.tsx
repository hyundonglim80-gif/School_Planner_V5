import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Header from './Header';
import { handleAppKeyDown, setShortcutOverrides } from './keys';
import { useNav } from './nav';
import { registerWindow, resetWindowsForTest, useWindows } from './windows';
import * as toast from './toast';
import { useSession } from '../data/session';
import { logout } from '../features/auth/login';

vi.mock('../data/firebase', () => ({ auth: {}, db: {}, googleProvider: {} }));
vi.mock('../features/auth/login', () => ({ logout: vi.fn() }));

beforeEach(() => {
  resetWindowsForTest();
  setShortcutOverrides({});
  useNav.setState({ scope: 'day' });
  document.documentElement.classList.remove('dark');
  localStorage.removeItem('sp5_theme');
});

const items = (c: HTMLElement) => [...c.querySelectorAll<HTMLElement>('[data-menu-item]')].map((b) => b.dataset.menuItem);

describe('⋮ 메뉴 (MENU.md 3-4)', () => {
  it('4구역, 인쇄는 인쇄할 수 있는 화면(주간·년간)에서만', async () => {
    const user = userEvent.setup();
    const { container } = render(<Header />);
    await user.click(container.querySelector('[data-more-menu]')!);
    expect([...container.querySelectorAll<HTMLElement>('[data-menu-section]')].map((s) => s.dataset.menuSection)).toEqual(['일정', '수업', '자료', '설정']);
    expect(items(container)).toEqual(['labels', 'multiSelect', 'progress', 'timetable', 'backup', 'settings', 'help']);

    act(() => useNav.setState({ scope: 'week' }));
    expect(items(container)).toContain('print');
  });

  it('아직 옮기지 않은 기능은 누르면 안내, 창이 들어오면 그 창을 연다', async () => {
    const user = userEvent.setup();
    const shown = vi.spyOn(toast, 'showToast');
    const { container } = render(<Header />);
    await user.click(container.querySelector('[data-more-menu]')!);
    await user.click(container.querySelector('[data-menu-item="settings"]')!);
    expect(shown).toHaveBeenCalledWith(expect.stringContaining('아직 V5로 옮기지 않은 기능'));
    // 누르면 메뉴는 닫힌다
    expect(container.querySelector('[data-more-list]')).toBeNull();

    registerWindow({ id: 'settings', title: '환경설정', icon: '⚙️', kind: 'side', menu: '설정', load: () => import('../features/dev/TestWindow') });
    await user.click(container.querySelector('[data-more-menu]')!);
    await user.click(container.querySelector('[data-menu-item="settings"]')!);
    expect(useWindows.getState().windows.map((w) => w.id)).toEqual(['settings']);
  });

  it('메뉴 항목 옆에 정한 단축키를 보인다 (정한 것이 없으면 없다)', async () => {
    const user = userEvent.setup();
    setShortcutOverrides({ help: { ctrl: true, alt: true, shift: false, key: 'H' } });
    const { container } = render(<Header />);
    await user.click(container.querySelector('[data-more-menu]')!);
    expect(container.querySelector('[data-menu-item="help"] kbd')).toHaveTextContent('Ctrl + Alt + H');
    expect(container.querySelector('[data-menu-item="labels"] kbd')).toBeNull();
  });
});

describe('머리줄', () => {
  it('⏳ · 🗑️ · ＋ 새로 · 🔍 · 화면 탭 여섯 · ? · ⋮ · 사진', () => {
    const { container } = render(<Header />);
    for (const sel of ['[data-header-dday]', '[data-header-trash]', '[data-new-menu]', '[data-new-fab]', '[data-header-search]', '[data-header-help]', '[data-more-menu]', '[data-account]']) {
      expect(container.querySelector(sel), sel).not.toBeNull();
    }
    expect(container.querySelectorAll('[data-scope-tab]')).toHaveLength(6);
    expect(screen.getByText('SP5')).toBeInTheDocument();
  });

  it('＋ 새로 = 새 일정·새 기록·새 메모', async () => {
    const user = userEvent.setup();
    const { container } = render(<Header />);
    await user.click(container.querySelector('[data-new-menu]')!);
    expect([...container.querySelectorAll<HTMLElement>('[data-new]')].map((b) => b.dataset.new)).toEqual(['newEvent', 'newNote', 'newMemo']);
  });
});

describe('어둡게 / 밝게 (단축키 toggleTheme)', () => {
  it('정한 키로 바꾼다 - html.dark', () => {
    setShortcutOverrides({ toggleTheme: { ctrl: true, alt: true, shift: false, key: 'D' } });
    const press = () => handleAppKeyDown(new KeyboardEvent('keydown', { key: 'd', code: 'KeyD', ctrlKey: true, altKey: true, cancelable: true }));
    press();
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem('sp5_theme')).toBe('dark');
    press();
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });
});

describe('계정 칸 (MENU.md 3-5)', () => {
  it('사진을 누르면 이름·메일·👥 공유 그룹·로그아웃 (P8-4)', async () => {
    useSession.setState({ loading: false, user: { uid: 'u1', email: 't@example.com', displayName: '김선생', photoURL: '' } });
    const user = userEvent.setup();
    const { container } = render(<Header />);
    const photo = container.querySelector<HTMLElement>('[data-account]')!;
    expect(photo).toHaveAttribute('title', '김선생 (t@example.com)');
    expect(photo).toHaveTextContent('김');
    await user.click(photo);
    expect(container.querySelector('[data-account-name]')).toHaveTextContent('김선생');
    expect(container.querySelector('[data-account-email]')).toHaveTextContent('t@example.com');
    expect(container.querySelector('[data-account-groups]')).toHaveTextContent('공유 그룹');
    await user.click(container.querySelector('[data-logout]')!);
    expect(logout).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[data-account-panel]')).toBeNull();
  });
});
