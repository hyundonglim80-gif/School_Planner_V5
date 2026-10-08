// tools/inspect-forward.mjs - P3-3: 이월(계산)을 실제 크롬에서 본다 (끝 조건: 앱을 열 때 이월이 서버에 아무것도 쓰지 않는다 - 처음 따라올 때 한 번만).
//   1) 오늘 칸: 오늘 것 아래에 따라오는 일정 '↪ m/d부터' - 이월 기간 안의 것, 기간 밖이어도 이미 따라오던 것(carrying). 끝낸 것·기간 밖 처음 것은 없다.
//   2) 처음 따라오는 일정에만 carrying: true (문서 하나) - 이미 따라오던 것은 쓰지 않는다. 다시 열면 아무것도 쓰지 않는다.
//   3) 오늘 칸에서 끝내기 = date 오늘·carriedFrom 처음 날·carrying 걷기 (그 문서 하나) → Ctrl+Z로 제자리.
//   4) 지난 날 칸: 흐리게 '→ 오늘로' → 누르면 오늘. 일정 칸을 열면 '↪ … 부터' 안내.
//   5) 환경설정 '학교' → 이월 기간 → 계정(settings/common.forwardDays).
//
//   npm run emu · npm run dev:emu (켜 둔다) → node tools/inspect-forward.mjs
// 에뮬레이터 teacher 계정의 개인 공간에 점검 일정(insp_fw…)·라벨을 심고 끝에 지운다. 날짜는 이 기기의 오늘에 맞춘다.
import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';
import { emulator, hashOf, launch, newPage, open, report, restorer, sel, serverUntil, waitFor } from './lib/probe.mjs';

const r = report();
const em = emulator();
const uid = await em.signIn('teacher@example.com');
const sid = `u_${uid}`;
const undo = restorer();
const browser = await launch();

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return ymd(d);
};
const TODAY = daysAgo(0);
const md = (s) => `${Number(s.slice(5, 7))}/${Number(s.slice(8, 10))}`;

const itemRef = (id) => doc(em.db, 'spaces', sid, 'items', id);
const labelRef = (id) => doc(em.db, 'spaces', sid, 'labels', id);
const commonRef = doc(em.db, 'spaces', sid, 'settings', 'common');
const read = async (id) => {
  const s = await getDoc(itemRef(id));
  return s.exists() ? s.data() : null;
};
/** 점검 일정 문서들의 updatedAt (어느 문서가 바뀌었나) */
const stamps = async () => {
  const snap = await getDocs(collection(em.db, 'spaces', sid, 'items'));
  return Object.fromEntries(snap.docs.filter((d) => d.id.startsWith('insp_fw')).map((d) => [d.id, d.data().updatedAt?.toMillis() ?? 0]));
};
const changed = (a, b) => Object.keys({ ...a, ...b }).filter((id) => a[id] !== b[id]);
const stamp = { deletedAt: null, updatedAt: serverTimestamp(), v: 1, createdAt: Date.now(), authorId: uid };
const FW = ['insp_fwl'];
const EVENTS = {
  // 3일 전 - 이미 따라오던 것
  insp_fw1: { text: '점검 이월 하나', date: daysAgo(3), labelIds: FW, order: 'Zz1', carrying: true },
  // 30일 전 - 이월 기간(14) 밖이지만 이미 따라오던 것
  insp_fw2: { text: '점검 이월 오래된 것', date: daysAgo(30), labelIds: FW, order: 'Zz2', carrying: true },
  // 30일 전 - 기간 밖 처음 것 (따라오지 않는다)
  insp_fw3: { text: '점검 잊은 일정', date: daysAgo(30), labelIds: FW, order: 'Zz3' },
  // 2일 전 - 처음 따라오는 것 (carrying을 한 번 적는다)
  insp_fw4: { text: '점검 이월 처음', date: daysAgo(2), labelIds: FW, order: 'Zz4' },
  // 끝낸 것
  insp_fw5: { text: '점검 끝낸 일정', date: daysAgo(3), labelIds: FW, order: 'Zz5', done: true, doneAt: 1 },
  // 이월 아닌 것
  insp_fw6: { text: '점검 그냥 일정', date: daysAgo(3), labelIds: [], order: 'Zz6' },
};

