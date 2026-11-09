// 점검: 창 위치 '팝업창'에서 단축키 탭 (P28-1) - 단축키 설정 띠는 큰 창에만 있다.
//   1) 팝업창 환경설정 → 단축키 탭 → 줄의 '키 바꾸기' = 팝업창이 닫히고 큰 창에 그 기능의 키 띠
//   2) 큰 창에서 키 → 저장 = 계정 · 환경설정이 다시 팝업창으로 열려 그 줄을 짚는다
//   3) 팝업창 '⌨️ 단축키 설정' = 팝업창이 닫히고 큰 창에 고르기 띠
// 창 위치·단축키는 계정 설정(PC) - 문서로 바꾸고 끝에 되돌린다(CLAUDE.md 2장).
//   npm run emu · npm run dev:emu (켜 둔다) → node tools/inspect-shortcut-popup.mjs
import { deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { emulator, launch, newPage, open, report, sel, serverUntil, waitFor } from './lib/probe.mjs';

const r = report();
const em = emulator();
const uid = await em.signIn('teacher@example.com');
const pcRef = doc(em.db, 'spaces', `u_${uid}`, 'settings', 'pc');
const before = await getDoc(pcRef);
const pcNow = before.exists() ? before.data() : null;
const serverPc = async () => (await getDoc(pcRef)).data() ?? {};
const browser = await launch();
try {
  // 기본 키에서 시작 (창 위치만 팝업창)
  await setDoc(pcRef, { popupStyle: 'popup', v: 1 });
  const { ctx, page, errors } = await newPage(browser);
  await open(page, '#/day/2026-10-08');
  r.check(
    await waitFor(() => page.evaluate(async () => (await import(window.__appModule('/src/app/layoutPrefs.ts'))).useLayoutPrefs.getState().popupStyle === 'popup'), 10000),
    '창 위치 = 팝업창 (계정 설정)',
  );
  const openSettingsPopup = async () => {
    await page.click(sel('more-menu'));
    const [pop] = await Promise.all([ctx.waitForEvent('page', { timeout: 10000 }), page.click(sel('menu-item', 'settings'))]);
    await pop.waitForURL(/popout=/, { timeout: 10000 }).catch(() => {});
    await pop.locator(sel('settings-window')).waitFor({ timeout: 20000 });
    return pop;
  };

  r.section('팝업창 환경설정 → 키 바꾸기 = 큰 창의 띠');
  const pop = await openSettingsPopup();
  r.check(new URL(pop.url()).searchParams.get('popout')?.includes('"settings"'), '환경설정이 팝업창으로');
  await pop.click(sel('settings-tab', 'shortcuts'));
  await pop.locator(sel('shortcut-change', 'scopeMemo')).click();
  r.check(await waitFor(() => pop.isClosed(), 8000), '팝업창은 닫힌다');
  r.check(await waitFor(page.locator(sel('shortcut-record', 'key')), 8000), '큰 창에 키 띠');
  r.check(((await page.locator(sel('shortcut-record', 'key')).textContent()) ?? '').includes("'메모 화면'"), "띠에 '메모 화면'");
  const [again] = await Promise.all([
    ctx.waitForEvent('page', { timeout: 10000 }),
    (async () => {
      await page.keyboard.press('Control+Alt+KeyJ');
      await page.click(sel('shortcut-record-save'));
    })(),
  ]);
  const saved = await serverUntil(serverPc, (d) => d.shortcutOverrides?.scopeMemo?.key === 'J');
  r.check(saved.shortcutOverrides?.scopeMemo?.key === 'J', '저장 = 계정 (메모 화면 Ctrl + Alt + J)');
  await again.waitForURL(/popout=/, { timeout: 10000 }).catch(() => {});
  r.check(await waitFor(again.locator(`${sel('shortcut-row', 'scopeMemo')}[data-shortcut-row-focus]`), 20000), '환경설정이 다시 팝업창으로 열려 그 줄을 짚는다');
  r.check((await again.locator(`${sel('shortcut-row', 'scopeMemo')} ${sel('shortcut-key')}`).textContent()) === 'Ctrl + Alt + J', '그 줄 = Ctrl + Alt + J');

  r.section("팝업창 '⌨️ 단축키 설정' = 큰 창의 고르기 띠");
  await again.click(sel('shortcut-record-start'));
  r.check(await waitFor(() => again.isClosed(), 8000), '팝업창은 닫힌다');
  r.check(await waitFor(page.locator(sel('shortcut-record', 'pick')), 8000), '큰 창에 고르기 띠');
  await page.click(sel('shortcut-record-cancel'));
  r.check(await waitFor(async () => (await page.locator(sel('shortcut-record')).count()) === 0), '취소 = 띠가 걷힌다');

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
