// tools/inspect-class.mjs - P7-1 ■1·■2: 학급(명렬표)·학급 화면을 실제 크롬에서 본다.
//   1) 학급이 없으면 '명렬표 만들기' → 학급 편집(학년·반) → + 학생 추가 → 이름·성별·전출 → 💾 저장 = classes/{학년도-학년-반} 문서 하나(학생 sid)
//   2) 저장 안 한 표시·Ctrl+S·화면을 떠났다 와도 고치던 것 · + 새 학급 추가(같은 학년의 빈 반) · 고르기 세 칸
//   3) 검색 탭(초성) → 관리 탭의 그 줄 · CSV(학급 하나 내려받기/올리기 - 이름이 같으면 sid를 잇는다, 전체 학급 내려받기)
//   4) 학급 삭제 = 지운 표시(휴지통) · 안내의 되돌리기
//   5) 학급 도구: 학급 고르기(이 기기에 남는다)·도구 카드(담임 7 / 전담 6)·학생 명단·단축키 '명렬표', 전담(teacher3)은 학년별 반 칩
//
//   npm run emu · npm run dev:emu (켜 둔다) → npm run seed → node tools/inspect-class.mjs
// 에뮬레이터 teacher·teacher3의 classes를 비우고 끝에 되돌린다.
import { readFileSync } from 'node:fs';
import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';
import { emulator, launch, newPage, open, report, restorer, sel, serverUntil, waitFor } from './lib/probe.mjs';

const r = report();
const undo = restorer();
const em = emulator();
const uid = await em.signIn('teacher@example.com');
const em3 = emulator('inspect3');
const uid3 = await em3.signIn('teacher3@example.com');
const browser = await launch();
const space = (db, u) => ({ ref: (c, id) => doc(db, 'spaces', `u_${u}`, c, id), coll: (c) => collection(db, 'spaces', `u_${u}`, c) });
const A = space(em.db, uid);
const B = space(em3.db, uid3);
const read = async (ref) => {
  const s = await getDoc(ref);
  return s.exists() ? s.data() : null;
};
async function clearAndKeep(S, coll) {
  const before = (await getDocs(S.coll(coll))).docs.map((d) => [d.id, d.data()]);
  for (const [id] of before) await deleteDoc(S.ref(coll, id));
  undo.add(async () => {
    for (const d of (await getDocs(S.coll(coll))).docs) await deleteDoc(d.ref);
    for (const [id, data] of before) await setDoc(S.ref(coll, id), data);
  });
}
const year = (() => {
  const d = new Date();
  return d.getMonth() + 1 >= 3 ? d.getFullYear() : d.getFullYear() - 1;
})();

