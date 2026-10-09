// tools/inspect-evaluations.mjs - P7-4 ■1: 📊 조사표(한 장 = 문서 하나)를 실제 크롬에서 본다.
//   1) 하루 수업 칸 📊 → 그 교시에 새 조사표(학급·교과 기본값) → 서버 문서 하나(명단 = 재학생 sid) · 값 = 바뀐 학생 칸만(Ctrl+S) · 전체 일괄 적용 · 카드 📊1
//   2) 같은 교시에 둘이면 목록 · ⚙️ 기본 정보로 기록 칸으로 옮기기(창이 따라간다) · 기록 칸 머리 📊1 · 주간·월간 📊 n → 그날 목록
//   3) 조별 평가 = 자리표에서 저장한 모둠 · 열 때 명렬표와 맞추기(새 학생) · 지우기 → 휴지통 → 되살리기 · 검색 '조사표'
//   4) 자리표 학생 칸의 '오늘 조사표' = 그 학생 값만 · 교과 전담(teacher3) 교시 카드 반 도구 📊 = 그 반·과목
//
//   npm run emu · npm run dev:emu (켜 둔다) → npm run seed → node tools/inspect-evaluations.mjs
// 에뮬레이터 teacher·teacher3의 classes를 비우고 점검 학급을 심었다가 끝에 되돌린다. 점검 학급의 조사표·자리표·학급 허브·수업 칸은 끝에 지우거나 되돌린다.
import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';
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
const D = `${year}-11-04`;
const MONDAY = (() => {
  const d = new Date(`${D}T00:00:00`);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return ymd(d);
})();
const CLASS_ID = `${year}-5-2`;
const sorted = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sorted(v[k])])) : v);
const same = (a, b) => JSON.stringify(sorted(a)) === JSON.stringify(sorted(b));
const st = (s, num, name, out = false) => ({ sid: s, num, name, status: out ? 'out' : 'active' });
const evalsOf = async (db = em.db, space = sid) => (await getDocs(collection(db, 'spaces', space, 'evaluations'))).docs.map((d) => ({ id: d.id, ...d.data() }));
const liveEvals = async () => (await evalsOf()).filter((e) => e.classId === CLASS_ID && !e.deletedAt);
const evalDoc = async (id) => {
  const s = await getDoc(ref('evaluations', id));
  return s.exists() ? s.data() : null;
};

