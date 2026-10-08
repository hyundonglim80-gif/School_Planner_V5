import { describe, expect, it } from 'vitest';
import {
  clickFilterLabel,
  EMPTY_FILTER,
  expandLabel,
  filterChipOrder,
  isOtherKey,
  labelPath,
  matchLabels,
  orderByTree,
  otherKey,
  parentCandidates,
  parentMapOf,
  pruneFilter,
  readLabelFilter,
  toggleFilterLabel,
} from './labelTree';

// V4 lib/labelTree.test.ts를 id로. 메모·기록 라벨 상위/하위 (2단계). 예: 학교 › A초·B초·C초
// id는 이름과 다르게 둔다(이름이 아니라 id로 다루는지 보려고)
const NAMES: Record<string, string> = { w: '업무', s: '학교', a: 'A초', b: 'B초', p: '개인', c: 'C초' };
const ids = ['w', 's', 'a', 'b', 'p', 'c'];
const parents = { a: 's', b: 's', c: 's' };
const nameOf = (id: string) => NAMES[id];

describe('parentMapOf - 문서의 parentId를 다듬는다', () => {
  it('상위가 목록에 있으면 그대로', () => {
    expect(parentMapOf([{ id: 's', parentId: null }, { id: 'a', parentId: 's' }])).toEqual({ a: 's' });
  });

  it('자기 자신·목록에 없는 상위(지웠거나 다른 종류)는 버린다 - 그 하위는 맨 위 단계', () => {
    expect(parentMapOf([{ id: 'x', parentId: 'x' }, { id: 'a', parentId: 'gone' }])).toEqual({});
  });

  it('3단계는 끊는다 (앞 차례부터 보아 - 어느 기기에서나 같다)', () => {
    // a → s → g : a를 먼저 보니 상위 s가 다시 하위라 a를 끊고, s → g는 남는다 (V4 sanitizeParents와 같다)
    const m = parentMapOf([
      { id: 'a', parentId: 's' },
      { id: 's', parentId: 'g' },
      { id: 'g', parentId: null },
    ]);
    expect(m).toEqual({ s: 'g' });
  });
});

describe('라벨 트리', () => {
  it('상위는 원래 차례대로, 하위는 제 상위 바로 뒤에', () => {
    expect(orderByTree(ids, parents).map((r) => `${r.depth}:${nameOf(r.id)}`)).toEqual([
      '0:업무',
      '0:학교',
      '1:A초',
      '1:B초',
      '1:C초',
      '0:개인',
    ]);
    expect(orderByTree(ids, parents).find((r) => r.id === 's')?.hasChildren).toBe(true);
  });

  it('상위와 그 하위 (expandLabel)', () => {
    expect(expandLabel('s', parents).sort()).toEqual(['a', 'b', 'c', 's']);
    expect(expandLabel('a', parents)).toEqual(['a']);
  });

  it('상위가 목록에서 사라진 하위는 맨 위 단계로 보인다', () => {
    expect(orderByTree(['a', 'w'], { a: 's' }).map((r) => r.depth)).toEqual([0, 0]);
  });

  it("칩에 마우스를 올리면 '상위 › 하위'", () => {
    expect(labelPath('a', parents, nameOf)).toBe('학교 › A초');
    expect(labelPath('w', parents, nameOf)).toBe('업무');
  });

  it('2단계까지만: 하위가 있는 라벨은 상위를 못 두고, 하위인 라벨은 상위가 될 수 없다', () => {
    expect(parentCandidates('s', ids, parents)).toEqual([]);
    expect(parentCandidates('w', ids, parents)).toEqual(['s', 'p']);
  });
});

