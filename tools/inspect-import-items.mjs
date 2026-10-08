// tools/inspect-import-items.mjs - P3-4: V4 일정·기록·메모 가져오기를 실제 크롬에서 본다
// (끝 조건: V4 seed 수와 맞다 · 두 번째는 바뀐 것 0 · V5에서 고친 것은 그대로).
//   1) V4 seed(일정 914·기록 178·메모 120) + 점검용 V4 문서(기간 조각·반복 묶음·이월 사슬·링크·공휴일·자동 기록 - 2027-03, seed 밖)를 심는다.
//   2) 환경설정 '가져오기' → 결과 표(일정·반복 묶음·기록·메모 줄과 학년도별 수)·아래 안내(합친 기간·묶음·뺀 공휴일·자동 기록).
//   3) 서버의 V5 항목 수 = V4에서 센 수. 라벨이 id로 붙었다. 하루 화면에 기간 '(k/n)'·반복 🔁·이월 '↪'·링크 🔗가 보인다.
//   4) 두 번째 가져오기는 바뀐 것 0(updatedAt 그대로). V5에서 고친 일정은 V4가 바뀌어도 덮지 않는다(둠).
//
//   npm run emu · V4 저장소 npm run seed · npm run seed · npm run dev:emu (켜 둔다) → node tools/inspect-import-items.mjs
// teacher 계정 - 끝에 V5에 가져온 것(항목·반복·라벨·설정·기록)을 지우고 V5 문서를 처음대로, 심은 V4 문서는 지운다.
import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore';
import { emulator, launch, newPage, open, report, restorer, sel, waitFor } from './lib/probe.mjs';

const r = report();
const em = emulator();
const uid = await em.signIn('teacher@example.com');
const sid = `u_${uid}`;
const undo = restorer();
const browser = await launch();

const v4Coll = (c) => collection(em.db, 'users', uid, c);
const v5Coll = (c) => collection(em.db, 'spaces', sid, c);
const snapDocs = async (ref) => Object.fromEntries((await getDocs(ref)).docs.map((d) => [d.id, d.data()]));

/** 컬렉션을 처음 모습으로 (새로 생긴 것은 지우고, 바뀐 것은 되돌린다) - 400개씩 묶어 */
async function restoreColl(ref, before) {
  const now = await getDocs(ref);
  let b = writeBatch(em.db);
  let n = 0;
  for (const d of now.docs) {
    if (!before[d.id]) b.delete(d.ref);
    else if (JSON.stringify(d.data()) !== JSON.stringify(before[d.id])) b.set(d.ref, { ...before[d.id], updatedAt: serverTimestamp() });
    else continue;
    if (++n % 400 === 0) {
      await b.commit();
      b = writeBatch(em.db);
    }
  }
  await b.commit();
}

// 점검용 V4 문서 (seed 기간 밖 2027-03 - 3/2 화 ~ 3/5 금)
const PLANT = {
  '2027-03-02': {
    eventList: [
      { id: 'insp_p1', content: '점검 시험 기간 (1/3)', groupId: 'insp_g1', label: '달력' },
      { id: 'insp_r1', content: '점검 협의회', groupId: 'insp_g2' },
      { id: 'insp_h', content: '점검 공휴일', label: '공휴일' },
      { id: 'insp_l', content: '점검 링크 일정', linkedItems: [{ targetType: 'memo', targetId: 'insp_memo', targetFId: 'personal' }] },
    ],
  },
  '2027-03-03': { eventList: [{ id: 'insp_p2', content: '점검 시험 기간 (2/3)', groupId: 'insp_g1', label: '달력', completed: true }] },
  '2027-03-04': { eventList: [{ id: 'insp_p3', content: '점검 시험 기간 (3/3)', groupId: 'insp_g1', label: '달력' }] },
  '2027-03-05': {
    eventList: [
      { id: 'insp_r2', content: '점검 협의회', groupId: 'insp_g2' },
      { id: 'insp_c', content: '점검 이월 사슬', label: '이월', labelIds: ['ev_3'], forwardChainId: 'insp_chain', originalDate: '2027-03-02', completed: true },
    ],
  },
};
const PLANT_J = { '2027-03-02': { entries: [{ id: 'insp_j', content: '점검 기록', labelIds: ['j_1'] }, { id: 'notice_2027-03-02', content: '알림장' }] } };
const PLANT_M = { insp_memo: { text: '점검 메모', labels: ['긴급'], order: -9e15, createdAt: 9e15 } };