try {
  const commonBefore = (await getDoc(commonRef)).data() ?? null;
  undo.add(async () => {
    if (commonBefore) await setDoc(commonRef, commonBefore);
    else await deleteDoc(commonRef);
  });
  await setDoc(labelRef('insp_fwl'), { kind: 'event', name: '점검이월', color: 'green', parentId: null, order: 'Zz1', props: { forward: true }, ...stamp });
  undo.add(() => deleteDoc(labelRef('insp_fwl')));
  for (const [id, data] of Object.entries(EVENTS)) {
    await setDoc(itemRef(id), { kind: 'event', ...data, ...stamp });
    undo.add(() => deleteDoc(itemRef(id)));
  }
  const seeded = await stamps();

  const { page, errors } = await newPage(browser);
  await open(page, `#/day/${TODAY}`);
  const card = (id) => page.locator(sel('event-card', id));

  r.section('오늘 칸에 따라오는 일정');
  r.check(await waitFor(card('insp_fw4'), 8000), '처음 따라오는 일정이 오늘 칸에');
  r.check((await card('insp_fw1').getAttribute('data-event-carried')) === daysAgo(3), '이월 기간 안 - 따라온다 (처음 날)');
  r.check((await card('insp_fw1').locator(sel('event-since')).textContent()).includes(`${md(daysAgo(3))}부터`), `'↪ ${md(daysAgo(3))}부터'`);
  r.check((await card('insp_fw2').count()) === 1, '기간 밖이어도 이미 따라오던 것(carrying)은 따라온다');
  r.check((await card('insp_fw3').count()) === 0, '기간 밖 처음 것은 따라오지 않는다');
  r.check((await card('insp_fw5').count()) === 0 && (await card('insp_fw6').count()) === 0, '끝낸 것·이월 아닌 것은 없다');
  const order = await page.locator(sel('event-card')).evaluateAll((els) => els.map((e) => [e.dataset.eventCard, e.dataset.eventCarried ?? '']));
  const firstCarried = order.findIndex(([, c]) => c);
  r.check(firstCarried >= 0 && order.slice(firstCarried).every(([, c]) => c), '따라오는 일정은 오늘 것 아래에 모여 있다');

  r.section('처음 따라올 때 carrying 한 번 (앱을 열 때 이월이 쓰는 것은 그것뿐)');
  const marked = await serverUntil(() => read('insp_fw4'), (d) => d?.carrying === true);
  r.check(marked?.carrying === true, '처음 따라오는 일정에 carrying: true');
  let after = await stamps();
  r.check(JSON.stringify(changed(seeded, after)) === JSON.stringify(['insp_fw4']), `바뀐 문서는 그 하나 (${changed(seeded, after).join(',')})`);
  r.check(marked.date === daysAgo(2), '날짜는 그대로 (옮겨 쓰지 않는다)');
  await page.reload();
  await page.locator(sel('session', 'signed-in')).waitFor({ timeout: 20000 });
  await waitFor(card('insp_fw4'), 8000);
  await new Promise((res) => setTimeout(res, 5000));
  const reopened = await stamps();
  r.check(changed(after, reopened).length === 0, `다시 열면 서버에 아무것도 쓰지 않는다 (${changed(after, reopened).join(',') || '없음'})`);

  r.section('오늘 칸에서 끝내기 = 그날로 옮겨 적기 (문서 하나)');
  let before = await stamps();
  await card('insp_fw1').locator(sel('event-complete')).click();
  const fin = await serverUntil(() => read('insp_fw1'), (d) => d?.done === true);
  r.check(fin?.date === TODAY && fin.carriedFrom === daysAgo(3) && fin.carrying === undefined, `date 오늘·carriedFrom 처음 날·carrying 걷기 (${fin?.date}, ${fin?.carriedFrom}, ${fin?.carrying})`);
  after = await serverUntil(stamps, (s) => changed(before, s).length > 0);
  r.check(JSON.stringify(changed(before, after)) === JSON.stringify(['insp_fw1']), `바뀐 문서는 그 하나 (${changed(before, after).join(',')})`);
  r.check(await waitFor(async () => (await card('insp_fw1').getAttribute('data-event-carried')) === null), '이제 오늘 일정 (↪ 없음)');
  await page.locator('body').click({ position: { x: 5, y: 300 } });
  await page.keyboard.press('Control+z');
  const back = await serverUntil(() => read('insp_fw1'), (d) => d?.done === false);
  r.check(back?.date === daysAgo(3) && back.carrying === true && back.carriedFrom === undefined, `Ctrl+Z → 제자리 (${back?.date}, ${back?.carrying}, ${back?.carriedFrom})`);
  r.check(await waitFor(async () => (await card('insp_fw1').getAttribute('data-event-carried')) === daysAgo(3)), '다시 따라오는 일정');

  r.section('일정 칸 안내');
  await card('insp_fw2').click();
  r.check(await waitFor(page.locator(sel('event-carry-note'))), "따라오는 일정을 열면 '↪ … 부터' 안내");
  r.check((await page.inputValue(sel('event-date'))) === daysAgo(30), '날짜 칸은 처음 날 그대로');
  await page.locator(sel('event-close')).click();

  r.section('지난 날 칸: 흐리게 → 오늘로');
  await page.goto(page.url().replace(/#.*$/, `#/day/${daysAgo(2)}`));
  r.check(await waitFor(card('insp_fw4')), '제 날짜에 그대로 있다');
  r.check((await card('insp_fw4').getAttribute('data-event-away')) === '1', '흐리게');
  await card('insp_fw4').locator(sel('event-to-today')).click();
  r.check(await waitFor(async () => hashOf(page).includes(TODAY)), `'→ 오늘로' → 오늘 (${hashOf(page)})`);
  r.check((await page.locator(sel('event-panel')).count()) === 0, '수정 칸은 열지 않는다');

  r.section("환경설정 '학교' → 이월 기간");
  await page.evaluate(() => window.sp5.openWindow('settings', { tab: 'school' }));
  r.check(await waitFor(page.locator(sel('forward-days'))), '학교 탭에 이월 기간');
  await page.fill(sel('forward-days'), '30');
  const common = await serverUntil(async () => (await getDoc(commonRef)).data() ?? {}, (d) => d.forwardDays === 30);
  r.check(common.forwardDays === 30, `계정(settings/common)에 올라간다 (${common.forwardDays})`);
  // 기간을 늘리면 30일 전 처음 것도 따라온다
  await page.keyboard.press('Escape');
  r.check(await waitFor(card('insp_fw3')), '기간을 30일로 → 30일 전 일정도 따라온다');
  await page.evaluate(() => window.sp5.openWindow('settings', { tab: 'school' }));
  await page.fill(sel('forward-days'), '14');
  await serverUntil(async () => (await getDoc(commonRef)).data() ?? {}, (d) => d.forwardDays === undefined || d.forwardDays === 14);
  await new Promise((res) => setTimeout(res, 2500));

  r.check(errors.length === 0, `화면 오류 없음 ${errors.join(' | ')}`);
} catch (e) {
  r.bad(`점검이 멈췄다: ${e?.stack ?? e}`);
} finally {
  await browser.close();
  await undo.run();
  r.done();
  process.exit();
}
