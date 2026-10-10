// tools/inspect-import-class.mjs - P7-5 ■3: V4 학급 가져오기를 실제 크롬에서 본다
// (끝 조건: 학급 화면·출석부·조사표·자리표·알림장·학생 기록이 V4와 같다 · 두 번째는 바뀐 것 0 · V5에서 고친 것은 그대로).
//   1) 점검용 V4 문서(teacher - V4 seed에는 명렬표가 없다): 2027학년도 6학년 3반 명렬표·출석부·교과 출결·알림장·조사표·자리표·모둠·암기·관찰 문구·'#27060301' 기록
//   2) 환경설정 '가져오기' → 결과 표(학급 줄 여덟)
//   3) 서버: 학생 sid로 이어졌나 (출결·조사표·자리표·모둠·암기·학생 태그)
//   4) 화면: 학급 화면 명단 · 출석부 = 지각 · 조사표 값 · 자리표 이름 · 알림장 줄 · 학생 기록(기록·조사표·출결이 그 학생에)
//   5) 두 번째 가져오기는 바뀐 것 0, V5에서 고친 출석부는 V4가 바뀌어도 둔다
//
//   npm run emu · V4 저장소 npm run seed · npm run seed · npm run dev:emu (켜 둔다) → node tools/inspect-import-class.mjs
// teacher 계정 - 끝에 V5 문서를 처음대로(가져오기가 건드리는 컬렉션 모두), 심은 V4 문서는 지우거나 되돌린다.
import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore';
import { emulator, launch, newPage, open, report, restorer, sel, waitFor } from './lib/probe.mjs';

const r = report();
const em = emulator();
const uid = await em.signIn('teacher@example.com');
const sid = `u_${uid}`;
const undo = restorer();
const browser = await launch();

const v5Coll = (c) => collection(em.db, 'spaces', sid, c);
const snapDocs = async (ref) => Object.fromEntries((await getDocs(ref)).docs.map((d) => [d.id, d.data()]));

async function restoreColl(ref, before) {
  const now = await getDocs(ref);
  let b = writeBatch(em.db);
  let n = 0;
  const put = async (fn) => {
    fn(b);
    if (++n % 400 === 0) {
      await b.commit();
      b = writeBatch(em.db);
    }
  };
  for (const d of now.docs) {
    if (!before[d.id]) await put((w) => w.delete(d.ref));
    else if (JSON.stringify(d.data()) !== JSON.stringify(before[d.id])) await put((w) => w.set(d.ref, { ...before[d.id], updatedAt: serverTimestamp() }));
  }
  for (const [id, data] of Object.entries(before)) if (!now.docs.some((d) => d.id === id)) await put((w) => w.set(doc(ref, id), data));
  await b.commit();
}

const KEY = '2027_6_3';
const C = '2027-6-3';
const DAY = '2027-03-08';
const ROSTER = { year: 2027, grade: '6', classNum: '3', students: [
  { num: 1, name: '김하나', gender: 'F', isActive: true, note: '' },
  { num: 2, name: '이둘', gender: 'M', isActive: true, note: '안경' },
  { num: 3, name: '박셋', gender: 'M', isActive: false, note: '' },
] };
const EVAL = {
  id: 'eval_insp',
  title: '점검 단원평가',
  subject: '수학',
  type: 'eval',
  methodObj: { indiv: true, group: false },
  steps: ['잘함', '보통', '노력요함'],
  groups: [],
  dateStr: DAY,
  periodStr: 2,
  context: { source: 'schedule', period: 2 },
  rosterMeta: { year: 2027, grade: '6', classNum: '3' },
  studentsSnapshot: [{ num: 1, name: '김하나', gender: 'F' }, { num: 2, name: '이둘', gender: 'M' }, { num: 3, name: '박셋 (전출/삭제됨)', gender: 'M' }],
  records: { 1: { indivScore: '잘함', reason: '식을 세움' }, 3: { indivScore: '보통' } },
};
const CLASS_COLLS = ['classes', 'attendance', 'subjectAttendance', 'notices', 'evaluations', 'seating', 'classHub', 'quiz'];

