// tools/inspect-bell-guide.mjs - P6-3 ■1·■2: 수업 종·주간학습안내·이 화면 인쇄를 실제 크롬에서 본다.
//   1) 하루 '⏰ 수업' 옆 🔕 종 → 설정 칸: 켜기 = 계정 설정 common.classBell, 시각을 고정한 창에서 교시 시작에 종(안내·소리 수), '이 기기에서 울리기' 끄면 조용
//   2) 주간 '📰 주간학습안내'(담임) → 요일 × 교시 표(과목·메모)·준비물 줄, 넣을 것 끄기·주 넘기기·제목·알리는 말, 🖨️ 인쇄 = 그 표만 찍을 준비, 📋 표 복사, 단축키 = 다음 주
//   3) ⋮ '🖨️ 이 화면 인쇄'·Ctrl+P: 주간 = 이번 주(A4 가로), 년간 학사력, 다른 화면에는 ⋮ 항목이 없다. 전담은 주간학습안내 단추가 없다.
//
//   npm run emu · npm run dev:emu (켜 둔다) → npm run seed → node tools/inspect-bell-guide.mjs
// 에뮬레이터 teacher 계정의 시간표·수업 칸·계정 설정 common을 심고 끝에 되돌린다.
import { deleteDoc, doc, getDoc, getDocs, collection, serverTimestamp, setDoc } from 'firebase/firestore';
import { emulator, launch, newPage, open, report, restorer, sel, serverUntil, waitFor, SITE } from './lib/probe.mjs';

const r = report();
const undo = restorer();
const em = emulator();
const uid = await em.signIn('teacher@example.com');
const browser = await launch();
const A = {
  ref: (coll, id) => doc(em.db, 'spaces', `u_${uid}`, coll, id),
  coll: (coll) => collection(em.db, 'spaces', `u_${uid}`, coll),
};
const read = async (ref) => {
  const s = await getDoc(ref);
  return s.exists() ? s.data() : null;
};
const tracked = { deletedAt: null, updatedAt: serverTimestamp(), v: 1, createdAt: Date.now() };

async function clearAndKeep(coll) {
  const before = (await getDocs(A.coll(coll))).docs.map((d) => [d.id, d.data()]);
  for (const [id] of before) await deleteDoc(A.ref(coll, id));
  undo.add(async () => {
    for (const d of (await getDocs(A.coll(coll))).docs) await deleteDoc(d.ref);
    for (const [id, data] of before) await setDoc(A.ref(coll, id), data);
  });
}

