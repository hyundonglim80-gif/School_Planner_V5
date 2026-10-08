import { describe, it, expect, beforeEach, vi } from 'vitest';
import { formatActionBinding, SHORTCUT_ACTIONS } from '../domain/shortcuts';
import { handleAppKeyDown, runShortcut, setShortcutAction, setShortcutOverrides } from './keys';
import { useNav } from './nav';
import { registerWindow, resetWindowsForTest, useWindows } from './windows';

const press = (init: KeyboardEventInit, target: EventTarget = document.body) => {
  const e = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
  Object.defineProperty(e, 'target', { value: target });
  handleAppKeyDown(e);
  return e;
};

beforeEach(() => {
  resetWindowsForTest();
  setShortcutOverrides({});
  useNav.setState({ scope: 'day', date: '2026-10-08', showWeekend: true, showEvents: true, showClass: true });
});

describe('단축키 (V4 기본값 그대로)', () => {
  it('Shift+2 → 주간, Shift+← / → → 이전·다음 화면', () => {
    press({ key: '@', code: 'Digit2', shiftKey: true });
    expect(useNav.getState().scope).toBe('week');
    press({ key: 'ArrowRight', code: 'ArrowRight', shiftKey: true });
    expect(useNav.getState().scope).toBe('month');
    press({ key: 'ArrowLeft', code: 'ArrowLeft', shiftKey: true });
    expect(useNav.getState().scope).toBe('week');
  });

  it('Ctrl+→ 다음 날짜, Shift+↑/↓ 주말 토글', () => {
    const e = press({ key: 'ArrowRight', code: 'ArrowRight', ctrlKey: true });
    expect(useNav.getState().date).toBe('2026-10-09');
    expect(e.defaultPrevented).toBe(true);
    press({ key: 'ArrowDown', code: 'ArrowDown', shiftKey: true });
    expect(useNav.getState().showWeekend).toBe(false);
  });

  it('글을 칠 때는 Ctrl·Alt 없는 단축키를 듣지 않는다 (Shift+2는 글자 @)', () => {
    const ta = document.createElement('textarea');
    const e = press({ key: '@', code: 'Digit2', shiftKey: true }, ta);
    expect(useNav.getState().scope).toBe('day');
    expect(e.defaultPrevented).toBe(false);
  });

  it('되돌리기(Ctrl+Z)는 글 칸 안에서는 글 되돌리기에 맡긴다', () => {
    const run = vi.fn();
    const off = setShortcutAction('undo', run);
    const e = press({ key: 'z', code: 'KeyZ', ctrlKey: true }, document.createElement('textarea'));
    expect(e.defaultPrevented).toBe(false);
    expect(run).not.toHaveBeenCalled();
    press({ key: 'z', code: 'KeyZ', ctrlKey: true });
    expect(run).toHaveBeenCalledTimes(1);
    off();
  });

  it('바꾼 키를 따른다', () => {
    setShortcutOverrides({ scopeYear: { ctrl: false, alt: true, shift: false, key: 'Y' } });
    press({ key: 'y', code: 'KeyY', altKey: true });
    expect(useNav.getState().scope).toBe('year');
    press({ key: '$', code: 'Digit4', shiftKey: true });
    // 옛 키(Shift+4)는 더 이상 년간이 아니다
    useNav.setState({ scope: 'day' });
    press({ key: '$', code: 'Digit4', shiftKey: true });
    expect(useNav.getState().scope).toBe('day');
  });

  it('창 단축키는 창 목록의 같은 id 창을 연다', () => {
    registerWindow({ id: 'trash', title: '휴지통', icon: '🗑️', kind: 'side', load: () => import('../features/dev/TestWindow') });
    setShortcutOverrides({ trash: { ctrl: true, alt: true, shift: false, key: 'T' } });
    press({ key: 't', code: 'KeyT', ctrlKey: true, altKey: true });
    expect(useWindows.getState().windows.map((w) => w.id)).toEqual(['trash']);
  });

  it('아직 없는 기능은 브라우저 기본 동작을 막지 않는다 (Ctrl+F = 브라우저 찾기 - 검색은 P5-4)', () => {
    const e = press({ key: 'f', code: 'KeyF', ctrlKey: true });
    expect(e.defaultPrevented).toBe(false);
    expect(runShortcut('search')).toBe(false);
  });

  it('Ctrl+S는 늘 브라우저 저장을 막는다 (저장은 칸·창이 받는다)', () => {
    expect(press({ key: 's', code: 'KeyS', ctrlKey: true }).defaultPrevented).toBe(true);
  });

  it('ESC는 줄 전체를 닫는다', () => {
    useWindows.setState({ windows: [{ key: 1, id: 'x', params: null, openedAt: 1, raisedAt: 1 }] });
    press({ key: 'Escape' });
    expect(useWindows.getState().windows).toEqual([]);
  });
});

// 단축키는 세 곳이 어긋나기 쉬웠다 - 키 처리 / 단추 툴팁 / 사용 설명서 (V4 viewToggles.test). 지금은 domain/shortcuts 한 곳을 같이 본다.
describe('단축키는 한 곳에서만 정한다', () => {
  const sources = import.meta.glob(['./*.tsx', './*.ts', '../ui/*.tsx', '../features/**/*.tsx'], {
    query: '?raw',
    import: 'default',
    eager: true,
  }) as Record<string, string>;
  const files = Object.entries(sources).filter(([p]) => !p.includes('.test.'));

  it('키 조합을 손으로 판정하지 않는다 (e.key === "ArrowUp" 같은 것)', () => {
    const bad = files.filter(([, src]) => /e\.key === 'Arrow(Up|Down|Left|Right)'|e\.code === 'Digit[0-9]'/.test(src)).map(([p]) => p);
    expect(bad).toEqual([]);
  });

  // 날짜 ◀▶ 툴팁('Ctrl + ←')과 환경설정 안내('Shift + ↑/↓')가 글로 박혀 있어서, 단축키를 바꾸면 안내만 옛 키를 가리켰다(V4).
  it('화면 글에 기본 단축키를 적어 두지 않는다 (툴팁은 useShortcutTitle로)', () => {
    const defaults = SHORTCUT_ACTIONS.filter((a) => a.def.key).flatMap((a) => {
      const text = formatActionBinding(a, a.def);
      return text.includes(' / ') ? [text, text.replace(' / ', '/'), text.replace(' / ↓', '')] : [text];
    });
    const bad = files.flatMap(([p, src]) => defaults.filter((t) => src.includes(t)).map((t) => `${p}: ${t}`));
    expect(bad).toEqual([]);
  });

  it('둘째 줄 토글 셋은 단축키 설정을 따른다', () => {
    const shell = files.find(([p]) => p.endsWith('/Shell.tsx'))![1];
    for (const id of ['toggleWeekend', 'toggleEvents', 'toggleClass', 'datePrev', 'dateNext', 'dateToday']) expect(shell).toContain(`'${id}'`);
  });
});
