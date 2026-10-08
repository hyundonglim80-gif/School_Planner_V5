// tools/inspect-memo.mjs - P4-1: 메모 화면·라벨로 보기를 실제 크롬에서 본다.
//   1) 메모 화면: 즐겨찾기로 연다, 왼쪽 라벨로 보기(⭐ → 라벨 → 전체), 카드는 가장 짧은 열부터(여러 열).
//   2) 라벨 칩: 그냥 = 하나만, Ctrl = 더하기, 상위 → 하위 것도, ▸ 펴서 '기타', 숫자 = 진행 중, 다른 화면에 다녀와도 그대로, ESC = 전체.
//   3) 진행/완료 구역, ☐ 완료 = 완료 구역으로(문서 하나), 🗑️ 전체 비우기 = 한 묶음 + 되돌리기.
//   4) + 새 메모 = 날짜 없는 칸(고른 라벨 미리) → 저장하면 메모 화면에.
//   5) 하루 기록 칸 라벨로 보기: 전체·칩, 고르면 그 기록만.
//
//   npm run emu · npm run dev:emu (켜 둔다) → node tools/inspect-memo.mjs
// 에뮬레이터 teacher 계정의 개인 공간에 점검 메모·기록·라벨(insp_mm…)을 심고 끝에 지운다.
import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';
import { emulator, hashOf, launch, newPage, open, report, restorer, sel, serverUntil, waitFor } from './lib/probe.mjs';

const r = report();
const em = emulator();
const uid = await em.signIn('teacher@example.com');
const sid = `u_${uid}`;
const undo = restorer();
const browser = await launch();

const DAY = '2026-10-08';
const itemRef = (id) => doc(em.db, 'spaces', sid, 'items', id);
const labelRef = (id) => doc(em.db, 'spaces', sid, 'labels', id);
const read = async (id) => {
  const s = await getDoc(itemRef(id));
  return s.exists() ? s.data() : null;
};
const startedAt = Date.now();
const stamp = { deletedAt: null, updatedAt: serverTimestamp(), v: 1, createdAt: startedAt, authorId: uid };
const LABELS = {
  insp_mlp: { name: '점검학교', color: 'blue', parentId: null, order: 'Zz1' },
  insp_mlc: { name: '점검A초', color: 'green', parentId: 'insp_mlp', order: 'Zz2' },
  insp_mlu: { name: '점검개인', color: 'red', parentId: null, order: 'Zz3' },
};
const MEMOS = {
  insp_mm1: { text: '점검 메모 학교', labelIds: ['insp_mlp'], order: 'Zz1' },
  insp_mm2: { text: '점검 메모 A초 즐겨찾기', labelIds: ['insp_mlc'], order: 'Zz2', favorite: true },
  insp_mm3: { text: '점검 메모 개인', labelIds: ['insp_mlu'], order: 'Zz3' },
  insp_mm4: { text: '점검 메모 끝낸 것', labelIds: ['insp_mlu'], order: 'Zz4', done: true },
  insp_mm5: { text: '점검 메모 길게\n' + '줄 '.repeat(60), labelIds: ['insp_mlu'], order: 'Zz5' },
};
const madeHere = async () => {
  const snap = await getDocs(collection(em.db, 'spaces', sid, 'items'));
  return snap.docs.filter((d) => (d.data().createdAt ?? 0) >= startedAt && String(d.data().text).includes('점검') && !d.id.startsWith('insp_'));
};

