// tools/inspect-groups.mjs - P3-3: 묶인 일정(기간·반복)을 실제 크롬에서 본다.
//   1) 기간: 새 일정 칸 '📆 끝 날' → 한 문서(endDate·workdays), 날마다 '(k/n)'·주말에는 없다.
//      ☐ = 그날만(doneDates, 문서 하나). 🗑️ → 어디까지: 이 날만(skipDates)·이 날부터(끝 날 당기기) → 되돌리기.
//      칸에서 시작 날을 옮기면 통째로(끝 날이 따라간다) → 안내의 되돌리기 = 자리 칸 모두.
//   2) 반복: 새 일정 칸 '🔁 반복' → 반복 문서 하나 + 날마다 항목(한 묶음), 카드 🔁. 고치기 → 어디까지 → 이 날부터 = 그 항목들 + template.
//      지우기 → 이 날부터(반복 끝나는 날 당김) → 안내의 되돌리기, 전부(반복 문서도) → Ctrl+Z.
//
//   npm run emu · npm run dev:emu (켜 둔다) → node tools/inspect-groups.mjs
// 에뮬레이터 teacher 계정의 개인 공간 - 점검이 만든 일정(글에 '점검 묶음')은 끝에 지운다. 날짜는 2027-03(수 3일 ~ 화 9일, 6·7일 주말).
import { collection, deleteDoc, getDocs } from 'firebase/firestore';
import { emulator, launch, newPage, open, report, restorer, sel, serverUntil, waitFor } from './lib/probe.mjs';

const r = report();
const em = emulator();
const uid = await em.signIn('teacher@example.com');
const sid = `u_${uid}`;
const undo = restorer();
const browser = await launch();

const startedAt = Date.now();
/** 점검이 만든 일정 */
const mine = async () => {
  const snap = await getDocs(collection(em.db, 'spaces', sid, 'items'));
  return snap.docs.filter((d) => String(d.data().text).includes('점검 묶음') && (d.data().createdAt ?? 0) >= startedAt);
};
const readMine = async (text) => (await mine()).map((d) => ({ id: d.id, ...d.data() })).find((d) => d.text === text) ?? null;
const stamps = async () => Object.fromEntries((await mine()).map((d) => [d.id, d.data().updatedAt?.toMillis() ?? 0]));
/** 점검이 만든 반복 문서 */
const mySeries = async () => {
  const snap = await getDocs(collection(em.db, 'spaces', sid, 'series'));
  return snap.docs.filter((d) => String(d.data().template?.text).includes('점검 묶음') && (d.data().createdAt ?? 0) >= startedAt);
};
const seriesItems = async () =>
  (await mine())
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((d) => d.seriesId && !d.deletedAt)
    .sort((a, b) => a.date.localeCompare(b.date));
const changed = (a, b) => Object.keys({ ...a, ...b }).filter((id) => a[id] !== b[id]);

