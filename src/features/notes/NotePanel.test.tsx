// 메모·기록 칸 - 새로(맨 위 라벨·자리 맨 뒤·저장하면 수정 칸)·#라벨(새 라벨과 한 묶음)·'+ 새 라벨'·고치기 = 바뀐 칸만·
// 📅 날짜 = 자리(date만·되돌리기는 자리만)·완료/즐겨찾기(고치던 항목은 곧바로 그 칸만)·체크리스트·손대기 전에는 다른 기기 고침을 따라감·저장 안 한 글
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render } from '@testing-library/react';
import { useEffect, useState } from 'react';
import { Timestamp } from 'firebase/firestore';
import { resetHistoryForTest } from '../../app/history';
import { setPopupStyle } from '../../app/layoutPrefs';
import { anyWindowUnsaved } from '../../app/windows';
import { applyBase, resetMirrorStore, setStatus, trackColl } from '../../data/mirror/store';
import { useSession } from '../../data/session';
import { clearUndo, undoLast } from '../../data/undo';
import type { WriteOp } from '../../data/repo';
import NotePanel from './NotePanel';
import type { NotePanelParams } from './open';

vi.mock('../../data/firebase', () => ({ auth: {}, db: {} }));
const written = vi.hoisted(() => ({ batches: [] as WriteOp[][] }));
vi.mock('../../data/repo', async (orig) => {
  const real = await orig<typeof import('../../data/repo')>();
  const { undoOfAll } = await import('../../data/repo/ops');
  const record = async (ops: WriteOp[]) => {
    written.batches.push(ops);
    return undoOfAll(ops);
  };
  return {
    ...real,
    batch: vi.fn(record),
    create: vi.fn((at, data) => record([real.writeOp.create(at, data)])),
    patch: vi.fn((at, changes, before) => record([real.writeOp.patch(at, changes, before)])),
    remove: vi.fn((at) => record([real.writeOp.remove(at)])),
  };
});

const SID = 'u_me';
const DAY = '2026-10-08';
const t = new Timestamp(1, 0);
const base = { deletedAt: null, updatedAt: t, v: 1, createdAt: 0, authorId: 'me' };
const labels = new Map<string, Record<string, unknown>>([
  ['L1', { ...base, kind: 'note', name: '학급', color: 'blue', parentId: null, order: 'a0' }],
  ['L2', { ...base, kind: 'note', name: '상담', color: 'green', parentId: null, order: 'a1' }],
]);
const n1 = { ...base, kind: 'note', date: DAY, text: '회의 기록', labelIds: ['L2'], order: 'a5' };
const m1 = { ...base, kind: 'note', date: null, text: '메모 하나', labelIds: [], order: 'a7', fromDate: '2026-10-01' };

const q = (s: string) => document.querySelector<HTMLElement>(s)!;
const lastOps = () => written.batches.at(-1)!;
const textInput = () => q('[data-note-text-input]') as HTMLTextAreaElement;

function seed(items = new Map<string, Record<string, unknown>>([['n1', n1], ['m1', m1]])) {
  for (const [coll, docs] of [
    ['labels', labels],
    ['items', items],
  ] as const) {
    trackColl(SID, coll);
    applyBase(SID, coll, docs);
    setStatus(SID, coll, 'live');
  }
}

const close = vi.fn();
const shown: { params?: NotePanelParams } = {};
function Host({ initial }: { initial: NotePanelParams }) {
  const [params, setParams] = useState(initial);
  useEffect(() => {
    shown.params = params;
  });
  return <NotePanel params={params} close={close} raise={0} setParams={setParams} />;
}

const type = (text: string) => fireEvent.change(textInput(), { target: { value: text } });
const save = () => act(async () => fireEvent.click(q('[data-note-save]')));

beforeEach(() => {
  resetHistoryForTest();
  resetMirrorStore();
  clearUndo();
  setPopupStyle('side');
  written.batches = [];
  close.mockReset();
  document.body.innerHTML = '';
  useSession.setState({ loading: false, user: { uid: 'me', email: 'me@x', displayName: '', photoURL: '' } });
});

