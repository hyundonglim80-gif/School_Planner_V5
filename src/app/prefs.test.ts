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

// 관리자 '처음 설정'(P33-3) - 새 사용자에게 깔 값을 나눠 받은 settingsSnapshot이 읽는다
vi.mock('../data/firebase', () => ({ auth: {}, db: {}, googleProvider: {} }));
const initial = vi.hoisted(() => ({ doc: null as unknown, reads: 0 }));
vi.mock('../data/settingsReset', () => ({
  RESET_DOC_ID: 'reset',
  loadInitialSettings: async () => {
    initial.reads++;
    return initial.doc;
  },
}));

function resetStores() {
  useLayoutPrefs.setState({ fontSizes: {}, popupStyle: 'side' });
  useNav.setState({ scope: 'day', showWeekend: true, showEvents: true, showClass: true, semesterFilter: 'all', semesterFilterAt: '', enableScrollNav: false, startupScope: 'last' });
  useShortcutOverrides.setState({ overrides: {}, tabs: {} });
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
    useLayoutPrefs.setState({ fontSizes: { board: 85 } });
    useNav.setState({ showWeekend: false, startupScope: 'week' });
    useShortcutOverrides.setState({ overrides: { help: { ctrl: true, alt: true, shift: false, key: 'H' } } });
    expect(binding('pc').local()).toEqual({
      fontSizes: { board: 85 },
      showWeekend: false,
      startupScope: 'week',
      shortcutOverrides: { help: { ctrl: true, alt: true, shift: false, key: 'H' } },
    });
  });

  it('창 안 탭 키(P18-2)는 따로 칸 tabShortcuts - 모르는 탭·빈 키는 받을 때 버린다', () => {
    startPrefsSync('u1');
    useShortcutOverrides.setState({ tabs: { 'settings:notify': { ctrl: true, alt: true, shift: false, key: 'N' } } });
    expect(binding('pc').local()).toEqual({ tabShortcuts: { 'settings:notify': { ctrl: true, alt: true, shift: false, key: 'N' } } });
    binding('pc').apply({
      tabShortcuts: { 'backup:import': { ctrl: false, alt: true, shift: false, key: 'I' }, 'settings:zzz': { ctrl: false, alt: true, shift: false, key: 'Z' }, 'mail:in': { ctrl: false, alt: true, shift: false, key: '' } },
    });
    expect(useShortcutOverrides.getState().tabs).toEqual({ 'backup:import': { ctrl: false, alt: true, shift: false, key: 'I' } });
    binding('pc').apply({});
    expect(useShortcutOverrides.getState().tabs).toEqual({});
  });

  it('지금 보는 화면·날짜는 설정이 아니다 (바꿔도 적을 것이 없다)', () => {
    startPrefsSync('u1');
    useNav.setState({ scope: 'month', date: '2026-01-01' });
    expect(binding('pc').local()).toEqual({});
  });

  it('받은 문서를 각 store에 입히고, 글자 크기는 지금 화면(하루)의 것을 화면에도', () => {
    startPrefsSync('u1');
    binding('pc').apply({
      fontSizes: { day: 130, board: 85 },
      popupStyle: 'center',
      showClass: false,
      shortcutOverrides: { zzz: {}, help: { ctrl: true, alt: false, shift: false, key: 'H' } },
    });
    expect(useLayoutPrefs.getState()).toMatchObject({ fontSizes: { day: 130, board: 85 }, popupStyle: 'center' });
    expect(document.documentElement.style.getPropertyValue('--font-scale')).toBe('1.3');
    expect(useNav.getState().showClass).toBe(false);
    // 모르는 단축키 id는 버린다
    expect(useShortcutOverrides.getState().overrides).toEqual({ help: { ctrl: true, alt: false, shift: false, key: 'H' } });

    // 화면을 옮기면 그 화면이 기억한 크기로 (메모 요청 #145)
    useNav.setState({ scope: 'board' });
    expect(document.documentElement.style.getPropertyValue('--font-scale')).toBe('0.85');
    useNav.setState({ scope: 'week' });
    expect(document.documentElement.style.getPropertyValue('--font-scale')).toBe('');
    useNav.setState({ scope: 'day' });

    binding('pc').apply({});
    expect(useLayoutPrefs.getState()).toMatchObject({ fontSizes: {}, popupStyle: 'side' });
    expect(document.documentElement.style.getPropertyValue('--font-scale')).toBe('');
    expect(useNav.getState().showClass).toBe(true);
  });

  it('옛 문서의 글자 크기 다섯 단계(fontScale)는 모든 화면에 같은 %로 옮겨 읽는다 (메모 요청 #145)', () => {
    startPrefsSync('u1');
    binding('pc').apply({ fontScale: 'lg', showWeekend: false });
    const sizes = useLayoutPrefs.getState().fontSizes;
    expect(sizes.day).toBe(115);
    expect(sizes.board).toBe(115);
    expect(sizes.popout).toBe(115);
    expect(document.documentElement.style.getPropertyValue('--font-scale')).toBe('1.15');
    // 다시 적을 때는 새 칸만 (옛 칸은 빠진다)
    expect(binding('pc').local()).toEqual({ fontSizes: sizes, showWeekend: false });
    // 새 칸이 있으면 옛 칸은 보지 않는다
    binding('pc').apply({ fontScale: 'xl', fontSizes: { day: 95 } });
    expect(useLayoutPrefs.getState().fontSizes).toEqual({ day: 95 });
    binding('pc').apply({ fontScale: 'md' });
    expect(useLayoutPrefs.getState().fontSizes).toEqual({});
  });

  it('학기 칩을 고른 때의 학기(P26-3)도 기기 종류 문서에 - 이상한 값은 모름(빈 글자)', () => {
    startPrefsSync('u1');
    binding('pc').apply({ semesterFilter: 2, semesterFilterAt: '2026-2' });
    expect(useNav.getState()).toMatchObject({ semesterFilter: 2, semesterFilterAt: '2026-2' });
    expect(binding('pc').local()).toEqual({ semesterFilter: 2, semesterFilterAt: '2026-2' });
    binding('pc').apply({ semesterFilter: 2, semesterFilterAt: '2학기' });
    expect(useNav.getState().semesterFilterAt).toBe('');
  });

  it('common: 이월 기간은 1~60일', () => {
    startPrefsSync('u1');
    binding('common').apply({ forwardDays: 100 });
    expect(useCommonSettings.getState().forwardDays).toBe(60);
    expect(binding('common').local()).toEqual({ forwardDays: 60 });
  });

  it('common: 색 테마(P20-1)는 계정에 하나 - 모르는 id(새 테마)도 그대로 두고, 이상한 값만 기본', () => {
    startPrefsSync('u1');
    binding('common').apply({ palette: 'forest' });
    expect(useCommonSettings.getState().palette).toBe('forest');
    expect(binding('common').local()).toEqual({ palette: 'forest' });
    binding('common').apply({ palette: 'aurora' });
    expect(useCommonSettings.getState().palette).toBe('aurora');
    binding('common').apply({ palette: 'Bad id!' });
    expect(useCommonSettings.getState().palette).toBe('default');
    expect(binding('common').local()).toEqual({});
  });

  it('시작 화면 고르기에는 마지막 화면 + 화면 여섯', () => {
    expect(STARTUP_SCOPES).toEqual(['last', ...SCOPES]);
  });
});

