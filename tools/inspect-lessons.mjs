// tools/inspect-lessons.mjs - P6-1: 시간표(기간별)·수업 칸 계산·하루/주간 수업 칸을 실제 크롬에서 본다.
//   1) 시간표 창: ⚙️ → 탭 넷, 칸 고치기 → 💾 저장 = 문서 하나(grid) → 하루 칸이 '적용' 없이 따라온다, 화살표·Tab 칸 옮기기, 엑셀 붙여넣기,
//      ESC는 저장 안 한 것을 묻는다, + 새 시간표(10/14부터) = 늦게 시작한 것이 이긴다, 교시 이름·시각(빠르게 채우기), 학기·방학, 지우기 = 휴지통.
//   2) 수업 없는 날: 방학·공휴일(한글날)·수업X 일정 - 그날 적은 과목은 남는다.
//   3) 하루 수업 칸: 누르면 그 자리에서 고치기(Ctrl+S·바깥 누르기 = 저장, ESC = 그만두기) → lessonDays 그 칸만, 시간표와 같은 과목은 칸을 뺀다,
//      ▲▼ 맞바꾸기와 되돌리기, 주간 수업 줄 → 'N교시 수정' 칸, 링크(수업 ↔ 일정 양쪽)·📑 보기·끊기, 검색 수업 갈래, '교사 유형을 골라 주세요' 띠,
//      지금 몇 교시(시각을 고정한 새 창).
//   4) 전담(teacher3 ?as=3): 반을 크게·반 색, 학년-반 + 과목 두 칸('502' → '5-2'), 가르치는 반 더하기 → ▼ 목록, 지난 시간 줄.
//
//   npm run emu · npm run dev:emu (켜 둔다) → npm run seed → node tools/inspect-lessons.mjs
// 에뮬레이터 teacher·teacher3 계정의 시간표·수업 칸·점검 일정(insp_le…)을 심고 끝에 지운다. 계정 설정 common은 통째로 되돌린다.
import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';
import { emulator, hashOf, launch, newPage, open, report, restorer, sel, serverUntil, waitFor } from './lib/probe.mjs';

const r = report();
const undo = restorer();
const em = emulator();
const uid = await em.signIn('teacher@example.com');
const em3 = emulator('inspect3');
const uid3 = await em3.signIn('teacher3@example.com');
const browser = await launch();

const startedAt = Date.now();
const space = (db, u) => ({
  ref: (coll, id) => doc(db, 'spaces', `u_${u}`, coll, id),
  coll: (coll) => collection(db, 'spaces', `u_${u}`, coll),
});
const A = space(em.db, uid);
const B = space(em3.db, uid3);
const read = async (ref) => {
  const s = await getDoc(ref);
  return s.exists() ? s.data() : null;
};
const tracked = { deletedAt: null, updatedAt: serverTimestamp(), v: 1, createdAt: startedAt };

/** 컬렉션을 비우고 끝에 그대로 되돌린다 (지난 점검이 남긴 것과 섞이지 않게) */
async function clearAndKeep(S, coll) {
  const before = (await getDocs(S.coll(coll))).docs.map((d) => [d.id, d.data()]);
  for (const [id] of before) await deleteDoc(S.ref(coll, id));
  undo.add(async () => {
    for (const d of (await getDocs(S.coll(coll))).docs) await deleteDoc(d.ref);
    for (const [id, data] of before) await setDoc(S.ref(coll, id), data);
  });
}
/** 계정 설정 common을 통째로 되돌린다 */
async function keepCommon(S) {
  const before = await read(S.ref('settings', 'common'));
  undo.add(async () => {
    if (before) await setDoc(S.ref('settings', 'common'), before);
    else await deleteDoc(S.ref('settings', 'common'));
  });
  return before;
}

