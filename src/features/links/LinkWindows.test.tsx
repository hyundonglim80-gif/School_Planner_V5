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
import { deliverLinkPick } from './open';

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
    expect(qa('[data-linker-item]')).toHaveLength(0);
    fireEvent.click(q('[data-linker-tab="journal"]')!);
    expect(qa('[data-linker-item]').map((e) => e.dataset.linkerItem)).toEqual(['j1', 'j2']);
    expect((q('[data-linker-item="j1"]') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(q('[data-linker-item="j2"]')!);
    fireEvent.click(q('[data-linker-tab="memo"]')!);
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
    fireEvent.click(q('[data-linker-tab="journal"]')!);
    fireEvent.change(q('[data-linker-range]')!, { target: { value: 'year' } });
    expect(qa('[data-linker-item]')).toHaveLength(3);
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

  it("'+ 새 기록 만들어 연결' = 그날 새 기록 칸(쪽지), 처음 저장하면 담긴다", () => {
    seed();
    render(<LinkerWindow params={{ sid: SID, id: 'ev' }} close={close} raise={0} setParams={() => {}} />);
    fireEvent.click(q('[data-linker-tab="journal"]')!);
    fireEvent.click(q('[data-linker-new="journal"]')!);
    const p = opened.notes[0] as { sid: string; date: string; pickFor: string };
    expect(p).toMatchObject({ sid: SID, date: '2026-10-08' });
    act(() => deliverLinkPick(p.pickFor, 'j3'));
    expect(q('[data-linker-picked="j3"]')).not.toBeNull();
    fireEvent.click(q('[data-linker-tab="memo"]')!);
    fireEvent.click(q('[data-linker-new="memo"]')!);
    expect(opened.notes[1]).toMatchObject({ date: null });
  });
});

describe('📑 연결된 데이터', () => {
  it('지금 내용(글·표)·수업 링크·찾을 수 없는 항목', () => {
    seed();
    render(<LinkViewerWindow params={{ sid: SID, id: 'ev' }} close={close} raise={0} setParams={() => {}} />);
    expect(qa('[data-link-row]').map((e) => e.dataset.linkKind)).toEqual(['journal', 'lesson', 'missing']);
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
