import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SettingsBinding } from '../data/settingsSync';
import { SCOPES } from './route';
import { STARTUP_SCOPES, useNav } from './nav';
import { useLayoutPrefs } from './layoutPrefs';
import { useShortcutOverrides } from './keys';
import { startPrefsSync, useCommonSettings } from './prefs';

// 서버 없이: 맞추기가 받은 문서 이름과 이음(binding)만 모은다
const started: Array<{ docId: string; binding: SettingsBinding }> = [];
vi.mock('../data/settingsSync', () => ({
  settingsPort: (_uid: string, docId: string) => ({ docId }),
  startSettingsSync: (port: { docId: string }, binding: SettingsBinding) => {
    started.push({ docId: port.docId, binding });
    return () => {};
  },
}));

const binding = (docId: string) => started.find((s) => s.docId === docId)!.binding;

function resetStores() {
  useLayoutPrefs.setState({ fontScale: 'md', popupStyle: 'side' });
  useNav.setState({ showWeekend: true, showEvents: true, showClass: true, semesterFilter: 'all', enableScrollNav: false, startupScope: 'last' });
  useShortcutOverrides.setState({ overrides: {} });
  useCommonSettings.setState({ forwardDays: 14 });
}

beforeEach(() => {
  started.length = 0;
  localStorage.clear();
  resetStores();
});

describe('설정 문서 나누기', () => {
  it('common 하나 + 이 기기 종류(pc) 하나를 맞춘다', () => {
    startPrefsSync('u1');
    expect(started.map((s) => s.docId)).toEqual(['common', 'pc']);
  });

  it('기본값이면 적을 것이 없다', () => {
    startPrefsSync('u1');
    expect(binding('pc').local()).toEqual({});
    expect(binding('common').local()).toEqual({});
  });

  it('여러 store의 바꾼 값을 한 문서로 모은다', () => {
    startPrefsSync('u1');
    useLayoutPrefs.setState({ fontScale: 'lg' });
    useNav.setState({ showWeekend: false, startupScope: 'week' });
    useShortcutOverrides.setState({ overrides: { help: { ctrl: true, alt: true, shift: false, key: 'H' } } });
    expect(binding('pc').local()).toEqual({
      fontScale: 'lg',
      showWeekend: false,
      startupScope: 'week',
      shortcutOverrides: { help: { ctrl: true, alt: true, shift: false, key: 'H' } },
    });
  });

  it('지금 보는 화면·날짜는 설정이 아니다 (바꿔도 적을 것이 없다)', () => {
    startPrefsSync('u1');
    useNav.setState({ scope: 'month', date: '2026-01-01' });
    expect(binding('pc').local()).toEqual({});
  });

  it('받은 문서를 각 store에 입히고, 글자 크기는 화면에도', () => {
    startPrefsSync('u1');
    binding('pc').apply({ fontScale: 'xl', popupStyle: 'center', showClass: false, shortcutOverrides: { zzz: {}, help: { ctrl: true, alt: false, shift: false, key: 'H' } } });
    expect(useLayoutPrefs.getState()).toMatchObject({ fontScale: 'xl', popupStyle: 'center' });
    expect(document.documentElement.style.fontSize).toBe('130%');
    expect(useNav.getState().showClass).toBe(false);
    // 모르는 단축키 id는 버린다
    expect(useShortcutOverrides.getState().overrides).toEqual({ help: { ctrl: true, alt: false, shift: false, key: 'H' } });

    binding('pc').apply({});
    expect(useLayoutPrefs.getState()).toMatchObject({ fontScale: 'md', popupStyle: 'side' });
    expect(useNav.getState().showClass).toBe(true);
  });

  it('common: 이월 기간은 1~60일', () => {
    startPrefsSync('u1');
    binding('common').apply({ forwardDays: 100 });
    expect(useCommonSettings.getState().forwardDays).toBe(60);
    expect(binding('common').local()).toEqual({ forwardDays: 60 });
  });

  it('시작 화면 고르기에는 마지막 화면 + 화면 여섯', () => {
    expect(STARTUP_SCOPES).toEqual(['last', ...SCOPES]);
  });
});

describe('이 기기 사본의 주인', () => {
  it('처음 들어온 계정은 이 기기 값을 그대로 받아들인다', () => {
    useLayoutPrefs.setState({ fontScale: 'lg' });
    startPrefsSync('u1');
    expect(useLayoutPrefs.getState().fontScale).toBe('lg');
  });

  it('다른 계정으로 들어오면 앞 사람 설정을 기본값으로 비운다 (새 계정에 올리지 않게)', () => {
    startPrefsSync('u1');
    useLayoutPrefs.setState({ fontScale: 'lg' });
    useCommonSettings.setState({ forwardDays: 30 });
    startPrefsSync('u1');
    expect(useLayoutPrefs.getState().fontScale).toBe('lg');
    startPrefsSync('u2');
    expect(useLayoutPrefs.getState().fontScale).toBe('md');
    expect(useCommonSettings.getState().forwardDays).toBe(14);
  });
});
