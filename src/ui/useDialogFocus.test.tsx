// 화면을 덮는 창의 초점 (P22-7): 열면 안으로 · autoFocus 칸은 그대로 · Tab은 안에서 돈다 · 닫으면 연 단추로 · 오른쪽 줄 칸은 가두지 않는다
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, fireEvent, render } from '@testing-library/react';
import { useState } from 'react';
import { resetHistoryForTest } from '../app/history';
import { setPopupStyle } from '../app/layoutPrefs';
import PopupFrame from './PopupFrame';

function wideScreen(on: boolean) {
  window.matchMedia = ((query: string) => ({ matches: on, media: query, addEventListener: () => {}, removeEventListener: () => {} })) as unknown as typeof window.matchMedia;
}

function Page({ autoFocus = false }: { autoFocus?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" data-opener onClick={() => setOpen(true)}>
        열기
      </button>
      <button type="button" data-behind>
        뒤
      </button>
      <PopupFrame isOpen={open} onClose={() => setOpen(false)} ariaLabel="시험 창">
        <button type="button" data-first>
          첫
        </button>
        {/* oxlint-disable-next-line jsx-a11y/no-autofocus */}
        <input data-field autoFocus={autoFocus} />
        <button type="button" data-last onClick={() => setOpen(false)}>
          닫기
        </button>
      </PopupFrame>
    </div>
  );
}

const q = (s: string) => document.querySelector<HTMLElement>(s)!;
const tab = (shift = false) => fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Tab', shiftKey: shift });

const realRects = HTMLElement.prototype.getClientRects;
beforeEach(() => {
  resetHistoryForTest();
  setPopupStyle('center');
  wideScreen(true);
  // jsdom은 자리를 재지 않는다 - 모두 보이는 것으로
  HTMLElement.prototype.getClientRects = function () {
    return [{}] as unknown as DOMRectList;
  };
});
afterEach(() => {
  HTMLElement.prototype.getClientRects = realRects;
  document.body.innerHTML = '';
});

describe('가운데 창 초점', () => {
  it('열면 창 판으로, aria-modal · 닫으면 연 단추로 돌아온다', () => {
    render(<Page />);
    q('[data-opener]').focus();
    fireEvent.click(q('[data-opener]'));
    const card = q('[data-popup-card]');
    expect(card.getAttribute('aria-modal')).toBe('true');
    expect(document.activeElement).toBe(card);
    act(() => q('[data-last]').click());
    expect(document.querySelector('[data-popup-card]')).toBeNull();
    expect(document.activeElement).toBe(q('[data-opener]'));
  });

  it('안의 칸이 autoFocus면 그대로 둔다', () => {
    render(<Page autoFocus />);
    q('[data-opener]').focus();
    fireEvent.click(q('[data-opener]'));
    expect(document.activeElement).toBe(q('[data-field]'));
  });

  it('Tab·Shift+Tab은 창 안에서 돈다 (뒤 화면으로 나가지 않는다)', () => {
    render(<Page />);
    q('[data-opener]').focus();
    fireEvent.click(q('[data-opener]'));
    q('[data-last]').focus();
    tab();
    expect(document.activeElement).toBe(q('[data-first]'));
    tab(true);
    expect(document.activeElement).toBe(q('[data-last]'));
    q('[data-popup-card]').focus();
    tab(true);
    expect(document.activeElement).toBe(q('[data-last]'));
  });

  it('창 안 칸이 Tab을 스스로 쓰면 그쪽이 먼저', () => {
    render(<Page />);
    fireEvent.click(q('[data-opener]'));
    q('[data-last]').focus();
    q('[data-last]').addEventListener('keydown', (e) => e.preventDefault());
    tab();
    expect(document.activeElement).toBe(q('[data-last]'));
  });

  it('오른쪽 줄에 붙은 창은 초점을 옮기지도 가두지도 않는다', () => {
    setPopupStyle('side');
    render(<Page />);
    q('[data-opener]').focus();
    fireEvent.click(q('[data-opener]'));
    const card = q('[data-popup-card]');
    expect(card.getAttribute('aria-modal')).toBeNull();
    expect(document.activeElement).toBe(q('[data-opener]'));
  });
});
