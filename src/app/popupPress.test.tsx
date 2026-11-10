// 단추 대신 누르기의 팝업창 소식 (P28-3): 큰 창 → 팝업창 'press'(답이 올 때까지 다시) · 팝업창은 같은 부탁을 한 번만 누르고 답한다.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { PressTarget } from '../domain/pressTarget';
import { openPopupWindow, pressInPopup, resetPopupWindowsForTest, usePopupBridge } from './popupWindows';

const T: PressTarget = { win: 'settings', tab: 'view', attr: 'data-view-reset', label: '환경설정 → 보기 → 처음대로' };
const origin = window.location.origin;

afterEach(() => {
  resetPopupWindowsForTest();
  vi.restoreAllMocks();
});

/** window.open이 돌려줄 팝업창 흉내 - 받은 소식을 모은다 */
function fakePopup() {
  const got: Array<{ type: string; nonce?: string }> = [];
  const win = {
    closed: false,
    location: { href: 'about:blank', replace: vi.fn() },
    document: { title: '', body: { style: {}, textContent: '' } },
    focus: vi.fn(),
    postMessage: vi.fn((m: { type: string; nonce?: string }) => got.push(m)),
  };
  vi.spyOn(window, 'open').mockReturnValue(win as unknown as Window);
  // jsdom은 '방금 누름'이 거짓이라 팝업창을 열어 보지 않는다 (CLAUDE.md 2장)
  Object.defineProperty(navigator, 'userActivation', { value: { isActive: true }, configurable: true });
  expect(openPopupWindow('settings', { tab: 'view' }, () => true)).toBe(true);
  return { win, got };
}

const answer = (nonce: string, ok: boolean) =>
  window.dispatchEvent(new MessageEvent('message', { origin, data: { kind: 'sp5-popup', type: 'pressed', nonce, ok } }));

describe('팝업창에 누르기 소식', () => {
  it('답이 올 때까지 같은 부탁(같은 nonce)을 다시 보낸다 → 답 = 눌렀다', async () => {
    const { got } = fakePopup();
    const run = pressInPopup('settings', T);
    expect(got).toHaveLength(1);
    await vi.waitFor(() => expect(got.length).toBeGreaterThanOrEqual(2), { timeout: 2000 });
    expect(got[1].nonce).toBe(got[0].nonce);
    answer('다른 것', false);
    answer(got[0].nonce!, true);
    expect(await run).toBe(true);
  });

  it('그 창의 팝업창이 없으면 곧바로 null · 닫히면 그만', async () => {
    expect(await pressInPopup('settings', T)).toBeNull();
    const { win } = fakePopup();
    const run = pressInPopup('settings', T);
    win.closed = true;
    expect(await run).toBeNull();
  });

  it('팝업창 쪽: 같은 부탁은 한 번만 누르고, 보낸 창에 답한다 · 누를 것이 없는 창(onPress 없음)은 답하지 않는다', async () => {
    const onPress = vi.fn(async () => true);
    const source = { postMessage: vi.fn(), closed: false };
    renderHook(() => usePopupBridge(undefined, undefined, onPress));
    const ask = () =>
      window.dispatchEvent(new MessageEvent('message', { origin, source: source as unknown as Window, data: { kind: 'sp5-popup', type: 'press', target: T, nonce: 'n1' } }));
    ask();
    ask();
    await vi.waitFor(() => expect(source.postMessage).toHaveBeenCalledTimes(1));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onPress).toHaveBeenCalledWith(T);
    expect(source.postMessage).toHaveBeenCalledWith({ kind: 'sp5-popup', type: 'pressed', nonce: 'n1', ok: true }, origin);
  });
});
