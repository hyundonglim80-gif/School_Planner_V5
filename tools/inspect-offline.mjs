// tools/inspect-offline.mjs - P8-3 ■5·■6: 공유받기·오프라인 앱·새 판 띠를 실제 크롬에서 본다.
//   빌드한 앱이어야 한다(개발 서버에는 해시 붙은 /assets/·asset-manifest.json이 없다):
//   npm run emu (켜 둔다) → npm run build:emu → npm run preview (4175) → SITE=http://localhost:4175/ node tools/inspect-offline.mjs
//   1) 서비스 워커가 이 판의 앱 파일을 모두 담는다 → 네트워크를 끊고 다시 열어도 화면과 기기 사본의 자료가 보인다
//   2) 공유받기: '/share-target'에 POST(글·파일) → '/?share=…' → 새 메모 칸에 글 · 공유받은 파일 줄 · 주소에서 표시가 지워진다
//   3) '/'의 첫 스크립트가 바뀌면 '새 판이 있습니다' 띠
import { deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { emulator, launch, newPage, open, report, restorer, sel, SITE, waitFor } from './lib/probe.mjs';

const r = report();
const undo = restorer();
const em = emulator();
const uid = await em.signIn('teacher@example.com');
const sid = `u_${uid}`;
const browser = await launch();
const DAY = '2027-09-06';
const ref = doc(em.db, 'spaces', sid, 'items', 'inspOffline');

try {
  await setDoc(ref, { kind: 'event', date: DAY, text: '오프라인점검 일정', labelIds: [], order: 'a0', createdAt: Date.now(), authorId: uid, deletedAt: null, v: 1, updatedAt: serverTimestamp() });
  undo.add(() => deleteDoc(ref));
  const { ctx, page, errors } = await newPage(browser);

  r.section('오프라인 앱');
  await open(page, `#/day/${DAY}`);
  await page.locator(sel('event-card', 'inspOffline')).waitFor({ timeout: 15000 });
  const want = await page.evaluate(async () => {
    const m = await (await fetch('/asset-manifest.json', { cache: 'no-store' })).json();
    const s = new Set();
    for (const e of Object.values(m)) {
      s.add(`/${e.file}`);
      for (const f of e.css ?? []) s.add(`/${f}`);
      for (const f of e.assets ?? []) s.add(`/${f}`);
    }
    return [...s];
  });
  const cachedAll = await waitFor(
    () =>
      page.evaluate(async (paths) => {
        if (!navigator.serviceWorker.controller) return false;
        const c = await caches.open('sp5-app-v1');
        for (const p of paths) if (!(await c.match(p, { ignoreVary: true }))) return false;
        return !!(await c.match('/', { ignoreVary: true }));
      }, want),
    30000,
  );
  r.check(cachedAll, `서비스 워커가 이 판의 앱 파일 ${want.length}개와 첫 화면을 담는다`);
  await ctx.setOffline(true);
  await page.reload();
  r.check(await waitFor(page.locator(sel('session', 'signed-in')), 20000), '네트워크 없이 다시 열어도 앱이 뜬다 (로그인 그대로)');
  r.check(await waitFor(page.locator(sel('event-card', 'inspOffline')), 15000), '자료는 기기 사본에서 (그날 일정 카드)');
  await page.evaluate(() => window.sp5.openWindow('settings', { tab: 'app' }));
  r.check(await waitFor(page.locator('[data-settings-window]'), 10000), '나중에 불러오는 창(환경설정)도 열린다');
  await page.evaluate(() => window.sp5.closeAllWindows());
  await ctx.setOffline(false);

  r.section('공유받기');
  await page.evaluate(() => {
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = '/share-target';
    form.enctype = 'multipart/form-data';
    const add = (name, value) => {
      const i = document.createElement('input');
      i.name = name;
      i.value = value;
      form.appendChild(i);
    };
    add('title', '공유점검 제목');
    add('text', '공유점검 글 https://example.com/a');
    add('url', 'https://example.com/a');
    const file = document.createElement('input');
    file.type = 'file';
    file.name = 'files';
    const dt = new DataTransfer();
    dt.items.add(new File(['hello'], '공유점검.txt', { type: 'text/plain' }));
    file.files = dt.files;
    form.appendChild(file);
    document.body.appendChild(form);
    form.submit();
  });
  const panel = page.locator(sel('note-panel', 'new'));
  r.check(await waitFor(panel, 20000), '공유받으면 새 메모 칸이 열린다');
  const text = await panel.locator(sel('note-text-input')).inputValue().catch(() => '');
  r.check(text === '공유점검 제목\n공유점검 글 https://example.com/a', `제목·글·주소 = 한 덩어리 (주소는 겹치지 않게) (${JSON.stringify(text)})`);
  r.check(await waitFor(panel.locator(sel('note-shared-files', 1)), 5000), '공유받은 파일 1개 줄 (드라이브에 올려 첨부)');
  r.check(!page.url().includes('share='), `주소에서 공유 표시를 지운다 (${page.url().replace(SITE, '/')})`);
  r.check(await page.evaluate(async () => (await (await caches.open('sp5share-inbox')).keys()).length === 0), '꺼낸 뒤 공유 캐시를 비운다');
  await page.evaluate(() => window.sp5.closeAllWindows());

  r.section('새 판 띠');
  await ctx.route(SITE, async (route) => {
    const res = await route.fetch();
    const html = (await res.text()).replace(/(\/assets\/index-)[^"]+\.js/, '$1NEWBUILD.js');
    await route.fulfill({ response: res, body: html });
  });
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  r.check(await waitFor(page.locator(sel('new-build')), 10000), "'/'의 첫 스크립트가 바뀌면 '새 판이 있습니다' 띠");
  await ctx.unroute(SITE);
  r.check(errors.length === 0, `화면 오류 없음 ${errors.join(' | ')}`);
} catch (e) {
  r.bad(`점검이 멈췄다: ${e?.stack ?? e}`);
} finally {
  await undo.run();
  await browser.close();
  r.done();
  process.exit();
}
