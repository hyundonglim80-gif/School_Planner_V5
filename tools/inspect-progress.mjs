// tools/inspect-progress.mjs - P6-2: 진도를 실제 크롬에서 본다.
//   1) 하루 수업 칸 수정 → '📘 진도 만들기' = 그 칸 글자로 새 진도 → 시작일·표 붙여넣기(차시 칸 2 = 2행) → 미리보기 → 💾 = 문서 하나
//   2) 수업 칸 진도 줄(📘 k/n차시 · 📖 쪽 · 🎒 준비물) · 이 교시 밀기 = bumps 한 칸 · 되돌리기(안내) · 주간 k/n 배지 · 줄을 누르면 그 진도
//   3) 진도 창: 칸 고치기 = 바뀐 칸만 · ESC 묻기 · Ctrl+Enter 행 · CSV 불러오기 · 예시 CSV 받기 · + 새 진도 · 지우기 = 휴지통 · ⋮·머리줄 📘 · 단축키
//   4) 전담(teacher3 ?as=3): 과정(과목 + 여러 반) - 반마다 따로 세기·반별 현황표·다음 수업 밀기
//
//   npm run emu · npm run dev:emu (켜 둔다) → npm run seed → node tools/inspect-progress.mjs
// 에뮬레이터 teacher·teacher3 계정의 시간표·수업 칸·진도를 비우고 심은 뒤 끝에 되돌린다.
import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';
import { emulator, launch, newPage, open, report, restorer, sel, serverUntil, waitFor } from './lib/probe.mjs';

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
const liveDocs = async (S, coll) => (await getDocs(S.coll(coll))).docs.filter((d) => !d.data().deletedAt);

/** 컬렉션을 비우고 끝에 그대로 되돌린다 */
async function clearAndKeep(S, coll) {
  const before = (await getDocs(S.coll(coll))).docs.map((d) => [d.id, d.data()]);
  for (const [id] of before) await deleteDoc(S.ref(coll, id));
  undo.add(async () => {
    for (const d of (await getDocs(S.coll(coll))).docs) await deleteDoc(d.ref);
    for (const [id, data] of before) await setDoc(S.ref(coll, id), data);
  });
}

/** 표 붙여넣기 (엑셀에서 복사한 것처럼) */
const pasteInto = (locator, text) =>
  locator.evaluate((el, t) => {
    el.focus();
    const dt = new DataTransfer();
    dt.setData('text/plain', t);
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  }, text);

