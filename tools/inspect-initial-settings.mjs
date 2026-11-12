// tools/inspect-initial-settings.mjs - P33-3 관리자 '처음 설정'(새 사용자 기본값)을 크롬으로 본다.
//   1) 관리자(?as=5)가 글자 크기·단축키·한눈에 경계선·색 테마를 바꾸고 환경설정 앱 탭 '👑 초기화 설정 - 새 사용자 기본값'(묻고)
//      → sharedConfig/initialSettings의 PC 몫 + 계정 몫(휴대폰 몫은 그대로) · 누가는 관리자만 읽는 admin/initialSettings · 저장한 때·누가가 보인다
//   2) 그때 만든 새 계정(?as=new-…)이 그 값으로 시작 - 화면 글자 크기·단축키·경계선·색 테마 + 계정 문서(settings/pc·common)가 생긴다 · '↩️ 초기화'도 처음 설정
//   3) 다른 관리자(그때 더한 관리자)가 다시 저장하면 그것이 이긴다 - 다음 새 계정은 그 값
//   4) 설정 문서가 있는 계정(?as=2)은 그대로
//
//   npm run emu · npm run seed(?as=5·?as=2) · npm run dev:emu (켜 둔다) → node tools/inspect-initial-settings.mjs
// ⚠️ 에뮬레이터만. 끝에 처음 설정·관리자 목록·바꾼 설정 문서를 되돌린다.
import { deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { emulator, launch, newPage, open, report, restorer, sel, serverUntil, waitFor } from './lib/probe.mjs';

const r = report();
const em = emulator();
const ADMIN = 'hyundonglim80@gmail.com';
const adminUid = await em.signIn(ADMIN);
const undo = restorer();

/** 문서 하나를 끝에 처음 모양으로 되돌린다 */
async function keep(ref) {
  const before = await getDoc(ref);
  undo.add(() => (before.exists() ? setDoc(ref, before.data()) : deleteDoc(ref)));
  return before;
}
const read = async (ref) => (await getDoc(ref)).data() ?? null;

const initialRef = doc(em.db, 'sharedConfig', 'initialSettings');
const logRef = doc(em.db, 'admin', 'initialSettings');
const adminsRef = doc(em.db, 'admin', 'admins');
const adminPc = doc(em.db, 'spaces', `u_${adminUid}`, 'settings', 'pc');
const adminCommon = doc(em.db, 'spaces', `u_${adminUid}`, 'settings', 'common');
for (const ref of [initialRef, logRef, adminsRef, adminPc, adminCommon]) await keep(ref);
// 휴대폰 몫만 있는 처음 설정에서 시작 - PC에서 저장해도 휴대폰 몫은 그대로여야 한다
const MOBILE = { prefs: { popupStyle: 'center' }, local: {}, at: 1 };
await setDoc(initialRef, { common: {}, at: 1, mobile: MOBILE });
await deleteDoc(logRef);
await deleteDoc(adminsRef);

/** Auth 에뮬레이터에 새 계정 (verify = 메일 확인 표시 - 관리자 규칙이 본다) */
async function makeAccount(tag, verify = false) {
  const who = `new-${tag}-${Date.now().toString(36)}`;
  const email = `${who}@example.com`;
  const res = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'test1234', returnSecureToken: true }),
  });
  const body = await res.json();
  if (verify) {
    await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/projects/schoolplannerv3/accounts:update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
      body: JSON.stringify({ localId: body.localId, emailVerified: true }),
    });
  }
  return { who, email, uid: body.localId, ok: res.ok };
}

// 화면 안 값 읽기·바꾸기 (앱 모듈 - CLAUDE.md 2장 __appModule)
const fontOf = (p) => p.evaluate(() => document.documentElement.style.getPropertyValue('--font-scale') || '1');
const paletteOf = (p) => p.evaluate(() => document.documentElement.getAttribute('data-palette') ?? '');
const appState = (p) =>
  p.evaluate(async () => {
    const board = (await import(window.__appModule('/src/app/boardPrefs.ts'))).useBoardPrefs.getState();
    const keys = (await import(window.__appModule('/src/app/keys.ts'))).useShortcutOverrides.getState();
    return { boardMain: board.main, overrides: keys.overrides };
  });
