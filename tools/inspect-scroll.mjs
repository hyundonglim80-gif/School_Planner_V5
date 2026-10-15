// tools/inspect-scroll.mjs - P10-5 ■1: 스크롤 셋을 실제 크롬에서 본다.
//   1) 긴 메모 끝에서 쳐도 커서 줄이 쓰는 칸 안에 보인다(5f - 높이를 다시 잴 때 둘레 스크롤이 위로 당겨지지 않는다), 가운데 줄에서 쳐도 스크롤이 튀지 않는다.
//   2) 쓰는 칸의 표는 세로로 따로 스크롤하지 않는다(6f - 가로만 표 안에서).
//   3) 오른쪽 줄·왼쪽 클립보드 칸 위의 휠은 가운데 화면을 움직이지 않는다(6e - 칸에 스크롤할 것이 없거나 끝에 닿아도).
//
//   npm run emu · npm run dev:emu (켜 둔다) → node tools/inspect-scroll.mjs
// 에뮬레이터 teacher 계정의 개인 공간에 점검 메모(insp_sc…)를 심고 끝에 지운다.
import { deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { emulator, launch, newPage, open, report, restorer, sel, waitFor } from './lib/probe.mjs';

const r = report();
const em = emulator();
const uid = await em.signIn('teacher@example.com');
const sid = `u_${uid}`;
const undo = restorer();
const browser = await launch();

const DAY = '2026-10-08';
const itemRef = (id) => doc(em.db, 'spaces', sid, 'items', id);
const stamp = { deletedAt: null, updatedAt: serverTimestamp(), v: 1, createdAt: Date.now(), authorId: uid };
const LONG = Array.from({ length: 80 }, (_, i) => `점검스크롤 ${i + 1}번째 줄`).join('\n');
const rows = Array.from({ length: 60 }, (_, i) => ({ cells: [{ v: `행 ${i + 1}` }, { v: '내용' }] }));
const ITEMS = {
  insp_sc_long: { kind: 'note', date: DAY, text: LONG, labelIds: [], order: 'Zz1' },
  insp_sc_table: { kind: 'note', date: DAY, text: '점검스크롤 표', labelIds: [], order: 'Zz2', tables: [{ id: 'tb1', rows, createdAt: 1 }] },
};

/** 쓰는 칸 글 칸의 커서 줄이 둘레 스크롤 상자 안에 보이나 (커서 앞 글을 같은 글꼴 상자에 넣어 잰다) */
const caretVisible = (page) =>
  page.evaluate(() => {
    const el = document.activeElement;
    if (!(el instanceof HTMLTextAreaElement)) return { ok: false, why: '글 칸에 커서가 없다' };
    let box = el.parentElement;
    while (box && !(box.scrollHeight > box.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(box).overflowY))) box = box.parentElement;
    if (!box) return { ok: false, why: '스크롤 상자가 없다' };
    const cs = getComputedStyle(el);
    const m = document.createElement('div');
    for (const k of ['boxSizing', 'width', 'padding', 'border', 'font', 'letterSpacing', 'lineHeight', 'wordBreak']) m.style[k] = cs[k];
    Object.assign(m.style, { position: 'absolute', visibility: 'hidden', whiteSpace: 'pre-wrap', overflowWrap: 'break-word', top: '0', left: '-9999px' });
    m.textContent = el.value.slice(0, el.selectionEnd);
    const mark = m.appendChild(document.createElement('span'));
    mark.textContent = '.';
    document.body.appendChild(m);
    const top = el.getBoundingClientRect().top + mark.offsetTop;
    m.remove();
    const view = box.getBoundingClientRect();
    const line = parseFloat(cs.lineHeight) || 20;
    return { ok: top >= view.top - 1 && top + line <= view.bottom + 1, top: Math.round(top), view: [Math.round(view.top), Math.round(view.bottom)], scrollTop: box.scrollTop };
  });

