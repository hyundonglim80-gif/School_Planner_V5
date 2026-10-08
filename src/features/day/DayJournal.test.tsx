// 하루 기록 칸 - 그날 기록만·카드(라벨 칩·☑ n/m·📅·🔗·▦)·즐겨찾기 먼저·완료·★·체크 줄·순서(▲▼ = 문서 하나)·접기·지우기·받는 중
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render } from '@testing-library/react';
import { Timestamp } from 'firebase/firestore';
import { useWindows } from '../../app/windows';
import { applyBase, resetMirrorStore, setStatus, trackColl } from '../../data/mirror/store';
import { useSession } from '../../data/session';
import { undoCount } from '../../data/undo';
import type { WriteOp } from '../../data/repo';
import DayJournal from './DayJournal';

vi.mock('../../data/firebase', () => ({ auth: {}, db: {} }));
const written = vi.hoisted(() => ({ batches: [] as WriteOp[][] }));
vi.mock('../../data/repo', async (orig) => {
  const real = await orig<typeof import('../../data/repo')>();
  const record = async (ops: WriteOp[]) => {
    written.batches.push(ops);
    return ops;
  };
  return {
    ...real,
    batch: vi.fn(record),
    patch: vi.fn((at, changes, before) => record([real.writeOp.patch(at, changes, before)])),
    remove: vi.fn((at) => record([real.writeOp.remove(at)])),
  };
});

const SID = 'u_me';
const DAY = '2026-10-08';
const t = new Timestamp(1, 0);
const base = { deletedAt: null, updatedAt: t, v: 1, createdAt: 0, authorId: 'me' };
const labels = new Map<string, Record<string, unknown>>([
  ['P', { ...base, kind: 'note', name: '학급', color: 'blue', parentId: null, order: 'a0' }],
  ['C', { ...base, kind: 'note', name: '상담', color: 'green', parentId: 'P', order: 'a1' }],
]);
const note = (id: string, order: string, more: Record<string, unknown> = {}) => [
  id,
  { ...base, kind: 'note', date: DAY, text: `기록 ${id}`, labelIds: [], order, ...more },
] as const;
const LONG = '긴 글 '.repeat(40);
const items = new Map<string, Record<string, unknown>>([
  note('a', 'a0', { labelIds: ['C', 'gone'], linkIds: ['x'], tables: [{ id: 't1', rows: [{ cells: [{ v: '칸' }] }], createdAt: 0 }] }),
  note('b', 'a1', { favorite: true }),
  note('c', 'a2', { text: '장보기\n☐ 우유\n☑ 빵\n☐ 달걀' }),
  note('long', 'a3', { text: LONG }),
  ['memo', { ...base, kind: 'note', date: null, text: '메모', labelIds: [], order: 'a0' }],
  ['ev', { ...base, kind: 'event', date: DAY, text: '일정', labelIds: [], order: 'a0' }],
  note('other', 'a0', { date: '2026-10-09' }),
  note('del', 'a4', { deletedAt: t }),
]);

const q = (s: string) => document.querySelector<HTMLElement>(s);
const qa = (s: string) => [...document.querySelectorAll<HTMLElement>(s)];
/** 카드 차례 (가로 우선으로 나눠 담았으니 화면의 차례 = data-entry-card를 index로) */
const cards = () => qa('[data-entry-card]').map((c) => c.dataset.entryCard);

function seed(status: 'live' | 'loading' = 'live', docs = items) {
  for (const [coll, d] of [
    ['labels', labels],
    ['items', docs],
  ] as const) {
    trackColl(SID, coll);
    applyBase(SID, coll, d);
    setStatus(SID, coll, status);
  }
}

beforeEach(() => {
  resetMirrorStore();
  written.batches = [];
  useWindows.setState({ windows: [] });
  document.body.innerHTML = '';
  useSession.setState({ loading: false, user: { uid: 'me', email: '', displayName: '', photoURL: '' } });
});