try {
  for (const coll of ['timetables', 'lessonDays']) await clearAndKeep(coll);
  const common = await read(A.ref('settings', 'common'));
  undo.add(async () => {
    if (common) await setDoc(A.ref('settings', 'common'), common);
    else await deleteDoc(A.ref('settings', 'common'));
  });
  const periods = Array.from({ length: 6 }, (_, i) => ({ n: i + 1, name: `${i + 1}교시`, start: `${String(9 + i).padStart(2, '0')}:00`, end: `${String(9 + i).padStart(2, '0')}:40` }));
  await setDoc(A.ref('settings', 'common'), { ...(common ?? {}), periods, classBell: null, updatedAt: Date.now() });
  await setDoc(A.ref('timetables', 'insp_bg1'), { name: '점검 주간학습', from: '2026-03-01', to: '2027-02-28', grid: { '1': { '1': '국어', '2': '수학' }, '3': { '1': '과학' } }, authorId: uid, ...tracked });
  await setDoc(A.ref('lessonDays', '2026-10-12'), { periods: { '1': { memo: '시 낭송', supplies: '공책, 색연필' }, '2': { supplies: '색연필·자' } }, authorId: uid, ...tracked });
  // 그날 알림장 (P7-2) - 주간학습안내의 '알림장' 줄
  const notice0 = await getDoc(A.ref('notices', '2026-10-12'));
  undo.add(async () => (notice0.exists() ? setDoc(A.ref('notices', '2026-10-12'), notice0.data()) : deleteDoc(A.ref('notices', '2026-10-12'))));
  await setDoc(A.ref('notices', '2026-10-12'), { date: '2026-10-12', lines: ['우유 가져오기', '동의서'], updatedAt: serverTimestamp(), v: 1 });

  const { page, errors, ctx } = await newPage(browser);
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(SITE).origin });

  r.section('🔔 수업 종');
  await open(page, '#/day/2026-10-12');
  const bellBtn = page.locator(sel('day-bell'));
  r.check(await waitFor(bellBtn, 8000), "'⏰ 수업' 옆 종 단추");
  r.check((await bellBtn.textContent()).includes('🔕'), '처음은 꺼짐 🔕');
  await bellBtn.click();
  r.check(await waitFor(page.locator(sel('class-bell'))), '누르면 수업 종 설정 칸');
  r.check(!(await page.locator(`${sel('class-bell')} >> text=교시 시각을 먼저`).count()), '교시 시각이 있으면 안내 없음');
  await page.locator(sel('bell-enabled')).check();
  const saved = await serverUntil(() => read(A.ref('settings', 'common')), (d) => d?.classBell?.enabled === true);
  r.check(saved?.classBell?.enabled === true && saved.classBell.start.on === true, '켜기 = 계정 설정 common.classBell (고르는 즉시)');
  await page.locator(sel('bell-amount', 'start')).fill('1');
  const saved2 = await serverUntil(() => read(A.ref('settings', 'common')), (d) => d?.classBell?.start?.amount === 1);
  r.check(saved2?.classBell?.start?.amount === 1 && saved2.classBell.start.unit === 'min' && saved2.classBell.start.when === 'before', '시작 1분 전');
  r.check(await waitFor(async () => (await bellBtn.textContent()).includes('🔔')), '켜면 🔔 종');
  await page.locator(sel('day-bell-close')).click();
  r.check(!(await page.locator(sel('class-bell')).count()), '✕ = 설정 칸 닫기');

  // 시각을 고정한 새 창 - 월 08:58:55 → 1교시 시작 1분 전(08:59:00)에 종
  {
    const { page: p2, errors: e2 } = await newPage(browser);
    await p2.clock.install({ time: new Date('2026-10-12T08:58:50') });
    await open(p2, '#/day/2026-10-12');
    await waitFor(p2.locator(sel('day-bell')), 8000);
    await p2.clock.runFor(15_000);
    const rang = await waitFor(async () => (await p2.evaluate(() => window.__spBellLast || '')).includes('1교시 시작'), 5000);
    r.check(rang, `교시 시작 1분 전에 종 (${await p2.evaluate(() => window.__spBellLast || '')})`);
    r.check((await p2.evaluate(() => window.__spBellCount || 0)) === 1, '소리 한 번');
    // 이 기기에서 울리지 않기 → 다음 종(1교시 끝 09:40)은 조용
    await p2.locator(sel('day-bell')).click();
    await p2.locator(sel('bell-here')).uncheck();
    r.check((await p2.evaluate(() => localStorage.getItem('sp5-class-bell-muted'))) === '1', "'이 기기에서 울리기' = 이 기기 저장소에만");
    await p2.clock.runFor(41 * 60_000);
    r.check((await p2.evaluate(() => window.__spBellCount || 0)) === 1, '이 기기에서 끄면 울리지 않는다');
    r.check(e2.length === 0, `화면 오류 없음 ${e2.join(' | ')}`);
    await p2.context().close();
  }
  // 종은 끈다 (다른 점검에 소리가 섞이지 않게) - 끝에 common을 통째로 되돌린다
  await bellBtn.click();
  await page.locator(sel('bell-enabled')).uncheck();
  await serverUntil(() => read(A.ref('settings', 'common')), (d) => !d?.classBell);

  r.section('📰 주간학습안내');
  await page.goto(page.url().replace(/#.*$/, '#/week/2026-10-12'));
  const guideBtn = page.locator(sel('week-guide'));
  r.check(await waitFor(guideBtn, 8000), '주간 화면에 📰 주간학습안내 (담임)');
  await guideBtn.click();
  const win = page.locator(sel('weekly-guide-window'));
  r.check(await waitFor(win), '창이 열린다');
  r.check((await page.locator(sel('guide-range')).getAttribute('data-guide-range')) === '2026-10-12', '보고 있는 주로 (월~금)');
  const cell = (row, c) => page.locator(`[data-guide-cell="${row}:${c}"]`);
  r.check(await waitFor(async () => ((await cell('1교시', 1).textContent()) ?? '').includes('국어'), 8000), '월 1교시 = 국어 (계산한 수업 칸)');
  r.check((await cell('1교시', 1).textContent()).includes('시 낭송'), '과목 아래 수업 메모');
  r.check((await cell('1교시', 3).textContent()).includes('과학'), '수 1교시 = 과학');
  r.check((await cell('준비물', 1).textContent()) === '공책, 색연필, 자', `준비물 = 모아서 겹친 것 하나로 (${await cell('준비물', 1).textContent()})`);
  r.check(((await cell('알림장', 1).textContent()) ?? '').includes('1. 우유 가져오기') && ((await cell('알림장', 1).textContent()) ?? '').includes('2. 동의서'), `알림장 줄 = 그날 알림장 (${await cell('알림장', 1).textContent()})`);
  await page.locator(sel('guide-opt', 'memo')).uncheck();
  r.check(!(await cell('1교시', 1).textContent()).includes('시 낭송'), '수업 메모 끄기');
  r.check((await page.evaluate(() => localStorage.getItem('sp5-weekly-guide-opts'))).includes('"memo":false'), '넣을 것은 이 기기에 남는다');
  await page.locator(sel('guide-opt', 'memo')).check();
  await page.locator(sel('guide-title')).fill('4학년 3반 주간학습안내');
  await page.locator(sel('guide-note-input')).fill('수요일은 현장체험학습입니다.');
  r.check((await page.locator(sel('guide-heading')).textContent()) === '4학년 3반 주간학습안내 (10.12 ~ 10.16)', '제목 (주 범위)');
  r.check(await waitFor(page.locator(sel('guide-note'))), '알리는 말이 표 위에');
  await page.locator(sel('guide-prev')).click();
  r.check((await page.locator(sel('guide-range')).getAttribute('data-guide-range')) === '2026-10-05', '◀ 앞 주');
  r.check(!(await page.locator(sel('guide-note')).count()), '알리는 말은 주마다 따로');
  await page.locator(sel('guide-next')).click();
  r.check(await waitFor(page.locator(sel('guide-note'))), '돌아오면 그 주의 알리는 말');
  // 인쇄 - 인쇄 창 대신 세고, 찍을 준비(#sp5-print-root)를 본다
  await page.evaluate(() => {
    window.print = () => {
      window.__printed = (window.__printed || 0) + 1;
    };
  });
  await page.locator(sel('guide-print')).click();
  r.check((await page.evaluate(() => window.__printed)) === 1, '🖨️ 인쇄 = 인쇄 창');
  r.check((await page.locator('#sp5-print-root [data-guide-table]').count()) === 1, '찍을 것 = 주간학습안내 칸만');
  r.check((await page.locator('#sp5-print-root-page').textContent()).includes('portrait'), 'A4 세로');
  await page.locator(sel('guide-copy')).click();
  r.check(await waitFor(page.locator(sel('toast')).filter({ hasText: '표를 복사했습니다' })), '📋 표 복사');
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  r.check(clip.startsWith('\t10/12(월)') && clip.includes('국어'), '복사한 글 = 탭으로 나눈 표');
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.sp5.runShortcut('weeklyGuide'));
  r.check(await waitFor(win), "단축키 '주간학습안내'");
  const range = await page.locator(sel('guide-range')).getAttribute('data-guide-range');
  const now = new Date();
  const mon = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7) + 7);
  const want = `${mon.getFullYear()}-${String(mon.getMonth() + 1).padStart(2, '0')}-${String(mon.getDate()).padStart(2, '0')}`;
  r.check(range === want, `단축키 = 다음 주 (${range})`);
  await page.keyboard.press('Escape');

  r.section('🖨️ 이 화면 인쇄');
  await page.locator(sel('more-menu')).click();
  r.check(await waitFor(page.locator(sel('menu-item', 'print'))), '주간 ⋮에 이 화면 인쇄');
  await page.locator(sel('menu-item', 'print')).click();
  r.check((await page.evaluate(() => window.__printed)) === 2, '⋮ 인쇄 = 인쇄 창');
  r.check((await page.locator('#sp5-print-root [data-week-grid]').count()) === 1, '찍을 것 = 이번 주 칸');
  r.check((await page.locator('#sp5-print-root .sp5-print-title').textContent()) === '2026년 10.12 ~ 10.16 주간' || (await page.locator('#sp5-print-root .sp5-print-title').textContent()).startsWith('2026년 10.12 ~ 10.1'), '제목 = 그 주');
  r.check((await page.locator('#sp5-print-root-page').textContent()).includes('landscape'), 'A4 가로');
  r.check(!(await page.locator('#sp5-print-root [data-week-guide]').count()), '단추 줄은 찍지 않는다');
  await page.keyboard.press('Control+p');
  r.check((await page.evaluate(() => window.__printed)) === 3, 'Ctrl+P = 이 화면 인쇄');
  await page.goto(page.url().replace(/#.*$/, '#/year/2026'));
  await page.locator(sel('year-view', 'sheet')).click();
  await waitFor(page.locator('[data-year-sheet] [data-sheet-month]'), 8000);
  await page.keyboard.press('Control+p');
  r.check((await page.evaluate(() => window.__printed)) === 4 && (await page.locator('#sp5-print-root [data-year-sheet]').count()) === 1, '년간 학사력 = 학사력 칸');
  r.check((await page.locator('#sp5-print-root .sp5-print-title').textContent()).includes('학년도 학사력'), '제목 = 학년도 학사력');
  await page.goto(page.url().replace(/#.*$/, '#/day/2026-10-12'));
  await waitFor(page.locator(sel('day-lessons')), 8000);
  await page.locator(sel('more-menu')).click();
  r.check(!(await page.locator(sel('menu-item', 'print')).count()), '하루 화면 ⋮에는 없다');
  await page.keyboard.press('Escape');
  r.check(errors.length === 0, `화면 오류 없음 ${errors.join(' | ')}`);

  r.section('전담 (teacher3)');
  const { page: p3, errors: e3 } = await newPage(browser);
  await open(p3, '#/week/2026-10-12', { as: '3' });
  await waitFor(p3.locator(sel('week-lessons')), 8000);
  r.check(!(await p3.locator(sel('week-guide')).count()), '전담은 주간학습안내 단추가 없다 (담임 도구)');
  r.check(e3.length === 0, `화면 오류 없음 ${e3.join(' | ')}`);
} catch (e) {
  r.bad(`점검이 멈췄다: ${e?.stack ?? e}`);
} finally {
  await browser.close();
  await undo.run();
  r.done();
  process.exit();
}
