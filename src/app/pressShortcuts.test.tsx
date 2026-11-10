import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render } from '@testing-library/react';

vi.mock('../data/firebase', () => ({ db: {}, auth: {} }));
vi.mock('../data/settingsSync', () => ({ settingsPort: () => ({}), startSettingsSync: () => () => {} }));
const toast = vi.hoisted(() => vi.fn());
vi.mock('./toast', () => ({ showToast: toast, showErrorToast: vi.fn() }));

import { isCustomShortcutId, type CustomShortcutId } from '../domain/shortcuts';
import { pressIdOf, type PressTarget } from '../domain/pressTarget';
import { customShortcutOf, runCustomShortcut } from './customShortcuts';
import { addPressTargets, handleAppKeyDown, setCustomShortcuts, setShortcutOverrides, setTabShortcuts, useShortcutOverrides } from './keys';
import { useNav } from './nav';
import { clearPendingPress, PRESS_MISS, pickPressTarget, runPress, takePendingPress } from './pressShortcuts';
import ShortcutRecordBar from './ShortcutRecordBar';
import { finishPick, saveRecordedKey, startShortcutRecord, useShortcutRecord } from './shortcutRecord';
import { registerWindow, resetWindowsForTest, useWindows } from './windows';

const TestWindow = () => import('../features/dev/TestWindow');
const q = (sel: string) => document.querySelector(sel) as HTMLElement;
const ID = 'AbCdEfGhIjKlMnOpQrSt';

function pick(sel: string) {
  const r = pickPressTarget(q(sel));
  if (!r || !('id' in r)) throw new Error(`고르지 못함: ${JSON.stringify(r)}`);
  return { id: r.id, target: takePendingPress(r.id)! };
}

/** 창 틀처럼 - data-window-key를 단 칸 (창 목록에도 그 key로 넣는다) */
function openFake(key: number, id: string, params: unknown) {
  useWindows.setState((s) => ({ windows: [...s.windows, { key, id, params, openedAt: key, raisedAt: key }] }));
}

beforeEach(() => {
  toast.mockClear();
  resetWindowsForTest();
  registerWindow({ id: 'settings', title: '환경설정', icon: '⚙️', kind: 'side', load: TestWindow });
  registerWindow({ id: 'seating', title: '자리 배치', icon: '🪑', kind: 'side', load: TestWindow });
  registerWindow({ id: 'note', title: '메모', icon: '📝', kind: 'panel', load: TestWindow });
  useNav.setState({ scope: 'memo' });
  setShortcutOverrides({});
  setTabShortcuts({});
  setCustomShortcuts({});
  useShortcutOverrides.setState({ press: {} });
  clearPendingPress();
});
afterEach(cleanup);

