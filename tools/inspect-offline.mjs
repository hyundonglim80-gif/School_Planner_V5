// tools/inspect-offline.mjs - P8-3 ■5·■6: 공유받기·오프라인 앱·새 판 띠를 실제 크롬에서 본다.
//   빌드한 앱이어야 한다(개발 서버에는 해시 붙은 /assets/·asset-manifest.json이 없다):
//   npm run emu (켜 둔다) → npm run build:emu → npm run preview (4175) → SITE=http://localhost:4175/ node tools/inspect-offline.mjs
//   1) 서비스 워커가 이 판의 앱 파일을 모두 담는다 → 네트워크를 끊고 다시 열어도 화면과 기기 사본의 자료가 보인다
//   2) 공유받기: '/share-target'에 POST(글·파일) → '/?share=…' → 새 메모 칸에 글 · 공유받은 파일 줄 · 주소에서 표시가 지워진다
//   3) '/'의 첫 스크립트가 바뀌면 '새 판이 있습니다' 띠
//   4) P14-6 ■1: 끊긴 채 저장 → 머리줄 '앱을 닫지 마세요 (n개)'·닫기 전에 묻기 → 이어지면 저절로 저장
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { emulator, launch, newPage, open, report, restorer, sel, serverUntil, SITE, waitFor } from './lib/probe.mjs';

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

  // 10-29 휴대폰: 새 판으로 연 바로 뒤 다 담기 전에 비행기 모드 → 새 메모 '+ 추가'가 새로고침을 되풀이하다 '화면을 그리다 문제가 생겼습니다'
  r.section('다 담기 전에 끊김 (받지 못한 창·화면)');
  const allCached = () =>
    page.evaluate(async (paths) => {
      const c = await caches.open('sp5-app-v1');
      for (const p of paths) if (!(await c.match(p, { ignoreVary: true }))) return false;
      return true;
    }, want);
  await waitFor(allCached, 30000);
  await ctx.setOffline(true);
  const dropped = await page.evaluate(async () => {
    // 화면이 받지 않은 파일은 아직 못 담은 것으로 (미리 담기가 덜 끝남)
    const loaded = new Set(performance.getEntriesByType('resource').map((e) => new URL(e.name).pathname));
    const c = await caches.open('sp5-app-v1');
    const out = [];
    for (const req of await c.keys()) {
      const path = new URL(req.url).pathname;
      if (path.startsWith('/assets/') && !loaded.has(path)) {
        await c.delete(req);
        out.push(path);
      }
    }
    return out;
  });
  r.check(dropped.some((p) => p.includes('NotePanel')) && dropped.some((p) => p.includes('WeekScreen')), `메모 칸·주간 화면 파일을 캐시에서 뺐다 (${dropped.length}개)`);
  // 새로고침하면 사라지는 표시 (# 뒤만 바꾸는 이동은 남는다)
  await page.evaluate(() => (window.__noReload = true));
  const reloaded = async () => !(await page.evaluate(() => window.__noReload === true));
  await page.locator(sel('journal-add')).click();
  r.check(await waitFor(page.locator('[data-toast="error"]', { hasText: '인터넷이 끊겨 이 칸을' }), 8000), "끊긴 채 '+ 추가' → '인터넷이 끊겨 이 칸을 아직 열 수 없습니다' 안내");
  r.check((await page.locator(sel('note-panel')).count()) === 0 && (await page.locator(sel('app-crashed')).count()) === 0, '메모 칸은 닫히고 화면 전체 오류는 없다');
  r.check(!(await reloaded()), '새로고침하지 않는다');
  await page.evaluate((d) => (location.hash = `#/week/${d}`), DAY);
  r.check(await waitFor(page.locator(sel('screen-offline')), 8000), '받지 못한 화면(주간)은 그 자리에 안내 · 머리줄은 그대로');
  r.check(!(await reloaded()) && (await page.locator(sel('app-crashed')).count()) === 0, '여기서도 새로고침·화면 전체 오류 없음');
  await ctx.setOffline(false);
  r.check(await waitFor(page.locator(sel('week-grid')).first(), 15000), '인터넷이 이어지면 주간 화면이 저절로 열린다 (주간은 두 주라 칸이 둘)');
  await page.evaluate((d) => (location.hash = `#/day/${d}`), DAY);
  await page.locator(sel('journal-add')).click();
  r.check(await waitFor(page.locator(sel('note-panel', 'new')), 15000), '이어진 뒤 다시 누르면 새 메모 칸이 열린다 (새로고침 없이)');
  r.check(await waitFor(allCached, 30000), '이어지면 못 담은 파일을 마저 담는다');
  r.check(!(await reloaded()), '끝까지 새로고침 없음');
  await page.evaluate(() => window.sp5.closeAllWindows());

  // P14-6 ■1 (10-30 사용자 휴대폰 ②): 끊긴 동안 쓰기는 메모리에만 - 앱을 닫으면 사라지므로 머리줄로 알리고 닫기 전에 묻는다
  r.section('끊긴 채 저장 (서버가 받지 않은 쓰기)');
  await page.locator(sel('journal-add')).click();
  const note = page.locator(sel('note-panel', 'new'));
  await note.waitFor({ timeout: 15000 });
  await note.locator(sel('note-text-input')).fill('오프라인저장점검 1');
  await ctx.setOffline(true);
  await note.locator(sel('note-save')).click();
  const pendingBar = page.locator(`header ${sel('pending-writes')}${sel('pending-offline')}`);
  r.check(await waitFor(pendingBar, 8000), "끊긴 채 저장 → 머리줄 '📴 인터넷이 끊겨 저장을 기다립니다 - 앱을 닫지 마세요'");
  const barText = (await pendingBar.textContent().catch(() => '')) ?? '';
  r.check(/\(\d+개\)/.test(barText), `기다리는 수 (${barText})`);
  r.check(((await note.locator(sel('note-save')).textContent()) ?? '').includes('저장 중'), "저장 단추는 '저장 중...'에 머문다 (서버가 받을 때까지)");
  const asksBeforeLeave = () =>
    page.evaluate(() => {
      const e = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(e);
      return e.defaultPrevented;
    });
  r.check(await asksBeforeLeave(), '기다리는 저장이 있으면 탭을 닫기 전에 묻는다 (beforeunload)');
  await ctx.setOffline(false);
  r.check(await waitFor(page.locator('[data-toast]', { hasText: '기다리던 저장을 마쳤습니다' }), 30000), "이어지면 저절로 저장 → '✅ 기다리던 저장을 마쳤습니다'");
  r.check((await page.locator(sel('pending-writes')).count()) === 0 && !(await asksBeforeLeave()), '띠를 거두고 더는 묻지 않는다');
  const savedId = (await page.locator(sel('note-panel', 'edit')).getAttribute('data-note-id', { timeout: 10000 }).catch(() => '')) ?? '';
  if (savedId) undo.add(() => deleteDoc(doc(em.db, 'spaces', sid, 'items', savedId)));
  const savedSnap = savedId ? await serverUntil(() => getDoc(doc(em.db, 'spaces', sid, 'items', savedId)), (d) => d.exists() && d.data().text === '오프라인저장점검 1') : null;
  r.check(!!savedSnap?.exists(), `서버에 그 메모 (${savedId})`);
  await page.evaluate(() => window.sp5.closeAllWindows());

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
