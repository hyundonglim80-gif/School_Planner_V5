// 가져오기 자료 층 테스트 (에뮬레이터 - `npm run emu` 뒤 `npm run test:data`).
// V4 자리(users/{uid}/settings)에 V4 모양을 심고 가져와, V5 라벨·설정·기록이 규칙(firestore.rules)을 지나 맞게 적히는지,
// 두 번째 가져오기가 아무것도 쓰지 않는지 본다. 점검 전용 계정(importtest@)에만 쓰고 끝에 지운다.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc, terminate } from 'firebase/firestore';
import { deleteApp } from 'firebase/app';
import { app, auth, db } from '../../data/firebase';
import { personalSpaceId } from '../../data/space';
import { useSession } from '../../data/session';
import type { Label } from '../../data/types';
import { labelProps } from '../../domain/labels';
import { changedTotal, IMPORT_DELETER } from './plan';
import { checkImportOffer, runImport, totalCounts, useImportRun } from './run';

const EMAIL = 'importtest@example.com';
const PASSWORD = 'test1234';
let uid = '';
let sid = '';

const v4Doc = (id: string) => doc(db, 'users', uid, 'settings', id);
const V4_IDS = ['labels', 'v4_labelTree', 'v4_gcal', 'v4_preferences_pc', 'v4_preferences_mobile', 'v4_preferences'];

const V4_LABELS = {
  eventLabels: [
    { id: 'ev_1', name: '달력', color: 'red', calendar: true, showInCalendar: true, skip: false, forward: false },
    { id: 'ev_3', name: '이월', color: 'green', calendar: true, showInCalendar: false, forward: true, isForward: true },
    { id: 'lbl_ev_9', name: '회의', color: 'pink' },
  ],
  journalLabels: [{ id: 'j_1', name: '학급활동', color: 'green' }],
  memoLabels: ['학교', 'A초'],
};

