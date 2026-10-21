// tools/inspect-memo.mjs - P4-1: 메모 화면·라벨로 보기를 실제 크롬에서 본다.
//   1) 메모 화면: 즐겨찾기로 연다, 왼쪽 라벨로 보기(⭐ → 라벨 → 전체), 카드는 가장 짧은 열부터(여러 열).
//   2) 라벨 칩: 그냥 = 하나만, Ctrl = 더하기, 상위 → 하위 것도, ▸ 펴서 '기타', 숫자 = 진행 중, 다른 화면에 다녀와도 그대로, ESC = 전체.
//   3) 진행/완료 구역, ☐ 완료 = 완료 구역으로(문서 하나), 🗑️ 전체 비우기 = 한 묶음 + 되돌리기.
//   4) + 새 메모 = 날짜 없는 칸(고른 라벨 미리) → 저장하면 메모 화면에.
//   5) 하루 메모 칸 라벨로 보기: 접힘 → 🏷️로 펴기 → 전체·칩, 고르면 그 메모만.
//   6) 파란 테두리 = 오른쪽 칸에 보이는 메모 하나 (다른 메모·탭을 고르면 옮겨 가고, 메모가 아닌 탭이면 없다 - 10-21).
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
  // 날짜 링크 메모(옛 기록 insp_mj…)도 메모 화면에 함께 (P10-3)
  r.check(JSON.stringify((await cardIds()).sort()) === '["insp_mj2","insp_mm1","insp_mm2"]', `상위 = 하위 것도 (${await cardIds()})`);
  await chip('insp_mlu').click({ modifiers: ['Control'] });
  r.check((await cardIds()).length === 7, 'Ctrl = 더하기');
  r.check((await chip('insp_mlu').textContent()).includes('3'), '숫자는 진행 중만 (개인 4개 중 3 - 날짜 링크 메모도)');
  await chip('insp_mlu').click();
  r.check(JSON.stringify((await cardIds()).sort()) === '["insp_mj1","insp_mm3","insp_mm4","insp_mm5"]', '그냥 누르기 = 하나만');
  await page.locator(sel('filter-caret', 'insp_mlp')).click();
  await chip('기타:insp_mlp').click();
  r.check(JSON.stringify((await cardIds()).sort()) === '["insp_mj2","insp_mm1"]', "'기타' = 하위 없이 상위만");
  await page.goto(page.url().replace(/#.*$/, `#/day/${DAY}`));
  await page.locator(sel('day-journal', DAY)).waitFor({ timeout: 8000 });
  await page.goto(page.url().replace(/#.*$/, '#/memo'));
  await waitFor(page.locator(sel('memo-screen')));
  r.check(await waitFor(async () => JSON.stringify((await cardIds()).sort()) === '["insp_mj2","insp_mm1"]'), '다른 화면에 다녀와도 그대로');
  r.check((await card('insp_mj2').locator(sel('entry-date-chip', DAY)).count()) === 1, '날짜 링크 메모 카드에 📅 칩');
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
  // 커서가 글 칸에 든 뒤에 친다 (칸이 처음 실릴 때는 조금 늦다 - 한 번 앞질러 쳐서 글이 비었다)
  r.check(await waitFor(() => panel.locator(sel('note-text-input')).evaluate((el) => el === document.activeElement)), '커서는 글 칸에');
  await page.keyboard.type('점검 새 메모');
  await page.keyboard.press('Control+s');
  r.check(await waitFor(async () => (await panel.getAttribute('data-note-panel')) === 'edit'), '저장 → 수정 칸');
  const newId = await panel.getAttribute('data-note-id');
  r.check(await waitFor(card(newId)), '메모 화면에 나온다');
  r.check((await read(newId))?.date === null, '날짜 없는 메모');
  const newOrder = (await read(newId))?.order;
  r.check(!!newOrder && newOrder < 'Zz1', `새 메모 = 날짜 없는 메모 맨 앞 차례 (최근 것이 맨 위 - P11-1, ${newOrder})`);

  r.section('내용을 다 지우고 저장 = 메모 지우기 (P10-5)');
  await panel.locator(sel('note-text-input')).fill('');
  await page.keyboard.press('Control+s');
  const emptied = await serverUntil(() => read(newId), (d) => !!d?.deletedAt);
  r.check(!!emptied?.deletedAt, '서버: 지운 표시 (휴지통)');
  r.check(await waitFor(async () => (await panel.count()) === 0), '칸이 닫힌다');
  r.check(await waitFor(page.locator(sel('toast')).filter({ hasText: '휴지통' })), '안내 + 되돌리기');
  await page.locator(sel('toast')).filter({ hasText: '내용을 모두 지워' }).locator('[data-toast-action="되돌리기"]').click();
  r.check(!(await serverUntil(() => read(newId), (d) => !d?.deletedAt))?.deletedAt, '되돌리기 = 되살린다');
  await page.locator(sel('memo-new')).click();
  r.check(await waitFor(panel), '새 칸');
  await page.keyboard.press('Control+s');
  r.check(await waitFor(async () => (await panel.count()) === 0), '빈 새 칸에서 저장 = 만들지 않고 닫는다');

  r.section("'🏷️ 라벨 관리'·카드/목록 보기 (P10-5)");
  await page.locator(sel('memo-labels-settings')).click();
  r.check(await waitFor(page.locator(sel('labels-window'))), "왼쪽 제목 '🏷️ 라벨 관리' → 라벨 관리 창");
  r.check((await page.locator(sel('label-tab', 'note')).getAttribute('aria-selected')) === 'true' || (await page.locator(`${sel('label-tab', 'note')}[aria-pressed="true"]`).count()) === 1, '메모 라벨 탭');
  await page.keyboard.press('Escape');
  const viewBtn = page.locator(sel('memo-view-toggle'));
  r.check((await viewBtn.getAttribute('data-memo-view-toggle')) === 'card', '머리줄 그림 단추 (메모 화면 - 지금 카드)');
  await viewBtn.click();
  r.check(await waitFor(page.locator(sel('memo-row', 'insp_mm5'))), '☰ → 목록 (한 줄에 메모 하나)');
  r.check((await page.locator(sel('entry-card')).count()) === 0, '카드는 없다');
  const rowText = await page.locator(`${sel('memo-row', 'insp_mm5')} ${sel('memo-row-text')}`).textContent();
  r.check(rowText === '점검 메모 길게', `첫 줄만 (${rowText})`);
  const row5 = page.locator(sel('memo-row', 'insp_mm5'));
  r.check(!(await row5.locator(sel('memo-row-body')).count()), '목록 줄은 접힌 채 시작 (P11-1)');
  await row5.locator(sel('memo-row-expand')).click();
  r.check(await waitFor(async () => ((await row5.locator(`${sel('memo-row-body')} ${sel('entry-text')}`).textContent()) ?? '').includes('줄 줄')), '▶ = 그 줄 아래에 본문 (카드와 같은 글)');
  r.check((await page.locator(`${sel('note-panel', 'edit')}[data-note-id="insp_mm5"]`).count()) === 0, '▶는 쓰는 칸을 열지 않는다');
  await row5.locator(sel('memo-row-expand')).click();
  r.check(await waitFor(async () => !(await row5.locator(sel('memo-row-body')).count())), '▼ = 다시 한 줄');
  const hint = page.locator(`${sel('memo-filter-nav')} ${sel('filter-help')}`);
  r.check(((await hint.textContent()) ?? '').includes('여러 개') && (await hint.isVisible()), "칩 아래 'Ctrl·Shift+누르기 = 여러 개' (옛 '?' - P11-1)");
  await page.locator(sel('memo-row', 'insp_mm1')).click();
  r.check(await waitFor(page.locator(`${sel('note-panel', 'edit')}[data-note-id="insp_mm1"]`)), '줄을 누르면 쓰는 칸');
  await page.keyboard.press('Escape');
  if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT });
  await page.reload();
  r.check(await waitFor(page.locator(sel('memo-row', 'insp_mm1')), 10000), '다시 열어도 목록 (이 기기 기억)');
  await page.goto(page.url().replace(/#.*$/, `#/day/${DAY}`));
  r.check(await waitFor(async () => (await page.locator(sel('memo-view-toggle')).count()) === 0), '다른 화면에는 단추가 없다');
  await page.goto(page.url().replace(/#.*$/, '#/memo'));
  await page.locator(sel('memo-view-toggle')).click();
  r.check(await waitFor(card('insp_mm1')), '▦ → 카드로');

  // 10-21 사용자: 메모를 고르고 다른 메모를 고르면 앞 것의 테두리는 빠져야 한다 - 오른쪽에 보이는 것 하나만
  r.section('파란 테두리 = 오른쪽 칸에 보이는 메모 하나 (10-21)');
  await chip('all').click();
  const ringed = () => page.locator(sel('entry-card')).evaluateAll((els) => els.filter((e) => e.className.includes('ring-primary')).map((e) => e.dataset.entryCard));
  const onlyRing = async (ids) => waitFor(async () => JSON.stringify(await ringed()) === JSON.stringify(ids));
  await card('insp_mm1').click();
  r.check(await onlyRing(['insp_mm1']), 'mm1을 누르면 mm1만');
  await card('insp_mm2').click();
  r.check(await waitFor(page.locator(`${sel('note-panel', 'edit')}[data-note-id="insp_mm2"]`)), 'mm2 칸이 새 탭으로');
  r.check(await onlyRing(['insp_mm2']), `mm2를 누르면 mm2만 - mm1 테두리는 빠진다 (${await ringed()})`);
  await page.locator('[data-side-tab]').first().locator('button').first().click();
  r.check(await onlyRing(['insp_mm1']), `탭으로 mm1을 보이면 mm1만 (${await ringed()})`);
  await page.locator(sel('memo-labels-settings')).click();
  r.check(await waitFor(page.locator(sel('labels-window'))), '라벨 관리 창이 탭으로');
  r.check(await onlyRing([]), `메모가 아닌 탭이 보이면 아무것도 짚지 않는다 (${await ringed()})`);
  await page.keyboard.press('Escape');
  r.check(await waitFor(async () => (await page.locator('[data-side-tab]').count()) === 0), 'ESC = 오른쪽 칸 모두 닫기');
  r.check(await onlyRing([]), '닫으면 테두리 없음');

  r.section('하루 메모 칸 라벨로 보기 (칩 줄은 접혀 시작 - 🏷️로 편다, P10-3)');
  await page.goto(page.url().replace(/#.*$/, `#/day/${DAY}`));
  await page.locator(sel('day-journal', DAY)).waitFor({ timeout: 8000 });
  const jf = page.locator(sel('journal-filter'));
  const jToggle = page.locator(sel('journal-filter-toggle'));
  if ((await jToggle.getAttribute('aria-expanded')) === 'true') await jToggle.click();
  r.check(await waitFor(async () => (await jf.count()) === 0), '칩 줄은 접혀 있다');
  await jToggle.click();
  r.check(await waitFor(jf), '🏷️ → 메모 칸 머리에 라벨 칩');
  await jf.locator(sel('filter-chip', 'insp_mlu')).click();
  const jIds = await page.locator(`${sel('day-journal', DAY)} ${sel('entry-card')}`).evaluateAll((els) => els.map((e) => e.dataset.entryCard));
  r.check(JSON.stringify(jIds) === '["insp_mj1"]', `고른 라벨의 기록만 (${jIds})`);
  await jf.locator(sel('filter-chip', 'all')).click();
  r.check(await waitFor(async () => (await page.locator(`${sel('day-journal', DAY)} ${sel('entry-card', 'insp_mj2')}`).count()) === 1), '전체 = 모두');
  r.check(hashOf(page).startsWith('#/day'), '하루 화면');
  await jToggle.click();
  r.check(await waitFor(async () => (await jf.count()) === 0), '🏷️ 다시 → 접힌다 (이 기기에 기억)');

  r.check(errors.length === 0, `화면 오류 없음 ${errors.join(' | ')}`);
} catch (e) {
  r.bad(`점검이 멈췄다: ${e?.stack ?? e}`);
} finally {
  await browser.close();
  await undo.run();
  r.done();
  process.exit();
}
