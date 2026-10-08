import { describe, expect, it } from 'vitest';
import { DELETE_FIELD, SERVER_TIME, toWrite, type WriteOp } from '../../data/repo/ops';
import type { Stored } from '../../data/types';
import { labelProps } from '../../domain/labels';
import { v4id } from './ids';
import { eventLabelSources, noteLabelSources, planLabels, V4_LABELS_PATH, type V4LabelDocs } from './labels';
import { changedTotal, IMPORT_DELETER } from './plan';

type L = Stored<'labels'>;
const SID = 'u_me';
const TS = { seconds: 1, nanoseconds: 0 } as unknown as L['updatedAt'];

/** V4 seed와 같은 모양 */
const seed = (): V4LabelDocs => ({
  labels: {
    eventLabels: [
      { id: 'ev_1', name: '달력', color: 'red', calendar: true, skip: false, forward: false, period: false, recur: false },
      { id: 'ev_2', name: '수업X', color: 'orange', calendar: true, skip: true, forward: false, period: false, recur: false },
      { id: 'ev_3', name: '이월', color: 'green', calendar: false, skip: false, forward: true, period: false, recur: false },
    ],
    journalLabels: [
      { id: 'j_1', name: '학급활동', color: 'green' },
      { id: 'j_2', name: '학생상담', color: 'yellow' },
    ],
    memoLabels: ['긴급', '학교', 'A초', '학급활동'],
  },
  labelTree: { entry: { A초: '학교' } },
  gcal: { labels: { ev_3: true } },
});

/** 쓰기 묶음을 V5 문서 모음에 입힌다 (서버가 적은 것처럼) */
function apply(existing: Record<string, L>, ops: WriteOp[]): Record<string, L> {
  const out = { ...existing };
  for (const op of ops) {
    const w = toWrite(op, { uid: 'me', now: 1 });
    const id = op.at.id;
    const fix = (data: Record<string, unknown>) =>
      Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v === SERVER_TIME ? TS : v]).filter(([, v]) => v !== DELETE_FIELD));
    if (w.kind === 'set') out[id] = { ...fix(w.data), id } as unknown as L;
    else if (w.kind === 'update') {
      const next: Record<string, unknown> = { ...out[id], ...fix(w.data) };
      for (const [k, v] of Object.entries(w.data)) if (v === DELETE_FIELD) delete next[k];
      out[id] = next as unknown as L;
    } else delete out[id];
  }
  return out;
}

const live = (docs: Record<string, L>, kind: 'event' | 'note') =>
  Object.values(docs)
    .filter((d) => d.kind === kind && !d.deletedAt)
    .sort((a, b) => (a.order < b.order ? -1 : 1));

describe('V4 라벨 읽기', () => {
  it('일정: 속성은 V3 이름 먼저, 구글 캘린더는 v4_gcal, id가 없으면 이름 열쇠', () => {
    const src = eventLabelSources({
      labels: { eventLabels: [{ id: 'ev_3', name: ' 이월 ', forward: true, isForward: false }, { name: '회의', color: 'pink' }] },
      gcal: { labels: { ev_3: true } },
    });
    expect(src[0]).toMatchObject({ key: 'ev_3', name: '이월', v4Name: ' 이월 ', props: labelProps({ forward: false, gcal: true }) });
    expect(src[1]).toMatchObject({ key: 'name:회의', name: '회의', color: 'pink' });
  });

  it('라벨 문서가 없으면 V4가 보이던 기본 라벨 (일정 다섯, 기록 넷 + 메모 다섯)', () => {
    expect(eventLabelSources({}).map((s) => s.name)).toEqual(['달력', '수업X', '이월', '기간', '반복']);
    expect(noteLabelSources({}).map((s) => s.name)).toEqual(['학급활동', '학생상담', '업무전달', '수업기록', '긴급', '중요', '업무', '개인', '기타']);
    // V3 옛 칸 labels
    expect(eventLabelSources({ labels: { labels: [{ id: 'x', name: '옛' }] } }).map((s) => s.name)).toEqual(['옛']);
  });

  it('메모·기록: 이름으로 합치고(기록 id·메모에만 있던 것은 jm_이름), 상위 이름', () => {
    const src = noteLabelSources(seed());
    expect(src.map((s) => [s.key, s.name, s.parentName])).toEqual([
      ['j_1', '학급활동', undefined],
      ['j_2', '학생상담', undefined],
      ['jm_긴급', '긴급', undefined],
      ['jm_학교', '학교', undefined],
      ['jm_A초', 'A초', '학교'],
    ]);
  });
});

