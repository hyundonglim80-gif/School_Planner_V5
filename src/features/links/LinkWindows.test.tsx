// 링크 창 - 연결 창(탭·범위·라벨·키워드·담기·이미 이은 것·새로 만들어 연결·저장 = 양쪽 한 묶음 + 닫기),
// 보기 창(지금 내용·🗑️ = 양쪽 끊기·📌 이동·✏️ 수정·수업 링크·찾을 수 없는 항목)
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render } from '@testing-library/react';
import { Timestamp } from 'firebase/firestore';
import { useNav } from '../../app/nav';
import { applyBase, resetMirrorStore, setStatus, trackColl } from '../../data/mirror/store';
import { useSession } from '../../data/session';
import type { WriteOp } from '../../data/repo';
import LinkerWindow from './LinkerWindow';
import LinkViewerWindow from './LinkViewerWindow';
import { deliverLinkPick } from './actions';

vi.mock('../../data/firebase', () => ({ auth: {}, db: {}, GOOGLE_SCOPES: [] }));
const written = vi.hoisted(() => ({ batches: [] as WriteOp[][] }));
vi.mock('../../data/repo', async (orig) => {
  const real = await orig<typeof import('../../data/repo')>();
  const { undoOfAll } = await import('../../data/repo/ops');
  return {
    ...real,
    batch: vi.fn(async (ops: WriteOp[]) => {
      written.batches.push(ops);
      return undoOfAll(ops);
    }),
  };
});
const opened = vi.hoisted(() => ({ notes: [] as unknown[], events: [] as unknown[] }));
vi.mock('../notes/open', async (orig) => ({ ...(await orig<typeof import('../notes/open')>()), openNotePanel: vi.fn((p: unknown) => opened.notes.push(p)) }));
vi.mock('../events/open', async (orig) => ({ ...(await orig<typeof import('../events/open')>()), openEventPanel: vi.fn((p: unknown) => opened.events.push(p)) }));

const SID = 'u_me';
const t = new Timestamp(1, 0);
const base = { deletedAt: null, updatedAt: t, v: 1, createdAt: 0, authorId: 'me', order: 'a0' };
const docs = () =>
  new Map<string, Record<string, unknown>>([
    ['ev', { ...base, kind: 'event', date: '2026-10-08', text: '학부모 상담', labelIds: [], linkIds: ['j1', 'lesson:2026-10-08:3', 'gone'] }],
    ['j1', { ...base, kind: 'note', date: '2026-10-08', text: '상담 기록', labelIds: ['N1'], linkIds: ['ev'], tables: [{ id: 'tb', rows: [{ cells: [{ v: '가' }, { v: '나' }] }], createdAt: 0 }] }],
    ['j2', { ...base, kind: 'note', date: '2026-10-07', text: '어제 기록', labelIds: [] }],
    ['j3', { ...base, kind: 'note', date: '2026-11-30', text: '먼 기록', labelIds: [] }],
    ['m1', { ...base, kind: 'note', date: null, text: '준비 메모', labelIds: [], createdAt: new Date(2026, 9, 6).getTime() }],
  ]);
const labels = new Map<string, Record<string, unknown>>([['N1', { ...base, kind: 'note', name: '상담', color: 'blue', parentId: null }]]);

function seed(items = docs()) {
  for (const [coll, d] of [
    ['labels', labels],
    ['items', items],
  ] as const) {
    trackColl(SID, coll);
    applyBase(SID, coll, d);
    setStatus(SID, coll, 'live');
  }
}

const q = (s: string) => document.querySelector<HTMLElement>(s);
const qa = (s: string) => [...document.querySelectorAll<HTMLElement>(s)];
const close = vi.fn();

beforeEach(() => {
  resetMirrorStore();
  written.batches = [];
  opened.notes = [];
  opened.events = [];
  close.mockReset();
  document.body.innerHTML = '';
  useSession.setState({ loading: false, user: { uid: 'me', email: '', displayName: '', photoURL: '' } });
});

