// 옆 칸 위의 휠은 칸 안에서만 - 스크롤할 것이 없거나 끝에 닿으면 막고, 안쪽 상자가 움직일 수 있으면 그대로
import { afterEach, describe, expect, it } from 'vitest';
import { canScrollY, containScroll } from './containScroll';

/** 스크롤 상자 흉내 (jsdom은 높이를 재지 않는다) */
function scroller(el: HTMLElement, { scrollHeight, clientHeight, scrollTop = 0 }: { scrollHeight: number; clientHeight: number; scrollTop?: number }) {
  el.style.overflowY = 'auto';
  Object.defineProperty(el, 'scrollHeight', { configurable: true, value: scrollHeight });
  Object.defineProperty(el, 'clientHeight', { configurable: true, value: clientHeight });
  el.scrollTop = scrollTop;
  return el;
}

const wheel = (target: Element, deltaY: number, more: WheelEventInit = {}) => {
  const e = new WheelEvent('wheel', { deltaY, bubbles: true, cancelable: true, ...more });
  target.dispatchEvent(e);
  return e.defaultPrevented;
};

let off: (() => void) | null = null;
afterEach(() => {
  off?.();
  off = null;
  document.body.innerHTML = '';
});

describe('옆 칸 휠 가두기', () => {
  it('스크롤할 수 있나: overflow가 auto이고 그 방향으로 남은 것이 있을 때만', () => {
    const el = scroller(document.body.appendChild(document.createElement('div')), { scrollHeight: 500, clientHeight: 200, scrollTop: 0 });
    expect(canScrollY(el, 1)).toBe(true);
    expect(canScrollY(el, -1)).toBe(false);
    el.scrollTop = 300;
    expect(canScrollY(el, 1)).toBe(false);
    expect(canScrollY(el, -1)).toBe(true);
    const hidden = scroller(document.body.appendChild(document.createElement('div')), { scrollHeight: 500, clientHeight: 200, scrollTop: 100 });
    hidden.style.overflowY = 'hidden';
    expect(canScrollY(hidden, -1)).toBe(false);
    expect(canScrollY(scroller(document.createElement('div'), { scrollHeight: 100, clientHeight: 100 }), 1)).toBe(false);
  });

  it('칸에 스크롤할 것이 없으면 휠을 막고(뒤 화면이 움직이지 않게), 안쪽 상자가 움직일 수 있으면 그대로', () => {
    const box = document.createElement('div');
    const list = scroller(document.createElement('div'), { scrollHeight: 400, clientHeight: 100 });
    const text = document.createElement('p');
    list.appendChild(text);
    box.appendChild(list);
    document.body.appendChild(box);
    off = containScroll(box);
    expect(wheel(text, 50)).toBe(false);
    expect(wheel(text, -50)).toBe(true); // 맨 위에서 위로 = 끝에 닿음
    list.scrollTop = 300;
    expect(wheel(text, 50)).toBe(true); // 맨 아래에서 아래로
    expect(wheel(box, 50)).toBe(true); // 스크롤할 것이 없는 칸 바닥
  });

  it('Ctrl + 휠(확대)·가로 휠은 건드리지 않는다, 떼면 다시 넘어간다', () => {
    const box = document.createElement('div');
    document.body.appendChild(box);
    off = containScroll(box);
    expect(wheel(box, 50, { ctrlKey: true })).toBe(false);
    expect(wheel(box, 5, { deltaX: 80 })).toBe(false);
    expect(wheel(box, 50)).toBe(true);
    off();
    off = null;
    expect(wheel(box, 50)).toBe(false);
  });
});
