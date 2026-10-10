// tools/inspect-push.mjs - P8-2 ■2: 서버 푸시 알림의 기기 쪽을 실제 크롬에서 본다 (함수는 PC에서 배포한 뒤 사용자 확인).
//   1) 알림을 허용해 둔 기기는 앱이 뜰 때 토큰을 저절로 올린다(spaces/u_{uid}/pushTokens - 에뮬레이터는 가짜 토큰)
//   2) 환경설정 '알림' 탭: 이 기기에서 끄기 → 토큰 문서를 지움(다시 열어도 꺼진 채) · 받기 → 다시 올림
//   3) 서비스 워커가 푸시를 받으면(CDP deliverPushMessage) 보고 있는 창에 넘겨 앱 안 알림 창이 뜨고, 그 일정에 alarmDone
//   4) 로그아웃하면 이 기기 토큰 문서를 지운다
//
//   npm run emu · npm run dev:emu (켜 둔다) → npm run seed → node tools/inspect-push.mjs
import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';
import { emulator, launch, newPage, open, report, restorer, sel, serverUntil, waitFor } from './lib/probe.mjs';

const r = report();
const undo = restorer();
const em = emulator();
const uid = await em.signIn('teacher@example.com');
const sid = `u_${uid}`;
const browser = await launch();
const pad = (n) => String(n).padStart(2, '0');
const now = new Date();
const TODAY = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
const later = new Date(now.getTime() + 3 * 3600_000);
const TIME = `${pad(later.getHours())}:${pad(later.getMinutes())}`;
const tokens = async () => (await getDocs(collection(em.db, 'spaces', sid, 'pushTokens'))).docs.map((d) => ({ id: d.id, ...d.data() }));
const ITEM = 'inspPushItem';

try {
  const before = await tokens();
  undo.add(async () => {
    for (const t of await tokens()) if (!before.some((b) => b.id === t.id)) await deleteDoc(doc(em.db, 'spaces', sid, 'pushTokens', t.id));
    await deleteDoc(doc(em.db, 'spaces', sid, 'items', ITEM));
  });
  // 오늘 3시간 뒤 알림 일정 (앱 안 알림은 아직 울리지 않는다 - 푸시로만 울린다)
  await setDoc(doc(em.db, 'spaces', sid, 'items', ITEM), {
    kind: 'event',
    date: TODAY,
    time: TIME,
    text: '푸시점검 일정',
    labelIds: [],
    order: 'zz',
    createdAt: Date.now(),
    authorId: uid,
    deletedAt: null,
    v: 1,
    updatedAt: serverTimestamp(),
  });

  const { ctx, page, errors } = await newPage(browser);
  const origin = new URL(process.env.SITE || 'http://localhost:5175/').origin;
  await ctx.grantPermissions(['notifications'], { origin });
  await open(page, `#/day/${TODAY}`);

  r.section('앱이 뜰 때 토큰');
  const up = await serverUntil(tokens, (l) => l.some((t) => t.token === 'emulator-token-pc'), 15000);
  const mine = up.find((t) => t.token === 'emulator-token-pc');
  r.check(!!mine && mine.device === 'pc' && typeof mine.updatedAt === 'number', '알림을 허용해 둔 기기는 저절로 토큰을 올린다 (pushTokens)');

  r.section("환경설정 '알림' 탭");
  await page.evaluate(() => window.sp5.openWindow('settings', { tab: 'notify' }));
  const panel = page.locator(sel('push-alarm'));
  r.check(await waitFor(async () => (await panel.getAttribute('data-push-state')) === 'on', 8000), "상태 = '이 기기에서 받습니다'");
  await page.locator(sel('push-off')).click();
  r.check(await waitFor(async () => (await panel.getAttribute('data-push-state')) === 'off', 8000), '끄기 → 꺼짐');
  r.check(!(await serverUntil(tokens, (l) => !l.some((t) => t.id === mine.id))).some((t) => t.id === mine.id), '끄면 토큰 문서를 지운다');
  await page.reload();
  await page.locator('[data-session=signed-in]').waitFor({ timeout: 15000 });
  await page.waitForTimeout(2500);
  r.check(!(await tokens()).some((t) => t.id === mine.id), '다시 열어도 꺼진 채 (저절로 올리지 않는다)');
  await page.evaluate(() => window.sp5.openWindow('settings', { tab: 'notify' }));
  await page.locator(sel('push-on')).click();
  r.check(await waitFor(async () => (await page.locator(sel('push-alarm')).getAttribute('data-push-state')) === 'on', 8000), '받기 → 켜짐');
  r.check((await serverUntil(tokens, (l) => l.some((t) => t.id === mine.id))).some((t) => t.id === mine.id), '토큰 문서를 다시 올린다');
  await page.evaluate(() => window.sp5.closeAllWindows());

  r.section('서비스 워커가 받은 푸시 = 앱 안 알림 창');
  const cdp = await ctx.newCDPSession(page);
  const regs = [];
  cdp.on('ServiceWorker.workerRegistrationUpdated', (e) => regs.push(...e.registrations.filter((x) => !x.isDeleted)));
  await cdp.send('ServiceWorker.enable');
  r.check(await waitFor(() => regs.length > 0, 10000), '서비스 워커가 등록돼 있다');
  const reg = regs.find((x) => x.scopeURL.startsWith(origin)) ?? regs[0];
  await cdp.send('ServiceWorker.deliverPushMessage', {
    origin,
    registrationId: reg.registrationId,
    data: JSON.stringify({ data: { type: 'event-alarm', id: ITEM, sid, content: '푸시점검 일정', time: `${TODAY}T${TIME}` } }),
  });
  const popup = page.locator(sel('alarm-popup'));
  r.check(await waitFor(popup, 10000), '알림 창이 뜬다');
  r.check(((await popup.textContent()) ?? '').includes('푸시점검 일정'), '그 일정의 글');
  r.check(await waitFor(async () => (await getDoc(doc(em.db, 'spaces', sid, 'items', ITEM))).data()?.alarmDone === true, 8000), "그 일정에 alarmDone (다른 기기의 앱 안 알림은 건너뛴다)");
  await page.locator(sel('alarm-dismiss')).click({ force: true });

  r.section('로그아웃하면 이 기기 토큰을 지운다');
  await page.locator(sel('account')).click();
  await page.locator(sel('logout')).click();
  r.check(!(await serverUntil(tokens, (l) => !l.some((t) => t.id === mine.id))).some((t) => t.id === mine.id), '로그아웃 → 토큰 문서 지움');
  r.check(errors.length === 0, `화면 오류 없음 ${errors.join(' | ')}`);
} catch (e) {
  r.bad(`점검이 멈췄다: ${e?.stack ?? e}`);
} finally {
  await undo.run();
  await browser.close();
  r.done();
  process.exit();
}
