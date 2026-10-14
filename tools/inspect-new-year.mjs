// tools/inspect-new-year.mjs - P9-2: 새 학년도 넘기기를 실제 크롬에서 본다 (시계를 2027-02-20으로 둔다).
//   1) 지난 학년도 학급·시간표가 있으면 2/15 ~ 3/31에 '🌱 2027학년도 준비' 띠 → 준비하기 = 창, 네 단계 모두 할 것
//   2) ① 학년·반 + 엑셀 명단 붙여넣기 → 학급 만들기 = classes/2027-6-3(학생 sid·성별) · 담임반으로 = common.teaching.homeroomClass
//   3) ② 지난 시간표 베껴 만들기 = 2027-03-01 ~ 2028-02-29 같은 표 · 시간표 창이 그 표로
//   4) ③ 방학 적기 = 시간표 창 '학기·방학' 탭이 2027학년도로 → 적고 💾 → 네 단계 ✓ · 할 것이 없으면 띠가 내려간다
//   5) ✅ 준비 끝 = common.newYearDone · 띠 닫기(할 것이 다시 생겨도 그 학년도에는 띄우지 않는다) · 시간표 창 머리줄 🌱
//
//   npm run emu · npm run dev:emu (켜 둔다) → npm run seed → node tools/inspect-new-year.mjs
// 에뮬레이터 teacher의 classes·timetables·settings/common을 바꾸고 끝에 되돌린다.
import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';
import { emulator, launch, newPage, open, report, restorer, sel, serverUntil, waitFor } from './lib/probe.mjs';

const r = report();
const undo = restorer();
const em = emulator();
const uid = await em.signIn('teacher@example.com');
const browser = await launch();
const ref = (c, id) => doc(em.db, 'spaces', `u_${uid}`, c, id);
const coll = (c) => collection(em.db, 'spaces', `u_${uid}`, c);
const read = async (rf) => {
  const s = await getDoc(rf);
  return s.exists() ? s.data() : null;
};
async function clearAndKeep(c) {
  const before = (await getDocs(coll(c))).docs.map((d) => [d.id, d.data()]);
  for (const [id] of before) await deleteDoc(ref(c, id));
  undo.add(async () => {
    for (const d of (await getDocs(coll(c))).docs) await deleteDoc(d.ref);
    for (const [id, data] of before) await setDoc(ref(c, id), data);
  });
}
const common = () => read(ref('settings', 'common'));

