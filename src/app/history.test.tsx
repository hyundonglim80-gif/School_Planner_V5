import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { closeAllLayers, resetHistoryForTest, startRouting, useModalLayer } from './history';
import { setDate, setScope, useNav } from './nav';

// 주소·뒤로가기·창 층이 한 기록을 함께 쓴다. jsdom의 back()은 다음 차례에 popstate를 보낸다.
const settle = () => act(() => new Promise((r) => setTimeout(r, 20)));
const back = async () => {
  window.history.back();
  await settle();
};

let stop: () => void = () => {};

beforeEach(() => {
  resetHistoryForTest();
  window.history.replaceState(null, '', '/');
  useNav.setState({ scope: 'day', date: '2026-10-08', classId: null });
});
afterEach(() => stop());

function Layer({ onClose }: { onClose: () => void }) {
  useModalLayer(true, onClose);
  return null;
}

describe('주소', () => {
  it('주소가 없으면 지금 화면의 주소를 적는다', () => {
    stop = startRouting();
    expect(window.location.hash).toBe('#/day/2026-10-08');
  });

  it('주소에 화면이 있으면 그 화면으로 연다', () => {
    window.history.replaceState(null, '', '#/month/2026-12');
    stop = startRouting();
    expect(useNav.getState()).toMatchObject({ scope: 'month', date: '2026-12-01' });
  });

  it('모르는 주소면 지금 화면의 주소로 고친다', () => {
    window.history.replaceState(null, '', '#/nope');
    stop = startRouting();
    expect(window.location.hash).toBe('#/day/2026-10-08');
  });

  it('화면을 바꾸면 기록 한 칸, 날짜만 바꾸면 주소만 (뒤로가기 = 앞 화면)', async () => {
    stop = startRouting();
    const len = window.history.length;
    act(() => setDate('2026-10-09'));
    expect(window.location.hash).toBe('#/day/2026-10-09');
    expect(window.history.length).toBe(len);

    act(() => setScope('week'));
    expect(window.location.hash).toBe('#/week/2026-10-05');
    expect(window.history.length).toBe(len + 1);

    await back();
    expect(useNav.getState()).toMatchObject({ scope: 'day', date: '2026-10-09' });
  });
});

describe('뒤로가기로 창 닫기', () => {
  it('창이 열려 있으면 뒤로가기는 맨 위 창 하나만 닫는다 (화면은 그대로)', async () => {
    stop = startRouting();
    act(() => setScope('week'));
    const a = vi.fn();
    const b = vi.fn();
    const first = render(<Layer onClose={a} />);
    const second = render(<Layer onClose={b} />);

    await back();
    expect(b).toHaveBeenCalledTimes(1);
    expect(a).not.toHaveBeenCalled();
    expect(useNav.getState().scope).toBe('week');
    second.unmount();

    await back();
    expect(a).toHaveBeenCalledTimes(1);
    first.unmount();
    await settle();

    // 창을 다 닫은 뒤의 뒤로가기라야 앞 화면
    await back();
    expect(useNav.getState().scope).toBe('day');
  });

  it('창을 연 채 화면을 바꾸면 뒤로가기는 창부터, 그다음 앞 화면', async () => {
    stop = startRouting();
    const close = vi.fn();
    const layer = render(<Layer onClose={close} />);
    act(() => setScope('month'));
    expect(window.location.hash).toBe('#/month/2026-10');

    await back();
    expect(close).toHaveBeenCalledTimes(1);
    expect(useNav.getState().scope).toBe('month');
    layer.unmount();
    await settle();

    await back();
    expect(useNav.getState().scope).toBe('day');
  });

  it('ESC(모두 닫기) 뒤에는 표지판을 거둬 다음 뒤로가기가 곧바로 앞 화면', async () => {
    stop = startRouting();
    act(() => setScope('year'));
    const close = vi.fn();
    const layer = render(<Layer onClose={close} />);
    act(() => closeAllLayers());
    expect(close).toHaveBeenCalledTimes(1);
    layer.unmount();
    await settle();

    await back();
    expect(useNav.getState().scope).toBe('day');
  });

  it('창이 열린 동안 날짜를 바꿔도, 창을 닫은 뒤 주소는 보는 날', async () => {
    stop = startRouting();
    const close = vi.fn();
    const layer = render(<Layer onClose={close} />);
    act(() => setDate('2026-10-12'));
    await back();
    expect(close).toHaveBeenCalledTimes(1);
    layer.unmount();
    expect(window.location.hash).toBe('#/day/2026-10-12');
  });
});
