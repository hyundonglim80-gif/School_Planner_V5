import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import { resetHistoryForTest } from '../../app/history';
import { setPopupStyle, useLayoutPrefs } from '../../app/layoutPrefs';
import { useNav } from '../../app/nav';
import { handleAppKeyDown, setShortcutOverrides, useShortcutOverrides } from '../../app/keys';
import { anyWindowUnsaved } from '../../app/windows';
import { overridesFromBindings, resolveBindings } from '../../domain/shortcuts';
import { useMirror } from '../../data/mirror/store';
import SettingsWindow from './SettingsWindow';

// '이 기기 사본 다시 받기'는 Firebase를 부른다 - 창 시험에서는 흉내만
const resetMirror = vi.hoisted(() => vi.fn(() => Promise.resolve()));
vi.mock('../../data/mirror/sync', () => ({ resetMirror }));

const q = (s: string) => document.querySelector<HTMLElement>(s)!;
const qa = (s: string) => [...document.querySelectorAll<HTMLElement>(s)];

beforeEach(() => {
  resetHistoryForTest();
  // 가운데 창으로 그린다 (오른쪽 줄 없이)
  setPopupStyle('center');
  useLayoutPrefs.setState({ fontScale: 'md' });
  useNav.setState({ showWeekend: true, startupScope: 'last' });
  setShortcutOverrides({});
});

const openSettings = (tab?: 'view' | 'shortcuts' | 'app') => render(<SettingsWindow params={tab ? { tab } : undefined} close={vi.fn()} raise={0} />);

