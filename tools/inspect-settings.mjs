// tools/inspect-settings.mjs - P1-4 끝 조건 중 설정을 크롬으로 본다.
//   1) ⋮ → 환경설정: 지금 있는 탭(보기·단축키·앱)만.
//   2) 글자 크기를 바꾸면 화면이 곧바로 바뀌고, 1초 뒤 계정(settings/pc)에 올라가 다른 창(같은 종류의 다른 기기)이 따라온다.
//   3) 단축키를 바꿔 저장하면 다른 창에서도 그 키로 돈다.
//   4) 시작 화면: 주소에 화면 없이 열면 그 화면, 새로고침은 보던 화면 그대로.
//   5) 계정 칸: 사진을 누르면 이름·메일·로그아웃 (■3에서 더한다).
//   6) 알림 소리 길이(P10-1): 계정(settings/common)에 올라가고 다른 창이 따라온다, 처음 값(10초)이면 문서에서 빠진다.
//   7) 개발자 탭(P14-2): 개발자 계정(?as=5 - npm run seed)에만 보인다.
//   8) 색 테마(P20-1): 보기 탭 견본 칩 → 곧바로 html data-palette·상태 표시줄 빛깔 → settings/common → 다른 기기·같은 기기의 다른 창(↗ 새 창)이 따라온다 ·
//      앱이 뜨기 전(index.html 스크립트)에 붙인다 · 기본으로 되돌리면 떼고 문서에서 빠진다.
//
//   npm run emu · npm run dev:emu (켜 둔다) → node tools/inspect-settings.mjs
// 에뮬레이터 teacher 계정의 V5 설정 문서(spaces/u_{uid}/settings/pc)를 쓴다 - 처음 것을 읽어 두고 끝에 되돌린다.
import { deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { seasonOf } from '../src/domain/decor.ts';
import { emulator, launch, newPage, open, report, restorer, sel, SITE, serverUntil, waitFor } from './lib/probe.mjs';

const r = report();
const em = emulator();
const uid = await em.signIn('teacher@example.com');
const pcRef = doc(em.db, 'spaces', `u_${uid}`, 'settings', 'pc');
const commonRef = doc(em.db, 'spaces', `u_${uid}`, 'settings', 'common');
const undo = restorer();
const commonBefore = await getDoc(commonRef);
undo.add(() => (commonBefore.exists() ? setDoc(commonRef, commonBefore.data()) : deleteDoc(commonRef)));
const before = await getDoc(pcRef);
undo.add(() => (before.exists() ? setDoc(pcRef, before.data()) : deleteDoc(pcRef)));
// 기본값에서 시작한다 (지난 점검이 남긴 것이 있으면 결과가 흔들린다)
await deleteDoc(pcRef);

const browser = await launch();
try {
  const a = await newPage(browser);
  const b = await newPage(browser);
  // 고른 단계 = html의 --font-scale (11-08 - 크기는 바탕(PC 90%) × 이 값, index.css)
  const fontOf = (p) => p.evaluate(() => document.documentElement.style.getPropertyValue('--font-scale') || '1');
  const serverPc = async () => (await getDoc(pcRef)).data() ?? {};

  r.section('환경설정 창');
  await open(a.page, '#/day/2026-10-08');
  await open(b.page, '#/day/2026-10-08');
  await a.page.click(sel('more-menu'));
  await a.page.click(sel('menu-item', 'settings'));
  r.check(await waitFor(a.page.locator(sel('settings-window'))), '⋮ → 환경설정이 열린다');
  const tabs = await a.page.locator(sel('settings-tab')).evaluateAll((els) => els.map((e) => e.dataset.settingsTab));
  r.check(tabs.join() === 'view,notify,school,shortcuts,app', `탭은 지금 있는 것만 (${tabs.join()})`);

  r.section('글자 크기 → 계정 → 다른 창');
  // PC 바탕 90% (11-08 사용자 요청 80% → 11-09 '좀 작다'로 90%). 점검 창 폭은 1400 - 16px × 0.9
  const pxOf = (p) => p.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
  r.check(Math.abs((await pxOf(a.page)) - 14.4) < 0.01, `PC '보통' = 90% (${await pxOf(a.page)}px)`);
  await a.page.click(sel('choice', 'fontScale:lg'));
  r.check((await fontOf(a.page)) === '1.15', '고르는 즉시 화면이 바뀐다');
  r.check(Math.abs((await pxOf(a.page)) - 14.4 * 1.15) < 0.01, `PC '크게' = 90% × 115% (${await pxOf(a.page)}px)`);
  const pc = await serverUntil(serverPc, (d) => d.fontScale === 'lg');
  r.check(pc.fontScale === 'lg', `settings/pc에 올라간다 (${JSON.stringify(pc)})`);
  r.check(await waitFor(async () => (await fontOf(b.page)) === '1.15'), `다른 창이 따라온다 (${await fontOf(b.page)})`);
  await a.page.click(sel('choice', 'fontScale:md'));
  const back = await serverUntil(serverPc, (d) => !('fontScale' in d));
  r.check(!('fontScale' in back), '보통으로 되돌리면 문서에서 그 칸이 빠진다');
  r.check(await waitFor(async () => (await fontOf(b.page)) === '1'), '다른 창도 보통으로');

  r.section('알림 소리 길이 → 계정 → 다른 창 (P10-1)');
  const serverCommon = async () => (await getDoc(commonRef)).data() ?? {};
  const commonCopy = (p) => p.evaluate(() => localStorage.getItem('sp5-common') || '');
  await a.page.click(sel('settings-tab', 'notify'));
  r.check((await a.page.getAttribute(sel('choice', 'alarmSound:10'), 'aria-pressed')) === 'true', '처음 값은 10초 (3초마다 3번)');
  await a.page.click(sel('choice', 'alarmSound:-1'));
  const snd = await serverUntil(serverCommon, (d) => d.alarmSound === -1);
  r.check(snd.alarmSound === -1, `'확인할 때까지' → settings/common에 올라간다 (${JSON.stringify(snd.alarmSound)})`);
  r.check(await waitFor(async () => (await commonCopy(b.page)).includes('"alarmSound":-1')), '다른 창이 따라온다');
  await a.page.click(sel('choice', 'alarmSound:10'));
  r.check(!('alarmSound' in (await serverUntil(serverCommon, (d) => !('alarmSound' in d)))), '10초로 되돌리면 문서에서 그 칸이 빠진다');

  r.section('단축키');
  await a.page.click(sel('settings-tab', 'shortcuts'));
  await a.page.click(`${sel('shortcut-row', 'settings')} ${sel('shortcut-key')}`);
  await a.page.keyboard.press('Control+Alt+KeyK');
  r.check((await a.page.inputValue(`${sel('shortcut-row', 'settings')} ${sel('shortcut-key')}`)) === 'K', '키 칸에 K가 들어간다');
  r.check((await a.page.locator(sel('settings-window')).count()) === 1, '누른 키가 화면 단축키로 올라가지 않는다');
  await a.page.click(sel('shortcut-save'));
  const sc = await serverUntil(serverPc, (d) => d.shortcutOverrides?.settings?.key === 'K');
  r.check(sc.shortcutOverrides?.settings?.key === 'K', '저장하면 계정에 올라간다');
  await waitFor(async () => (await b.page.evaluate(() => localStorage.getItem('sp5-shortcuts') || '')).includes('"K"'));
  await b.page.locator('main').click({ position: { x: 5, y: 5 } });
  await b.page.keyboard.press('Control+Alt+KeyK');
  r.check(await waitFor(b.page.locator(sel('settings-window'))), '다른 창에서 그 키로 환경설정이 열린다');
  await b.page.keyboard.press('Escape');
  await a.page.click(sel('shortcut-reset'));
  await a.page.click(sel('shortcut-save'));
  const sc2 = await serverUntil(serverPc, (d) => !d.shortcutOverrides);
  r.check(!sc2.shortcutOverrides, '기본값으로 되돌려 저장하면 칸이 빠진다');

  r.section('시작 화면');
  await a.page.click(sel('settings-tab', 'view'));
  await a.page.click(sel('choice', 'startupScope:memo'));
  await serverUntil(serverPc, (d) => d.startupScope === 'memo');
  await a.page.goto(SITE);
  await a.page.locator(sel('session', 'signed-in')).waitFor({ timeout: 20000 });
  r.check(await waitFor(a.page.locator(sel('screen', 'memo'))), '주소 없이 열면 시작 화면(메모)');
  await a.page.click(sel('scope-tab', 'week'));
  await a.page.reload();
  await a.page.locator(sel('session', 'signed-in')).waitFor({ timeout: 20000 });
  r.check(await waitFor(a.page.locator(sel('screen', 'week'))), '새로고침은 보던 화면(주간) 그대로');

  r.section('색 테마 (P20-1)');
  const palOf = (p) => p.evaluate(() => document.documentElement.getAttribute('data-palette'));
  const twin = await a.ctx.newPage(); // 같은 기기의 다른 창 (↗ 새 창처럼 - 같은 기기 저장소)
  await open(twin, '#/day/2026-10-08');
  await a.page.evaluate(() => window.sp5.openWindow('settings'));
  await waitFor(a.page.locator(sel('settings-window')));
  await a.page.click(sel('palette-pick', 'forest'));
  r.check((await palOf(a.page)) === 'forest', '누르는 즉시 화면에 (html data-palette)');
  r.check((await a.page.getAttribute(sel('palette-pick', 'forest'), 'aria-pressed')) === 'true', '고른 칩이 눌린 것');
  const meta = await a.page.evaluate(() => document.querySelector('meta[name="theme-color"]').content);
  r.check(meta !== '#2563eb' && meta !== '#0f1522', `상태 표시줄 빛깔도 테마 (${meta})`);
  const pal = await serverUntil(serverCommon, (d) => d.palette === 'forest');
  r.check(pal.palette === 'forest', 'settings/common에 올라간다');
  r.check(await waitFor(async () => (await palOf(b.page)) === 'forest', 8000), '다른 기기(같은 계정)도 따라온다');
  r.check(await waitFor(async () => (await palOf(twin)) === 'forest', 3000), '같은 기기의 다른 창(↗ 새 창)도 곧바로 (storage)');
  // 처음 그리기: 앱 모듈을 막아도 index.html 스크립트가 붙인다 (기본 파랑이 번쩍이지 않게)
  const bare = await a.ctx.newPage();
  await bare.route(/\/src\/main\.tsx/, (route) => route.abort());
  await bare.goto(SITE);
  r.check((await palOf(bare)) === 'forest', '앱이 뜨기 전(index.html 스크립트)에 붙인다');
  await bare.close();
  await a.page.click(sel('palette-pick', 'default'));
  r.check((await palOf(a.page)) === null, '기본으로 되돌리면 뗀다');
  const palBack = await serverUntil(serverCommon, (d) => d.palette === undefined);
  r.check(palBack.palette === undefined, '기본은 문서에서 빠진다');
  r.check(await waitFor(async () => (await palOf(twin)) === null, 3000), '다른 창도 기본으로');

  r.section('보기 쉽게 (P20-2)');
  const hasClass = (p, c) => p.evaluate((x) => document.documentElement.classList.contains(x), c);
  const toggle = (id) => a.page.click(sel('settings-toggle', id));
  await toggle('contrast');
  r.check(await hasClass(a.page, 'hc'), '고대비: 누르는 즉시 화면에 (html hc)');
  r.check(await waitFor(async () => hasClass(twin, 'hc'), 3000), '고대비: 같은 기기의 다른 창도 곧바로 (storage)');
  r.check(!(await hasClass(b.page, 'hc')), '고대비: 다른 기기는 그대로 (이 기기에만)');
  await toggle('dim');
  r.check(await hasClass(a.page, 'dim'), '어둡게를 부드럽게: 누르는 즉시 화면에 (html dim)');
  await toggle('cvd');
  r.check(await hasClass(a.page, 'cvd'), '색약 배려: 누르는 즉시 화면에 (html cvd)');
  const cvdOn = await serverUntil(serverCommon, (d) => d.cvd === true);
  r.check(cvdOn.cvd === true, '색약 배려: settings/common에 올라간다');
  r.check(await waitFor(async () => hasClass(b.page, 'cvd'), 8000), '색약 배려: 다른 기기(같은 계정)도 따라온다');
  const bareAids = await a.ctx.newPage();
  await bareAids.route(/\/src\/main\.tsx/, (route) => route.abort());
  await bareAids.goto(SITE);
  r.check((await hasClass(bareAids, 'hc')) && (await hasClass(bareAids, 'dim')) && (await hasClass(bareAids, 'cvd')), '앱이 뜨기 전(index.html 스크립트)에 셋 다 붙인다');
  await bareAids.close();
  await toggle('contrast');
  await toggle('dim');
  await toggle('cvd');
  r.check(!(await hasClass(a.page, 'hc')) && !(await hasClass(a.page, 'dim')) && !(await hasClass(a.page, 'cvd')), '끄면 셋 다 뗀다');
  const cvdOff = await serverUntil(serverCommon, (d) => d.cvd === undefined);
  r.check(cvdOff.cvd === undefined, '끄면(기본) 문서에서 빠진다');

  r.section('꾸미기 (P20-3 - 그림·글자 대비는 inspect-decor)');
  const season = seasonOf(await a.page.evaluate(() => new Date().toLocaleDateString('sv')));
  await a.page.click(sel('decor-pick', 'winter'));
  r.check(await waitFor(a.page.locator(sel('decor-band', 'winter'))), '누르는 즉시 머리줄 뒤에 그림');
  r.check((await a.page.getAttribute(sel('decor-pick', 'winter'), 'aria-pressed')) === 'true', '고른 칩이 눌린 것');
  const decorOn = await serverUntil(serverCommon, (d) => d.decor === 'winter');
  r.check(decorOn.decor === 'winter', 'settings/common에 올라간다');
  r.check(await waitFor(b.page.locator(sel('decor-band', 'winter')), 8000), '다른 기기(같은 계정)도 따라온다');
  await a.page.click(sel('decor-pick', 'season'));
  r.check(await waitFor(a.page.locator(sel('decor-band', season))), `계절 따라 = 오늘 계절 (${season})`);
  await a.page.click(sel('decor-pick', 'off'));
  r.check(await waitFor(async () => (await a.page.locator(sel('decor-band')).count()) === 0, 3000), '끄면 그림이 없다');
  const decorOff = await serverUntil(serverCommon, (d) => d.decor === undefined);
  r.check(decorOff.decor === undefined, '끄면(기본) 문서에서 빠진다');
  await twin.close();
  await a.page.keyboard.press('Escape');

  r.section('계정 칸');
  await a.page.click(sel('account'));
  r.check(await waitFor(a.page.locator(sel('account-panel'))), '사진을 누르면 계정 칸');
  const email = await a.page.locator(sel('account-email')).textContent();
  r.check(email === 'teacher@example.com', `메일이 보인다 (${email})`);
  r.check((await a.page.locator(sel('account-panel')).textContent()).includes('로그아웃'), '로그아웃 단추');
  await a.page.keyboard.press('Escape');
  // 글자 크기를 바꾸자마자 로그아웃해도 그 설정은 계정에 남는다(1초를 기다리지 않고 먼저 올린다)
  await a.page.evaluate(() => window.sp5.openWindow('settings'));
  await a.page.click(sel('choice', 'fontScale:xl'));
  await a.page.click(sel('account'));
  await a.page.click(sel('logout'));
  r.check(await waitFor(a.page.locator(sel('login-google')), 10000), '로그아웃하면 로그인 화면');
  const out = await serverUntil(serverPc, (d) => d.fontScale === 'xl', 5000);
  r.check(out.fontScale === 'xl', `바꾸자마자 로그아웃해도 설정이 올라가 있다 (${out.fontScale})`);

  r.section('개발자 탭 (P14-2 - 개발자 계정 ?as=5 에만)');
  const d = await newPage(browser);
  await open(d.page, '#/day/2026-10-08', { as: 5 });
  await d.page.evaluate(() => window.sp5.openWindow('settings'));
  await waitFor(d.page.locator(sel('settings-window')));
  const devTabs = await d.page.locator(sel('settings-tab')).evaluateAll((els) => els.map((e) => e.dataset.settingsTab));
  r.check(devTabs.join() === 'view,notify,school,shortcuts,app,dev', `개발자 계정은 개발자 탭까지 (${devTabs.join()})`);
  await d.page.click(sel('settings-tab', 'dev'));
  r.check(await waitFor(d.page.locator(sel('settings-section', 'dev-errors'))), '개발자 탭에 오류 기록 칸');

  r.check(a.errors.length + b.errors.length + d.errors.length === 0, '화면 오류 없음', `화면 오류: ${[...a.errors, ...b.errors, ...d.errors].join(' | ')}`);
} finally {
  await browser.close();
  // 창이 1초 뒤 올리는 것이 끝난 뒤에 되돌린다
  await new Promise((res) => setTimeout(res, 1500));
  await undo.run();
  r.done();
  process.exit();
}
