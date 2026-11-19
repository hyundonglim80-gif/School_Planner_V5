// 메모 표 만들기·고르기 점검 (P48 - 세션마다 늘린다, 구글 흉내 없이 · 날짜에 기대지 않는다).
//   1) ▦ 표 = 빈 표 3 × 3 → A1부터 친다 · Tab = 옆 칸 · 마지막 칸 Tab = 새 행 · 고치던 글도 Ctrl+S에 → 서버 tables → 카드에 표
//   2) ▦ 표만 만들고 비워 두면 표 없이 (글만 저장)
// 실행: 에뮬레이터 + 개발 서버(npm run dev:emu) 켠 채 node tools/inspect-table.mjs
import { collection, deleteDoc, getDocs } from 'firebase/firestore';
import { emulator, launch, newPage, open, report, restorer, sel, serverUntil, waitFor } from './lib/probe.mjs';

const r = report();
const em = emulator();
const uid = await em.signIn('teacher@example.com');
const sid = `u_${uid}`;
const undo = restorer();
const browser = await launch();
const DAY = '2026-10-08';
const MARK = '점검표만들기';
const startedAt = Date.now();

const madeHere = async () => {
  const snap = await getDocs(collection(em.db, 'spaces', sid, 'items'));
  return snap.docs.filter((d) => (d.data().createdAt ?? 0) >= startedAt && String(d.data().text).includes(MARK));
};
undo.add(async () => {
  for (const d of await madeHere()) await deleteDoc(d.ref);
});
/** 지금 초점이 든 표 칸 ('행-열') */
const focusedCell = (page) => page.evaluate(() => document.activeElement?.closest('[data-cell]')?.getAttribute('data-cell') ?? null);
const cellTexts = (doc) => doc?.tables?.map((t) => t.rows.map((row) => row.cells.map((c) => c.v)));

try {
  const { page, errors } = await newPage(browser);
  await open(page, `#/day/${DAY}`);
  await page.locator(sel('day-journal', DAY)).waitFor({ timeout: 8000 });

  r.section('▦ 표 = 빈 표 3 × 3 (P48-1)');
  await page.locator(sel('journal-add')).click();
  const panel = page.locator(sel('note-panel'));
  await waitFor(panel);
  await page.keyboard.type(`${MARK} 학급비`);
  await page.locator(sel('note-table-add')).click();
  const table = panel.locator(sel('note-table'));
  r.check(await waitFor(table), '▦ 표 = 본문 아래에 표');
  r.check((await table.locator('td[data-cell]').count()) === 9, `3행 × 3열 (${await table.locator('td[data-cell]').count()}칸)`);
  r.check((await focusedCell(page)) === '0-0', `곧바로 A1을 고친다 (${await focusedCell(page)})`);
  await page.keyboard.type('이름');
  await page.keyboard.press('Tab');
  await page.keyboard.type('금액');
  await page.keyboard.press('Tab');
  r.check((await focusedCell(page)) === '0-2', 'Tab = 옆 칸');
  await page.keyboard.press('Tab');
  r.check((await focusedCell(page)) === '1-0', '줄 끝 Tab = 다음 줄 첫 칸');
  for (let i = 0; i < 5; i++) await page.keyboard.press('Tab');
  r.check((await focusedCell(page)) === '2-2', '마지막 칸');
  await page.keyboard.press('Tab');
  r.check((await table.locator('tr').count()) === 4, `마지막 칸 Tab = 새 행 (${await table.locator('tr').count()}행)`);
  r.check((await focusedCell(page)) === '3-0', `새 행 첫 칸으로 (${await focusedCell(page)})`);
  await page.keyboard.type('합계');
  // 칸을 떠나지 않고 Ctrl+S - 고치던 글도 함께 저장된다
  await page.keyboard.press('Control+s');
  r.check(await waitFor(async () => (await panel.getAttribute('data-note-panel')) === 'edit', 8000), 'Ctrl+S → 수정 칸');
  const id = await panel.getAttribute('data-note-id');
  const saved = await serverUntil(async () => (await madeHere()).find((d) => d.id === id)?.data(), (d) => !!d?.tables);
  const texts = JSON.stringify(cellTexts(saved));
  r.check(texts === '[[["이름","금액",""],["","",""],["","",""],["합계","",""]]]', `서버: 표 칸 (고치던 '합계'까지 - ${texts})`);
  r.check(!!saved?.tables?.[0]?.id?.startsWith('tb_') && JSON.stringify(saved).indexOf('undefined') < 0, '서버: 표 id·빈 값 없음');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  const card = page.locator(sel('entry-card', id));
  r.check(await waitFor(card), '메모 카드');
  r.check(await waitFor(card.locator(sel('entry-table'))), '카드에 표가 작게');

  r.section('▦ 표만 만들고 비워 두면 표 없이');
  await waitFor(async () => (await panel.count()) === 0, 5000);
  await page.locator(sel('journal-add')).click();
  await waitFor(panel);
  await page.keyboard.type(`${MARK} 빈 표`);
  await page.locator(sel('note-table-add')).click();
  await waitFor(table);
  await page.keyboard.press('Escape'); // 칸 고치기 멈춤
  await page.locator(sel('note-text-input')).click();
  await page.keyboard.press('Control+s');
  r.check(await waitFor(async () => (await panel.getAttribute('data-note-panel')) === 'edit', 8000), '저장 → 수정 칸');
  const id2 = await panel.getAttribute('data-note-id');
  const saved2 = await serverUntil(async () => (await madeHere()).find((d) => d.id === id2)?.data(), (d) => !!d);
  r.check(!!saved2 && saved2.tables === undefined, `서버: 글만 (표 칸 없음 - ${JSON.stringify(saved2?.tables)})`);
  r.check(await waitFor(async () => (await table.count()) === 0, 3000), '저장한 뒤 빈 표는 칸에서도 빠진다');
  await page.keyboard.press('Escape');

  r.check(errors.length === 0, `화면 오류 없음 ${errors.join(' | ')}`);
} catch (e) {
  r.bad(`점검이 멈췄다: ${e?.stack ?? e}`);
} finally {
  await browser.close();
  await undo.run();
  r.done();
  process.exit();
}
