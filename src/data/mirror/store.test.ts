// 화면 store: 서버 판(늦은 판이 이김) + 내 쓰기 덧칠(먼저 보이고, 서버 판이 오면 걷고, 실패하면 곧바로 걷는다)
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import { writeOp } from '../repo/ops';
import type { DocPath } from '../types';
import {
  applyBase,
  baseDoc,
  beginLocalWrite,
  dropBase,
  endLocalWrite,
  hasOverlay,
  resetMirrorStore,
  setPurgeSink,
  SETTLE_WAIT_MS,
  trackColl,
  useMirror,
} from './store';

const t = (s: number) => new Timestamp(s, 0);
const ctx = { uid: 'me', now: 1000 };
const at = (id: string): DocPath<'items'> => ({ sid: 'u_me', coll: 'items', id });
const shown = (id: string) => useMirror.getState().colls['u_me/items']?.docs[id];
const note = (text: string) => ({ kind: 'note' as const, date: null, text, labelIds: [], order: 'a0' });
const server = (text: string, s: number, extra: Record<string, unknown> = {}) => ({ ...note(text), updatedAt: t(s), deletedAt: null, v: 1, ...extra });

beforeEach(() => {
  resetMirrorStore();
  trackColl('u_me', 'items');
});
afterEach(() => {
  vi.useRealTimers();
  setPurgeSink(null);
});

describe('서버 판', () => {
  it('늦은 판만 들어가고, 보이는 문서에는 자리(id)가 붙는다', () => {
    applyBase('u_me', 'items', new Map([['a', server('새 판', 20)]]));
    expect(applyBase('u_me', 'items', new Map([['a', server('옛 판', 10)]]))).toEqual([]);
    expect(shown('a')).toMatchObject({ id: 'a', text: '새 판' });
    expect(baseDoc('u_me', 'items', 'a')).not.toHaveProperty('id');
  });

  it('받지 않는 컬렉션은 넣지 않는다', () => {
    expect(applyBase('u_me', 'labels', new Map([['l', server('라벨', 1)]]))).toEqual([]);
    expect(useMirror.getState().colls['u_me/labels']).toBeUndefined();
  });

  it('빼기는 그 판까지만', () => {
    applyBase('u_me', 'items', new Map([['a', server('a', 5)], ['b', server('b', 9)]]));
    expect(dropBase('u_me', 'items', [{ id: 'a', upTo: t(5) }, { id: 'b', upTo: t(8) }])).toEqual(['a']);
    expect(shown('a')).toBeUndefined();
    expect(shown('b')).toBeDefined();
  });
});