try {
  const before = {};
  const V5 = ['items', 'series', 'labels', 'settings', 'timetables', 'lessonDays', 'progress', ...CLASS_COLLS];
  for (const c of V5) before[c] = await snapDocs(v5Coll(c));
  undo.add(async () => {
    for (const c of V5) await restoreColl(v5Coll(c), before[c]);
  });
  // 학급 컬렉션은 비우고 시작한다 (다른 점검이 남긴 학급이 학급 화면 첫 학급이 되지 않게 - 끝에 되돌린다)
  for (const c of CLASS_COLLS) for (const d of (await getDocs(v5Coll(c))).docs) await deleteDoc(d.ref);
  const plant = async (path, data) => {
    const ref = doc(em.db, 'users', uid, ...path);
    const old = await getDoc(ref);
    await setDoc(ref, data);
    undo.add(() => (old.exists() ? setDoc(ref, old.data()) : deleteDoc(ref)));
  };
  await plant(['settings', 'rosters'], { classList: [ROSTER], rosters: [ROSTER], updatedAt: 1 });
  await plant(['attendance', `${KEY}_${DAY}`], { classKey: KEY, year: 2027, grade: '6', classNum: '3', date: DAY, records: { 2: { num: 2, name: '이둘', kind: 'late', reason: 'sick', periods: [1] } } });
  await plant(['v4_subjectAttendance', `${KEY}_${DAY}`], { classKey: KEY, year: 2027, grade: '6', classNum: '3', date: DAY, periods: { 3: { 1: { num: 1, name: '김하나', kind: 'absent', reason: 'other', note: '체험' } } } });
  await plant(['notices', DAY], { date: DAY, lines: ['점검 색연필', '점검 체육복'] });
  await plant(['evaluations', DAY], { list: [EVAL], evalList: [EVAL] });
  await plant(['v4_seating', 'st_insp'], { id: 'st_insp', classKey: KEY, name: '점검 자리', rows: 2, cols: 2, groupCols: 2, front: 'top', seats: { '0-0': 1, '0-1': 2 }, off: [], locked: [], history: [] });
  await plant(['v4_classHub', KEY], { apart: ['1-2'], groupSets: { g1: { name: '점검 모둠', groups: [{ name: '1모둠', members: [1, 2] }], createdAt: 1, updatedAt: 1 } } });
  await plant(['settings', 'photoQuiz'], { records: { '2027-6-3-이둘': { o: 2, x: 1, streak: 2 } } });
  await plant(['settings', 'v4_observationPhrases'], { phrases: ['점검 문구', '발표를 잘함'] });
  await plant(['journals', DAY], { entries: [{ id: 'j_insp', content: '#27060301 발표를 칭찬' }] });

  const { page, errors } = await newPage(browser);
  await open(page, `#/day/${DAY}`);

  r.section('가져오기 → 결과 표');
  await page.evaluate(() => window.sp5.openWindow('settings', { tab: 'import' }));
  await page.locator(sel('import-run')).click();
  r.check(await waitFor(page.locator(sel('import-result')), 120000), '결과 표가 나온다');
  const count = async (row, col) => Number(await page.locator(`${sel('import-row', row)} ${sel('import-count', col)}`).textContent());
  for (const k of CLASS_COLLS) r.check((await count(k, 'added')) === 1, `${k} 1 (${await count(k, 'added')})`);

  r.section('서버 - 학생 sid로 이어졌나');
  const cls = (await getDoc(doc(em.db, 'spaces', sid, 'classes', C))).data();
  const sids = Object.fromEntries((cls?.students ?? []).map((s) => [s.num, s.sid]));
  r.check(cls?.students?.length === 3 && cls.students[1].note === '안경' && cls.students[2].status === 'out' && cls.students[1].gender === 'M', '학급 = 학생 셋 (특이사항·전출·성별)');
  const att = (await getDoc(doc(em.db, 'spaces', sid, 'attendance', `${C}_${DAY}`))).data();
  r.check(JSON.stringify(att?.records) === JSON.stringify({ [sids[2]]: { kind: 'late', reason: 'sick', periods: [1] } }), '출석부 = 2번 sid 지각 1교시');
  const sub = (await getDoc(doc(em.db, 'spaces', sid, 'subjectAttendance', `${C}_${DAY}`))).data();
  r.check(sub?.periods?.['3']?.[sids[1]]?.kind === 'absent', '교과 출결 = 3교시 1번 sid 결석');
  const evals = Object.entries(await snapDocs(v5Coll('evaluations')));
  const [evalId, ev] = evals[0] ?? [];
  r.check(ev?.period === 2 && ev.values?.[sids[1]]?.indiv === '잘함' && ev.students?.find((s) => s.num === 3)?.out === true, '조사표 = 2교시·1번 잘함·3번 전출 표시');
  const seat = Object.values(await snapDocs(v5Coll('seating')))[0];
  r.check(seat?.seats?.['0-0'] === sids[1] && seat.seats['0-1'] === sids[2], '자리표 = 번호 → sid');
  const hub = (await getDoc(doc(em.db, 'spaces', sid, 'classHub', C))).data();
  r.check(hub?.groupSets?.g1?.groups?.[0]?.members?.join() === [sids[1], sids[2]].join() && hub.apart?.length === 1, '모둠·떨어뜨릴 학생 = sid');
  r.check((await getDoc(doc(em.db, 'spaces', sid, 'quiz', C))).data()?.records?.[sids[2]]?.o === 2, '암기 성적 = 이름 → 2번 sid');
  const tagged = Object.values(await snapDocs(v5Coll('items'))).find((i) => i.text === '#27060301 발표를 칭찬');
  r.check(JSON.stringify(tagged?.studentIds) === JSON.stringify([`${C}/${sids[1]}`]), "기록의 '#27060301' → 학생 칩 (글은 그대로)");
  const common = (await getDoc(doc(em.db, 'spaces', sid, 'settings', 'common'))).data() ?? {};
  r.check(JSON.stringify(common.phrases) === JSON.stringify(['점검 문구', '발표를 잘함']), '관찰 문구 = 계정 설정');

  r.section('화면');
  await page.keyboard.press('Escape');
  await open(page, '#/class');
  r.check(await waitFor(async () => (await page.locator(sel('class-student')).count()) >= 2, 8000), '학급 화면 = 가져온 학급 명단');
  await page.evaluate(([d, c]) => window.sp5.openWindow('attendance', { date: d, classId: c }), [DAY, C]);
  const row2 = page.locator(`${sel('attendance-panel', C)} ${sel('attendance-row', sids[2])}`);
  r.check(await waitFor(row2, 8000), '출석부 = 그 학급');
  r.check((await row2.locator(sel('attendance-kind', 'late')).getAttribute('aria-pressed')) === 'true', '출석부 2번 = 지각');
  await page.keyboard.press('Escape');
  await page.evaluate(([s, d, e]) => window.sp5.openWindow('evaluation', { sid: s, date: d, evalId: e, at: Date.now() }), [sid, DAY, evalId]);
  const evRow = page.locator(`${sel('eval-view', evalId)} ${sel('eval-row', sids[1])}`);
  r.check(await waitFor(evRow, 8000), '조사표 창');
  r.check((await evRow.locator('[data-eval-indiv-score]').inputValue()) === '잘함', '1번 = 잘함');
  r.check(await waitFor(page.locator(`${sel('eval-view', evalId)} ${sel('eval-row', sids[3])}`)), '전출 학생도 줄이 있다');
  await page.evaluate(() => window.sp5.closeAllWindows());
  await page.evaluate((c) => window.sp5.openWindow('seating', { classId: c }), C);
  const seat00 = page.locator(`${sel('seat', '0-0')}[data-seat-sid="${sids[1]}"]`);
  r.check(await waitFor(seat00, 8000), '자리표 0-0 = 1번');
  r.check(((await seat00.textContent()) ?? '').includes('김하나'), '자리에 이름');
  await page.evaluate(() => window.sp5.closeAllWindows());
  await page.evaluate(([s, d]) => window.sp5.openWindow('notices', { sid: s, date: d, tab: 'list' }), [sid, DAY]);
  r.check(await waitFor(page.locator(sel('notice-day', DAY)), 8000), '알림장 모아 보기에 그날');
  r.check(((await page.locator(sel('notice-day', DAY)).textContent()) ?? '').includes('점검 체육복'), '알림장 줄');
  await page.evaluate(() => window.sp5.closeAllWindows());
  await page.evaluate(([c, s]) => window.sp5.openWindow('studentRecord', { classId: c, sid: s }), [C, sids[1]]);
  const rec = page.locator(sel('student-record', C));
  r.check(await waitFor(rec.locator(sel('student-card', sids[1])), 8000), '학생 기록 = 1번 김하나');
  r.check((await rec.locator('[data-student-counts]').getAttribute('data-student-counts')) === '1|1', '기록 1(태그) · 조사표 1');
  await page.evaluate(() => window.sp5.closeAllWindows());

  r.section('두 번째 가져오기 · V5에서 고친 출석부');
  const attRef = doc(em.db, 'spaces', sid, 'attendance', `${C}_${DAY}`);
  await setDoc(attRef, { ...(await getDoc(attRef)).data(), records: { [sids[2]]: { kind: 'absent', reason: 'sick' } }, updatedAt: serverTimestamp() });
  await setDoc(doc(em.db, 'users', uid, 'attendance', `${KEY}_${DAY}`), { classKey: KEY, date: DAY, records: { 2: { num: 2, name: '이둘', kind: 'early', reason: 'sick', periods: [5] } } });
  const stamp = async () => {
    const out = {};
    for (const c of CLASS_COLLS) for (const [id, d] of Object.entries(await snapDocs(v5Coll(c)))) out[`${c}/${id}`] = d.updatedAt?.toMillis?.() ?? 0;
    return out;
  };
  const s1 = await stamp();
  await page.evaluate(() => window.sp5.openWindow('settings', { tab: 'import' }));
  await page.locator(sel('import-run')).click();
  r.check(await waitFor(async () => (await page.locator(sel('import-run')).textContent()).includes('다시 가져오기') && (await page.locator(sel('import-progress')).count()) === 0, 120000), '두 번째 가져오기 끝');
  await waitFor(page.locator(sel('import-result')), 5000);
  let ch = 0;
  for (const k of CLASS_COLLS) ch += (await count(k, 'added')) + (await count(k, 'changed')) + (await count(k, 'removed'));
  r.check(ch === 0, `학급 줄 바뀐 것 0 (${ch})`);
  r.check((await count('attendance', 'kept')) === 1, 'V5에서 고친 출석부는 둠');
  const s2 = await stamp();
  r.check(Object.keys(s2).filter((id) => s1[id] !== s2[id]).length === 0, '학급 문서를 다시 쓰지 않는다');
  r.check((await getDoc(attRef)).data().records[sids[2]].kind === 'absent', 'V5에서 고친 결석이 그대로');
  r.check(errors.length === 0, `화면 오류 없음 ${errors.join(' | ')}`);
} catch (e) {
  r.bad(`점검이 멈췄다: ${e?.stack ?? e}`);
} finally {
  await browser.close();
  await undo.run();
  r.done();
  process.exit();
}