describe('고르기 (P28-3 ■0 - 자기 data-* · 자리 · 이름)', () => {
  it('화면 단추 = 보던 화면 + 그 자리에 하나뿐인 표시(값이 바뀌는 것은 이름만) · 머리줄은 머리줄', () => {
    render(
      <>
        <header>
          <button type="button" data-memo-view-toggle="card" aria-label="목록으로 보기">
            ▤
          </button>
        </header>
        <div data-screen="memo">
          <button type="button" data-memo-sort="date" data-memo-sort-bar>
            날짜 차례
          </button>
        </div>
      </>,
    );
    const v = pick('[data-memo-view-toggle]');
    expect(v.target).toEqual({ screen: 'memo', attr: 'data-memo-view-toggle', label: '머리줄 → 목록으로 보기' });
    const s = pick('[data-memo-sort]');
    expect(s.target).toMatchObject({ screen: 'memo', attr: 'data-memo-sort', label: '메모 → 날짜 차례' });
    expect(isCustomShortcutId(v.id)).toBe(true);
  });

  it('카드 안 단추·날짜가 든 단추 = 항목마다 달라 못 만든다 (카드가 하나여도) · 같은 단추 여럿 · 표시 없음 · 글 칸', () => {
    render(
      <div data-screen="day">
        <div data-entry-card={ID}>
          <button type="button" data-entry-favorite-toggle>
            ☆
          </button>
        </div>
        <button type="button" data-week-add="2027-03-05">
          +
        </button>
        <button type="button" data-dup>
          가
        </button>
        <button type="button" data-dup>
          나
        </button>
        <button type="button" className="bare">
          표시 없음
        </button>
        <input data-some-box />
        <p data-text>그냥 글</p>
      </div>,
    );
    expect(pickPressTarget(q('[data-entry-favorite-toggle]'))).toEqual({ reason: PRESS_MISS.item });
    expect(pickPressTarget(q('[data-week-add]'))).toEqual({ reason: PRESS_MISS.item });
    expect(pickPressTarget(q('[data-dup]'))).toEqual({ reason: PRESS_MISS.many });
    expect(pickPressTarget(q('.bare'))).toEqual({ reason: PRESS_MISS.none });
    expect(pickPressTarget(q('[data-some-box]'))).toEqual({ reason: PRESS_MISS.box });
    expect(pickPressTarget(q('[data-text]'))).toBeNull();
  });

  it('보고 있는 날의 칸(하루 화면 수업 칸)은 화면의 것 · 다른 날 칸(주간 날 칸)은 날마다 · 그림 글이면 title이 이름', () => {
    useNav.setState({ scope: 'day', date: '2027-03-05' });
    render(
      <div data-screen="day">
        <section data-day-lessons="2027-03-05">
          <button type="button" data-lessons-collapse title="수업 접기">
            ▼
          </button>
        </section>
        <div data-week-day="2027-03-06">
          <button type="button" data-day-more>
            더 보기
          </button>
        </div>
      </div>,
    );
    expect(pick('[data-lessons-collapse]').target).toEqual({ screen: 'day', attr: 'data-lessons-collapse', label: '하루 → 수업 접기' });
    expect(pickPressTarget(q('[data-day-more]'))).toEqual({ reason: PRESS_MISS.item });
  });

  it('창 안 단추 = 그 창 + 보던 탭 · 창의 제 항목(일정 칸 id)은 괜찮다 · 쓰는 칸·값이 있어야 여는 창 = 열려 있을 때만', () => {
    openFake(11, 'settings', { tab: 'view' });
    openFake(12, 'note', { id: ID });
    openFake(13, 'seating', { classId: 'c1' });
    render(
      <>
        <section data-window-key="11">
          <button type="button" role="tab" data-shortcut-target="settings:view" aria-selected="true">
            보기
          </button>
          <button type="button" role="tab" data-shortcut-target="settings:app" aria-selected="false">
            앱
          </button>
          <button type="button" data-view-reset>
            처음대로
          </button>
        </section>
        <aside data-window-key="12">
          <div data-note-id={ID}>
            {/* 메모 칸 📎 = 숨은 파일 칸을 감싼 label */}
            <label data-note-attach>
              <span>📎</span>
              <span>파일 첨부</span>
              <input type="file" className="hidden" data-file-input />
            </label>
          </div>
        </aside>
        <section data-window-key="13">
          <button type="button" data-seat-shuffle>
            섞기
          </button>
        </section>
      </>,
    );
    expect(pick('[data-view-reset]').target).toEqual({ win: 'settings', tab: 'view', attr: 'data-view-reset', label: '환경설정 → 보기 → 처음대로' });
    expect(pick('[data-note-attach] span').target).toEqual({ win: 'note', attr: 'data-note-attach', label: '메모 → 📎 파일 첨부', only: true });
    // 브라우저가 이어 누르는 숨은 파일 칸도 같은 단추
    expect(pickPressTarget(q('[data-file-input]'))).toEqual({ id: pressIdOf({ win: 'note', attr: 'data-note-attach' }) });
    expect(pick('[data-seat-shuffle]').target).toMatchObject({ win: 'seating', only: true });
  });

  it('띠에서: 표시 없는 단추를 누르면 그 단추를 고르고, 저장하면 적은 것과 키가 함께 남는다 · 못 고르면 까닭', () => {
    render(
      <>
        <div data-screen="memo">
          <button type="button" data-memo-clear-done>
            완료 지우기
          </button>
          <div data-entry-card={ID}>
            <button type="button" data-entry-collapse>
              ▼
            </button>
          </div>
        </div>
        <ShortcutRecordBar />
      </>,
    );
    act(() => startShortcutRecord());
    fireEvent.click(q('[data-entry-collapse]'));
    expect(q('[data-shortcut-record-miss]')).toHaveTextContent('항목(날짜)마다');
    fireEvent.click(q('[data-memo-clear-done]'));
    const picked = useShortcutRecord.getState().picked as CustomShortcutId;
    expect(picked).toMatch(/^press\./);
    expect(q(`[data-shortcut-record-picked="${picked}"]`)).toHaveTextContent('메모 → 완료 지우기');
    expect(q('[data-shortcut-record-miss]')).toBeNull();
    // 아직 계정 칸에는 없다 (고르다 그만두면 남지 않게)
    expect(useShortcutOverrides.getState().press).toEqual({});
    act(() => finishPick());
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'j', code: 'KeyJ', altKey: true, bubbles: true, cancelable: true }));
    });
    act(() => {
      saveRecordedKey();
    });
    const s = useShortcutOverrides.getState();
    expect(s.custom[picked]).toEqual({ ctrl: false, alt: true, shift: false, key: 'J' });
    expect(s.press[picked as `press.${string}`]).toEqual({ screen: 'memo', attr: 'data-memo-clear-done', label: '메모 → 완료 지우기' });
  });
});

