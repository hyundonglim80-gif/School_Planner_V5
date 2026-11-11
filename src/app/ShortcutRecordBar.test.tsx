import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import ShortcutRecordBar from './ShortcutRecordBar';
import { startShortcutRecord, useShortcutRecord } from './shortcutRecord';
import { setShortcutOverrides, setTabShortcuts, useShortcutOverrides } from './keys';
import { registerWindow, resetWindowsForTest, useWindows } from './windows';
import { shortcutTarget } from '../ui/shortcutTarget';

vi.mock('./toast', () => ({ showToast: vi.fn(), showErrorToast: vi.fn() }));

const q = (sel: string) => document.querySelector(sel) as HTMLElement;

function setup() {
  render(
    <>
      <button type="button" {...shortcutTarget('timetable')}>
        <span data-inner>⏰ 시간표</span>
      </button>
      {/* 자기 data-* 표시가 없는 단추 - 대신 누르기(P28-3)로도 찾을 길이 없다 */}
      <button type="button" className="plain">
        아무 단추
      </button>
      <button type="button" data-opener aria-expanded={false}>
        ⋮
      </button>
      <p data-text>그냥 글</p>
      <ShortcutRecordBar />
    </>,
  );
}

const pressKey = (init: KeyboardEventInit) => {
  const e = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
  act(() => {
    document.body.dispatchEvent(e);
  });
  return e;
};

beforeEach(() => {
  resetWindowsForTest();
  registerWindow({ id: 'settings', title: '환경설정', icon: '⚙️', kind: 'side', load: () => import('../features/dev/TestWindow') });
  setShortcutOverrides({});
  setTabShortcuts({});
  useShortcutRecord.setState({ stage: 'off', picked: null, miss: null, binding: null });
});