describe('라벨로 보기 (V4 19번 U8 - 상위를 고르면 하위도, 기타 = 상위만)', () => {
  it('아무것도 안 고르면 전체, 상위를 고르면 하위가 붙은 항목도', () => {
    expect(matchLabels(['zz'], EMPTY_FILTER, parents)).toBe(true);
    expect(matchLabels(undefined, EMPTY_FILTER, parents)).toBe(true);
    const school = { labels: ['s'], others: [] };
    expect(matchLabels(['s'], school, parents)).toBe(true);
    expect(matchLabels(['a'], school, parents)).toBe(true);
    expect(matchLabels(['w'], school, parents)).toBe(false);
    expect(matchLabels(undefined, school, parents)).toBe(false);
    // 하위 하나만 고르면 그것만
    expect(matchLabels(['b'], { labels: ['a'], others: [] }, parents)).toBe(false);
    expect(matchLabels(['s'], { labels: ['a'], others: [] }, parents)).toBe(false);
  });

  it("'기타' = 그 상위가 붙었지만 하위는 하나도 안 붙은 항목", () => {
    const other = { labels: [], others: ['s'] };
    expect(matchLabels(['s'], other, parents)).toBe(true);
    expect(matchLabels(['s', 'w'], other, parents)).toBe(true);
    expect(matchLabels(['s', 'a'], other, parents)).toBe(false);
    expect(matchLabels(['a'], other, parents)).toBe(false);
    // 여러 개는 하나라도
    expect(matchLabels(['w'], { labels: ['w'], others: ['s'] }, parents)).toBe(true);
  });

  it('기억해 둔 값을 읽는다 - 틀린 칸은 버린다', () => {
    expect(readLabelFilter({ labels: ['s', 3, ''], others: ['s'] })).toEqual({ labels: ['s'], others: ['s'] });
    expect(readLabelFilter(null)).toEqual(EMPTY_FILTER);
    expect(readLabelFilter('s')).toEqual(EMPTY_FILTER);
  });

  it('칩 누르기: 붙이고 떼기 (기타 칩도)', () => {
    const one = toggleFilterLabel(EMPTY_FILTER, 's');
    expect(one).toEqual({ labels: ['s'], others: [] });
    const two = toggleFilterLabel(one, otherKey('s'));
    expect(two).toEqual({ labels: ['s'], others: ['s'] });
    expect(toggleFilterLabel(two, 's')).toEqual({ labels: [], others: ['s'] });
    expect(isOtherKey(otherKey('s'))).toBe(true);
    expect(isOtherKey('기타')).toBe(false); // 진짜 '기타' 라벨과 다르다
  });

  it('탐색기처럼 고르기: 그냥 = 하나, Ctrl = 더하기·빼기, Shift = 범위(기타 칩 포함), Ctrl+Shift = 범위 더하기', () => {
    const order = ['w', 's', 'a', 'b', otherKey('s'), 'p'];
    const plain = { ctrl: false, shift: false };
    const f1 = clickFilterLabel({ labels: ['w', 's'], others: ['s'] }, 'a', plain, order, null);
    expect(f1).toEqual({ labels: ['a'], others: [] });
    const f2 = clickFilterLabel(f1, 'w', { ctrl: true, shift: false }, order, 'a');
    expect(f2.labels).toEqual(['a', 'w']);
    expect(clickFilterLabel(f2, 'w', { ctrl: true, shift: false }, order, 'w').labels).toEqual(['a']);
    // 기준(업무)부터 B초까지, 거꾸로 눌러도 같다
    expect(clickFilterLabel(EMPTY_FILTER, 'b', { ctrl: false, shift: true }, order, 'w').labels).toEqual(['w', 's', 'a', 'b']);
    expect(clickFilterLabel(EMPTY_FILTER, 'w', { ctrl: false, shift: true }, order, 'a').labels).toEqual(['w', 's', 'a']);
    expect(clickFilterLabel({ labels: ['p'], others: [] }, 'b', { ctrl: true, shift: true }, order, 'a').labels).toEqual(['p', 'a', 'b']);
    // 범위에 기타 칩이 들면 others로
    expect(clickFilterLabel(EMPTY_FILTER, 'p', { ctrl: false, shift: true }, order, 'b')).toEqual({ labels: ['b', 'p'], others: ['s'] });
    // 기준이 없으면 Shift도 하나만
    expect(clickFilterLabel(EMPTY_FILTER, 's', { ctrl: false, shift: true }, order, null).labels).toEqual(['s']);
    // 기타 칩 그냥 누르기
    expect(clickFilterLabel(f2, otherKey('s'), plain, order, null)).toEqual({ labels: [], others: ['s'] });
  });

  it('칩 차례: 접힌 상위의 하위·기타는 빼되 골라 둔 것은 보인다', () => {
    const rows = orderByTree(ids, parents);
    expect(filterChipOrder(rows, () => true, () => false)).toEqual(['w', 's', 'a', 'b', 'c', otherKey('s'), 'p']);
    expect(filterChipOrder(rows, () => false, (k) => k === 'b')).toEqual(['w', 's', 'b', 'p']);
  });

  it('지운 라벨은 거르개에서 뺀다', () => {
    expect(pruneFilter({ labels: ['s', 'gone'], others: ['gone', 's'] }, ids)).toEqual({ labels: ['s'], others: ['s'] });
  });
});
