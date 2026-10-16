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

  // 10-14 사용자 보고 '알림은 화면으로 나오지만 소리가 없다' - 새로 연 창(아직 누르지 않음)은 브라우저가 소리를 막는다 → OS 알림으로 소리
  r.section('소리가 막힌 창(새로 열고 아직 누르지 않음) = OS 알림도 띄운다');
  await page.reload();
  await page.locator('[data-session=signed-in]').waitFor({ timeout: 15000 });
  await page.waitForTimeout(1500);
  const blocked = await page.evaluate(async () => {
    const c = new AudioContext();
    await Promise.race([c.resume(), new Promise((res) => setTimeout(res, 300))]);
    const s = c.state;
    await c.close();
    return s !== 'running';
  });
  await cdp.send('ServiceWorker.deliverPushMessage', {
    origin,
    registrationId: reg.registrationId,
    data: JSON.stringify({ data: { type: 'event-alarm', id: ITEM, sid, content: '소리점검 일정', time: `${TODAY}T${TIME}` } }),
  });
  r.check(await waitFor(popup, 10000), '알림 창이 뜬다');
  const osShown = () =>
    page.evaluate(async (tag) => (await (await navigator.serviceWorker.getRegistration())?.getNotifications({ tag }))?.length ?? 0, `sp5-alarm-${ITEM}`);
  if (blocked) {
    r.check(await waitFor(async () => (await osShown()) > 0, 8000), '소리가 막혔으면 OS 알림(서비스 워커 showNotification, 같은 tag)도 뜬다');
  } else {
    await page.waitForTimeout(1500);
    r.check((await osShown()) === 0, '소리가 나면 OS 알림은 띄우지 않는다 (점검 크롬은 같은 사이트를 이미 눌러 소리가 난다 - 막힌 갈래는 EventAlarms.test)');
  }
  await page.locator(sel('alarm-dismiss')).click({ force: true });
  await page.evaluate(async (tag) => (await (await navigator.serviceWorker.getRegistration())?.getNotifications({ tag }))?.forEach((n) => n.close()), `sp5-alarm-${ITEM}`);

  // 10-16 사용 의견 '휴대폰 알림은 뜨는데 알람이 안 울림' - 앱을 닫았을 때 오는 알림이 한 번 '띵'뿐이었다
  r.section("앱 창이 없으면 = 서비스 워커가 '알림 소리' 길이만큼 3초마다 다시 울린다");
  const prefs = await page.evaluate(async () => {
    const res = await (await caches.open('sp5-prefs')).match('/__sp5prefs/alarm-sound');
    return res ? res.json() : null;
  });
  r.check(typeof prefs?.seconds === 'number', `앱이 계정의 알림 소리 길이를 서비스 워커 자리에 적어 둔다 (${JSON.stringify(prefs)})`);
  // 길이를 10초(3번)로 두고 창을 떠난다 - 같은 출처 창이 없으면 서비스 워커가 OS 알림을 띄운다
  await page.evaluate(async () => (await caches.open('sp5-prefs')).put('/__sp5prefs/alarm-sound', new Response(JSON.stringify({ seconds: 10 }))));
  const sw = ctx.serviceWorkers().find((w) => w.url().startsWith(origin));
  await page.goto('about:blank');
  await cdp.send('ServiceWorker.deliverPushMessage', {
    origin,
    registrationId: reg.registrationId,
    data: JSON.stringify({ data: { type: 'event-alarm', id: ITEM, sid, content: '반복점검 일정', time: `${TODAY}T${TIME}` } }),
  });
  const stampOf = () => sw?.evaluate(async (tag) => (await self.registration.getNotifications({ tag })).map((n) => n.timestamp)[0] ?? 0, `sp5-alarm-${ITEM}`);
  r.check(!!sw && (await waitFor(async () => (await stampOf()) > 0, 8000)), 'OS 알림이 뜬다');
  const shows = new Set();
  for (let i = 0; i < 12; i++) {
    shows.add(await stampOf());
    await new Promise((res) => setTimeout(res, 1000));
  }
  shows.delete(0);
  r.check(shows.size === 3, `10초 = 3번 띄운다 (같은 tag를 다시 - renotify, ${shows.size}번)`);
  await sw?.evaluate(async (tag) => (await self.registration.getNotifications({ tag })).forEach((n) => n.close()), `sp5-alarm-${ITEM}`);
  await page.goto(origin);
  await page.locator('[data-session=signed-in]').waitFor({ timeout: 15000 });

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
