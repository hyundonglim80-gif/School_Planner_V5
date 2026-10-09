// tools/inspect-attendance.mjs - P7-2: 출석부(·알림장·기록 칸 카드·교과 출결 - 조각마다 더한다)를 실제 크롬에서 본다.
//   1) 📋 출석부: 하루 수업 머리줄 📋 = 그날 칸 · 결석·사유 = 2.5초 뒤 저절로 저장(바뀐 학생 칸만 - 학생 sid) · 지각 교시·사유 메모 ·
//      지각 → 결석이면 옛 교시가 남지 않는다 · 출석으로 돌리기 = 그 칸 지우기 · Ctrl+S = 바로 · 날짜 옮기기 전 적던 것은 그 날에 ·
//      전출 학생은 빼고 · 다른 기기에서 고친 것이 따라온다 · 📊 누계(종류×사유·내역) · 학급 화면 오늘 출결 줄·도구 카드·단축키
//
//   npm run emu · npm run dev:emu (켜 둔다) → npm run seed → node tools/inspect-attendance.mjs
// 에뮬레이터 teacher의 classes를 비우고 점검 학급을 심었다가 끝에 되돌린다. 점검 학급의 출석부 문서는 끝에 지운다.
import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { emulator, launch, newPage, open, report, restorer, sel, serverUntil, waitFor } from './lib/probe.mjs';

const r = report();
const undo = restorer();
const em = emulator();
const uid = await em.signIn('teacher@example.com');
const sid = `u_${uid}`;
const browser = await launch();
const ref = (c, id) => doc(em.db, 'spaces', sid, c, id);
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const TODAY = ymd(new Date());
const TOMORROW = ymd(new Date(Date.now() + 86400000));
const year = (() => {
  const d = new Date();
  return d.getMonth() + 1 >= 3 ? d.getFullYear() : d.getFullYear() - 1;
})();
const CLASS_ID = `${year}-5-2`;
const att = (date) => ref('attendance', `${CLASS_ID}_${date}`);
/** 칸 차례와 상관없이 같은가 (서버는 칸 차례를 바꿔 준다) */
const sorted = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sorted(v[k])])) : v);
const same = (a, b) => JSON.stringify(sorted(a)) === JSON.stringify(sorted(b));
const read = async (date) => {
  const s = await getDoc(att(date));
  return s.exists() ? s.data() : null;
};

