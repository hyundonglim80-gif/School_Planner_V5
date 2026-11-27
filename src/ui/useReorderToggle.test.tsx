import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { SCREEN_DEFAULTS, useScreenPrefs } from '../app/screenPrefs';
import { useReorderToggle } from './useReorderToggle';

function Box() {
  const { reorderAttr, reorderButton } = useReorderToggle('events');
  return (
    <section data-box {...reorderAttr}>
      {reorderButton}
    </section>
  );
}

afterEach(() => {
  cleanup();
  act(() => useScreenPrefs.setState({ ...SCREEN_DEFAULTS }));
});

describe('카드 차례 바꾸기 ⇅ (P59-1)', () => {
  it('기본은 \'⇅ 누를 때만\'(P61 - 휴대폰 카드 ▲▼가 한 줄을 차지했다)', () => {
    expect(SCREEN_DEFAULTS.orderArrows).toBe('toggle');
  });

  it("'늘 보이기'면 ⇅도 칸 표시도 없다 - html 표시도 없다", () => {
    act(() => useScreenPrefs.setState({ orderArrows: 'always' }));
    const { container } = render(<Box />);
    expect(container.querySelector('[data-reorder-toggle]')).toBeNull();
    expect(container.querySelector('[data-box]')!.hasAttribute('data-reorder-on')).toBe(false);
    expect(document.documentElement.dataset.orderArrows).toBeUndefined();
  });

  it("'⇅ 누를 때만'이면 칸 머리 ⇅ - 누르면 그 칸에 표시(▲▼가 선다), 다시 누르면 걷는다", () => {
    act(() => useScreenPrefs.setState({ orderArrows: 'toggle' }));
    expect(document.documentElement.dataset.orderArrows).toBe('toggle');
    const { container } = render(<Box />);
    const btn = container.querySelector<HTMLButtonElement>('[data-reorder-toggle="events"]')!;
    const box = container.querySelector('[data-box]')!;
    expect(btn.getAttribute('aria-pressed')).toBe('false');
    expect(btn.querySelector('[data-icon="arrow-up-down"]')).not.toBeNull();
    fireEvent.click(btn);
    expect(box.hasAttribute('data-reorder-on')).toBe(true);
    expect(btn.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(btn);
    expect(box.hasAttribute('data-reorder-on')).toBe(false);
  });
});
