// tools/inspect-groups.mjs - P3-3: 묶인 일정(기간·반복)을 실제 크롬에서 본다.
//   1) 기간: 새 일정 칸 '📆 끝 날' → 한 문서(endDate·workdays), 날마다 '(k/n)'·주말에는 없다.
//      ☐ = 그날만(doneDates, 문서 하나). 🗑️ → 어디까지: 이 날만(skipDates)·이 날부터(끝 날 당기기) → 되돌리기.
//      칸에서 시작 날을 옮기면 통째로(끝 날이 따라간다) → 안내의 되돌리기 = 자리 칸 모두.
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
const changed = (a, b) => Object.keys({ ...a, ...b }).filter((id) => a[id] !== b[id]);

try {
  undo.add(async () => {
    for (const d of await mine()) await deleteDoc(d.ref);
  });
  const { page, errors } = await newPage(browser);
  const go = async (date) => {
    await page.goto(page.url().replace(/#.*$/, `#/day/${date}`));
    await page.locator(sel('day-events', date)).waitFor({ timeout: 5000 });
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

  r.check(errors.length === 0, `화면 오류 없음 ${errors.join(' | ')}`);
} catch (e) {
  r.bad(`점검이 멈췄다: ${e?.stack ?? e}`);
} finally {
  await browser.close();
  await undo.run();
  r.done();
  process.exit();
}