try {
  // ── 점검 학급·수업 칸 (끝에 되돌린다) ──
  const before = (await getDocs(collection(em.db, 'spaces', sid, 'classes'))).docs.map((d) => [d.id, d.data()]);
  for (const [id] of before) await deleteDoc(ref('classes', id));
  undo.add(async () => {
    for (const d of (await getDocs(collection(em.db, 'spaces', sid, 'classes'))).docs) await deleteDoc(d.ref);
    for (const [id, data] of before) await setDoc(ref('classes', id), data);
  });
  const clean = async () => {
    for (const e of await evalsOf()) if (e.classId === CLASS_ID) await deleteDoc(ref('evaluations', e.id));
    for (const d of (await getDocs(collection(em.db, 'spaces', sid, 'seating'))).docs) if (d.data().classId === CLASS_ID) await deleteDoc(d.ref);
    await deleteDoc(ref('classHub', CLASS_ID));
  };
  await clean();
  undo.add(clean);
  const ld = await getDoc(ref('lessonDays', D));
  undo.add(async () => (ld.exists() ? setDoc(ref('lessonDays', D), ld.data()) : deleteDoc(ref('lessonDays', D))));
  await setDoc(ref('lessonDays', D), { periods: { '3': { subject: '수학' } }, updatedAt: serverTimestamp(), v: 1 });
  const classDoc = (students) => ({ year, grade: 5, num: 2, students, authorId: uid, deletedAt: null, updatedAt: serverTimestamp(), v: 1, createdAt: Date.now() });
  const students = [st('a1', 1, '김하나'), st('a2', 2, '이두리'), st('a3', 3, '박세나'), st('a4', 4, '최네모'), st('a5', 5, '정다섯', true)];
  await setDoc(ref('classes', CLASS_ID), classDoc(students));
  // 자리표 👥 모둠에서 저장한 모둠 (조별 평가가 불러 쓴다)
  await setDoc(ref('classHub', CLASS_ID), {
    groupSets: { g1: { name: '과학 모둠', groups: [{ name: '1모둠', members: ['a1', 'a2'] }, { name: '2모둠', members: ['a3', 'a4', 'a5'] }], createdAt: 1, updatedAt: 1 } },
    updatedAt: serverTimestamp(),
    v: 1,
  });

  const { page, errors, dialogs } = await newPage(browser);
  dialogs.answer = true;
  const win = (place) => page.locator(sel('eval-window', `${D}|${place}`));
  const row = (w, s) => w.locator(sel('eval-row', s));
  // 머리 단추(+ 새 조사표·목록)와 바닥 단추(저장·삭제)는 창 틀(ModalShell)에 있다 - 이 점검은 조사표 창을 하나만 연다

  r.section('📊 새 조사표 (하루 수업 칸)');
  await open(page, `#/day/${D}`);
  const badge3 = page.locator(sel('lesson-evals', 3));
  r.check(await waitFor(badge3, 8000), '교시 카드에 📊 (조사표 관리)');
  await page.locator(sel('lesson-card', 3)).hover();
  await badge3.click();
  const w3 = win('3');
  r.check(await waitFor(w3.locator('[data-eval-create]'), 8000), '조사표가 없으면 새로 만들기 칸');
  r.check((await w3.locator('[data-eval-class]').inputValue()) === CLASS_ID, '적용할 명렬표 = 학급 화면에서 고른 학급(없으면 올해 학급)');
  r.check((await w3.locator('[data-eval-subject]').inputValue()) === '수학' && (await w3.locator('[data-eval-place]').inputValue()) === '3', '교과 = 그 교시 과목 · 위치 = 3교시');
  await w3.locator('[data-eval-title]').fill('1단원 평가');
  await w3.locator('[data-eval-create-submit]').click();
  let list = await serverUntil(liveEvals, (l) => l.length === 1);
  const e1 = list[0];
  r.check(
    e1?.date === D && e1.period === 3 && e1.type === 'eval' && e1.indiv === true && e1.group === false && same(e1.steps, ['우수', '보통', '노력요함']) && e1.subject === '수학',
    '서버 문서 하나 - 날짜·교시·유형·단계·교과',
  );
  r.check(same(e1?.students?.map((s) => s.sid), ['a1', 'a2', 'a3', 'a4']) && same(e1?.values, {}), '명단 = 재학생 sid (전출 빼고) · 값 없음');
  r.check(await waitFor(w3.locator(sel('eval-view', e1.id))), '만든 조사표가 곧바로 열린다');
  await row(w3, 'a1').locator('[data-eval-indiv-score]').selectOption('우수');
  await row(w3, 'a1').locator('[data-eval-text]').fill('식을 세움');
  r.check(await waitFor(page.locator('[data-eval-dirty]')), "적는 동안 '저장 전'");
  await page.keyboard.press('Control+s');
  let d1 = await serverUntil(() => evalDoc(e1.id), (d) => d?.values?.a1?.indiv === '우수');
  r.check(same(d1?.values, { a1: { indiv: '우수', reason: '식을 세움' } }), 'Ctrl+S = 바뀐 학생 칸만 (values.a1)');
  await w3.locator('[data-eval-all-indiv]').selectOption('보통');
  await page.locator('[data-eval-save]').click();
  d1 = await serverUntil(() => evalDoc(e1.id), (d) => d?.values?.a4?.indiv === '보통');
  r.check(same(d1?.values, { a1: { indiv: '보통', reason: '식을 세움' }, a2: { indiv: '보통' }, a3: { indiv: '보통' }, a4: { indiv: '보통' } }), '전체 일괄 적용 = 모두 보통 (사유는 그대로)');
  r.check(await waitFor(async () => (await badge3.getAttribute('data-eval-count')) === '1'), '교시 카드 📊1');

  r.section('목록 · 옮기기 · 달력 📊 n');
  await page.locator('[data-eval-new]').click();
  await w3.locator('[data-eval-title]').fill('준비물');
  await w3.locator(sel('eval-type', 'check')).check();
  await w3.locator('[data-eval-create-submit]').click();
  list = await serverUntil(liveEvals, (l) => l.length === 2);
  const e2 = list.find((e) => e.title === '준비물');
  r.check(e2?.type === 'check' && !('steps' in e2) && e2.period === 3, '체크 조사표 (단계 없음)');
  await w3.locator(sel('eval-all-check', 'o')).click();
  await page.locator('[data-eval-save]').click();
  const d2 = await serverUntil(() => evalDoc(e2.id), (d) => d?.values?.a4?.checked === true);
  r.check(['a1', 'a2', 'a3', 'a4'].every((s) => d2?.values?.[s]?.checked === true), '전체 O');
  await page.evaluate(() => window.sp5.closeAllWindows());
  await badge3.click();
  r.check(await waitFor(async () => (await w3.getAttribute('data-eval-mode')) === 'list'), '한 교시에 둘이면 목록');
  r.check((await w3.locator('[data-eval-item]').count()) === 2, '목록 둘');
  await w3.locator(sel('eval-item', e1.id)).click();
  await w3.locator('[data-eval-meta-toggle]').click();
  await w3.locator('[data-eval-meta-title]').fill('1단원 평가(수정)');
  await w3.locator('[data-eval-meta-place]').selectOption('journal');
  await w3.locator('[data-eval-meta-save]').click();
  d1 = await serverUntil(() => evalDoc(e1.id), (d) => d?.period === null);
  r.check(d1?.period === null && d1.title === '1단원 평가(수정)' && d1.date === D, '기본 정보 = 같은 문서의 제목·자리 (기록 칸으로)');
  r.check(await waitFor(win('journal').locator(sel('eval-view', e1.id))), '창이 기록 칸으로 따라간다');
  r.check(await waitFor(async () => (await page.locator('[data-journal-evals]').getAttribute('data-journal-evals')) === '1'), '기록 칸 머리 📊1');
  r.check(await waitFor(async () => (await badge3.getAttribute('data-eval-count')) === '1'), '교시 카드는 📊1');
  await page.evaluate(() => window.sp5.closeAllWindows());
  await open(page, `#/week/${MONDAY}`);
  const weekBadge = page.locator(sel('week-evals', 2));
  r.check(await waitFor(weekBadge, 8000), '주간 📊 2');
  await weekBadge.click();
  r.check(await waitFor(async () => (await win('').getAttribute('data-eval-mode')) === 'list'), '누르면 그날 전체 목록');
  await page.evaluate(() => window.sp5.closeAllWindows());
  await open(page, `#/month/${D.slice(0, 7)}`);
  r.check(await waitFor(page.locator(sel('month-evals', 2)), 8000), '월간 📊 2');
  // 년간 '자세히'는 일정·공휴일이 있는 날만 줄을 세운다(V4 그대로) - 조사표만 있는 날은 줄이 없어 주간·월간으로 본다

  r.section('조별 · 명렬표 맞추기 · 휴지통 · 검색');
  await open(page, `#/day/${D}`);
  await page.reload();
  await page.locator(sel('lesson-card', 3)).hover();
  await badge3.click();
  await waitFor(w3.locator(sel('eval-view', e2.id)), 8000);
  await page.locator('[data-eval-new]').click();
  await w3.locator('[data-eval-title]').fill('모둠 실험');
  await w3.locator('[data-eval-group]').check();
  await w3.locator('[data-eval-group-set]').selectOption('g1');
  r.check(await waitFor(w3.locator('[data-eval-group-preview]')), '저장한 모둠 미리 보기');
  await w3.locator('[data-eval-create-submit]').click();
  list = await serverUntil(liveEvals, (l) => l.length === 3);
  const e3 = list.find((e) => e.title === '모둠 실험');
  r.check(e3?.group === true && same(e3.groups, [{ name: '1모둠', members: ['a1', 'a2'] }, { name: '2모둠', members: ['a3', 'a4'] }]), '조 = 저장한 모둠 (재학생만)');
  r.check((await row(w3, 'a3').locator('[data-eval-group-name]').inputValue()) === '2모둠', '조 이름이 미리 채워진다');
  // 새 학생이 오면 열 때 명단에 더한다
  await setDoc(ref('classes', CLASS_ID), classDoc([...students, st('a6', 6, '새학생')]));
  const d3 = await serverUntil(() => evalDoc(e3.id), (d) => d?.students?.some((s) => s.sid === 'a6'));
  r.check(d3?.students?.at(-1)?.sid === 'a6', '명렬표에 새 학생 = 열린 조사표 명단에 더한다');
  await page.locator('[data-eval-delete]').click();
  await serverUntil(() => evalDoc(e3.id), (d) => !!d?.deletedAt);
  r.check(!!(await evalDoc(e3.id))?.deletedAt, '삭제 = 지운 표시');
  await page.evaluate(() => window.sp5.openWindow('trash'));
  const trashRow = page.locator(sel('trash-row', `evaluation:${e3.id}`));
  r.check(await waitFor(trashRow, 8000), "휴지통에 '📊 모둠 실험'");
  await trashRow.locator(sel('trash-restore', `evaluation:${e3.id}`)).click();
  r.check(!(await serverUntil(() => evalDoc(e3.id), (d) => !d?.deletedAt))?.deletedAt, '되살리기');
  await page.evaluate(() => window.sp5.closeAllWindows());
  await page.evaluate(() => window.sp5.openWindow('search'));
  await page.locator('[data-search-input]').fill('1단원');
  const hit = page.locator(sel('search-hit', `eval:${e1.id}`));
  r.check(await waitFor(hit, 8000), "검색 '1단원' = 조사표");
  await hit.click();
  r.check(await waitFor(win('journal').locator(sel('eval-view', e1.id)), 8000), '누르면 그 조사표 창');

  r.section('자리표 학생 칸 · 교과 전담 반 도구');
  await page.evaluate(() => window.sp5.closeAllWindows());
  const evToday = ref('evaluations', 'inspectToday');
  undo.add(() => deleteDoc(evToday));
  await setDoc(evToday, {
    date: TODAY,
    period: 2,
    classId: CLASS_ID,
    title: '오늘 평가',
    type: 'eval',
    indiv: true,
    group: false,
    steps: ['잘함', '보통'],
    students: [{ sid: 'a1', num: 1, name: '김하나' }],
    values: {},
    authorId: uid,
    deletedAt: null,
    createdAt: Date.now(),
    updatedAt: serverTimestamp(),
    v: 1,
  });
  await page.evaluate((c) => window.sp5.openWindow('seating', { classId: c }), CLASS_ID);
  const seatWin = page.locator(sel('seating-window', CLASS_ID));
  await waitFor(seatWin.locator('[data-seating-create]'), 8000);
  await seatWin.locator('[data-seating-create]').click();
  await waitFor(seatWin.locator(sel('seat-sid', 'a1')), 8000);
  await seatWin.locator(sel('seat-sid', 'a1')).click();
  const evRow = seatWin.locator(sel('seat-student', 'a1')).locator(sel('seat-eval', 'inspectToday'));
  r.check(await waitFor(evRow, 8000), "학생 칸 '오늘 조사표'에 이 학급 조사표");
  await evRow.locator('[data-seat-eval-indiv]').selectOption('잘함');
  const dt = await serverUntil(async () => (await getDoc(evToday)).data(), (d) => d?.values?.a1?.indiv === '잘함');
  r.check(same(dt?.values, { a1: { indiv: '잘함' } }), '고르면 그 학생 값만 곧바로');
  await page.evaluate(() => window.sp5.closeAllWindows());
  r.check(errors.length === 0, '화면 오류 없음', errors.join(' | '));

  const em3 = emulator('inspect3');
  const uid3 = await em3.signIn('teacher3@example.com');
  const sid3 = `u_${uid3}`;
  const ref3 = (c, id) => doc(em3.db, 'spaces', sid3, c, id);
  const C3 = `${year}-5-1`;
  const before3 = (await getDocs(collection(em3.db, 'spaces', sid3, 'classes'))).docs.map((d) => [d.id, d.data()]);
  for (const [id] of before3) await deleteDoc(ref3('classes', id));
  undo.add(async () => {
    for (const d of (await getDocs(collection(em3.db, 'spaces', sid3, 'classes'))).docs) await deleteDoc(d.ref);
    for (const [id, data] of before3) await setDoc(ref3('classes', id), data);
  });
  await setDoc(ref3('classes', C3), { year, grade: 5, num: 1, students: [st('t1', 1, '가람'), st('t2', 2, '나래')], authorId: uid3, deletedAt: null, updatedAt: serverTimestamp(), v: 1, createdAt: Date.now() });
  const ld3 = await getDoc(ref3('lessonDays', D));
  undo.add(async () => (ld3.exists() ? setDoc(ref3('lessonDays', D), ld3.data()) : deleteDoc(ref3('lessonDays', D))));
  await setDoc(ref3('lessonDays', D), { periods: { '3': { subject: '5-1 과학' } }, updatedAt: serverTimestamp(), v: 1 });
  const p3 = await newPage(browser);
  await open(p3.page, `#/day/${D}`, { as: 3 });
  const tool3 = p3.page.locator(sel('class-tools', C3)).locator(sel('class-tool-btn', 'eval'));
  r.check(await waitFor(tool3, 8000), '교시 카드 반 도구에 📊 조사표');
  await tool3.click();
  const w33 = p3.page.locator(sel('eval-window', `${D}|3`));
  r.check(await waitFor(w33.locator('[data-eval-create]'), 8000), '그 교시 새 조사표');
  r.check((await w33.locator('[data-eval-class]').inputValue()) === C3 && (await w33.locator('[data-eval-subject]').inputValue()) === '과학', "칸 '5-1 과학' = 학급 5-1 · 교과 과학");
  r.check(p3.errors.length === 0, '화면 오류 없음', p3.errors.join(' | '));
} catch (e) {
  r.bad(`점검이 멈췄다: ${e?.stack ?? e}`);
} finally {
  await undo.run();
  await browser.close();
  r.done();
  process.exit();
}
