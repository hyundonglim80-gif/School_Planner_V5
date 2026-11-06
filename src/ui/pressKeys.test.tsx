// 카드·달력 칸 키보드 (P22-7): Enter·Space = 누르기 · 안쪽 칸에서 친 키·조합 키는 그대로
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { pressKeys } from './pressKeys';

function Card({ onClick }: { onClick: () => void }) {
  return (
    <div data-card role="button" tabIndex={0} onKeyDown={pressKeys} onClick={onClick}>
      <input data-inner />
    </div>
  );
}

describe('pressKeys', () => {
  it('Enter·Space = 누르기, Space는 화면을 내리지 않는다', () => {
    const onClick = vi.fn();
    const { container } = render(<Card onClick={onClick} />);
    const card = container.querySelector<HTMLElement>('[data-card]')!;
    fireEvent.keyDown(card, { key: 'Enter' });
    const space = fireEvent.keyDown(card, { key: ' ' });
    expect(onClick).toHaveBeenCalledTimes(2);
    expect(space).toBe(false); // preventDefault
    fireEvent.keyDown(card, { key: 'a' });
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it('안쪽 칸에서 친 키·Ctrl·Alt 조합(단축키)은 누르기가 아니다', () => {
    const onClick = vi.fn();
    const { container } = render(<Card onClick={onClick} />);
    fireEvent.keyDown(container.querySelector('[data-inner]')!, { key: 'Enter' });
    fireEvent.keyDown(container.querySelector('[data-card]')!, { key: 'Enter', ctrlKey: true });
    fireEvent.keyDown(container.querySelector('[data-card]')!, { key: 'Enter', altKey: true });
    expect(onClick).not.toHaveBeenCalled();
  });
});