try {
  for (const [id, data] of Object.entries(ITEMS)) {
    await setDoc(itemRef(id), { ...data, ...stamp });
    undo.add(() => deleteDoc(itemRef(id)));
  }
  const { page, errors, dialogs } = await newPage(browser);
  await open(page, `#/day/${DAY}`);

  r.section('긴 메모 끝에서 쓰기 (5f)');
  const card = page.locator(sel('entry-card', 'insp_sc_long'));
  r.check(await waitFor(card, 8000), '긴 메모 카드');
  await card.locator(sel('entry-edit')).click({ force: true });
  const panel = page.locator(sel('note-panel', 'edit'));
  r.check(await waitFor(panel), '수정 칸');
  const input = panel.locator(sel('note-text-input'));
  await input.click();
  await page.keyboard.press('Control+End');
  for (let i = 0; i < 6; i++) await page.keyboard.type(`\n점검스크롤 더 쓴 줄 ${i + 1}`);
  const end = await caretVisible(page);
  r.check(end.ok, `끝에서 친 줄이 보인다 ${JSON.stringify(end)}`);
  r.check(end.scrollTop > 0, '쓰는 칸이 아래로 따라갔다');
  // 가운데쯤(40번째 줄)에서 치면 그 자리가 그대로 보인다 (높이를 다시 재도 스크롤이 맨 위로 튀지 않는다)
  await input.evaluate((el) => {
    const at = el.value.indexOf('점검스크롤 40번째 줄');
    el.setSelectionRange(at, at);
  });
  await page.keyboard.press('End');
  await page.keyboard.type('!');
  await page.keyboard.press('Enter');
  await page.keyboard.type('가운데에 넣은 줄');
  const mid = await caretVisible(page);
  r.check(mid.ok, `가운데에서 친 줄도 보인다 ${JSON.stringify(mid)}`);
  r.check(mid.scrollTop > 0, '맨 위로 튀지 않았다');
  // 저장하지 않고 닫는다 (묻는 창에 '예')
  dialogs.answer = true;
  await page.keyboard.press('Escape');
  await waitFor(async () => (await panel.count()) === 0);
  dialogs.answer = false;

  r.section('쓰는 칸의 표는 세로로 따로 스크롤하지 않는다 (6f)');
  const table = page.locator(`${sel('note-panel', 'edit')} ${sel('note-table', 'tb1')}`);
  // 앞 칸이 닫히는 사이에 누르면 빠질 때가 있다 - 뜰 때까지 한 번 더
  for (let i = 0; i < 3 && !(await table.count()); i++) {
    await page.locator(sel('entry-card', 'insp_sc_table')).locator(sel('entry-edit')).click({ force: true });
    await waitFor(table, 3000);
  }
  r.check(await waitFor(table), '표가 있는 수정 칸');
  const boxes = await table.evaluate((el) =>
    [...el.querySelectorAll('div')].filter((d) => d.querySelector('table')).map((d) => ({ y: getComputedStyle(d).overflowY, h: d.scrollHeight - d.clientHeight })),
  );
  r.check(boxes.length > 0 && boxes.every((b) => b.y !== 'auto' && b.y !== 'scroll' && b.h <= 1), `표 상자에 세로 스크롤 없음 ${JSON.stringify(boxes)}`);
  await page.keyboard.press('Escape');

  r.section('옆 칸 위의 휠은 가운데 화면을 움직이지 않는다 (6e)');
  // 가운데 화면을 조금 내려 두고(내릴 것이 있게 창 높이를 줄인다), 짧은 창(D-Day)을 오른쪽 줄에 연다
  await page.setViewportSize({ width: 1400, height: 480 });
  await page.evaluate(() => window.scrollTo(0, 300));
  const before = await page.evaluate(() => window.scrollY);
  r.check(before > 0, `가운데 화면을 내릴 수 있다 (${before})`);
  await page.evaluate(() => window.sp5.openWindow('dday'));
  const column = page.locator('#side-column');
  r.check(await waitFor(column.locator(sel('side-slot'))), '오른쪽 줄에 창');
  const colBox = await column.boundingBox();
  await page.mouse.move(colBox.x + colBox.width / 2, colBox.y + colBox.height - 40);
  for (const dy of [400, -400, 400]) await page.mouse.wheel(0, dy);
  await page.waitForTimeout(300);
  r.check((await page.evaluate(() => window.scrollY)) === before, `오른쪽 줄 위 휠 - 가운데 그대로 (${await page.evaluate(() => window.scrollY)})`);
  // 비교: 가운데 위의 휠은 움직인다 (휠이 정말 들어갔나)
  await page.mouse.move(200, 500);
  await page.mouse.wheel(0, 200);
  r.check(await waitFor(async () => (await page.evaluate(() => window.scrollY)) !== before), '가운데 위의 휠은 가운데를 움직인다');
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.scrollTo(0, 300));
  const before2 = await page.evaluate(() => window.scrollY);
  await page.locator(sel('clipboard-toggle', 'closed')).click();
  const clip = page.locator(sel('clipboard-panel'));
  r.check(await waitFor(clip), '왼쪽 클립보드 칸');
  const clipBox = await clip.boundingBox();
  await page.mouse.move(clipBox.x + clipBox.width / 2, clipBox.y + clipBox.height - 40);
  for (const dy of [400, -400, 400]) await page.mouse.wheel(0, dy);
  await page.waitForTimeout(300);
  r.check((await page.evaluate(() => window.scrollY)) === before2, '클립보드 칸 위 휠 - 가운데 그대로');
  await page.locator(sel('clipboard-close')).click();

  // 긴 메모 칸을 끝까지 내린 뒤 더 내린다 (끝에 닿은 휠)
  await page.locator(sel('entry-card', 'insp_sc_long')).locator(sel('entry-edit')).click({ force: true });
  const longPanel = page.locator(sel('note-panel', 'edit'));
  r.check(await waitFor(longPanel), '긴 메모 칸');
  await page.evaluate(() => window.scrollTo(0, 300));
  const before3 = await page.evaluate(() => window.scrollY);
  const lp = await longPanel.boundingBox();
  for (const [fy, label] of [
    [0.5, '글 칸 위'],
    [0.98, '저장 줄 위'],
    [0.03, '머리 위'],
  ]) {
    await page.mouse.move(lp.x + lp.width / 2, lp.y + lp.height * fy);
    for (let i = 0; i < 25; i++) await page.mouse.wheel(0, 500);
    await page.waitForTimeout(300);
    r.check((await page.evaluate(() => window.scrollY)) === before3, `긴 칸 끝까지 내린 뒤 ${label} 휠 - 가운데 그대로 (${await page.evaluate(() => window.scrollY)})`);
  }
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