describe('이 기기 사본의 주인', () => {
  it('처음 들어온 계정은 이 기기 값을 그대로 받아들인다', () => {
    useLayoutPrefs.setState({ fontSizes: { day: 115 } });
    startPrefsSync('u1');
    expect(useLayoutPrefs.getState().fontSizes).toEqual({ day: 115 });
  });

  it('다른 계정으로 들어오면 앞 사람 설정을 기본값으로 비운다 (새 계정에 올리지 않게)', () => {
    startPrefsSync('u1');
    useLayoutPrefs.setState({ fontSizes: { day: 115 } });
    useCommonSettings.setState({ forwardDays: 30 });
    startPrefsSync('u1');
    expect(useLayoutPrefs.getState().fontSizes).toEqual({ day: 115 });
    startPrefsSync('u2');
    expect(useLayoutPrefs.getState().fontSizes).toEqual({});
    expect(useCommonSettings.getState().forwardDays).toBe(14);
  });
});

describe('새 사용자 처음 설정 (P33-3)', () => {
  it('두 문서 모두 문서가 없을 때 깔 값을 받는다 - 한 번 읽어 함께 · 계정 문서 쪽이 이 기기 값도', async () => {
    const { useBoardPrefs } = await import('./boardPrefs');
    useBoardPrefs.setState({ main: null, day: 50, memo: null });
    initial.reads = 0;
    initial.doc = { common: { forwardDays: 21 }, at: 5, pc: { prefs: { popupStyle: 'center' }, local: { boardMain: 30, boardDay: 40 }, at: 5 } };
    startPrefsSync('u1');
    expect(await binding('common').seed?.()).toEqual({ forwardDays: 21 });
    expect(await binding('pc').seed?.()).toEqual({ popupStyle: 'center' });
    expect(initial.reads).toBe(1);
    expect(useBoardPrefs.getState().main).toBeNull();
    binding('common').seeded?.();
    expect(useBoardPrefs.getState()).toMatchObject({ main: 30, day: 50 });
  });

  it('처음 설정이 없으면 null (지금처럼 이 기기 값만)', async () => {
    initial.doc = null;
    startPrefsSync('u1');
    expect(await binding('common').seed?.()).toBeNull();
    expect(await binding('pc').seed?.()).toBeNull();
  });
});
