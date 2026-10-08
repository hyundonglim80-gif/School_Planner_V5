// tools/inspect-pwa.mjs - 앱으로 설치할 수 있는가 (P1-4 ■5. P8-3에서 오프라인·공유받기를 더한다).
//   - 매니페스트 오류 없음, 서비스 워커가 선다, 크롬이 말하는 '설치 못 하는 까닭'이 없다(CDP Page.getInstallabilityErrors).
//   - 크롬이 설치 이벤트를 보내 환경설정 '앱' 탭의 '📱 앱으로 설치'가 설치 창을 띄울 수 있다(data-install-pwa="ready").
// 보통 점검 창(newPage)은 시크릿 같은 새 프로필이라 크롬이 'in-incognito'로 설치를 막는다 - 여기서만 임시 프로필을 쓴다.
//
//   npm run emu · npm run dev:emu (켜 둔다) → node tools/inspect-pwa.mjs     (SITE=https://… 로 실제 주소)
import { chromium } from 'playwright';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { report, sel, SITE, waitFor } from './lib/probe.mjs';

const r = report();
const dir = mkdtempSync(join(tmpdir(), 'sp5-pwa-'));
const ctx = await chromium.launchPersistentContext(dir, { channel: 'chrome', viewport: { width: 1400, height: 900 } });
try {
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(SITE + '#/day/2026-10-08');
  await page.locator(sel('session', 'signed-in')).waitFor({ timeout: 20000 });
  const cdp = await ctx.newCDPSession(page);

  r.section('매니페스트·서비스 워커');
  const man = await cdp.send('Page.getAppManifest');
  r.check(man.url.endsWith('/manifest.json') && man.errors.length === 0, `매니페스트 오류 없음 (${JSON.stringify(man.errors)})`);
  const sw = await waitFor(async () => !!(await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.active)), 10000);
  r.check(sw, '서비스 워커가 선다 (/sw.js)');

  r.section('설치');
  let inst = [];
  await waitFor(async () => {
    inst = (await cdp.send('Page.getInstallabilityErrors')).installabilityErrors;
    return inst.length === 0;
  }, 8000);
  r.check(inst.length === 0, `크롬이 말하는 설치 못 하는 까닭이 없다 (${inst.map((e) => e.errorId).join(', ')})`);
  await page.evaluate(() => window.sp5.openWindow('settings', { tab: 'app' }));
  const ready = await waitFor(page.locator(sel('install-pwa', 'ready')), 8000);
  r.check(ready, "설치 이벤트를 받아 '📱 앱으로 설치'가 설치 창을 띄울 수 있다");
  r.check(errors.length === 0, '화면 오류 없음', `화면 오류: ${errors.join(' | ')}`);
} finally {
  await ctx.close();
  rmSync(dir, { recursive: true, force: true });
  r.done();
}
