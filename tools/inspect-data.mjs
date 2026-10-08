// tools/inspect-data.mjs - P2-1: 저장 도우미·되돌리기를 실제 크롬에서 본다 (화면이 아직 없어 앱의 모듈을 불러 쓴다).
//   1) 저장 도우미로 만든 항목이 서버에 서버 시각·지운 표시 null로 들어간다.
//   2) 지운 뒤 안내의 '되돌리기' 단추를 누르면 되살아난다.
//   3) Ctrl+Z: 글 칸 안에서는 듣지 않고, 밖에서는 마지막 쓰기를 되돌린다. 비었으면 '되돌릴 것이 없습니다'.
//
//   npm run emu · npm run dev:emu (켜 둔다) → node tools/inspect-data.mjs
// 에뮬레이터 teacher 계정의 개인 공간에 점검 항목을 만들고 끝에 지운다.
import { deleteDoc, doc, getDoc } from 'firebase/firestore';
import { emulator, launch, newPage, open, report, restorer, sel, serverUntil, waitFor } from './lib/probe.mjs';

const r = report();
const em = emulator();
const uid = await em.signIn('teacher@example.com');
const sid = `u_${uid}`;
const undo = restorer();
const browser = await launch();

const readItem = async (id) => {
  const s = await getDoc(doc(em.db, 'spaces', sid, 'items', id));
  return s.exists() ? s.data() : null;
};

try {
  const { page, errors } = await newPage(browser);
  await open(page, '#/day/2026-10-08');

  // 앱이 쓰는 모듈 그대로 (개발 서버가 같은 주소로 주므로 앱과 같은 것)
  const run = (fn, arg) => page.evaluate(fn, arg);
  const ids = await run(async (sid) => {
    const repo = await import('/src/data/repo/index.ts');
    const a = repo.newPath(sid, 'items');
    const b = repo.newPath(sid, 'items');
    const note = (text) => ({ kind: 'note', date: null, text, labelIds: [], order: 'a0' });
    await repo.create(a, note('점검 첫째'));
    await repo.create(b, note('점검 둘째'));
    return [a.id, b.id];
  }, sid);
  for (const id of ids) undo.add(() => deleteDoc(doc(em.db, 'spaces', sid, 'items', id)));
  const [a, b] = ids;

  r.section('저장 도우미');
  const made = await readItem(a);
  r.check(made?.text === '점검 첫째', '만든 항목이 서버에', `만든 항목이 서버에 - ${made?.text}`);
  r.check(made?.deletedAt === null && made?.v === 1 && made?.authorId === uid, '지운 표시 null·판 1·만든 사람');
  r.check(typeof made?.updatedAt?.toMillis === 'function', 'updatedAt은 서버 시각');

  r.section('안내의 되돌리기');
  await run(async ({ sid, id }) => {
    const repo = await import('/src/data/repo/index.ts');
    const { recordUndo } = await import('/src/data/undo.ts');
    recordUndo(sid, '🗑️ 메모를 지웠습니다.', await repo.remove({ sid, coll: 'items', id }));
  }, { sid, id: a });
  r.check(!!(await serverUntil(() => readItem(a), (d) => !!d?.deletedAt))?.deletedAt, '지우면 지운 표시');
  const btn = page.locator(sel('toast-action', '되돌리기')).last();
  r.check(await waitFor(btn), '안내에 되돌리기 단추');
  await btn.click();
  r.check((await serverUntil(() => readItem(a), (d) => d?.deletedAt === null))?.deletedAt === null, '누르면 되살아난다');

  r.section('Ctrl+Z');
  await run(async ({ sid, id }) => {
    const repo = await import('/src/data/repo/index.ts');
    const { recordUndo } = await import('/src/data/undo.ts');
    const at = { sid, coll: 'items', id };
    recordUndo(sid, '고쳤습니다.', await repo.patch(at, { text: '점검 둘째 고침' }, { text: '점검 둘째' }), { what: '둘째 고치기' });
  }, { sid, id: b });
  await serverUntil(() => readItem(b), (d) => d?.text === '점검 둘째 고침');

  // 글 칸 안: 듣지 않는다
  await run(() => {
    const ta = document.createElement('textarea');
    ta.dataset.inspectTa = '1';
    document.body.appendChild(ta);
  });
  await page.locator(sel('inspect-ta')).focus();
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(800);
  r.check((await readItem(b))?.text === '점검 둘째 고침', '글 칸 안에서는 되돌리지 않는다');
  await run(() => document.querySelector('[data-inspect-ta]')?.remove());

  await page.locator(sel('session', 'signed-in')).click({ position: { x: 700, y: 600 } });
  await page.keyboard.press('Control+z');
  r.check((await serverUntil(() => readItem(b), (d) => d?.text === '점검 둘째'))?.text === '점검 둘째', '글 칸 밖에서는 마지막 쓰기를 되돌린다');
  r.check(await waitFor(page.locator(sel('toast')).filter({ hasText: '둘째 고치기' })), '무엇을 되돌렸나 안내');
  await page.keyboard.press('Control+z');
  r.check(await waitFor(page.locator(sel('toast')).filter({ hasText: '되돌릴 것이 없습니다' })), '더 없으면 알린다');

  r.check(errors.length === 0, '화면 오류 없음', `화면 오류 - ${errors.join(' | ')}`);
} finally {
  await undo.run();
  await browser.close();
}
r.done();
process.exit();
