// tools/inspect-mirror.mjs - P2-2: 기기 사본을 실제 크롬에서 본다 (화면이 아직 없어 앱의 모듈로 화면 store를 읽는다).
//   1) 처음 열면 서버 자료가 store와 기기 사본(IndexedDB sp5-mirror-{uid})에 들어온다. Firestore SDK의 IndexedDB는 없다(구조).
//   2) 새로고침 때 사본으로 먼저 그린다 - Firestore·Auth 에뮬레이터를 막고도.
//   3) 다른 탭(같은 기기)·다른 기기의 변경이 2초 안에. 지운 표시도.
//   4) IndexedDB를 지운 채로도 서버 자료가 들어온다 - 도는 중에 지움 / 처음부터 막힘. 그동안 서버 구독은 그대로(구조).
//   5) 환경설정 '앱' 탭 '🔄 이 기기 사본 다시 받기'. 6) 로그아웃하면 그 계정의 사본을 지운다.
//
//   npm run emu · npm run dev:emu (켜 둔다) → node tools/inspect-mirror.mjs
// 에뮬레이터 teacher 계정의 개인 공간에 점검 항목을 만들고 끝에 지운다.
import { deleteDoc, doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { emulator, launch, newPage, open, report, restorer, sel, SITE, waitFor } from './lib/probe.mjs';

const r = report();
const em = emulator();
const uid = await em.signIn('teacher@example.com');
const sid = `u_${uid}`;
const DB = `sp5-mirror-${uid}`;
const undo = restorer();
const browser = await launch();
const DAY = '#/day/2026-10-08';

/** 다른 기기(점검 스크립트의 Firebase)에서 항목 하나 - 저장 도우미가 붙이는 칸을 갖춰 (규칙) */
const made = [];
async function serverWrite(id, text) {
  const ref = doc(em.db, 'spaces', sid, 'items', id);
  if (!made.includes(id)) {
    made.push(id);
    undo.add(() => deleteDoc(ref));
  }
  await setDoc(ref, {
    kind: 'note', date: '2026-10-08', text, labelIds: [], order: 'a0',
    createdAt: Date.now(), authorId: uid, deletedAt: null, updatedAt: serverTimestamp(), v: 1,
  });
}

/** 화면 store (앱이 쓰는 모듈 그대로 - 개발 서버가 같은 주소로 준다) */
const mirror = (page) =>
  page.evaluate(async (sid) => {
    const { useMirror } = await import('/src/data/mirror/store.ts');
    const s = useMirror.getState();
    const c = s.colls[`${sid}/items`];
    const docs = c?.docs ?? {};
    return {
      persisted: s.persisted,
      status: c?.status,
      ids: Object.keys(docs),
      deleted: Object.keys(docs).filter((id) => docs[id].deletedAt),
      text: Object.fromEntries(Object.entries(docs).map(([id, d]) => [id, d.text])),
    };
  }, sid);

const dbNames = (page) => page.evaluate(async () => (await indexedDB.databases()).map((d) => d.name));
const has = (page, id) => waitFor(async () => (await mirror(page)).ids.includes(id), 5000);
const within2s = async (page, id) => {
  const start = Date.now();
  const ok = await waitFor(async () => (await mirror(page)).ids.includes(id), 2000);
  return { ok, ms: Date.now() - start };
};
const blockServer = (page) => page.route(/127\.0\.0\.1:(8080|9099)/, (route) => route.abort());

try {
  await serverWrite('mirrorA', '점검 하나');
  await serverWrite('mirrorB', '점검 둘');

  const a = await newPage(browser);
  await open(a.page, DAY);

  r.section('처음 열기');
  r.check(await has(a.page, 'mirrorA') && (await mirror(a.page)).ids.includes('mirrorB'), '서버 자료가 화면 store에');
  r.check(await waitFor(async () => (await mirror(a.page)).status === 'live', 5000), '구독 중(live)');
  const names = await dbNames(a.page);
  r.check(names.includes(DB), `기기 사본 DB ${DB}`);
  r.check(!names.some((n) => /firestore/i.test(n ?? '')), `Firestore SDK의 IndexedDB는 없다 (${names.join(', ')})`);
  r.check((await mirror(a.page)).persisted === 'disk', '사본에 적는 중(disk)');

  r.section('새로고침 - 사본으로 먼저 (서버를 막고)');
  await new Promise((res) => setTimeout(res, 800)); // 사본에 뒤따라 적기
  await blockServer(a.page);
  await a.page.reload();
  await a.page.locator(sel('session', 'signed-in')).waitFor({ timeout: 20000 });
  r.check(await has(a.page, 'mirrorA'), '서버 없이도 사본의 항목이 보인다');
  const offline = await mirror(a.page);
  r.check(offline.status === 'copy' && offline.text.mirrorB === '점검 둘', `상태 copy·글 그대로 (${offline.status})`);
  await a.page.unroute(/127\.0\.0\.1:(8080|9099)/);
  await a.page.reload();
  await a.page.locator(sel('session', 'signed-in')).waitFor({ timeout: 20000 });
  r.check(await waitFor(async () => (await mirror(a.page)).status === 'live', 10000), '서버가 돌아오면 다시 구독 중');

  r.section('다른 탭·다른 기기의 변경 (2초 안에)');
  const b = await a.ctx.newPage();
  b.on('pageerror', (e) => a.errors.push(String(e)));
  await open(b, DAY);
  const newId = await b.evaluate(async (sid) => {
    const repo = await import('/src/data/repo/index.ts');
    const at = repo.newPath(sid, 'items');
    const saving = repo.create(at, { kind: 'note', date: '2026-10-08', text: '다른 탭에서', labelIds: [], order: 'a0' });
    const { useMirror } = await import('/src/data/mirror/store.ts');
    const shownAtOnce = !!useMirror.getState().colls[`${sid}/items`]?.docs[at.id];
    await saving;
    return { id: at.id, shownAtOnce };
  }, sid);
  made.push(newId.id);
  undo.add(() => deleteDoc(doc(em.db, 'spaces', sid, 'items', newId.id)));
  r.check(newId.shownAtOnce, '쓴 탭에서는 서버가 받기 전에 먼저 보인다');
  const tab = await within2s(a.page, newId.id);
  r.check(tab.ok, `다른 탭에서 만든 것이 들어온다 (${tab.ms}ms)`);
  await serverWrite('mirrorC', '다른 기기에서');
  const dev = await within2s(a.page, 'mirrorC');
  r.check(dev.ok, `다른 기기에서 만든 것이 들어온다 (${dev.ms}ms)`);
  await updateDoc(doc(em.db, 'spaces', sid, 'items', 'mirrorC'), { deletedAt: serverTimestamp(), deletedBy: uid, updatedAt: serverTimestamp() });
  r.check(await waitFor(async () => (await mirror(a.page)).deleted.includes('mirrorC'), 2000), '지운 표시도 그대로 온다');
  await b.close();

  r.section('IndexedDB를 지운 채로도 서버 자료가 들어온다');
  const cdp = await a.ctx.newCDPSession(a.page);
  await cdp.send('Storage.clearDataForOrigin', { origin: new URL(SITE).origin, storageTypes: 'indexeddb' });
  r.check(await waitFor(async () => (await mirror(a.page)).persisted === 'memory', 5000), '도는 중에 지우면 메모리로만(memory)');
  await serverWrite('mirrorD', '사본을 지운 뒤');
  const afterWipe = await within2s(a.page, 'mirrorD');
  r.check(afterWipe.ok, `그 뒤에도 서버 자료가 들어온다 (${afterWipe.ms}ms)`);
  r.check(!(await dbNames(a.page)).includes(DB), '이 탭은 사본을 다시 만들지 않는다(빈 DB에 커서만 앞서지 않게)');

  // 처음부터 IndexedDB가 막힌 브라우저 (사본만 막는다 - 로그인 저장은 둔다)
  const blocked = await newPage(browser);
  await blocked.ctx.addInitScript(() => {
    const open = indexedDB.open.bind(indexedDB);
    indexedDB.open = (name, ...rest) => {
      if (String(name).startsWith('sp5-mirror')) throw new DOMException('막힘', 'SecurityError');
      return open(name, ...rest);
    };
  });
  await open(blocked.page, DAY);
  r.check(await has(blocked.page, 'mirrorD'), '처음부터 막혀도 서버 자료가 들어온다');
  r.check(await waitFor(async () => (await mirror(blocked.page)).status === 'live', 5000), '구독 중(live)');
  r.check((await mirror(blocked.page)).persisted === 'memory', '메모리로만(memory)');
  await serverWrite('mirrorE', '막힌 동안');
  const whileBlocked = await within2s(blocked.page, 'mirrorE');
  r.check(whileBlocked.ok, `막힌 동안 새로 쓴 것도 들어온다 (${whileBlocked.ms}ms)`);
  r.check(blocked.errors.length === 0, '화면 오류 없음(막힌 브라우저)', `화면 오류: ${blocked.errors.join(' | ')}`);
  await blocked.ctx.close();

  r.section("환경설정 '이 기기 사본 다시 받기'");
  await a.page.reload();
  await a.page.locator(sel('session', 'signed-in')).waitFor({ timeout: 20000 });
  r.check(await waitFor(async () => (await mirror(a.page)).persisted === 'disk', 5000), '새로고침하면 사본을 다시 연다(disk)');
  await a.page.evaluate(() => window.sp5.openWindow('settings', { tab: 'app' }));
  await a.page.locator(sel('mirror-reset')).click();
  r.check(await waitFor(a.page.locator(sel('toast')).filter({ hasText: '다시 받습니다' }), 5000), '다시 받는다는 안내');
  r.check(await waitFor(async () => {
    const m = await mirror(a.page);
    return m.status === 'live' && ['mirrorA', 'mirrorD', 'mirrorE'].every((id) => m.ids.includes(id));
  }, 10000), '처음부터 다시 받아 구독 중');
  const count = Number(await a.page.locator(sel('mirror-count')).getAttribute('data-mirror-count'));
  r.check(count >= 5, `사본 칸에 개수 (${count}개)`);
  r.check((await a.page.locator(sel('mirror-state')).getAttribute('data-mirror-state')) === 'disk', '사본 칸: 이 기기에 담아 둠');

  r.section('로그아웃');
  await a.page.keyboard.press('Escape');
  await a.page.click(sel('account'));
  await a.page.click(sel('logout'));
  r.check(await waitFor(a.page.locator(sel('login-google')), 10000), '로그인 화면');
  r.check(await waitFor(async () => !(await dbNames(a.page)).includes(DB), 5000), '로그아웃하면 그 계정의 기기 사본을 지운다');

  r.check(a.errors.length === 0, '화면 오류 없음', `화면 오류: ${a.errors.join(' | ')}`);
} finally {
  await browser.close();
  await undo.run();
  r.done();
  process.exit();
}
