// 라벨 쓰기 묶음 (순수) - 바뀐 칸만·옮긴 것만·지운 표시, 이름 검사, 기본 라벨. 그리고 고르기의 라벨 트리·라벨로 보기·붙은 수
import { describe, expect, it, vi } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import { createLabelOp, defaultLabelOps, labelNameProblem, labelSaveOps, type LabelDraft } from './labels';
import { itemsMatching, labelTreeOf, labelUsageOf, type Docs } from './select';
import { DEFAULT_LABELS, labelProps } from '../domain/labels';
import type { Stored } from './types';

vi.mock('./firebase', () => ({ auth: {}, db: {} }));

const t = (s: number) => new Timestamp(s, 0);
type L = Stored<'labels'>;
type I = Stored<'items'>;

function label(id: string, fields: Partial<L>): L {
  return { id, kind: 'note', name: id, color: 'blue', parentId: null, order: 'a0', deletedAt: null, updatedAt: t(1), v: 1, createdAt: 0, authorId: 'me', ...fields } as L;
}
function item(id: string, fields: Partial<I>): I {
  return { id, kind: 'note', date: null, text: id, labelIds: [], order: 'a0', deletedAt: null, updatedAt: t(1), v: 1, createdAt: 0, authorId: 'me', ...fields } as I;
}
const docsOf = <T extends { id: string }>(...list: T[]) => Object.fromEntries(list.map((d) => [d.id, d]));
const draft = (l: L, change: Partial<LabelDraft> = {}): LabelDraft => ({ id: l.id, name: l.name, color: l.color, parentId: l.parentId, props: l.props, ...change });

const work = label('w', { name: '업무', order: 'a0' });
const school = label('s', { name: '학교', order: 'a1' });
const aSchool = label('a', { name: 'A초', order: 'a2', parentId: 's' });
const live = [work, school, aSchool];

describe('라벨 관리 창의 저장 → 쓰기 묶음', () => {
  it('아무것도 안 바꾸면 쓰지 않는다', () => {
    expect(labelSaveOps('u_me', 'note', live, live.map((l) => draft(l)), [])).toEqual([]);
  });

  it('이름을 바꾸면 그 라벨 문서 하나의 name 칸만 (끝 조건)', () => {
    const ops = labelSaveOps('u_me', 'note', live, [draft(work, { name: ' 공문 ' }), draft(school), draft(aSchool)], []);
    expect(ops).toEqual([{ type: 'patch', at: { sid: 'u_me', coll: 'labels', id: 'w' }, changes: { name: '공문' }, before: work }]);
  });

  it('색·상위를 바꾸면 그 칸만', () => {
    const ops = labelSaveOps('u_me', 'note', live, [draft(work, { color: 'red', parentId: 's' }), draft(school), draft(aSchool, { parentId: null })], []);
    expect(ops.map((o) => (o.type === 'patch' ? [o.at.id, o.changes] : null))).toEqual([
      ['w', { color: 'red', parentId: 's' }],
      ['a', { parentId: null }],
    ]);
  });

  it('▲▼로 이웃을 바꾸면 하나만 새 차례 값', () => {
    const ops = labelSaveOps('u_me', 'note', live, [draft(school), draft(work), draft(aSchool)], []);
    expect(ops).toHaveLength(1);
    const op = ops[0];
    if (op.type !== 'patch') throw new Error('patch여야 한다');
    expect(Object.keys(op.changes)).toEqual(['order']);
    // 새 줄: 학교(a1) < 업무 < A초(a2)  또는  업무 < 학교 ... - 어느 쪽이든 새 값이 줄을 지킨다
    const orders = { s: 'a1', w: 'a0', a: 'a2', [op.at.id]: op.changes.order as string };
    expect(orders.s < orders.w && orders.w < orders.a).toBe(true);
  });

  it('지운 라벨은 지운 표시 (하위 문서는 고쳐 쓰지 않는다)', () => {
    const ops = labelSaveOps('u_me', 'note', live, [draft(work), draft(aSchool)], ['s']);
    expect(ops).toEqual([{ type: 'remove', at: { sid: 'u_me', coll: 'labels', id: 's' } }]);
  });

  it('일정 라벨 속성: 같은 값이면 쓰지 않고(달력은 적지 않았으면 켜짐), 바뀌면 모두 채워 적는다', () => {
    const ev = label('e', { kind: 'event', name: '회의', props: undefined });
    expect(labelSaveOps('u_me', 'event', [ev], [draft(ev, { props: { calendar: true } })], [])).toEqual([]);
    const ops = labelSaveOps('u_me', 'event', [ev], [draft(ev, { props: { forward: true } })], []);
    expect(ops[0]).toMatchObject({ type: 'patch', changes: { props: labelProps({ forward: true }) } });
  });

  it('창을 연 뒤 다른 기기에서 지운 라벨은 건너뛴다', () => {
    expect(labelSaveOps('u_me', 'note', [work], [draft(work), draft(school, { name: '새 이름' })], ['s'])).toEqual([]);
  });
});

