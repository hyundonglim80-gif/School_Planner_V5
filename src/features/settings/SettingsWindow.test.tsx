import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import { resetHistoryForTest } from '../../app/history';
import { setPopupStyle, useLayoutPrefs } from '../../app/layoutPrefs';
import { useNav } from '../../app/nav';
import { handleAppKeyDown, setShortcutOverrides, useShortcutOverrides } from '../../app/keys';
import { anyWindowUnsaved } from '../../app/windows';
import { overridesFromBindings, resolveBindings } from '../../domain/shortcuts';
import { useMirror } from '../../data/mirror/store';
import { useSession } from '../../data/session';
import type { ImportCounts } from '../../import/v4/plan';
import { resetImportRun, useImportRun } from '../../import/v4/run';
import SettingsWindow from './SettingsWindow';

// '이 기기 사본 다시 받기'는 Firebase를 부른다 - 창 시험에서는 흉내만
const resetMirror = vi.hoisted(() => vi.fn(() => Promise.resolve()));
vi.mock('../../data/mirror/sync', () => ({ resetMirror }));
// 가져오기는 서버를 부른다 - 창 시험에서는 흉내만 (진행 store는 진짜)
const runImport = vi.hoisted(() => vi.fn(() => Promise.resolve(true)));
const loadImportRecord = vi.hoisted(() => vi.fn(() => Promise.resolve()));
vi.mock('../../import/v4/run', async (orig) => ({ ...(await orig<typeof import('../../import/v4/run')>()), runImport, loadImportRecord }));

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

const openSettings = (tab?: 'view' | 'shortcuts' | 'app' | 'import') => render(<SettingsWindow params={tab ? { tab } : undefined} close={vi.fn()} raise={0} />);

describe('환경설정 창', () => {
  it('지금 있는 탭만 (보기·단축키·앱·가져오기) - 아직 옮기지 않은 기능의 탭은 숨긴다', () => {
    openSettings();
    expect(qa('[data-settings-tab]').map((b) => b.dataset.settingsTab)).toEqual(['view', 'shortcuts', 'app', 'import']);
    expect(q('[data-settings-tab="view"]')).toHaveAttribute('aria-selected', 'true');
  });

  it('열 때 탭을 고를 수 있다', () => {
    openSettings('shortcuts');
    expect(q('[data-settings-panel="shortcuts"]')).toBeVisible();
    expect(q('[data-settings-panel="view"]')).not.toBeVisible();
  });

  it('열려 있는 창을 다른 탭으로 다시 열면 그 탭으로', () => {
    const { rerender } = openSettings('view');
    rerender(<SettingsWindow params={{ tab: 'import' }} close={vi.fn()} raise={0} />);
    expect(q('[data-settings-panel="import"]')).toBeVisible();
    expect(q('[data-settings-tab="import"]')).toHaveAttribute('aria-selected', 'true');
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

describe('가져오기 탭', () => {
  beforeEach(() => {
    useSession.setState({ loading: false, user: { uid: 'me', email: 'me@x', displayName: '', photoURL: '' } });
    resetImportRun();
    runImport.mockClear();
  });

  it('기록을 읽고, 단추를 누르면 가져온다 (가져온 적이 있으면 다시 가져오기)', async () => {
    openSettings('import');
    expect(loadImportRecord).toHaveBeenCalledWith('me');
    expect(q('[data-import-run]').textContent).toContain('V4 자료 가져오기');
    await act(async () => {
      useImportRun.setState({ record: { at: new Date(2026, 9, 8, 14, 5).getTime() } });
    });
    expect(q('[data-import-run]').textContent).toContain('다시 가져오기');
    expect(q('[data-import-last]').textContent).toContain('2026-10-08 14:05');
    await act(async () => {
      fireEvent.click(q('[data-import-run]'));
    });
    expect(runImport).toHaveBeenCalledWith('me');
  });

  it('도는 동안 진행 칸, 끝나면 결과 표 (종류마다·학년도별)', async () => {
    openSettings('import');
    await act(async () => {
      useImportRun.setState({ state: 'running', step: '적는 중…', done: 1, total: 4 });
    });
    expect(q('[data-import-progress]').dataset.importProgress).toBe('25');
    expect(q('[data-import-run]')).toBeDisabled();
    expect(document.querySelector('[data-import-result]')).toBeNull();
    const c = (o: Partial<ImportCounts>): ImportCounts => ({ added: 0, changed: 0, same: 0, kept: 0, removed: 0, ...o });
    await act(async () => {
      useImportRun.setState({
        state: 'done',
        counts: { 'labels.event': c({ added: 5, years: { '2025': 1, '2026': 2 } }), settings: c({ changed: 2, kept: 1 }), 'nope.kind': c({ added: 3 }) },
      });
    });
    expect(document.querySelector('[data-import-progress]')).toBeNull();
    // 표의 줄은 IMPORT_KINDS 차례·그 표에 있는 종류만
    expect(qa('[data-import-row]').map((r) => r.dataset.importRow)).toEqual(['labels.event', 'settings']);
    expect(q('[data-import-row="labels.event"] [data-import-count="added"]').textContent).toBe('5');
    expect(q('[data-import-row="settings"] [data-import-count="kept"]').textContent).toBe('1');
    expect(q('[data-import-row="labels.event"] [data-import-years]').textContent).toBe('2026학년도 2 · 2025학년도 1');
  });

  it('실패하면 다시 누르라고', async () => {
    openSettings('import');
    await act(async () => {
      useImportRun.setState({ state: 'failed' });
    });
    expect(q('[data-import-failed]')).toBeVisible();
  });
});