describe('새 기록·메모', () => {
  it('새 기록: 맨 위 라벨, 저장하면 그날 맨 뒤에 만들고 그 항목의 수정 칸이 된다', async () => {
    seed();
    render(<Host initial={{ sid: SID, date: DAY }} />);
    expect(q('[data-note-panel]').dataset.notePanel).toBe('new');
    expect(q('[data-note-panel]').dataset.noteNoun).toBe('기록');
    expect(q('[data-label-pick="L1"]')).toHaveAttribute('aria-pressed', 'true');
    expect(q('[data-note-save]')).toBeDisabled();
    type('  체육대회 준비 ');
    await save();
    const [op] = lastOps();
    const data = (op as { data: Record<string, unknown> }).data;
    expect(op).toMatchObject({ type: 'create', at: { sid: SID, coll: 'items' } });
    expect(data).toMatchObject({ kind: 'note', date: DAY, text: '체육대회 준비', labelIds: ['L1'] });
    expect(String(data.order) > 'a5').toBe(true);
    const id = (op as { at: { id: string } }).at.id;
    expect(shown.params).toMatchObject({ id, date: DAY });
    expect(document.querySelector('[data-toast]')?.textContent).toContain('기록을 저장했습니다');
    act(() => applyBase(SID, 'items', new Map([[id, { ...base, ...data }]])));
    expect(q('[data-note-panel]').dataset.notePanel).toBe('edit');
    expect(textInput().value).toBe('체육대회 준비');
    expect(anyWindowUnsaved()).toBe(false);
  });

  it('새 메모(날짜 없음) = date null, 메모 목록 맨 뒤. 날짜를 넣으면 곧바로 그날 기록 칸이 된다', async () => {
    seed();
    render(<Host initial={{ sid: SID, date: null }} />);
    expect(q('[data-note-panel]').dataset.noteNoun).toBe('메모');
    fireEvent.change(q('[data-note-date]'), { target: { value: '2026-10-09' } });
    expect(shown.params!.date).toBe('2026-10-09');
    expect(q('[data-note-panel]').dataset.noteNoun).toBe('기록');
    fireEvent.click(q('[data-note-date-clear]'));
    expect(shown.params!.date).toBeNull();
    type('메모 둘');
    await save();
    const data = (lastOps()[0] as { data: Record<string, unknown> }).data;
    expect(data).toMatchObject({ date: null, text: '메모 둘' });
    expect(String(data.order) > 'a7').toBe(true);
    expect(document.querySelector('[data-toast]')?.textContent).toContain('메모를 저장했습니다');
  });

  it('새 항목의 ☐ 완료·☆ 즐겨찾기는 들고 있다가 처음 저장할 때 함께', async () => {
    seed();
    render(<Host initial={{ sid: SID, date: DAY }} />);
    fireEvent.click(q('[data-note-flag="done"]'));
    fireEvent.click(q('[data-note-flag="favorite"]'));
    expect(written.batches).toHaveLength(0);
    type('끝난 일');
    await save();
    expect((lastOps()[0] as { data: Record<string, unknown> }).data).toMatchObject({ done: true, favorite: true });
  });

  it('첫·마지막 줄 #라벨: 미리 보이고, 저장하면 줄을 떼고 라벨로 - 없는 이름은 새 라벨과 한 묶음, 칸도 그렇게 바뀐다', async () => {
    seed();
    render(<Host initial={{ sid: SID, date: DAY }} />);
    type('오늘 상담\n#상담 #새라벨');
    expect([...document.querySelectorAll<HTMLElement>('[data-hash-label]')].map((e) => [e.dataset.hashLabel, !!e.dataset.new])).toEqual([
      ['상담', false],
      ['새라벨', true],
    ]);
    await save();
    const ops = lastOps();
    expect(ops.map((o) => [o.type, o.at.coll])).toEqual([
      ['create', 'labels'],
      ['create', 'items'],
    ]);
    const labelId = ops[0].at.id;
    expect((ops[0] as { data: Record<string, unknown> }).data).toMatchObject({ kind: 'note', name: '새라벨', parentId: null });
    const data = (ops[1] as { data: Record<string, unknown> }).data;
    expect(data).toMatchObject({ text: '오늘 상담', labelIds: ['L1', 'L2', labelId] });
    // 앱에서는 저장 도우미가 적기 직전에 사본에 덧칠한다 - 여기서는 손으로
    act(() => applyBase(SID, 'items', new Map([[ops[1].at.id, { ...base, ...data }]])));
    expect(textInput().value).toBe('오늘 상담');
    expect(anyWindowUnsaved()).toBe(false);
  });

  it("'+ 새 라벨'로 적은 이름도 저장할 때 만든다", async () => {
    seed();
    render(<Host initial={{ sid: SID, date: DAY }} />);
    fireEvent.click(q('[data-label-pick-new]'));
    fireEvent.change(q('[data-label-pick-new-input]'), { target: { value: '행사' } });
    fireEvent.keyDown(q('[data-label-pick-new-input]'), { key: 'Enter' });
    expect(q('[data-label-pick-pending="행사"]')).not.toBeNull();
    type('글');
    await save();
    expect(lastOps().map((o) => o.at.coll)).toEqual(['labels', 'items']);
  });
});

