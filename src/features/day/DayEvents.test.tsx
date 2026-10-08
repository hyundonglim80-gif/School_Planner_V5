// 하루 일정 칸 - 그날 일정만·카드(라벨 칩·⏰·기한·🔗)·완료(☐·칩)·순서(▲▼ = 문서 하나)·받는 중·고치는 일정 짚기
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render } from '@testing-library/react';
import { Timestamp } from 'firebase/firestore';
import { useNav } from '../../app/nav';
import { useCommonSettings } from '../../app/prefs';
import { useWindows } from '../../app/windows';
import { setPastRowOpen } from '../events/forward';
import { applyBase, resetMirrorStore, setStatus, trackColl } from '../../data/mirror/store';
import { useSession } from '../../data/session';
import { undoCount } from '../../data/undo';
import type { WriteOp } from '../../data/repo';
import DayEvents from './DayEvents';

vi.mock('../../data/firebase', () => ({ auth: {}, db: {} }));
// 일정 칸 열기는 그대로 하되 무엇으로 열었는지 본다 (창 목록은 이 시험에 등록하지 않는다)
const opened = vi.hoisted(() => ({ calls: [] as unknown[] }));
vi.mock('../events/open', async (orig) => {
  const real = await orig<typeof import('../events/open')>();
  return { ...real, openEventPanel: vi.fn((p: unknown) => (opened.calls.push(p), real.openEventPanel(p as never))) };
});
const written = vi.hoisted(() => ({ batches: [] as WriteOp[][] }));
vi.mock('../../data/repo', async (orig) => {
  const real = await orig<typeof import('../../data/repo')>();
  const record = async (ops: WriteOp[]) => {
    written.batches.push(ops);
    // 되돌리기 자리 (비어 있지 않으면 Ctrl+Z 더미에 쌓인다)
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
  ['L1', { ...base, kind: 'event', name: '회의', color: 'blue', parentId: null, order: 'a0', props: { forward: true } }],
]);
const ev = (id: string, order: string, more: Record<string, unknown> = {}) => [
  id,
  { ...base, kind: 'event', date: DAY, text: `일정 ${id}`, labelIds: [], order, ...more },
] as const;
const items = new Map<string, Record<string, unknown>>([
  ev('a', 'a0', { labelIds: ['L1', 'gone'], time: '09:30', due: '2026-10-10', linkIds: ['x', 'y'] }),
  ev('b', 'a1', { done: true, doneAt: 5 }),
  ev('c', 'a2'),
  ev('other', 'a0', { date: '2026-10-09' }),
  ['note', { ...base, kind: 'note', date: DAY, text: '기록', labelIds: [], order: 'a0' }],
  ['del', { ...base, kind: 'event', date: DAY, text: '지운 것', labelIds: [], order: 'a3', deletedAt: t }],
]);

const q = (s: string) => document.querySelector<HTMLElement>(s);
const qa = (s: string) => [...document.querySelectorAll<HTMLElement>(s)];
const cards = () => qa('[data-event-card]').map((c) => c.dataset.eventCard);

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
  // 오늘 = DAY (이월은 오늘에 따라 고른다)
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 8, 12));
  useCommonSettings.setState({ forwardDays: 14 });
  resetMirrorStore();
  setPastRowOpen(false);
  written.batches = [];
  opened.calls = [];
  useWindows.setState({ windows: [] });
  document.body.innerHTML = '';
  useSession.setState({ loading: false, user: { uid: 'me', email: '', displayName: '', photoURL: '' } });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('하루 일정 칸', () => {
  it('그날의 일정만 차례대로 (기록·다른 날·지운 것은 빼고), 수와 카드', () => {
    seed();
    render(<DayEvents date={DAY} />);
    expect(cards()).toEqual(['a', 'b', 'c']);
    expect(q('[data-event-count]')?.textContent).toBe('3');
    const a = q('[data-event-card="a"]')!;
    // 모르는 라벨은 칩을 그리지 않는다
    expect([...a.querySelectorAll<HTMLElement>('[data-event-chip]')].map((c) => c.dataset.eventChip)).toEqual(['L1']);
    expect(a.querySelector('[data-event-alarm]')?.textContent).toContain('09:30');
    expect(a.querySelector('[data-due-badge]')).not.toBeNull();
    expect(a.querySelector('[data-event-links]')?.textContent).toContain('2');
    // 끝낸 일정은 체크·취소선
    expect(q('[data-event-card="b"]')!.dataset.eventDone).toBe('1');
    expect(q('[data-event-card="b"] [data-event-complete]')).toBeChecked();
  });

  it('☐ = 완료 (done·doneAt만 - 문서 하나), 안내 없이 Ctrl+Z 더미에', async () => {
    seed();
    render(<DayEvents date={DAY} />);
    const before = undoCount(SID);
    await act(async () => fireEvent.click(q('[data-event-card="c"] [data-event-complete]')!));
    expect(written.batches).toHaveLength(1);
    const [op] = written.batches[0];
    expect(op).toMatchObject({ type: 'patch', at: { sid: SID, coll: 'items', id: 'c' } });
    expect(Object.keys((op as { changes: object }).changes).sort()).toEqual(['done', 'doneAt']);
    expect(undoCount(SID)).toBe(before + 1);
    expect(q('[data-toast]')).toBeNull();
  });

  it('라벨 칩을 눌러도 완료, 끝낸 일정은 풀기', async () => {
    seed();
    render(<DayEvents date={DAY} />);
    await act(async () => fireEvent.click(q('[data-event-card="a"] [data-event-chip="L1"]')!));
    expect(written.batches[0][0]).toMatchObject({ changes: { done: true } });
    await act(async () => fireEvent.click(q('[data-event-card="b"] [data-event-complete]')!));
    expect(written.batches[1][0]).toMatchObject({ changes: { done: false, doneAt: undefined } });
    // 카드를 누른 것(수정 칸 열기)으로 번지지 않는다
    expect(useWindows.getState().windows).toEqual([]);
  });

  it('▲▼ = 옮긴 일정의 order 하나만, 맨 위 ▲·맨 아래 ▼는 꺼짐', async () => {
    seed();
    render(<DayEvents date={DAY} />);
    expect(q('[data-event-card="a"] [data-event-up]')).toBeDisabled();
    expect(q('[data-event-card="c"] [data-event-down]')).toBeDisabled();
    await act(async () => fireEvent.click(q('[data-event-card="c"] [data-event-up]')!));
    expect(written.batches).toHaveLength(1);
    expect(written.batches[0]).toHaveLength(1);
    const op = written.batches[0][0] as { at: { id: string }; changes: Record<string, string> };
    expect(Object.keys(op.changes)).toEqual(['order']);
  });

  it('사본도 서버 소식도 없으면 받는 중, 받았는데 없으면 비었다고', () => {
    seed('loading', new Map());
    const { unmount } = render(<DayEvents date={DAY} />);
    expect(q('[data-event-waiting]')).not.toBeNull();
    unmount();
    seed('live', new Map());
    render(<DayEvents date={DAY} />);
    expect(q('[data-event-empty]')).not.toBeNull();
  });

  it('고치는 일정은 짚는다 (열린 일정 칸)', () => {
    seed();
    useWindows.setState({ windows: [{ key: 1, id: 'event', params: { sid: SID, date: DAY, id: 'c' }, openedAt: 1, raisedAt: 1 }] });
    render(<DayEvents date={DAY} />);
    expect(q('[data-event-card="c"]')!.className).toContain('ring-primary');
    expect(q('[data-event-card="a"]')!.className).not.toContain('ring-primary');
  });

  it('⏰ 표시 = 알림 시각 창, 바꾸거나 끄면 곧바로 저장 (time만)', async () => {
    seed();
    render(<DayEvents date={DAY} />);
    fireEvent.click(q('[data-event-card="a"] [data-event-alarm]')!);
    fireEvent.change(q('[data-alarm-time]')!, { target: { value: '1000' } });
    await act(async () => fireEvent.click(q('[data-alarm-save]')!));
    expect(written.batches[0][0]).toMatchObject({ type: 'patch', at: { id: 'a' }, changes: { time: '10:00' } });
    fireEvent.click(q('[data-event-card="a"] [data-event-alarm]')!);
    await act(async () => fireEvent.click(q('[data-alarm-off]')!));
    expect(written.batches[1][0]).toMatchObject({ changes: { time: undefined } });
    expect(useWindows.getState().windows).toEqual([]);
  });

  it('🗑️ = 지운 표시 (확인 없이), 안내의 되돌리기·Ctrl+Z, 그 일정을 고치던 칸은 닫는다', async () => {
    seed();
    useWindows.setState({
      windows: [
        { key: 1, id: 'event', params: { sid: SID, date: DAY, id: 'c' }, openedAt: 1, raisedAt: 1 },
        { key: 2, id: 'event', params: { sid: SID, date: DAY, id: 'a' }, openedAt: 2, raisedAt: 2 },
      ],
    });
    render(<DayEvents date={DAY} />);
    await act(async () => fireEvent.click(q('[data-event-card="c"] [data-event-delete]')!));
    expect(written.batches[0]).toEqual([{ type: 'remove', at: { sid: SID, coll: 'items', id: 'c' } }]);
    expect(q('[data-toast]')?.textContent).toContain('일정을 삭제했습니다');
    expect(q('[data-toast-action="되돌리기"]')).not.toBeNull();
    expect(useWindows.getState().windows.map((w) => w.key)).toEqual([2]);
  });

  it('▼ 접으면 카드와 + 추가를 숨긴다', () => {
    seed();
    render(<DayEvents date={DAY} />);
    fireEvent.click(q('[data-event-collapse]')!);
    expect(cards()).toEqual([]);
    expect(q('[data-event-add]')).toBeNull();
  });
});

