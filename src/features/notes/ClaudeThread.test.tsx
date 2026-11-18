// 메모 칸 Claude 대화 - 열 때 맨 아래를 지키기 (P44-1 11-18 - CI에서 칸이 맨 위(2006px)에 남았다)
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render } from '@testing-library/react';
import ClaudeThread, { SETTLE_MS } from './ClaudeThread';
import type { ClaudeTurn } from '../../domain/claudeRequest';

// jsdom은 레이아웃이 없다 - 스크롤 칸([data-scroll-lock])만 높이·자리를 흉내 낸다(자리는 0 ~ 끝으로 잘린다)
const box = { sh: 1000, ch: 600, top: 0 };
const saved: Record<string, PropertyDescriptor | undefined> = {};
const isBox = (el: Element) => el.hasAttribute('data-scroll-lock');
beforeAll(() => {
  for (const k of ['scrollHeight', 'clientHeight', 'scrollTop']) saved[k] = Object.getOwnPropertyDescriptor(Element.prototype, k);
  Object.defineProperty(Element.prototype, 'scrollHeight', { configurable: true, get(this: Element) { return isBox(this) ? box.sh : 0; } });
  Object.defineProperty(Element.prototype, 'clientHeight', { configurable: true, get(this: Element) { return isBox(this) ? box.ch : 0; } });
  Object.defineProperty(Element.prototype, 'scrollTop', {
    configurable: true,
    get(this: Element) { return isBox(this) ? box.top : 0; },
    set(this: Element, v: number) { if (isBox(this)) box.top = Math.max(0, Math.min(v, box.sh - box.ch)); },
  });
});
afterAll(() => {
  for (const [k, d] of Object.entries(saved)) if (d) Object.defineProperty(Element.prototype, k, d);
});
beforeEach(() => {
  Object.assign(box, { sh: 1000, ch: 600, top: 0 });
  vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
});
afterEach(() => vi.useRealTimers());

const turn = (n: number): ClaudeTurn => ({ n, askText: `요청 ${n}`, askAt: n * 10, state: 'deployed', issue: n, url: null, note: `답 ${n}` });
const draw = (turns: ClaudeTurn[]) =>
  render(
    <div data-scroll-lock="">
      <div>메모 글</div>
      <ClaudeThread turns={turns} />
    </div>,
  );
const scroller = (c: HTMLElement) => c.querySelector('[data-scroll-lock]') as HTMLElement;
/** 칸이 자리를 잡으며(글 칸이 늦게 높이를 재고 둘레가 맨 위로) 밀린 것 - 사용자 손이 아니다 */
const layoutShift = (el: HTMLElement) => {
  box.sh = 3000;
  box.top = 0;
  fireEvent.scroll(el);
};
const frames = (n = 1) => act(() => vi.advanceTimersByTime(16 * n));

describe('ClaudeThread 열 때 맨 아래', () => {
  it('턴이 둘 이상이면 열 때 맨 아래', () => {
    draw([turn(1), turn(2)]);
    expect(box.top).toBe(400);
  });

  it('턴이 하나면 내리지 않는다 (메모 글이 먼저)', () => {
    draw([turn(1)]);
    expect(box.top).toBe(0);
  });

  it('연 뒤 칸이 자리를 잡으며 맨 위로 밀려도 (스크롤 알림이 먼저 와도) 다음 프레임에 다시 맨 아래', () => {
    const { container } = draw([turn(1), turn(2)]);
    layoutShift(scroller(container));
    frames();
    expect(box.top).toBe(2400);
  });

  it('사용자가 손대면(휠) 그만 지킨다 - 올려 본 자리를 되돌리지 않는다', () => {
    const { container } = draw([turn(1), turn(2)]);
    const el = scroller(container);
    fireEvent.wheel(el);
    box.top = 100;
    fireEvent.scroll(el);
    frames(3);
    expect(box.top).toBe(100);
  });

  it('글 칸을 누르거나 치면(키) 그만 지킨다', () => {
    const { container } = draw([turn(1), turn(2)]);
    const el = scroller(container);
    fireEvent.keyDown(el.firstElementChild!, { key: 'a' });
    layoutShift(el);
    frames(3);
    expect(box.top).toBe(0);
  });

  it('잠깐 뒤에는 지키지 않는다 - 그 뒤로 위로 간 것은 맨 아래를 벗어난 것', () => {
    const { container } = draw([turn(1), turn(2)]);
    act(() => vi.advanceTimersByTime(SETTLE_MS + 50));
    layoutShift(scroller(container));
    frames(3);
    expect(box.top).toBe(0);
  });

  it('턴이 늘면 다시 맨 아래로 내리고 잠깐 지킨다', () => {
    const { container, rerender } = draw([turn(1)]);
    expect(box.top).toBe(0);
    box.sh = 1500;
    rerender(
      <div data-scroll-lock="">
        <div>메모 글</div>
        <ClaudeThread turns={[turn(1), turn(2)]} />
      </div>,
    );
    expect(box.top).toBe(900);
    layoutShift(scroller(container));
    frames();
    expect(box.top).toBe(2400);
  });
});
