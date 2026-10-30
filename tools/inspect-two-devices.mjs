// tools/inspect-two-devices.mjs - P14-6 ■3: 같은 계정의 두 창(= 두 기기)이 같은 것을 함께 고칠 때.
//   npm run emu · npm run seed · npm run dev:emu (켜 둔다) → node tools/inspect-two-devices.mjs
//   1) 메모: A가 글을 고치는 동안 B가 제목을 달아 저장 → A 저장 = A의 글 + B의 제목 (B의 제목을 되돌리지 않는다)
//   2) 메모: 같은 글을 둘 다 고침 → A 저장 때 묻는다 · 아니오 = 적지 않음(서버는 B 글) · 예 = A 글로 덮기
//   3) 수업 칸: A가 비고를 고치는 동안 B가 같은 교시 과목을 바꿈 → A 저장 = B의 과목 + A의 비고
import { deleteDoc, deleteField, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { emulator, launch, newPage, open, report, restorer, sel, serverUntil, waitFor } from './lib/probe.mjs';

const r = report();
const undo = restorer();
const em = emulator();
const uid = await em.signIn('teacher@example.com');
const sid = `u_${uid}`;
const browser = await launch();
const DAY = '2026-10-14';
const N = 3;
const noteRef = doc(em.db, 'spaces', sid, 'items', 'inspTwoDev');
const dayRef = doc(em.db, 'spaces', sid, 'lessonDays', DAY);
const read = async (ref) => (await getDoc(ref)).data();

try {
  await setDoc(noteRef, { kind: 'note', date: DAY, text: '두기기 처음 글', labelIds: [], order: 'a0', createdAt: Date.now(), authorId: uid, deletedAt: null, v: 1, updatedAt: serverTimestamp() });
  undo.add(() => deleteDoc(noteRef));
  const before = (await read(dayRef))?.periods?.[N];
  undo.add(() => setDoc(dayRef, { periods: { [N]: before ?? deleteField() }, updatedAt: serverTimestamp(), v: 1 }, { merge: true }));

  const A = await newPage(browser);
  const B = await newPage(browser);
  for (const p of [A, B]) await open(p.page, `#/day/${DAY}`);
  const openNote = (p) => p.page.evaluate(([s, d]) => window.sp5.openWindow('note', { sid: s, date: d, id: 'inspTwoDev' }), [sid, DAY]);
  const notePanel = (p) => p.page.locator(sel('note-panel', 'edit'));
  const card = (p) => p.page.locator(sel('entry-card', 'inspTwoDev'));

  r.section('메모 - 다른 칸을 함께 고침');
  await openNote(A);
  await openNote(B);
  await waitFor(async () => (await notePanel(A).locator(sel('note-text-input')).inputValue().catch(() => '')) === '두기기 처음 글', 15000);
  await waitFor(async () => (await notePanel(B).locator(sel('note-text-input')).inputValue().catch(() => '')) === '두기기 처음 글', 15000);
  await notePanel(A).locator(sel('note-text-input')).fill('A가 고친 글');
  await notePanel(B).locator(sel('note-title-input')).fill('B가 단 제목');
  await notePanel(B).locator(sel('note-save')).click();
  await serverUntil(() => read(noteRef), (d) => d?.title === 'B가 단 제목');
  // A의 사본에 B의 제목이 들어온 뒤 (A의 칸은 손댄 채라 그대로 - 카드가 먼저 바뀐다)
  r.check(await waitFor(card(A).filter({ hasText: 'B가 단 제목' }), 10000), "A 화면 카드에 B의 제목이 들어온다 (A의 칸은 적던 글 그대로)");
  await notePanel(A).locator(sel('note-save')).click();
  const n1 = await serverUntil(() => read(noteRef), (d) => d?.text === 'A가 고친 글');
  r.check(n1?.text === 'A가 고친 글' && n1?.title === 'B가 단 제목', `A 저장 = A의 글 + B의 제목 (제목: ${n1?.title ?? '없음'})`);
  r.check(A.dialogs.seen.length === 0, '다른 칸만 겹치면 묻지 않는다');

  r.section('메모 - 같은 글을 함께 고침');
  await waitFor(async () => (await notePanel(B).locator(sel('note-text-input')).inputValue()) === 'A가 고친 글', 10000);
  await notePanel(A).locator(sel('note-text-input')).fill('A의 둘째 글');
  await notePanel(B).locator(sel('note-text-input')).fill('B의 글');
  await notePanel(B).locator(sel('note-save')).click();
  await serverUntil(() => read(noteRef), (d) => d?.text === 'B의 글');
  r.check(await waitFor(card(A).filter({ hasText: 'B의 글' }), 10000), 'A 화면 카드에 B의 글이 들어온다');
  A.dialogs.answer = false;
  await notePanel(A).locator(sel('note-save')).click();
  r.check(await waitFor(async () => A.dialogs.seen.some((m) => m.includes('다른 기기에서 이 메모의 글을 바꿨습니다')), 5000), 'A 저장 → "다른 기기에서 이 메모의 글을 바꿨습니다" 묻기');
  await new Promise((res) => setTimeout(res, 1000));
  r.check((await read(noteRef))?.text === 'B의 글', '아니오 = 적지 않는다 (서버는 B의 글)');
  r.check((await notePanel(A).locator(sel('note-text-input')).inputValue()) === 'A의 둘째 글', '아니오 = A의 칸은 적던 글 그대로');
  A.dialogs.answer = true;
  await notePanel(A).locator(sel('note-save')).click();
  const n2 = await serverUntil(() => read(noteRef), (d) => d?.text === 'A의 둘째 글');
  r.check(n2?.text === 'A의 둘째 글' && n2?.title === 'B가 단 제목', '예 = A의 글로 덮는다 (제목은 그대로)');
  for (const p of [A, B]) {
    p.dialogs.answer = true;
    await p.page.evaluate(() => window.sp5.closeAllWindows());
  }

  r.section('수업 칸 - 같은 교시의 다른 칸');
  const openLesson = (p) => p.page.evaluate(([s, d, n]) => window.sp5.openWindow('lesson', { sid: s, date: d, n }), [sid, DAY, N]);
  const lessonPanel = (p) => p.page.locator(sel('lesson-panel', `lesson:${DAY}:${N}`));
  await openLesson(A);
  await openLesson(B);
  await lessonPanel(A).waitFor({ timeout: 15000 });
  await lessonPanel(B).waitFor({ timeout: 15000 });
  await lessonPanel(A).locator(sel('lesson-panel-note')).fill('A의 비고');
  await lessonPanel(B).locator(sel('lesson-panel-subject')).fill('B과목');
  await lessonPanel(B).locator(sel('lesson-panel-save')).click();
  await serverUntil(() => read(dayRef), (d) => d?.periods?.[N]?.subject === 'B과목');
  r.check(
    await waitFor(async () => (await A.page.locator(sel('lesson-card', N)).locator('[data-lesson-subject]').first().getAttribute('data-lesson-subject').catch(() => '')) === 'B과목', 10000),
    'A 화면 수업 카드에 B의 과목이 들어온다',
  );
  await lessonPanel(A).locator(sel('lesson-panel-save')).click();
  const d1 = await serverUntil(() => read(dayRef), (d) => d?.periods?.[N]?.supplies === 'A의 비고');
  r.check(d1?.periods?.[N]?.subject === 'B과목' && d1?.periods?.[N]?.supplies === 'A의 비고', `A 저장 = B의 과목 + A의 비고 (과목: ${d1?.periods?.[N]?.subject ?? '없음'})`);
  for (const p of [A, B]) await p.page.evaluate(() => window.sp5.closeAllWindows());
  r.check(A.errors.length === 0 && B.errors.length === 0, `화면 오류 없음 ${[...A.errors, ...B.errors].join(' | ')}`);
} catch (e) {
  r.bad(`점검이 멈췄다: ${e?.stack ?? e}`);
} finally {
  await undo.run();
  await browser.close();
  r.done();
  process.exit();
}
