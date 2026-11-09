import { beforeEach, describe, expect, it, vi } from 'vitest';

// 계정 설정 맞추기는 서버를 부른다 - 여기서는 store만
vi.mock('../data/firebase', () => ({ db: {}, auth: {} }));
vi.mock('../data/settingsSync', () => ({ settingsPort: () => ({}), startSettingsSync: () => () => {} }));
const toast = vi.hoisted(() => vi.fn());
vi.mock('./toast', () => ({ showToast: toast, showErrorToast: vi.fn() }));

import { DEFAULT_AUTO_BACKUP } from '../domain/autoBackup';
import { customShortcutOf, runCustomShortcut } from './customShortcuts';
import { handleAppKeyDown, setCustomShortcuts, setShortcutOverrides, setTabShortcuts } from './keys';
import { useLayoutPrefs } from './layoutPrefs';
import { useNav } from './nav';
import { nextOptionValue, optionShortcutId, optionTargetOf } from './optionShortcuts';
import { useCommonSettings } from './prefs';
import { isKnownShortcut, shortcutLabel } from './tabShortcuts';
import { readContrast } from './viewAids';

const alt = (key: string) => ({ ctrl: false, alt: true, shift: false, key });

beforeEach(() => {
  localStorage.clear();
  toast.mockClear();
  useLayoutPrefs.setState({ popupStyle: 'side', fontScale: 'md' });
  useCommonSettings.setState({ alarmSound: 10, autoBackup: { ...DEFAULT_AUTO_BACKUP }, cvd: false });
  useNav.setState({ startupScope: 'last', enableScrollNav: false });
  setShortcutOverrides({});
  setTabShortcuts({});
  setCustomShortcuts({});
});

