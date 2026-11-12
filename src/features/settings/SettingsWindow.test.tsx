import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import { resetHistoryForTest } from '../../app/history';
import { setPopupStyle, useLayoutPrefs } from '../../app/layoutPrefs';
import { useNav } from '../../app/nav';
import { useCommonSettings } from '../../app/prefs';
import { handleAppKeyDown, setCustomShortcuts, setShortcutOverrides, setTabShortcuts, useShortcutOverrides } from '../../app/keys';
import { anyWindowUnsaved, getWindowDef, openWindow, registerWindow, useWindows } from '../../app/windows';
import { overridesFromBindings, resolveBindings, SHORTCUT_ACTIONS } from '../../domain/shortcuts';
import { useMirror } from '../../data/mirror/store';
import { useSession } from '../../data/session';
import SettingsWindow from './SettingsWindow';
import { NO_BUTTON } from './ShortcutsTab';
import { cancelShortcutRecord, onRecordClick, startShortcutRecord, useShortcutRecord } from '../../app/shortcutRecord';

// 진짜 Firebase 앱을 띄우지 않는다 - 띄우면 시험이 끝난 뒤 Firebase가 IndexedDB를 열다 jsdom이 걷혀 '처리하지 않은 오류'가 가끔 남는다(PLAN 5장 'P3-1 테스트와 Firebase')
vi.mock('../../data/firebase', () => ({ auth: {}, db: {}, googleProvider: {} }));

// '이 기기 사본 다시 받기'는 Firebase를 부른다 - 창 시험에서는 흉내만
const resetMirror = vi.hoisted(() => vi.fn(() => Promise.resolve()));
vi.mock('../../data/mirror/sync', () => ({ resetMirror }));

// 관리자 탭 '오류 기록'은 서버를 읽는다 - 창 시험에서는 빈 목록 (칸은 DevErrorsSection.test)
vi.mock('../../data/errorReport', () => ({ loadErrorReports: vi.fn(async () => []), deleteErrorReports: vi.fn() }));
// 관리자 계정 목록도 서버를 읽는다 - 더한 관리자 없음 (관리자인가는 data/admins.test)
vi.mock('../../data/admins', async (orig) => ({ ...(await orig<typeof import('../../data/admins')>()), loadAdmins: vi.fn(async () => []) }));
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
  useLayoutPrefs.setState({ fontSizes: {} });
  useNav.setState({ scope: 'day', showWeekend: true, startupScope: 'last' });
  setShortcutOverrides({});
  setTabShortcuts({});
  setCustomShortcuts({});
  // 앞 시험의 안내(되돌리기 단추)를 걷는다
  document.getElementById('sp5-toast-container')?.remove();
});

const openSettings = (tab?: 'view' | 'school' | 'shortcuts' | 'app' | 'dev') => render(<SettingsWindow params={tab ? { tab } : undefined} close={vi.fn()} raise={0} setParams={vi.fn()} />);