async function clean() {
  for (const coll of ['labels', 'settings', 'items', 'series']) {
    const snap = await getDocs(collection(db, 'spaces', sid, coll));
    for (const d of snap.docs) await deleteDoc(d.ref);
  }
  for (const id of V4_IDS) await deleteDoc(v4Doc(id));
  for (const coll of ['events', 'journals', 'tasks']) {
    const snap = await getDocs(collection(db, 'users', uid, coll));
    for (const d of snap.docs) await deleteDoc(d.ref);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any> & { id: string };
const v5Items = async (): Promise<Row[]> => {
  const snap = await getDocs(collection(db, 'spaces', sid, 'items'));
  return snap.docs.map((d) => ({ ...d.data(), id: d.id }));
};

async function labels(): Promise<Array<Label & { id: string }>> {
  const snap = await getDocs(collection(db, 'spaces', sid, 'labels'));
  return snap.docs.map((d) => ({ ...(d.data() as Label), id: d.id })).sort((a, b) => (a.order < b.order ? -1 : 1));
}

const settingsDoc = async (id: string) => (await getDoc(doc(db, 'spaces', sid, 'settings', id))).data();

beforeAll(async () => {
  try {
    await createUserWithEmailAndPassword(auth, EMAIL, PASSWORD);
  } catch (e) {
    if ((e as { code?: string }).code === 'auth/network-request-failed') {
      throw new Error('에뮬레이터가 꺼져 있다 - 다른 창에서 npm run emu', { cause: e });
    }
    await signInWithEmailAndPassword(auth, EMAIL, PASSWORD);
  }
  uid = auth.currentUser!.uid;
  sid = personalSpaceId(uid);
  useSession.setState({ loading: false, user: { uid, email: EMAIL, displayName: '', photoURL: '' } });
  await clean();
});

afterAll(async () => {
  await clean();
  await signOut(auth);
  await terminate(db);
  await deleteApp(app);
});

describe('V4 가져오기 (에뮬레이터)', () => {
  it('V4 자료가 없으면 띠를 보이지 않는다', async () => {
    await checkImportOffer(uid);
    expect(useImportRun.getState().offer).toBe(false);
  });

  it('V4 자료가 있고 가져온 적이 없으면 띠를 보인다', async () => {
    await setDoc(v4Doc('labels'), V4_LABELS);
    await setDoc(v4Doc('v4_labelTree'), { entry: { A초: '학교' }, memo: {}, journal: {} });
    await setDoc(v4Doc('v4_gcal'), { labels: { lbl_ev_9: true } });
    await setDoc(v4Doc('v4_preferences_pc'), { fontScale: 'lg', popupStyle: 'center', forwardLookbackDays: 21 });
    await checkImportOffer(uid);
    expect(useImportRun.getState().offer).toBe(true);
  });

  it('가져오기: 라벨(이름·색·속성·상위)·설정·기록이 규칙을 지나 적힌다', async () => {
    expect(await runImport(uid)).toBe(true);
    const run = useImportRun.getState();
    expect(run).toMatchObject({ state: 'done', offer: false });
    expect(run.counts!['labels.event']).toMatchObject({ added: 3 });
    expect(run.counts!['labels.note']).toMatchObject({ added: 3 });

    const all = await labels();
    const ev = all.filter((l) => l.kind === 'event');
    expect(ev.map((l) => [l.name, l.color])).toEqual([
      ['달력', 'red'],
      ['이월', 'green'],
      ['회의', 'pink'],
    ]);
    // V3 이름 먼저: showInCalendar false가 calendar true를 이긴다
    expect(ev[1].props).toEqual(labelProps({ calendar: false, forward: true }));
    expect(ev[2].props).toEqual(labelProps({ gcal: true }));
    expect(ev[0].src).toMatchObject({ from: 'v4', path: 'settings/labels', id: 'ev_1' });
    expect(ev.every((l) => l.deletedAt === null && l.v === 1)).toBe(true);

    const notes = all.filter((l) => l.kind === 'note');
    expect(notes.map((l) => l.name)).toEqual(['학급활동', '학교', 'A초']);
    expect(notes[2].parentId).toBe(notes[1].id);

    expect(await settingsDoc('pc')).toMatchObject({ fontScale: 'lg', popupStyle: 'center' });
    expect(await settingsDoc('common')).toMatchObject({ forwardDays: 21 });
    expect(await settingsDoc('mobile')).toBeUndefined();
    const record = await settingsDoc('import');
    expect(record).toMatchObject({ labelMap: { event: { 회의: ev[2].id } }, settings: { pc: { fontScale: 'lg', popupStyle: 'center' } } });
    expect(typeof record!.at).toBe('number');
  });

  it('두 번째 가져오기는 바뀐 것 0 - 라벨 문서를 다시 쓰지 않는다', async () => {
    const before = await labels();
    expect(await runImport(uid)).toBe(true);
    expect(changedTotal(totalCounts(useImportRun.getState().counts))).toBe(0);
    const after = await labels();
    expect(after.map((l) => l.updatedAt.toMillis())).toEqual(before.map((l) => l.updatedAt.toMillis()));
  });

  it('V4에서 지운 라벨은 지운 표시(가져오기가), 가져온 뒤에는 띠가 없다', async () => {
    await setDoc(v4Doc('labels'), { ...V4_LABELS, eventLabels: V4_LABELS.eventLabels.slice(0, 2) });
    expect(await runImport(uid)).toBe(true);
    expect(useImportRun.getState().counts!['labels.event']).toMatchObject({ removed: 1, same: 2 });
    const gone = (await labels()).find((l) => l.name === '회의')!;
    expect(gone.deletedAt).not.toBeNull();
    expect(gone.deletedBy).toBe(IMPORT_DELETER);
    await checkImportOffer(uid);
    expect(useImportRun.getState().offer).toBe(false);
  });

  it('일정·기간·반복·기록·메모·링크를 가져오고, 두 번째는 바뀐 것 0', async () => {
    await setDoc(doc(db, 'users', uid, 'events', '2026-10-14'), {
      eventList: [
        { id: 'e1', content: '상담', label: '달력', linkedItems: [{ targetType: 'memo', targetId: 'm1' }] },
        { id: 'p1', content: '기말고사 (1/2)', groupId: 'g1' },
        { id: 'r1', content: '협의회', groupId: 'g2' },
      ],
    });
    await setDoc(doc(db, 'users', uid, 'events', '2026-10-15'), {
      eventList: [
        { id: 'p2', content: '기말고사 (2/2)', groupId: 'g1', completed: true },
        { id: 'r2', content: '협의회', groupId: 'g2' },
      ],
    });
    await setDoc(doc(db, 'users', uid, 'journals', '2026-10-14'), { entries: [{ id: 'j1', content: '모둠 활동', labelIds: ['j_1'] }, { id: 'notice_2026-10-14', content: '알림장' }] });
    await setDoc(doc(db, 'users', uid, 'tasks', 'm1'), { text: '준비물', labels: ['학교'], order: -1 });

    expect(await runImport(uid)).toBe(true);
    const counts = useImportRun.getState().counts!;
    expect(counts['items.event']).toMatchObject({ added: 4 });
    expect(counts['items.note']).toMatchObject({ added: 2 });
    expect(counts.series).toMatchObject({ added: 1 });
    const items = await v5Items();
    const exam = items.find((i) => i.text === '기말고사')!;
    expect(exam).toMatchObject({ date: '2026-10-14', endDate: '2026-10-15', doneDates: ['2026-10-15'], deletedAt: null, v: 1 });
    const series = await getDocs(collection(db, 'spaces', sid, 'series'));
    expect(series.docs).toHaveLength(1);
    expect(items.filter((i) => i.seriesId === series.docs[0].id)).toHaveLength(2);
    const memo = items.find((i) => i.text === '준비물')!;
    expect(items.find((i) => i.text === '상담')!.linkIds).toEqual([memo.id]);
    expect(items.some((i) => i.text === '알림장')).toBe(false);
    expect((await settingsDoc('import'))!.notes).toMatchObject({ periods: 1, series: 1, autoJournals: 1 });

    const stamps = items.map((i) => (i.updatedAt as { toMillis: () => number }).toMillis()).sort();
    expect(await runImport(uid)).toBe(true);
    expect(changedTotal(totalCounts(useImportRun.getState().counts))).toBe(0);
    const again = (await v5Items()).map((i) => (i.updatedAt as { toMillis: () => number }).toMillis()).sort();
    expect(again).toEqual(stamps);
  });
});
