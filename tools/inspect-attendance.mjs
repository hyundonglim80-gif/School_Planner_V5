// tools/inspect-attendance.mjs - P7-2: 출석부(·알림장·기록 칸 카드·교과 출결 - 조각마다 더한다)를 실제 크롬에서 본다.
//   1) 📋 출석부: 하루 수업 머리줄 📋 = 그날 칸 · 결석·사유 = 2.5초 뒤 저절로 저장(바뀐 학생 칸만 - 학생 sid) · 지각 교시·사유 메모 ·
//      지각 → 결석이면 옛 교시가 남지 않는다 · 출석으로 돌리기 = 그 칸 지우기 · Ctrl+S = 바로 · 날짜 옮기기 전 적던 것은 그 날에 ·
//      전출 학생은 빼고 · 다른 기기에서 고친 것이 따라온다 · 📊 누계(종류×사유·내역) · 학급 화면 오늘 출결 줄·도구 카드·단축키
//   2) 📢 알림장: 하루 수업 머리줄 📢 · 📥 다음 수업일 불러오기(수업 칸 준비물 + 일정, 주말 건너뜀) · 번호 떼기·미리 보기·📋 복사 · 💾 저장 = notices/{date} ·
//      다른 날로 옮기면 적던 것은 그 날에 · 다른 기기 고침이 따라온다 · 📚 모아 보기(달) → 그날 쓰기 · 학급 도구 카드·단축키 '알림장 모아 보기'
//   3) 기록 칸 카드(계산): 그날 '📋 출결 5-2'·'📢 알림장' 카드 → 누르면 원본 칸 · 기록 창(📝)에도 · 검색 '기록'에 나오고 누르면 그날로·원본 칸
//   4) 🙋 교과 출결(전담 teacher3): 교시 카드 🙋 → 칸 · 누르는 대로 학생 한 칸만 저장 · 사유 · 두 교시가 서로 덮지 않는다 · 칩 '결과 1' · 📊 누계(학생마다·내역) · 학급 도구 카드
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
  await panel.locator(sel('close')).click();
  r.check(errors.length === 0, '화면 오류 없음', errors.join(' | '));

  // ── 2) 알림장 ──
  // 2027-04-07(수) 알림장 → 다음 수업일 04-08(목): 수업 칸 준비물 + 일정
  const N1 = '2027-04-07';
  const N2 = '2027-04-08';
  const keep = async (c, id) => {
    const s0 = await getDoc(ref(c, id));
    undo.add(async () => (s0.exists() ? setDoc(ref(c, id), s0.data()) : deleteDoc(ref(c, id))));
  };
  for (const d of [N1, N2]) await keep('notices', d);
  await keep('lessonDays', N2);
  await setDoc(ref('lessonDays', N2), { periods: { '2': { subject: '미술', supplies: '색연필' } }, updatedAt: serverTimestamp(), v: 1 });
  await keep('items', 'inspNoticeEv');
  await setDoc(ref('items', 'inspNoticeEv'), {
    kind: 'event',
    date: N2,
    text: '점검알림 동의서 제출',
    labelIds: [],
    order: 'a0',
    authorId: uid,
    deletedAt: null,
    createdAt: Date.now(),
    updatedAt: serverTimestamp(),
    v: 1,
  });
  const notice = async (d) => {
    const s0 = await getDoc(ref('notices', d));
    return s0.exists() ? s0.data() : null;
  };
  const np = page.locator(sel('notice-panel', sid));
  const ntext = np.locator(sel('notice-text'));

  r.section('📢 알림장 쓰기');
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(page.url()).origin });
  await page.goto(page.url().split('#')[0] + `#/day/${N1}`);
  await page.locator(sel('lessons-tool', 'notices')).click();
  r.check(await waitFor(np, 8000), '하루 수업 머리줄 📢 = 그날 알림장 (개인 공간)');
  r.check((await np.getAttribute('data-notice-date')) === N1, '그날');
  r.check((await np.locator(sel('notice-draft')).getAttribute('data-notice-draft')) === N2, '다음 수업일 = 4/8(목)');
  await np.locator(sel('notice-draft')).click();
  r.check(await waitFor(async () => (await ntext.inputValue()) === '미술 준비물: 색연필\n점검알림 동의서 제출'), `📥 불러오기 = 수업 칸 준비물 + 일정 (${JSON.stringify(await ntext.inputValue())})`);
  await np.locator(sel('notice-draft')).click();
  r.check(await waitFor(page.locator(sel('toast')).filter({ hasText: '이미 모두 적혀' })), '다시 누르면 이미 적힌 것은 더하지 않는다');
  await ntext.press('Control+End');
  await ntext.type('\n3) 우유 가져오기');
  r.check((await np.locator('[data-notice-preview]').getAttribute('data-notice-preview')) === '3', '미리 보기 셋 (번호는 떼고 다시 붙인다)');
  await np.locator(sel('notice-copy')).click();
  const clip = await page.evaluate(() => navigator.clipboard.readText()).catch(() => '');
  r.check(clip === '[4/7(수) 알림장]\n1. 미술 준비물: 색연필\n2. 점검알림 동의서 제출\n3. 우유 가져오기', `📋 복사 = 날짜 머리 + 번호 (${JSON.stringify(clip)})`);
  await page.keyboard.press('Control+s');
  let n1 = await serverUntil(() => notice(N1), (d) => (d?.lines?.length ?? 0) === 3);
  r.check(JSON.stringify(n1?.lines) === JSON.stringify(['미술 준비물: 색연필', '점검알림 동의서 제출', '우유 가져오기']) && n1?.date === N1, `Ctrl+S = notices/${N1} 줄 셋`);
  r.check(await waitFor(async () => !(await np.locator(sel('notice-dirty')).isVisible())), '저장하면 표시가 사라진다');

  r.section('날짜 옮기기·다른 기기');
  await np.locator(sel('notice-next')).click();
  r.check(await waitFor(async () => (await ntext.inputValue()) === ''), '다음 날은 빈 알림장');
  await ntext.fill('점검 다음 날');
  await np.locator(sel('notice-prev')).click();
  const n2 = await serverUntil(() => notice(N2), (d) => d?.lines?.[0] === '점검 다음 날');
  r.check(n2?.lines?.[0] === '점검 다음 날', '적던 것은 옮기기 전 그 날에 저장한다');
  await updateDoc(ref('notices', N1), { lines: ['다른 기기에서 고침'], updatedAt: serverTimestamp() });
  r.check(await waitFor(async () => (await ntext.inputValue()) === '다른 기기에서 고침', 8000), '다른 기기에서 고친 것이 따라온다');

  r.section('📚 모아 보기');
  await np.locator(sel('notice-tab', 'list')).click();
  r.check(await waitFor(np.locator(sel('notice-day', N2))), '4월 알림장');
  r.check((await np.locator('[data-notice-count]').getAttribute('data-notice-count')) === '2', '이틀');
  await np.locator(sel('notice-open', N2)).click();
  r.check(await waitFor(async () => (await np.getAttribute('data-notice-date')) === N2 && (await ntext.isVisible())), '날짜를 누르면 그날 쓰기');
  await np.locator(sel('close')).click();
  await page.goto(page.url().split('#')[0] + '#/class');
  await page.locator(sel('class-tool', 'notices')).click();
  r.check(await waitFor(async () => (await np.getAttribute('data-notice-date').catch(() => null)) === TODAY, 8000), '학급 도구 카드 📢 = 오늘 쓰기');
  await np.locator(sel('close')).click();
  await page.evaluate(() => window.sp5.runShortcut('notices'));
  r.check(await waitFor(np.locator(sel('notice-range'))), "단축키 '알림장 모아 보기' = 모아 보기");
  await np.locator(sel('close')).click();
  r.check(errors.length === 0, '화면 오류 없음', errors.join(' | '));

  // ── 3) 기록 칸 카드 ──
  r.section('기록 칸의 출결·알림장 카드');
  await page.goto(page.url().split('#')[0] + `#/day/${TODAY}`);
  const attCard = page.locator(sel('day-card-key', `attendance:${CLASS_ID}:${TODAY}`));
  r.check(await waitFor(attCard, 8000), `오늘 기록 칸에 '📋 출결 5-2' 카드 (저장하지 않고 계산)`);
  const attText = await attCard.textContent();
  r.check(attText.includes('2번 이두리 결석') && attText.includes('3번 박세나 조퇴') && attText.includes('1번 김하나 결과'), `출석부의 학생 셋 (${attText.replace(/\s+/g, ' ')})`);
  const itemsBefore = (await getDocs(collection(em.db, 'spaces', sid, 'items'))).docs.filter((d) => String(d.data().text ?? '').includes('[출결]')).length;
  r.check(itemsBefore === 0, '기록 항목은 만들지 않는다 (V4의 자동 기록 사본 없음)');
  await attCard.click();
  r.check(await waitFor(panel, 8000), '카드를 누르면 출석부 (그 학급·날)');
  await panel.locator(sel('close')).click();
  await page.goto(page.url().split('#')[0] + `#/day/${N1}`);
  const noticeCard = page.locator(sel('day-card-key', `notice:${N1}`));
  r.check(await waitFor(noticeCard, 8000), "4/7 기록 칸에 '📢 알림장' 카드");
  r.check((await noticeCard.textContent()).includes('1. 다른 기기에서 고침'), '번호 붙인 줄');
  await noticeCard.click();
  r.check(await waitFor(async () => (await np.getAttribute('data-notice-date').catch(() => null)) === N1, 8000), '카드를 누르면 그날 알림장 칸');
  await np.locator(sel('close')).click();
  await page.evaluate(([s0, d]) => window.sp5.openWindow('dayNotes', { sid: s0, date: d }), [sid, N1]);
  r.check(await waitFor(page.locator(`[data-day-notes="${N1}"] [data-day-card="notice"]`)), '그날 기록 창(📝)에도 알림장 카드');
  await page.evaluate(() => window.sp5.closeAllWindows());

  r.section('검색');
  await page.goto(page.url().split('#')[0] + `#/day/${TODAY}`);
  await page.locator('[data-header-search]').click();
  await page.locator('[data-search-input]').fill('다른 기기에서');
  const hit = page.locator(sel('search-hit', `notice:${N1}`));
  r.check(await waitFor(hit, 8000), "검색 '기록'에 알림장 카드");
  await hit.click();
  r.check(await waitFor(async () => (await np.getAttribute('data-notice-date').catch(() => null)) === N1, 8000), '누르면 그날 알림장 칸');
  r.check(page.url().includes(`#/day/${N1}`), '하루 화면도 그날로');
  // 알림장 칸이 탭으로 앞에 왔다 - 검색 탭을 다시 보인다
  await page.locator('[data-header-search]').click();
  await page.locator('[data-search-input]').fill('박세나 조퇴');
  r.check(await waitFor(page.locator(sel('search-hit', `attendance:${CLASS_ID}:${TODAY}`))), '출결 카드도 찾는다');
  r.check(errors.length === 0, '화면 오류 없음', errors.join(' | '));

  // ── 4) 교과 출결 (교과 전담 teacher3) ──
  const em3 = emulator('inspect3');
  const uid3 = await em3.signIn('teacher3@example.com');
  const sid3 = `u_${uid3}`;
  const ref3 = (c, id) => doc(em3.db, 'spaces', sid3, c, id);
  const C3 = `${year}-5-1`;
  const D3 = `${year}-11-04`;
  const before3 = (await getDocs(collection(em3.db, 'spaces', sid3, 'classes'))).docs.map((d) => [d.id, d.data()]);
  for (const [id] of before3) await deleteDoc(ref3('classes', id));
  undo.add(async () => {
    for (const d of (await getDocs(collection(em3.db, 'spaces', sid3, 'classes'))).docs) await deleteDoc(d.ref);
    for (const [id, data] of before3) await setDoc(ref3('classes', id), data);
  });
  await setDoc(ref3('classes', C3), {
    year,
    grade: 5,
    num: 1,
    students: [st('t1', 1, '가람'), st('t2', 2, '나래'), st('t3', 3, '다솜')],
    authorId: uid3,
    deletedAt: null,
    updatedAt: serverTimestamp(),
    v: 1,
    createdAt: Date.now(),
  });
  const ld = await getDoc(ref3('lessonDays', D3));
  undo.add(async () => (ld.exists() ? setDoc(ref3('lessonDays', D3), ld.data()) : deleteDoc(ref3('lessonDays', D3))));
  await setDoc(ref3('lessonDays', D3), { periods: { '3': { subject: '5-1 과학' }, '5': { subject: '5-1 과학' } }, updatedAt: serverTimestamp(), v: 1 });
  undo.add(async () => deleteDoc(ref3('subjectAttendance', `${C3}_${D3}`)));
  const sa = async () => {
    const s0 = await getDoc(ref3('subjectAttendance', `${C3}_${D3}`));
    return s0.exists() ? s0.data() : null;
  };
  const p3 = await newPage(browser);
  const page3 = p3.page;
  const cell = (n) => page3.locator(sel('subject-att-panel', `${C3}_${D3}#${n}`));
  const srow = (n, s0) => cell(n).locator(sel('subject-att-row', s0));

  r.section('🙋 교과 출결 (전담)');
  await open(page3, `#/day/${D3}`, { as: 3 });
  const chip3 = page3.locator(sel('subject-attendance', 3));
  r.check(await waitFor(chip3, 8000), "교시 카드 '5-1 과학'에 🙋 출결");
  await chip3.click();
  r.check(await waitFor(cell(3), 8000), '🙋 = 그 반·그 교시 칸');
  r.check((await cell(3).locator('[data-subject-att-title]').textContent()).includes('5-1') && (await cell(3).locator('[data-subject-att-title]').textContent()).includes('과학'), '머리줄 5-1 · 3교시 · 과학');
  await srow(3, 't1').locator(sel('subject-att-kind', 'absent')).click();
  let d3 = await serverUntil(sa, (d) => d?.periods?.['3']?.t1?.kind === 'absent');
  r.check(same(d3?.periods?.['3']?.t1, { kind: 'absent', reason: 'sick' }) && d3?.classId === C3, '누르는 대로 바로 저장 = periods.3.t1 결과(질병)');
  await srow(3, 't1').locator(sel('subject-att-reason', 'other')).click();
  await srow(3, 't1').locator(sel('subject-att-note-open')).click();
  await srow(3, 't1').locator(sel('subject-att-note')).fill('보건실');
  await srow(3, 't1').locator(sel('subject-att-note')).press('Enter');
  d3 = await serverUntil(sa, (d) => d?.periods?.['3']?.t1?.note === '보건실');
  r.check(same(d3?.periods?.['3']?.t1, { kind: 'absent', reason: 'other', note: '보건실' }), '사유 기타 · 보건실 (Enter)');
  await srow(3, 't2').locator(sel('subject-att-kind', 'early')).click();
  d3 = await serverUntil(sa, (d) => d?.periods?.['3']?.t2?.kind === 'early');
  r.check(d3?.periods?.['3']?.t2?.kind === 'early' && d3?.periods?.['3']?.t1?.note === '보건실', 't2 조퇴 - t1은 그대로 (학생 한 칸만)');
  r.check(await waitFor(async () => ((await page3.locator(sel('subject-attendance', 3)).textContent()) ?? '').includes('결과 1 · 조퇴 1')), "교시 카드 칩 '결과 1 · 조퇴 1'");

  // 다른 교시 칸을 함께 열어도 서로 덮지 않는다
  await page3.locator(sel('subject-attendance', 5)).click();
  r.check(await waitFor(cell(5), 8000), '5교시 칸');
  await srow(5, 't3').locator(sel('subject-att-kind', 'late')).click();
  d3 = await serverUntil(sa, (d) => d?.periods?.['5']?.t3?.kind === 'late');
  r.check(d3?.periods?.['5']?.t3?.kind === 'late' && d3?.periods?.['3']?.t2?.kind === 'early', '5교시 t3 지각 - 3교시 것은 그대로');
  await srow(5, 't3').locator(sel('subject-att-kind', 'present')).click();
  d3 = await serverUntil(sa, (d) => !d?.periods?.['5']?.t3);
  r.check(!d3?.periods?.['5']?.t3, '출석으로 = 그 칸 지우기');

  r.section('📊 교과 출결 누계');
  await cell(5).locator(sel('subject-att-open-summary')).click();
  const sum = page3.locator(sel('subject-summary', C3));
  r.check(await waitFor(sum, 8000), '📊 누계 = 그 반');
  await sum.locator(sel('summary-range', 'year')).click();
  r.check((await sum.locator(sel('summary-row', 't1')).locator('[data-summary-absent]').textContent()) === '1', '가람 결과 1');
  r.check((await sum.locator(sel('summary-row', 't2')).locator('[data-summary-early]').textContent()) === '1', '나래 조퇴 1');
  await sum.locator(sel('summary-row', 't1')).click();
  r.check(await waitFor(sum.locator(sel('summary-history', 't1'))), '학생을 누르면 날짜·교시 내역');
  r.check((await sum.locator(sel('summary-history', 't1')).textContent()).includes('3교시 결과(기타) - 보건실'), '3교시 결과(기타) - 보건실');
  await page3.evaluate(() => window.sp5.closeAllWindows());
  await page3.goto(page3.url().split('#')[0] + '#/class');
  const tool3 = page3.locator(sel('class-tool', 'subjectAttendance'));
  r.check(await waitFor(tool3, 8000), '전담 학급 도구에 교과 출결');
  r.check(!(await page3.locator(sel('class-tool', 'attendance')).count()) && !(await page3.locator('[data-class-today]').count()), '전담은 출석부·오늘 출결 줄이 없다');
  await tool3.click();
  r.check(await waitFor(sum, 8000), '도구 카드 = 그 반 누계');
  r.check(p3.errors.length === 0, '화면 오류 없음', p3.errors.join(' | '));
} catch (e) {
  r.bad(`점검이 멈췄다: ${e?.stack ?? e}`);
} finally {
  await undo.run();
  await browser.close();
  r.done();
  process.exit();
}