describe('이월 (계산 - DESIGN 5-1)', () => {
  const carriedItems = new Map<string, Record<string, unknown>>([
    ...items,
    // 10/5 이월 라벨·끝내지 않음 → 오늘 칸에 따라온다
    ev('f1', 'b0', { date: '2026-10-05', labelIds: ['L1'] }),
    // 이월 기간(14일) 밖이지만 이미 따라오던 것
    ev('f2', 'a5', { date: '2026-09-01', labelIds: ['L1'], carrying: true }),
    // 끝낸 것·이월 아닌 것·기간 밖 처음 것은 따라오지 않는다
    ev('done', 'a6', { date: '2026-10-05', labelIds: ['L1'], done: true }),
    ev('plain', 'a7', { date: '2026-10-05' }),
    ev('old', 'a8', { date: '2026-09-01', labelIds: ['L1'] }),
  ]);

  it('오늘 칸: 오늘 것 아래에 따라오는 일정을 ↪ m/d부터 (수에 넣는다), 끝낸 것·이월 아닌 것·기간 밖 처음 것은 빼고', () => {
    seed('live', carriedItems);
    render(<DayEvents date={DAY} />);
    expect(cards()).toEqual(['a', 'b', 'c', 'f2', 'f1']);
    expect(q('[data-event-count]')?.textContent).toBe('5');
    expect(q('[data-event-card="f1"]')!.dataset.eventCarried).toBe('2026-10-05');
    expect(q('[data-event-card="f1"] [data-event-since]')?.textContent).toContain('10/5부터');
    expect(q('[data-event-card="a"] [data-event-since]')).toBeNull();
    // ▲▼는 각 무리 안에서 (따라오는 줄의 맨 위 ▲·오늘 것의 맨 아래 ▼는 꺼짐)
    expect(q('[data-event-card="f2"] [data-event-up]')).toBeDisabled();
    expect(q('[data-event-card="c"] [data-event-down]')).toBeDisabled();
  });

  it('오늘 칸에서 끝내면 오늘로 옮겨 적는다 (date·carriedFrom·carrying 걷기·order = 오늘 줄 맨 뒤 - 문서 하나)', async () => {
    seed('live', carriedItems);
    render(<DayEvents date={DAY} />);
    await act(async () => fireEvent.click(q('[data-event-card="f2"] [data-event-complete]')!));
    expect(written.batches).toHaveLength(1);
    const [op] = written.batches[0] as { at: { id: string }; changes: Record<string, unknown> }[];
    expect(op.at.id).toBe('f2');
    expect(op.changes).toMatchObject({ done: true, date: DAY, carriedFrom: '2026-09-01', carrying: undefined });
    expect(op.changes.order! > 'a2').toBe(true);
    // 따라오던 일정은 아직 끝내지 않았다 - 라벨 칩도 같은 길
    await act(async () => fireEvent.click(q('[data-event-card="f1"] [data-event-chip="L1"]')!));
    expect(written.batches[1][0]).toMatchObject({ changes: { done: true, date: DAY, carriedFrom: '2026-10-05' } });
    expect(Object.keys((written.batches[1][0] as { changes: object }).changes)).not.toContain('carrying');
  });

  it('지난 날 칸: 따라간 일정은 흐리게 → 오늘로 (누르면 오늘), 끝낸 것은 그대로', () => {
    seed('live', carriedItems);
    useNav.setState({ date: '2026-10-05' });
    render(<DayEvents date="2026-10-05" />);
    expect(cards()).toEqual(['done', 'plain', 'f1']);
    expect(q('[data-event-card="f1"]')!.dataset.eventAway).toBe('1');
    expect(q('[data-event-card="done"]')!.dataset.eventAway).toBeUndefined();
    expect(q('[data-event-card="plain"] [data-event-to-today]')).toBeNull();
    fireEvent.click(q('[data-event-card="f1"] [data-event-to-today]')!);
    expect(useNav.getState().date).toBe(DAY);
    // 오늘로 가기는 수정 칸을 열지 않는다
    expect(useWindows.getState().windows).toEqual([]);
  });

  it("오늘 칸 아래 '📥 지난 일정 N개' - 따라오지 않는 끝내지 않은 지난 일정, 처음엔 접힘·아무것도 고르지 않음", () => {
    seed('live', carriedItems);
    render(<DayEvents date={DAY} />);
    expect(q('[data-past-events]')?.dataset.pastEvents).toBe('1');
    expect(q('[data-past-toggle]')?.textContent).toContain('지난 일정 1개');
    expect(q('[data-past-list]')).toBeNull();
    fireEvent.click(q('[data-past-toggle]')!);
    expect(qa('[data-past-item]').map((e) => e.dataset.pastItem)).toEqual(['plain']);
    expect(q('[data-past-pick="plain"]')).not.toBeChecked();
    expect(q('[data-past-bring]')).toBeDisabled();
  });

  it('골라 오늘로 가져오기 = date·order만 (한 묶음), 안내의 되돌리기', async () => {
    seed('live', carriedItems);
    render(<DayEvents date={DAY} />);
    fireEvent.click(q('[data-past-toggle]')!);
    fireEvent.click(q('[data-past-pick="plain"]')!);
    expect(q('[data-past-bring]')?.textContent).toContain('(1)');
    await act(async () => fireEvent.click(q('[data-past-bring]')!));
    expect(written.batches).toHaveLength(1);
    const [op] = written.batches[0] as { at: { id: string }; changes: Record<string, string> }[];
    expect(op.at.id).toBe('plain');
    expect(Object.keys(op.changes).sort()).toEqual(['date', 'order']);
    expect(op.changes.date).toBe(DAY);
    expect(op.changes.order > 'a2').toBe(true);
    expect(q('[data-toast]')?.textContent).toContain('지난 일정 1개를 오늘로 가져왔습니다');
    expect(q('[data-toast-action="되돌리기"]')).not.toBeNull();
  });

  it('줄의 라벨(없으면 완료) = 완료만 (날짜는 그대로), 글 = 수정 칸', async () => {
    seed('live', carriedItems);
    render(<DayEvents date={DAY} />);
    fireEvent.click(q('[data-past-toggle]')!);
    expect(q('[data-past-complete="plain"]')?.textContent).toBe('완료');
    await act(async () => fireEvent.click(q('[data-past-complete="plain"]')!));
    expect(Object.keys((written.batches[0][0] as { changes: object }).changes).sort()).toEqual(['done', 'doneAt']);
    fireEvent.click(q('[data-past-open="plain"]')!);
    expect(opened.calls).toEqual([{ sid: SID, date: '2026-10-05', id: 'plain' }]);
  });

  it('지난 날 칸·지난 일정이 없으면 줄이 없다', () => {
    seed('live', carriedItems);
    const { unmount } = render(<DayEvents date="2026-10-05" />);
    expect(q('[data-past-events]')).toBeNull();
    unmount();
    resetMirrorStore();
    seed('live', items);
    render(<DayEvents date={DAY} />);
    expect(q('[data-past-events]')).toBeNull();
  });
});

