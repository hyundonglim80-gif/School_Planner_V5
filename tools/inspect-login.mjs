// tools/inspect-login.mjs
//
// P1-2 끝 조건을 크롬으로 본다: 에뮬레이터 빌드에서 seed 계정으로 로그인하면
//   1) 화면이 로그인 상태가 되고(?as=2 는 두 번째 계정)
//   2) 서버에 spaces/u_{uid}(나 혼자 owner인 개인 공간)가 생기고
//   3) Firestore 오프라인 저장소(IndexedDB 'firestore/…')가 생기지 않는다(V4 09-22 - 구조로 확인).
//   4) 저장 안 한 칸이 있으면 로그아웃이 먼저 묻는다 - 아니오면 그대로, 예면 로그인 화면(P22-2).
//   5) 탭이 둘이어도 로그아웃 정리가 끝난다 - 이 기기 저장소가 모두 지워지고, 다른 탭도 나가며 구글 토큰을 잊는다(P22-4).
//
//   npm run emu · npm run dev:emu (켜 둔다) → node tools/inspect-login.mjs   (SITE=… 로 다른 주소)
// ⚠️ 에뮬레이터만 건드린다. 운영 자료와는 아무 상관이 없다.
import { deleteApp } from 'firebase/app';
import { doc, getDoc } from 'firebase/firestore';
import { emulator, launch, newPage, open, report, sel, serverUntil, waitFor } from './lib/probe.mjs';

const r = report();
const emu = emulator('inspect-login');
const browser = await launch();
try {
  for (const [as, email] of [['', 'teacher@example.com'], ['2', 'teacher2@example.com']]) {
    r.section(email);
    const { ctx, page, errors } = await newPage(browser);
    try {
      await open(page, '', { as });
      const who = await page.locator(sel('session', 'signed-in')).getAttribute('data-user');
      r.check(who === email, `로그인 화면에 ${email}`, `다른 계정으로 들어갔다: ${who}`);
    } catch {
      r.bad('로그인 상태가 되지 않았다');
    }

    const uid = await emu.signIn(email);
    const snap = await serverUntil(() => getDoc(doc(emu.db, 'spaces', `u_${uid}`)), (s) => s.exists());
    const d = snap.data();
    if (!snap.exists()) r.bad(`spaces/u_${uid}가 생기지 않았다`);
    else if (d.kind === 'personal' && d.ownerId === uid && d.members?.[uid] === 'owner' && Object.keys(d.members).length === 1 && d.v === 1)
      r.ok(`spaces/u_${uid} - 개인 공간, 나 혼자 owner`);
    else r.bad(`spaces/u_${uid} 모양이 다르다: ${JSON.stringify(d)}`);

    const idb = await page.evaluate(async () => (await indexedDB.databases()).map((x) => x.name));
    const fsStore = idb.filter((n) => n?.startsWith('firestore/'));
    r.check(
      fsStore.length === 0,
      `Firestore 오프라인 저장소 없음 (IndexedDB: ${idb.join(', ') || '없음'})`,
      `Firestore 오프라인 저장소가 생겼다: ${fsStore.join(', ')}`,
    );
    r.check(errors.length === 0, '화면 오류 없음', `화면 오류: ${errors.join(' / ')}`);
    await ctx.close();
  }

  r.section('로그아웃 전에 묻기 (P22-2)');
  const { ctx, page, errors, dialogs } = await newPage(browser);
  await open(page, '#/day/2026-10-08');
  await page.locator(sel('journal-add')).click();
  const box = page.locator(sel('note-text-input'));
  await waitFor(box);
  await box.fill('로그아웃 점검 글');
  const logoutNow = async () => {
    await page.click(sel('account'));
    await page.click(sel('logout'));
  };
  await logoutNow();
  r.check((await waitFor(() => dialogs.seen.length === 1)) && dialogs.seen[0].includes('저장하지 않은 칸'), '저장 안 한 칸이 있으면 먼저 묻는다', `물음: ${dialogs.seen.join(' / ')}`);
  await page.waitForTimeout(500);
  r.check((await page.locator(sel('session', 'signed-in')).count()) === 1 && (await box.inputValue()) === '로그아웃 점검 글', '아니오 → 로그인 그대로, 칸과 글이 남는다');
  dialogs.answer = true;
  await logoutNow();
  r.check(await waitFor(page.locator(sel('login-google')), 10000), '예 → 로그인 화면');
  r.check(errors.length === 0, '화면 오류 없음', `화면 오류: ${errors.join(' / ')}`);
  await ctx.close();

  r.section('탭이 둘이어도 로그아웃 정리가 끝난다 (P22-4)');
  const two = await newPage(browser);
  const tab2 = await two.ctx.newPage();
  await open(two.page, '#/day/2026-10-08');
  await open(tab2, '#/day/2026-10-08');
  const stores = (p) => p.evaluate(async () => (await indexedDB.databases()).map((x) => x.name).filter((n) => /^sp5-(mirror|drafts|clipboard)-/.test(n ?? '')).sort());
  r.check(await waitFor(async () => (await stores(tab2)).length === 3, 8000), '두 탭이 사본·쓰던 글·클립보드 저장소를 열어 둔다', (await stores(tab2)).join(', '));
  await tab2.evaluate(() => sessionStorage.setItem('sp5-google-token', 'tok'));
  await two.page.click(sel('account'));
  await two.page.click(sel('logout'));
  r.check(await waitFor(two.page.locator(sel('login-google')), 10000), '누른 탭 = 로그인 화면');
  r.check(await waitFor(async () => (await stores(two.page)).length === 0, 8000), '다른 탭이 열어 두어도 저장소가 모두 지워진다', (await stores(two.page)).join(', '));
  r.check(await waitFor(tab2.locator(sel('login-google')), 10000), '다른 탭도 로그인 화면');
  r.check((await tab2.evaluate(() => sessionStorage.getItem('sp5-google-token'))) === null, '다른 탭의 구글 토큰도 지워진다');
  r.check(two.errors.length === 0, '화면 오류 없음', `화면 오류: ${two.errors.join(' / ')}`);
  await two.ctx.close();
} catch (e) {
  r.bad(`점검이 멈췄다: ${e?.stack ?? e}`);
} finally {
  await browser.close();
  await deleteApp(emu.app).catch(() => {});
}
r.done();
