// tools/inspect-import-lessons.mjs - P6-4: V4 수업 가져오기를 실제 크롬에서 본다
// (끝 조건: 하루·주간 수업 칸·진도 줄이 V4와 같다 · 두 번째는 바뀐 것 0 · V5에서 고친 날은 그대로).
//   1) V4 seed(teacher - 수업 260일, 시간표 문서 없음) + 점검용 V4 문서: timetable_v5(표 둘·방학)·v4_periodTimes·v4_classBell·v4_progress, 2027-03 수업 날(seed 밖)
//   2) 백업 창 '가져오기' → 결과 표(시간표·수업 칸·진도 줄)
//   3) 서버: 시간표 = 학기마다 맞는 표(기간), 수업 칸 = 시간표와 다른 칸만, 교시 이름·시각·방학·수업 종 = 계정 설정
//   4) 하루 화면 수업 칸 = V4 schedules 과목 (seed 날 여럿 + 점검 날), 진도 줄 1/3차시, 주간 수업 줄
//   5) 두 번째 가져오기는 바뀐 것 0, V5에서 고친 날은 V4가 바뀌어도 둔다
//
//   npm run emu · V4 저장소 npm run seed · npm run seed · npm run dev:emu (켜 둔다) → node tools/inspect-import-lessons.mjs
// teacher 계정 - 끝에 V5 문서(항목·반복·라벨·설정·시간표·수업 칸·진도·기록)를 처음대로, 심은 V4 문서는 지운다.
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

// 점검용 V4 문서 - 2027학년도(seed 밖): 1학기 표 = 월 1 국어·2 수학, 수 1 과학 / 2학기 표 = 월 1 영어
const cell = (subject, extra = {}) => ({ subject, content: '', memo: '', supplies: '', linkedItems: [], attachments: [], ...extra });
const TIMETABLE = {
  templates: {
    '점검 1학기': { names: ['1교시', '2교시', '3교시', '4교시', '5교시', '6교시'], data: { mon: { 1: '국어', 2: '수학' }, tue: {}, wed: { 1: '과학' }, thu: {}, fri: {} } },
    '점검 2학기': { names: ['1교시', '2교시', '3교시', '4교시', '5교시', '6교시'], data: { mon: { 1: '영어', 2: '수학' }, tue: {}, wed: {}, thu: {}, fri: {} } },
  },
  semesterConfig: { summerStart: '2027-07-24', summerEnd: '2027-08-16', winterStart: '2028-01-08', winterEnd: '2028-02-29' },
  currentNames: ['아침', '1교시', '2교시', '3교시', '4교시', '5교시'],
};
const SCHEDULES = {
  // 시간표와 같다 → 수업 칸 없음
  '2027-03-08': { periods: { 1: cell('국어'), 2: cell('수학') } },
  // 1교시 바꿈·메모·준비물, 2교시 없음(시간표는 수학)
  '2027-03-15': { periods: { 1: cell('체육', { memo: '운동장', supplies: '운동화' }) } },
  // 수 1교시 과학 + 3교시 따로
  '2027-03-10': { periods: { 1: cell('과학', { content: '옛 메모 칸' }), 3: '미술' } },
  // 2학기: 영어 표와 맞는다
  '2027-09-06': { periods: { 1: cell('영어'), 2: cell('수학') } },
  // 1학기 표와 같은 날 더 (한 날을 V4에서 고쳐도 그 학기 표가 바뀌지 않게 - 실제처럼 대부분 맞는다)
  '2027-03-22': { periods: { 1: cell('국어'), 2: cell('수학') } },
  '2027-03-24': { periods: { 1: cell('과학') } },
  '2027-03-29': { periods: { 1: cell('국어'), 2: cell('수학') } },
};
/** 시간표와 같아 수업 칸 문서가 생기지 않는 날 */
const SAME_DAYS = ['2027-03-08', '2027-09-06', '2027-03-22', '2027-03-24', '2027-03-29'];
const PROGRESS = { insp_pg: { key: '국어', startDate: '2027-03-08', lessons: [1, 2, 3].map((i) => ({ unit: '1단원', no: '1', content: `점검 차시 ${i}`, page: '', supplies: '' })), bumps: [], updatedAt: 1 } };

