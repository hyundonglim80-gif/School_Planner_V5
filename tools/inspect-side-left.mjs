// 점검: 창 위치 '왼쪽 칸' (P47-2 11-19 사용자 요청 - 창 칸을 왼쪽·오른쪽 중 환경설정에서 고르기)
//   1) 왼쪽 칸이면 창 칸이 화면 왼쪽에 서고 화면이 오른쪽으로 밀린다 · ◀ 손잡이·경계선·📋 단추가 칸의 안쪽(오른쪽) 가장자리
//   2) 경계선 끌기 = 폭 바꾸기(왼쪽 칸은 오른쪽으로 끌면 넓어진다) · 두 번 누르면 기본 폭
//   3) 📋 클립보드 탭도 같은 칸 · 탭 둘이면 위에 탭 · ESC = 칸 모두 닫기(화면 밀기도 걷힘, 📋는 왼쪽 가장자리)
//   4) 칸 위의 휠은 칸 안에서만 · 한눈에 화면도 남은 폭 안에(가로 넘침 없음)
//   5) 환경설정 '창 위치' = 오른쪽 칸 · 왼쪽 칸 · 팝업창 - 고르면 열린 칸이 곧바로 옮겨 가고 계정 문서(settings/pc sideAt)에 남는다
//   6) ↗ 새 창은 큰 창 왼쪽에 연다 · 새 창 안 분할 칸은 늘 오른쪽
// 창 위치는 계정 설정(PC) - 문서로 바꾸고 끝에 되돌린다(CLAUDE.md 2장 - 기기 저장소만 바꾸면 계정 값이 이긴다).
//   npm run emu · npm run dev:emu (켜 둔다) → node tools/inspect-side-left.mjs
import { deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { emulator, launch, newPage, open, report, sel, serverUntil, waitFor } from './lib/probe.mjs';

const r = report();
const em = emulator();
const uid = await em.signIn('teacher@example.com');
const pcRef = doc(em.db, 'spaces', `u_${uid}`, 'settings', 'pc');
const DAY = '2026-10-08';
const before = await getDoc(pcRef);
const pcNow = before.exists() ? before.data() : null;
const browser = await launch();
const read = async () => (await getDoc(pcRef)).data();

try {
  await setDoc(pcRef, { ...(pcNow ?? {}), popupStyle: 'side', sideAt: 'left', v: 1 });
  const { page, errors, dialogs } = await newPage(browser);
  await page.addInitScript(() => {
    try {
      localStorage.setItem('sp5_theme', 'light');
    } catch {
      /* about:blank */
    }
  });
  await open(page, `#/day/${DAY}`);
  await page.locator(sel('day-journal', DAY)).waitFor({ timeout: 8000 });
  r.check(
    await waitFor(() => page.evaluate(async () => (await import(window.__appModule('/src/app/layoutPrefs.ts'))).useLayoutPrefs.getState().sideAt === 'left'), 10000),
    '창 칸 쪽 = 왼쪽 (계정 설정)',
  );
  const col = page.locator('#side-column');
  const box = (l) => l.boundingBox();
  const shellPad = () => page.evaluate(() => getComputedStyle(document.querySelector('main').parentElement).paddingLeft);

  r.section('왼쪽 칸 - 창 칸이 왼쪽에, 화면은 오른쪽으로');
  r.check((await page.locator(sel('clipboard-toggle')).getAttribute('data-clipboard-edge')) === 'left' && (await box(page.locator(sel('clipboard-toggle')))).x < 2, '칸이 없을 때 📋 = 화면 왼쪽 가장자리');
  await page.locator(sel('journal-add')).click();
  await page.locator(sel('note-text-input')).waitFor({ timeout: 8000 });
  await page.waitForTimeout(400); // 화면 밀기 움직임(0.2초)
  const c0 = await box(col);
  r.check((await col.getAttribute('data-side-column')) === 'left' && c0.x < 1 && c0.width > 300, `창 칸이 화면 왼쪽 (x ${Math.round(c0.x)} · 폭 ${Math.round(c0.width)})`);
  const pad = parseFloat(await shellPad());
  const mainLeft = (await box(page.locator('main'))).x;
  r.check(Math.abs(pad - c0.width) < 2 && mainLeft >= c0.width - 1, `화면을 칸 폭만큼 오른쪽으로 민다 (밀기 ${pad} · 본문 ${Math.round(mainLeft)})`);
  r.check((await page.evaluate(() => getComputedStyle(document.querySelector('main').parentElement).paddingRight)) === '0px', '오른쪽은 밀지 않는다');
  const grip = page.locator(sel('close-column', 'left'));
  const g = await box(grip);
  r.check((await grip.textContent()) === '◀' && Math.abs(g.x - c0.width) < 2, `◀ 손잡이 = 칸 오른쪽 가장자리 (${Math.round(g.x)})`);
  const clipBtn = await box(page.locator(sel('clipboard-toggle')));
  r.check(Math.abs(clipBtn.x - c0.width) < 2 && clipBtn.y + clipBtn.height <= g.y + 1, `📋 = 그 바로 위 (${Math.round(clipBtn.x)}, 아래 끝 ${Math.round(clipBtn.y + clipBtn.height)} ≤ ${Math.round(g.y)})`);
  r.check((await page.locator(sel('column-resizer', 'right')).count()) === 0, '오른쪽 경계선은 없다');

  r.section('경계선 끌기 · 두 번 누르기');
  const rz = await box(page.locator(sel('column-resizer', 'left')));
  r.check(Math.abs(rz.x + rz.width / 2 - c0.width) < 3, `경계선 = 칸 오른쪽 가장자리 (${Math.round(rz.x + rz.width / 2)})`);
  await page.mouse.move(rz.x + 4, 400);
  await page.mouse.down();
  await page.mouse.move(rz.x + 124, 400, { steps: 5 });
  await page.mouse.up();
  const w1 = (await box(col)).width;
  await page.locator(sel('column-resizer', 'left')).dblclick({ position: { x: 3, y: 100 } }); // 가운데 높이는 ◀ 손잡이가 덮는다(오른쪽 칸의 ▶와 같은 모양)
  const w2 = (await box(col)).width;
  r.check(w1 > c0.width + 100 && Math.abs(w2 - c0.width) < 2, `오른쪽으로 끌면 넓어진다 ${Math.round(c0.width)} → ${Math.round(w1)}, 두 번 누르면 ${Math.round(w2)}`);

  r.section('📋 클립보드 탭도 같은 칸 · ESC');
  await page.evaluate(async () => (await import(window.__appModule('/src/data/clipboard.ts'))).addClipText('점검 왼쪽 칸 클립'));
  await page.locator(sel('clipboard-toggle')).click();
  r.check(await waitFor(page.locator(`#side-column ${sel('clipboard-panel')}`), 5000), '📋 = 왼쪽 칸에 클립보드 탭');
  r.check((await page.locator(sel('side-tab')).count()) === 2, `탭 둘 (${await page.locator(sel('side-tab')).count()})`);
  // 휠 가두기 - 칸 위의 휠은 가운데 화면을 움직이지 않는다
  await page.evaluate(() => window.scrollTo(0, 0));
  const cb = await box(col);
  await page.mouse.move(cb.x + cb.width / 2, 300);
  await page.mouse.wheel(0, 600);
  await page.waitForTimeout(300);
  r.check((await page.evaluate(() => window.scrollY)) === 0, `칸 위의 휠은 화면을 움직이지 않는다 (scrollY ${await page.evaluate(() => window.scrollY)})`);
  await page.locator('[data-clip-paste]').filter({ hasText: '점검 왼쪽 칸 클립' }).click();
  r.check(await waitFor(async () => (await page.locator(sel('note-text-input')).inputValue()).includes('점검 왼쪽 칸 클립'), 5000), '항목을 누르면 메모 칸에 붙고 그 탭으로');
  await page.locator('main').click({ position: { x: 5, y: 5 } });
  dialogs.answer = true; // 저장 안 한 메모 글 - ESC가 먼저 묻는다
  await page.keyboard.press('Escape');
  r.check(await waitFor(async () => (await page.locator('#side-column > *').count()) === 0, 5000), `ESC = 칸 모두 닫기 (${dialogs.seen.at(-1) ?? '묻지 않음'})`);
  dialogs.answer = false;
  await page.waitForTimeout(400);
  r.check(parseFloat(await shellPad()) === 0 && (await box(page.locator(sel('clipboard-toggle')))).x < 2, '화면 밀기가 걷히고 📋는 왼쪽 가장자리로');

  r.section('한눈에 화면 - 남은 폭 안에');
  await page.goto(page.url().replace(/#.*/, `#/board/${DAY}`));
  await page.locator('[data-screen="board"]').waitFor({ timeout: 8000 });
  await page.evaluate(() => window.sp5.openWindow('settings', { tab: 'view' }));
  await page.locator(sel('settings-section', 'popupStyle')).waitFor({ timeout: 8000 });
  await page.waitForTimeout(500);
  const board = await box(page.locator('[data-screen="board"]'));
  const cw = (await box(col)).width;
  r.check(
    board.x >= cw - 1 && (await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)),
    `한눈에가 칸 오른쪽에 넘침 없이 (x ${Math.round(board.x)} ≥ ${Math.round(cw)})`,
  );

  r.section('환경설정 창 위치 = 오른쪽 칸 · 왼쪽 칸 · 팝업창');
  const choices = await page.locator(`${sel('settings-section', 'popupStyle')} [data-choice]`).evaluateAll((els) => els.map((e) => e.dataset.choice));
  r.check(choices.join() === 'popupStyle:side,popupStyle:left,popupStyle:popup', `고르기 셋 ${choices.join(' · ')}`);
  r.check((await page.locator(sel('choice', 'popupStyle:left')).getAttribute('aria-pressed')) === 'true', '왼쪽 칸이 눌려 있다');
  await page.locator(sel('choice', 'popupStyle:side')).click();
  await page.waitForTimeout(400);
  const cr = await box(col);
  r.check(
    (await col.getAttribute('data-side-column')) === 'right' && Math.abs(cr.x + cr.width - 1400) < 2 && (await page.locator(sel('close-column', 'right')).textContent()) === '▶',
    `오른쪽 칸을 고르면 열린 칸이 곧바로 오른쪽으로 (x ${Math.round(cr.x)}) · ▶`,
  );
  r.check((await serverUntil(read, (d) => d?.sideAt === undefined || d?.sideAt === 'right')) !== null, '계정 문서에 오른쪽 (sideAt 칸 걷힘)');
  await page.locator(sel('choice', 'popupStyle:left')).click();
  await page.waitForTimeout(400);
  r.check((await col.getAttribute('data-side-column')) === 'left' && (await box(col)).x < 1, '왼쪽 칸을 고르면 다시 왼쪽으로');
  r.check((await serverUntil(read, (d) => d?.sideAt === 'left' && d?.popupStyle === 'side')) !== null, '계정 문서 settings/pc sideAt = left');
  await page.waitForTimeout(2500); // 계정 설정은 1초 뒤 올라간다 - 닫기 전에

  r.section('↗ 새 창 = 큰 창 왼쪽에 · 그 안 분할 칸은 오른쪽');
  await page.evaluate(() => {
    const open = window.open.bind(window);
    window.__openFeatures = [];
    window.open = (url, name, features) => {
      window.__openFeatures.push(String(features ?? ''));
      return open(url, name, features);
    };
  });
  const ctx = page.context();
  const popoutBtn = page.locator(`#side-column ${sel('popout-open')}:visible`);
  if (await waitFor(popoutBtn, 3000)) {
    const [popup] = await Promise.all([ctx.waitForEvent('page', { timeout: 10000 }), popoutBtn.click()]);
    const features = await page.evaluate(() => window.__openFeatures.at(-1) ?? '');
    const left = Number(/left=(-?\d+)/.exec(features)?.[1]);
    const sx = await page.evaluate(() => window.screenX);
    r.check(Number.isFinite(left) && left <= sx + 8, `새 창 자리 = 큰 창 왼쪽 (${features})`);
    await popup.waitForURL(/popout=/, { timeout: 10000 }).catch(() => {});
    await popup.locator(sel('settings-section', 'popupStyle')).waitFor({ timeout: 20000 });
    r.check((await popup.locator(sel('choice', 'popupStyle:left')).getAttribute('aria-pressed')) === 'true', '새 창의 환경설정도 왼쪽 칸 (같은 값)');
    await popup.evaluate(() => window.sp5.openWindow('help'));
    const split = popup.locator('#side-column');
    r.check(await waitFor(async () => (await split.locator('> *').count()) > 0, 8000), '새 창 안에서 연 창 = 분할 칸');
    r.check((await split.getAttribute('data-side-column')) === 'right', '새 창 안 분할 칸은 오른쪽 (P43 그대로)');
    await popup.close();
  } else r.bad('환경설정 창에 ↗ 단추가 없다');

  r.check(errors.length === 0, `화면 오류 없음 ${errors.join(' | ')}`);
} catch (e) {
  r.bad(`점검이 멈췄다: ${e?.stack ?? e}`);
} finally {
  await browser.close();
  if (pcNow) await setDoc(pcRef, pcNow);
  else await deleteDoc(pcRef);
  r.done();
  process.exit();
}
