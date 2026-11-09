import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import { resetHistoryForTest } from '../../app/history';
import { setPopupStyle, useLayoutPrefs } from '../../app/layoutPrefs';
import { useNav } from '../../app/nav';
import { useCommonSettings } from '../../app/prefs';
import { handleAppKeyDown, setShortcutOverrides, setTabShortcuts, useShortcutOverrides } from '../../app/keys';
import { anyWindowUnsaved } from '../../app/windows';
import { overridesFromBindings, resolveBindings } from '../../domain/shortcuts';
import { useMirror } from '../../data/mirror/store';
import { useSession } from '../../data/session';
import SettingsWindow from './SettingsWindow';
import { cancelShortcutRecord, useShortcutRecord } from '../../app/shortcutRecord';

// 진짜 Firebase 앱을 띄우지 않는다 - 띄우면 시험이 끝난 뒤 Firebase가 IndexedDB를 열다 jsdom이 걷혀 '처리하지 않은 오류'가 가끔 남는다(PLAN 5장 'P3-1 테스트와 Firebase')
vi.mock('../../data/firebase', () => ({ auth: {}, db: {}, googleProvider: {} }));

// '이 기기 사본 다시 받기'는 Firebase를 부른다 - 창 시험에서는 흉내만
const resetMirror = vi.hoisted(() => vi.fn(() => Promise.resolve()));
vi.mock('../../data/mirror/sync', () => ({ resetMirror }));

// 개발자 탭 '오류 기록'은 서버를 읽는다 - 창 시험에서는 빈 목록 (칸은 DevErrorsSection.test)
vi.mock('../../data/errorReport', () => ({ loadErrorReports: vi.fn(async () => []), deleteErrorReports: vi.fn() }));
// '공휴일'도 서버를 읽는다 - 빈 표 (칸은 DevHolidaysSection.test)
vi.mock('../../data/govHolidays', () => ({
  loadGovApiKey: vi.fn(async () => ''),
  loadHolidayYearStatus: vi.fn(async (year: number) => ({ year, count: 0, updatedAt: 0, updatedBy: '' })),
  fetchGovHolidays: vi.fn(),
  saveGovApiKey: vi.fn(),
  saveSharedHolidays: vi.fn(),
}));

const q = (s: string) => document.querySelector<HTMLElement>(s)!;
const qa = (s: string) => [...document.querySelectorAll<HTMLElement>(s)];

beforeEach(() => {
  resetHistoryForTest();
  // 가운데 창으로 그린다 (오른쪽 줄 없이)
  setPopupStyle('center');
  useLayoutPrefs.setState({ fontScale: 'md' });
  useNav.setState({ showWeekend: true, startupScope: 'last' });
  setShortcutOverrides({});
  setTabShortcuts({});
});

const openSettings = (tab?: 'view' | 'school' | 'shortcuts' | 'app' | 'dev') => render(<SettingsWindow params={tab ? { tab } : undefined} close={vi.fn()} raise={0} setParams={vi.fn()} />);