try {
  for (const [id, data] of Object.entries(LABELS)) {
    await setDoc(labelRef(id), { kind: 'note', ...data, ...stamp });
    undo.add(() => deleteDoc(labelRef(id)));
  }
  for (const [id, data] of Object.entries(MEMOS)) {
    await setDoc(itemRef(id), { kind: 'note', date: null, ...data, ...stamp });
    undo.add(() => deleteDoc(itemRef(id)));
  }
  await setDoc(itemRef('insp_mj1'), { kind: 'note', date: DAY, text: '점검 기록 개인', labelIds: ['insp_mlu'], order: 'Zz1', ...stamp });
  undo.add(() => deleteDoc(itemRef('insp_mj1')));
  await setDoc(itemRef('insp_mj2'), { kind: 'note', date: DAY, text: '점검 기록 학교', labelIds: ['insp_mlp'], order: 'Zz2', ...stamp });
  undo.add(() => deleteDoc(itemRef('insp_mj2')));
  undo.add(async () => {
    for (const d of await madeHere()) await deleteDoc(d.ref);
  });

  const { page, errors } = await newPage(browser);
  // 기억해 둔 거르개를 비우고 연다
  await open(page, '#/memo');
  await page.evaluate(() => localStorage.removeItem('sp5-label-filters'));
  await page.reload();
  await page.locator(sel('session', 'signed-in')).waitFor({ timeout: 20000 });
  const card = (id) => page.locator(sel('entry-card', id));
  const chip = (k) => page.locator(sel('filter-chip', k));
  const pressed = async (k) => (await chip(k).getAttribute('aria-pressed')) === 'true';
  const cardIds = () => page.locator(sel('entry-card')).evaluateAll((els) => els.map((e) => e.dataset.entryCard).filter((id) => id.startsWith('insp_')));

  r.section('메모 화면');
  r.check(await waitFor(page.locator(sel('memo-screen')), 8000), '메모 화면');
  r.check(await waitFor(card('insp_mm2')), '즐겨찾기 메모가 보인다');
  r.check(await pressed('fav'), '처음은 ⭐ 즐겨찾기');
  r.check((await card('insp_mm1').count()) === 0, '즐겨찾기가 아닌 것은 없다');
  await chip('all').click();
  r.check(await waitFor(card('insp_mm5')), '전체 메모');
  const lefts = await page.locator('[data-masonry-key^="insp_mm"]').evaluateAll((els) => [...new Set(els.map((e) => Math.round(e.getBoundingClientRect().left)))]);
  r.check(lefts.length >= 2, `카드가 여러 열에 쌓인다 (${lefts.length}열)`);
  r.check((await card('insp_mm5').getAttribute('data-entry-collapsed')) === '1', '긴 메모는 접힌 채');

  r.section('라벨로 보기');
  await chip('insp_mlp').click();
  r.check(JSON.stringify((await cardIds()).sort()) === '["insp_mm1","insp_mm2"]', `상위 = 하위 것도 (${await cardIds()})`);
  await chip('insp_mlu').click({ modifiers: ['Control'] });
  r.check((await cardIds()).length === 5, 'Ctrl = 더하기');
  r.check((await chip('insp_mlu').textContent()).includes('2'), '숫자는 진행 중만 (개인 3개 중 2)');
  await chip('insp_mlu').click();
  r.check(JSON.stringify((await cardIds()).sort()) === '["insp_mm3","insp_mm4","insp_mm5"]', '그냥 누르기 = 하나만');
  await page.locator(sel('filter-caret', 'insp_mlp')).click();
  await chip('기타:insp_mlp').click();
  r.check(JSON.stringify(await cardIds()) === '["insp_mm1"]', "'기타' = 하위 없이 상위만");
  await page.goto(page.url().replace(/#.*$/, `#/day/${DAY}`));
  await page.locator(sel('day-journal', DAY)).waitFor({ timeout: 8000 });
  await page.goto(page.url().replace(/#.*$/, '#/memo'));
  await waitFor(page.locator(sel('memo-screen')));
  r.check(await waitFor(async () => JSON.stringify(await cardIds()) === '["insp_mm1"]'), '다른 화면에 다녀와도 그대로');
  await page.locator('body').click({ position: { x: 5, y: 600 } });
  await page.keyboard.press('Escape');
  r.check(await waitFor(async () => await pressed('all')), 'ESC = 전체');

  r.section('완료·전체 비우기');
  await card('insp_mm3').locator(sel('entry-complete')).click();
  const d3 = await serverUntil(() => read('insp_mm3'), (d) => d?.done === true);
  r.check(d3?.done === true, '☐ = 완료 (문서 하나)');
  r.check(await waitFor(async () => Number(await page.locator(sel('memo-done')).getAttribute('data-memo-done')) >= 2), '완료 구역으로');
  await chip('insp_mlu').click();
  await page.locator(sel('memo-clear-done')).click();
  const gone = await serverUntil(async () => [await read('insp_mm3'), await read('insp_mm4')], (l) => l.every((d) => d?.deletedAt));
  r.check(gone.every((d) => d?.deletedAt), '🗑️ 전체 비우기 = 완료된 것 모두 지운 표시 (고른 라벨 안)');
  r.check((await read('insp_mm5'))?.deletedAt === null, '진행 중인 것은 그대로');
  await page.locator(sel('toast')).filter({ hasText: '완료된 메모' }).locator('[data-toast-action="되돌리기"]').click();
  const back = await serverUntil(async () => [await read('insp_mm3'), await read('insp_mm4')], (l) => l.every((d) => !d?.deletedAt));
  r.check(back.every((d) => !d?.deletedAt), '안내의 되돌리기 = 모두 되살린다');

  r.section('+ 새 메모');
  await page.locator(sel('memo-new')).click();
  const panel = page.locator(sel('note-panel'));
  r.check(await waitFor(panel), '오른쪽에 새 메모 칸');
  r.check((await panel.locator('[data-label-pick="insp_mlu"][aria-pressed="true"]').count()) === 1, '고른 라벨을 미리');
  await page.keyboard.type('점검 새 메모');
  await page.keyboard.press('Control+s');
  r.check(await waitFor(async () => (await panel.getAttribute('data-note-panel')) === 'edit'), '저장 → 수정 칸');
  const newId = await panel.getAttribute('data-note-id');
  r.check(await waitFor(card(newId)), '메모 화면에 나온다');
  r.check((await read(newId))?.date === null, '날짜 없는 메모');
  await page.keyboard.press('Escape');

  r.section('하루 기록 칸 라벨로 보기');
  await page.goto(page.url().replace(/#.*$/, `#/day/${DAY}`));
  await page.locator(sel('day-journal', DAY)).waitFor({ timeout: 8000 });
  const jf = page.locator(sel('journal-filter'));
  r.check(await waitFor(jf), '기록 칸 머리에 라벨 칩');
  await jf.locator(sel('filter-chip', 'insp_mlu')).click();
  const jIds = await page.locator(`${sel('day-journal', DAY)} ${sel('entry-card')}`).evaluateAll((els) => els.map((e) => e.dataset.entryCard));
  r.check(JSON.stringify(jIds) === '["insp_mj1"]', `고른 라벨의 기록만 (${jIds})`);
  await jf.locator(sel('filter-chip', 'all')).click();
  r.check(await waitFor(async () => (await page.locator(`${sel('day-journal', DAY)} ${sel('entry-card', 'insp_mj2')}`).count()) === 1), '전체 = 모두');
  r.check(hashOf(page).startsWith('#/day'), '하루 화면');

  r.check(errors.length === 0, `화면 오류 없음 ${errors.join(' | ')}`);
} catch (e) {
  r.bad(`점검이 멈췄다: ${e?.stack ?? e}`);
} finally {
  await browser.close();
  await undo.run();
  r.done();
  process.exit();
}