describe('기간 일정 (한 문서 - DESIGN 5-3)', () => {
  // 10/7(수) ~ 10/13(화), 주말 빼기 → 7·8·9·12·13
  const span = new Map<string, Record<string, unknown>>([
    ...items,
    ev('p', 'a5', { date: '2026-10-07', endDate: '2026-10-13', workdays: true, doneDates: ['2026-10-07'] }),
  ]);

  it("날마다 '(k/n)', 주말에는 없다, 그날만 완료로 보인다", () => {
    seed('live', span);
    const { unmount } = render(<DayEvents date={DAY} />);
    expect(q('[data-event-card="p"] [data-event-period]')?.dataset.eventPeriod).toBe('2/5');
    expect(q('[data-event-card="p"]')!.dataset.eventDone).toBe('0');
    unmount();
    const r2 = render(<DayEvents date="2026-10-07" />);
    expect(q('[data-event-card="p"]')!.dataset.eventDone).toBe('1');
    r2.unmount();
    render(<DayEvents date="2026-10-10" />);
    expect(q('[data-event-card="p"]')).toBeNull();
  });

  it('☐ = 그날만 (doneDates - 문서 하나)', async () => {
    seed('live', span);
    render(<DayEvents date={DAY} />);
    await act(async () => fireEvent.click(q('[data-event-card="p"] [data-event-complete]')!));
    expect(written.batches[0][0]).toMatchObject({ at: { id: 'p' }, changes: { doneDates: ['2026-10-07', DAY] } });
  });

  it('🗑️ = 어디까지 묻는다 - 이 날만 = 그날 빼기(skipDates), 전부 = 지운 표시', async () => {
    seed('live', span);
    render(<DayEvents date={DAY} />);
    fireEvent.click(q('[data-event-card="p"] [data-event-delete]')!);
    expect(q('[data-scope-window]')).not.toBeNull();
    expect(q('[data-scope-choice="after"]')?.textContent).toContain('4일');
    expect(q('[data-scope-choice="all"]')?.textContent).toContain('5일');
    expect(written.batches).toEqual([]);
    await act(async () => fireEvent.click(q('[data-scope-choice="only"]')!));
    expect(written.batches[0][0]).toMatchObject({ type: 'patch', at: { id: 'p' }, changes: { skipDates: [DAY] } });
    expect(q('[data-scope-window]')).toBeNull();
    expect(q('[data-toast]')?.textContent).toContain('하루를 기간에서 뺐습니다');
    fireEvent.click(q('[data-event-card="p"] [data-event-delete]')!);
    await act(async () => fireEvent.click(q('[data-scope-choice="all"]')!));
    expect(written.batches[1]).toEqual([{ type: 'remove', at: { sid: SID, coll: 'items', id: 'p' } }]);
  });

  it('이 날부터 = 끝 날 당기기', async () => {
    seed('live', span);
    render(<DayEvents date="2026-10-12" />);
    fireEvent.click(q('[data-event-card="p"] [data-event-delete]')!);
    await act(async () => fireEvent.click(q('[data-scope-choice="after"]')!));
    expect(written.batches[0][0]).toMatchObject({ changes: { endDate: '2026-10-09' } });
  });
});
