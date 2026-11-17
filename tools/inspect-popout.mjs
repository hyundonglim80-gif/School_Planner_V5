// tools/inspect-popout.mjs - 오른쪽 칸을 새 창으로 옮기기(10-28 사용자 요청)·휴대폰 새 메모 🔗 링크 추가(10-28 보고)를 실제 크롬에서 본다.
//   1) 쓰는 칸: 머리 ✕ 왼쪽에 ↗ → 누르면 새 창(팝업). 저장 안 한 새 메모는 먼저 저장하고 그 수정 칸으로 옮긴다 · 오른쪽 칸에서는 탭이 빠진다 ·
//      새 창은 창 가득 · 그 안에서 연 연결 창은 오른쪽 분할 칸(P43 - 새 창이 옆으로 넓어지고 처음 칸은 가려지지 않는다) ·
//      분할 칸 ↗ = 또 새 창(분할 칸이 비면 새 창은 제 폭으로) · ESC = 분할 칸만, 한 번 더 = 모두 닫고 새 창도 닫힌다.
//   2) 창(ModalShell - 검색): ↗ → 새 창에 그 창 하나, ✕ = 새 창이 닫힌다.
//   3) 휴대폰 390: ↗ 없음 · 빈 새 메모에서 🔗 = 칸이 남고 '먼저 적어 주세요' · 적은 뒤 🔗 = 저장하고 연결 창.
//   4) 분할 칸이 서면 새 창이 옆으로 넓어지고 닫히면 되돌아간다(P43) - 창 크기 흉내(viewport)를 끄고 화면을 1920으로 정한 크롬으로
//      (흉내 창은 새 창 크기·화면 폭이 고정이라 넓힐 수 없다 · 헤드리스 화면은 800이라 `--screen-info`).
//
//   npm run emu · npm run dev:emu (켜 둔다) → node tools/inspect-popout.mjs
// 에뮬레이터 teacher 계정의 개인 공간에 점검 메모('점검새창…'·'점검모바일링크…')를 만들고 끝에 지운다.
import { tmpdir } from 'node:os';
import { chromium } from 'playwright';
import { join } from 'node:path';
import { collection, deleteDoc, getDocs } from 'firebase/firestore';
import { browserOptions, emulator, launch, newPage, open, report, restorer, sel, serverUntil, waitFor } from './lib/probe.mjs';

const r = report();
const em = emulator();
const uid = await em.signIn('teacher@example.com');
const sid = `u_${uid}`;
const undo = restorer();
const browser = await launch();
const DAY = '2026-10-08';
const startedAt = Date.now();

const madeHere = async () => {
  const snap = await getDocs(collection(em.db, 'spaces', sid, 'items'));
  return snap.docs.filter((d) => (d.data().createdAt ?? 0) >= startedAt && /점검새창|점검모바일링크/.test(String(d.data().text)));
};
undo.add(async () => {
  for (const d of await madeHere()) await deleteDoc(d.ref);
});

/** 새 창이 열리기를 기다리며 누른다 */
async function clickForPopup(ctx, locator) {
  const [popup] = await Promise.all([ctx.waitForEvent('page', { timeout: 10000 }), locator.click()]);
  popup.on('pageerror', (e) => popupErrors.push(String(e)));
  await popup.locator(sel('session', 'signed-in')).waitFor({ timeout: 20000 });
  return popup;
}
const popupErrors = [];
const closed = (p, ms = 5000) => (p.isClosed() ? Promise.resolve(true) : p.waitForEvent('close', { timeout: ms }).then(() => true, () => false));

