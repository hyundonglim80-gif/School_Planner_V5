// 라벨 칩·고르기 - 고른 것은 id로, 메모·기록은 트리 차례(└), 새 라벨은 저장 때 만들 이름으로, ⚙️ = 라벨 관리 그 탭
// 칩 목록은 '라벨 [고른 라벨 ▾]' 단추를 누르면 뜨는 판에 (11-25 메모 요청 #204 - 닫혀도 DOM에 숨어 있다)
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render } from '@testing-library/react';
import { Timestamp } from 'firebase/firestore';
import { useState } from 'react';
import { labelTreeOf, itemLabels, type Docs } from '../../data/select';
import type { Stored } from '../../data/types';
import LabelChip, { LabelChips } from './LabelChip';
import LabelPicker from './LabelPicker';

vi.mock('../../data/firebase', () => ({ auth: {}, db: {} }));
const openWindow = vi.hoisted(() => vi.fn());
vi.mock('../../app/windows', () => ({ openWindow }));

const t = new Timestamp(1, 0);
type L = Stored<'labels'>;
const label = (id: string, f: Partial<L>): L =>
  ({ id, kind: 'note', name: id, color: 'blue', parentId: null, order: 'a0', deletedAt: null, updatedAt: t, v: 1, createdAt: 0, authorId: 'me', ...f }) as L;
const docs: Docs<'labels'> = Object.fromEntries(
  [
    label('w', { name: '업무', order: 'a0' }),
    label('s', { name: '학교', order: 'a1' }),
    label('a', { name: 'A초', order: 'a2', parentId: 's' }),
    label('e1', { kind: 'event', name: '회의', color: 'red', order: 'a0' }),
    label('e2', { kind: 'event', name: '행사', order: 'a1' }),
    label('gone', { kind: 'event', name: '지움', order: 'a2', deletedAt: t }),
  ].map((l) => [l.id, l]),
);

const q = (s: string) => document.querySelector<HTMLElement>(s)!;
const qa = (s: string) => [...document.querySelectorAll<HTMLElement>(s)];

function Harness({ kind, withNew }: { kind: 'event' | 'note'; withNew?: boolean }) {
  const [ids, setIds] = useState<string[]>([]);
  const [names, setNames] = useState<string[]>([]);
  return (
    <>
      <LabelPicker
        kind={kind}
        tree={labelTreeOf(docs, kind)}
        selected={ids}
        onChange={setIds}
        newNames={names}
        onNewNamesChange={withNew ? setNames : undefined}
      />
      <output data-ids={ids.join()} data-names={names.join()} />
    </>
  );
}
const out = () => q('output');
const isOpen = () => !q('[data-label-picker-pop]').className.split(' ').includes('hidden');
const openPop = () => {
  if (!isOpen()) fireEvent.click(q('[data-label-picker-open]'));
};

beforeEach(() => openWindow.mockClear());

