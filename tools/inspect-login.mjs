// tools/inspect-login.mjs
//
// P1-2 끝 조건을 크롬으로 본다: 에뮬레이터 빌드에서 seed 계정으로 로그인하면
//   1) 화면이 로그인 상태가 되고(?as=2 는 두 번째 계정)
//   2) 서버에 spaces/u_{uid}(나 혼자 owner인 개인 공간)가 생기고
//   3) Firestore 오프라인 저장소(IndexedDB 'firestore/…')가 생기지 않는다(V4 09-22 - 구조로 확인).
//
//   npm run emu · npm run dev:emu (켜 둔다) → node tools/inspect-login.mjs   (SITE=… 로 다른 주소)
// ⚠️ 에뮬레이터만 건드린다. 운영 자료와는 아무 상관이 없다.
import { deleteApp } from 'firebase/app';
import { doc, getDoc } from 'firebase/firestore';
import { emulator, launch, newPage, open, report, sel, serverUntil } from './lib/probe.mjs';

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
} finally {
  await browser.close();
  await deleteApp(emu.app).catch(() => {});
}
r.done();
