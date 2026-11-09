// 점검: 창 위치 '팝업창'이면 왼쪽 📋 = 클립보드 팝업창 (#138·#140 11-09 - 메모 요청이 고쳤고 PC에서 크롬으로 확인)
//   1) 📋 = 브라우저 팝업창(?popout={"id":"clipboard"}), 이 기기의 클립보드 목록, 큰 창에는 왼쪽 칸이 열리지 않는다, 다시 누르면 그 팝업창
//   2) 메모 팝업창 글 칸에서 쓰다가 클립보드 팝업창 항목을 누르면 그 커서 자리에 붙는다
//   3) 글을 쓰던 창을 닫았으면 시스템 클립보드에 담는다(Ctrl+V)
// 창 위치는 계정 설정(PC) - 문서로 바꾸고 끝에 되돌린다(CLAUDE.md 2장 - 기기 저장소만 바꾸면 계정 값이 이긴다).
import { deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { emulator, launch, newPage, open, report, sel, waitFor } from './lib/probe.mjs';

const r = report();
const em = emulator();
const uid = await em.signIn('teacher@example.com');
const pcRef = doc(em.db, 'spaces', `u_${uid}`, 'settings', 'pc');
const DAY = '2026-10-08';
const CLIP = '점검 클립 글';
const before = await getDoc(pcRef);
const pcNow = before.exists() ? before.data() : null;
const browser = await launch();
try {
  await setDoc(pcRef, { ...(pcNow ?? {}), popupStyle: 'popup', v: 1 });
  const { ctx, page, errors } = await newPage(browser);
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(process.env.SITE || 'http://localhost:5175/').origin });
  await open(page, `#/day/${DAY}`);
  await page.locator(sel('day-journal', DAY)).waitFor({ timeout: 8000 });
  const mod = (path) => page.evaluate(async (p) => Object.keys(await import(window.__appModule(p))), path);
  await mod('/src/data/clipboard.ts');
  // 계정의 창 위치(팝업창)를 받고, 이 기기 클립보드를 읽은 뒤
  r.check(
    await waitFor(
      () =>
        page.evaluate(async () => {
          const prefs = await import(window.__appModule('/src/app/layoutPrefs.ts'));
          const clip = await import(window.__appModule('/src/data/clipboard.ts'));
          return prefs.useLayoutPrefs.getState().popupStyle === 'popup' && clip.useClipboard.getState().loaded;
        }),
      10000,
    ),
    '창 위치 = 팝업창 (계정 설정)',
  );
  await page.evaluate(async (t) => (await import(window.__appModule('/src/data/clipboard.ts'))).addClipText(t), CLIP);

  r.section('📋 = 클립보드 팝업창');
  const toggle = page.locator(sel('clipboard-toggle'));
  const [clip] = await Promise.all([ctx.waitForEvent('page', { timeout: 10000 }), toggle.click()]);
  // 팝업창은 about:blank로 열린 뒤 주소로 간다
  await clip.waitForURL(/popout=/, { timeout: 10000 }).catch(() => {});
  r.check(new URL(clip.url()).searchParams.get('popout')?.includes('"clipboard"'), '누르면 브라우저 팝업창 (클립보드)', clip.url());
  r.check(await waitFor(clip.locator(sel('clipboard-panel')), 20000), '팝업창 안에 클립보드 목록');
  const item = clip.locator('[data-clip-paste]').filter({ hasText: CLIP });
  r.check(await waitFor(item, 8000), '이 기기의 클립보드 항목이 보인다');
  r.check((await page.locator(sel('clipboard-panel')).count()) === 0, '큰 창에는 왼쪽 칸이 열리지 않는다');
  const pagesBefore = ctx.pages().length;
  await toggle.click();
  await page.waitForTimeout(800);
  r.check(ctx.pages().length === pagesBefore && !clip.isClosed(), '다시 누르면 새로 띄우지 않고 그 팝업창', `창 ${ctx.pages().length}개`);

  r.section('항목 누르기 = 마지막으로 글을 쓰던 창의 커서 자리');
  const [memo] = await Promise.all([ctx.waitForEvent('page', { timeout: 10000 }), page.locator(sel('journal-add')).click()]);
  const input = memo.locator(sel('note-text-input'));
  r.check(await waitFor(input, 20000), '새 메모도 팝업창 (창 위치 팝업창)');
  await input.click();
  await memo.keyboard.type('앞 ');
  await item.click();
  r.check(await waitFor(async () => (await input.inputValue()).includes(`앞 ${CLIP}`), 5000), '메모 팝업창 커서 자리에 붙는다', await input.inputValue());

  r.section('글을 쓰던 창을 닫았으면 시스템 클립보드에 담는다');
  await clip.evaluate(() => navigator.clipboard.writeText('-'));
  await memo.close();
  await item.click();
  r.check(await waitFor(async () => (await clip.evaluate(() => navigator.clipboard.readText())) === CLIP, 6000), '시스템 클립보드에 담았다 (Ctrl+V)');
  r.check(!page.isClosed() && !clip.isClosed(), '큰 창·클립보드 팝업창은 그대로');

  r.section('다른 창에서 복사한 것도 곧바로 · ESC로 닫기 (설명서 clipboard)');
  await page.evaluate(async () => (await import(window.__appModule('/src/data/clipboard.ts'))).addClipText('점검 큰 창 복사'));
  r.check(await waitFor(clip.locator('[data-clip-paste]').filter({ hasText: '점검 큰 창 복사' }), 5000), '큰 창에서 담은 것이 팝업창 목록에 곧바로');
  // 창을 닫게 하는 키는 keydown 사이에 팝업이 닫혀 press가 '닫혔다'로 실패한다 - 닫힘은 close 사건으로 (CLAUDE.md 2장)
  await clip.locator(sel('clipboard-panel')).click({ position: { x: 20, y: 10 } });
  const closed = clip.waitForEvent('close', { timeout: 5000 }).then(() => true, () => false);
  await clip.keyboard.press('Escape').catch(() => {});
  r.check(await closed, 'ESC = 클립보드 팝업창 닫기');

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
