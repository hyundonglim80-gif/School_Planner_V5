// tools/inspect-events.mjs - P3-1: 하루 화면의 일정을 실제 크롬에서 본다 (끝 조건: 저장마다 서버 문서 하나만 바뀐다).
//   1) 하루 화면: 그날 일정 카드(라벨 칩·⏰·기한·🔗), 다른 날 일정은 없다.
//   2) ☐ 완료 = 그 일정 문서 하나(done) - 다른 일정의 updatedAt은 그대로. 라벨 칩 = 완료 풀기.
//   3) ▲ 순서 = 옮긴 일정의 order 하나.
//
//   npm run emu · npm run dev:emu (켜 둔다) → node tools/inspect-events.mjs
// 에뮬레이터 teacher 계정의 개인 공간에 점검 일정(insp_ev…)·라벨을 심고 끝에 지운다.
import { collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { emulator, launch, newPage, open, report, restorer, sel, serverUntil, waitFor } from './lib/probe.mjs';

const r = report();
const em = emulator();
const uid = await em.signIn('teacher@example.com');
const sid = `u_${uid}`;
const undo = restorer();
const browser = await launch();

const DAY = '2026-10-08';
const itemRef = (id) => doc(em.db, 'spaces', sid, 'items', id);
const labelRef = (id) => doc(em.db, 'spaces', sid, 'labels', id);
const read = async (id) => {
  const s = await getDoc(itemRef(id));
  return s.exists() ? s.data() : null;
};
/** 그날 일정 문서들의 updatedAt (어느 문서가 바뀌었나 보기) */
const stamps = async () => {
  const snap = await getDocs(query(collection(em.db, 'spaces', sid, 'items'), where('date', '==', DAY)));
  return Object.fromEntries(snap.docs.map((d) => [d.id, d.data().updatedAt?.toMillis() ?? 0]));
};
const changed = (a, b) => Object.keys({ ...a, ...b }).filter((id) => a[id] !== b[id]);
const stamp = { deletedAt: null, updatedAt: serverTimestamp(), v: 1, createdAt: Date.now(), authorId: uid };
const EVENTS = {
  insp_ev1: { text: '점검 일정 하나', labelIds: ['insp_el'], order: 'Zz1', time: '09:30', due: '2026-10-10', linkIds: ['x'] },
  insp_ev2: { text: '점검 일정 둘', labelIds: [], order: 'Zz2' },
  insp_ev3: { text: '점검 일정 셋', labelIds: [], order: 'Zz3' },
  insp_ev9: { text: '점검 다른 날', labelIds: [], order: 'Zz1', date: '2026-10-09' },
};

try {
  await setDoc(labelRef('insp_el'), { kind: 'event', name: '점검이월', color: 'green', parentId: null, order: 'Zz1', props: { forward: true }, ...stamp });
  undo.add(() => deleteDoc(labelRef('insp_el')));
  for (const [id, data] of Object.entries(EVENTS)) {
    await setDoc(itemRef(id), { kind: 'event', date: DAY, ...data, ...stamp });
    undo.add(() => deleteDoc(itemRef(id)));
  }

  const { page, errors } = await newPage(browser);
  await open(page, `#/day/${DAY}`);
  const card = (id) => page.locator(sel('event-card', id));

  r.section('하루 화면 일정 칸');
  r.check(await waitFor(card('insp_ev3')), '심은 일정 카드가 보인다');
  r.check((await card('insp_ev9').count()) === 0, '다른 날 일정은 없다');
  r.check(await card('insp_ev1').locator(sel('event-chip', 'insp_el')).isVisible(), '라벨 칩');
  r.check((await card('insp_ev1').locator(sel('event-alarm')).textContent()).includes('09:30'), '⏰ 알림 시각');
  r.check((await card('insp_ev1').locator(sel('due-badge')).count()) === 1, '⏳ 기한');
  r.check((await card('insp_ev1').locator(sel('event-links')).textContent()).includes('1'), '🔗 링크 수');
  const ids = await page.locator(sel('event-card')).evaluateAll((els) => els.map((e) => e.dataset.eventCard));
  r.check(ids.indexOf('insp_ev1') < ids.indexOf('insp_ev2') && ids.indexOf('insp_ev2') < ids.indexOf('insp_ev3'), '차례대로');

  r.section('완료 = 문서 하나');
  let before = await stamps();
  await card('insp_ev2').locator(sel('event-complete')).click();
  r.check(await waitFor(async () => (await card('insp_ev2').getAttribute('data-event-done')) === '1', 2000), '☐ 누르면 곧바로 완료로 보인다');
  const done = await serverUntil(() => read('insp_ev2'), (d) => d?.done === true);
  r.check(done?.done === true && typeof done.doneAt === 'number', '서버: done·doneAt');
  let after = await serverUntil(stamps, (s) => changed(before, s).length > 0);
  r.check(JSON.stringify(changed(before, after)) === JSON.stringify(['insp_ev2']), `바뀐 문서는 그 일정 하나 (${changed(before, after).join(',')})`);
  before = after;
  await card('insp_ev1').locator(sel('event-chip', 'insp_el')).click();
  r.check((await serverUntil(() => read('insp_ev1'), (d) => d?.done === true))?.done === true, '라벨 칩 누르기 = 완료');
  await card('insp_ev1').locator(sel('event-chip', 'insp_el')).click();
  const undone = await serverUntil(() => read('insp_ev1'), (d) => d?.done === false);
  r.check(undone?.done === false && undone.doneAt === undefined, '한 번 더 = 완료 풀기 (doneAt 지움)');
  r.check((await page.locator(sel('toast')).count()) === 0, '완료에는 안내가 뜨지 않는다 (V4 그대로)');

  r.section('순서 = 문서 하나');
  before = await stamps();
  await card('insp_ev3').hover();
  await card('insp_ev3').locator(sel('event-up')).click();
  after = await serverUntil(stamps, (s) => changed(before, s).length > 0);
  r.check(changed(before, after).length === 1, `▲ 한 번 = 문서 하나의 order (${changed(before, after).join(',')})`);
  r.check(
    await waitFor(async () => {
      const now = await page.locator(sel('event-card')).evaluateAll((els) => els.map((e) => e.dataset.eventCard));
      return now.indexOf('insp_ev3') < now.indexOf('insp_ev2');
    }),
    '셋째가 둘째 위로',
  );

  r.check(errors.length === 0, '화면 오류 없음', `화면 오류: ${errors.join(' / ')}`);
} catch (e) {
  r.bad(`점검이 멈췄다: ${e?.stack || e}`);
} finally {
  await undo.run();
  await browser.close();
  r.done();
  process.exit();
}