describe('🔗 링크 연결 창', () => {
  it('탭·범위(±1주일 - 그 항목의 날 둘레)·이미 이은 것은 연결됨·담고 저장 = 양쪽 한 묶음 + 닫기', async () => {
    seed();
    render(<LinkerWindow params={{ sid: SID, id: 'ev' }} close={close} raise={0} setParams={() => {}} />);
    // 일정에서 열면 처음 탭은 메모 (#90)
    expect(qa('[data-linker-tab]').map((e) => e.dataset.linkerTab)).toEqual(['event', 'note', 'lesson']);
    // 메모 하나 (P10-4): 날짜 링크 메모와 날짜 없는 메모(만든 날)가 한 목록
    expect(qa('[data-linker-item]').map((e) => e.dataset.linkerItem)).toEqual(['j1', 'j2', 'm1']);
    expect((q('[data-linker-item="j1"]') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(q('[data-linker-item="j2"]')!);
    fireEvent.click(q('[data-linker-item="m1"]')!);
    expect(q('[data-linker-tray]')?.dataset.linkerTray).toBe('2');
    await act(async () => fireEvent.click(q('[data-linker-save]')!));
    const ops = written.batches[0] as unknown as { at: { id: string }; changes: { linkIds: string[] } }[];
    expect(ops.map((o) => [o.at.id, o.changes.linkIds])).toEqual([
      ['ev', ['j1', 'lesson:2026-10-08:3', 'gone', 'j2', 'm1']],
      ['j2', ['ev']],
      ['m1', ['ev']],
    ]);
    expect(close).toHaveBeenCalled();
    expect(q('[data-toast]')?.textContent).toContain('2개를 연결했습니다');
  });

  it('범위를 학년도로·라벨·키워드로 좁힌다, 아무것도 안 고르고 저장하면 안내만', async () => {
    seed();
    render(<LinkerWindow params={{ sid: SID, id: 'ev' }} close={close} raise={0} setParams={() => {}} />);
    fireEvent.click(q('[data-linker-tab="note"]')!);
    fireEvent.change(q('[data-linker-range]')!, { target: { value: 'year' } });
    expect(qa('[data-linker-item]')).toHaveLength(4);
    expect((q('[data-linker-date="start"]') as HTMLInputElement).value).toBe('2026-03-01');
    fireEvent.click(q('[data-linker-label="N1"]')!);
    expect(qa('[data-linker-item]').map((e) => e.dataset.linkerItem)).toEqual(['j1']);
    fireEvent.click(q('[data-linker-label="all"]')!);
    fireEvent.change(q('[data-linker-keyword]')!, { target: { value: '먼' } });
    expect(qa('[data-linker-item]').map((e) => e.dataset.linkerItem)).toEqual(['j3']);
    await act(async () => fireEvent.click(q('[data-linker-save]')!));
    expect(written.batches).toEqual([]);
    expect(close).not.toHaveBeenCalled();
  });

  it("'+ 새 메모 만들어 연결' = 그 일정의 날짜가 달린 새 메모 칸(#90), 처음 저장하면 곧바로 잇고 연결 창을 닫는다(P28-1)", async () => {
    seed();
    render(<LinkerWindow params={{ sid: SID, id: 'ev' }} close={close} raise={0} setParams={() => {}} />);
    fireEvent.click(q('[data-linker-new="note"]')!);
    const p = opened.notes[0] as { sid: string; date: string | null; pickFor: string };
    expect(p).toMatchObject({ sid: SID, date: '2026-10-08' });
    await act(async () => void (await deliverLinkPick(p.pickFor, 'j3')));
    const ops = written.batches[0] as unknown as { at: { id: string }; changes: { linkIds: string[] } }[];
    expect(ops.map((o) => [o.at.id, o.changes.linkIds])).toEqual([
      ['ev', ['j1', 'lesson:2026-10-08:3', 'gone', 'j3']],
      ['j3', ['ev']],
    ]);
    expect(close).toHaveBeenCalled();
    expect(q('[data-toast]')?.textContent).toContain('새 메모를 저장하고 연결했습니다');
    expect(q('[data-toast-action="되돌리기"]')).not.toBeNull();
  });

  it('🛒에 담아 둔 것이 있으면 새 메모만 잇고 창은 그대로 + 안내, 잇지 못하면 🛒에 담는다', async () => {
    seed();
    render(<LinkerWindow params={{ sid: SID, id: 'ev' }} close={close} raise={0} setParams={() => {}} />);
    fireEvent.click(q('[data-linker-item="j2"]')!);
    fireEvent.click(q('[data-linker-new="note"]')!);
    const p = opened.notes[0] as { pickFor: string };
    await act(async () => void (await deliverLinkPick(p.pickFor, 'm1')));
    expect((written.batches[0] as unknown as { at: { id: string } }[]).map((o) => o.at.id)).toEqual(['ev', 'm1']);
    expect(close).not.toHaveBeenCalled();
    expect(qa('[data-linker-picked]').map((e) => e.dataset.linkerPicked)).toEqual(['j2']);
    expect(q('[data-toast]')?.textContent).toContain("담아 둔 1개는 '연결 저장'을 누르면");
    // 저장이 막히면(저장 도우미가 알린다) 담아 두어 '연결 저장'으로 다시
    const { batch } = await import('../../data/repo');
    vi.mocked(batch).mockRejectedValueOnce(new Error('막힘'));
    await act(async () => void (await deliverLinkPick(p.pickFor, 'j3')));
    expect(qa('[data-linker-picked]').map((e) => e.dataset.linkerPicked)).toEqual(['j2', 'j3']);
  });

  it('연결 창을 그새 닫았어도 잇는다 · 메모에서 새 일정 = 그 메모의 날, 안내는 "새 일정을"', async () => {
    seed();
    const { unmount } = render(<LinkerWindow params={{ sid: SID, id: 'j2' }} close={close} raise={0} setParams={() => {}} />);
    fireEvent.click(q('[data-linker-tab="event"]')!);
    fireEvent.click(q('[data-linker-new="event"]')!);
    const p = opened.events[0] as { date: string; pickFor: string };
    expect(p.date).toBe('2026-10-07');
    unmount();
    await act(async () => void (await deliverLinkPick(p.pickFor, 'ev')));
    const ops = written.batches[0] as unknown as { at: { id: string }; changes: { linkIds: string[] } }[];
    expect(ops.map((o) => [o.at.id, o.changes.linkIds])).toEqual([
      ['j2', ['ev']],
      ['ev', ['j1', 'lesson:2026-10-08:3', 'gone', 'j2']],
    ]);
    expect(q('[data-toast]')?.textContent).toContain('새 일정을 저장하고 연결했습니다');
    // 모르는 쪽지(·쪽지 없이 연 칸)는 아무 일도 없다
    expect(await deliverLinkPick(undefined, 'ev')).toBe(false);
    expect(written.batches).toHaveLength(1);
  });
});

describe('📑 연결된 데이터', () => {
  it('지금 내용(글·표)·수업 링크·찾을 수 없는 항목', () => {
    seed();
    render(<LinkViewerWindow params={{ sid: SID, id: 'ev' }} close={close} raise={0} setParams={() => {}} />);
    expect(qa('[data-link-row]').map((e) => e.dataset.linkKind)).toEqual(['note', 'lesson', 'missing']);
    expect(q('[data-link-row="j1"] [data-link-text]')?.textContent).toBe('상담 기록');
    expect(q('[data-link-row="j1"] [data-entry-table]')).not.toBeNull();
    expect(q('[data-link-row="lesson:2026-10-08:3"]')?.textContent).toContain('3교시 수업');
    expect(q('[data-link-row="gone"]')?.textContent).toContain('찾을 수 없는 항목');
  });

  it('🗑️ 삭제 = 양쪽에서 끊기(항목은 그대로) + 되돌리기, 찾을 수 없는 것은 내 쪽만', async () => {
    seed();
    render(<LinkViewerWindow params={{ sid: SID, id: 'ev' }} close={close} raise={0} setParams={() => {}} />);
    await act(async () => fireEvent.click(q('[data-link-unlink="j1"]')!));
    const ops = written.batches[0] as unknown as { at: { id: string }; changes: { linkIds?: string[] } }[];
    expect(ops.map((o) => [o.at.id, o.changes.linkIds])).toEqual([
      ['ev', ['lesson:2026-10-08:3', 'gone']],
      ['j1', undefined],
    ]);
    expect(q('[data-toast-action="되돌리기"]')).not.toBeNull();
    await act(async () => fireEvent.click(q('[data-link-unlink="gone"]')!));
    expect(written.batches[1]).toHaveLength(1);
  });

  it('📌 이동 = 그날 하루 화면, ✏️ 수정 = 같은 쓰는 칸', () => {
    seed();
    render(<LinkViewerWindow params={{ sid: SID, id: 'j1' }} close={close} raise={0} setParams={() => {}} />);
    fireEvent.click(q('[data-link-move="ev"]')!);
    expect(useNav.getState()).toMatchObject({ scope: 'day', date: '2026-10-08' });
    fireEvent.click(q('[data-link-edit="ev"]')!);
    expect(opened.events[0]).toEqual({ sid: SID, date: '2026-10-08', id: 'ev' });
  });
});
