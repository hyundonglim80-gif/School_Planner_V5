// 일정 칸 - 새 일정(맨 위 라벨·맨 뒤 차례·저장하면 수정 칸)·고치기 = 바뀐 칸만·날짜 바꾸기 = date만(되돌리기는 날짜만)·
// 속성은 라벨과 다른 것만·빠른 입력 칩·알림 창·손대기 전에는 다른 기기 고침을 따라감·저장 안 한 글
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
import EventPanel from './EventPanel';
import type { EventPanelParams } from './open';

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
  ['cal', { ...base, kind: 'event', name: '달력', color: 'red', parentId: null, order: 'a0', props: { calendar: true } }],
  ['fwd', { ...base, kind: 'event', name: '이월', color: 'green', parentId: null, order: 'a1', props: { calendar: false, forward: true } }],
]);
const ev1 = { ...base, kind: 'event', date: DAY, text: '협의회', labelIds: ['fwd'], order: 'a5', time: '09:30' };

const q = (s: string) => document.querySelector<HTMLElement>(s)!;
const lastOps = () => written.batches.at(-1)!;
/** 마지막 만들기의 문서 */
const created = () => (lastOps()[0] as Extract<WriteOp, { type: 'create' }>).data;
const textInput = () => q('[data-event-text-input]') as HTMLTextAreaElement;