describe('planLabels - 처음 가져오기', () => {
  const plan = planLabels(SID, seed(), {});
  const docs = apply({}, plan.ops);

  it('V4 차례대로, 결정적 id, src·속성·상위', () => {
    expect(plan.counts.event).toMatchObject({ added: 3 });
    expect(plan.counts.note).toMatchObject({ added: 5 });
    const ev = live(docs, 'event');
    expect(ev.map((d) => d.name)).toEqual(['달력', '수업X', '이월']);
    expect(ev[0].id).toBe(v4id('label.event', SID, V4_LABELS_PATH, 'ev_1'));
    expect(ev[0].src).toMatchObject({ from: 'v4', path: V4_LABELS_PATH, id: 'ev_1' });
    expect(ev[2].props).toEqual(labelProps({ calendar: false, forward: true, gcal: true }));
    expect(ev.every((d) => d.parentId === null)).toBe(true);

    const notes = live(docs, 'note');
    expect(notes.map((d) => d.name)).toEqual(['학급활동', '학생상담', '긴급', '학교', 'A초']);
    const school = notes.find((d) => d.name === '학교')!;
    expect(notes.find((d) => d.name === 'A초')!.parentId).toBe(school.id);
    expect(notes.every((d) => d.props === undefined)).toBe(true);
  });

  it('짝 표: V4 이름 → V5 id', () => {
    expect(plan.labelMap.event['이월']).toBe(v4id('label.event', SID, V4_LABELS_PATH, 'ev_3'));
    expect(plan.labelMap.note['긴급']).toBe(v4id('label.note', SID, V4_LABELS_PATH, 'jm_긴급'));
  });

  it('두 번째 가져오기는 바뀐 것 0', () => {
    const again = planLabels(SID, seed(), docs);
    expect(again.ops).toEqual([]);
    expect(changedTotal(again.counts.event) + changedTotal(again.counts.note)).toBe(0);
    expect(again.counts.event.same).toBe(3);
    expect(again.labelMap).toEqual(plan.labelMap);
  });
});

describe('planLabels - 다시 가져오기', () => {
  const first = apply({}, planLabels(SID, seed(), {}).ops);
  const idOf = (key: string, kind = 'event') => v4id(`label.${kind}`, SID, V4_LABELS_PATH, key);

  it('V4에서 이름을 바꾸면(같은 id) 그 라벨 문서의 이름만', () => {
    const v4 = seed();
    (v4.labels as { eventLabels: Array<{ name: string }> }).eventLabels[0].name = '행사';
    const plan = planLabels(SID, v4, first);
    expect(plan.counts.event).toMatchObject({ changed: 1, same: 2 });
    expect(plan.ops).toHaveLength(1);
    expect(plan.ops[0]).toMatchObject({ type: 'patch', at: { id: idOf('ev_1') } });
    expect(Object.keys((plan.ops[0] as { changes: object }).changes).sort()).toEqual(['name', 'src']);
  });

  it('V5에서 고친 라벨은 덮지 않는다', () => {
    const edited = { ...first, [idOf('ev_1')]: { ...first[idOf('ev_1')], color: 'blue' } };
    const v4 = seed();
    (v4.labels as { eventLabels: Array<{ name: string }> }).eventLabels[0].name = '행사';
    const plan = planLabels(SID, v4, edited);
    expect(plan.ops).toEqual([]);
    expect(plan.counts.event.kept).toBe(1);
  });

  it('V4에서 지운 라벨은 지운 표시, 다시 생기면 새로', () => {
    const v4 = seed();
    (v4.labels as { eventLabels: unknown[] }).eventLabels.pop();
    const plan = planLabels(SID, v4, first);
    expect(plan.counts.event.removed).toBe(1);
    const after = apply(first, plan.ops);
    expect(after[idOf('ev_3')]).toMatchObject({ deletedBy: IMPORT_DELETER });
    const back = planLabels(SID, seed(), after);
    expect(back.counts.event.added).toBe(1);
  });

  it('V4 트리가 바뀌면 그 하위의 parentId만', () => {
    const v4 = { ...seed(), labelTree: { entry: {} } };
    const plan = planLabels(SID, v4, first);
    expect(plan.counts.note).toMatchObject({ changed: 1 });
    expect(plan.ops[0]).toMatchObject({ type: 'patch', changes: { parentId: null } });
  });
});

describe('planLabels - 이름이 같은 라벨', () => {
  it('V5에 이름이 같은 라벨이 있으면 새로 만들지 않고 그 라벨에 잇는다 (짝 표에)', () => {
    const mine = { id: 'dflt_e1', kind: 'event', name: '달력', color: 'red', parentId: null, order: 'a0', deletedAt: null, updatedAt: TS, v: 1 } as unknown as L;
    const plan = planLabels(SID, seed(), { dflt_e1: mine });
    expect(plan.counts.event).toMatchObject({ added: 2, kept: 1 });
    expect(plan.labelMap.event['달력']).toBe('dflt_e1');
    const again = planLabels(SID, seed(), apply({ dflt_e1: mine }, plan.ops));
    expect(changedTotal(again.counts.event)).toBe(0);
  });

  it('상위가 V5 라벨에 이어졌으면 하위의 parentId도 그 라벨', () => {
    const mine = { id: 'my_school', kind: 'note', name: '학교', color: 'blue', parentId: null, order: 'a0', deletedAt: null, updatedAt: TS, v: 1 } as unknown as L;
    const docs = apply({ my_school: mine }, planLabels(SID, seed(), { my_school: mine }).ops);
    expect(live(docs, 'note').find((d) => d.name === 'A초')!.parentId).toBe('my_school');
  });

  it('V4에 이름이 같은 라벨이 둘이면 앞의 것 하나 (뒤 이름도 짝 표에)', () => {
    const v4: V4LabelDocs = { labels: { eventLabels: [{ id: 'a', name: '회의' }, { id: 'b', name: ' 회의' }] } };
    const plan = planLabels(SID, v4, {});
    expect(plan.counts.event.added).toBe(1);
    expect(plan.labelMap.event[' 회의']).toBe(plan.labelMap.event['회의']);
  });
});
