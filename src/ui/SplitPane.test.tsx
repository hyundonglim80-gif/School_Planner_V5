import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import SplitPane from './SplitPane';
import { ratioAt, SPLIT_HANDLE_PX } from './splitRatio';

describe('ratioAt - 위치 → 비율 (칸마다 최소 크기)', () => {
  it('가운데는 그대로, 끝은 최소 크기에서 멈춘다', () => {
    expect(ratioAt(500, 1000, 100, 100)).toBe(50);
    expect(ratioAt(20, 1000, 100, 100)).toBe(10);
    expect(ratioAt(990, 1000, 100, 100)).toBeCloseTo((1000 - 100 - SPLIT_HANDLE_PX / 2) / 10);
  });
  it('둘 다 지킬 수 없을 만큼 좁으면 null (그대로 둔다)', () => {
    expect(ratioAt(100, 150, 100, 100)).toBeNull();
    expect(ratioAt(0, 0, 0, 0)).toBeNull();
  });
  it('5 ~ 95%만', () => {
    expect(ratioAt(0, 1000, 0, 0)).toBe(5);
    expect(ratioAt(1000, 1000, 0, 0)).toBe(95);
  });
});

function setup(ratio = 50, onCommit = vi.fn()) {
  render(
    <SplitPane name="t" direction="row" ratio={ratio} onCommit={onCommit} minFirst={100} minSecond={100} label="시험 경계선" first={<p>앞</p>} second={<p>뒤</p>} />,
  );
  const box = document.querySelector<HTMLElement>('[data-split="t"]')!;
  // jsdom은 자리를 재지 않는다 - 1000px 상자로 세운다
  box.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 600, right: 1000, bottom: 600, x: 0, y: 0, toJSON: () => ({}) });
  Object.defineProperty(box, 'clientWidth', { value: 1000 });
  return { box, handle: screen.getByRole('separator'), onCommit };
}

describe('SplitPane', () => {
  it('두 칸과 경계선, 비율은 CSS 변수로', () => {
    const { box, handle } = setup(58);
    expect(screen.getByText('앞')).toBeTruthy();
    expect(screen.getByText('뒤')).toBeTruthy();
    expect(box.style.getPropertyValue('--split')).toBe('58');
    expect(handle.getAttribute('aria-valuenow')).toBe('58');
    expect(handle.getAttribute('aria-orientation')).toBe('vertical');
    expect(handle.getAttribute('data-split-handle')).toBe('t');
  });

  it('끄는 동안은 CSS 변수만 바꾸고 놓을 때 한 번 알린다', () => {
    const { box, handle, onCommit } = setup(50);
    fireEvent.pointerDown(handle, { button: 0, pointerId: 1, clientX: 500 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 600 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 700 });
    expect(box.style.getPropertyValue('--split')).toBe('70');
    expect(onCommit).not.toHaveBeenCalled();
    fireEvent.pointerUp(handle, { pointerId: 1, clientX: 700 });
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith(70);
  });

  it('누르기만 하면 알리지 않고, 두 번 누르면 기본(null)', () => {
    const { handle, onCommit } = setup(50);
    fireEvent.pointerDown(handle, { button: 0, pointerId: 1, clientX: 500 });
    fireEvent.pointerUp(handle, { pointerId: 1, clientX: 500 });
    expect(onCommit).not.toHaveBeenCalled();
    fireEvent.doubleClick(handle);
    expect(onCommit).toHaveBeenCalledWith(null);
  });

  it('키: 화살표 ±2% · PageUp/PageDown ±10% · 수식키와 함께면 듣지 않는다(화면 단축키)', () => {
    const { handle, onCommit } = setup(50);
    fireEvent.keyDown(handle, { key: 'ArrowRight' });
    expect(onCommit).toHaveBeenLastCalledWith(52);
    fireEvent.keyDown(handle, { key: 'PageUp' });
    expect(onCommit).toHaveBeenLastCalledWith(40);
    onCommit.mockClear();
    fireEvent.keyDown(handle, { key: 'ArrowLeft', shiftKey: true });
    expect(onCommit).not.toHaveBeenCalled();
  });
});
