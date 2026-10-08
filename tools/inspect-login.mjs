// tools/inspect-login.mjs
//
// P1-2 끝 조건을 크롬으로 본다: 에뮬레이터 빌드에서 seed 계정으로 로그인하면
//   1) 화면이 로그인 상태가 되고(?as=2 는 두 번째 계정)
//   2) 서버에 spaces/u_{uid}(나 혼자 owner인 개인 공간)가 생기고
//   3) Firestore 오프라인 저장소(IndexedDB 'firestore/…')가 생기지 않는다(V4 09-22 - 구조로 확인).
//
//   npm run emu · npm run dev:emu (켜 둔다) → node tools/inspect-login.mjs
//   SITE=http://localhost:5175/ 이 기본. P1-3에서 tools/lib/probe.mjs로 옮긴다.
//
// ⚠️ 에뮬레이터만 건드린다. 운영 자료와는 아무 상관이 없다.
import { chromium } from 'playwright';
import { initializeApp, deleteApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator, doc, getDoc } from 'firebase/firestore';
import { getAuth, connectAuthEmulator, signInWithEmailAndPassword } from 'firebase/auth';

const SITE = process.env.SITE || 'http://localhost:5175/';
let fail = 0;
const ok = (what) => console.log(`  ✔ ${what}`);
const bad = (what) => {
  console.log(`  ✘ ${what}`);
  fail++;
};
const check = (good, yes, no) => (good ? ok(yes) : bad(no));

/** 서버 확인은 기다려 읽는다(화면이 먼저 바뀌고 서버 쓰기는 뒤에 온다). */
async function serverUntil(read, test, ms = 10000) {
  const end = Date.now() + ms;
  let last;
  while (Date.now() < end) {
    last = await read();
    if (test(last)) return last;
    await new Promise((r) => setTimeout(r, 300));
  }
  return last;
}

const app = initializeApp({ projectId: 'schoolplannerv3', apiKey: 'fake-api-key' }, 'inspect-login');
const db = getFirestore(app);
const auth = getAuth(app);
connectFirestoreEmulator(db, '127.0.0.1', 8080);
connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });

const browser = await chromium.launch({ channel: 'chrome' });
try {
  for (const [as, email] of [['', 'teacher@example.com'], ['?as=2', 'teacher2@example.com']]) {
    console.log(`\n[${email}]`);
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(SITE + as);

    const signedIn = page.locator('[data-session="signed-in"]');
    try {
      await signedIn.waitFor({ timeout: 15000 });
      const text = await signedIn.textContent();
      check(text.includes(email), `로그인 화면에 ${email}`, `다른 계정으로 들어갔다: ${text}`);
    } catch {
      bad('로그인 상태가 되지 않았다');
    }

    const uid = (await signInWithEmailAndPassword(auth, email, 'test1234')).user.uid;
    const snap = await serverUntil(() => getDoc(doc(db, 'spaces', `u_${uid}`)), (s) => s.exists());
    const d = snap.data();
    if (!snap.exists()) bad(`spaces/u_${uid}가 생기지 않았다`);
    else if (d.kind === 'personal' && d.ownerId === uid && d.members?.[uid] === 'owner' && Object.keys(d.members).length === 1 && d.v === 1)
      ok(`spaces/u_${uid} - 개인 공간, 나 혼자 owner`);
    else bad(`spaces/u_${uid} 모양이 다르다: ${JSON.stringify(d)}`);

    const idb = await page.evaluate(async () => (await indexedDB.databases()).map((x) => x.name));
    const fsStore = idb.filter((n) => n?.startsWith('firestore/'));
    check(
      fsStore.length === 0,
      `Firestore 오프라인 저장소 없음 (IndexedDB: ${idb.join(', ') || '없음'})`,
      `Firestore 오프라인 저장소가 생겼다: ${fsStore.join(', ')}`,
    );

    check(errors.length === 0, '화면 오류 없음', `화면 오류: ${errors.join(' / ')}`);
    await ctx.close();
  }
} finally {
  await browser.close();
  await deleteApp(app).catch(() => {});
}

console.log(`\n───────── ${fail === 0 ? '모두 통과' : `${fail}개 실패`} ─────────`);
process.exit(fail === 0 ? 0 : 1);