try {
  // 점검 학급 (classes를 비우고 끝에 되돌린다)
  const before = (await getDocs(collection(em.db, 'spaces', sid, 'classes'))).docs.map((d) => [d.id, d.data()]);
  for (const [id] of before) await deleteDoc(ref('classes', id));
  undo.add(async () => {
    for (const d of (await getDocs(collection(em.db, 'spaces', sid, 'classes'))).docs) await deleteDoc(d.ref);
    for (const [id, data] of before) await setDoc(ref('classes', id), data);
  });
  undo.add(async () => {
    for (const d of (await getDocs(collection(em.db, 'spaces', sid, 'attendance'))).docs) if (d.id.startsWith(`${CLASS_ID}_`)) await deleteDoc(d.ref);
  });
  const st = (s, num, name, out = false) => ({ sid: s, num, name, status: out ? 'out' : 'active' });
  await setDoc(ref('classes', CLASS_ID), {
    year,
    grade: 5,
    num: 2,
    students: [st('a1', 1, '김하나'), st('a2', 2, '이두리'), st('a3', 3, '박세나'), st('a4', 4, '최네모', true)],
    authorId: uid,
    deletedAt: null,
    updatedAt: serverTimestamp(),
    v: 1,
    createdAt: Date.now(),
  });

  const { page, errors, dialogs } = await newPage(browser);
  dialogs.answer = true;
  const panel = page.locator(sel('attendance-panel', CLASS_ID));
  const row = (s) => panel.locator(sel('attendance-row', s));
  const kind = (s, k) => row(s).locator(sel('attendance-kind', k));
  const pressed = async (loc) => (await loc.getAttribute('aria-pressed')) === 'true';

  r.section('📋 출석부 열기');
  await open(page, `#/day/${TODAY}`);
  const tool = page.locator(sel('lessons-tool', 'attendance'));
  r.check(await waitFor(tool, 8000), '하루 수업 머리줄에 📋 출석부 (담임)');
  await tool.click();
  r.check(await waitFor(panel, 8000), '출석부 칸 = 학급 화면에서 고른 학급(없으면 올해 학급)');
  r.check((await panel.getAttribute('data-attendance-date')) === TODAY, '그날');
  r.check((await panel.locator('[data-attendance-row]').count()) === 3, '전출 학생은 빼고 셋');

  r.section('저절로 저장');
  await kind('a1', 'absent').click();
  await row('a1').locator(sel('attendance-reason', 'unexcused')).click();
  r.check(await waitFor(panel.locator(sel('attendance-dirty'))), "'잠시 뒤 저절로 저장합니다'");
  let doc1 = await serverUntil(() => read(TODAY), (d) => d?.records?.a1?.reason === 'unexcused', 8000);
  r.check(same(doc1?.records?.a1, { kind: 'absent', reason: 'unexcused' }), `2.5초 뒤 서버에 a1 = 결석(미인정) (${JSON.stringify(doc1?.records)})`);
  r.check(doc1?.classId === CLASS_ID && doc1?.date === TODAY, '문서에 학급·날짜');
  r.check(await waitFor(async () => !(await panel.locator(sel('attendance-dirty')).isVisible()), 5000), '저장하면 표시가 사라진다');

  await kind('a2', 'late').click();
  await row('a2').locator(sel('attendance-period', 1)).click();
  await row('a2').locator(sel('attendance-period', 3)).click();
  await row('a2').locator(sel('attendance-note-open')).click();
  await row('a2').locator(sel('attendance-note')).fill('늦잠');
  doc1 = await serverUntil(() => read(TODAY), (d) => d?.records?.a2?.note === '늦잠', 8000);
  r.check(same(doc1?.records?.a2, { kind: 'late', reason: 'sick', periods: [1, 3], note: '늦잠' }), `지각 1·3교시 - 늦잠 (${JSON.stringify(doc1?.records?.a2)})`);
  r.check(same(doc1?.records?.a1, { kind: 'absent', reason: 'unexcused' }), 'a1은 그대로 (바뀐 학생 칸만)');

  r.section('바꾸기·지우기·Ctrl+S');
  await kind('a2', 'absent').click();
  doc1 = await serverUntil(() => read(TODAY), (d) => d?.records?.a2?.kind === 'absent', 8000);
  r.check(same(doc1?.records?.a2, { kind: 'absent', reason: 'sick', note: '늦잠' }), `지각 → 결석 = 옛 교시가 남지 않는다, 사유 메모는 이어받는다 (${JSON.stringify(doc1?.records?.a2)})`);
  await kind('a1', 'present').click();
  await kind('a3', 'early').click();
  await row('a3').locator(sel('attendance-period', 5)).click();
  const t0 = Date.now();
  await page.keyboard.press('Control+s');
  doc1 = await serverUntil(() => read(TODAY), (d) => !d?.records?.a1 && d?.records?.a3?.kind === 'early', 8000);
  r.check(!doc1?.records?.a1 && Date.now() - t0 < 2400, `Ctrl+S = 바로 저장, 출석으로 돌린 a1은 칸이 지워진다 (${Date.now() - t0}ms)`);
  r.check(same(doc1?.records?.a3, { kind: 'early', reason: 'sick', periods: [5] }), 'a3 조퇴 5교시');
  r.check((await panel.locator(sel('attendance-count')).getAttribute('data-attendance-count')) === '2', '그 밖 2명');

  r.section('날짜 옮기기');
  await panel.locator(sel('attendance-next')).click();
  r.check(await waitFor(async () => (await panel.getAttribute('data-attendance-date')) === TOMORROW), '▶ = 다음 날');
  r.check((await panel.locator(sel('attendance-count')).getAttribute('data-attendance-count')) === '0', '다음 날은 모두 출석');
  await kind('a1', 'late').click();
  await panel.locator(sel('attendance-prev')).click();
  const doc2 = await serverUntil(() => read(TOMORROW), (d) => d?.records?.a1?.kind === 'late', 6000);
  r.check(doc2?.records?.a1?.kind === 'late', '적던 것은 옮기기 전 그 날에 저장한다');
  r.check(await pressed(kind('a2', 'absent')), '돌아오면 그날 것');

  r.section('다른 기기에서 고친 것');
  await updateDoc(att(TODAY), { 'records.a1': { kind: 'result', reason: 'approved', periods: [2] }, updatedAt: serverTimestamp() });
  r.check(await waitFor(async () => pressed(kind('a1', 'result')), 8000), '서버에서 고친 a1 = 결과(출석인정)가 들어온다');

  r.section('📊 누계');
  await panel.locator(sel('attendance-tab', 'summary')).click();
  const sumRow = (s) => panel.locator(sel('attendance-summary-row', s));
  r.check(await waitFor(sumRow('a4')), '누계는 전출 학생까지');
  r.check((await sumRow('a2').locator('[data-tally="absent-sick"]').textContent()) === '1', '이두리 결석(질병) 1');
  r.check((await sumRow('a1').locator('[data-tally="result-approved"]').textContent()) === '1' && (await sumRow('a1').locator('[data-tally="late-sick"]').textContent()) === '1', '김하나 결과(인정) 1·지각(질병) 1 (내일 것도 학년도에)');
  await sumRow('a1').click();
  r.check(await waitFor(panel.locator(sel('attendance-history', 'a1'))), '학생을 누르면 날짜별 내역');
  r.check((await panel.locator(sel('attendance-history', 'a1')).locator('li').count()) === 2, '내역 둘');
  await panel.locator(sel('attendance-range')).selectOption('sem1');
  r.check((await sumRow('a2').locator('[data-tally="absent-sick"]').textContent()) !== '1' || TODAY < `${year}-09-01`, '1학기로 고르면 2학기 출결은 빠진다');
  r.check(errors.length === 0, '화면 오류 없음', errors.join(' | '));

  r.section('학급 화면');
  await page.locator(sel('close')).first().click();
  await page.goto(page.url().split('#')[0] + '#/class');
  const todayLine = page.locator('[data-class-today]');
  r.check(await waitFor(todayLine, 8000), '📋 오늘 출결 줄 (담임)');
  r.check((await todayLine.getAttribute('data-class-today')) === '3' && (await todayLine.textContent()).includes('결석'), `오늘 적힌 학생 셋 (${(await todayLine.textContent()).replace(/\s+/g, ' ')})`);
  await page.locator(sel('class-tool', 'attendance')).click();
  r.check(await waitFor(panel, 8000), '도구 카드 📋 출석부 = 그 학급 오늘');
  await page.locator(sel('close')).first().click();
  await page.evaluate(() => window.sp5.runShortcut('attendance'));
  r.check(await waitFor(panel, 8000), "단축키 '출석부'");
  r.check(errors.length === 0, '화면 오류 없음', errors.join(' | '));
} finally {
  await undo.run();
  await browser.close();
  r.done();
  process.exit();
}