describe('환경설정 창', () => {
  it('지금 있는 탭만 (보기·단축키·앱) - 아직 옮기지 않은 기능의 탭은 숨긴다', () => {
    openSettings();
    expect(qa('[data-settings-tab]').map((b) => b.dataset.settingsTab)).toEqual(['view', 'shortcuts', 'app']);
    expect(q('[data-settings-tab="view"]')).toHaveAttribute('aria-selected', 'true');
  });

  it('열 때 탭을 고를 수 있다', () => {
    openSettings('shortcuts');
    expect(q('[data-settings-panel="shortcuts"]')).toBeVisible();
    expect(q('[data-settings-panel="view"]')).not.toBeVisible();
  });

  it('보기: 누르는 즉시 바뀐다 (저장 단추가 없다)', () => {
    openSettings();
    fireEvent.click(q('[data-settings-toggle="showWeekend"]'));
    expect(useNav.getState().showWeekend).toBe(false);
    fireEvent.click(q('[data-choice="fontScale:lg"]'));
    expect(useLayoutPrefs.getState().fontScale).toBe('lg');
    expect(document.documentElement.style.fontSize).toBe('115%');
    fireEvent.click(q('[data-choice="startupScope:memo"]'));
    expect(useNav.getState().startupScope).toBe('memo');
    expect(document.querySelector('[data-shortcut-save]')).toBeNull();
  });

  it('단축키: 키 칸을 누르고 키를 누르면 들어가고, 저장해야 바뀐다', () => {
    openSettings('shortcuts');
    const input = q('[data-shortcut-row="help"] [data-shortcut-key]');
    fireEvent.keyDown(input, { key: 'h', code: 'KeyH', ctrlKey: true, altKey: true });
    expect(input).toHaveValue('H');
    expect(useShortcutOverrides.getState().overrides).toEqual({});
    expect(anyWindowUnsaved()).toBe(true);
    fireEvent.click(q('[data-shortcut-save]'));
    expect(useShortcutOverrides.getState().overrides).toEqual({ help: { ctrl: true, alt: true, shift: false, key: 'H' } });
    expect(anyWindowUnsaved()).toBe(false);
  });

  it('단축키 칸에서 누른 키는 화면 단축키로 올라가지 않는다', () => {
    const run = vi.fn();
    window.addEventListener('keydown', run);
    openSettings('shortcuts');
    fireEvent.keyDown(q('[data-shortcut-row="help"] [data-shortcut-key]'), { key: '1', code: 'Digit1', shiftKey: true });
    window.removeEventListener('keydown', run);
    expect(run).not.toHaveBeenCalled();
  });

  it('겹치는 키는 저장하지 않는다', () => {
    openSettings('shortcuts');
    // 하루 화면(Shift+1)과 같은 키를 주간 화면에
    fireEvent.keyDown(q('[data-shortcut-row="scopeWeek"] [data-shortcut-key]'), { key: '!', code: 'Digit1', shiftKey: true });
    expect(q('[data-shortcut-row="scopeDay"]')).toHaveAttribute('data-conflict');
    expect(q('[data-shortcut-conflict]')).toBeInTheDocument();
    fireEvent.click(q('[data-shortcut-save]'));
    expect(useShortcutOverrides.getState().overrides).toEqual({});
  });

  it('Ctrl+S = 단축키 저장 (다른 탭에 있어도 고치던 것을)', () => {
    openSettings('shortcuts');
    fireEvent.keyDown(q('[data-shortcut-row="help"] [data-shortcut-key]'), { key: 'h', code: 'KeyH', ctrlKey: true, altKey: true });
    fireEvent.click(q('[data-settings-tab="view"]'));
    act(() => {
      q('[data-settings-window]').dispatchEvent(new KeyboardEvent('keydown', { key: 's', code: 'KeyS', ctrlKey: true, bubbles: true }));
    });
    expect(useShortcutOverrides.getState().overrides).toHaveProperty('help');
  });

  it('기본값으로 → 저장하면 바꾼 키가 없어진다', () => {
    setShortcutOverrides({ help: { ctrl: true, alt: true, shift: false, key: 'H' } });
    openSettings('shortcuts');
    fireEvent.click(q('[data-shortcut-reset]'));
    fireEvent.click(q('[data-shortcut-save]'));
    expect(useShortcutOverrides.getState().overrides).toEqual({});
  });

  it('고치지 않은 채로 다른 기기에서 키가 바뀌면 따라간다', () => {
    openSettings('shortcuts');
    act(() => setShortcutOverrides({ help: { ctrl: true, alt: true, shift: false, key: 'Q' } }));
    expect(q('[data-shortcut-row="help"] [data-shortcut-key]')).toHaveValue('Q');
  });

  it('창 밖 Ctrl 단축키는 그대로 돈다 (창이 열려 있어도)', () => {
    openSettings();
    handleAppKeyDown(new KeyboardEvent('keydown', { key: '!', code: 'Digit3', shiftKey: true }));
    expect(useNav.getState().scope).toBe('month');
  });
});

describe('바꾼 키 고르기', () => {
  it('기본값과 같은 것은 빼고 다른 것만', () => {
    const b = resolveBindings({ help: { ctrl: true, alt: false, shift: false, key: 'H' } });
    expect(overridesFromBindings(b)).toEqual({ help: { ctrl: true, alt: false, shift: false, key: 'H' } });
    expect(overridesFromBindings(resolveBindings())).toEqual({});
  });

  it('앱: 이 기기 사본 - 어디에 두나·몇 개, 다시 받기', async () => {
    useMirror.setState({
      persisted: 'memory',
      colls: { 'u_a/items': { status: 'live', docs: { a: { id: 'a' }, b: { id: 'b' } } }, 'u_a/labels': { status: 'live', docs: { l: { id: 'l' } } } },
    });
    openSettings('app');
    expect(q('[data-mirror-state]').dataset.mirrorState).toBe('memory');
    expect(q('[data-mirror-count]').dataset.mirrorCount).toBe('3');
    await act(async () => {
      fireEvent.click(q('[data-mirror-reset]'));
    });
    expect(resetMirror).toHaveBeenCalledTimes(1);
    useMirror.setState({ persisted: null, colls: {} });
  });
});
