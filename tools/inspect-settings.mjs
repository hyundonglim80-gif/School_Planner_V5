// tools/inspect-settings.mjs - P1-4 끝 조건 중 설정을 크롬으로 본다.
//   1) ⋮ → 환경설정: 지금 있는 탭(보기·단축키·앱)만.
//   2) 글자 크기를 바꾸면 화면이 곧바로 바뀌고, 1초 뒤 계정(settings/pc)에 올라가 다른 창(같은 종류의 다른 기기)이 따라온다.
//   3) 단축키를 바꿔 저장하면 다른 창에서도 그 키로 돈다.
//   4) 시작 화면: 주소에 화면 없이 열면 그 화면, 새로고침은 보던 화면 그대로.
//   5) 계정 칸: 사진을 누르면 이름·메일·로그아웃 (■3에서 더한다).
//
//   npm run emu · npm run dev:emu (켜 둔다) → node tools/inspect-settings.mjs
// 에뮬레이터 teacher 계정의 V5 설정 문서(spaces/u_{uid}/settings/pc)를 쓴다 - 처음 것을 읽어 두고 끝에 되돌린다.
import { deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { emulator, launch, newPage, open, report, restorer, sel, SITE, serverUntil, waitFor } from './lib/probe.mjs';

const r = report();
const em = emulator();
const uid = await em.signIn('teacher@example.com');
const pcRef = doc(em.db, 'spaces', `u_${uid}`, 'settings', 'pc');
const undo = restorer();
const before = await getDoc(pcRef);
undo.add(() => (before.exists() ? setDoc(pcRef, before.data()) : deleteDoc(pcRef)));
// 기본값에서 시작한다 (지난 점검이 남긴 것이 있으면 결과가 흔들린다)
await deleteDoc(pcRef);

const browser = await launch();
try {
  const a = await newPage(browser);
  const b = await newPage(browser);
  const fontOf = (p) => p.evaluate(() => document.documentElement.style.fontSize || '100%');
  const serverPc = async () => (await getDoc(pcRef)).data() ?? {};

  r.section('환경설정 창');
  await open(a.page, '#/day/2026-10-08');
  await open(b.page, '#/day/2026-10-08');
  await a.page.click(sel('more-menu'));
  await a.page.click(sel('menu-item', 'settings'));
  r.check(await waitFor(a.page.locator(sel('settings-window'))), '⋮ → 환경설정이 열린다');
  const tabs = await a.page.locator(sel('settings-tab')).evaluateAll((els) => els.map((e) => e.dataset.settingsTab));
  r.check(tabs.join() === 'view,shortcuts,app,import', `탭은 지금 있는 것만 (${tabs.join()})`);

  r.section('글자 크기 → 계정 → 다른 창');
  await a.page.click(sel('choice', 'fontScale:lg'));
  r.check((await fontOf(a.page)) === '115%', '고르는 즉시 화면이 바뀐다');
  const pc = await serverUntil(serverPc, (d) => d.fontScale === 'lg');
  r.check(pc.fontScale === 'lg', `settings/pc에 올라간다 (${JSON.stringify(pc)})`);
  r.check(await waitFor(async () => (await fontOf(b.page)) === '115%'), `다른 창이 따라온다 (${await fontOf(b.page)})`);
  await a.page.click(sel('choice', 'fontScale:md'));
  const back = await serverUntil(serverPc, (d) => !('fontScale' in d));
  r.check(!('fontScale' in back), '보통으로 되돌리면 문서에서 그 칸이 빠진다');
  r.check(await waitFor(async () => (await fontOf(b.page)) === '100%'), '다른 창도 보통으로');

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

  r.check(a.errors.length + b.errors.length === 0, '화면 오류 없음', `화면 오류: ${[...a.errors, ...b.errors].join(' | ')}`);
} finally {
  await browser.close();
  // 창이 1초 뒤 올리는 것이 끝난 뒤에 되돌린다
  await new Promise((res) => setTimeout(res, 1500));
  await undo.run();
  r.done();
  process.exit();
}
