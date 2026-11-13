// tools/inspect-new-year.mjs - P9-2: 새 학년도 넘기기를 실제 크롬에서 본다 (시계를 2027-02-20으로 둔다).
//   1) 지난 학년도 학급·시간표가 있으면 2/15 ~ 3/31에 '🌱 2027학년도 준비' 띠 → 준비하기 = 창, 네 단계 모두 할 것
//   2) ① 학년·반 + 엑셀 명단 붙여넣기 → 학급 만들기 = classes/2027-6-3(학생 sid·성별) · 담임반으로 = common.teaching.homeroomClass
//   3) ② 지난 시간표 베껴 만들기 = 2027-03-01 ~ 2028-02-29 같은 표 · 시간표 창이 그 표로
//   4) ③ 방학 적기 = 시간표 창 '학기·방학' 탭이 2027학년도로 → 적고 💾 → 네 단계 ✓ · 할 것이 없으면 띠가 내려간다
//   5) ✅ 준비 끝 = common.newYearDone · 띠 닫기(할 것이 다시 생겨도 그 학년도에는 띄우지 않는다) · 시간표 창 머리줄 🌱
//   6) 3/2 = 지난 학년에 고른 학급을 믿지 않는다(학급 화면·학급 도구) · 올해 고른 지난 학급은 남는다 · 넘어온 지난 학급은 '고름'이 되지 않는다(P22-4)
//   7) 실제 자료 모양(P26-3 - 사용자 백업 사본으로 찾은 것, 실제 자료는 넣지 않는다): 같은 날 시작한 표 둘이면 나중에 만든 것을 베낀다 ·
//      V4에서 가져온 새 학년도 날짜의 과목 = 알림 → 🧹 옛 과목 지우기(비고·V5에서 바꾼 날은 남김) → 되돌리기
//
//   npm run emu · npm run dev:emu (켜 둔다) → npm run seed → node tools/inspect-new-year.mjs
// 에뮬레이터 teacher의 classes·timetables·lessonDays(심은 날만)·settings/common을 바꾸고 끝에 되돌린다.
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
  // 같은 날 시작한 옛 표 (V4에서 가져와 먼저 만든 것 - id 차례로는 앞) - 화면은 나중에 만든 ny_old2를 쓴다 (P26-3)
  await setDoc(ref('timetables', 'ny_old0'), { name: '2학기', from: '2026-08-17', to: '2027-02-28', grid: { 1: { 1: '501' } }, ...tracked, createdAt: tracked.createdAt - 60000 });
  // V4가 1년 앞까지 적어 둔 옛 시간표 (가져오기가 '그날 바꾼 과목'으로 옮겼다) + V5에서 바꾼 날 하나 (P26-3)
  const v4src = (d) => ({ from: 'v4', path: `schedules/${d}`, id: d, h: 'inspect' });
  const plantedDays = { '2027-03-08': { periods: { 2: { subject: '502' }, 3: { subject: '503', supplies: '줄넘기' } }, src: v4src('2027-03-08') }, '2027-03-09': { periods: { 1: { subject: '보강' } } } };
  for (const [d, data] of Object.entries(plantedDays)) {
    const before = await read(ref('lessonDays', d));
    undo.add(() => (before ? setDoc(ref('lessonDays', d), before) : deleteDoc(ref('lessonDays', d))));
    await setDoc(ref('lessonDays', d), { ...data, ...tracked });
  }

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
  r.check((await page.locator(sel('new-year-source')).getAttribute('data-new-year-source')) === 'ny_old2', '베낄 표 = 2월 끝날 화면이 쓰는 표 (같은 날 시작한 옛 표가 아니라 나중에 만든 것)');
  r.check(((await page.locator(sel('new-year-source')).textContent()) ?? '').includes('8/17부터'), '베낄 표의 시작일을 함께 보인다');
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

  r.section('② 새 학년도 날짜에 남은 V4 과목 (P26-3)');
  await page.evaluate(() => window.sp5.openWindow('newYear', { year: 2027 }));
  const stale = page.locator(sel('new-year-stale'));
  r.check(await waitFor(stale, 8000), '알림이 뜬다');
  r.check((await stale.getAttribute('data-new-year-stale')) === '1' && ((await stale.textContent()) ?? '').includes('3/8'), 'V4에서 가져온 날만 (V5에서 바꾼 3/9는 빼고) - 날짜를 보인다');
  await page.locator(sel('new-year-clear-stale')).click();
  const day8 = await serverUntil(() => read(ref('lessonDays', '2027-03-08')), (d) => !d?.periods?.['2'] && d?.periods?.['3'] && !('subject' in d.periods['3']), 8000);
  r.check(!day8?.periods?.['2'] && day8?.periods?.['3']?.supplies === '줄넘기', '🧹 옛 과목 지우기 = 과목만 빼고 비고(준비물)는 남긴다', JSON.stringify(day8?.periods));
  r.check((await read(ref('lessonDays', '2027-03-09')))?.periods?.['1']?.subject === '보강', 'V5에서 바꾼 날은 그대로');
  r.check(await waitFor(async () => (await stale.count()) === 0, 5000), '알림이 내려간다');
  await page.locator('[data-toast]').filter({ hasText: '옛 과목' }).locator('[data-toast-action="되돌리기"]').click();
  const back = await serverUntil(() => read(ref('lessonDays', '2027-03-08')), (d) => d?.periods?.['2']?.subject === '502', 8000);
  r.check(back?.periods?.['3']?.subject === '503' && (await waitFor(stale, 5000)), '되돌리기 = 옛 과목이 돌아오고 알림도 다시');

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

  r.section('3월이 되면 고른 학급이 새 학년도로 (P22-4)');
  const p3 = await newPage(browser);
  const hub = () => p3.page.locator(sel('class-hub'));
  const hubId = () => hub().getAttribute('data-class-hub');
  const stored = () => p3.page.evaluate(() => localStorage.getItem('sp5-class-hub'));
  await p3.page.clock.setFixedTime(new Date('2027-03-02T09:00:00'));
  // 옛 글자 값 - 지난 학년에 고른 학급 (앱을 처음 열 때만 심는다)
  await p3.page.addInitScript(() => {
    if (!sessionStorage.getItem('hub-planted')) {
      sessionStorage.setItem('hub-planted', '1');
      localStorage.setItem('sp5-class-hub', '2026-5-2');
    }
  });
  await open(p3.page, '#/class');
  await waitFor(hub());
  r.check((await hubId()) === '2027-6-3', '3/2 = 지난 학년에 고른 학급이 아니라 올해 학급', `${await hubId()}`);
  await p3.page.evaluate(() => window.sp5.openWindow('evalOverview'));
  r.check(await waitFor(p3.page.locator(sel('eval-overview-window', '2027-6-3')), 5000), '학급 도구(조사표 모아 보기)도 올해 학급');
  await p3.page.evaluate(() => window.sp5.closeAllWindows());

  await p3.page.locator(sel('class-pick')).selectOption('2026-5-2');
  await waitFor(p3.page.locator('[data-class-hub="2026-5-2"]'));
  r.check(JSON.parse(await stored()).year === 2027, '올해 고른 지난 학급 = 올해 학년도로 적는다', await stored());
  await p3.page.reload();
  await waitFor(hub());
  r.check((await hubId()) === '2026-5-2', '올해 일부러 고른 지난 학급은 다시 열어도 그대로');

  // 올해 학급이 없어 지난 학급으로 넘어온 때: 도구를 눌러도 '고름'이 되지 않아, 학급을 만들면 그 학급으로 열린다
  await p3.page.evaluate(() => localStorage.removeItem('sp5-class-hub'));
  const newClass = await read(ref('classes', '2027-6-3'));
  await setDoc(ref('classes', '2027-6-3'), { ...newClass, deletedAt: serverTimestamp(), updatedAt: serverTimestamp() });
  await p3.page.reload();
  await waitFor(p3.page.locator('[data-class-hub="2026-5-2"]'));
  await p3.page.locator(sel('class-tool', 'evalOverview')).click();
  await waitFor(p3.page.locator(sel('eval-overview-window', '2026-5-2')), 5000);
  r.check((await stored()) === null, '넘어온 지난 학급은 도구를 눌러도 고름이 되지 않는다', await stored());
  await p3.page.evaluate(() => window.sp5.closeAllWindows());
  await setDoc(ref('classes', '2027-6-3'), { ...newClass, deletedAt: null, updatedAt: serverTimestamp() });
  r.check(await waitFor(p3.page.locator('[data-class-hub="2027-6-3"]'), 8000), '올해 학급이 생기면 그 학급으로');

  r.section('교과 전담 새 학급 한꺼번에 (P32-3 - ?as=3)');
  // 전담 teacher3: 지난 학년도 5-1~5-3 · 가르치는 반 5-1~5-3 · 2027학년도 6-3은 이미 있다(학생 하나)
  const em3 = emulator('inspect3');
  const uid3 = await em3.signIn('teacher3@example.com');
  const ref3 = (c, id) => doc(em3.db, 'spaces', `u_${uid3}`, c, id);
  const read3 = async (rf) => {
    const s = await getDoc(rf);
    return s.exists() ? s.data() : null;
  };
  const classes3 = (await getDocs(collection(em3.db, 'spaces', `u_${uid3}`, 'classes'))).docs.map((d) => [d.id, d.data()]);
  for (const [id] of classes3) await deleteDoc(ref3('classes', id));
  undo.add(async () => {
    for (const d of (await getDocs(collection(em3.db, 'spaces', `u_${uid3}`, 'classes'))).docs) await deleteDoc(d.ref);
    for (const [id, data] of classes3) await setDoc(ref3('classes', id), data);
  });
  const common3 = await read3(ref3('settings', 'common'));
  undo.add(async () => (common3 ? setDoc(ref3('settings', 'common'), common3) : deleteDoc(ref3('settings', 'common'))));
  const tracked3 = { deletedAt: null, updatedAt: serverTimestamp(), v: 1, createdAt: Date.now(), authorId: uid3 };
  const teaching3 = { unit: 'class', hasHomeroom: false, homeroomClass: '', subjects: ['과학'], classes: ['5-1', '5-2', '5-3'], classColors: {} };
  await setDoc(ref3('settings', 'common'), { ...(common3 ?? {}), teaching: teaching3, newYearDone: 0, updatedAt: serverTimestamp(), v: 1 });
  for (const n of [1, 2, 3]) await setDoc(ref3('classes', `2026-5-${n}`), { year: 2026, grade: 5, num: n, students: [], ...tracked3 });
  await setDoc(ref3('classes', '2027-6-3'), { year: 2027, grade: 6, num: 3, students: [{ sid: 'ny3', num: 1, name: '있던학생', status: 'active' }], ...tracked3 });

  const p4 = await newPage(browser);
  const pg = p4.page;
  await pg.clock.setFixedTime(new Date('2027-02-20T09:00:00'));
  await open(pg, '#/day/2027-02-20', { as: 3 });
  await pg.evaluate(() => window.sp5.openWindow('newYear', { year: 2027 }));
  r.check(await waitFor(pg.locator(sel('new-year-window', 2027)), 8000), '전담 계정 새 학년도 창');
  r.check(await waitFor(pg.locator(sel('new-year-classes-hint')), 5000), "전담이면 '1~6 또는 1, 3, 5' 안내가 보인다");
  r.check((await pg.locator(sel('new-year-as-homeroom')).count()) === 0, '전담은 담임반으로 칸이 없다');
  const made3 = () => Promise.all([1, 2, 3, 4].map((n) => read3(ref3('classes', `2027-6-${n}`))));
  const live3 = (d) => !!d && !d.deletedAt;

  await pg.locator(sel('new-year-grade')).fill('6');
  await pg.locator(sel('new-year-num')).fill('4~2');
  await pg.locator(sel('new-year-create-class')).click();
  r.check(await waitFor(pg.locator('[data-toast="error"]').filter({ hasText: '여러 반은 1~6' }), 5000), "거꾸로 범위 '4~2' = 안내만 (만들지 않는다)");

  await pg.locator(sel('new-year-num')).fill('1~4');
  r.check((await pg.locator(sel('new-year-names')).count()) === 0, '반이 여럿이면 명단 칸 대신 빈 명렬표 안내');
  const note = pg.locator(sel('new-year-classes-note'));
  r.check((await note.getAttribute('data-new-year-classes-note')) === '3' && (await pg.locator(sel('new-year-classes-skip', '3')).count()) === 1, '만들 것 3개 · 이미 있는 6-3은 건너뛴다고 보인다');
  r.check(((await pg.locator(sel('new-year-classes-preview')).textContent()) ?? '') === '6-1 · 6-2 · 6-4', '만들 반 미리 보기 6-1 · 6-2 · 6-4');
  r.check(((await pg.locator(sel('new-year-create-class')).textContent()) ?? '').includes('학급 3개 만들기 (빈 명렬표)'), '단추 = 학급 3개 만들기 (빈 명렬표)');
  await pg.locator(sel('new-year-create-class')).click();
  const after = await serverUntil(made3, (l) => live3(l[0]) && live3(l[1]) && live3(l[3]), 10000);
  r.check(
    after.filter((d, i) => i !== 2).every((d) => live3(d) && d.year === 2027 && d.grade === 6 && Array.isArray(d.students) && d.students.length === 0),
    'classes/2027-6-1·6-2·6-4 = 빈 명렬표',
  );
  r.check(after[2]?.students?.[0]?.name === '있던학생', '이미 있던 6-3은 그대로 (학생도)');
  const madeToast = pg.locator('[data-toast]').filter({ hasText: '빈 명렬표 3개' });
  r.check(await waitFor(madeToast, 5000), '안내: 6학년 1·2·4반 · 빈 명렬표 3개');
  r.check(((await madeToast.first().textContent()) ?? '').includes('6학년 1·2·4반') && ((await madeToast.first().textContent()) ?? '').includes('3반은 이미 있어 건너뜀'), '안내에 건너뛴 반', await madeToast.first().textContent());
  r.check((await pg.locator(sel('new-year-num')).inputValue()) === '', '만든 뒤 반 칸을 비운다');
  r.check(await waitFor(async () => (await pg.locator('[data-new-year-class^="2027-6-"]').count()) === 4, 5000), '① 만든 반 단추 넷 (6-1 ~ 6-4)');

  await madeToast.first().locator('[data-toast-action="되돌리기"]').click();
  const undone = await serverUntil(made3, (l) => !live3(l[0]) && !live3(l[1]) && !live3(l[3]), 10000);
  r.check(!live3(undone[0]) && !live3(undone[1]) && !live3(undone[3]) && live3(undone[2]), '되돌리기 하나 = 셋 모두 없어진다 (6-3은 남는다)');

  await pg.locator(sel('new-year-num')).fill('1~4');
  r.check(await waitFor(async () => (await note.getAttribute('data-new-year-classes-note')) === '3', 5000), '되돌린 반은 없는 것 - 다시 만들 것 3개');
  await pg.locator(sel('new-year-create-class')).click();
  r.check(!!(await serverUntil(made3, (l) => l.every(live3), 10000)), '다시 만들면 된다 (지운 표시 위에)');
  await pg.locator(sel('new-year-num')).fill('3, 4');
  r.check(await waitFor(async () => (await note.getAttribute('data-new-year-classes-note')) === '0', 5000), "'3, 4' = 모두 이미 있다");
  await pg.locator(sel('new-year-create-class')).click();
  r.check(await waitFor(pg.locator('[data-toast="error"]').filter({ hasText: '모두 이미 있습니다' }), 5000), '모두 있으면 만들지 않고 안내');
  await pg.locator(sel('new-year-num')).fill('');

  r.section('④ 가르치는 반을 새 학년도 학급으로 (P32-3)');
  const offer = pg.locator(sel('new-year-teaching-classes'));
  r.check(await waitFor(offer, 5000), '지난 반이 남았으면 바꾸기를 권한다');
  r.check((await offer.getAttribute('data-new-year-teaching-classes')) === '5-1,5-2,5-3', '남은 반 = 5-1 · 5-2 · 5-3');
  r.check(((await pg.locator(sel('new-year-replace-classes')).textContent()) ?? '').includes('6-1 · 6-2 · 6-3 · 6-4'), '단추에 바꿀 반 (그 학년도 학급 차례)');
  await pg.locator(sel('new-year-replace-classes')).click();
  const tc = await serverUntil(() => read3(ref3('settings', 'common')), (d) => d?.teaching?.classes?.join() === '6-1,6-2,6-3,6-4', 8000);
  r.check(tc?.teaching?.classes?.join() === '6-1,6-2,6-3,6-4' && tc.teaching.subjects.join() === '과학' && tc.teaching.unit === 'class' && tc.teaching.hasHomeroom === false, '가르치는 반 = 6-1~6-4 (교사 유형의 다른 칸은 그대로)');
  r.check(await waitFor(async () => (await offer.count()) === 0, 5000), '바꾸면 권하는 줄이 내려간다');
  await pg.locator('[data-toast]').filter({ hasText: '가르치는 반을' }).locator('[data-toast-action="되돌리기"]').click();
  const tb = await serverUntil(() => read3(ref3('settings', 'common')), (d) => d?.teaching?.classes?.join() === '5-1,5-2,5-3', 8000);
  r.check(tb?.teaching?.classes?.join() === '5-1,5-2,5-3' && (await waitFor(offer, 5000)), '되돌리기 = 5-1~5-3이 돌아오고 줄도 다시');
  if (process.env.SHOT3) await pg.screenshot({ path: process.env.SHOT3 });

  r.check(
    errors.length === 0 && p2.errors.length === 0 && p3.errors.length === 0 && p4.errors.length === 0,
    `화면 오류 없음 ${[...errors, ...p2.errors, ...p3.errors, ...p4.errors].join(' | ')}`,
  );
} catch (e) {
  r.bad(`점검이 멈췄다: ${e?.stack ?? e}`);
} finally {
  await browser.close();
  await undo.run();
  r.done();
  process.exit();
}