describe('새 라벨·기본 라벨', () => {
  it('새 라벨은 그 종류의 맨 뒤, 이름은 다듬고(#·빈칸), 일정 라벨만 속성·메모·기록만 상위', () => {
    const { op, id } = createLabelOp('u_me', 'note', { name: ' #회의 ', color: 'green', parentId: 's' }, live);
    expect(op).toMatchObject({ type: 'create', at: { sid: 'u_me', coll: 'labels', id }, data: { kind: 'note', name: '회의', parentId: 's' } });
    if (op.type !== 'create') throw new Error();
    expect((op.data.order as string) > 'a2').toBe(true);
    expect(op.data.props).toBeUndefined();
    const ev = createLabelOp('u_me', 'event', { name: '행사', color: 'red', parentId: 's' }, []).op;
    expect(ev).toMatchObject({ data: { kind: 'event', parentId: null, order: 'a0', props: labelProps({}) } });
  });

  it('기본 라벨은 정해 둔 id로 차례대로 (두 기기에서 함께 눌러도 겹치지 않는다)', () => {
    const ops = defaultLabelOps('u_me', 'event');
    expect(ops.map((o) => o.at.id)).toEqual(DEFAULT_LABELS.event.map((d) => d.id));
    const orders = ops.map((o) => (o.type === 'create' ? (o.data.order as string) : ''));
    expect([...orders].sort()).toEqual(orders);
  });

  it('이름 검사: 빈 이름·같은 이름(다듬은 뒤)', () => {
    expect(labelNameProblem([{ name: '업무' }, { name: '학교' }])).toBeNull();
    expect(labelNameProblem([{ name: '업무' }, { name: ' ' }])).toMatch(/빈/);
    expect(labelNameProblem([{ name: '업무' }, { name: '#업무 ' }])).toMatch(/'업무' 라벨이 둘/);
  });
});

