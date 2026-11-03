import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Header from './Header';
import { handleAppKeyDown, setShortcutOverrides } from './keys';
import { useNav } from './nav';
import { registerWindow, resetWindowsForTest, useWindows } from './windows';
import * as toast from './toast';
import { useSession } from '../data/session';
import { useMailStore } from '../data/mailStore';
import { useChatStore } from '../data/chatStore';
import { useMySpaces, useSpaceChoice, useSpaceOverlay } from '../data/spaceChoice';
import { logout } from '../features/auth/login';

vi.mock('../data/firebase', () => ({ auth: {}, db: {}, googleProvider: {} }));
vi.mock('../features/auth/login', () => ({ logout: vi.fn() }));

beforeEach(() => {
  resetWindowsForTest();
  setShortcutOverrides({});
  useNav.setState({ scope: 'day' });
  document.documentElement.classList.remove('dark');
  localStorage.setItem('sp5_theme', 'light'); // 정하지 않으면 어둡게가 기본이라 밝게로 시작
});

const items = (c: HTMLElement) => [...c.querySelectorAll<HTMLElement>('[data-menu-item]')].map((b) => b.dataset.menuItem);

describe('⋮ 메뉴 (MENU.md 3-4)', () => {
  it('4구역, 인쇄는 모든 화면에', async () => {
    const user = userEvent.setup();
    const { container } = render(<Header />);
    await user.click(container.querySelector('[data-more-menu]')!);
    expect([...container.querySelectorAll<HTMLElement>('[data-menu-section]')].map((s) => s.dataset.menuSection)).toEqual(['일정', '수업', '자료', '설정']);
    expect(items(container)).toEqual(['labels', 'multiSelect', 'progress', 'timetable', 'backup', 'print', 'settings', 'help']);

    act(() => useNav.setState({ scope: 'week' }));
    expect(items(container)).toContain('print');
  });

  it('⋮ 항목·머리줄 단추 = 단축키 설정이 고를 수 있는 단추 (data-shortcut-target = 그 기능, P18-1)', async () => {
    const user = userEvent.setup();
    const { container } = render(<Header />);
    await user.click(container.querySelector('[data-more-menu]')!);
    for (const b of container.querySelectorAll<HTMLElement>('[data-menu-item]')) expect(b.dataset.shortcutTarget).toBe(b.dataset.menuItem);
    expect(container.querySelector<HTMLElement>('[data-header-help]')!.dataset.shortcutTarget).toBe('help');
    expect(container.querySelector<HTMLElement>('[data-scope-tab="week"]')!.dataset.shortcutTarget).toBe('scopeWeek');
    expect(container.querySelector<HTMLElement>('[data-more-menu]')!.dataset.shortcutTarget).toBeUndefined();
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
  it('⏳ · 🗑️ · 🔍 · 화면 탭 여섯 · ? · ⋮ · 사진 (PC ＋ 새로는 없다 - P10-1)', () => {
    const { container } = render(<Header />);
    for (const sel of ['[data-header-dday]', '[data-header-trash]', '[data-header-search]', '[data-header-help]', '[data-more-menu]', '[data-account]']) {
      expect(container.querySelector(sel), sel).not.toBeNull();
    }
    expect(document.querySelector('[data-new-menu]')).toBeNull();
    // 둥근 ＋는 머리줄(backdrop-blur - fixed의 기준) 밖 body에 (P9-3)
    expect(container.querySelector('[data-new-fab]')).toBeNull();
    expect(document.body.querySelector('[data-new-fab]')).not.toBeNull();
    expect(container.querySelectorAll('[data-scope-tab]')).toHaveLength(6);
    expect(screen.getByText('SP5')).toBeInTheDocument();
  });

  it('휴대폰 둥근 ＋ = 새 일정·새 기록·새 메모', async () => {
    const user = userEvent.setup();
    render(<Header />);
    await user.click(document.body.querySelector('[data-new-fab]')!);
    expect([...document.body.querySelectorAll<HTMLElement>('[data-new]')].map((b) => b.dataset.new)).toEqual(['newEvent', 'newNote', 'newMemo']);
  });
});

describe('📂 공간 고르기 (P17-1 - 메모·학급 화면만)', () => {
  it('든 그룹이 있어도 하루·주간·월간·년간에는 없고(둘째 줄 공간 칩) 메모·학급에만', () => {
    useSession.setState({ loading: false, user: { uid: 'u1', email: 't@example.com', displayName: '김선생', photoURL: '' } });
    act(() => useMySpaces.setState({ groups: [{ id: 'g_1', name: '협의회', ownerId: 'u1', members: { u1: 'owner' } }], loaded: true }));
    const { container } = render(<Header />);
    for (const scope of ['day', 'week', 'month', 'year'] as const) {
      act(() => useNav.setState({ scope }));
      expect(container.querySelector('[data-space-select]'), scope).toBeNull();
    }
    for (const scope of ['memo', 'class'] as const) {
      act(() => useNav.setState({ scope }));
      expect(container.querySelector('[data-space-select]'), scope).not.toBeNull();
    }
    act(() => useMySpaces.setState({ groups: [], loaded: true }));
    expect(container.querySelector('[data-space-select]')).toBeNull();
  });
  it('📂는 주 공간만 고른다 - 겹쳐 보던 공간을 고르면 주 공간이 되고 겹친 것에서 빠진다, 다른 것은 기억에 그대로 (P17-2)', async () => {
    const user = userEvent.setup();
    useSession.setState({ loading: false, user: { uid: 'u1', email: 't@example.com', displayName: '김선생', photoURL: '' } });
    useSpaceChoice.setState({ uid: 'u1', sid: null, known: [] });
    useMySpaces.setState({ groups: [{ id: 'g_1', name: '협의회', ownerId: 'u1', members: {} }, { id: 'g_2', name: '5학년', ownerId: 'u1', members: {} }], loaded: true });
    useSpaceOverlay.setState({ uid: 'u1', sids: ['g_1', 'g_2'] });
    useNav.setState({ scope: 'memo' });
    const { container } = render(<Header />);
    await user.click(container.querySelector('[data-space-select]')!);
    await user.click(container.querySelector('[data-space-option="g_1"]')!);
    expect(useSpaceChoice.getState().sid).toBe('g_1');
    expect(useSpaceOverlay.getState().sids).toEqual(['g_2']);
    useSpaceOverlay.setState({ uid: null, sids: [] });
    useSpaceChoice.setState({ uid: null, sid: null, known: [] });
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

describe('머리줄 ✉ 쪽지 (P15-2 ■3)', () => {
  it('든 그룹이 없으면 없다 · 있으면 늘 · 안 읽은 수(100부터 99+) · 그룹을 나와도 안 읽은 것이 있으면', () => {
    const group = { id: 'g_1', name: '협의회', ownerId: 'u1', members: { u1: 'owner' as const } };
    act(() => {
      useMySpaces.setState({ groups: [], loaded: true });
      useMailStore.setState({ unread: 0, ready: true });
    });
    const { container } = render(<Header />);
    const btn = () => container.querySelector<HTMLElement>('[data-header-mail]');
    expect(btn()).toBeNull();
    act(() => useMySpaces.setState({ groups: [group], loaded: true }));
    expect(btn()?.dataset.headerMail).toBe('0');
    expect(container.querySelector('[data-header-mail-count]')).toBeNull();
    act(() => useMailStore.setState({ unread: 3, ready: true }));
    expect(container.querySelector('[data-header-mail-count]')).toHaveTextContent('3');
    expect(btn()?.getAttribute('aria-label')).toBe('쪽지 - 안 읽은 쪽지 3개');
    act(() => useMailStore.setState({ unread: 100, ready: true }));
    expect(container.querySelector('[data-header-mail-count]')).toHaveTextContent('99+');
    act(() => useMySpaces.setState({ groups: [], loaded: true }));
    expect(btn()).not.toBeNull();
    act(() => useMailStore.setState({ unread: 0, ready: false }));
  });
});

describe('머리줄 💬 대화 (P19-2 ■3)', () => {
  it('든 그룹이 없으면 없다 · 있으면 늘 · 안 읽은 방 수(나간 그룹 방은 빼고) · 그룹을 나와도 안 읽은 1:1이 있으면', () => {
    const group = { id: 'g_1', name: '협의회', ownerId: 'u1', members: { u1: 'owner' as const } };
    const room = (key: string, kind: 'all' | 'dm', sid: string) => ({
      key, kind, sid, name: '', members: [], names: {}, lastId: 'm', lastAt: 1000, lastFrom: 'u2', lastFromName: '이', lastText: '안녕', muted: [], reads: {},
    });
    act(() => {
      useMySpaces.setState({ groups: [], loaded: true });
      useChatStore.setState({ rooms: {}, reads: {}, ready: true });
    });
    const { container } = render(<Header />);
    const btn = () => container.querySelector<HTMLElement>('[data-header-chat]');
    expect(btn()).toBeNull();
    act(() => useMySpaces.setState({ groups: [group], loaded: true }));
    expect(btn()?.dataset.headerChat).toBe('0');
    act(() => useChatStore.setState({ rooms: { 'g_1~all': room('g_1~all', 'all', 'g_1'), 'g_9~all': room('g_9~all', 'all', 'g_9') }, reads: {}, ready: true }));
    expect(container.querySelector('[data-header-chat-count]')).toHaveTextContent('1');
    expect(btn()?.getAttribute('aria-label')).toBe('대화 - 안 읽은 대화 1개');
    act(() => useChatStore.setState({ reads: { 'g_1~all': 2000 } }));
    expect(container.querySelector('[data-header-chat-count]')).toBeNull();
    act(() => {
      useMySpaces.setState({ groups: [], loaded: true });
      useChatStore.setState({ rooms: { d_u1_u2: room('d_u1_u2', 'dm', 'g_1') } });
    });
    expect(btn()?.dataset.headerChat).toBe('1');
    act(() => useChatStore.setState({ rooms: {}, reads: {}, ready: false }));
  });
});
