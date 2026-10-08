// 라벨 칩·고르기 - 고른 것은 id로, 메모·기록은 트리 차례(└), 새 라벨은 저장 때 만들 이름으로, ⚙️ = 라벨 관리 그 탭
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
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

beforeEach(() => openWindow.mockClear());

describe('라벨 고르기', () => {
  it('일정: 라벨 차례대로, 눌러서 붙이고 떼기(여러 개), 고른 칩은 라벨 색', () => {
    render(<Harness kind="event" />);
    expect(qa('[data-label-pick]').map((b) => b.dataset.labelPick)).toEqual(['e1', 'e2']);
    fireEvent.click(q('[data-label-pick="e2"]'));
    fireEvent.click(q('[data-label-pick="e1"]'));
    expect(out().dataset.ids).toBe('e2,e1');
    expect(q('[data-label-pick="e1"]')).toHaveAttribute('aria-pressed', 'true');
    expect(q('[data-label-pick="e1"]').style.backgroundColor).not.toBe('');
    fireEvent.click(q('[data-label-pick="e2"]'));
    expect(out().dataset.ids).toBe('e1');
    // 일정에는 '+ 새 라벨'이 없다 (V4 그대로)
    expect(document.querySelector('[data-label-pick-new]')).toBeNull();
  });

  it('메모·기록: 트리 차례(하위는 └), 마우스를 올리면 상위 › 하위', () => {
    render(<Harness kind="note" />);
    expect(qa('[data-label-pick]').map((b) => b.dataset.labelPick)).toEqual(['w', 's', 'a']);
    expect(q('[data-label-pick="a"]')).toHaveTextContent('└');
    expect(q('[data-label-pick="a"]')).toHaveAttribute('title', '학교 › A초');
  });

  it('새 라벨: 없는 이름은 저장 때 만들 이름으로, 있는 이름은 그 라벨을 고른다, 누르면 뺀다', () => {
    render(<Harness kind="note" withNew />);
    fireEvent.click(q('[data-label-pick-new]'));
    fireEvent.change(q('[data-label-pick-new-input]'), { target: { value: '#회의' } });
    fireEvent.keyDown(q('[data-label-pick-new-input]'), { key: 'Enter' });
    expect(out().dataset.names).toBe('회의');
    fireEvent.click(q('[data-label-pick-new]'));
    fireEvent.change(q('[data-label-pick-new-input]'), { target: { value: '학교' } });
    fireEvent.keyDown(q('[data-label-pick-new-input]'), { key: 'Enter' });
    expect(out().dataset.ids).toBe('s');
    expect(out().dataset.names).toBe('회의');
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
    fireEvent.click(q('[data-label-pick-new]'));
    fireEvent.keyDown(q('[data-label-pick-new-input]'), { key: 'Escape' });
    expect(outer).not.toHaveBeenCalled();
    expect(document.querySelector('[data-label-pick-new-input]')).toBeNull();
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