try {
  // ── 심기 ──
  for (const S of [A, B]) for (const coll of ['timetables', 'lessonDays', 'progress']) await clearAndKeep(S, coll);
  // 담임: 월 1 국어·2 수학, 수 1 국어
  await setDoc(A.ref('timetables', 'insp_pg1'), { name: '점검 진도', from: '2026-03-01', to: '2027-02-28', grid: { '1': { '1': '국어', '2': '수학' }, '3': { '1': '국어' } }, authorId: uid, ...tracked });
  // 전담: 월 1 5-2 과학·2 5-3 과학, 수 1 5-2 과학·2 5-3 과학
  await setDoc(B.ref('timetables', 'insp_pg3'), {
    name: '점검 전담 진도',
    from: '2026-03-01',
    to: '2027-02-28',
    grid: { '1': { '1': '5-2 과학', '2': '5-3 과학' }, '3': { '1': '5-2 과학', '2': '5-3 과학' } },
    authorId: uid3,
    ...tracked,
  });

  const { page, errors, dialogs } = await newPage(browser);
  const card = (n) => page.locator(sel('lesson-card', n));
  const win = sel('progress-window');
  const go = async (hash) => {
    await page.goto(page.url().replace(/#.*$/, hash));
    await page.waitForFunction((h) => location.hash === h, hash);
  };
  const toastUndo = (text) => page.locator(sel('toast')).filter({ hasText: text }).locator('[data-toast-action="되돌리기"]');

  r.section('📘 진도 만들기 (수업 칸 수정)');
  await open(page, '#/day/2026-10-12');
  r.check(await waitFor(async () => (await card(1).locator('[data-lesson-subject]').getAttribute('data-lesson-subject')) === '국어', 8000), '월 1교시 = 국어');
  r.check(!(await card(1).locator(sel('progress-mark')).count()), '진도가 없으면 진도 줄도 없다');
  r.check((await page.locator(sel('lessons-tool', 'progress')).count()) === 1, '수업 머리줄에 📘 진도 관리');
  await card(1).click();
  const ed = page.locator(sel('lesson-editor', 1));
  r.check(await waitFor(ed.locator(sel('progress-create'))), "수정 칸에 '📘 진도 만들기' (진도가 없는 교시)");
  await ed.locator(sel('progress-create')).click();
  r.check(await waitFor(page.locator(win)), '진도 관리 창이 열린다');
  r.check((await page.locator(sel('progress-key')).inputValue()) === '국어', '과목 = 그 칸 글자 (국어)');
  r.check((await page.locator(sel('progress-key-option')).count()) >= 2, '과목 고르기 = 시간표의 과목들');
  await page.locator(sel('progress-start')).fill('2026-10-12');
  // 차시 칸 1, 2, 1 = 1행 + 2행 + 1행 (차시 수)
  await pasteInto(page.locator(sel('progress-paste')), '1단원\t1\t시 읽기\t12~13\t색연필\n1단원\t2\t비유 표현\t14\t\n2단원\t1\t이야기\t20\t\n');
  r.check(await waitFor(page.locator(sel('progress-table', 4))), "붙여넣기 = 표 4행 (차시 칸 '2'는 같은 내용 2행)");
  r.check(await waitFor(page.locator(sel('toast')).filter({ hasText: '1행 더' })), '안내: 차시 수만큼 더 넣었다');
  r.check(await waitFor(page.locator(sel('progress-rows', 4))), '미리보기 = 4교시 (월·수 1교시를 차례로)');
  const slots = await page.locator(`${win} [data-slot]`).evaluateAll((els) => els.map((e) => e.getAttribute('data-slot')));
  r.check(slots.join(',') === '2026-10-12#1,2026-10-14#1,2026-10-19#1,2026-10-21#1', `미리보기 교시 = 시간표의 국어 (${slots.join(',')})`);
  r.check((await page.locator(sel('progress-summary')).textContent()).includes('4차시'), '마지막 차시 요약');
  await page.locator(sel('progress-save')).click();
  const plans1 = await serverUntil(() => liveDocs(A, 'progress'), (d) => d.length === 1);
  const p1 = plans1[0]?.data();
  r.check(p1?.key === '국어' && p1.startDate === '2026-10-12' && p1.lessons?.length === 4 && Array.isArray(p1.bumps), '💾 저장 = 진도 문서 하나 (key·startDate·lessons·bumps)');
  r.check(p1?.lessons?.[0]?.page === '12~13' && p1.lessons[0].supplies === '색연필', '교과서 쪽·준비물 칸');
  const planId = plans1[0]?.id;
  r.check(await waitFor(page.locator(sel('progress-plan', planId))), '진도 칩이 생긴다');
  r.check(!(await page.locator(sel('progress-save')).isEnabled()), '저장하면 💾가 꺼진다 (고친 것 없음)');
  await page.locator(`[data-popup-frame]:has(${win}) [data-close]`).click();

  r.section('수업 칸 진도 줄');
  const mark1 = card(1).locator(sel('progress-mark'));
  r.check(await waitFor(mark1, 8000), '닫으면 수업 칸에 진도 줄');
  const m1 = (await mark1.textContent()) ?? '';
  r.check((await mark1.getAttribute('data-progress-mark')) === '1' && m1.includes('1/4차시') && m1.includes('시 읽기'), `📘 1/4차시 · 내용 (${m1})`);
  r.check(m1.includes('📖 12~13쪽') && m1.includes('🎒 색연필'), '📖 교과서 쪽 · 🎒 준비물');
  r.check(!(await card(2).locator(sel('progress-mark')).count()), '진도가 없는 과목(수학)은 줄이 없다');
  await go('#/day/2026-10-14');
  r.check(await waitFor(async () => (await card(1).locator(sel('progress-mark')).getAttribute('data-progress-mark').catch(() => null)) === '2', 8000), '수 1교시 = 2차시');
  // 이 교시 밀기
  await card(1).hover();
  await card(1).locator(sel('progress-bump', 'bump')).click();
  const bumped = await serverUntil(() => read(A.ref('progress', planId)), (d) => d?.bumps?.length === 1);
  r.check(bumped?.bumps?.[0] === '2026-10-14#1', '이 교시 밀기 = bumps 한 칸 (2026-10-14#1)');
  r.check(await waitFor(async () => (await card(1).locator(sel('progress-mark')).getAttribute('data-progress-mark')) === 'bumped'), '민 교시 = ⏭ 밀림 · 차시 없음');
  r.check((await card(1).locator(sel('progress-bump', 'undo')).count()) === 1, '민 교시는 되돌리기 단추');
  await go('#/day/2026-10-19');
  r.check(await waitFor(async () => (await card(1).locator(sel('progress-mark')).getAttribute('data-progress-mark').catch(() => null)) === '2', 8000), '뒤 차시가 한 칸씩 밀린다 (10/19 = 2차시)');
  await toastUndo('밀었습니다').click();
  const unbumped = await serverUntil(() => read(A.ref('progress', planId)), (d) => d?.bumps?.length === 0);
  r.check(unbumped?.bumps?.length === 0, '안내의 되돌리기 = 밀기 전으로');
  r.check(await waitFor(async () => (await card(1).locator(sel('progress-mark')).getAttribute('data-progress-mark')) === '3'), '되돌리면 10/19 = 3차시');
  // 수정 칸에서도 진도 줄 (밀기 단추가 늘 보인다), 진도 만들기는 없다
  await card(1).click();
  const ed19 = page.locator(sel('lesson-editor', 1));
  r.check(await waitFor(ed19.locator(sel('progress-mark'))), '수정 칸에도 진도 줄');
  r.check(!(await ed19.locator(sel('progress-create')).count()), '진도가 있는 교시는 진도 만들기가 없다');
  await page.keyboard.press('Escape');

  r.section('주간 진도 배지');
  await go('#/week/2026-10-12');
  const wk = (d, n) => page.locator(`${sel('week-lessons', d)} ${sel('week-lesson', n)}`);
  r.check(await waitFor(wk('2026-10-12', 1).locator(sel('week-progress', 1)), 8000), '주간 월 1교시 = 1/4 배지');
  r.check((await wk('2026-10-14', 1).locator(sel('week-progress')).textContent()) === '2/4', '수 1교시 = 2/4');
  r.check(!(await wk('2026-10-12', 2).locator(sel('week-progress')).count()), '진도 없는 교시는 배지가 없다');

  r.section('진도 창 고치기');
  await go('#/day/2026-10-12');
  await waitFor(card(1).locator(sel('progress-mark')), 8000);
  await card(1).locator(sel('progress-mark-open')).click();
  r.check(await waitFor(page.locator(`${sel('progress-plan', planId)}[aria-pressed="true"]`)), '진도 줄을 누르면 그 진도로 창이 열린다');
  const cell = (rc) => page.locator(`${win} input[data-cell="${rc}"]`);
  await cell('0-2').fill('시 소리 내어 읽기');
  r.check(await page.locator(sel('progress-save')).isEnabled(), '고치면 💾가 켜진다');
  dialogs.answer = false;
  dialogs.seen.length = 0;
  await cell('0-2').blur();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  r.check(dialogs.seen.length > 0 && (await page.locator(win).count()) === 1, 'ESC = 저장 안 한 것을 먼저 묻는다');
  // Ctrl+Enter = 그 아래 행
  await cell('3-2').click();
  await page.keyboard.press('Control+Enter');
  r.check(await waitFor(page.locator(sel('progress-table', 5))), 'Ctrl+Enter = 아래에 행 추가');
  r.check((await page.evaluate(() => document.activeElement?.getAttribute('data-cell'))) === '4-2', '새 행의 같은 칸으로');
  await page.keyboard.type('정리');
  await page.keyboard.press('Control+s');
  const edited = await serverUntil(() => read(A.ref('progress', planId)), (d) => d?.lessons?.length === 5);
  r.check(edited?.lessons?.[0]?.content === '시 소리 내어 읽기' && edited.lessons[4].content === '정리', 'Ctrl+S = 저장 (차시 목록)');
  r.check(edited?.key === '국어' && edited.startDate === '2026-10-12', '다른 칸은 그대로');
  // 행 지우기
  await page.locator(sel('progress-row-delete', 4)).click();
  r.check(await waitFor(page.locator(sel('progress-table', 4))), '✕ = 행 지우기');

  r.section('+ 새 진도 · CSV');
  dialogs.answer = true;
  await page.locator(sel('progress-new')).click();
  r.check(await waitFor(async () => (await page.locator(sel('progress-key')).inputValue()) === ''), '+ 새 진도 = 빈 칸 (고치던 것은 묻고 버린다)');
  await page.locator(sel('progress-key-option', '수학')).click();
  await page.locator(sel('progress-start')).fill('2026-10-12');
  const csv = '﻿단원,차시,내용,교과서,준비물\n1. 분수,1,분수 알기,8,\n1. 분수,1,분수 비교,10,수 막대\n';
  await page.locator(sel('progress-csv-input')).setInputFiles({ name: '수학.csv', mimeType: 'text/csv', buffer: Buffer.from(csv, 'utf8') });
  r.check(await waitFor(page.locator(sel('progress-table', 2))), 'CSV 불러오기 = 표 2행 (머리줄은 건너뛴다)');
  r.check((await cell('1-4').inputValue()) === '수 막대', 'CSV 칸 = 단원·차시·내용·교과서·준비물');
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator(sel('progress-sample')).click()]);
  // 컨테이너 Chromium은 한글 파일 이름을 'download'로 바꾼다 - 이름은 PC 크롬에서만, 내용은 어디서나
  const sample = (await import('node:fs')).readFileSync(await download.path(), 'utf8');
  const name = download.suggestedFilename();
  r.check(sample.replace(/^\uFEFF/, '').startsWith('단원,차시,내용,교과서,준비물') && (name === 'download' || name === '진도표_예시.csv'), `예시 CSV 받기 (${name})`);
  await page.locator(sel('progress-save')).click();
  const plans2 = await serverUntil(() => liveDocs(A, 'progress'), (d) => d.length === 2);
  r.check(plans2.length === 2, '두 번째 진도 저장 = 문서 하나 더');
  const mathId = plans2.find((d) => d.data().key === '수학')?.id;
  await page.locator(`[data-popup-frame]:has(${win}) [data-close]`).click();
  r.check(await waitFor(card(2).locator(sel('progress-mark', 1)), 8000), '월 2교시(수학)에도 진도 줄');
  r.check(((await card(2).locator(sel('progress-supplies')).count()) === 0), '준비물 없는 차시는 🎒 없음');

  r.section('지우기 · ⋮ · 단축키');
  await page.locator(sel('more-menu')).click();
  await page.locator(sel('menu-item', 'progress')).click();
  r.check(await waitFor(page.locator(win)), '⋮ 수업 · 📘 진도 관리');
  await page.locator(sel('progress-plan', mathId)).click();
  await page.locator(sel('progress-delete')).click();
  const gone = await serverUntil(() => read(A.ref('progress', mathId)), (d) => !!d?.deletedAt);
  r.check(!!gone?.deletedAt, '🗑️ 지우기 = 지운 표시 (휴지통)');
  r.check(await waitFor(async () => !(await card(2).locator(sel('progress-mark')).count()), 8000), '지운 진도는 수업 칸에서 빠진다');
  await toastUndo('진도를 지웠습니다').click();
  const back = await serverUntil(() => read(A.ref('progress', mathId)), (d) => d && !d.deletedAt);
  r.check(back && !back.deletedAt, '되돌리기 = 되살린다');
  await page.locator(`[data-popup-frame]:has(${win}) [data-close]`).click();
  await page.evaluate(() => window.sp5.runShortcut('newCourse'));
  r.check(await waitFor(page.locator(`${win} ${sel('course-form')}`)), "단축키 '진도 만들기 (여러 반)' = 과목 + 반");
  await page.keyboard.press('Escape');
  await waitFor(async () => !(await page.locator(win).count()));
  await page.evaluate(() => window.sp5.openWindow('timetable'));
  await page.locator(sel('timetable-progress')).click();
  r.check(await waitFor(page.locator(win)), '시간표 창 위 📘 진도 관리');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  r.check(errors.length === 0, `화면 오류 없음 ${errors.join(' | ')}`);

  r.section('전담 (teacher3) - 과정');
  const { page: p3, errors: e3, dialogs: d3 } = await newPage(browser);
  const card3 = (n) => p3.locator(sel('lesson-card', n));
  await open(p3, '#/day/2026-10-12', { as: '3' });
  r.check(await waitFor(card3(1).locator('[data-slot-class]'), 8000), '전담 수업 칸');
  await card3(1).click();
  const ed3 = p3.locator(sel('lesson-editor', 1));
  await ed3.locator(sel('progress-create')).click();
  r.check(await waitFor(p3.locator(sel('course-form'))), '전담의 진도 만들기 = 과정 (과목 + 반)');
  r.check((await p3.locator(sel('progress-subject')).inputValue()) === '과학', '과목 = 과학');
  r.check((await p3.locator(sel('course-class-toggle', '5-2')).getAttribute('aria-pressed')) === 'true', '그 칸의 반(5-2)이 골라져 있다');
  await p3.locator(sel('course-class-toggle', '5-3')).click();
  await p3.locator(sel('progress-start')).fill('2026-10-12');
  await pasteInto(p3.locator(sel('progress-paste')), '1. 물질\t1\t물질 알기\t\t\n1. 물질\t1\t물질 섞기\t\t비커\n1. 물질\t1\t정리\t\t\n');
  r.check(await waitFor(p3.locator(sel('course-status-row', '5-3'))), '반별 현황표 (5-2·5-3)');
  r.check((await p3.locator(sel('course-preview')).count()) === 2, '미리 볼 반 탭 둘');
  await p3.locator(sel('progress-save')).click();
  const c3 = await serverUntil(() => liveDocs(B, 'progress'), (d) => d.length === 1);
  const cp = c3[0]?.data();
  r.check(cp?.subject === '과학' && cp.classes?.join(',') === '5-2,5-3' && cp.lessons?.length === 3, '과정 저장 = 과목 + 반 (문서 하나)');
  r.check(await waitFor(p3.locator(sel('course-bump', '5-3'))), '저장하면 반마다 다음 수업 밀기');
  await p3.locator(sel('course-bump', '5-3')).click();
  const cb = await serverUntil(() => read(B.ref('progress', c3[0].id)), (d) => d?.bumps?.length === 1);
  r.check(cb?.bumps?.[0] === '2026-10-12#2', `5-3 다음 수업 밀기 = 그 반의 다음 교시만 (${cb?.bumps?.[0]})`);
  await p3.locator(`[data-popup-frame]:has(${sel('progress-window')}) [data-close]`).click();
  r.check(await waitFor(card3(1).locator(sel('progress-mark', 1)), 8000), '5-2 = 1차시');
  r.check(await waitFor(card3(2).locator(sel('progress-mark', 'bumped')), 8000), '5-3 = 민 교시 (반마다 따로 센다)');
  void d3;
  await p3.waitForTimeout(500);
  r.check(e3.length === 0, `화면 오류 없음 ${e3.join(' | ')}`);
} catch (e) {
  r.bad(`점검이 멈췄다: ${e?.stack ?? e}`);
} finally {
  await browser.close();
  await undo.run();
  r.done();
  process.exit();
}