try {
  await clearAndKeep(A, 'classes');
  await clearAndKeep(B, 'classes');
  const tracked = { deletedAt: null, updatedAt: serverTimestamp(), v: 1, createdAt: Date.now() };
  for (const n of [1, 2]) {
    await setDoc(B.ref('classes', `${year}-5-${n}`), { year, grade: 5, num: n, students: [{ sid: `t3s${n}`, num: 1, name: `전담${n}`, status: 'active' }], authorId: uid3, ...tracked });
  }

  const { page, errors, dialogs } = await newPage(browser);
  dialogs.answer = true;
  const row = (i) => page.locator(sel('roster-row', i));
  const field = (i, f) => row(i).locator(`[data-student-field="${f}"]`);
  /** 학급 편집 칸을 편다 (이미 펴져 있으면 그대로) */
  const openEditor = async () => {
    if ((await page.locator(sel('roster-edit')).getAttribute('aria-pressed')) !== 'true') await page.locator(sel('roster-edit')).click();
  };

  r.section('명렬표 만들기');
  await open(page, '#/class');
  r.check(await waitFor(page.locator(sel('class-empty')), 8000), '학급이 없으면 명렬표 만들기 안내');
  await page.locator(sel('class-make-roster')).click();
  r.check(await waitFor(page.locator(sel('roster'))), '명렬표(학급 화면 안)');
  await openEditor();
  await page.locator(sel('roster-meta', 'grade')).fill('5');
  await page.locator(sel('roster-meta', 'num')).fill('2');
  await page.locator(sel('roster-add-count')).fill('3');
  await page.locator(sel('roster-add-students')).click();
  r.check((await page.locator(sel('roster-row')).count()) === 3, '+ 학생 추가 = 3줄 (번호 1~3)');
  for (const [i, name] of ['김하늘', '이바다', '박구름'].entries()) await field(i, 'name').fill(name);
  await field(0, 'gender').selectOption('F');
  await field(2, 'status').selectOption('out');
  r.check(await waitFor(page.locator(sel('roster-dirty'))), '저장하지 않은 것 표시');
  r.check(((await page.locator(sel('roster-count')).textContent()) ?? '').includes('전출 1명'), '총·재학·전출 수');
  // 화면을 떠났다 와도 고치던 것이 남는다
  await page.goto(page.url().replace(/#.*$/, '#/day'));
  await waitFor(page.locator('[data-screen="day"]'), 5000);
  await page.goto(page.url().replace(/#.*$/, '#/class'));
  r.check(await waitFor(async () => (await field(0, 'name').inputValue().catch(() => '')) === '김하늘', 8000), '다른 화면에 갔다 와도 고치던 것이 남는다');
  await field(0, 'name').focus();
  await page.keyboard.press('Control+s');
  const c52 = await serverUntil(() => read(A.ref('classes', `${year}-5-2`)), (d) => d?.students?.length === 3);
  r.check(c52?.year === year && c52.grade === 5 && c52.num === 2, `Ctrl+S = classes/${year}-5-2 문서`);
  r.check(c52?.students?.map((s) => s.name).join(',') === '김하늘,이바다,박구름' && c52.students.every((s) => typeof s.sid === 'string' && s.sid.length >= 10), '학생마다 sid');
  r.check(c52?.students?.[0]?.gender === 'F' && c52.students[2].status === 'out' && !!c52.students[2].outDate && c52.students[1].gender === undefined, '성별·전출(날짜)·빈 칸은 빼고');
  r.check(await waitFor(async () => !(await page.locator(sel('roster-dirty')).count())), '저장하면 표시가 사라진다');
  const sid0 = c52.students[0].sid;

  r.section('새 학급 · 고르기');
  await openEditor();
  await page.locator(sel('roster-add-class')).click();
  r.check((await page.locator(sel('roster-meta', 'num')).inputValue()) === '1', '+ 새 학급 = 같은 학년의 빈 반 (1반 - V4 그대로)');
  await page.locator(sel('roster-add-count')).fill('2');
  await page.locator(sel('roster-add-students')).click();
  await field(0, 'name').fill('최하나');
  await field(1, 'name').fill('정두리');
  await page.locator(sel('roster-save')).click();
  await serverUntil(() => read(A.ref('classes', `${year}-5-1`)), (d) => d?.students?.length === 2);
  r.check(!!(await read(A.ref('classes', `${year}-5-1`))), '두 번째 학급 저장');
  await page.locator(sel('roster-pick', 'num')).selectOption('2');
  r.check(await waitFor(async () => (await field(0, 'name').inputValue()) === '김하늘'), '반 고르기 = 그 학급 명단');

  r.section('검색 · CSV');
  await page.locator(sel('roster-tab', 'search')).click();
  await page.locator(sel('search-pick', 'num')).selectOption('');
  await page.locator(sel('search-name')).fill('ㄱㅎ');
  r.check(await waitFor(page.locator(sel('search-total', 1))), "초성 'ㄱㅎ' = 1명 (김하늘)");
  await page.locator(sel('search-name')).fill('ㅈ');
  r.check(await waitFor(page.locator(sel('search-hit')).first()), '두 학급에서 찾는다');
  await page.locator(sel('search-name')).fill('김하');
  await page.locator(sel('search-hit', sid0)).click();
  r.check(await waitFor(page.locator(`${sel('roster-row')}[data-sid="${sid0}"].bg-blue-50`)), '누르면 관리 탭의 그 줄을 짚는다');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.locator(sel('roster-csv-down')).click()]);
  const csv = readFileSync(await dl.path(), 'utf8').replace(/^﻿/, '');
  r.check(csv.startsWith('번호,이름,성별,상태,특이사항') && csv.includes('1,김하늘,여,재학') && csv.includes('전출'), '↓ CSV = 학급 하나');
  const upload = '번호,이름,성별,상태,특이사항\n1,새학생,남,재학,\n2,김하늘,여,재학,반장\n3,이바다,,재학,\n';
  await page.locator(sel('roster-csv-input')).setInputFiles({ name: 'class.csv', mimeType: 'text/csv', buffer: Buffer.from(`﻿${upload}`, 'utf8') });
  r.check(await waitFor(async () => (await page.locator(sel('roster-row')).count()) === 3 && (await field(0, 'name').inputValue()) === '새학생'), '↑ CSV = 명단 바꾸기 (묻고)');
  await page.locator(sel('roster-save')).click();
  const after = await serverUntil(() => read(A.ref('classes', `${year}-5-2`)), (d) => d?.students?.[0]?.name === '새학생');
  r.check(after?.students?.find((s) => s.name === '김하늘')?.sid === sid0 && after.students.find((s) => s.name === '김하늘')?.note === '반장', '이름이 같은 학생은 sid를 잇는다 (번호가 바뀌어도)');
  const [dl2] = await Promise.all([page.waitForEvent('download'), page.locator(sel('roster-all-csv-down')).click()]);
  const all = readFileSync(await dl2.path(), 'utf8').replace(/^﻿/, '');
  r.check(all.startsWith('학년도,학년,반,번호,이름') && all.includes(`${year},5,1,1,최하나`), '전체 학급 ↓ CSV');

  r.section('학급 삭제 · 되돌리기');
  await page.locator(sel('roster-pick', 'num')).selectOption('1');
  await openEditor();
  await page.locator(sel('roster-delete-class')).click();
  await page.locator(sel('roster-save')).click();
  const gone = await serverUntil(() => read(A.ref('classes', `${year}-5-1`)), (d) => !!d?.deletedAt);
  r.check(!!gone?.deletedAt, '학급 삭제 = 지운 표시 (휴지통)');
  await page.locator(sel('toast')).filter({ hasText: '휴지통에서 되살릴' }).locator('[data-toast-action="되돌리기"]').last().click();
  const back = await serverUntil(() => read(A.ref('classes', `${year}-5-1`)), (d) => d && !d.deletedAt);
  r.check(back && !back.deletedAt, '되돌리기 = 되살린다');

  r.section('학급 도구');
  await page.locator(sel('class-mode', 'hub')).click();
  r.check(await waitFor(page.locator(sel('class-hub'))), '🏫 학급 도구');
  await page.locator(sel('class-pick')).selectOption(`${year}-5-1`);
  r.check(await waitFor(page.locator(sel('class-students', 2))), '학급 고르기 = 그 학급 학생 명단');
  r.check((await page.evaluate(() => localStorage.getItem('sp5-class-hub'))) === `${year}-5-1`, '고른 학급은 이 기기에 남는다');
  r.check((await page.locator(sel('class-tool')).count()) === 7 && !(await page.locator(sel('class-tool', 'subjectAttendance')).count()), '담임 = 도구 카드 7 (교과 출결 빼고)');
  // 아직 옮기지 않은 도구 (자리표 - P7-3에서 창이 생기면 그 세션이 고친다)
  await page.locator(sel('class-tool', 'seating')).click();
  r.check(await waitFor(page.locator(sel('toast')).filter({ hasText: '아직 V5로' })), '아직 없는 도구 = 🚧 안내');
  await page.locator(sel('class-tool', 'roster')).click();
  r.check(await waitFor(page.locator(sel('roster', `${year}-5-1`))), "카드 '명렬표' = 명렬표로 (그 학급)");
  await page.locator(sel('class-mode', 'hub')).click();
  await page.goto(page.url().replace(/#.*$/, '#/day'));
  await page.evaluate(() => window.sp5.runShortcut('roster'));
  r.check(await waitFor(page.locator(sel('roster'))), "단축키 '명렬표' = 학급 화면의 명렬표");
  r.check(errors.length === 0, `화면 오류 없음 ${errors.join(' | ')}`);

  r.section('전담 (teacher3)');
  const { page: p3, errors: e3 } = await newPage(browser);
  await open(p3, '#/class', { as: '3' });
  r.check(await waitFor(p3.locator(sel('class-chip', '5-2')), 8000), '올해 반 = 학년별 반 칩');
  await p3.locator(sel('class-chip', '5-2')).click();
  r.check(await waitFor(p3.locator(`${sel('class-chip', '5-2')}[aria-pressed="true"]`)), '칩 = 그 반 고르기');
  r.check((await p3.locator(sel('class-tool', 'subjectAttendance')).count()) === 1 && !(await p3.locator(sel('class-tool', 'attendance')).count()), '전담 = 교과 출결 있고 출석부 없음');
  r.check(e3.length === 0, `화면 오류 없음 ${e3.join(' | ')}`);
} catch (e) {
  r.bad(`점검이 멈췄다: ${e?.stack ?? e}`);
} finally {
  await browser.close();
  await undo.run();
  r.done();
  process.exit();
}
