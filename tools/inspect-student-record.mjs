// tools/inspect-student-record.mjs - P7-4 ■2: 📊 조사표 모아 보기 · 🧑‍🎓 학생 기록(누가기록)을 실제 크롬에서 본다.
//   1) 모아 보기: 학급 도구 카드 → 그 학급 학생 × 조사표(날짜 차례) · 칸 값·✎·명단에 없는 학생 · 단계별 수 · 교과·학기·유형 거르기 · 📥 CSV · 머리 = 그 조사표 창
//   2) 학생 기록: 학급 화면 학생 이름 → 학생 카드(기록·조사표 수·출결 누계) · 기록·메모·출결 날짜 차례 · 기록 → 그날 하루 화면 · 조사표 갈래 · 관찰 한 줄 · '#26040302'로 찾기
//   3) 교과 전담(teacher3): 모아 보기 '학급별 / 과정별' 탭
//
//   npm run emu · npm run dev:emu (켜 둔다) → npm run seed → node tools/inspect-student-record.mjs
// 에뮬레이터 teacher의 classes를 비우고 점검 학급·조사표·출석부·기록을 심었다가 끝에 지우거나 되돌린다.
import { readFileSync } from 'node:fs';
import { collection, deleteDoc, doc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';
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
const year = (() => {
  const d = new Date();
  return d.getMonth() + 1 >= 3 ? d.getFullYear() : d.getFullYear() - 1;
})();
const CLASS_ID = `${year}-5-2`;
const KEY = (s) => `${CLASS_ID}/${s}`;
const st = (s, num, name, out = false) => ({ sid: s, num, name, status: out ? 'out' : 'active' });
const base = { authorId: uid, deletedAt: null, createdAt: Date.now(), updatedAt: serverTimestamp(), v: 1 };
const list4 = [1, 2, 3, 4].map((n) => ({ sid: `a${n}`, num: n, name: ['김하나', '이두리', '박세나', '최네모'][n - 1] }));

try {
  const before = (await getDocs(collection(em.db, 'spaces', sid, 'classes'))).docs.map((d) => [d.id, d.data()]);
  for (const [id] of before) await deleteDoc(ref('classes', id));
  undo.add(async () => {
    for (const d of (await getDocs(collection(em.db, 'spaces', sid, 'classes'))).docs) await deleteDoc(d.ref);
    for (const [id, data] of before) await setDoc(ref('classes', id), data);
  });
  const clean = async () => {
    for (const d of (await getDocs(collection(em.db, 'spaces', sid, 'evaluations'))).docs) if (d.data().classId === CLASS_ID) await deleteDoc(d.ref);
    for (const d of (await getDocs(collection(em.db, 'spaces', sid, 'attendance'))).docs) if (d.id.startsWith(`${CLASS_ID}_`)) await deleteDoc(d.ref);
    for (const d of (await getDocs(collection(em.db, 'spaces', sid, 'items'))).docs) if ((d.data().studentIds ?? []).some((k) => k.startsWith(`${CLASS_ID}/`))) await deleteDoc(d.ref);
  };
  await clean();
  undo.add(clean);
  await setDoc(ref('classes', CLASS_ID), { year, grade: 5, num: 2, students: [st('a1', 1, '김하나'), st('a2', 2, '이두리'), st('a3', 3, '박세나'), st('a4', 4, '최네모'), st('a5', 5, '정다섯', true)], ...base });
  const ev = (id, data) => setDoc(ref('evaluations', id), { classId: CLASS_ID, students: list4, values: {}, ...data, ...base });
  await ev('inspE1', { date: `${year}-04-10`, period: 2, title: '단원평가', type: 'eval', subject: '수학', indiv: true, group: false, steps: ['우수', '보통', '노력요함'], values: { a1: { indiv: '우수', reason: '근거' }, a2: { indiv: '보통' } } });
  await ev('inspE2', { date: `${year}-09-10`, period: 3, title: '준비물', type: 'check', values: { a1: { checked: true } } });
  await ev('inspE3', { date: `${year}-04-11`, period: null, title: '소감', type: 'memo', values: { a2: { memo: '발표' } } });
  await setDoc(ref('attendance', `${CLASS_ID}_${year}-04-15`), { classId: CLASS_ID, date: `${year}-04-15`, records: { a1: { kind: 'late', reason: 'sick', periods: [1] } }, updatedAt: serverTimestamp(), v: 1 });
  const note = (id, data) => setDoc(ref('items', id), { kind: 'note', labelIds: [], order: 'a0', ...data, ...base });
  await note('inspJ1', { date: `${year}-04-12`, text: '발표를 잘함', studentIds: [KEY('a1')] });
  await note('inspM1', { date: null, fromDate: `${year}-04-05`, text: '상담 메모', studentIds: [KEY('a1')] });

  const { page, errors } = await newPage(browser);

  r.section('📊 조사표 모아 보기');
  await open(page, '#/class');
  const card = page.locator(sel('class-tool', 'evalOverview'));
  r.check(await waitFor(card, 8000), '학급 도구 카드 📊 조사표 모아 보기');
  await card.click();
  const ov = page.locator(sel('eval-overview-window', CLASS_ID));
  r.check(await waitFor(ov, 8000), '모아 보기 = 그 학급');
  r.check(await waitFor(async () => (await ov.locator('[data-eval-overview-count]').getAttribute('data-eval-overview-count')) === '3'), '조사표 3개');
  const cols = await ov.locator('[data-eval-col]').evaluateAll((els) => els.map((e) => e.getAttribute('data-eval-col')));
  r.check(JSON.stringify(cols) === JSON.stringify(['inspE1', 'inspE3', 'inspE2']), '날짜 차례 (4/10 · 4/11 · 9/10)', cols.join(','));
  r.check(((await ov.locator(sel('eval-cell', 'inspE1:a1')).textContent()) ?? '').includes('우수✎'), "칸 = '우수' + ✎ (사유 있음)");
  r.check(((await ov.locator(sel('eval-cell', 'inspE2:a1')).textContent()) ?? '') === 'O', '체크 = O');
  r.check(((await ov.locator(sel('eval-cell', 'inspE1:a5')).textContent()) ?? '') === '·', '명단에 없는 학생(전출) = ·');
  r.check(((await ov.locator(sel('eval-col', 'inspE1')).locator('[data-eval-steps]').textContent()) ?? '') === '우수 1 · 보통 1', '단계별 사람 수');
  await ov.locator('[data-eval-overview-subject]').selectOption('수학');
  r.check((await ov.locator('[data-eval-overview-count]').getAttribute('data-eval-overview-count')) === '1', '교과 수학 = 1');
  await ov.locator('[data-eval-overview-subject]').selectOption('');
  await ov.locator('[data-eval-overview-semester]').selectOption('2');
  r.check((await ov.locator('[data-eval-overview-count]').getAttribute('data-eval-overview-count')) === '1', '2학기 = 1');
  await ov.locator('[data-eval-overview-semester]').selectOption('');
  await ov.locator('[data-eval-overview-type]').selectOption('memo');
  r.check((await ov.locator('[data-eval-overview-count]').getAttribute('data-eval-overview-count')) === '1', '유형 메모 = 1');
  await ov.locator('[data-eval-overview-type]').selectOption('');
  const [download] = await Promise.all([page.waitForEvent('download'), ov.locator('[data-eval-overview-csv]').click()]);
  const csv = readFileSync(await download.path(), 'utf8').replace(/^﻿/, '');
  r.check(csv.startsWith('번호,이름') && csv.includes(`${year}-04-10 수학 평가`) && csv.includes('우수,근거'), '📥 CSV (값·사유)');
  await ov.locator(sel('eval-col', 'inspE1')).click();
  r.check(await waitFor(page.locator(sel('eval-view', 'inspE1')), 8000), '머리를 누르면 그 조사표 창');
  await page.evaluate(() => window.sp5.closeAllWindows());

  r.section('🧑‍🎓 학생 기록(누가기록)');
  await page.locator(sel('class-student', 1)).first().click();
  const rec = page.locator(sel('student-record', CLASS_ID));
  r.check(await waitFor(rec.locator(sel('student-card', 'a1')), 8000), '학생 이름 = 그 학생의 누가기록');
  r.check((await rec.locator('[data-student-counts]').getAttribute('data-student-counts')) === '2|2', '기록 2건(기록·메모) · 조사표 2건(적은 것)');
  r.check(((await rec.locator('[data-student-counts]').textContent()) ?? '').includes('지각 1'), '출결 누계 지각 1');
  const kinds = await rec.locator('[data-timeline-kind]').evaluateAll((els) => els.map((e) => e.getAttribute('data-timeline-kind')));
  r.check(JSON.stringify(kinds) === JSON.stringify(['memo', 'journal', 'attendance']), '날짜 차례 - 메모(4/5) · 기록(4/12) · 출결(4/15)', kinds.join(','));
  await rec.locator(sel('student-record-tab', 'evals')).click();
  r.check((await rec.locator('[data-student-eval]').count()) === 3, '조사표 갈래 - 명단에 든 셋');
  r.check(((await rec.locator(sel('student-eval', 'inspE3')).locator('[data-student-eval-value]').textContent()) ?? '') === '안 적음', "적지 않은 것 = '안 적음'");
  await rec.locator(sel('student-record-tab', 'timeline')).click();
  await rec.locator('[data-student-observe-input]').fill('관찰 점검');
  await rec.locator('[data-student-observe-input]').press('Enter');
  const notes = async () => (await getDocs(collection(em.db, 'spaces', sid, 'items'))).docs.map((d) => d.data()).filter((d) => d.date === TODAY && (d.studentIds ?? []).includes(KEY('a1')));
  const ns = await serverUntil(notes, (l) => l.length === 1);
  r.check(ns[0]?.text === '관찰 점검', '관찰 한 줄 = 오늘 기록 (학생 칩)');
  r.check(await waitFor(async () => (await rec.locator('[data-timeline-kind]').count()) === 4), '누가기록에 곧 보인다');
  await rec.locator(sel('student-timeline-item', `${sid}:inspJ1`)).click();
  r.check(await waitFor(async () => new URL(page.url()).hash === `#/day/${year}-04-12`), '기록을 누르면 그날 하루 화면');
  await rec.locator('[data-student-record-tag]').fill(`#${String(year % 100).padStart(2, '0')}050202`);
  await rec.locator('[data-student-record-tag-find]').click();
  r.check(await waitFor(rec.locator(sel('student-card', 'a2'))), "'#yy050202'로 찾기 = 2번 이두리");
  r.check(errors.length === 0, '화면 오류 없음', errors.join(' | '));

  r.section('교과 전담 - 과정별 탭');
  const em3 = emulator('inspect3');
  const uid3 = await em3.signIn('teacher3@example.com');
  const ref3 = (c, id) => doc(em3.db, 'spaces', `u_${uid3}`, c, id);
  const C3 = `${year}-5-1`;
  const before3 = (await getDocs(collection(em3.db, 'spaces', `u_${uid3}`, 'classes'))).docs.map((d) => [d.id, d.data()]);
  undo.add(async () => {
    for (const d of (await getDocs(collection(em3.db, 'spaces', `u_${uid3}`, 'classes'))).docs) await deleteDoc(d.ref);
    for (const [id, data] of before3) await setDoc(ref3('classes', id), data);
  });
  await setDoc(ref3('classes', C3), { year, grade: 5, num: 1, students: [st('t1', 1, '가람')], authorId: uid3, deletedAt: null, createdAt: Date.now(), updatedAt: serverTimestamp(), v: 1 });
  const p3 = await newPage(browser);
  await open(p3.page, '#/class', { as: 3 });
  await p3.page.evaluate(() => window.sp5.runShortcut('evalOverview'));
  const tab = p3.page.locator(sel('eval-overview-tab', 'course'));
  r.check(await waitFor(tab, 8000), "교과 모드 = '학급별 / 과정별' 탭");
  await tab.click();
  r.check(await waitFor(p3.page.locator('[data-course-overview], [data-course-overview-empty]'), 8000), '과정별 = 과정 × 반 표 (없으면 안내)');
  r.check(p3.errors.length === 0, '화면 오류 없음', p3.errors.join(' | '));
} catch (e) {
  r.bad(`점검이 멈췄다: ${e?.stack ?? e}`);
} finally {
  await undo.run();
  await browser.close();
  r.done();
  process.exit();
}