describe('단축키 설정 띠 (P18-1)', () => {
  it('꺼져 있으면 아무것도 그리지 않고, 시작하면 띠·점선 표시(body)', () => {
    setup();
    expect(q('[data-shortcut-record]')).toBeNull();
    act(() => startShortcutRecord());
    expect(q('[data-shortcut-record="pick"]')).not.toBeNull();
    expect(document.body.dataset.shortcutRecording).toBe('pick');
    expect(q('[data-shortcut-record-done]')).toBeDisabled();
  });

  it('표시된 단추(안쪽 글자를 눌러도) = 그 기능을 고른다 · 표시 없는 단추 = 만들 수 없다 · 펴는 단추·그냥 글은 아무 일 없음', () => {
    setup();
    act(() => startShortcutRecord());
    fireEvent.click(q('[data-opener]'));
    expect(q('[data-shortcut-record-miss]')).toBeNull();
    fireEvent.click(q('.plain'));
    expect(q('[data-shortcut-record-miss]')).not.toBeNull();
    fireEvent.click(q('[data-inner]'));
    expect(q('[data-shortcut-record-picked="timetable"]')).toHaveTextContent('시간표');
    expect(q('[data-shortcut-record-miss]')).toBeNull();
    fireEvent.click(q('[data-text]'));
    expect(q('[data-shortcut-record-miss]')).toBeNull();
    // 앞에 고른 것은 그대로
    fireEvent.click(q('.plain'));
    expect(q('[data-shortcut-record-picked="timetable"]')).not.toBeNull();
    // 띠 안을 누른 것은 세지 않는다
    fireEvent.click(q('[data-shortcut-record-cancel]').previousElementSibling as HTMLElement);
    expect(useShortcutRecord.getState().picked).toBe('timetable');
  });

  it('완료 → 키를 받는다(앱 단축키로 가지 않는다) → 저장 = 그 기능에 키 · 환경설정 단축키 탭을 그 줄로', () => {
    setup();
    const app = vi.fn();
    window.addEventListener('keydown', app);
    act(() => startShortcutRecord());
    fireEvent.click(q('[data-inner]'));
    fireEvent.click(q('[data-shortcut-record-done]'));
    expect(q('[data-shortcut-record="key"]')).not.toBeNull();
    expect(q('[data-shortcut-record-save]')).toBeDisabled();
    pressKey({ key: 'Control', ctrlKey: true });
    expect(q('[data-shortcut-record-key]')).toHaveTextContent('…');
    const e = pressKey({ key: 'ㅅ', code: 'KeyT', ctrlKey: true, altKey: true });
    expect(e.defaultPrevented).toBe(true);
    expect(app).not.toHaveBeenCalled();
    expect(q('[data-shortcut-record-key]')).toHaveTextContent('Ctrl + Alt + T');
    fireEvent.click(q('[data-shortcut-record-save]'));
    expect(useShortcutOverrides.getState().overrides.timetable).toEqual({ ctrl: true, alt: true, shift: false, key: 'T' });
    expect(q('[data-shortcut-record]')).toBeNull();
    expect(document.body.dataset.shortcutRecording).toBeUndefined();
    const win = useWindows.getState().windows.find((w) => w.id === 'settings');
    expect(win?.params).toEqual({ tab: 'shortcuts', focus: 'timetable' });
    window.removeEventListener('keydown', app);
  });

  it('겹친 키는 미리 알리고, 저장하면 다른 기능에서 뺀다 · Ctrl+S는 받지 않는다 · 글 칸 안내', () => {
    setup();
    act(() => startShortcutRecord());
    fireEvent.click(q('[data-inner]'));
    fireEvent.click(q('[data-shortcut-record-done]'));
    pressKey({ key: 's', code: 'KeyS', ctrlKey: true });
    expect(q('[data-shortcut-record-issue]')).toHaveTextContent('저장');
    expect(q('[data-shortcut-record-save]')).toBeDisabled();
    pressKey({ key: 't', code: 'KeyT' });
    expect(q('[data-shortcut-record-typing]')).not.toBeNull();
    // 고정 단축키(검색 Ctrl + F - #149)의 키는 줄 수 없다
    pressKey({ key: 'f', code: 'KeyF', ctrlKey: true });
    expect(q('[data-shortcut-record-issue]')).toHaveTextContent('고정 단축키(검색 열기)');
    expect(q('[data-shortcut-record-save]')).toBeDisabled();
    expect(q('[data-shortcut-record-conflict]')).toBeNull();
    pressKey({ key: '%', code: 'Digit5', shiftKey: true });
    expect(q('[data-shortcut-record-conflict]')).toHaveTextContent('메모 화면');
    fireEvent.click(q('[data-shortcut-record-save]'));
    const o = useShortcutOverrides.getState().overrides;
    expect(o.timetable).toEqual({ ctrl: false, alt: false, shift: true, key: '5' });
    expect(o.scopeMemo?.key).toBe('');
  });

  it('고정 단축키(#149)의 단추를 누르면 고르지 않고 까닭 - 앞에 고른 것은 그대로', () => {
    render(
      <>
        <button type="button" {...shortcutTarget('timetable')}>
          ⏰ 시간표
        </button>
        <button type="button" data-fixed-search {...shortcutTarget('search')}>
          🔍
        </button>
        <ShortcutRecordBar />
      </>,
    );
    act(() => startShortcutRecord());
    fireEvent.click(screen.getByText('⏰ 시간표'));
    fireEvent.click(q('[data-fixed-search]'));
    expect(q('[data-shortcut-record-miss]')).toHaveTextContent("'검색 열기'는 고정 단축키(Ctrl + F)라 바꿀 수 없습니다.");
    expect(useShortcutRecord.getState().picked).toBe('timetable');
  });

  it('ESC = 어느 단계에서나 취소 (앱의 ESC로 가지 않는다) · 다시 고르기', () => {
    setup();
    const app = vi.fn();
    window.addEventListener('keydown', app);
    act(() => startShortcutRecord());
    fireEvent.click(q('[data-inner]'));
    fireEvent.click(q('[data-shortcut-record-done]'));
    fireEvent.click(q('[data-shortcut-record-repick]'));
    expect(q('[data-shortcut-record="pick"]')).not.toBeNull();
    expect(q('[data-shortcut-record-picked="timetable"]')).not.toBeNull();
    pressKey({ key: 'Escape', code: 'Escape' });
    expect(q('[data-shortcut-record]')).toBeNull();
    expect(app).not.toHaveBeenCalled();
    expect(useShortcutOverrides.getState().overrides).toEqual({});
    window.removeEventListener('keydown', app);
    expect(screen.queryByText('완료')).toBeNull();
  });
});