describe('고르기 - 라벨 트리·라벨로 보기·붙은 수', () => {
  const labels: Docs<'labels'> = docsOf(
    work,
    aSchool,
    school,
    label('gone', { order: 'a3', deletedAt: t(5) }),
    label('orphan', { order: 'a4', parentId: 'gone' }),
    label('ev2', { kind: 'event', order: 'b0', parentId: 'w' }),
    label('ev1', { kind: 'event', order: 'a0' }),
  );

  it('트리 차례·상위/하위·기본 라벨 (지운 상위의 하위는 맨 위 단계, 일정 라벨은 트리가 없다)', () => {
    const note = labelTreeOf(labels, 'note');
    expect(note.rows.map((r) => `${r.depth}:${r.id}`)).toEqual(['0:w', '0:s', '1:a', '0:orphan']);
    expect(note.parents).toEqual({ a: 's' });
    expect(note.defaultId).toBe('w');
    const ev = labelTreeOf(labels, 'event');
    expect(ev.list.map((l) => l.id)).toEqual(['ev1', 'ev2']);
    expect(ev.parents).toEqual({});
    expect(ev.defaultId).toBe('ev1');
    // 같은 문서 표면 같은 것을 돌려준다 (그릴 때마다 새 객체면 effect가 돈다)
    expect(labelTreeOf(labels, 'note')).toBe(note);
  });

  const items: Docs<'items'> = docsOf(
    item('m1', { labelIds: ['s'] }),
    item('m2', { labelIds: ['a', 's'] }),
    item('r1', { date: '2026-10-08', labelIds: ['a'] }),
    item('e1', { kind: 'event', date: '2026-10-08', labelIds: ['ev1'] }),
    item('t1', { labelIds: ['w'], deletedAt: t(9) }),
  );

  it('라벨로 보기: 상위를 고르면 하위도, 기타 = 상위만', () => {
    const { parents } = labelTreeOf(labels, 'note');
    expect(itemsMatching(items, { labels: ['s'], others: [] }, parents, 'note').map((d) => d.id).sort()).toEqual(['m1', 'm2', 'r1']);
    expect(itemsMatching(items, { labels: [], others: ['s'] }, parents).map((d) => d.id)).toEqual(['m1']);
    // 지운 것은 빼고
    expect(itemsMatching(items, { labels: ['w'], others: [] }, parents)).toEqual([]);
  });

  it('붙은 수: 메모·기록·일정·휴지통, 상위는 하위가 붙은 것도(한 항목은 한 번)', () => {
    const usage = labelUsageOf(items, labelTreeOf(labels, 'note').parents);
    expect(usage.s).toEqual({ memo: 2, record: 1, event: 0, trash: 0 });
    expect(usage.a).toEqual({ memo: 1, record: 1, event: 0, trash: 0 });
    expect(usage.w).toEqual({ memo: 0, record: 0, event: 0, trash: 1 });
    expect(usage.ev1).toEqual({ memo: 0, record: 0, event: 1, trash: 0 });
    expect(usage.orphan).toBeUndefined();
  });
});

describe('빈 라벨 정리·지운 라벨 복구 목록', () => {
  it('빈 라벨: 하위가 있는 상위와 맨 위(기본) 라벨은 처음에 체크를 뺀다', async () => {
    const { emptyLabelsOf } = await import('./select');
    const rows = [
      { id: 'top', depth: 0 as const, hasChildren: false },
      { id: 'p', depth: 0 as const, hasChildren: true },
      { id: 'c', depth: 1 as const, parent: 'p', hasChildren: false },
      { id: 'used', depth: 0 as const, hasChildren: false },
    ];
    expect(emptyLabelsOf(rows, { used: { memo: 1, record: 0, event: 0, trash: 0 } })).toEqual([
      { id: 'top', checked: false },
      { id: 'p', checked: false },
      { id: 'c', checked: true },
    ]);
  });

  it('지운 라벨 가운데 살아 있는 항목에 붙은 것만', async () => {
    const { missingLabelsOf } = await import('./select');
    const labels = docsOf(label('del', { deletedAt: t(3) }), label('del2', { deletedAt: t(4) }), label('ok', {}));
    const items = docsOf(item('i1', { labelIds: ['del', 'ok'] }), item('i2', { labelIds: ['del2'], deletedAt: t(5) }));
    expect(missingLabelsOf(labels, items).map((l) => l.id)).toEqual(['del']);
  });
});

describe('이름으로 라벨 찾기·만들기 (쓰는 칸의 새 라벨·#라벨)', () => {
  it('있는 이름은 그 라벨, 없는 이름은 맨 뒤에 차례대로 새로, 겹친 이름은 하나', async () => {
    const { ensureLabelOps } = await import('./labels');
    const { ids, ops } = ensureLabelOps('u_me', 'note', ['#업무', '회의', ' 회의 ', '공문', ''], live);
    expect(ids[0]).toBe('w');
    expect(ids).toHaveLength(3);
    expect(ops.map((o) => (o.type === 'create' ? [o.at.id, o.data.name] : null))).toEqual([
      [ids[1], '회의'],
      [ids[2], '공문'],
    ]);
    const orders = ops.map((o) => (o.type === 'create' ? (o.data.order as string) : ''));
    expect('a2' < orders[0] && orders[0] < orders[1]).toBe(true);
  });
});