try {
  const { ctx, page, errors } = await newPage(browser);
  await open(page, `#/day/${DAY}`);
  await page.locator(sel('day-journal', DAY)).waitFor({ timeout: 8000 });

  r.section('쓰는 칸 ↗ 새 창으로 - 저장 안 한 새 메모는 먼저 저장');
  await page.locator(sel('journal-add')).click();
  const panel = page.locator(`#side-column ${sel('note-panel')}`);
  await waitFor(panel);
  await page.keyboard.type('점검새창 메모');
  const btn = page.locator(`#side-column ${sel('popout-open')}`);
  r.check((await btn.count()) === 1, '오른쪽 칸의 쓰는 칸 머리에 ↗ 하나');
  const pb = await btn.boundingBox();
  const xb = await panel.locator(sel('close')).first().boundingBox();
  r.check(pb && xb && pb.x < xb.x && xb.x - pb.x < 60 && Math.abs(pb.y - xb.y) < 8, `↗는 ✕ 바로 왼쪽 (↗ ${Math.round(pb?.x)} · ✕ ${Math.round(xb?.x)})`);
  r.check(/새 창/.test((await btn.getAttribute('title')) ?? ''), '↗ 설명 = 새 창으로 옮기기');

  const popup = await clickForPopup(ctx, btn);
  const pPanel = popup.locator(sel('note-panel', 'edit'));
  r.check(await waitFor(pPanel, 15000), '새 창 = 그 메모의 수정 칸 (먼저 저장했다)');
  const saved = await serverUntil(madeHere, (docs) => docs.length === 1);
  r.check(saved.length === 1 && saved[0].data().text === '점검새창 메모', `서버에 저장 (${saved.length}건)`);
  r.check((await pPanel.getAttribute('data-note-id')) === saved[0]?.id, '새 창의 칸 = 저장한 그 메모');
  r.check((await popup.locator(sel('note-text-input')).inputValue()) === '점검새창 메모', '적은 글 그대로');
  r.check((await popup.locator(sel('panel-frame', 'window')).count()) === 1, '새 창에서는 창 가득 (배경 없음)');
  const size = await popup.evaluate(() => [innerWidth, innerHeight]);
  r.check(size[0] >= 400 && size[0] <= 920 && size[1] >= 400, `새 창 크기 = 오른쪽 칸 폭쯤 (${size.join('×')})`);
  r.check((await popup.locator(sel('popout-open')).count()) === 0, '새 창 안에는 ↗ 없음');
  r.check(await waitFor(async () => (await page.locator(sel('note-panel')).count()) === 0), '오른쪽 칸에서는 그 탭이 빠진다');
  r.check(await waitFor(async () => (await page.locator('#side-column > *').count()) === 0), '오른쪽 줄이 비었다');
  const title = await popup.title();
  r.check(title.includes('메모'), `새 창 제목 (${title})`);

  r.section('새 창 안에서 연 창 = 오른쪽 분할 칸 (P43)');
  // (이 창은 크기 흉내라 새 창을 넓히지 못한다 - 넓히기는 맨 끝 묶음 4)
  await popup.locator(sel('note-link-add')).click();
  const splitLinker = popup.locator(`#side-column ${sel('linker')}`);
  r.check(await waitFor(splitLinker), '새 창에서 🔗 링크 추가 = 연결 창이 오른쪽 분할 칸에');
  r.check((await popup.locator(sel('popup-frame', 'center')).count()) === 0, '가운데 창이 아니다 (처음 칸을 가리지 않는다)');
  await popup.waitForTimeout(300);
  const fillBox = await popup.locator(sel('panel-frame', 'window')).boundingBox();
  const colBox = await popup.locator('#side-column').boundingBox();
  r.check(
    fillBox && colBox && Math.abs(fillBox.x + fillBox.width - colBox.x) <= 2 && fillBox.width >= 300,
    `메모 칸(왼쪽) | 분할 칸(오른쪽) - 겹치지 않는다 (메모 ${Math.round(fillBox?.width)} · 분할 ${Math.round(colBox?.width)})`,
  );
  r.check(await popup.locator(sel('note-text-input')).isVisible(), '메모 글 칸이 그대로 보인다');
  const splitPop = popup.locator(`#side-column ${sel('popout-open')}`);
  r.check((await splitPop.count()) === 1 && (await popup.locator(`${sel('panel-frame', 'window')} ${sel('popout-open')}`).count()) === 0, '↗는 분할 칸에만 (메모 칸에는 없다)');
  r.check((await popup.locator(sel('column-resizer', 'right')).count()) === 1 && (await popup.locator(sel('close-column')).count()) === 1, '분할 칸 경계선·▶');

  r.section('분할 칸 ↗ = 또 새 창');
  const grand = await clickForPopup(ctx, splitPop);
  r.check(await waitFor(grand.locator(sel('popout', 'linker')), 15000), '분할 칸이 또 새 창으로 (연결 창)');
  r.check(await waitFor(async () => (await popup.locator('#side-column > *').count()) === 0), '분할 칸에서 빠진다');
  r.check((await popup.locator(sel('note-panel')).count()) === 1, '메모 칸 새 창은 그대로');
  const gGone = closed(grand);
  await grand.locator(sel('close')).first().click().catch(() => {});
  r.check(await gGone, '또 연 새 창 ✕ = 그 창만 닫힌다');

  r.section('새 창 ESC = 분할 칸만 → 한 번 더 = 모두');
  await popup.locator(sel('note-link-add')).click();
  r.check(await waitFor(splitLinker), '다시 🔗 = 분할 칸');
  await popup.keyboard.press('Escape');
  r.check(await waitFor(async () => (await popup.locator('#side-column > *').count()) === 0), 'ESC = 분할 칸만 닫힌다');
  r.check(!popup.isClosed() && (await popup.locator(sel('note-panel')).count()) === 1, '메모 칸 새 창은 남는다');
  const gone = closed(popup);
  // 누르는 사이(keydown 뒤) 창이 닫혀 keyup을 보낼 곳이 없다 - 그것이 맞다
  await popup.keyboard.press('Escape').catch(() => {});
  r.check(await gone, '분할 칸이 없을 때 ESC = 모두 닫고 새 창도 닫힌다');

  r.section('창(검색) ↗');
  await page.evaluate(() => window.sp5.openWindow('search'));
  const sBtn = page.locator(`#side-column ${sel('popout-open')}`);
  r.check(await waitFor(sBtn), '오른쪽 칸 창(검색) 머리에도 ↗');
  const sPopup = await clickForPopup(ctx, sBtn);
  r.check(await waitFor(sPopup.locator(sel('popout', 'search')), 10000), '새 창 = 검색 창');
  r.check(await waitFor(sPopup.locator(sel('popup-frame', 'window')), 10000), '창 가득');
  r.check(await waitFor(async () => (await page.locator('#side-column > *').count()) === 0), '오른쪽 칸에서 빠진다');
  await sPopup.locator(sel('search-input')).fill('회의').catch(() => {});
  const sGone = closed(sPopup);
  await sPopup.locator(sel('close')).first().click().catch(() => {});
  r.check(await sGone, '✕ = 새 창이 닫힌다');

  r.section("단축키 '보고 있는 칸 새 창으로 빼기' (#125)");
  await page.evaluate(() => window.sp5.openWindow('search'));
  await waitFor(page.locator(`#side-column ${sel('popout-open')}`));
  const [kPopup] = await Promise.all([ctx.waitForEvent('page', { timeout: 10000 }), page.evaluate(() => window.sp5.runShortcut('popOut'))]);
  kPopup.on('pageerror', (e) => popupErrors.push(String(e)));
  r.check(await waitFor(kPopup.locator(sel('popout', 'search')), 20000), '단축키 = 칸 머리 ↗와 같다 (보이는 탭이 새 창으로)');
  r.check(await waitFor(async () => (await page.locator('#side-column > *').count()) === 0), '오른쪽 칸에서 빠진다');
  const kGone = closed(kPopup);
  await kPopup.locator(sel('close')).first().click().catch(() => {});
  r.check(await kGone, '✕ = 새 창이 닫힌다');
  await page.evaluate(() => window.sp5.runShortcut('popOut'));
  r.check(await waitFor(page.locator(sel('toast')).filter({ hasText: '옮길 칸' })), '오른쪽에 칸이 없으면 안내');
  r.check(errors.length === 0 && popupErrors.length === 0, `화면 오류 없음 ${[...errors, ...popupErrors].join(' / ')}`);
  await ctx.close();

  r.section('휴대폰 390 - 새 메모 🔗 링크 추가');
  const m = await newPage(browser, { width: 390, height: 800, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await open(m.page, `#/day/${DAY}`);
  await m.page.locator(sel('day-journal', DAY)).waitFor({ timeout: 8000 });
  await m.page.locator(sel('journal-add')).click();
  const mPanel = m.page.locator(sel('note-panel', 'new'));
  r.check(await waitFor(mPanel), '새 메모 칸 (배너)');
  r.check((await m.page.locator(sel('popout-open')).count()) === 0, '휴대폰에는 ↗ 없음');
  await m.page.locator(sel('note-link-add')).tap();
  await m.page.waitForTimeout(400);
  r.check((await mPanel.count()) === 1, '빈 새 메모에서 🔗 = 칸이 닫히지 않는다 (보고된 증상)');
  r.check((await m.page.locator(sel('linker')).count()) === 0, '연결 창은 열지 않는다');
  r.check(((await m.page.locator(sel('toast')).allTextContents()).join(' ')).includes('메모 내용을 먼저'), "'메모 내용을 먼저 적어 주세요' 안내");
  await m.page.locator(sel('note-text-input')).fill('점검모바일링크 메모');
  await m.page.locator(sel('note-link-add')).tap();
  r.check(await waitFor(m.page.locator(sel('linker')), 8000), '적은 뒤 🔗 = 연결 창이 뜬다');
  r.check((await m.page.locator(sel('note-panel', 'edit')).count()) === 1, '메모 칸은 저장되어 수정 칸으로 뒤에 남는다');
  const mSaved = await serverUntil(madeHere, (docs) => docs.some((d) => d.data().text === '점검모바일링크 메모'));
  r.check(mSaved.some((d) => d.data().text === '점검모바일링크 메모'), '서버에 저장');
  const lb = await m.page.locator(sel('linker')).boundingBox();
  r.check(lb && lb.width > 300 && lb.y < 800, `연결 창이 화면 안에 보인다 (${Math.round(lb?.width)}px)`);
  await m.page.screenshot({ path: process.env.SHOT || join(tmpdir(), 'popout-mobile-linker.png') });
  r.check(m.errors.length === 0, `휴대폰 화면 오류 없음 ${m.errors.join(' / ')}`);
  await m.ctx.close();

  r.section('분할 칸이 서면 새 창이 넓어지고, 다 닫히면 되돌아간다 (P43 - 진짜 창 크기)');
  const real = await chromium.launch({ ...browserOptions(), args: ['--window-size=1400,900', '--screen-info={1920x1080}'] });
  try {
    const R = await newPage(real, { viewport: null });
    await open(R.page, `#/day/${DAY}`);
    await R.page.locator(sel('day-journal', DAY)).waitFor({ timeout: 8000 });
    await R.page.locator(sel('journal-add')).click();
    await waitFor(R.page.locator(`#side-column ${sel('note-panel')}`));
    await R.page.keyboard.type('점검새창 넓히기');
    const rp = await clickForPopup(R.ctx, R.page.locator(`#side-column ${sel('popout-open')}`));
    await waitFor(rp.locator(sel('note-panel', 'edit')), 15000);
    // 사용자가 새 창을 오른쪽 칸 폭쯤으로 둔 모습 (헤드리스는 window.open 크기를 받지 않는다)
    await rp.evaluate(() => {
      window.resizeTo(540, 800);
      window.moveTo(1300, 40);
    });
    const at = () => rp.evaluate(() => ({ x: window.screenX, w: window.outerWidth, iw: window.innerWidth }));
    r.check(await waitFor(async () => (await at()).w === 540, 3000), `새 창 540 · 1300 (${JSON.stringify(await at())})`);
    const before = await at();
    await rp.locator(sel('note-link-add')).click();
    r.check(await waitFor(rp.locator(`#side-column ${sel('linker')}`)), '🔗 = 분할 칸');
    r.check(await waitFor(async () => (await at()).w === 1080, 5000), `새 창이 두 배로 넓어진다 (${before.w} → ${(await at()).w})`);
    r.check((await at()).x === 840, `오른쪽이 화면(1920)을 넘어 왼쪽으로 옮긴다 (1300 → ${(await at()).x})`);
    await rp.waitForTimeout(300);
    const fb = await rp.locator(sel('panel-frame', 'window')).boundingBox();
    const cb = await rp.locator('#side-column').boundingBox();
    r.check(
      fb && cb && Math.abs(fb.x + fb.width - cb.x) <= 2 && Math.abs(fb.width - before.iw) <= 24 && Math.abs(cb.width - fb.width) <= 4,
      `메모 칸은 폭 그대로 · 분할 칸이 반 (메모 ${Math.round(fb?.width)} · 분할 ${Math.round(cb?.width)} · 처음 ${before.iw})`,
    );
    // 경계선을 끌면 그 새 창 안에서만 폭이 바뀐다 (큰 창 오른쪽 칸 폭은 그대로)
    const bigW = await R.page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--right-column-w'));
    const rz = await rp.locator(sel('column-resizer', 'right')).boundingBox();
    await rp.mouse.move(rz.x + rz.width / 2 + 2, rz.y + 200);
    await rp.mouse.down();
    await rp.mouse.move(rz.x - 120, rz.y + 200, { steps: 6 });
    await rp.mouse.up();
    const cb2 = await rp.locator('#side-column').boundingBox();
    r.check(cb2 && cb2.width > cb.width + 80, `경계선 끌기 = 분할 칸 폭 (${Math.round(cb.width)} → ${Math.round(cb2?.width)})`);
    r.check((await R.page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--right-column-w'))) === bigW, '큰 창 오른쪽 칸 폭은 그대로');
    await rp.locator(`#side-column ${sel('linker')}`).locator('xpath=ancestor::*[@data-side-slot]').locator(sel('close')).first().click();
    r.check(await waitFor(async () => (await rp.locator('#side-column > *').count()) === 0), '분할 칸 ✕ = 분할 칸이 닫힌다');
    r.check(await waitFor(async () => (await at()).w === 540, 5000), `새 창은 처음 폭으로 (${(await at()).w})`);
    r.check((await at()).x === 1300, `제자리로 (${(await at()).x})`);
    // 넓힌 동안 사용자가 크기를 바꾸면 되돌리지 않는다
    await rp.locator(sel('note-link-add')).click();
    await waitFor(async () => (await at()).w === 1080, 5000);
    await rp.evaluate(() => window.resizeTo(1200, 800));
    await waitFor(async () => (await at()).w === 1200, 3000);
    await rp.keyboard.press('Escape');
    r.check(await waitFor(async () => (await rp.locator('#side-column > *').count()) === 0), 'ESC = 분할 칸만');
    await rp.waitForTimeout(500);
    r.check((await at()).w === 1200, `넓힌 뒤 사용자가 바꾼 크기는 그대로 (${(await at()).w})`);
    r.check(R.errors.length === 0 && popupErrors.length === 0, `화면 오류 없음 ${[...R.errors, ...popupErrors].join(' / ')}`);
  } finally {
    await real.close();
  }
} catch (e) {
  console.error(e);
  r.check(false, `점검 중 오류: ${e.message}`);
} finally {
  await undo.run();
  await browser.close();
  r.done();
  process.exit();
}