describe('환경설정 값 단축키 (P28-2)', () => {
  it('고를 값: 지금 다른 값이면 그 값 · 이미 그 값이면 앞 값 → 기본값 → 목록의 다른 값', () => {
    const list = ['side', 'popup'];
    expect(nextOptionValue('popup', 'side', undefined, 'side', list)).toBe('popup');
    expect(nextOptionValue('popup', 'popup', 'side', 'side', list)).toBe('side');
    // 앞 값이 없으면 기본값
    expect(nextOptionValue('popup', 'popup', undefined, 'side', list)).toBe('side');
    // 앞 값이 그 값이거나 목록에 없으면 건너뛴다
    expect(nextOptionValue('popup', 'popup', 'popup', 'side', list)).toBe('side');
    expect(nextOptionValue('popup', 'popup', 'center', 'side', list)).toBe('side');
    // 기본값이 그 값이면 목록의 다른 값
    expect(nextOptionValue('side', 'side', undefined, 'side', list)).toBe('popup');
    expect(nextOptionValue('md', 'md', undefined, 'md', ['xs', 'sm', 'md'])).toBe('xs');
  });

  it('이름: 고르기 = 제목 → 값 · 켜기/끄기 = 제목 켜기 / 끄기 · 모르는 것은 없음(그대로 id)', () => {
    expect(shortcutLabel('opt.fontScale.lg')).toBe('글자 크기 → 크게');
    expect(shortcutLabel('opt.alarmSound.-1')).toBe('알림 소리 → 확인할 때까지');
    expect(shortcutLabel('opt.autoBackupKeep.12')).toBe('자동 백업 남길 개수 → 최근 12개');
    expect(shortcutLabel('opt.contrast')).toBe('고대비 켜기 / 끄기');
    for (const id of ['opt.alarmSound.7', 'opt.nothing', 'opt.contrast.x', 'opt.fontScale', 'press.ab12'] as const) {
      expect(customShortcutOf(id)).toBeUndefined();
      expect(isKnownShortcut(id)).toBe(false);
    }
    expect(shortcutLabel('opt.nothing')).toBe('opt.nothing');
    expect(isKnownShortcut('opt.fontScale.lg')).toBe(true);
    expect(isKnownShortcut('settings:notify')).toBe(true);
    expect(isKnownShortcut('search')).toBe(true);
  });

  it('고르기 키: 그 값으로 + 안내, 다시 누르면 앞 값 (번갈아)', () => {
    expect(runCustomShortcut('opt.fontScale.lg')).toBe(true);
    expect(useLayoutPrefs.getState().fontScale).toBe('lg');
    expect(toast).toHaveBeenLastCalledWith('⚙️ 글자 크기: 크게');
    useLayoutPrefs.setState({ fontScale: 'sm' });
    runCustomShortcut('opt.fontScale.lg');
    expect(useLayoutPrefs.getState().fontScale).toBe('lg');
    // 앞 값 = 키로 바꾸기 전 값(작게)
    runCustomShortcut('opt.fontScale.lg');
    expect(useLayoutPrefs.getState().fontScale).toBe('sm');
    expect(toast).toHaveBeenLastCalledWith('⚙️ 글자 크기: 작게');
  });

  it('창 위치 키: 팝업창 ↔ 오른쪽 칸 (창은 열지 않는다 - 값만)', () => {
    runCustomShortcut('opt.popupStyle.popup');
    expect(useLayoutPrefs.getState().popupStyle).toBe('popup');
    expect(toast).toHaveBeenLastCalledWith('⚙️ 창 위치: 팝업창');
    runCustomShortcut('opt.popupStyle.popup');
    expect(useLayoutPrefs.getState().popupStyle).toBe('side');
    expect(toast).toHaveBeenLastCalledWith('⚙️ 창 위치: 오른쪽 칸');
  });

  it('켜기/끄기 키는 늘 뒤집는다 · 계정 값(자동 백업)은 다른 칸을 그대로 둔다', () => {
    runCustomShortcut('opt.contrast');
    expect(readContrast()).toBe(true);
    expect(toast).toHaveBeenLastCalledWith('⚙️ 고대비: 켬');
    runCustomShortcut('opt.contrast');
    expect(readContrast()).toBe(false);
    expect(toast).toHaveBeenLastCalledWith('⚙️ 고대비: 끔');
    runCustomShortcut('opt.autoBackupKeep.12');
    runCustomShortcut('opt.autoBackup');
    expect(useCommonSettings.getState().autoBackup).toEqual({ ...DEFAULT_AUTO_BACKUP, keep: 12, enabled: !DEFAULT_AUTO_BACKUP.enabled });
    runCustomShortcut('opt.alarmSound.-1');
    expect(useCommonSettings.getState().alarmSound).toBe(-1);
  });

  it('키 처리: 값 키를 누르면 그 값으로, 이 판이 모르는 값 키는 건너뛰고 브라우저 동작을 막지 않는다', () => {
    setCustomShortcuts({ 'opt.popupStyle.popup': alt('P'), 'opt.someFuture.x': alt('Q') });
    const press = (key: string) => {
      const e = new KeyboardEvent('keydown', { key: key.toLowerCase(), code: `Key${key}`, altKey: true, bubbles: true, cancelable: true });
      Object.defineProperty(e, 'target', { value: document.body });
      handleAppKeyDown(e);
      return e;
    };
    expect(press('P').defaultPrevented).toBe(true);
    expect(useLayoutPrefs.getState().popupStyle).toBe('popup');
    expect(press('Q').defaultPrevented).toBe(false);
    // 새 창으로 옮긴 창(only)에서는 듣지 않는다
    const e = new KeyboardEvent('keydown', { key: 'p', code: 'KeyP', altKey: true, cancelable: true });
    handleAppKeyDown(e, new Set(['undo']));
    expect(e.defaultPrevented).toBe(false);
    expect(useLayoutPrefs.getState().popupStyle).toBe('popup');
  });

  it('단추가 고르는 것: 값 id · 주말·일정·수업은 둘째 줄 단축키 · 목록에 없는 값은 없음', () => {
    expect(optionShortcutId('popupStyle', 'popup')).toBe('opt.popupStyle.popup');
    expect(optionShortcutId('contrast')).toBe('opt.contrast');
    expect(optionTargetOf('popupStyle', 'popup')).toBe('opt.popupStyle.popup');
    expect(optionTargetOf('alarmSound', -1)).toBe('opt.alarmSound.-1');
    expect(optionTargetOf('contrast')).toBe('opt.contrast');
    expect(optionTargetOf('showWeekend')).toBe('toggleWeekend');
    expect(optionTargetOf('showClass')).toBe('toggleClass');
    expect(optionTargetOf('alarmSound', 7)).toBeNull();
    expect(optionTargetOf('nothing')).toBeNull();
  });
});
