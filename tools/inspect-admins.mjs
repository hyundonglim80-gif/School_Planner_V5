// tools/inspect-admins.mjs - P33-1 관리자 계정을 크롬으로 본다.
//   1) 기본 관리자(?as=5)의 환경설정 '관리자' 탭(옛 '개발자') - 관리자 계정 절에 기본 셋은 🔒(빼기 없음)
//   2) 메일 확인된 새 계정(그때 만든 ?as=new-…)을 더하기 - 틀린 모양·기본 셋은 안내만, 서버 admin/admins에 소문자로
//   3) 그 계정이 새로 열면 '관리자' 탭·오류 기록·관리자 계정(나) - 규칙도 관리자로 통과(오류 기록을 읽는다)
//   4) 빼기(묻고) → 서버 목록에서 빠짐 → 그 계정이 다시 열면 탭이 없다
//
//   npm run emu · npm run seed(?as=5) · npm run dev:emu (켜 둔다) → node tools/inspect-admins.mjs
// ⚠️ 에뮬레이터만. 끝에 admin/admins를 지운다.
import { deleteDoc, doc, getDoc } from 'firebase/firestore';
import { emulator, launch, newPage, open, report, restorer, sel, serverUntil, waitFor } from './lib/probe.mjs';

const r = report();
const em = emulator();
await em.signIn('hyundonglim80@gmail.com');
const undo = restorer();
const adminsRef = doc(em.db, 'admin', 'admins');
const serverList = async () => {
  const snap = await getDoc(adminsRef);
  return snap.exists() ? (snap.data().emails ?? []) : [];
};
await deleteDoc(adminsRef);
undo.add(() => deleteDoc(adminsRef));

// 그때 만든 새 계정 + 메일 확인 표시(구글 로그인처럼 - 규칙 isAdmin이 본다)
const who = `new-p331-${Date.now().toString(36)}`;
const email = `${who}@example.com`;
const made = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password: 'test1234', returnSecureToken: true }),
});
const madeBody = await made.json();
const verified = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/projects/schoolplannerv3/accounts:update', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
  body: JSON.stringify({ localId: madeBody.localId, emailVerified: true }),
});

const toastHas = (page, text) => waitFor(async () => (await page.locator(sel('toast')).allTextContents()).some((t) => t.includes(text)), 5000);
const openAdminTab = async (page) => {
  await page.evaluate(() => window.sp5.openWindow('settings', { tab: 'dev' }));
  await waitFor(page.locator(sel('settings-window')), 8000);
};

const browser = await launch();
try {
  r.check(made.ok && verified.ok, '메일 확인된 새 계정을 만든다', `${made.status}·${verified.status}`);

  r.section("기본 관리자 - 환경설정 '관리자' 탭");
  const d = await newPage(browser);
  await open(d.page, '#/day/2026-10-08', { as: 5 });
  await openAdminTab(d.page);
  r.check(await waitFor(d.page.locator(sel('settings-panel', 'dev'))), '관리자 탭으로 열린다');
  r.check(((await d.page.locator(sel('settings-tab', 'dev')).textContent()) ?? '').trim() === '관리자', "탭 이름 '관리자'");
  const section = d.page.locator(sel('admins-section'));
  r.check(await waitFor(section), '관리자 계정 절이 맨 위에');
  r.check((await section.locator('[data-admin-base]').count()) === 3, '기본 관리자 셋 = 🔒');
  r.check((await section.locator('[data-admin-base] [data-admin-remove]').count()) === 0, '기본 셋은 빼기 단추가 없다');
  r.check(await waitFor(d.page.locator(sel('admin-email'))), '목록을 읽고 메일 칸이 뜬다');

  r.section('더하기');
  await d.page.fill(sel('admin-email'), 'not-an-email');
  await d.page.click(sel('admin-add'));
  r.check(await toastHas(d.page, '메일 주소 모양이 아닙니다'), '틀린 모양 = 안내');
  await d.page.fill(sel('admin-email'), 'HyunDongLim.Work@gmail.com');
  await d.page.click(sel('admin-add'));
  r.check(await toastHas(d.page, '기본 관리자입니다'), '기본 셋 = 안내');
  r.check((await serverList()).length === 0, '서버에는 아무것도 쓰지 않았다');
  await d.page.fill(sel('admin-email'), `  ${email.toUpperCase()} `);
  await d.page.click(sel('admin-add'));
  r.check(await waitFor(d.page.locator(sel('admin-row', email)), 8000), '더한 줄이 보인다(소문자)');
  r.check(await toastHas(d.page, '관리자로 더했습니다'), '더했다는 안내');
  const after = await serverUntil(serverList, (l) => l.includes(email));
  r.check(after.length === 1 && after[0] === email, `서버 admin/admins = [${after.join(', ')}]`);
  r.check((await d.page.inputValue(sel('admin-email'))) === '', '메일 칸이 비워진다');

  r.section('더한 관리자가 열면');
  const e = await newPage(browser);
  await open(e.page, '#/day/2026-10-08', { as: who });
  await openAdminTab(e.page);
  r.check(await waitFor(e.page.locator(sel('settings-tab', 'dev')), 8000), "'관리자' 탭이 보인다");
  await e.page.click(sel('settings-tab', 'dev'));
  r.check(await waitFor(e.page.locator(sel('admin-row', email)), 8000), '관리자 계정 목록을 읽는다(규칙 통과)');
  r.check(((await e.page.locator(sel('admin-row', email)).textContent()) ?? '').includes('(나)'), '내 줄에 (나)');
  r.check(
    await waitFor(async () => (await e.page.locator(sel('errors-empty')).count()) + (await e.page.locator(sel('error-group')).count()) > 0, 8000),
    '오류 기록을 읽는다(규칙 통과)',
  );
  r.check((await e.page.locator(sel('admins-failed')).count()) === 0, '목록 읽기 실패 없음');

  r.section('빼기');
  d.dialogs.answer = true;
  await d.page.click(sel('admin-remove', email));
  r.check(await waitFor(async () => (await d.page.locator(sel('admin-row', email)).count()) === 0, 8000), '줄이 빠진다');
  r.check(d.dialogs.seen.some((m) => m.includes('관리자에서 뺄까요?')), '빼기 전에 묻는다');
  r.check((await serverUntil(serverList, (l) => l.length === 0)).length === 0, '서버 목록에서도 빠진다');
  await e.page.reload();
  await e.page.locator(sel('session', 'signed-in')).waitFor({ timeout: 20000 });
  await openAdminTab(e.page);
  await e.page.waitForTimeout(1500);
  r.check((await e.page.locator(sel('settings-tab', 'dev')).count()) === 0, '뺀 계정이 다시 열면 관리자 탭이 없다');

  r.check(d.errors.length + e.errors.length === 0, '화면 오류 없음', [...d.errors, ...e.errors].join(' | '));
} catch (err) {
  // 예외가 '✔ 모두 통과'로 끝나지 않게 (P23-2 · P26-1)
  r.check(false, '점검이 도중에 멈췄다', String(err?.stack ?? err));
} finally {
  await browser.close();
  await undo.run();
  r.done();
  process.exit();
}