const K = { ctrl: true, alt: true, shift: false, key: 'K' };
const toastHas = (page, text) => waitFor(async () => (await page.locator(sel('toast')).allTextContents()).some((t) => t.includes(text)), 8000);
const openApp = async (page) => {
  await page.evaluate(() => window.sp5.openWindow('settings', { tab: 'app' }));
  await waitFor(page.locator(sel('reset-section')), 8000);
};
const adminAtText = (page) => page.locator(sel('reset-admin-at')).textContent();
// 계정 설정을 받기 전에 바꾸면 받은 값이 덮는다 - 받은 뒤에 바꾼다 (CLAUDE.md 2장 useCommonLoaded)
const commonLoaded = (page) =>
  waitFor(() => page.evaluate(async () => (await import(window.__appModule('/src/app/prefs.ts'))).useCommonLoaded.getState().loaded), 10000);

const browser = await launch();
try {
  r.section('관리자가 지금 설정을 처음 설정으로 (👑)');
  const a = await newPage(browser);
  await open(a.page, '#/day/2026-10-08', { as: 5 });
  r.check(await commonLoaded(a.page), '관리자 계정 설정을 받았다');
  // 글자 크기(하루 115%)는 단추로 · 단축키·경계선·색 테마는 앱 모듈로
  await a.page.evaluate(() => window.sp5.openWindow('settings', { tab: 'view' }));
  await waitFor(a.page.locator(sel('font-step', 'day:up')), 8000);
  for (let i = 0; i < 3; i++) await a.page.click(sel('font-step', 'day:up'));
  r.check((await fontOf(a.page)) === '1.15', '관리자 하루 글자 115%');
  await a.page.evaluate(async (k) => {
    (await import(window.__appModule('/src/app/keys.ts'))).setShortcutOverrides({ scopeMemo: k });
    (await import(window.__appModule('/src/app/boardPrefs.ts'))).setBoardSplit('main', 40);
    (await import(window.__appModule('/src/app/prefs.ts'))).setCommonSetting('palette', 'forest');
  }, K);
  await a.page.click(sel('settings-tab', 'app'));
  r.check(await waitFor(a.page.locator(sel('reset-admin-save')), 8000), "관리자에게 '👑 초기화 설정 - 새 사용자 기본값'");
  r.check(((await adminAtText(a.page)) ?? '').includes('처음 설정(새 사용자)이 없습니다'), 'PC 처음 설정은 아직 없다 (휴대폰 몫만 있음)');
  a.dialogs.answer = false;
  await a.page.click(sel('reset-admin-save'));
  await a.page.waitForTimeout(800);
  r.check(a.dialogs.seen.some((m) => m.includes('새 사용자의 처음 설정(PC)')), '저장 전에 묻는다');
  r.check((await read(initialRef))?.pc === undefined, "'아니오'면 저장하지 않는다");
  a.dialogs.answer = true;
  await a.page.click(sel('reset-admin-save'));
  r.check(await toastHas(a.page, '새 사용자의 처음 설정으로 저장했습니다 (PC)'), '저장했다는 안내');
  const saved = await serverUntil(() => read(initialRef), (d) => d?.pc?.prefs?.fontSizes?.day === 115);
  r.check(
    saved?.pc?.prefs?.fontSizes?.day === 115 && saved.pc.prefs.shortcutOverrides?.scopeMemo?.key === 'K' && saved.pc.local?.boardMain === 40 && saved.common?.palette === 'forest',
    `sharedConfig/initialSettings PC 몫 + 계정 몫 (${JSON.stringify({ prefs: saved?.pc?.prefs, local: saved?.pc?.local, common: saved?.common })})`,
  );
  r.check(JSON.stringify(saved?.mobile) === JSON.stringify(MOBILE), '휴대폰 몫은 그대로');
  r.check(!JSON.stringify(saved ?? {}).includes('@'), '모두가 읽는 문서에 관리자 메일이 없다');
  const log = await read(logRef);
  r.check(log?.pc?.by === ADMIN && log.pc.at === saved?.at, `누가 = 관리자만 읽는 admin/initialSettings (${log?.pc?.by})`);
  r.check(await waitFor(async () => /\d{4}-\d{2}-\d{2} \d{2}:\d{2}에 저장 · hyundonglim80@gmail\.com/.test((await adminAtText(a.page)) ?? ''), 8000), '저장한 때·누가가 보인다');

  r.section('새 계정이 처음 설정으로 시작');
  const n1 = await makeAccount('p333a');
  r.check(n1.ok, '새 계정을 만든다');
  const b = await newPage(browser);
  await open(b.page, '#/day/2026-10-08', { as: n1.who });
  r.check(await waitFor(async () => (await fontOf(b.page)) === '1.15', 10000), `하루 글자 115% (${await fontOf(b.page)})`);
  r.check(await waitFor(async () => (await paletteOf(b.page)) === 'forest', 5000), `색 테마 = 처음 설정 (${await paletteOf(b.page)})`);
  const st = await appState(b.page);
  r.check(st.overrides?.scopeMemo?.key === 'K', '단축키 = 처음 설정');
  r.check(st.boardMain === 40, `한눈에 경계선 = 처음 설정 (${st.boardMain})`);
  // 새 계정 문서는 그 계정만 읽는다 - 새 계정으로 읽는다
  const emN = emulator('inspect-new');
  await emN.signIn(n1.email);
  const n1PcData = await serverUntil(() => read(doc(emN.db, 'spaces', `u_${n1.uid}`, 'settings', 'pc')), (d) => d?.fontSizes?.day === 115);
  r.check(n1PcData?.fontSizes?.day === 115 && n1PcData.shortcutOverrides?.scopeMemo?.key === 'K', '새 계정 settings/pc가 생긴다 (다음부터 다시 입히지 않는다)');
  const n1CommonData = await serverUntil(() => read(doc(emN.db, 'spaces', `u_${n1.uid}`, 'settings', 'common')), (d) => d?.palette === 'forest');
  r.check(n1CommonData?.palette === 'forest', '새 계정 settings/common에 색 테마');
  await openApp(b.page);
  r.check((await b.page.getAttribute(sel('reset-section'), 'data-reset-section')) === 'admin', "새 계정의 '↩️ 초기화'도 처음 설정으로");
  r.check((await b.page.locator(sel('reset-admin-save')).count()) === 0, '관리자가 아니면 👑 단추가 없다');
  // 새로 열어도 그대로 (문서가 있어 다시 입히지 않는다 - 바꾼 값이 남는다)
  await b.page.evaluate(async () => (await import(window.__appModule('/src/app/layoutPrefs.ts'))).stepFontSize(-1, 'day'));
  await serverUntil(() => read(doc(emN.db, 'spaces', `u_${n1.uid}`, 'settings', 'pc')), (d) => d?.fontSizes?.day === 110);
  await b.page.reload();
  await b.page.locator(sel('session', 'signed-in')).waitFor({ timeout: 20000 });
  r.check(await waitFor(async () => (await fontOf(b.page)) === '1.1', 8000), `다시 열면 그 계정 값(110%) - 처음 설정을 다시 입히지 않는다 (${await fontOf(b.page)})`);

  r.section('다른 관리자가 다시 저장하면 그것이 이긴다');
  const a2 = await makeAccount('p333adm', true);
  await setDoc(adminsRef, { emails: [a2.email], updatedAt: Date.now(), updatedBy: ADMIN });
  const c = await newPage(browser);
  await open(c.page, '#/day/2026-10-08', { as: a2.who });
  // 더한 관리자도 처음 쓰는 계정이라 앞 관리자의 처음 설정으로 시작한다
  r.check(await waitFor(async () => (await fontOf(c.page)) === '1.15', 10000), `더한 관리자(새 계정)도 처음 설정 115%로 시작 (${await fontOf(c.page)})`);
  r.check(await commonLoaded(c.page), '더한 관리자 계정 설정을 받았다');
  // 하루 90% · 단축키·경계선·색 테마는 앱 기본으로
  await c.page.evaluate(async () => {
    (await import(window.__appModule('/src/app/layoutPrefs.ts'))).setFontSizes({ day: 90 });
    (await import(window.__appModule('/src/app/keys.ts'))).setShortcutOverrides({});
    (await import(window.__appModule('/src/app/boardPrefs.ts'))).setBoardSplit('main', null);
    (await import(window.__appModule('/src/app/prefs.ts'))).setCommonSetting('palette', 'default');
  });
  r.check((await fontOf(c.page)) === '0.9', '다른 관리자 하루 글자 90%');
  await openApp(c.page);
  r.check(await waitFor(c.page.locator(sel('reset-admin-save')), 8000), '더한 관리자에게도 👑');
  c.dialogs.answer = true;
  await c.page.click(sel('reset-admin-save'));
  r.check(await toastHas(c.page, '새 사용자의 처음 설정으로 저장했습니다'), '저장했다는 안내');
  const saved2 = await serverUntil(() => read(initialRef), (d) => d?.pc?.prefs?.fontSizes?.day === 90);
  r.check(saved2?.pc?.prefs?.fontSizes?.day === 90 && !saved2.pc.prefs.shortcutOverrides && saved2.common?.palette === undefined, '마지막 저장이 이긴다 (PC 몫·계정 몫 통째로)');
  r.check(JSON.stringify(saved2?.mobile) === JSON.stringify(MOBILE), '휴대폰 몫은 여전히 그대로');
  r.check((await read(logRef))?.pc?.by === a2.email, '누가 = 다른 관리자');
  r.check(await waitFor(async () => (await a.page.getAttribute(sel('reset-admin-at'), 'data-reset-admin-at')) === String(saved2?.at), 8000), '앞 관리자 화면도 새 저장 때를 받는다');
  const n2 = await makeAccount('p333b');
  const d = await newPage(browser);
  await open(d.page, '#/day/2026-10-08', { as: n2.who });
  r.check(await waitFor(async () => (await fontOf(d.page)) === '0.9', 10000), `다음 새 계정은 90% (${await fontOf(d.page)})`);
  r.check((await appState(d.page)).boardMain === null && (await paletteOf(d.page)) === '', '경계선·색 테마는 앱 기본 (마지막 저장에 없다)');

  r.section('설정 문서가 있는 계정은 그대로');
  const t2 = emulator('inspect-t2');
  const t2Uid = await t2.signIn('teacher2@example.com');
  const t2Pc = doc(t2.db, 'spaces', `u_${t2Uid}`, 'settings', 'pc');
  const t2Before = await getDoc(t2Pc);
  undo.add(() => (t2Before.exists() ? setDoc(t2Pc, t2Before.data()) : deleteDoc(t2Pc)));
  // 바꾼 것 없이 문서만 있는 계정 (기본값 = 빈 문서)
  await setDoc(t2Pc, {});
  const e = await newPage(browser);
  await open(e.page, '#/day/2026-10-08', { as: 2 });
  await e.page.waitForTimeout(2500);
  r.check((await fontOf(e.page)) === '1', `글자 크기 그대로 100% (${await fontOf(e.page)})`);
  r.check(JSON.stringify((await read(t2Pc)) ?? {}) === '{}', '설정 문서도 그대로');

  const errs = [...a.errors, ...b.errors, ...c.errors, ...d.errors, ...e.errors];
  r.check(errs.length === 0, '화면 오류 없음', errs.join(' | '));
} catch (err) {
  // 예외가 '✔ 모두 통과'로 끝나지 않게 (P23-2 · P26-1)
  r.check(false, '점검이 도중에 멈췄다', String(err?.stack ?? err));
} finally {
  await browser.close();
  await undo.run();
  r.done();
  process.exit();
}