try {
  // V5 처음 모습 (끝에 되돌린다)
  const before = {};
  for (const c of ['items', 'series', 'labels', 'settings']) before[c] = await snapDocs(v5Coll(c));
  undo.add(async () => {
    for (const c of ['items', 'series', 'labels', 'settings']) await restoreColl(v5Coll(c), before[c]);
  });
  // V4에 점검 문서 심기
  for (const [d, data] of Object.entries(PLANT)) {
    await setDoc(doc(em.db, 'users', uid, 'events', d), data);
    undo.add(() => deleteDoc(doc(em.db, 'users', uid, 'events', d)));
  }
  for (const [d, data] of Object.entries(PLANT_J)) {
    await setDoc(doc(em.db, 'users', uid, 'journals', d), data);
    undo.add(() => deleteDoc(doc(em.db, 'users', uid, 'journals', d)));
  }
  for (const [id, data] of Object.entries(PLANT_M)) {
    await setDoc(doc(em.db, 'users', uid, 'tasks', id), data);
    undo.add(() => deleteDoc(doc(em.db, 'users', uid, 'tasks', id)));
  }

  // V4에서 셀 수: 일정(공휴일·빈 글 빼고, 기간 조각 셋은 하나로), 기록(자동 기록 빼고), 메모
  const v4Events = await snapDocs(v4Coll('events'));
  let expectEvents = 0;
  for (const d of Object.values(v4Events)) for (const e of d.eventList ?? []) if (String(e.content ?? '').trim() && !/공휴일|휴일/.test(String(e.label ?? ''))) expectEvents++;
  expectEvents -= 2; // 기간 조각 셋 → 하나
  const v4Journals = await snapDocs(v4Coll('journals'));
  let expectJournals = 0;
  for (const d of Object.values(v4Journals)) for (const e of d.entries ?? []) if (!String(e.id ?? '').startsWith('notice_')) expectJournals++;
  const expectMemos = Object.keys(await snapDocs(v4Coll('tasks'))).length;

  const { page, errors } = await newPage(browser);
  await open(page, '#/day/2027-03-02');

  r.section('가져오기 → 결과 표');
  await page.evaluate(() => window.sp5.openWindow('settings', { tab: 'import' }));
  await page.locator(sel('import-run')).click();
  r.check(await waitFor(page.locator(sel('import-result')), 90000), '결과 표가 나온다');
  const count = async (row, col) => Number(await page.locator(`${sel('import-row', row)} ${sel('import-count', col)}`).textContent());
  const evAdded = await count('items.event', 'added');
  const noteAdded = await count('items.note', 'added');
  r.check(evAdded === expectEvents, `일정 새로 = V4에서 센 수 (${evAdded} / ${expectEvents})`);
  r.check(noteAdded === expectJournals + expectMemos, `기록·메모 새로 = V4 기록 + 메모 (${noteAdded} / ${expectJournals}+${expectMemos})`);
  r.check((await count('series', 'added')) === 1, '반복 묶음 1');
  r.check((await page.locator(`${sel('import-row', 'items.event')} ${sel('import-years')}`).textContent()).includes('2026학년도'), '학년도별 수');
  const notes = await page.locator(sel('import-note')).evaluateAll((els) => els.map((e) => e.dataset.importNote));
  r.check(['periods', 'series', 'holidays', 'autoJournals'].every((k) => notes.includes(k)), `아래 안내 (${notes.join(',')})`);

  r.section('서버');
  const items = Object.entries(await snapDocs(v5Coll('items'))).map(([id, d]) => ({ id, ...d })).filter((d) => d.src?.from === 'v4');
  r.check(items.filter((d) => d.kind === 'event').length === expectEvents, `V5 일정 문서 수 (${items.filter((d) => d.kind === 'event').length})`);
  const labels = Object.entries(await snapDocs(v5Coll('labels'))).map(([id, d]) => ({ id, ...d }));
  const fwdLabel = labels.find((l) => l.kind === 'event' && l.name === '이월');
  const seedFwd = items.find((d) => d.kind === 'event' && d.labelIds?.includes(fwdLabel?.id));
  r.check(!!seedFwd, "seed의 '이월' 일정이 V5 이월 라벨 id를 단다");
  const exam = items.find((d) => d.text === '점검 시험 기간');
  r.check(exam?.date === '2027-03-02' && exam.endDate === '2027-03-04' && JSON.stringify(exam.doneDates) === '["2027-03-03"]', '기간 조각 → 한 항목 (끝 날·그날 완료)');
  const memo = items.find((d) => d.text === '점검 메모');
  r.check(JSON.stringify(items.find((d) => d.text === '점검 링크 일정')?.linkIds) === JSON.stringify([memo?.id]), '링크 = V5 메모 id');
  r.check(!items.some((d) => d.text === '점검 공휴일' || d.text === '알림장'), '공휴일·자동 기록은 없다');
  r.check(items.find((d) => d.text === '점검 이월 사슬')?.carriedFrom === '2027-03-02', '끝낸 이월 사슬 → carriedFrom');

  r.section('하루 화면');
  await page.keyboard.press('Escape');
  const card = (text) => page.locator(sel('event-card')).filter({ hasText: text });
  r.check(await waitFor(card('점검 시험 기간'), 8000), '가져온 일정이 하루 화면에');
  r.check((await card('점검 시험 기간').locator(sel('event-period')).getAttribute('data-event-period')) === '1/3', "기간 '(1/3)'");
  r.check((await card('점검 협의회').locator(sel('event-series')).count()) === 1, '반복 🔁');
  r.check((await card('점검 링크 일정').locator(sel('event-links')).count()) === 1, '링크 🔗');

  r.section('두 번째 가져오기 · V5에서 고친 것');
  const stamp = async () => Object.fromEntries(Object.entries(await snapDocs(v5Coll('items'))).map(([id, d]) => [id, d.updatedAt?.toMillis?.() ?? 0]));
  // V5에서 하나 고치고 V4에서도 그것을 고친다
  const target = items.find((d) => d.text === '점검 링크 일정');
  await setDoc(doc(em.db, 'spaces', sid, 'items', target.id), {
    ...(await getDoc(doc(em.db, 'spaces', sid, 'items', target.id))).data(),
    text: '점검 링크 일정 (V5에서 고침)',
    updatedAt: serverTimestamp(),
  });
  await setDoc(doc(em.db, 'users', uid, 'events', '2027-03-02'), {
    eventList: PLANT['2027-03-02'].eventList.map((e) => (e.id === 'insp_l' ? { ...e, content: '점검 링크 일정 (V4에서 고침)' } : e)),
  });
  const s1 = await stamp();
  await page.evaluate(() => window.sp5.openWindow('settings', { tab: 'import' }));
  await page.locator(sel('import-run')).click();
  r.check(await waitFor(async () => (await page.locator(sel('import-run')).textContent()).includes('다시 가져오기') && (await page.locator(sel('import-progress')).count()) === 0, 90000), '두 번째 가져오기 끝');
  await waitFor(page.locator(sel('import-result')), 5000);
  const added2 = await count('items.event', 'added');
  const changed2 = await count('items.event', 'changed');
  const kept2 = await count('items.event', 'kept');
  r.check(added2 === 0 && changed2 === 0, `바뀐 것 0 (새로 ${added2}, 바뀜 ${changed2})`);
  r.check(kept2 >= 1, `V5에서 고친 것은 둠 (${kept2})`);
  const s2 = await stamp();
  const moved = Object.keys(s2).filter((id) => s1[id] !== s2[id]);
  r.check(moved.length === 0, `항목 문서를 다시 쓰지 않는다 (${moved.length})`);
  const kept = (await getDoc(doc(em.db, 'spaces', sid, 'items', target.id))).data();
  r.check(kept.text === '점검 링크 일정 (V5에서 고침)', 'V5에서 고친 글이 그대로');

  r.check(errors.length === 0, `화면 오류 없음 ${errors.join(' | ')}`);
} catch (e) {
  r.bad(`점검이 멈췄다: ${e?.stack ?? e}`);
} finally {
  await browser.close();
  await undo.run();
  r.done();
  process.exit();
}