describe('하루 기록 칸', () => {
  it('그날 기록만 (메모·일정·다른 날·지운 것은 빼고), 즐겨찾기가 맨 위', () => {
    seed();
    render(<DayJournal date={DAY} />);
    expect(q('[data-journal-count]')?.textContent).toBe('4');
    expect(new Set(cards())).toEqual(new Set(['a', 'b', 'c', 'long']));
    // 2열(본문 폭이 좁다) - 가로 우선: 1열 = b·c, 2열 = a·long
    const cols = qa('[data-day-journal] .grid > div').map((col) => [...col.querySelectorAll<HTMLElement>('[data-entry-card]')].map((c) => c.dataset.entryCard));
    expect(cols[0][0]).toBe('b');
    expect(q('[data-entry-card="b"]')!.dataset.entryFavorite).toBe('1');
  });

  it('카드: 모르는 라벨은 칩을 그리지 않고, 하위 라벨 칩에 마우스를 올리면 상위 › 하위, 🔗·▦ 수, 체크 줄 ☑ n/m', () => {
    seed();
    render(<DayJournal date={DAY} />);
    const a = q('[data-entry-card="a"]')!;
    const chips = [...a.querySelectorAll<HTMLElement>('[data-entry-chip]')];
    expect(chips.map((c) => c.dataset.entryChip)).toEqual(['C']);
    expect(chips[0].title).toBe('학급 › 상담');
    expect(a.querySelector('[data-entry-links]')?.textContent).toContain('1');
    expect(a.querySelector('[data-entry-tables]')?.textContent).toContain('1');
    expect(a.querySelector('[data-entry-table="t1"]')).not.toBeNull();
    expect(q('[data-entry-card="c"] [data-entry-checks]')!.dataset.entryChecks).toBe('1/3');
    // 체크한 줄(☑ 빵)은 아래쪽에 모은다 - 보이는 차례만
    expect(q('[data-entry-card="c"] [data-check-done="2"]')).not.toBeNull();
  });

  it('긴 기록은 접힌 채 시작(첫 줄만), ▶로 펼친다', () => {
    seed();
    render(<DayJournal date={DAY} />);
    const long = () => q('[data-entry-card="long"]')!;
    expect(long().dataset.entryCollapsed).toBe('1');
    expect(long().querySelector('[data-entry-preview]')).not.toBeNull();
    fireEvent.click(long().querySelector('[data-entry-collapse]')!);
    expect(long().dataset.entryCollapsed).toBe('0');
    expect(long().querySelector('[data-entry-text]')).not.toBeNull();
  });

  it('☐ 완료·☆ 즐겨찾기 = 그 칸만 (문서 하나), 안내 없이 Ctrl+Z 더미에, 카드 열기로 번지지 않는다', async () => {
    seed();
    render(<DayJournal date={DAY} />);
    const before = undoCount(SID);
    await act(async () => fireEvent.click(q('[data-entry-card="a"] [data-entry-complete]')!));
    expect(written.batches[0]).toHaveLength(1);
    expect(written.batches[0][0]).toMatchObject({ type: 'patch', at: { coll: 'items', id: 'a' }, changes: { done: true } });
    await act(async () => fireEvent.click(q('[data-entry-card="b"] [data-entry-favorite-toggle]')!));
    expect(written.batches[1][0]).toMatchObject({ at: { id: 'b' }, changes: { favorite: undefined } });
    expect(undoCount(SID)).toBe(before + 2);
    expect(q('[data-toast]')).toBeNull();
    expect(useWindows.getState().windows).toEqual([]);
  });

  it('체크 줄 누르기 = 그 줄의 체크 글자만 바꾼 글', async () => {
    seed();
    render(<DayJournal date={DAY} />);
    await act(async () => fireEvent.click(q('[data-entry-card="c"] [data-check-line="1"]')!));
    expect(written.batches[0][0]).toMatchObject({ at: { id: 'c' }, changes: { text: '장보기\n☑ 우유\n☑ 빵\n☐ 달걀' } });
  });

  it('▲▼ = 옮긴 것의 order 하나만, 즐겨찾기와 나머지 사이는 꺼짐', async () => {
    seed();
    render(<DayJournal date={DAY} />);
    // 보이는 차례: b(★) a c long
    expect(q('[data-entry-card="b"] [data-entry-down]')).toBeDisabled();
    expect(q('[data-entry-card="a"] [data-entry-up]')).toBeDisabled();
    await act(async () => fireEvent.click(q('[data-entry-card="c"] [data-entry-up]')!));
    expect(written.batches).toHaveLength(1);
    expect(written.batches[0]).toHaveLength(1);
    expect(Object.keys((written.batches[0][0] as { changes: object }).changes)).toEqual(['order']);
  });

  it('🗑️ = 지운 표시 (확인 없이), 안내의 되돌리기, 그 기록을 고치던 칸은 닫는다', async () => {
    seed();
    useWindows.setState({
      windows: [
        { key: 1, id: 'note', params: { sid: SID, date: DAY, id: 'a' }, openedAt: 1, raisedAt: 1 },
        { key: 2, id: 'note', params: { sid: SID, date: DAY, id: 'b' }, openedAt: 2, raisedAt: 2 },
      ],
    });
    render(<DayJournal date={DAY} />);
    // 고치는 기록은 짚는다
    expect(q('[data-entry-card="a"]')!.className).toContain('ring-primary');
    await act(async () => fireEvent.click(q('[data-entry-card="a"] [data-entry-delete]')!));
    expect(written.batches[0]).toEqual([{ type: 'remove', at: { sid: SID, coll: 'items', id: 'a' } }]);
    expect(q('[data-toast]')?.textContent).toContain('기록을 삭제했습니다');
    expect(q('[data-toast-action="되돌리기"]')).not.toBeNull();
    expect(useWindows.getState().windows.map((w) => w.key)).toEqual([2]);
  });

  it('사본도 서버 소식도 없으면 받는 중, 받았는데 없으면 비었다고, ▼ 접으면 카드와 + 추가를 숨긴다', () => {
    seed('loading', new Map());
    const { unmount } = render(<DayJournal date={DAY} />);
    expect(q('[data-journal-waiting]')).not.toBeNull();
    unmount();
    seed('live', new Map());
    const second = render(<DayJournal date={DAY} />);
    expect(q('[data-journal-empty]')).not.toBeNull();
    second.unmount();
    seed();
    render(<DayJournal date={DAY} />);
    fireEvent.click(q('[data-journal-collapse]')!);
    expect(cards()).toEqual([]);
    expect(q('[data-journal-add]')).toBeNull();
  });
});
