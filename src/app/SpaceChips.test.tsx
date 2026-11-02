import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SpaceChips from './SpaceChips';
import SecondRow from './SecondRow';
import { useNav } from './nav';
import * as keys from './keys';
import { useSession } from '../data/session';
import { useMySpaces, useSpaceChoice, useSpaceOverlay } from '../data/spaceChoice';

vi.mock('../data/firebase', () => ({ auth: {}, db: {}, googleProvider: {} }));

const group = (id: string, name: string) => ({ id, name, ownerId: 'u1', members: { u1: 'owner' as const } });
const pressed = (c: HTMLElement) => [...c.querySelectorAll<HTMLElement>('[data-space-chip][aria-pressed="true"]')].map((b) => b.dataset.spaceChip);

beforeEach(() => {
  useSession.setState({ loading: false, user: { uid: 'u1', email: 't@example.com', displayName: '김선생', photoURL: '' } });
  useSpaceChoice.setState({ uid: 'u1', sid: null, known: [] });
  useMySpaces.setState({ groups: [], loaded: true });
  useSpaceOverlay.setState({ uid: null, sids: [] });
  useNav.setState({ scope: 'day' });
});

describe('공간 칩 줄 (P17-1)', () => {
  it('든 그룹이 없으면 없다 · 있으면 🔒 개인 · 👥 그룹들 · ⚙️', () => {
    const { container } = render(<SpaceChips />);
    expect(container.querySelector('[data-space-chips]')).toBeNull();
    act(() => useMySpaces.setState({ groups: [group('g_a', '협의회'), group('g_b', '5학년')], loaded: true }));
    expect([...container.querySelectorAll<HTMLElement>('[data-space-chip]')].map((b) => b.textContent)).toEqual(['🔒 개인', '👥 협의회', '👥 5학년']);
    expect(container.querySelector('[data-space-chip-manage]')).not.toBeNull();
  });

  it('지금 공간 칩만 aria-pressed · 그냥 누르기 = 그 공간을 본다 (이 기기에)', async () => {
    const user = userEvent.setup();
    useMySpaces.setState({ groups: [group('g_a', '협의회')], loaded: true });
    const { container } = render(<SpaceChips />);
    expect(pressed(container)).toEqual(['u_u1']);
    await user.click(container.querySelector('[data-space-chip="g_a"]')!);
    expect(useSpaceChoice.getState().sid).toBe('g_a');
    expect(pressed(container)).toEqual(['g_a']);
    await user.click(container.querySelector('[data-space-chip="u_u1"]')!);
    expect(useSpaceChoice.getState().sid).toBeNull();
    expect(pressed(container)).toEqual(['u_u1']);
  });

  it('목록을 받기 전에는 고른 그룹을 믿고 그 칩을 누른 채로', () => {
    useSpaceChoice.setState({ uid: 'u1', sid: 'g_a', known: ['g_a'] });
    useMySpaces.setState({ groups: [], loaded: false });
    const { container } = render(<SpaceChips />);
    expect(pressed(container)).toEqual(['g_a']);
  });

  it('⚙️ = 공유 그룹 창', async () => {
    const user = userEvent.setup();
    const run = vi.spyOn(keys, 'runFromButton').mockImplementation(() => {});
    useMySpaces.setState({ groups: [group('g_a', '협의회')], loaded: true });
    const { container } = render(<SpaceChips />);
    await user.click(container.querySelector('[data-space-chip-manage]')!);
    expect(run).toHaveBeenCalledWith('group');
    run.mockRestore();
  });

  it('둘째 줄에 들어간다 - 년간은 학기 칩과 같은 아랫줄 묶음', () => {
    useMySpaces.setState({ groups: [group('g_a', '협의회')], loaded: true });
    const { container } = render(<SecondRow />);
    expect(container.querySelector('[data-second-row] [data-space-chips]')).not.toBeNull();
    act(() => useNav.setState({ scope: 'year' }));
    const sem = container.querySelector('[data-semester]')!;
    const chips = container.querySelector('[data-space-chips]')!;
    expect(sem.closest('.order-3')).toBe(chips.closest('.order-3'));
  });
});

describe('겹쳐 보기 칩 (P17-2)', () => {
  const overlaid = (c: HTMLElement) => [...c.querySelectorAll<HTMLElement>('[data-space-chip][data-space-overlay]')].map((b) => b.dataset.spaceChip);
  const chip = (c: HTMLElement, sid: string) => c.querySelector<HTMLElement>(`[data-space-chip="${sid}"]`)!;
  beforeEach(() => useMySpaces.setState({ groups: [group('g_a', '협의회'), group('g_b', '5학년')], loaded: true }));

  it('Ctrl·Shift+누르기 = 더하기·빼기 (✓·색 점, aria-pressed는 주 공간만) · 주 공간 칩에는 듣지 않는다', () => {
    const { container } = render(<SpaceChips />);
    fireEvent.click(chip(container, 'g_a'), { ctrlKey: true });
    fireEvent.click(chip(container, 'g_b'), { shiftKey: true });
    expect(overlaid(container)).toEqual(['g_a', 'g_b']);
    expect(pressed(container)).toEqual(['u_u1']);
    expect(chip(container, 'g_a').textContent).toBe('✓👥 협의회');
    expect(chip(container, 'g_a').querySelector('[data-space-dot]')).not.toBeNull();
    fireEvent.click(chip(container, 'u_u1'), { ctrlKey: true });
    expect(overlaid(container)).toEqual(['g_a', 'g_b']);
    expect(useSpaceChoice.getState().sid).toBeNull();
    fireEvent.click(chip(container, 'g_a'), { metaKey: true });
    expect(overlaid(container)).toEqual(['g_b']);
  });

  it('그냥 누르기 = 그 공간 하나 (겹쳐 보기를 끈다 - 라벨 칩 탐색기식)', () => {
    const { container } = render(<SpaceChips />);
    fireEvent.click(chip(container, 'g_a'), { ctrlKey: true });
    fireEvent.click(chip(container, 'g_b'));
    expect(pressed(container)).toEqual(['g_b']);
    expect(overlaid(container)).toEqual([]);
    expect(useSpaceOverlay.getState().sids).toEqual([]);
  });

  it('휴대폰 길게 누르기 = Ctrl+누르기 (손을 뗀 click은 넘긴다)', () => {
    vi.useFakeTimers();
    try {
      const { container } = render(<SpaceChips />);
      fireEvent.pointerDown(chip(container, 'g_b'), { pointerType: 'touch', clientX: 5, clientY: 5 });
      act(() => vi.advanceTimersByTime(600));
      fireEvent.pointerUp(chip(container, 'g_b'), { pointerType: 'touch' });
      fireEvent.click(chip(container, 'g_b'));
      expect(overlaid(container)).toEqual(['g_b']);
      expect(pressed(container)).toEqual(['u_u1']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('PC에는 보이는 글 · 겹친 공간을 주 공간으로 고르면 겹친 것에서 빠진다', () => {
    const { container } = render(<SpaceChips />);
    expect(container.querySelector('[data-space-overlay-hint]')?.textContent).toBe('Ctrl+누르기 = 겹쳐 보기');
    fireEvent.click(chip(container, 'g_a'), { ctrlKey: true });
    fireEvent.click(chip(container, 'u_u1'), { ctrlKey: true });
    act(() => useSpaceChoice.setState({ uid: 'u1', sid: 'g_a' }));
    expect(pressed(container)).toEqual(['g_a']);
    expect(overlaid(container)).toEqual([]);
  });
});