describe('내 쓰기는 화면에 먼저 (덧칠)', () => {
  it('만들기: 곧바로 보이고(서버 시각은 어림값), 끝나도 서버 판이 올 때까지 둔다', () => {
    const w = beginLocalWrite([writeOp.create(at('n'), note('새 메모'))], ctx);
    expect(shown('n')).toMatchObject({ id: 'n', text: '새 메모', deletedAt: null, authorId: 'me', createdAt: 1000, v: 1 });
    expect(shown('n')!.updatedAt).toBeInstanceOf(Timestamp);
    expect(baseDoc('u_me', 'items', 'n')).toBeUndefined();
    endLocalWrite(w, true);
    expect(hasOverlay('u_me', 'items', 'n')).toBe(true);
    applyBase('u_me', 'items', new Map([['n', server('새 메모', 50)]]));
    expect(hasOverlay('u_me', 'items', 'n')).toBe(false);
    expect((shown('n')!.updatedAt as Timestamp).isEqual(t(50))).toBe(true);
  });

  it('서버 판이 쓰기가 끝나기 전에 오면 끝날 때 걷는다 (판은 그 아래에서 바뀐다)', () => {
    applyBase('u_me', 'items', new Map([['a', server('처음', 1)]]));
    const w = beginLocalWrite([writeOp.patch(at('a'), { text: '고침' }, { text: '처음' })], ctx);
    applyBase('u_me', 'items', new Map([['a', server('고침', 2)]]));
    expect(hasOverlay('u_me', 'items', 'a')).toBe(true);
    endLocalWrite(w, true);
    expect(hasOverlay('u_me', 'items', 'a')).toBe(false);
    expect(shown('a')!.text).toBe('고침');
  });

  it('실패하면 곧바로 걷어 서버 판으로 돌아간다', () => {
    applyBase('u_me', 'items', new Map([['a', server('처음', 1)]]));
    const w = beginLocalWrite([writeOp.patch(at('a'), { text: '못 적음' }, { text: '처음' })], ctx);
    expect(shown('a')!.text).toBe('못 적음');
    endLocalWrite(w, false);
    expect(shown('a')!.text).toBe('처음');
  });

  it('잇단 쓰기: 둘 다 끝나야 걷는다 (앞 것의 서버 판만 와서는 걷지 않는다)', () => {
    applyBase('u_me', 'items', new Map([['a', server('0', 1)]]));
    const w1 = beginLocalWrite([writeOp.patch(at('a'), { text: '1' }, { text: '0' })], ctx);
    const w2 = beginLocalWrite([writeOp.patch(at('a'), { done: true }, {})], ctx);
    expect(shown('a')).toMatchObject({ text: '1', done: true });
    endLocalWrite(w1, true);
    applyBase('u_me', 'items', new Map([['a', server('1', 2)]]));
    expect(shown('a')).toMatchObject({ text: '1', done: true });
    endLocalWrite(w2, true);
    applyBase('u_me', 'items', new Map([['a', server('1', 3, { done: true })]]));
    expect(hasOverlay('u_me', 'items', 'a')).toBe(false);
  });

  it('지우기는 지운 표시, 칸 지우기·깊은 칸도 그대로 얹는다', () => {
    applyBase('u_me', 'items', new Map([['a', server('a', 1, { props: { forward: true, gcal: true }, due: '2026-10-10' })]]));
    beginLocalWrite([writeOp.patch(at('a'), { 'props.forward': false, due: undefined }, {})], ctx);
    expect(shown('a')).toMatchObject({ props: { forward: false, gcal: true } });
    expect(shown('a')).not.toHaveProperty('due');
    beginLocalWrite([writeOp.remove(at('a'))], ctx);
    expect(shown('a')!.deletedAt).toBeInstanceOf(Timestamp);
    expect(shown('a')!.deletedBy).toBe('me');
  });

  it('영구 지우기: 곧바로 사라지고, 끝나면 서버 판에서도 빼며 사본에 알린다', () => {
    const sink = vi.fn();
    setPurgeSink(sink);
    applyBase('u_me', 'items', new Map([['a', server('a', 7, { deletedAt: t(6) })]]));
    const w = beginLocalWrite([writeOp.purge(at('a'), baseDoc('u_me', 'items', 'a') as never)], ctx);
    expect(shown('a')).toBeUndefined();
    endLocalWrite(w, true);
    expect(baseDoc('u_me', 'items', 'a')).toBeUndefined();
    expect(sink).toHaveBeenCalledWith('u_me/items', { id: 'a', upTo: t(7) });
  });

  it('없는 문서를 고치는 쓰기(서버에서 실패한다)와 받지 않는 컬렉션은 얹지 않는다', () => {
    const w = beginLocalWrite(
      [writeOp.patch(at('none'), { text: 'x' }, {}), writeOp.put({ sid: 'u_me', coll: 'settings', id: 'pc' }, { fontScale: 'lg' })],
      ctx,
    );
    expect(w.keys).toEqual([]);
    expect(shown('none')).toBeUndefined();
  });

  it('칸 합치기(날짜 문서)는 없는 문서도 만들어 얹고, 있는 문서는 그 칸만', () => {
    trackColl('u_me', 'lessonDays');
    const day = (id: string): DocPath<'lessonDays'> => ({ sid: 'u_me', coll: 'lessonDays', id });
    const lesson = (id: string) => useMirror.getState().colls['u_me/lessonDays']?.docs[id];
    beginLocalWrite([writeOp.merge(day('2026-10-12'), { 'periods.3.memo': '실험' }, null)], ctx);
    expect(lesson('2026-10-12')).toMatchObject({ periods: { '3': { memo: '실험' } }, v: 1 });
    applyBase('u_me', 'lessonDays', new Map([['2026-10-13', { periods: { '1': { subject: '국어', memo: 'a' } }, updatedAt: t(1), v: 1 }]]));
    beginLocalWrite([writeOp.merge(day('2026-10-13'), { 'periods.1.memo': undefined, 'periods.2.subject': '' }, null)], ctx);
    expect(lesson('2026-10-13')).toMatchObject({ periods: { '1': { subject: '국어' }, '2': { subject: '' } } });
    expect((lesson('2026-10-13') as unknown as { periods: Record<string, object> }).periods['1']).not.toHaveProperty('memo');
  });

  it('끝났는데 서버 판이 오지 않으면 잠시 뒤 걷는다', () => {
    vi.useFakeTimers();
    applyBase('u_me', 'items', new Map([['a', server('처음', 1)]]));
    const w = beginLocalWrite([writeOp.patch(at('a'), { text: '고침' }, { text: '처음' })], ctx);
    endLocalWrite(w, true);
    vi.advanceTimersByTime(SETTLE_WAIT_MS - 1);
    expect(shown('a')!.text).toBe('고침');
    vi.advanceTimersByTime(1);
    expect(shown('a')!.text).toBe('처음');
  });
});