function seed(items: Map<string, Record<string, unknown>> = new Map([['e1', ev1]])) {
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
/** 창 목록이 들고 있는 칸의 params (setParams로 바뀐다) */
const shown: { params?: EventPanelParams } = {};
function Host({ initial }: { initial: EventPanelParams }) {
  const [params, setParams] = useState(initial);
  useEffect(() => {
    shown.params = params;
  });
  return <EventPanel params={params} close={close} raise={0} setParams={setParams} />;
}

const type = (text: string) => fireEvent.change(textInput(), { target: { value: text } });
const save = () => act(async () => fireEvent.click(q('[data-event-save]')));

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
afterEach(() => vi.useRealTimers());

describe('새 일정', () => {
  it('맨 위 라벨을 골라 두고, 저장하면 그날 맨 뒤에 만들고 그 일정의 수정 칸이 된다', async () => {
    seed();
    render(<Host initial={{ sid: SID, date: DAY }} />);
    expect(q('[data-event-panel]').dataset.eventPanel).toBe('new');
    expect(q('[data-label-pick="cal"]')).toHaveAttribute('aria-pressed', 'true');
    expect(q('[data-event-save]')).toBeDisabled();
    type('  학부모 상담 ');
    await save();
    const [op] = lastOps();
    expect(op).toMatchObject({ type: 'create', at: { sid: SID, coll: 'items' } });
    const data = (op as { data: Record<string, unknown> }).data;
    expect(data).toMatchObject({ kind: 'event', date: DAY, text: '학부모 상담', labelIds: ['cal'] });
    expect(String(data.order) > 'a5').toBe(true);
    expect(data.props).toBeUndefined();
    // 수정 칸이 되고 적은 것은 남는다 (앱에서는 저장 도우미가 적기 직전에 사본에 덧칠한다 - 여기서는 손으로)
    const id = (op as { at: { id: string } }).at.id;
    expect(shown.params!.id).toBe(id);
    expect(q('[data-event-panel]').dataset.eventPanel).toBe('edit');
    act(() => applyBase(SID, 'items', new Map([[id, { ...base, ...data }]])));
    expect(textInput().value).toBe('학부모 상담');
    expect(anyWindowUnsaved()).toBe(false);
    expect(document.querySelector('[data-toast]')?.textContent).toContain('일정을 추가했습니다');
  });

  it('날짜를 고르면 저장할 날짜가 곧바로 바뀐다 (칸의 날짜도)', async () => {
    seed();
    render(<Host initial={{ sid: SID, date: DAY }} />);
    fireEvent.click(q('[data-event-date-next]'));
    expect(shown.params!.date).toBe('2026-10-09');
    type('내일 일');
    await save();
    expect(created().date).toBe('2026-10-09');
  });

  it('속성은 라벨과 다른 것만 적는다', async () => {
    seed();
    render(<Host initial={{ sid: SID, date: DAY }} />);
    type('일');
    fireEvent.click(q('[data-event-attr="calendar"]')); // 라벨(달력)은 켬 → 끔
    fireEvent.click(q('[data-event-attr="forward"]'));
    await save();
    expect(created().props).toEqual({ calendar: false, forward: true });
  });

  it('라벨을 바꾸면 그 라벨 속성이 따라 켜진다', () => {
    seed();
    render(<Host initial={{ sid: SID, date: DAY }} />);
    fireEvent.click(q('[data-label-pick="fwd"]'));
    expect(q('[data-event-attr="forward"]')).toBeChecked();
    expect(q('[data-event-attr="calendar"]')).toBeChecked(); // 달력 라벨도 그대로 붙어 있다
    fireEvent.click(q('[data-label-pick="cal"]'));
    expect(q('[data-event-attr="calendar"]')).not.toBeChecked();
  });

  it('빠른 입력 칩 - 누르기 전에는 바꾸지 않고, 모두 넣기 = 날짜·알림·라벨 (말은 글에서 뺀다, 시각은 둔다)', async () => {
    seed();
    render(<Host initial={{ sid: SID, date: DAY }} />);
    type('내일 15:00 협의회 #이월');
    expect(q('[data-quick-chip="date"]')).not.toBeNull();
    expect(q('[data-quick-chip="time"]')).not.toBeNull();
    expect(q('[data-quick-chip="label:이월"]')).not.toBeNull();
    expect(shown.params!.date).toBe(DAY);
    fireEvent.click(q('[data-quick-chip="all"]'));
    expect(textInput().value).toBe('15:00 협의회');
    expect(shown.params!.date).toBe('2026-10-09');
    expect(q('[data-label-pick="fwd"]')).toHaveAttribute('aria-pressed', 'true');
    expect(q('[data-event-alarm-open]').textContent).toContain('15:00');
    await save();
    expect(created()).toMatchObject({ date: '2026-10-09', time: '15:00', labelIds: ['cal', 'fwd'], text: '15:00 협의회' });
  });

  it('비었으면 저장하지 않고, 적은 글이 있으면 저장 안 한 것으로 본다', () => {
    seed();
    render(<Host initial={{ sid: SID, date: DAY }} />);
    expect(anyWindowUnsaved()).toBe(false);
    type('적는 중');
    expect(anyWindowUnsaved()).toBe(true);
  });
});

describe('고치기', () => {
  it('바뀐 칸만 (문서 하나), 안내의 되돌리기', async () => {
    seed();
    render(<Host initial={{ sid: SID, date: DAY, id: 'e1' }} />);
    expect(textInput().value).toBe('협의회');
    expect(q('[data-event-attr="forward"]')).toBeChecked();
    type('협의회 2');
    await save();
    expect(lastOps()).toHaveLength(1);
    expect(lastOps()[0]).toMatchObject({ type: 'patch', at: { id: 'e1' }, changes: { text: '협의회 2' } });
    expect(Object.keys((lastOps()[0] as { changes: object }).changes)).toEqual(['text']);
    expect(q('[data-toast-action="되돌리기"]')).not.toBeNull();
  });

  it('바뀐 것이 없으면 쓰지 않는다', async () => {
    seed();
    render(<Host initial={{ sid: SID, date: DAY, id: 'e1' }} />);
    await save();
    expect(written.batches).toHaveLength(0);
  });

  it('날짜를 바꾸면 안내 줄 → 옮기고 저장 = date만, 되돌리기는 날짜만', async () => {
    seed();
    render(<Host initial={{ sid: SID, date: DAY, id: 'e1' }} />);
    fireEvent.change(q('[data-event-date]'), { target: { value: '2026-10-12' } });
    expect(q('[data-event-move-note]')).not.toBeNull();
    expect(q('[data-event-save]').textContent).toBe('옮기고 저장');
    type('협의회 (미룸)');
    await save();
    expect(lastOps()[0]).toMatchObject({ changes: { text: '협의회 (미룸)', date: '2026-10-12' } });
    expect(document.querySelector('[data-toast]')?.textContent).toContain('10/8(목) → 10/12(월)');
    await act(async () => void (await undoLast(SID)));
    expect(lastOps()).toEqual([{ type: 'patch', at: { sid: SID, coll: 'items', id: 'e1' }, changes: { date: DAY }, before: { date: '2026-10-12' } }]);
  });

  it('그대로 두기 = 원래 날짜', () => {
    seed();
    render(<Host initial={{ sid: SID, date: DAY, id: 'e1' }} />);
    fireEvent.click(q('[data-event-date-next]'));
    fireEvent.click(q('[data-event-move-keep]'));
    expect(document.querySelector('[data-event-move-note]')).toBeNull();
  });

  it('알림 창 - 1430을 적어 저장하면 칸에만 담고, 일정을 저장할 때 걸린다', async () => {
    seed();
    render(<Host initial={{ sid: SID, date: DAY, id: 'e1' }} />);
    fireEvent.click(q('[data-event-alarm-open]'));
    fireEvent.change(q('[data-alarm-time]'), { target: { value: '1430' } });
    await act(async () => fireEvent.click(q('[data-alarm-save]')));
    expect(document.querySelector('[data-alarm-window]')).toBeNull();
    expect(written.batches).toHaveLength(0);
    await save();
    expect(lastOps()[0]).toMatchObject({ changes: { time: '14:30' } });
  });

  it('손대기 전에는 다른 기기에서 고친 것을 따라가고, 손댔으면 덮지 않는다', () => {
    seed();
    render(<Host initial={{ sid: SID, date: DAY, id: 'e1' }} />);
    act(() => applyBase(SID, 'items', new Map([['e1', { ...ev1, text: '다른 기기' }]])));
    expect(textInput().value).toBe('다른 기기');
    type('내가 적는 중');
    act(() => applyBase(SID, 'items', new Map([['e1', { ...ev1, text: '또 다른 기기' }]])));
    expect(textInput().value).toBe('내가 적는 중');
  });

  it('삭제 = 지운 표시 하나', async () => {
    seed();
    render(<Host initial={{ sid: SID, date: DAY, id: 'e1' }} />);
    await act(async () => fireEvent.click(q('[data-event-delete]')));
    expect(lastOps()).toEqual([{ type: 'remove', at: { sid: SID, coll: 'items', id: 'e1' } }]);
  });

  it('저장이 안 되면 칸을 닫지 않고 적은 것을 둔다', async () => {
    const { patch } = await import('../../data/repo');
    vi.mocked(patch).mockRejectedValueOnce(new Error('막힘'));
    seed();
    render(<Host initial={{ sid: SID, date: DAY, id: 'e1' }} />);
    type('못 적은 글');
    await save();
    expect(close).not.toHaveBeenCalled();
    expect(textInput().value).toBe('못 적은 글');
    expect(anyWindowUnsaved()).toBe(true);
  });

  it('지운 일정은 고치지 않는다', () => {
    seed(new Map([['e1', { ...ev1, deletedAt: t }]]));
    render(<Host initial={{ sid: SID, date: DAY, id: 'e1' }} />);
    expect(q('[data-event-missing]').textContent).toContain('지운 일정');
    expect(q('[data-event-save]')).toBeDisabled();
  });
});