describe('누르기 (P28-3 ■1)', () => {
  function keyed(t: PressTarget) {
    const id = `press.t${Math.random().toString(36).slice(2, 8)}` as const;
    addPressTargets({ [id]: t });
    setCustomShortcuts({ [id]: { ctrl: false, alt: true, shift: false, key: 'J' } });
    return id;
  }

  it('보이는 단추를 누른다 - 키로 (Alt+J) · 이름은 적은 것', () => {
    const click = vi.fn();
    render(
      <div data-screen="memo">
        <button type="button" data-memo-clear-done onClick={click}>
          완료 지우기
        </button>
      </div>,
    );
    const id = keyed({ screen: 'memo', attr: 'data-memo-clear-done', label: '메모 → 완료 지우기' });
    expect(customShortcutOf(id)?.label).toBe('메모 → 완료 지우기');
    const e = new KeyboardEvent('keydown', { key: 'j', code: 'KeyJ', altKey: true, bubbles: true, cancelable: true });
    handleAppKeyDown(e);
    expect(e.defaultPrevented).toBe(true);
    expect(click).toHaveBeenCalledTimes(1);
  });

  it('창 밖 단추가 없으면 그 화면으로 가서 뜨면 누른다 · 그래도 없으면 안내', async () => {
    useNav.setState({ scope: 'day' });
    const click = vi.fn();
    const t: PressTarget = { screen: 'memo', attr: 'data-memo-view-toggle', label: '머리줄 → 목록으로 보기' };
    const run = runPress(t);
    expect(useNav.getState().scope).toBe('memo');
    render(
      <button type="button" data-memo-view-toggle="list" onClick={click}>
        ▤
      </button>,
    );
    expect(await run).toBe(true);
    expect(click).toHaveBeenCalledTimes(1);
    cleanup();
    expect(await runPress({ screen: 'memo', attr: 'data-nothing', label: '메모 → 없음' })).toBe(false);
    expect(toast).toHaveBeenCalledWith(expect.stringContaining('찾지 못했습니다'), 4000);
  }, 10000);

  it('닫힌 창은 그 탭으로 열고 뜨면 누른다 · 쓰는 칸은 열지 않고 안내 · 여럿이 보이면 누르지 않는다', async () => {
    const click = vi.fn();
    const run = runPress({ win: 'settings', tab: 'view', attr: 'data-view-reset', label: '환경설정 → 보기 → 처음대로' });
    const win = useWindows.getState().windows.find((w) => w.id === 'settings');
    expect(win?.params).toEqual({ tab: 'view' });
    render(
      <section data-window-key={win!.key}>
        <button type="button" data-view-reset onClick={click}>
          처음대로
        </button>
      </section>,
    );
    expect(await run).toBe(true);
    expect(click).toHaveBeenCalledTimes(1);

    expect(await runPress({ win: 'note', attr: 'data-note-attach', label: '메모 → 📎 첨부', only: true })).toBe(false);
    expect(useWindows.getState().windows.some((w) => w.id === 'note')).toBe(false);
    expect(toast).toHaveBeenLastCalledWith(expect.stringContaining("'메모' 칸이 열려 있을 때"), 4000);

    cleanup();
    render(
      <div data-screen="memo">
        <button type="button" data-dup onClick={click}>
          가
        </button>
        <button type="button" data-dup onClick={click}>
          나
        </button>
      </div>,
    );
    expect(await runPress({ screen: 'memo', attr: 'data-dup', label: '메모 → 가' })).toBe(false);
    expect(click).toHaveBeenCalledTimes(1);
    expect(toast).toHaveBeenLastCalledWith(expect.stringContaining('여럿이라'), 4000);
  }, 10000);

  it('열린 쓰는 칸 안의 단추는 누른다 (열려 있을 때만인 것도) · 다른 창의 같은 표시는 세지 않는다', async () => {
    const attach = vi.fn();
    const other = vi.fn();
    openFake(21, 'note', { id: 'a' });
    openFake(22, 'settings', {});
    render(
      <>
        <aside data-window-key="21">
          <button type="button" data-note-attach onClick={attach}>
            📎
          </button>
        </aside>
        <section data-window-key="22">
          <button type="button" data-note-attach onClick={other}>
            📎
          </button>
        </section>
      </>,
    );
    expect(runCustomShortcut(keyed({ win: 'note', attr: 'data-note-attach', label: '메모 → 📎', only: true }))).toBe(true);
    await vi.waitFor(() => expect(attach).toHaveBeenCalledTimes(1));
    expect(other).not.toHaveBeenCalled();
  });
});