describe('라벨 고르기', () => {
  it('일정: 라벨 차례대로, 눌러서 붙이고 떼기(여러 개), 고른 칩은 라벨 색', () => {
    render(<Harness kind="event" />);
    expect(qa('[data-label-pick]').map((b) => b.dataset.labelPick)).toEqual(['e1', 'e2']);
    openPop();
    fireEvent.click(q('[data-label-pick="e2"]'));
    openPop();
    fireEvent.click(q('[data-label-pick="e1"]'));
    expect(out().dataset.ids).toBe('e1');
    expect(q('[data-label-pick="e1"]')).toHaveAttribute('aria-pressed', 'true');
    expect(q('[data-label-pick="e1"]').style.backgroundColor).not.toBe('');
    openPop();
    fireEvent.click(q('[data-label-pick="e1"]'));
    expect(out().dataset.ids).toBe('');
    // 일정에는 '+ 새 라벨'이 없다 (V4 그대로)
    expect(document.querySelector('[data-label-pick-new]')).toBeNull();
  });

  it('메모·기록: 트리 차례(하위는 └), 마우스를 올리면 상위 › 하위', () => {
    render(<Harness kind="note" />);
    expect(qa('[data-label-pick]').map((b) => b.dataset.labelPick)).toEqual(['w', 's', 'a']);
    expect(q('[data-label-pick="a"]')).toHaveTextContent('└');
    // 첫 줄 = 상위 › 하위, 다음 줄 = 고르는 법 (#200 - PC는 늘 보이던 안내 대신 마우스를 올리면)
    expect(q('[data-label-pick="a"]').title.split('\n')[0]).toBe('학교 › A초');
  });

  it('메모: 그냥 누르면 하나만, Ctrl+누르면 여러 개', () => {
    render(<Harness kind="note" />);
    openPop();
    fireEvent.click(q('[data-label-pick="w"]'));
    // 그냥 누르기 = 하나로 끝 - 판을 닫는다
    expect(isOpen()).toBe(false);
    openPop();
    fireEvent.click(q('[data-label-pick="s"]'), { ctrlKey: true });
    // Ctrl+누르기 = 더 고를 수 있게 판은 열린 채
    expect(isOpen()).toBe(true);
    expect(out().dataset.ids).toBe('w,s');
    fireEvent.click(q('[data-label-pick="a"]'));
    expect(out().dataset.ids).toBe('a');
    openPop();
    fireEvent.click(q('[data-label-pick="w"]'), { ctrlKey: true });
    fireEvent.click(q('[data-label-pick="a"]'), { ctrlKey: true });
    expect(out().dataset.ids).toBe('w');
  });

  it('메모: 휴대폰 길게 누르기 = Ctrl+누르기 (손을 뗀 click은 넘긴다) · 일정은 길게 눌러도 하나만', () => {
    vi.useFakeTimers();
    try {
      const long = (id: string) => {
        const b = q(`[data-label-pick="${id}"]`);
        fireEvent.pointerDown(b, { pointerType: 'touch', clientX: 5, clientY: 5 });
        act(() => vi.advanceTimersByTime(600));
        fireEvent.pointerUp(b, { pointerType: 'touch' });
        fireEvent.click(b);
      };
      const { unmount } = render(<Harness kind="note" />);
      // 휴대폰 안내는 판 위 글('길게 누르기' - PC는 숨김), PC 안내는 라벨 줄 제목·칩에 마우스를 올리면 (#200)
      expect(q('[data-label-picker-pop]')).toHaveTextContent('길게 누르기 = 여러 개');
      expect(q('[data-label-picker-hint]')).not.toHaveTextContent('Ctrl+누르기');
      expect(q('[data-label-picker-hint]').title).toContain('Ctrl+누르기');
      openPop();
      expect(q('[data-label-pick="w"]').title).toContain('Ctrl+누르기 = 여러 개');
      fireEvent.click(q('[data-label-pick="w"]'));
      openPop();
      long('s');
      expect(out().dataset.ids).toBe('w,s');
      // 길게 누르기도 Ctrl처럼 판은 열린 채
      expect(isOpen()).toBe(true);
      long('w');
      expect(out().dataset.ids).toBe('s');
      unmount();
      render(<Harness kind="event" />);
      openPop();
      long('e1');
      openPop();
      long('e2');
      expect(out().dataset.ids).toBe('e2');
    } finally {
      vi.useRealTimers();
    }
  });

  it('새 라벨: 없는 이름은 저장 때 만들 이름으로, 있는 이름은 그 라벨을 고른다, 누르면 뺀다', () => {
    render(<Harness kind="note" withNew />);
    openPop();
    fireEvent.click(q('[data-label-pick-new]'));
    fireEvent.change(q('[data-label-pick-new-input]'), { target: { value: '#회의' } });
    fireEvent.keyDown(q('[data-label-pick-new-input]'), { key: 'Enter' });
    expect(out().dataset.names).toBe('회의');
    fireEvent.click(q('[data-label-pick-new]'));
    fireEvent.change(q('[data-label-pick-new-input]'), { target: { value: '학교' } });
    fireEvent.keyDown(q('[data-label-pick-new-input]'), { key: 'Enter' });
    expect(out().dataset.ids).toBe('s');
    expect(out().dataset.names).toBe('회의');
    // 닫힌 단추에도 고른 라벨·새 라벨 이름
    expect(q('[data-label-picker-open]')).toHaveTextContent('학교');
    expect(q('[data-label-picker-open]')).toHaveTextContent('회의');
    expect(q('[data-label-picker-open]').dataset.labelPickerOpen).toBe('2');
    fireEvent.click(q('[data-label-pick-pending="회의"]'));
    expect(out().dataset.names).toBe('');
  });

  it('새 라벨 칸의 ESC는 그 칸만 접는다 (쓰는 칸을 닫지 않는다)', () => {
    const outer = vi.fn();
    render(
      <div onKeyDown={outer}>
        <Harness kind="note" withNew />
      </div>,
    );
    openPop();
    fireEvent.click(q('[data-label-pick-new]'));
    fireEvent.keyDown(q('[data-label-pick-new-input]'), { key: 'Escape' });
    expect(outer).not.toHaveBeenCalled();
    expect(document.querySelector('[data-label-pick-new-input]')).toBeNull();
    // 판은 열린 채, 초점은 '+ 새 라벨'로 (body로 빠지면 다음 ESC가 쓰는 칸을 닫는다)
    expect(isOpen()).toBe(true);
    expect(document.activeElement).toBe(q('[data-label-pick-new]'));
  });

  it('라벨 판 (#204): 처음엔 접힘 - 단추를 누르면 펴고, ESC는 판만 닫는다(쓰는 칸으로 번지지 않음) · 바깥 누르기도 닫는다', () => {
    const outer = vi.fn();
    render(
      <div onKeyDown={outer}>
        <Harness kind="note" />
        <button type="button" data-outside>
          밖
        </button>
      </div>,
    );
    expect(isOpen()).toBe(false);
    expect(q('[data-label-picker-open]')).toHaveAttribute('aria-expanded', 'false');
    expect(q('[data-label-picker-none]')).toHaveTextContent('라벨 고르기');
    openPop();
    expect(isOpen()).toBe(true);
    expect(q('[data-label-picker]').dataset.labelPickerState).toBe('open');
    // 열면 첫 칩에 초점 - 그 자리의 ESC를 판이 받는다
    expect(document.activeElement).toBe(q('[data-label-pick="w"]'));
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    expect(isOpen()).toBe(false);
    expect(outer).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(q('[data-label-picker-open]'));
    // 닫힌 때의 ESC는 쓰는 칸으로 간다 (칸 닫기)
    fireEvent.keyDown(q('[data-label-picker-open]'), { key: 'Escape' });
    expect(outer).toHaveBeenCalledTimes(1);
    openPop();
    fireEvent.mouseDown(q('[data-outside]'));
    expect(isOpen()).toBe(false);
    // 단추를 다시 누르면 닫는다
    openPop();
    fireEvent.click(q('[data-label-picker-open]'));
    expect(isOpen()).toBe(false);
  });

  it('라벨 판 (#204): 일정은 고르면 판을 닫고, 닫힌 단추에 고른 라벨(라벨 색)', () => {
    render(<Harness kind="event" />);
    openPop();
    expect(document.activeElement).toBe(q('[data-label-pick="e1"]'));
    fireEvent.click(q('[data-label-pick="e2"]'));
    expect(isOpen()).toBe(false);
    expect(q('[data-label-picked="e2"]')).toHaveTextContent('행사');
    expect(q('[data-label-picked="e2"]').style.backgroundColor).not.toBe('');
    expect(q('[data-label-picker-none]')).toBeNull();
    // 다시 열면 고른 칩에 초점
    openPop();
    expect(document.activeElement).toBe(q('[data-label-pick="e2"]'));
  });

  it('⚙️ 라벨 수정 = 라벨 관리 창의 그 탭', () => {
    render(<Harness kind="note" />);
    fireEvent.click(q('[data-label-picker-settings]'));
    expect(openWindow).toHaveBeenCalledWith('labels', { tab: 'note' });
  });
});

describe('라벨 칩', () => {
  it('라벨 색으로, 끝낸 항목은 회색', () => {
    const { rerender } = render(<LabelChip label={{ id: 'e1', name: '회의', color: 'red' }} />);
    expect(q('[data-label-chip="e1"]')).toHaveTextContent('회의');
    expect(q('[data-label-chip="e1"]').style.backgroundColor).toBe('rgb(254, 226, 226)');
    rerender(<LabelChip label={{ id: 'e1', name: '회의', color: 'red' }} muted />);
    expect(q('[data-label-chip="e1"]').style.backgroundColor).toContain('slate');
  });

  it('항목의 라벨은 붙인 차례대로 - 지웠거나 모르는 라벨은 뺀다', () => {
    const tree = labelTreeOf(docs, 'event');
    const labels = itemLabels(tree, ['e2', 'gone', 'nope', 'e1', 'e2']);
    render(<LabelChips labels={labels} />);
    expect(qa('[data-label-chip]').map((c) => c.dataset.labelChip)).toEqual(['e2', 'e1']);
  });
});