try {
  undo.add(async () => {
    for (const d of await mine()) await deleteDoc(d.ref);
    for (const d of await mySeries()) await deleteDoc(d.ref);
  });
  const { page, errors } = await newPage(browser);
  // 창을 닫은 바로 뒤에는 창 층의 뒤로가기가 주소를 되돌릴 수 있다 - 그 날이 뜰 때까지 다시 간다
  const go = async (date) => {
    for (let i = 0; i < 3; i++) {
      await page.goto(page.url().replace(/#.*$/, `#/day/${date}`));
      if (await waitFor(page.locator(sel('day-events', date)), 3000)) return;
    }
    throw new Error(`${date}로 가지 못했다 (${page.url()})`);
  };
  await open(page, '#/day/2027-03-03');
  const panel = page.locator(sel('event-panel'));

  r.section('기간: 끝 날 → 한 문서');
  await page.locator(sel('event-add')).click();
  await waitFor(panel);
  await page.keyboard.type('점검 묶음 기말고사');
  await page.locator(sel('event-period-open')).click();
  await page.fill(sel('event-end'), '2027-03-09');
  r.check((await page.locator(sel('event-period-count')).getAttribute('data-event-period-count')) === '5', "끝 날을 고르면 '5일 (주말 2일 빼고)'");
  await page.keyboard.press('Control+s');
  r.check(await waitFor(async () => (await panel.getAttribute('data-event-panel')) === 'edit'), 'Ctrl+S → 수정 칸');
  const made = await serverUntil(() => readMine('점검 묶음 기말고사'), (d) => !!d);
  r.check(made?.date === '2027-03-03' && made.endDate === '2027-03-09' && made.workdays === true, `서버에 문서 하나 (date·endDate·workdays) ${made?.date}~${made?.endDate}`);
  r.check((await mine()).length === 1, '날마다 만들지 않는다 (문서 하나)');
  const id = made.id;
  const card = page.locator(sel('event-card', id));
  r.check((await card.locator(sel('event-period')).getAttribute('data-event-period')) === '1/5', "첫날 '(1/5)'");
  await page.locator(sel('event-close')).click();
  await go('2027-03-08');
  r.check((await card.locator(sel('event-period')).getAttribute('data-event-period')) === '4/5', "월요일 '(4/5)' (주말은 세지 않는다)");
  await go('2027-03-06');
  r.check((await card.count()) === 0, '토요일에는 없다');

  r.section('그날만 완료 (doneDates)');
  await go('2027-03-04');
  let before = await stamps();
  await card.locator(sel('event-complete')).click();
  const done = await serverUntil(() => readMine('점검 묶음 기말고사'), (d) => d?.doneDates?.length === 1);
  r.check(JSON.stringify(done?.doneDates) === '["2027-03-04"]' && !done.done, 'doneDates = 그날만 (done은 그대로)');
  let after = await stamps();
  r.check(changed(before, after).length === 1, '문서 하나');
  await go('2027-03-05');
  r.check((await card.getAttribute('data-event-done')) === '0', '다른 날은 끝내지 않은 채');

  r.section('묶음 지우기');
  await go('2027-03-08');
  await card.hover();
  await card.locator(sel('event-delete')).click();
  r.check(await waitFor(page.locator(sel('scope-window'))), '🗑️ → 어디까지 묻는다');
  await page.locator(sel('scope-choice', 'only')).click();
  const skipped = await serverUntil(() => readMine('점검 묶음 기말고사'), (d) => d?.skipDates?.length === 1);
  r.check(JSON.stringify(skipped?.skipDates) === '["2027-03-08"]', '이 날만 = skipDates (문서는 그대로)');
  r.check(await waitFor(async () => (await card.count()) === 0), '그날에서 빠진다');
  await go('2027-03-09');
  r.check((await card.locator(sel('event-period')).getAttribute('data-event-period')) === '4/4', "남은 날로 다시 센다 '(4/4)'");
  await page.locator(sel('toast')).filter({ hasText: '하루를 기간에서 뺐습니다' }).locator('[data-toast-action="되돌리기"]').click();
  const back = await serverUntil(() => readMine('점검 묶음 기말고사'), (d) => !d?.skipDates);
  r.check(!back?.skipDates, '안내의 되돌리기 = 그날 다시');
  await go('2027-03-08');
  await card.hover();
  await card.locator(sel('event-delete')).click();
  await page.locator(sel('scope-choice', 'after')).click();
  const cut = await serverUntil(() => readMine('점검 묶음 기말고사'), (d) => d?.endDate === '2027-03-05');
  r.check(cut?.endDate === '2027-03-05', '이 날부터 = 끝 날을 앞 금요일로');
  await page.locator('body').click({ position: { x: 5, y: 300 } });
  await page.keyboard.press('Control+z');
  const back2 = await serverUntil(() => readMine('점검 묶음 기말고사'), (d) => d?.endDate === '2027-03-09');
  r.check(back2?.endDate === '2027-03-09', 'Ctrl+Z = 끝 날 그대로');

  r.section('칸에서 시작 날 옮기기 = 통째로');
  await go('2027-03-03');
  await card.click();
  await waitFor(panel);
  await page.locator(sel('event-date-next')).click();
  r.check((await page.inputValue(sel('event-end'))) === '2027-03-10', '끝 날이 따라간다');
  before = await stamps();
  await page.locator(sel('event-save')).click();
  const moved = await serverUntil(() => readMine('점검 묶음 기말고사'), (d) => d?.date === '2027-03-04');
  r.check(moved?.date === '2027-03-04' && moved.endDate === '2027-03-10' && JSON.stringify(moved.doneDates) === '["2027-03-05"]', `date·endDate·끝낸 날이 함께 (${moved?.date}~${moved?.endDate}, ${moved?.doneDates})`);
  after = await stamps();
  r.check(changed(before, after).length === 1, '문서 하나');
  await page.locator(sel('toast')).filter({ hasText: '옮겼습니다' }).locator('[data-toast-action="되돌리기"]').click();
  const unmoved = await serverUntil(() => readMine('점검 묶음 기말고사'), (d) => d?.date === '2027-03-03');
  r.check(unmoved?.date === '2027-03-03' && unmoved.endDate === '2027-03-09' && JSON.stringify(unmoved.doneDates) === '["2027-03-04"]', '안내의 되돌리기 = 자리 칸 모두');
  await page.keyboard.press('Escape');

  r.section('반복: 새 일정 칸 🔁 → 반복 문서 + 날마다 항목');
  await go('2027-03-03');
  await page.locator(sel('event-add')).click();
  await waitFor(panel);
  await page.keyboard.type('점검 묶음 협의회');
  await page.locator(sel('event-recur-open')).click();
  r.check((await page.locator(sel('recur-day', 3)).getAttribute('aria-pressed')) === 'true', '매주 · 시작 날 요일(수)을 골라 둔다');
  await page.fill(sel('recur-until'), '2027-03-24');
  r.check((await page.locator(sel('recur-count')).getAttribute('data-recur-count')) === '4', '끝나는 날까지 4개');
  await page.locator(sel('event-save')).click();
  r.check(await waitFor(async () => (await panel.getAttribute('data-event-panel')) === 'edit'), '저장 → 첫 항목의 수정 칸');
  const sItems = await serverUntil(seriesItems, (l) => l.length === 4);
  const sDocs = await mySeries();
  r.check(sItems.length === 4 && sDocs.length === 1, `서버: 반복 문서 하나 + 항목 넷 (${sDocs.length}, ${sItems.length})`);
  r.check(JSON.stringify(sItems.map((d) => d.date)) === '["2027-03-03","2027-03-10","2027-03-17","2027-03-24"]', '날마다 항목 (수요일)');
  r.check(sItems.every((d) => d.seriesId === sDocs[0].id) && sItems.map((d) => d.seriesIndex).join() === '0,1,2,3', 'seriesId·seriesIndex');
  r.check((await page.locator(sel('event-series-info')).textContent()).includes('매주 수'), "칸에 '🔁 매주 수 · 4개 가운데 1번째'");
  await page.locator(sel('event-close')).click();
  await go('2027-03-10');
  const s2 = page.locator(sel('event-card', sItems[1].id));
  r.check((await s2.locator(sel('event-series')).count()) === 1, '카드에 🔁');

  r.section('반복 고치기 → 이 날부터');
  await go('2027-03-17');
  const s3 = page.locator(sel('event-card', sItems[2].id));
  await s3.click();
  await waitFor(panel);
  await page.fill(sel('event-text-input'), '점검 묶음 학년 협의회');
  before = await stamps();
  const seriesBefore = (await mySeries())[0].data().updatedAt.toMillis();
  await page.locator(sel('event-save')).click();
  r.check(await waitFor(page.locator(sel('scope-window'))), '저장 → 어디까지 묻는다');
  await page.locator(sel('scope-choice', 'after')).click();
  const edited = await serverUntil(seriesItems, (l) => l.filter((d) => d.text === '점검 묶음 학년 협의회').length === 2);
  r.check(edited.map((d) => d.text === '점검 묶음 학년 협의회').join() === 'false,false,true,true', '그날부터 둘만 바뀐다');
  after = await stamps();
  r.check(changed(before, after).length === 2, `항목 문서 둘 (${changed(before, after).length})`);
  const sAfter = (await mySeries())[0].data();
  r.check(sAfter.template.text === '점검 묶음 학년 협의회' && sAfter.updatedAt.toMillis() !== seriesBefore, '반복 문서의 template도');
  await page.locator(sel('event-close')).click();

  r.section('반복 지우기');
  await s3.hover();
  await s3.locator(sel('event-delete')).click();
  r.check(await waitFor(page.locator(sel('scope-window'))), '🗑️ → 어디까지');
  await page.locator(sel('scope-choice', 'after')).click();
  const cutS = await serverUntil(seriesItems, (l) => l.length === 2);
  r.check(cutS.length === 2 && (await mySeries())[0].data().until === '2027-03-10', '이 날부터 = 그날부터 지운 표시 + 반복 끝나는 날을 앞 항목 날로');
  await page.locator(sel('toast')).filter({ hasText: '반복 일정 2개를 삭제했습니다' }).locator('[data-toast-action="되돌리기"]').click();
  const backS = await serverUntil(seriesItems, (l) => l.length === 4);
  r.check(backS.length === 4 && (await mySeries())[0].data().until === '2027-03-24', '안내의 되돌리기 = 모두 제자리');
  await go('2027-03-10');
  await s2.hover();
  await s2.locator(sel('event-delete')).click();
  await page.locator(sel('scope-choice', 'all')).click();
  const none = await serverUntil(seriesItems, (l) => l.length === 0);
  r.check(none.length === 0 && (await serverUntil(mySeries, (l) => l[0]?.data().deletedAt != null))[0]?.data().deletedAt != null, '전부 = 항목 모두 + 반복 문서 지운 표시');
  await page.locator('body').click({ position: { x: 5, y: 300 } });
  await page.keyboard.press('Control+z');
  const again = await serverUntil(seriesItems, (l) => l.length === 4);
  r.check(again.length === 4 && (await mySeries())[0].data().deletedAt === null, 'Ctrl+Z = 모두 되살린다');

  r.check(errors.length === 0, `화면 오류 없음 ${errors.join(' | ')}`);
} catch (e) {
  r.bad(`점검이 멈췄다: ${e?.stack ?? e}`);
} finally {
  await browser.close();
  await undo.run();
  r.done();
  process.exit();
}