try {
  for (const c of ['classes', 'timetables']) await clearAndKeep(c);
  const common0 = await common();
  undo.add(async () => (common0 ? setDoc(ref('settings', 'common'), common0) : deleteDoc(ref('settings', 'common'))));
  const tracked = { deletedAt: null, updatedAt: serverTimestamp(), v: 1, createdAt: Date.now(), authorId: uid };
  // (중등) 전담 + 담임, 지난 학년도 담임반 5-2 · 2026학년도 방학만 있다
  const teaching = { unit: 'class', hasHomeroom: true, homeroomClass: '5-2', subjects: ['과학'], classes: ['5-1', '5-2'], classColors: {} };
  const terms2026 = { summer: { from: '2026-07-20', to: '2026-08-16' }, winter: { from: '2027-01-05', to: '2027-02-28' } };
  await setDoc(ref('settings', 'common'), { ...(common0 ?? {}), teaching, terms: { 2026: terms2026 }, newYearDone: 0, updatedAt: serverTimestamp(), v: 1 });
  await setDoc(ref('classes', '2026-5-2'), { year: 2026, grade: 5, num: 2, students: [{ sid: 'ny1', num: 1, name: '지난학생', status: 'active' }], ...tracked });
  const grid = { 1: { 1: '5-1 과학', 2: '5-2 과학' }, 3: { 4: '5-2 과학' } };
  await setDoc(ref('timetables', 'ny_old1'), { name: '1학기', from: '2026-03-01', to: '2027-02-28', grid: { 1: { 1: '5-1 과학' } }, ...tracked });
  await setDoc(ref('timetables', 'ny_old2'), { name: '2학기', from: '2026-08-17', to: '2027-02-28', grid, ...tracked });

  const { page, errors } = await newPage(browser);
  await page.clock.setFixedTime(new Date('2027-02-20T09:00:00'));

  r.section('띠 (2/15 ~ 3/31 · 지난 자료가 있고 할 것이 남았을 때)');
  await open(page, '#/day/2027-02-20');
  const banner = page.locator(sel('new-year-banner', 2027));
  r.check(await waitFor(banner, 10000), "'🌱 2027학년도 준비' 띠가 뜬다");
  await page.locator(sel('new-year-open')).click();
  const win = page.locator(sel('new-year-window', 2027));
  r.check(await waitFor(win, 8000), '준비하기 = 새 학년도 준비 창 (2027학년도)');
  const done = async (id) => (await page.locator(sel('new-year-step', id)).getAttribute('data-done')) === 'true';
  r.check(!(await done('classes')) && !(await done('timetable')) && !(await done('terms')) && !(await done('teaching')), '네 단계 모두 할 것 (학급·시간표·방학·담임반)');
  r.check(await waitFor(page.locator(sel('new-year-last-class', '2026-5-2')), 3000), '지난 학년도 학급이 보인다 (보기만)');
  if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT }); // 눈으로 볼 때: SHOT=파일.png

  r.section('① 새 학급 - 명단 붙여넣기');
  await page.locator(sel('new-year-grade')).fill('6');
  await page.locator(sel('new-year-num')).fill('3');
  await page.locator(sel('new-year-names')).fill('번호\t이름\t성별\n1\t김가나\t남\n2\t이다라\t여\n3\t박마바\t남');
  r.check(((await page.locator(sel('new-year-create-class')).textContent()) ?? '').includes('학생 3명'), '단추에 붙여 넣은 학생 수 (머리말 줄은 뺀다)');
  r.check((await page.locator(sel('new-year-as-homeroom')).isChecked()) === true, '(중등) 전담 + 담임이면 담임반으로 (처음 켬)');
  await page.locator(sel('new-year-create-class')).click();
  const cls = await serverUntil(() => read(ref('classes', '2027-6-3')), (d) => !!d, 10000);
  r.check(cls?.year === 2027 && cls.grade === 6 && cls.num === 3, 'classes/2027-6-3 문서');
  r.check(
    cls?.students?.length === 3 && cls.students.every((s) => typeof s.sid === 'string' && s.sid) && cls.students.map((s) => `${s.num}${s.name}${s.gender}`).join() === '1김가나M,2이다라F,3박마바M',
    '학생 3명 - 번호·이름·성별, 학생마다 sid',
  );
  r.check(await waitFor(async () => await done('classes'), 5000), '① 단계 ✓');
  const hr = await serverUntil(common, (d) => d?.teaching?.homeroomClass === '6-3', 8000);
  r.check(hr?.teaching?.homeroomClass === '6-3' && hr.teaching.unit === 'class', '담임반 = 6-3 (교사 유형의 다른 칸은 그대로)');
  r.check(await waitFor(async () => await done('teaching'), 5000), '④ 단계 ✓ (담임반이 새 학년도 학급)');
  await page.locator(sel('new-year-create-class')).click();
  r.check(((await page.locator(sel('new-year-names')).inputValue()) ?? '') === '', '만든 뒤 명단 칸은 비운다');

  r.section('② 지난 시간표 베껴 만들기');
  await page.locator(sel('new-year-copy-timetable')).click();
  const made = await serverUntil(
    async () => (await getDocs(coll('timetables'))).docs.map((d) => ({ id: d.id, ...d.data() })).filter((d) => d.from === '2027-03-01'),
    (l) => l.length === 1,
    10000,
  );
  const nt = made[0];
  r.check(nt?.to === '2028-02-29' && nt.name === '1학기 시간표', '2027-03-01 ~ 2028-02-29 (윤년) · 이름 1학기 시간표');
  r.check(JSON.stringify(nt?.grid) === JSON.stringify(grid), '마지막에 쓰던 표(늦게 시작한 2학기)를 베꼈다');
  r.check(await waitFor(page.locator(sel('timetable-window')), 8000), '시간표 창이 열린다');
  r.check((await page.locator(sel('timetable-pick', nt?.id)).getAttribute('aria-pressed')) === 'true', '그 시간표를 고른 채로');
  r.check((await page.locator(sel('timetable-from')).inputValue()) === '2027-03-01', '기간 칸 = 새 학년도');

  r.section('③ 방학 - 시간표 창 학기·방학 탭을 그 학년도로');
  // 새 학년도 창을 다시 앞으로 (오른쪽 칸 탭)
  await page.evaluate(() => window.sp5.openWindow('newYear', { year: 2027 }));
  r.check(await waitFor(async () => await done('timetable'), 5000), '② 단계 ✓');
  await page.locator(sel('new-year-open-terms')).click();
  r.check(await waitFor(page.locator(sel('terms-year', 2027)), 8000), '학기·방학 탭이 2027학년도로');
  await page.locator('[data-terms="summer-from"]').fill('2027-07-21');
  await page.locator('[data-terms="summer-to"]').fill('2027-08-17');
  await page.locator('[data-terms="winter-from"]').fill('2028-01-06');
  await page.locator('[data-terms="winter-to"]').fill('2028-02-29');
  await page.locator(sel('timetable-save')).click();
  const t = await serverUntil(common, (d) => !!d?.terms?.['2027']?.winter, 8000);
  r.check(t?.terms?.['2027']?.summer?.from === '2027-07-21' && t.terms['2026']?.summer?.from === '2026-07-20', '2027학년도 방학 저장 (2026학년도는 그대로)');
  await page.evaluate(() => window.sp5.openWindow('newYear', { year: 2027 }));
  r.check(await waitFor(async () => (await done('terms')) && (await done('classes')) && (await done('timetable')) && (await done('teaching')), 5000), '네 단계 모두 ✓');
  r.check(await waitFor(async () => (await banner.count()) === 0, 5000), '할 것이 없으면 띠가 내려간다');

  r.section('✅ 준비 끝 · 띠 닫기 · 시간표 창 🌱');
  await page.locator(sel('new-year-done')).click();
  r.check(!!(await serverUntil(common, (d) => d?.newYearDone === 2027, 8000)), '준비 끝 = common.newYearDone 2027');
  r.check(await waitFor(async () => (await win.count()) === 0, 3000), '창이 닫힌다');
  // 할 것을 다시 만들어도(방학 지움) 그 학년도에는 띄우지 않는다 → newYearDone을 되돌리면 다시 뜨고, 닫기로 내린다
  const c1 = await common();
  await setDoc(ref('settings', 'common'), { ...c1, terms: { 2026: terms2026 }, updatedAt: serverTimestamp() });
  await page.waitForTimeout(2500);
  r.check((await banner.count()) === 0, '준비 끝을 누른 학년도에는 할 것이 생겨도 띠가 없다');
  await setDoc(ref('settings', 'common'), { ...c1, terms: { 2026: terms2026 }, newYearDone: 0, updatedAt: serverTimestamp() });
  r.check(await waitFor(banner, 8000), '준비 끝을 되돌리면 (방학이 빠져) 띠가 다시 뜬다');
  await page.locator(sel('new-year-dismiss')).click();
  r.check(await waitFor(async () => (await banner.count()) === 0, 3000), '닫기 = 띠가 내려간다');
  r.check(!!(await serverUntil(common, (d) => d?.newYearDone === 2027, 8000)), '닫기도 common.newYearDone 2027 (다른 기기에서도)');
  await page.evaluate(() => window.sp5.openWindow('timetable'));
  await page.locator(sel('timetable-new-year')).click();
  r.check(await waitFor(page.locator(sel('new-year-window', 2027)), 5000), '시간표 창 머리줄 🌱 새 학년도 = 그 창 (2/20이면 2027학년도)');

  r.section('3/31이 지나면 띠가 없다');
  const p2 = await newPage(browser);
  await p2.page.clock.setFixedTime(new Date('2027-04-02T09:00:00'));
  await setDoc(ref('settings', 'common'), { ...(await common()), newYearDone: 0, updatedAt: serverTimestamp() });
  await open(p2.page, '#/day/2027-04-02');
  await p2.page.waitForTimeout(2500);
  r.check((await p2.page.locator(sel('new-year-banner')).count()) === 0, '4/2 = 띠 없음 (할 것이 남아도)');

  r.check(errors.length === 0 && p2.errors.length === 0, `화면 오류 없음 ${[...errors, ...p2.errors].join(' | ')}`);
} catch (e) {
  r.bad(`점검이 멈췄다: ${e?.stack ?? e}`);
} finally {
  await browser.close();
  await undo.run();
  r.done();
  process.exit();
}