try {
  // ── 심기 ──
  for (const S of [A, B]) {
    await clearAndKeep(S, 'timetables');
    await clearAndKeep(S, 'lessonDays');
  }
  const commonA = await keepCommon(A);
  await keepCommon(B);
  // 담임: 월 1·2교시 국어·수학, 화 1교시 영어 (2026 학년도 내내)
  await setDoc(A.ref('timetables', 'insp_tt1'), { name: '점검 1학기', from: '2026-03-01', to: '2027-02-28', grid: { '1': { '1': '국어', '2': '수학', '3': '사회' }, '2': { '1': '영어' } }, authorId: uid, ...tracked });
  // 점검 일정: 링크 상대 + 수업X(10/13 화)
  await setDoc(A.ref('items', 'insp_le1'), { kind: 'event', date: '2026-10-12', text: '점검수업 링크 일정', labelIds: [], order: 'Zz1', authorId: uid, ...tracked });
  undo.add(() => deleteDoc(A.ref('items', 'insp_le1')));
  await setDoc(A.ref('items', 'insp_le2'), { kind: 'event', date: '2026-10-13', text: '점검수업 운동회', labelIds: [], props: { skip: true }, order: 'Zz2', authorId: uid, ...tracked });
  undo.add(() => deleteDoc(A.ref('items', 'insp_le2')));
  // 전담: 월 1교시 5-2 과학, 2교시 창체 / 수 1교시 5-2 과학
  await setDoc(B.ref('timetables', 'insp_tt3'), { name: '점검 전담', from: '2026-03-01', to: '2027-02-28', grid: { '1': { '1': '5-2 과학', '2': '창체' }, '3': { '1': '5-2 과학' } }, authorId: uid3, ...tracked });

  const { page, errors, dialogs } = await newPage(browser);
  const lessonCard = (n) => page.locator(sel('lesson-card', n));
  const subjectOf = async (n) => (await lessonCard(n).locator('[data-lesson-subject]').first().getAttribute('data-lesson-subject')) ?? '';
  const dayDoc = (date) => read(A.ref('lessonDays', date));
  const toastUndo = (text) => page.locator(sel('toast')).filter({ hasText: text }).locator('[data-toast-action="되돌리기"]');
  const win = sel('timetable-window');
  const cellIn = (rc) => page.locator(`${win} input[data-cell="${rc}"]`);
  const go = async (hash) => {
    await page.goto(page.url().replace(/#.*$/, hash));
    await page.waitForFunction((h) => location.hash === h, hash);
  };

  r.section('하루 수업 칸 - 시간표를 따른다');
  await open(page, '#/day/2026-10-12');
  r.check(await waitFor(page.locator(sel('day-lessons', '2026-10-12'))), '하루 화면에 ⏰ 수업 칸');
  r.check(await waitFor(async () => (await subjectOf(1)) === '국어', 8000), '월 1교시 = 시간표의 국어 (계산 - 적용 없이)');
  r.check((await page.locator(sel('lesson-card')).count()) === 6, '교시 수 = 설정의 교시 수(기본 6)');
  r.check((await subjectOf(4)) === '' && (await lessonCard(4).textContent()).includes('과목 미등록'), '시간표에 없는 칸은 비어 있다');
  r.check(!(await page.locator(sel('teacher-mode-banner')).count()), '교사 유형을 고른 계정은 띠가 없다');

  r.section('시간표 창');
  await page.locator(sel('lessons-settings')).click();
  r.check(await waitFor(page.locator(win)), '⚙️ = 시간표 창');
  r.check((await page.locator(`${win} ${sel('timetable-tab')}`).count()) === 4, '탭 넷 (교사 유형·시간표·교시·학기·방학)');
  r.check((await page.locator(sel('timetable-pick', 'insp_tt1')).getAttribute('aria-pressed')) === 'true', '오늘 따르는 시간표가 골라져 있다');
  r.check((await cellIn('0-1').inputValue()) === '국어', '표 칸 = 시간표 (월 1교시)');
  await cellIn('0-1').fill('도덕');
  r.check(await waitFor(page.locator(sel('timetable-dirty'))), '고치면 저장하지 않은 것 표시');
  await page.locator(sel('timetable-save')).click();
  const tt1 = await serverUntil(() => read(A.ref('timetables', 'insp_tt1')), (d) => d?.grid?.['1']?.['1'] === '도덕');
  r.check(tt1?.grid?.['1']?.['1'] === '도덕' && tt1.grid['1']['2'] === '수학', '💾 저장 = 그 시간표 문서의 grid (다른 칸은 그대로)');
  r.check(await waitFor(async () => (await subjectOf(1)) === '도덕', 8000), "'적용' 없이 하루 칸이 따라온다");

  // 칸 옮기기
  await cellIn('0-1').focus();
  await page.keyboard.press('ArrowDown');
  r.check((await page.evaluate(() => document.activeElement?.getAttribute('data-cell'))) === '1-1', '↓ = 아래 칸');
  await page.keyboard.press('Tab');
  r.check((await page.evaluate(() => document.activeElement?.getAttribute('data-cell'))) === '1-2', 'Tab = 옆 칸');
  // 엑셀 붙여넣기
  await cellIn('3-1').focus();
  await page.evaluate(() => {
    const dt = new DataTransfer();
    dt.setData('text/plain', '가\t나\n다\t라\n');
    document.activeElement.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  });
  const pasted = await Promise.all(['3-1', '3-2', '4-1', '4-2'].map((rc) => cellIn(rc).inputValue()));
  r.check(pasted.join('') === '가나다라', `엑셀에서 복사한 표 = 칸마다 (${pasted.join(',')})`);
  // ESC는 저장 안 한 것을 묻는다
  dialogs.answer = false;
  await page.locator(`${win} input[data-cell="3-1"]`).blur();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  r.check(dialogs.seen.length > 0 && (await page.locator(win).count()) === 1, 'ESC = 저장하지 않은 것이 있으면 먼저 묻는다 (아니오면 그대로)');
  // 붙인 것은 버린다 - 칸을 되돌린다
  for (const rc of ['3-1', '3-2', '4-1', '4-2']) await cellIn(rc).fill('');
  r.check(!(await page.locator(sel('timetable-dirty')).count()), '되돌리면 저장할 것이 없다');

  // 새 시간표 (10/14부터) - 늦게 시작한 것이 이긴다
  await page.locator(sel('timetable-add')).click();
  r.check((await page.locator(sel('timetable-pick')).count()) === 2, '+ 새 시간표 = 칩 하나 더 (지금 표를 베낀다)');
  r.check((await cellIn('0-1').inputValue()) === '도덕', '새 시간표는 지금 표를 베낀다');
  await page.locator(sel('timetable-name')).fill('점검 10월 시간표');
  await page.locator(sel('timetable-from')).fill('2026-10-14');
  await cellIn('0-1').fill('음악');
  await page.locator(sel('timetable-save')).click();
  const made = await serverUntil(
    async () => (await getDocs(A.coll('timetables'))).docs.filter((d) => d.data().name === '점검 10월 시간표'),
    (l) => l.length === 1,
  );
  r.check(made.length === 1 && made[0].data().from === '2026-10-14' && made[0].data().grid['1']['1'] === '음악', '새 시간표 = 문서 하나 (10/14부터)');

  // 교시 이름·시각
  await page.locator(sel('timetable-tab', 'periods')).click();
  await page.locator(sel('period-name', 1)).fill('아침');
  await page.locator(sel('period-fill-run')).click();
  r.check((await page.locator(sel('period-start', 2)).inputValue()) === '09:50', '빠르게 채우기 (09:00·40분·쉬는 10분 → 2교시 09:50)');
  // 학기·방학
  await page.locator(sel('timetable-tab', 'terms')).click();
  r.check((await page.locator('[data-terms-year]').getAttribute('data-terms-year')) === '2026', '학기·방학 = 올해 학년도');
  await page.locator(sel('terms', 'summer-from')).fill('2026-07-21');
  await page.locator(sel('terms', 'summer-to')).fill('2026-08-16');
  await page.locator(sel('terms', 'winter-from')).fill('2027-01-05');
  await page.locator(sel('terms', 'winter-to')).fill('2027-02-28');
  r.check((await page.locator(sel('terms-sem2')).textContent()).includes('2026-08-17 ~ 2027-01-04'), '학기는 방학에서 셈한다 (2학기 8/17~1/4)');
  await page.locator(sel('timetable-save')).click();
  const common = await serverUntil(() => read(A.ref('settings', 'common')), (d) => d?.periods?.[0]?.name === '아침' && !!d?.terms?.['2026'], 8000);
  r.check(common?.periods?.[0]?.name === '아침' && common.periods[0].start === '09:00', '교시 = 계정 설정 periods');
  r.check(common?.terms?.['2026']?.summer?.from === '2026-07-21', '방학 = 계정 설정 terms (학년도마다)');
  await page.locator(`[data-popup-frame]:has(${win}) [data-close]`).click();
  r.check(await waitFor(lessonCard(1).filter({ hasText: '아침' })), '하루 칸의 교시 이름이 바뀐다');
  r.check((await lessonCard(1).textContent()).includes('09:00~09:40'), '교시 옆에 시각');

  r.section('기간별 시간표·수업 없는 날');
  await go('#/day/2026-10-19');
  r.check(await waitFor(async () => (await subjectOf(1)) === '음악', 8000), '10/19 = 10/14부터 시간표 (늦게 시작한 것이 이긴다)');
  await go('#/day/2026-07-27');
  r.check(await waitFor(page.locator(sel('lessons-off', 'vacation')), 8000), '방학 = 🏖️ 표시');
  r.check((await subjectOf(1)) === '', '방학에는 시간표 수업이 없다');
  await go('#/day/2026-10-09');
  r.check(await waitFor(page.locator(sel('lessons-off', 'holiday'))), '공휴일(한글날) = 수업 없음');
  r.check((await page.locator(sel('lessons-off')).textContent()).includes('한글날'), '공휴일 이름');
  await go('#/day/2026-10-13');
  r.check(await waitFor(page.locator(sel('lessons-off', 'skip'))), '수업X 일정이 있는 날 = 수업 없음');
  r.check((await subjectOf(1)) === '', '수업X 날의 1교시는 비어 있다');

  r.section('하루 수업 칸 고치기');
  await go('#/day/2026-10-12');
  await waitFor(async () => (await subjectOf(2)) === '수학', 8000);
  await lessonCard(2).click();
  const editor = page.locator(sel('lesson-editor', 2));
  r.check(await waitFor(editor), '교시를 누르면 그 자리에서 고친다');
  await editor.locator(sel('lesson-subject-input')).fill('체육');
  await editor.locator(sel('lesson-supplies-input')).fill('줄넘기');
  await editor.locator(sel('lesson-memo-input')).fill('운동장');
  await page.keyboard.press('Control+s');
  const d1 = await serverUntil(() => dayDoc('2026-10-12'), (d) => d?.periods?.['2']?.subject === '체육');
  r.check(d1?.periods?.['2']?.subject === '체육' && d1.periods['2'].supplies === '줄넘기' && d1.periods['2'].memo === '운동장', 'Ctrl+S = lessonDays/날짜의 그 칸 (과목·준비물·메모)');
  r.check(Object.keys(d1?.periods ?? {}).join() === '2', '다른 교시는 적지 않는다 (시간표를 따른다)');
  r.check(await waitFor(lessonCard(2).locator(sel('lesson-changed'))), "그날만 바꾼 과목은 '✎'");
  r.check((await lessonCard(2).locator(sel('lesson-supplies')).textContent()).includes('줄넘기'), '준비물·메모가 카드에');
  // 시간표로 되돌리면 과목 칸이 빠진다
  await lessonCard(2).click();
  await editor.locator(sel('lesson-subject-input')).fill('수학');
  await editor.locator(sel('lesson-save')).click();
  const d2 = await serverUntil(() => dayDoc('2026-10-12'), (d) => d?.periods?.['2'] && !('subject' in d.periods['2']));
  r.check(d2?.periods?.['2'] && !('subject' in d2.periods['2']) && d2.periods['2'].memo === '운동장', '시간표와 같은 과목 = 과목 칸을 뺀다 (메모는 남는다)');
  // 바깥 누르기 = 저장, ESC = 그만두기
  await lessonCard(3).click();
  await page.locator(sel('lesson-editor', 3)).locator(sel('lesson-memo-input')).fill('지도 그리기');
  await page.locator('[data-day-events] h3').click();
  r.check((await serverUntil(() => dayDoc('2026-10-12'), (d) => d?.periods?.['3']?.memo === '지도 그리기'))?.periods?.['3']?.memo === '지도 그리기', '바깥을 누르면 고친 것을 저장하고 닫는다');
  await lessonCard(3).click();
  await page.locator(sel('lesson-editor', 3)).locator(sel('lesson-memo-input')).fill('버릴 글');
  await page.keyboard.press('Escape');
  r.check(!(await page.locator(sel('lesson-editor')).count()), 'ESC = 저장하지 않고 닫는다');
  r.check((await dayDoc('2026-10-12'))?.periods?.['3']?.memo === '지도 그리기', 'ESC는 서버에 쓰지 않는다');
  // ▲▼ 맞바꾸기
  await lessonCard(2).hover();
  await page.locator(sel('lesson-up', 2)).click();
  r.check(await waitFor(async () => (await subjectOf(1)) === '수학' && (await subjectOf(2)) === '도덕', 8000), '▲ = 위 교시와 맞바꾼다');
  const sw = await serverUntil(() => dayDoc('2026-10-12'), (d) => d?.periods?.['1']?.subject === '수학');
  r.check(sw?.periods?.['1']?.memo === '운동장' && sw?.periods?.['2']?.subject === '도덕' && !sw?.periods?.['2']?.memo, '과목·메모가 함께 옮겨 간다 (저마다 시간표와 견준다)');
  await toastUndo('맞바꿨습니다').click();
  r.check(await waitFor(async () => (await subjectOf(1)) === '도덕' && (await subjectOf(2)) === '수학', 8000), '안내의 되돌리기 = 제자리');

  r.section('주간 수업 줄 · N교시 수정 칸');
  await go('#/week/2026-10-12');
  const weekRow = (d, n) => page.locator(`${sel('week-lessons', d)} ${sel('week-lesson', n)}`);
  r.check(await waitFor(weekRow('2026-10-12', 1), 8000), '요일 카드에 수업 줄');
  r.check((await weekRow('2026-10-12', 1).textContent()).includes('도덕'), '주간 1교시 = 도덕');
  r.check((await page.locator(`${sel('week-lessons', '2026-10-13')} ${sel('week-lesson')}`).count()) === (await page.locator(`${sel('week-lessons', '2026-10-12')} ${sel('week-lesson')}`).count()), '요일끼리 교시 줄 수가 같다');
  await weekRow('2026-10-12', 3).click();
  const panel = page.locator(sel('lesson-panel', 'lesson:2026-10-12:3'));
  r.check(await waitFor(panel), "누르면 'N교시 수정' 칸 (오른쪽)");
  r.check((await panel.locator(sel('lesson-panel-memo')).inputValue()) === '지도 그리기', '칸 = 그 교시의 지금 내용');
  await panel.locator(sel('lesson-panel-supplies')).fill('색연필');
  await panel.locator(sel('lesson-panel-save')).click();
  r.check((await serverUntil(() => dayDoc('2026-10-12'), (d) => d?.periods?.['3']?.supplies === '색연필'))?.periods?.['3']?.supplies === '색연필', '수정 칸 저장 = 그 칸만');
  await panel.locator(sel('lesson-panel-clear')).click();
  const cleared = await serverUntil(() => dayDoc('2026-10-12'), (d) => d?.periods?.['3']?.subject === '');
  r.check(cleared?.periods?.['3']?.subject === '' && !cleared.periods['3'].memo, "삭제 = 그 교시 비우기 (과목 '' = 수업 없음)");
  await toastUndo('비웠습니다').click();
  r.check((await serverUntil(() => dayDoc('2026-10-12'), (d) => d?.periods?.['3']?.memo === '지도 그리기'))?.periods?.['3']?.memo === '지도 그리기', '되돌리기 = 그대로');

  r.section('수업 링크 (양쪽)');
  await go('#/day/2026-10-12');
  await lessonCard(1).hover();
  await page.locator(sel('lesson-link', 1)).click();
  r.check(await waitFor(page.locator(sel('linker', 'lesson:2026-10-12:1'))), '🔗 = 링크 연결 창 (수업에서)');
  r.check(!(await page.locator(sel('linker-tab', 'lesson')).count()), '수업에서 열면 수업 탭은 없다');
  await page.locator(sel('linker-item', 'insp_le1')).click();
  await page.locator(sel('linker-save')).click();
  const linkedDay = await serverUntil(() => dayDoc('2026-10-12'), (d) => d?.periods?.['1']?.linkIds?.includes('insp_le1'));
  const linkedItem = await serverUntil(() => read(A.ref('items', 'insp_le1')), (d) => d?.linkIds?.includes('lesson:2026-10-12:1'));
  r.check(!!linkedDay && !!linkedItem, '잇기 = 수업 칸(lessonDays)과 일정 양쪽');
  r.check(await waitFor(page.locator(sel('lesson-links', 1))), '카드에 📑 1');
  await page.locator(sel('lesson-links', 1)).click();
  r.check(await waitFor(page.locator(`${sel('link-viewer', 'lesson:2026-10-12:1')} ${sel('link-row', 'insp_le1')}`)), '📑 = 이은 일정이 보인다');
  await page.keyboard.press('Escape');
  await page.locator(`${sel('event-card', 'insp_le1')} ${sel('event-links')}`).click();
  const lessonRow = page.locator(`${sel('link-viewer', 'insp_le1')} ${sel('link-row', 'lesson:2026-10-12:1')}`);
  r.check(await waitFor(lessonRow), '일정 쪽에서도 수업이 보인다');
  r.check((await lessonRow.textContent()).includes('도덕'), '수업 줄 = 그 교시 과목');
  await lessonRow.locator(sel('link-unlink')).click();
  r.check(!(await serverUntil(() => dayDoc('2026-10-12'), (d) => !d?.periods?.['1']?.linkIds))?.periods?.['1']?.linkIds, '끊기 = 수업 쪽도');
  r.check(!(await serverUntil(() => read(A.ref('items', 'insp_le1')), (d) => !d?.linkIds?.length))?.linkIds?.length, '끊기 = 일정 쪽도');
  await page.keyboard.press('Escape');
  // 항목에서 🏫 수업 탭으로 잇기
  await page.locator(`${sel('event-card', 'insp_le1')} ${sel('event-edit')}`).click();
  await page.locator(sel('event-link-add')).click({ timeout: 5000 }).catch(() => {});
  const linkerOpen = await waitFor(page.locator(sel('linker', 'insp_le1')), 3000);
  if (linkerOpen) {
    await page.locator(sel('linker-tab', 'lesson')).click();
    r.check(await waitFor(page.locator(sel('linker-item', 'lesson:2026-10-12:2'))), '🏫 수업 탭 = 계산한 수업 칸 (10/12 2교시)');
    await page.locator(sel('linker-item', 'lesson:2026-10-12:2')).click();
    await page.locator(sel('linker-save')).click();
    r.check(!!(await serverUntil(() => dayDoc('2026-10-12'), (d) => d?.periods?.['2']?.linkIds?.includes('insp_le1'))), '항목에서 수업을 이어도 양쪽');
  } else {
    r.bad('일정 칸의 🔗 링크 추가를 찾지 못했다');
  }
  await page.keyboard.press('Escape');

  r.section('검색 · 휴지통');
  await page.evaluate(() => window.sp5.openWindow('search'));
  await page.locator(sel('search-input')).fill('운동장');
  const hit = page.locator(sel('search-hit', 'lesson:2026-10-12:2:lessonMemo'));
  r.check(await waitFor(hit, 8000), "검색 '수업 메모' 갈래 (계산한 수업 칸)");
  await page.locator(sel('search-input')).fill('도덕');
  r.check(await waitFor(page.locator(sel('search-hit-kind', 'lesson')).first()), "검색 '수업' 갈래 = 과목");
  await page.locator(sel('search-input')).fill('운동장');
  await hit.click();
  r.check(await waitFor(page.locator(`${sel('lesson-card', 2)}[data-search-focus]`), 6000), '결과를 누르면 그날 그 교시를 짚는다');
  await page.keyboard.press('Escape');
  // 시간표 지우기 = 휴지통
  await page.locator(sel('lessons-settings')).click();
  await page.locator(sel('timetable-pick', made[0].id)).click();
  await page.locator(sel('timetable-delete')).click();
  await page.locator(sel('timetable-save')).click();
  r.check(!!(await serverUntil(() => read(A.ref('timetables', made[0].id)), (d) => !!d?.deletedAt))?.deletedAt, '시간표 지우기 = 지운 표시');
  await page.locator(`[data-popup-frame]:has(${win}) [data-close]`).click();
  await page.evaluate(() => window.sp5.openWindow('trash'));
  r.check(await waitFor(page.locator(sel('trash-row', `timetable:${made[0].id}`)), 8000), '휴지통에 시간표');
  await page.locator(sel('trash-restore', `timetable:${made[0].id}`)).click();
  r.check(!(await serverUntil(() => read(A.ref('timetables', made[0].id)), (d) => !d?.deletedAt))?.deletedAt, '되살리기');
  await page.keyboard.press('Escape');

  r.section("'교사 유형을 골라 주세요' 띠");
  const cur = (await read(A.ref('settings', 'common'))) ?? {};
  delete cur.teaching;
  await setDoc(A.ref('settings', 'common'), { ...cur, updatedAt: serverTimestamp(), v: 1 });
  await page.reload();
  await page.locator(sel('session', 'signed-in')).waitFor({ timeout: 20000 });
  r.check(await waitFor(page.locator(sel('teacher-mode-banner')), 8000), '고르지 않은 계정 = 하루 화면 맨 위에 띠');
  await page.locator(sel('banner-later')).click();
  r.check(!(await page.locator(sel('teacher-mode-banner')).count()), "'나중에' = 띠가 사라진다");
  const chosen = await serverUntil(() => read(A.ref('settings', 'common')), (d) => !!d?.teaching, 8000);
  r.check(chosen?.teaching?.unit === 'subject', "'나중에'도 (초등) 담임을 계정에 적는다 (다른 기기에 다시 뜨지 않게)");
  await page.waitForTimeout(1500);
  r.check(errors.length === 0, `화면 오류 없음 ${errors.join(' | ')}`);
  void commonA;

  r.section('지금 몇 교시 (시각 고정)');
  {
    const { page: p2, errors: e2 } = await newPage(browser);
    const today = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const ymd = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
    await p2.clock.setFixedTime(new Date(`${ymd}T10:05:00`));
    await open(p2, `#/day/${ymd}`);
    r.check(await waitFor(p2.locator(sel('now-line')), 8000), '오늘 = 머리줄에 지금 교시 한 줄');
    r.check((await p2.locator(sel('now-line')).textContent()).includes('지금 2교시'), '10:05 = 2교시 (09:50~10:30)');
    r.check((await p2.locator(`${sel('lesson-card', 2)}[data-now="true"]`).count()) === 1, '지금 교시 카드를 짚는다');
    r.check(e2.length === 0, `화면 오류 없음 ${e2.join(' | ')}`);
    await p2.context().close();
  }

  r.section('전담 (teacher3)');
  const { page: p3, errors: e3 } = await newPage(browser);
  const card3 = (n) => p3.locator(sel('lesson-card', n));
  await open(p3, '#/day/2026-10-12', { as: '3' });
  r.check(await waitFor(card3(1).locator('[data-slot-class]'), 8000), '반을 크게 (5-2)');
  r.check((await card3(1).locator('[data-slot-class]').textContent()) === '5-2' && (await card3(1).locator('[data-slot-subject]').textContent()) === '과학', '반 · 과목을 나눠 보인다');
  r.check(!!(await card3(1).getAttribute('data-slot-color')), '카드 막대 = 반 색');
  r.check(!(await card3(2).locator('[data-slot-class]').count()), "반이 없는 칸('창체')은 그대로");
  await card3(3).click();
  const ed3 = p3.locator(sel('lesson-editor', 3));
  r.check(await waitFor(ed3.locator(sel('slot-pair'))), '수정 칸 = 학년-반 + 과목 두 칸');
  await ed3.locator(sel('slot-class-input')).fill('502');
  await ed3.locator(sel('slot-subject-input')).click();
  r.check((await ed3.locator(sel('slot-class-input')).inputValue()) === '5-2', "'502' → '5-2' (칸을 떠나면)");
  await ed3.locator(sel('slot-subject-input')).fill('과학');
  r.check(await waitFor(p3.locator(sel('combobox-list'))), '과목 칸에 ▼ 목록');
  await p3.keyboard.press('Escape');
  r.check(await waitFor(ed3), 'ESC는 목록만 닫는다');
  await ed3.locator(sel('lesson-memo-input')).fill('실험 못 끝냄');
  await p3.keyboard.press('Control+s');
  const d3 = await serverUntil(() => read(B.ref('lessonDays', '2026-10-12')), (d) => d?.periods?.['3']?.subject === '5-2 과학');
  r.check(d3?.periods?.['3']?.subject === '5-2 과학', "저장 = 칸 글자 하나 '5-2 과학'");
  // 지난 시간 - 10/14(수) 1교시 5-2 과학의 바로 앞 = 10/12 3교시 (같은 날 늦은 교시가 더 가깝다)
  await p3.goto(p3.url().replace(/#.*$/, '#/day/2026-10-14'));
  const prev = p3.locator(`${sel('lesson-card', 1)} ${sel('lesson-prev')}`);
  r.check(await waitFor(prev, 8000), '⏪ 지난 시간 줄 (같은 반·과목의 바로 앞 수업 메모)');
  const prevText = (await prev.textContent()) ?? '';
  r.check(prevText.includes('3교시') && prevText.includes('실험 못 끝냄'), `바로 앞 수업 = 10/12 3교시의 메모 (${prevText})`);
  // 교사 유형 탭 - 가르치는 반 더하기 → ▼ 목록
  await p3.evaluate(() => window.sp5.runShortcut('teachingMode'));
  r.check(await waitFor(p3.locator(sel('teaching-tab'))), "단축키 '교사 유형 바꾸기' = 시간표 창 교사 유형 탭");
  r.check((await p3.locator(sel('teacher-preset', 'subject')).getAttribute('aria-checked')) === 'true', '전담이 골라져 있다');
  await p3.locator(sel('teaching-class-input')).fill('6-1~6-2');
  await p3.keyboard.press('Enter');
  r.check(await waitFor(p3.locator(sel('teaching-class', '6-2'))), "범위 '6-1~6-2' = 반 둘");
  const t3 = await serverUntil(() => read(B.ref('settings', 'common')), (d) => d?.teaching?.classes?.includes('6-2'), 8000);
  r.check(t3?.teaching?.classes?.includes('6-1'), '가르치는 반 = 계정 설정 teaching.classes');
  r.check((await p3.locator(sel('class-color-row')).count()) >= 4, '반 색 줄 (시간표·설정의 반)');
  await p3.locator(sel('timetable-tab', 'grid')).click();
  await p3.locator(`${win} [data-cell="0-1"]`).focus();
  await p3.keyboard.press('Alt+ArrowDown');
  r.check(await waitFor(p3.locator(sel('combobox-option', '6-1'))), '표 칸 ▼ 목록에 가르치는 반 (Alt+↓)');
  await p3.keyboard.press('Escape');
  await p3.waitForTimeout(1500);
  r.check(e3.length === 0, `화면 오류 없음 ${e3.join(' | ')}`);
  void hashOf;
} catch (e) {
  r.bad(`점검이 멈췄다: ${e?.stack ?? e}`);
} finally {
  await browser.close();
  await undo.run();
  r.done();
  process.exit();
}