describe('환경설정 창', () => {
  it('지금 있는 탭만 (보기·알림·학교·단축키·앱 - 가져오기는 백업 창으로) - 아직 옮기지 않은 기능의 탭은 숨긴다', () => {
    openSettings();
    expect(qa('[data-settings-tab]').map((b) => b.dataset.settingsTab)).toEqual(['view', 'notify', 'school', 'shortcuts', 'app']);
    expect(q('[data-settings-tab="view"]')).toHaveAttribute('aria-selected', 'true');
  });

  it('관리자 탭(P33-1 - 옛 개발자 탭)은 관리자 계정에만 (일반 계정은 관리자 탭으로 열어도 보기 탭)', () => {
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
    expect(q('[data-settings-tab="dev"]')).toHaveTextContent('관리자');
    // 관리자 계정 절 - 기본 셋은 🔒(빼기 단추 없음)
    expect(qa('[data-admins-section] [data-admin-base]')).toHaveLength(3);
    expect(document.querySelector('[data-admins-section] [data-admin-base] [data-admin-remove]')).toBeNull();
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
    fireEvent.click(q('[data-font-step="day:up"]'));
    expect(useLayoutPrefs.getState().fontSizes).toEqual({ day: 105 });
    expect(document.documentElement.style.getPropertyValue('--font-scale')).toBe('1.05');
    fireEvent.click(q('[data-choice="startupScope:memo"]'));
    expect(useNav.getState().startupScope).toBe('memo');
    expect(document.querySelector('[data-shortcut-save]')).toBeNull();
    fireEvent.click(q('[data-font-step="day:reset"]'));
    expect(document.documentElement.style.getPropertyValue('--font-scale')).toBe('');
  });

  it('글자 크기 (메모 요청 #145): 화면마다 한 줄 · − / 초기화 / + 는 5%씩 쌓이고 그 화면만 · 지금 화면 줄이 단축키와 같다', () => {
    openSettings('view');
    // 화면 일곱 + 팝업창(PC)
    expect(qa('[data-font-page]').map((el) => el.dataset.fontPage)).toEqual(['board', 'day', 'week', 'month', 'year', 'memo', 'class', 'popout']);
    expect(q('[data-font-current]').dataset.fontPage).toBe('day');
    expect(q('[data-font-percent="day"]')).toHaveTextContent('100%');
    // 누를 때마다 쌓인다
    for (let i = 0; i < 3; i++) fireEvent.click(q('[data-font-step="day:down"]'));
    expect(q('[data-font-percent="day"]')).toHaveTextContent('85%');
    expect(document.documentElement.style.getPropertyValue('--font-scale')).toBe('0.85');
    // 다른 화면 줄은 그 화면만 - 지금 화면의 크기는 그대로
    fireEvent.click(q('[data-font-step="month:up"]'));
    expect(useLayoutPrefs.getState().fontSizes).toEqual({ day: 85, month: 105 });
    expect(document.documentElement.style.getPropertyValue('--font-scale')).toBe('0.85');
    // 지금 화면 줄 단추만 단축키 표시
    expect(q('[data-font-step="day:down"]')).toHaveAttribute('data-shortcut-target', 'fontSmaller');
    expect(q('[data-font-step="day:reset"]')).toHaveAttribute('data-shortcut-target', 'fontReset');
    expect(q('[data-font-step="day:up"]')).toHaveAttribute('data-shortcut-target', 'fontLarger');
    expect(q('[data-font-step="month:up"]')).not.toHaveAttribute('data-shortcut-target');
    // 화면을 옮기면 그 화면이 기억한 크기로, 지금 화면 줄도 따라간다
    act(() => useNav.setState({ scope: 'month' }));
    expect(document.documentElement.style.getPropertyValue('--font-scale')).toBe('1.05');
    expect(q('[data-font-current]').dataset.fontPage).toBe('month');
    fireEvent.click(q('[data-font-step="month:reset"]'));
    expect(useLayoutPrefs.getState().fontSizes).toEqual({ day: 85 });
    expect(document.documentElement.style.getPropertyValue('--font-scale')).toBe('');
    act(() => useNav.setState({ scope: 'day' }));
    expect(document.documentElement.style.getPropertyValue('--font-scale')).toBe('0.85');
    fireEvent.click(q('[data-font-step="day:reset"]'));
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

  // ── 단축키 탭 (P28-1 - 키가 걸린 것만, 줄마다 키 바꾸기·해제, 누르는 즉시 저장) ──
  const NONE = { ctrl: false, alt: false, shift: false, key: '' };
  const rowIds = () => qa('[data-shortcut-row]').map((r) => r.dataset.shortcutRow);
  const keyText = (id: string) => q(`[data-shortcut-row="${id}"] [data-shortcut-key]`).textContent;

  it('단축키 탭 = 키가 걸린 것만 (기본 키 + 바꾼 것) · 키 칸·저장 단추 없음', () => {
    setShortcutOverrides({ help: { ctrl: true, alt: true, shift: false, key: 'H' } });
    openSettings('shortcuts');
    expect(rowIds()).toContain('scopeDay');
    expect(rowIds()).toContain('help');
    // 기본값이 비어 있는 기능(시간표 등)은 줄이 없다 - 더하기는 '⌨️ 단축키 설정'으로만
    expect(rowIds()).not.toContain('timetable');
    // 키가 있는 것만 (11-12 사용자 - 누를 단추가 없는 기능도 키가 없으면 줄이 없다)
    expect(rowIds()).toHaveLength(SHORTCUT_ACTIONS.filter((a) => !a.fixed && a.def.key).length + 1);
    expect(qa('[data-shortcut-key]').every((k) => k.textContent !== '없음')).toBe(true);
    expect(keyText('scopeDay')).toBe('1'); // #149 - 전에는 Shift + 1
    expect(keyText('toggleWeekend')).toBe('Shift + ↑ / ↓');
    expect(q('[data-shortcut-row="scopeDay"] [data-shortcut-default]')).toBeInTheDocument();
    expect(document.querySelector('[data-shortcut-row="help"] [data-shortcut-default]')).toBeNull();
    expect(document.querySelector('[data-shortcut-row] input')).toBeNull();
    expect(document.querySelector('[data-shortcut-save]')).toBeNull();
    expect(anyWindowUnsaved()).toBe(false);
  });

  it('해제 = 바로 저장(그 줄이 빠진다) + 안내의 되돌리기', () => {
    openSettings('shortcuts');
    fireEvent.click(q('[data-shortcut-clear="scopeMemo"]'));
    expect(useShortcutOverrides.getState().overrides).toEqual({ scopeMemo: NONE });
    expect(rowIds()).not.toContain('scopeMemo');
    expect(q('[data-toast]').textContent).toContain("'메모 화면' 단축키(5)를 해제했습니다");
    act(() => fireEvent.click(q('[data-toast-action="되돌리기"]')));
    expect(useShortcutOverrides.getState().overrides).toEqual({});
    expect(rowIds()).toContain('scopeMemo');
  });

  it('누를 단추가 없는 기능은 키가 없으면 줄이 없고 고르기 칸에서 키를 건다 (해제해도 다시 걸 수 있게)', () => {
    openSettings('shortcuts');
    const options = () => qa('[data-shortcut-nobutton] option').map((o) => (o as HTMLOptionElement).value).filter(Boolean);
    expect(rowIds()).not.toContain('recurring');
    expect(options()).toContain('recurring');
    expect(options()).not.toContain('checklist'); // 기본 키(Ctrl + L)가 있다
    fireEvent.click(q('[data-shortcut-clear="checklist"]'));
    expect(rowIds()).not.toContain('checklist');
    expect(options()).toContain('checklist');
    fireEvent.change(q('[data-shortcut-nobutton]'), { target: { value: 'checklist' } });
    expect(useShortcutRecord.getState()).toMatchObject({ stage: 'key', picked: 'checklist' });
    act(() => cancelShortcutRecord());
  });

  it('고정 단축키(#149 - 검색·인쇄·되돌리기)는 줄이 없고 맨 아래 고정 묶음에 · 예전에 바꿔 둔 키는 보지 않는다', () => {
    setShortcutOverrides({ search: { ctrl: true, alt: true, shift: false, key: 'K' } });
    openSettings('shortcuts');
    for (const id of ['search', 'print', 'undo']) {
      expect(rowIds()).not.toContain(id);
      expect(document.querySelector(`[data-shortcut-change="${id}"]`)).toBeNull();
    }
    const fixed = qa('[data-shortcut-fixed]').map((r) => r.dataset.shortcutFixed);
    expect(fixed).toEqual(['ESC', 'Ctrl + S', 'search', 'print', 'undo']);
    expect(q('[data-shortcut-fixed="search"] kbd')).toHaveTextContent('Ctrl + F');
    expect(q('[data-shortcut-fixed="print"] kbd')).toHaveTextContent('Ctrl + P');
    expect(q('[data-shortcut-fixed="undo"] kbd')).toHaveTextContent('Ctrl + Z');
  });

  it('키 바꾸기 = 띠의 키 단계로 곧바로 (환경설정 창은 그대로)', () => {
    const close = vi.fn();
    render(<SettingsWindow params={{ tab: 'shortcuts' }} close={close} raise={0} setParams={vi.fn()} />);
    fireEvent.click(q('[data-shortcut-change="scopeDay"]'));
    expect(useShortcutRecord.getState()).toMatchObject({ stage: 'key', picked: 'scopeDay', binding: null });
    expect(close).not.toHaveBeenCalled();
    act(() => cancelShortcutRecord());
  });

  it('⌨️ 단축키 설정 (P18-1) = 창을 닫고 눌러서 고르기 시작 (고치던 것이 없어 묻지 않는다)', () => {
    const close = vi.fn();
    const ask = vi.spyOn(window, 'confirm');
    render(<SettingsWindow params={{ tab: 'shortcuts' }} close={close} raise={0} setParams={vi.fn()} />);
    fireEvent.click(q('[data-shortcut-record-start]'));
    expect(close).toHaveBeenCalled();
    expect(useShortcutRecord.getState().stage).toBe('pick');
    expect(ask).not.toHaveBeenCalled();
    ask.mockRestore();
    act(() => cancelShortcutRecord());
  });

  it('기본값으로 = 묻고 바로 (창 안 탭 키도 빠진다) + 되돌리기', () => {
    setShortcutOverrides({ help: { ctrl: true, alt: true, shift: false, key: 'H' } });
    setTabShortcuts({ 'backup:import': { ctrl: false, alt: true, shift: false, key: 'I' } });
    openSettings('shortcuts');
    const ask = vi.spyOn(window, 'confirm').mockReturnValueOnce(false);
    fireEvent.click(q('[data-shortcut-reset]'));
    expect(useShortcutOverrides.getState().overrides).toHaveProperty('help');
    ask.mockReturnValueOnce(true);
    fireEvent.click(q('[data-shortcut-reset]'));
    expect(useShortcutOverrides.getState()).toMatchObject({ overrides: {}, tabs: {} });
    expect(rowIds()).not.toContain('help');
    act(() => fireEvent.click(q('[data-toast-action="되돌리기"]')));
    expect(useShortcutOverrides.getState().tabs).toHaveProperty('backup:import');
    ask.mockRestore();
  });

  it('눌러서 정한 뒤 열면(focus) 그 줄을 짚는다', () => {
    setShortcutOverrides({ timetable: { ctrl: true, alt: true, shift: false, key: 'T' } });
    render(<SettingsWindow params={{ tab: 'shortcuts', focus: 'timetable' }} close={vi.fn()} raise={0} setParams={vi.fn()} />);
    expect(q('[data-shortcut-row="timetable"]')).toHaveAttribute('data-shortcut-row-focus');
    expect(q('[data-shortcut-row="timetable"]')).toHaveClass('search-focus');
    expect(q('[data-shortcut-row="scopeDay"]')).not.toHaveAttribute('data-shortcut-row-focus');
  });

  it("내가 만든 단축키(창 안 탭 - P18-2)는 기능 뒤 한 묶음 · 해제하면 빠진다", () => {
    setTabShortcuts({ 'settings:notify': { ctrl: true, alt: true, shift: false, key: 'N' } });
    render(<SettingsWindow params={{ tab: 'shortcuts', focus: 'settings:notify' }} close={vi.fn()} raise={0} setParams={vi.fn()} />);
    const groups = qa('[data-shortcut-group]').map((g) => g.dataset.shortcutGroup);
    expect(groups.at(-1)).toBe('창 안 탭');
    expect(qa('[data-shortcut-group="창 안 탭"] [data-shortcut-row]').map((r) => r.dataset.shortcutRow)).toEqual(['settings:notify']);
    expect(q('[data-shortcut-row="settings:notify"]')).toHaveTextContent('환경설정 → 알림');
    expect(keyText('settings:notify')).toBe('Ctrl + Alt + N');
    expect(q('[data-shortcut-row="settings:notify"]')).toHaveAttribute('data-shortcut-row-focus');
    fireEvent.click(q('[data-shortcut-clear="settings:notify"]'));
    expect(useShortcutOverrides.getState().tabs).toEqual({});
    expect(document.querySelector('[data-shortcut-group="창 안 탭"]')).toBeNull();
  });

  it('환경설정 값 단추에 단축키 설정 표시 (P28-2) - 값마다 opt.<이름>.<값> · 켜기/끄기 줄 · 주말·일정·수업은 둘째 줄 단축키 · 키가 있으면 툴팁', () => {
    setCustomShortcuts({ 'opt.popupStyle.popup': { ctrl: false, alt: true, shift: false, key: 'P' } });
    openSettings('view');
    expect(q('[data-choice="popupStyle:popup"]')).toHaveAttribute('data-shortcut-target', 'opt.popupStyle.popup');
    expect(q('[data-choice="popupStyle:popup"]')).toHaveAttribute('title', '단축키: Alt + P');
    expect(q('[data-choice="popupStyle:side"]')).toHaveAttribute('data-shortcut-target', 'opt.popupStyle.side');
    expect(q('[data-choice="popupStyle:side"]')).not.toHaveAttribute('title');
    expect(q('[data-choice="theme:light"]')).toHaveAttribute('data-shortcut-target', 'opt.theme.light');
    expect(q('[data-choice="startupScope:week"]')).toHaveAttribute('data-shortcut-target', 'opt.startupScope.week');
    expect(q('[data-palette-pick="default"]')).toHaveAttribute('data-shortcut-target', 'opt.palette.default');
    expect(q('[data-decor-pick="animal"]')).toHaveAttribute('data-shortcut-target', 'opt.decor.animal');
    expect(q('[data-settings-toggle="contrast"]').closest('label')).toHaveAttribute('data-shortcut-target', 'opt.contrast');
    expect(q('[data-settings-toggle="enableScrollNav"]').closest('label')).toHaveAttribute('data-shortcut-target', 'opt.enableScrollNav');
    expect(q('[data-settings-toggle="showWeekend"]').closest('label')).toHaveAttribute('data-shortcut-target', 'toggleWeekend');
  });

  it('눌러서 고르기 (P28-2): 값 단추·켜기/끄기 줄을 누르면 그것을 고른다(값도 평소처럼 바뀐다)', () => {
    openSettings('view');
    document.addEventListener('click', onRecordClick, true);
    try {
      startShortcutRecord();
      fireEvent.click(q('[data-choice="startupScope:week"]'));
      expect(useShortcutRecord.getState()).toMatchObject({ stage: 'pick', picked: 'opt.startupScope.week', miss: null });
      expect(useNav.getState().startupScope).toBe('week');
      // 글자 크기 − 단추(지금 화면 줄)는 단축키 '글자 작게'를 고른다 - 값도 평소처럼 바뀐다 (메모 요청 #145)
      fireEvent.click(q('[data-font-step="day:down"]'));
      expect(useShortcutRecord.getState()).toMatchObject({ stage: 'pick', picked: 'fontSmaller', miss: null });
      expect(useLayoutPrefs.getState().fontSizes).toEqual({ day: 95 });
      fireEvent.click(q('[data-settings-toggle="dim"]'));
      expect(useShortcutRecord.getState().picked).toBe('opt.dim');
      fireEvent.click(q('[data-settings-toggle="showClass"]'));
      expect(useShortcutRecord.getState().picked).toBe('toggleClass');
    } finally {
      document.removeEventListener('click', onRecordClick, true);
      cancelShortcutRecord();
    }
  });

  it('고르는 동안 창은 팝업창이 아니라 이 창 안에 (P28-2 - 팝업창 안을 누른 것은 띠가 못 본다), 끝나면 팝업창', () => {
    useWindows.setState({ windows: [] });
    if (!getWindowDef('p28probe')) registerWindow({ id: 'p28probe', title: '시험', icon: '🧪', kind: 'side', dev: true, load: () => import('../dev/TestWindow') });
    // 팝업창은 방금 누른 때만 연다(navigator.userActivation) - 누른 것으로
    const had = Object.getOwnPropertyDescriptor(navigator, 'userActivation');
    Object.defineProperty(navigator, 'userActivation', { value: { isActive: true }, configurable: true });
    // 막힌 것으로(null) - 안내 뒤 이 창 안에 뜬다. 여기서는 열어 보려 했는지만 본다
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    try {
      setPopupStyle('popup');
      startShortcutRecord();
      openWindow('p28probe');
      expect(open).not.toHaveBeenCalled();
      expect(useWindows.getState().windows.map((w) => w.id)).toEqual(['p28probe']);
      cancelShortcutRecord();
      openWindow('p28probe', { again: 1 });
      expect(open).toHaveBeenCalledTimes(1);
    } finally {
      open.mockRestore();
      if (had) Object.defineProperty(navigator, 'userActivation', had);
      else delete (navigator as { userActivation?: unknown }).userActivation;
      useWindows.setState({ windows: [] });
    }
  });

  it('내가 만든 단축키(환경설정 값 - P28-2)는 창 안 탭 뒤 한 묶음 · 이름 = 제목 → 값 · 해제하면 빠진다', () => {
    setCustomShortcuts({ 'opt.popupStyle.popup': { ctrl: false, alt: true, shift: false, key: 'P' }, 'opt.contrast': { ctrl: false, alt: true, shift: false, key: 'H' } });
    openSettings('shortcuts');
    expect(qa('[data-shortcut-group]').map((g) => g.dataset.shortcutGroup).at(-1)).toBe('환경설정 값');
    expect(q('[data-shortcut-group="환경설정 값"] h3')).toHaveTextContent('내가 만든 단축키 (환경설정 값)');
    expect(q('[data-shortcut-row="opt.popupStyle.popup"]')).toHaveTextContent('창 위치 → 팝업창');
    expect(q('[data-shortcut-row="opt.contrast"]')).toHaveTextContent('고대비 켜기 / 끄기');
    expect(keyText('opt.popupStyle.popup')).toBe('Alt + P');
    fireEvent.click(q('[data-shortcut-clear="opt.popupStyle.popup"]'));
    expect(useShortcutOverrides.getState().custom).toEqual({ 'opt.contrast': { ctrl: false, alt: true, shift: false, key: 'H' } });
    fireEvent.click(q('[data-shortcut-clear="opt.contrast"]'));
    expect(document.querySelector('[data-shortcut-group="환경설정 값"]')).toBeNull();
  });

  it('겹친 키(옛 자료)는 두 줄 모두 ⚠ · 키가 하나도 없으면 줄 없이 안내 + 고르기 칸에 단추 없는 기능', () => {
    // 하루 화면(1 - #149)과 같은 키를 주간 화면에 - 눌러서 정하면 생기지 않는다(겹친 쪽에서 뺀다)
    setShortcutOverrides({ scopeWeek: { ctrl: false, alt: false, shift: false, key: '1' } });
    const first = openSettings('shortcuts');
    expect(q('[data-shortcut-row="scopeDay"]')).toHaveAttribute('data-conflict');
    expect(q('[data-shortcut-row="scopeWeek"]')).toHaveAttribute('data-conflict');
    first.unmount();
    // 키를 모두 비우면 줄이 없고, 누를 단추가 없는 기능은 모두 고르기 칸에
    setShortcutOverrides(Object.fromEntries(SHORTCUT_ACTIONS.map((a) => [a.id, NONE])));
    openSettings('shortcuts');
    expect(rowIds()).toEqual([]);
    expect(q('[data-shortcut-empty]')).toBeInTheDocument();
    const options = qa('[data-shortcut-nobutton] option').map((o) => (o as HTMLOptionElement).value).filter(Boolean);
    expect(new Set(options)).toEqual(new Set(NO_BUTTON));
  });

  it('다른 기기에서 키가 바뀌면 따라간다', () => {
    openSettings('shortcuts');
    act(() => setShortcutOverrides({ help: { ctrl: true, alt: true, shift: false, key: 'Q' } }));
    expect(keyText('help')).toBe('Ctrl + Alt + Q');
  });

  it('창 밖 Ctrl 단축키는 그대로 돈다 (창이 열려 있어도)', () => {
    openSettings();
    handleAppKeyDown(new KeyboardEvent('keydown', { key: '3', code: 'Digit3' })); // 월간 3 (#149)
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