describe('환경설정 창', () => {
  it('지금 있는 탭만 (보기·알림·학교·단축키·앱 - 가져오기는 백업 창으로) - 아직 옮기지 않은 기능의 탭은 숨긴다', () => {
    openSettings();
    expect(qa('[data-settings-tab]').map((b) => b.dataset.settingsTab)).toEqual(['view', 'notify', 'school', 'shortcuts', 'app']);
    expect(q('[data-settings-tab="view"]')).toHaveAttribute('aria-selected', 'true');
  });

  it('개발자 탭은 개발자 계정에만 (일반 계정은 개발자 탭으로 열어도 보기 탭)', () => {
    useSession.setState({ loading: false, user: { uid: 'u1', email: 'teacher@example.com', displayName: '', photoURL: '' } });
    const plain = openSettings('dev');
    expect(document.querySelector('[data-settings-tab="dev"]')).toBeNull();
    expect(document.querySelector('[data-settings-panel="dev"]')).toBeNull();
    expect(q('[data-settings-tab="view"]')).toHaveAttribute('aria-selected', 'true');
    plain.unmount();

    useSession.setState({ loading: false, user: { uid: 'u2', email: 'HyunDongLim80@gmail.com', displayName: '', photoURL: '' } });
    openSettings('dev');
    expect(qa('[data-settings-tab]').map((b) => b.dataset.settingsTab)).toEqual(['view', 'notify', 'school', 'shortcuts', 'app', 'dev']);
    expect(q('[data-settings-panel="dev"]')).toBeVisible();
    expect(q('[data-dev-tab] [data-settings-section="dev-errors"]')).toBeInTheDocument();
    expect(q('[data-dev-tab] [data-settings-section="dev-holidays"]')).toBeInTheDocument();
    useSession.setState({ loading: true, user: null });
  });

  it('학교: 이월 기간 - 1~60일, 적는 즉시 계정 설정에 (칸을 떠나면 범위로 맞춘다)', () => {
    useCommonSettings.setState({ forwardDays: 14 });
    openSettings('school');
    const input = q('[data-forward-days]') as HTMLInputElement;
    expect(input.value).toBe('14');
    fireEvent.change(input, { target: { value: '30' } });
    expect(useCommonSettings.getState().forwardDays).toBe(30);
    // 지우고 새로 적는 동안은 바꾸지 않는다
    fireEvent.change(input, { target: { value: '' } });
    expect(useCommonSettings.getState().forwardDays).toBe(30);
    fireEvent.change(input, { target: { value: '99' } });
    expect(useCommonSettings.getState().forwardDays).toBe(30);
    fireEvent.blur(input);
    expect(useCommonSettings.getState().forwardDays).toBe(60);
    expect(input.value).toBe('60');
    useCommonSettings.setState({ forwardDays: 14 });
  });

  it('열 때 탭을 고를 수 있다', () => {
    openSettings('shortcuts');
    expect(q('[data-settings-panel="shortcuts"]')).toBeVisible();
    expect(q('[data-settings-panel="view"]')).not.toBeVisible();
  });

  it('열려 있는 창을 다른 탭으로 다시 열면 그 탭으로', () => {
    const { rerender } = openSettings('view');
    rerender(<SettingsWindow params={{ tab: 'app' }} close={vi.fn()} raise={0} setParams={vi.fn()} />);
    expect(q('[data-settings-panel="app"]')).toBeVisible();
    expect(q('[data-settings-tab="app"]')).toHaveAttribute('aria-selected', 'true');
  });

  it('같은 탭으로 다시 열어도 그새 다른 탭을 눌렀으면 그 탭으로 (창 안 탭 단축키 P18-2 - 열 때마다 새 params)', () => {
    const { rerender } = render(<SettingsWindow params={{ tab: 'notify' }} close={vi.fn()} raise={0} setParams={vi.fn()} />);
    fireEvent.click(q('[data-settings-tab="view"]'));
    expect(q('[data-settings-panel="view"]')).toBeVisible();
    rerender(<SettingsWindow params={{ tab: 'notify' }} close={vi.fn()} raise={1} setParams={vi.fn()} />);
    expect(q('[data-settings-panel="notify"]')).toBeVisible();
  });

  it('보기: 누르는 즉시 바뀐다 (저장 단추가 없다)', () => {
    openSettings();
    fireEvent.click(q('[data-settings-toggle="showWeekend"]'));
    expect(useNav.getState().showWeekend).toBe(false);
    fireEvent.click(q('[data-choice="fontScale:lg"]'));
    expect(useLayoutPrefs.getState().fontScale).toBe('lg');
    expect(document.documentElement.style.getPropertyValue('--font-scale')).toBe('1.15');
    fireEvent.click(q('[data-choice="startupScope:memo"]'));
    expect(useNav.getState().startupScope).toBe('memo');
    expect(document.querySelector('[data-shortcut-save]')).toBeNull();
  });

  it('보기 🎨 색 테마(P20-1): 견본 칩을 누르면 계정 값이 바뀌고 그 칩이 눌린 것', () => {
    useCommonSettings.setState({ palette: 'default' });
    openSettings();
    expect(q('[data-palette-pick="default"]').getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(q('[data-palette-pick="forest"]'));
    expect(useCommonSettings.getState().palette).toBe('forest');
    expect(q('[data-palette-pick="forest"]').getAttribute('aria-pressed')).toBe('true');
    expect(q('[data-palette-pick="default"]').getAttribute('aria-pressed')).toBe('false');
    act(() => useCommonSettings.setState({ palette: 'default' }));
  });

  it('보기 쉽게(P20-2): 고대비·어둡게를 부드럽게는 이 기기, 색약 배려는 계정 값', () => {
    useCommonSettings.setState({ cvd: false });
    localStorage.removeItem('sp5_contrast');
    localStorage.removeItem('sp5_dim');
    openSettings();
    const box = (id: string) => q(`[data-settings-toggle="${id}"]`) as HTMLInputElement;
    expect(box('contrast').checked).toBe(false);
    fireEvent.click(box('contrast'));
    expect(localStorage.getItem('sp5_contrast')).toBe('1');
    expect(box('contrast').checked).toBe(true);
    fireEvent.click(box('dim'));
    expect(localStorage.getItem('sp5_dim')).toBe('1');
    fireEvent.click(box('cvd'));
    expect(useCommonSettings.getState().cvd).toBe(true);
    expect(box('cvd').checked).toBe(true);
    act(() => useCommonSettings.setState({ cvd: false }));
    localStorage.removeItem('sp5_contrast');
    localStorage.removeItem('sp5_dim');
    document.documentElement.classList.remove('hc', 'dim');
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

  it('⌨️ 단축키 설정 (P18-1) = 창을 닫고 눌러서 고르기 시작 · 고치던 것은 먼저 묻고 저장', () => {
    const close = vi.fn();
    render(<SettingsWindow params={{ tab: 'shortcuts' }} close={close} raise={0} setParams={vi.fn()} />);
    fireEvent.keyDown(q('[data-shortcut-row="help"] [data-shortcut-key]'), { key: 'h', code: 'KeyH', ctrlKey: true, altKey: true });
    const ask = vi.spyOn(window, 'confirm').mockReturnValueOnce(false);
    fireEvent.click(q('[data-shortcut-record-start]'));
    expect(close).not.toHaveBeenCalled();
    expect(useShortcutRecord.getState().stage).toBe('off');
    ask.mockReturnValueOnce(true);
    fireEvent.click(q('[data-shortcut-record-start]'));
    expect(useShortcutOverrides.getState().overrides).toHaveProperty('help');
    expect(close).toHaveBeenCalled();
    expect(useShortcutRecord.getState().stage).toBe('pick');
    ask.mockRestore();
    act(() => cancelShortcutRecord());
  });

  it('눌러서 정한 뒤 열면(focus) 그 줄을 짚는다', () => {
    render(<SettingsWindow params={{ tab: 'shortcuts', focus: 'timetable' }} close={vi.fn()} raise={0} setParams={vi.fn()} />);
    expect(q('[data-shortcut-row="timetable"]')).toHaveAttribute('data-shortcut-row-focus');
    expect(q('[data-shortcut-row="timetable"]')).toHaveClass('search-focus');
    expect(q('[data-shortcut-row="help"]')).not.toHaveAttribute('data-shortcut-row-focus');
  });

  it("내가 만든 단축키 (P18-2): 키를 준 탭만 · 없으면 '아직 없습니다' · 눌러서 정한 뒤 열면 그 줄", () => {
    const first = openSettings('shortcuts');
    expect(q('[data-shortcut-tabs-empty]')).toBeInTheDocument();
    first.unmount();
    setTabShortcuts({ 'settings:notify': { ctrl: true, alt: true, shift: false, key: 'N' } });
    render(<SettingsWindow params={{ tab: 'shortcuts', focus: 'settings:notify' }} close={vi.fn()} raise={0} setParams={vi.fn()} />);
    expect(qa('[data-shortcut-tabs] [data-shortcut-row]').map((r) => r.dataset.shortcutRow)).toEqual(['settings:notify']);
    expect(q('[data-shortcut-row="settings:notify"]')).toHaveTextContent('환경설정 → 알림');
    expect(q('[data-shortcut-row="settings:notify"] [data-shortcut-key]')).toHaveValue('N');
    expect(q('[data-shortcut-row="settings:notify"]')).toHaveAttribute('data-shortcut-row-focus');
  });

  it('내가 만든 단축키: 키를 바꿔 저장 · 기능과 겹치면 막는다 · 비우고 저장하면 빠진다', () => {
    setTabShortcuts({ 'settings:notify': { ctrl: true, alt: true, shift: false, key: 'N' } });
    openSettings('shortcuts');
    const input = () => q('[data-shortcut-row="settings:notify"] [data-shortcut-key]');
    fireEvent.keyDown(input(), { key: 'f', code: 'KeyF', ctrlKey: true });
    expect(q('[data-shortcut-row="search"]')).toHaveAttribute('data-conflict');
    fireEvent.click(q('[data-shortcut-save]'));
    expect(useShortcutOverrides.getState().tabs['settings:notify']?.key).toBe('N');
    fireEvent.keyDown(input(), { key: 'm', code: 'KeyM', ctrlKey: true, altKey: true });
    expect(anyWindowUnsaved()).toBe(true);
    fireEvent.click(q('[data-shortcut-save]'));
    expect(useShortcutOverrides.getState().tabs).toEqual({ 'settings:notify': { ctrl: true, alt: true, shift: false, key: 'M' } });
    // 비우면 줄은 남아 있다가 저장하면 빠진다
    fireEvent.keyDown(input(), { key: 'Backspace', code: 'Backspace' });
    expect(input()).toHaveValue('');
    fireEvent.click(q('[data-shortcut-save]'));
    expect(useShortcutOverrides.getState().tabs).toEqual({});
    expect(document.querySelector('[data-shortcut-row="settings:notify"]')).toBeNull();
    expect(q('[data-shortcut-tabs-empty]')).toBeInTheDocument();
  });

  it('기본값으로 → 저장하면 창 안 탭 키도 빠진다 · 다른 기기에서 더한 탭도 따라온다', () => {
    openSettings('shortcuts');
    act(() => setTabShortcuts({ 'backup:import': { ctrl: false, alt: true, shift: false, key: 'I' } }));
    expect(q('[data-shortcut-row="backup:import"] [data-shortcut-key]')).toHaveValue('I');
    fireEvent.click(q('[data-shortcut-reset]'));
    fireEvent.click(q('[data-shortcut-save]'));
    expect(useShortcutOverrides.getState().tabs).toEqual({});
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