describe('창 안 탭 고르기 (P18-2)', () => {
  function setupTabs() {
    render(
      <>
        <button type="button" role="tab" data-shortcut-target="settings:notify">
          알림
        </button>
        <button type="button" role="tab" data-shortcut-target="settings:nope">
          없는 탭
        </button>
        <ShortcutRecordBar />
      </>,
    );
  }

  it("탭 단추 = '창 → 탭'을 고른다 · 목록에 없는 탭은 만들 수 없다", () => {
    setupTabs();
    act(() => startShortcutRecord());
    fireEvent.click(screen.getByText('없는 탭'));
    expect(q('[data-shortcut-record-miss]')).not.toBeNull();
    fireEvent.click(screen.getByText('알림'));
    expect(q('[data-shortcut-record-picked="settings:notify"]')).toHaveTextContent('환경설정 → 알림');
  });

  it('키 → 저장 = 창 안 탭 키 · 같은 키를 쓰던 기능에서는 뺀다 · 환경설정 단축키 탭을 그 줄로', () => {
    setupTabs();
    act(() => startShortcutRecord());
    fireEvent.click(screen.getByText('알림'));
    fireEvent.click(q('[data-shortcut-record-done]'));
    expect(q('[data-shortcut-record="key"]')).toHaveTextContent("'환경설정 → 알림'에 줄 키를 누르세요");
    expect(q('[data-shortcut-record="key"]')).toHaveTextContent('지금: 없음');
    pressKey({ key: '%', code: 'Digit5', shiftKey: true });
    expect(q('[data-shortcut-record-conflict]')).toHaveTextContent('메모 화면');
    // 고정 단축키(#149)의 키는 창 안 탭에도 줄 수 없다
    pressKey({ key: 'p', code: 'KeyP', ctrlKey: true });
    expect(q('[data-shortcut-record-issue]')).toHaveTextContent('고정 단축키(이 화면 인쇄)');
    pressKey({ key: 'n', code: 'KeyN', ctrlKey: true, altKey: true });
    expect(q('[data-shortcut-record-key]')).toHaveTextContent('Ctrl + Alt + N');
    fireEvent.click(q('[data-shortcut-record-save]'));
    expect(useShortcutOverrides.getState().tabs).toEqual({ 'settings:notify': { ctrl: true, alt: true, shift: false, key: 'N' } });
    expect(useShortcutOverrides.getState().overrides).toEqual({});
    const win = useWindows.getState().windows.find((w) => w.id === 'settings');
    expect(win?.params).toEqual({ tab: 'shortcuts', focus: 'settings:notify' });
  });

  it('기능에 탭이 쓰던 키를 주면 탭은 목록에서 빠진다', () => {
    setTabShortcuts({ 'settings:notify': { ctrl: true, alt: true, shift: false, key: 'N' } });
    setup();
    act(() => startShortcutRecord());
    fireEvent.click(q('[data-inner]'));
    fireEvent.click(q('[data-shortcut-record-done]'));
    pressKey({ key: 'n', code: 'KeyN', ctrlKey: true, altKey: true });
    expect(q('[data-shortcut-record-conflict]')).toHaveTextContent('환경설정 → 알림');
    fireEvent.click(q('[data-shortcut-record-save]'));
    expect(useShortcutOverrides.getState().tabs).toEqual({});
    expect(useShortcutOverrides.getState().overrides.timetable?.key).toBe('N');
  });
});