describe('고치기', () => {
  it('바뀐 칸만, 바뀐 것이 없으면 쓰지 않는다', async () => {
    seed();
    render(<Host initial={{ sid: SID, date: DAY, id: 'n1' }} />);
    expect(q('[data-note-panel]').dataset.notePanel).toBe('edit');
    expect(textInput().value).toBe('회의 기록');
    await save();
    expect(written.batches).toHaveLength(0);
    expect(document.querySelector('[data-toast]')?.textContent).toContain('바뀐 것이 없습니다');
    type('회의 기록 (고침)');
    await save();
    expect(lastOps()).toEqual([
      expect.objectContaining({ type: 'patch', at: { sid: SID, coll: 'items', id: 'n1' }, changes: { text: '회의 기록 (고침)' } }),
    ]);
  });

  it('고치던 항목의 ☐ 완료·☆ 즐겨찾기 = 곧바로 그 칸만 (쓰던 글은 칸에 그대로)', async () => {
    seed();
    render(<Host initial={{ sid: SID, date: DAY, id: 'n1' }} />);
    type('적던 글');
    await act(async () => fireEvent.click(q('[data-note-flag="done"]')));
    expect(lastOps()[0]).toMatchObject({ type: 'patch', at: { id: 'n1' } });
    expect(Object.keys((lastOps()[0] as { changes: object }).changes).sort()).toEqual(['done', 'doneAt']);
    await act(async () => fireEvent.click(q('[data-note-flag="favorite"]')));
    expect(lastOps()[0]).toMatchObject({ changes: { favorite: true } });
    expect(textInput().value).toBe('적던 글');
  });

  it('📅 날짜 빼기 = 메모로 옮기기: date만(+ fromDate), 되돌리기는 자리만', async () => {
    seed();
    render(<Host initial={{ sid: SID, date: DAY, id: 'n1' }} />);
    fireEvent.click(q('[data-note-date-clear]'));
    expect(q('[data-note-place-hint]').textContent).toContain('메모로 옮깁니다');
    expect(q('[data-note-save]').textContent).toBe('옮기고 저장');
    type('회의 기록 + 덧붙임');
    await save();
    expect((lastOps()[0] as { changes: object }).changes).toEqual({ text: '회의 기록 + 덧붙임', date: null, fromDate: DAY });
    expect(document.querySelector('[data-toast]')?.textContent).toContain('메모로 옮겼습니다');
    await act(async () => {
      await undoLast(SID);
    });
    // 되돌리기는 자리만 - 함께 고친 글은 그대로
    expect((lastOps()[0] as { changes: object }).changes).toEqual({ date: DAY, fromDate: undefined });
  });

  it('메모에 날짜 넣기 = 그날 기록으로, fromDate는 걷는다', async () => {
    seed();
    render(<Host initial={{ sid: SID, date: null, id: 'm1' }} />);
    fireEvent.change(q('[data-note-date]'), { target: { value: DAY } });
    expect(q('[data-note-place-hint]').textContent).toContain('10/8');
    // 그대로 두기 = 원래 자리
    fireEvent.click(q('[data-note-place-keep]'));
    expect(document.querySelector('[data-note-place-hint]')).toBeNull();
    fireEvent.change(q('[data-note-date]'), { target: { value: DAY } });
    await save();
    expect((lastOps()[0] as { changes: object }).changes).toEqual({ date: DAY, fromDate: undefined });
    expect(document.querySelector('[data-toast]')?.textContent).toContain('기록으로 옮겼습니다');
  });

  it('손대기 전에는 다른 기기에서 고친 것을 따라가고, 손댔으면 덮지 않는다', () => {
    seed();
    render(<Host initial={{ sid: SID, date: DAY, id: 'n1' }} />);
    act(() => applyBase(SID, 'items', new Map([['n1', { ...n1, text: '다른 기기' }]])));
    expect(textInput().value).toBe('다른 기기');
    type('내가 적던 것');
    act(() => applyBase(SID, 'items', new Map([['n1', { ...n1, text: '또 다른 기기' }]])));
    expect(textInput().value).toBe('내가 적던 것');
    expect(anyWindowUnsaved()).toBe(true);
  });

  it('삭제 = 지운 표시, 지운 항목이면 안내만', async () => {
    seed();
    render(<Host initial={{ sid: SID, date: DAY, id: 'n1' }} />);
    await act(async () => fireEvent.click(q('[data-note-delete]')));
    expect(lastOps()).toEqual([{ type: 'remove', at: { sid: SID, coll: 'items', id: 'n1' } }]);
    act(() => applyBase(SID, 'items', new Map([['n1', { ...n1, deletedAt: t }]])));
    expect(q('[data-note-missing]').textContent).toContain('휴지통');
  });
});

describe('체크리스트', () => {
  it('☑ 체크리스트 = 커서 줄 앞에 ☐, Enter = 다음 줄도 ☐, 빈 ☐ 줄에서 Enter = 끝', () => {
    seed();
    render(<Host initial={{ sid: SID, date: DAY }} />);
    type('우유');
    textInput().setSelectionRange(2, 2);
    fireEvent.click(q('[data-checklist-toggle]'));
    expect(textInput().value).toBe('☐ 우유');
    textInput().setSelectionRange(4, 4);
    fireEvent.keyDown(textInput(), { key: 'Enter' });
    expect(textInput().value).toBe('☐ 우유\n☐ ');
    fireEvent.keyDown(textInput(), { key: 'Enter' });
    expect(textInput().value).toBe('☐ 우유\n');
  });

  it('단축키(sp5-checklist)는 커서가 글 칸에 있을 때만', () => {
    seed();
    render(<Host initial={{ sid: SID, date: DAY }} />);
    type('빵');
    act(() => {
      (document.activeElement as HTMLElement | null)?.blur();
      window.dispatchEvent(new Event('sp5-checklist'));
    });
    expect(textInput().value).toBe('빵');
    textInput().focus();
    act(() => {
      window.dispatchEvent(new Event('sp5-checklist'));
    });
    expect(textInput().value).toBe('☐ 빵');
  });
});