try {
  const before = {};
  const V5 = ['items', 'series', 'labels', 'settings', 'timetables', 'lessonDays', 'progress'];
  for (const c of V5) before[c] = await snapDocs(v5Coll(c));
  undo.add(async () => {
    for (const c of V5) await restoreColl(v5Coll(c), before[c]);
  });
  const plant = async (path, data) => {
    const ref = doc(em.db, 'users', uid, ...path);
    const old = await getDoc(ref);
    await setDoc(ref, data);
    undo.add(() => (old.exists() ? setDoc(ref, old.data()) : deleteDoc(ref)));
  };
  await plant(['settings', 'timetable_v5'], TIMETABLE);
  await plant(['settings', 'v4_periodTimes'], { times: { '1': { start: '08:40', end: '09:00' }, '2': { start: '09:00', end: '09:40' } } });
  await plant(['settings', 'v4_classBell'], { enabled: true, start: { on: true, amount: 0, unit: 'min', when: 'before' }, end: { on: false, amount: 0, unit: 'min', when: 'after' }, weekdaysOnly: true });
  for (const [d, data] of Object.entries(SCHEDULES)) await plant(['schedules', d], data);
  for (const [id, data] of Object.entries(PROGRESS)) await plant(['v4_progress', id], data);

  const v4Schedules = await snapDocs(v4Coll('schedules'));
  const { page, errors } = await newPage(browser);
  await open(page, '#/day/2027-03-08');

  r.section('가져오기 → 결과 표');
  await page.evaluate(() => window.sp5.openWindow('backup', { tab: 'import' }));
  await page.locator(sel('import-run')).click();
  r.check(await waitFor(page.locator(sel('import-result')), 120000), '결과 표가 나온다');
  const count = async (row, col) => Number(await page.locator(`${sel('import-row', row)} ${sel('import-count', col)}`).textContent());
  r.check((await count('timetables', 'added')) === 2, `시간표 2 (${await count('timetables', 'added')})`);
  const dayAdded = await count('lessonDays', 'added');
  r.check(dayAdded === Object.keys(v4Schedules).length - SAME_DAYS.length, `수업 칸 날 = V4 수업 날 - 시간표와 같은 날 (${dayAdded} / ${Object.keys(v4Schedules).length})`);
  r.check((await count('progress', 'added')) === 1, '진도 1');

  r.section('서버');
  const tts = Object.values(await snapDocs(v5Coll('timetables'))).filter((t) => t.src?.from === 'v4');
  const t1 = tts.find((t) => t.name === '점검 1학기');
  const t2 = tts.find((t) => t.name === '점검 2학기');
  r.check(t1?.from === '2027-03-01' && t1.to === '2028-02-29', `1학기 표 = 2027-03-01 ~ 학년도 끝 (${t1?.from}~${t1?.to})`);
  r.check(t2?.from === '2027-08-17', `2학기 표 = 여름 방학 다음 날부터 (${t2?.from})`);
  r.check(JSON.stringify(t1?.grid) === JSON.stringify({ '1': { '1': '국어', '2': '수학' }, '3': { '1': '과학' } }), '표 = 요일 1~5 → 교시');
  const days = await snapDocs(v5Coll('lessonDays'));
  r.check(!days['2027-03-08'] || Object.keys(days['2027-03-08'].periods ?? {}).length === 0, '시간표와 같은 날은 수업 칸 문서가 없다');
  r.check(JSON.stringify(days['2027-03-15']?.periods) === JSON.stringify({ '1': { subject: '체육', memo: '운동장', supplies: '운동화' }, '2': { subject: '' } }), `다른 칸만 + V4에 없던 칸은 빈 과목 (${JSON.stringify(days['2027-03-15']?.periods)})`);
  r.check(days['2027-03-10']?.periods?.['1']?.memo === '옛 메모 칸' && days['2027-03-10'].periods['1'].subject === undefined && days['2027-03-10'].periods['3']?.subject === '미술', '옛 content = 메모, 같은 과목은 빼고, 옛 글자 값');
  r.check(!days['2027-09-06'] || Object.keys(days['2027-09-06'].periods ?? {}).length === 0, '2학기 날도 2학기 표와 같으면 문서 없음');
  const common = (await getDoc(doc(em.db, 'spaces', sid, 'settings', 'common'))).data() ?? {};
  r.check(common.periods?.[0]?.name === '아침' && common.periods[0].start === '08:40', '교시 이름(currentNames)·시각(v4_periodTimes) = 계정 설정');
  r.check(common.terms?.['2027']?.summer?.from === '2027-07-24', '방학 = 계정 설정 terms[2027]');
  r.check(common.classBell?.enabled === true, '수업 종 = 계정 설정');

  r.section('하루 화면 = V4');
  await page.keyboard.press('Escape');
  const subjectOf = async (n) => (await page.locator(sel('lesson-card', n)).locator('[data-lesson-subject]').first().getAttribute('data-lesson-subject')) ?? '';
  const go = async (hash) => {
    await page.goto(page.url().replace(/#.*$/, hash));
    await page.waitForFunction((h) => location.hash === h, hash);
  };
  // seed 날 여럿 - V4 schedules의 과목과 같다
  const seedDates = Object.keys(v4Schedules).filter((d) => d.startsWith('2026-') && new Date(`${d}T00:00:00`).getDay() % 6 !== 0).sort();
  const sample = [seedDates[0], seedDates[Math.floor(seedDates.length / 2)], seedDates[seedDates.length - 1]];
  for (const d of sample) {
    await go(`#/day/${d}`);
    await waitFor(page.locator(sel('day-lessons', d)), 8000);
    const want = Object.entries(v4Schedules[d].periods).map(([n, c]) => [n, typeof c === 'string' ? c : c.subject]);
    let same = true;
    for (const [n, s] of want) if ((await waitFor(async () => (await subjectOf(n)) === s, 4000)) === false) same = false;
    r.check(same, `${d} 수업 칸 = V4 (${want.map(([, s]) => s).join(',')})`);
  }
  await go('#/day/2027-03-15');
  r.check(await waitFor(async () => (await subjectOf(1)) === '체육', 8000), '점검 날: 바꾼 1교시 = 체육');
  r.check((await subjectOf(2)) === '', '점검 날: 2교시는 비었다 (V4처럼)');
  r.check(((await page.locator(sel('lesson-card', 1)).textContent()) ?? '').includes('운동화'), '준비물');
  await go('#/day/2027-03-08');
  r.check(await waitFor(async () => (await subjectOf(1)) === '국어', 8000), '시간표와 같은 날 = 시간표로 (국어)');
  r.check(await waitFor(page.locator(`${sel('lesson-card', 1)} ${sel('progress-mark', 1)}`), 8000), '진도 줄 1/3차시 (가져온 진도)');
  await go('#/week/2027-03-08');
  r.check(await waitFor(page.locator(`${sel('week-lessons', '2027-03-15')} ${sel('week-lesson', 1)}`), 8000), '주간 수업 줄');
  r.check(((await page.locator(`${sel('week-lessons', '2027-03-15')} ${sel('week-lesson', 1)}`).textContent()) ?? '').includes('체육'), '주간 = 바꾼 과목');

  r.section('두 번째 가져오기 · V5에서 고친 날');
  // V5에서 3/10을 고치고 V4에서도 고친다
  const ref10 = doc(em.db, 'spaces', sid, 'lessonDays', '2027-03-10');
  await setDoc(ref10, { ...(await getDoc(ref10)).data(), periods: { '1': { subject: '음악' } }, updatedAt: serverTimestamp() });
  await setDoc(doc(em.db, 'users', uid, 'schedules', '2027-03-10'), { periods: { 1: cell('도덕') } });
  const stamp = async () => Object.fromEntries(Object.entries(await snapDocs(v5Coll('lessonDays'))).map(([id, d]) => [id, d.updatedAt?.toMillis?.() ?? 0]));
  const s1 = await stamp();
  await page.evaluate(() => window.sp5.openWindow('backup', { tab: 'import' }));
  await page.locator(sel('import-run')).click();
  r.check(await waitFor(async () => (await page.locator(sel('import-run')).textContent()).includes('다시 가져오기') && (await page.locator(sel('import-progress')).count()) === 0, 120000), '두 번째 가져오기 끝');
  await waitFor(page.locator(sel('import-result')), 5000);
  const ch = (await count('lessonDays', 'added')) + (await count('lessonDays', 'changed')) + (await count('lessonDays', 'removed'));
  r.check(ch === 0, `수업 칸 바뀐 것 0 (${ch})`);
  r.check((await count('lessonDays', 'kept')) >= 1, 'V5에서 고친 날은 둠');
  r.check((await count('timetables', 'added')) + (await count('timetables', 'changed')) === 0 && (await count('progress', 'added')) + (await count('progress', 'changed')) === 0, '시간표·진도도 0');
  const s2 = await stamp();
  r.check(Object.keys(s2).filter((id) => s1[id] !== s2[id]).length === 0, '수업 칸 문서를 다시 쓰지 않는다');
  r.check((await getDoc(ref10)).data().periods['1'].subject === '음악', 'V5에서 고친 과목이 그대로');
  r.check(errors.length === 0, `화면 오류 없음 ${errors.join(' | ')}`);
} catch (e) {
  r.bad(`점검이 멈췄다: ${e?.stack ?? e}`);
} finally {
  await browser.close();
  await undo.run();
  r.done();
  process.exit();
}
