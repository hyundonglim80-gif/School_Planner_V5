// tools/inspect-share-groups.mjs - P8-4: 공유 그룹을 두 계정(teacher · teacher2 = ?as=2)으로 실제 크롬에서 본다.
//   만들기(공간 문서·초대 코드·기본 라벨·이름) · 📂 공간 고르기 · 그룹에 쓴 일정 = 그룹 공간 · 초대 코드로 참여 · 서로의 글이 보인다 ·
//   개인 공간으로 바꾸면 그룹 것이 안 보인다 · 나가기 · 그룹 지우기(아래 자료째)
//
//   npm run emu · npm run dev:emu (켜 둔다) → npm run seed → node tools/inspect-share-groups.mjs
import { collection, deleteDoc, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { emulator, launch, newPage, open, report, restorer, sel, serverUntil, waitFor } from './lib/probe.mjs';

const r = report();
const undo = restorer();
const em = emulator();
const uidA = await em.signIn('teacher@example.com');
const emB = emulator('inspectB');
const uidB = await emB.signIn('teacher2@example.com');
const browser = await launch();
const DAY = '2027-10-04';
const NAME = '공유점검 그룹';

const myGroups = async () => (await getDocs(query(collection(em.db, 'spaces'), where(`members.${uidA}`, 'in', ['owner', 'member'])))).docs.filter((d) => d.data().name === NAME);
undo.add(async () => {
  for (const g of await myGroups()) {
    for (const c of ['items', 'labels', 'people', 'series', 'lessonDays', 'notices', 'evaluations', 'timetables', 'settings']) for (const d of (await getDocs(collection(em.db, 'spaces', g.id, c))).docs) await deleteDoc(d.ref);
    if (g.data().inviteCode) await deleteDoc(doc(em.db, 'spaceInvites', g.data().inviteCode)).catch(() => {});
    await deleteDoc(g.ref);
  }
});

/** 그 공간에 일정 하나 (쓰는 칸으로) */
async function addEvent(page, sid, text) {
  await page.evaluate(([s, d]) => window.sp5.openWindow('event', { sid: s, date: d }), [sid, DAY]);
  const panel = page.locator(sel('event-panel', 'new'));
  await panel.locator(sel('event-text-input')).fill(text);
  await page.locator(sel('event-save')).click();
  await page.waitForTimeout(500);
  await page.evaluate(() => window.sp5.closeAllWindows());
}

try {
  const A = await newPage(browser);
  A.dialogs.answer = true;
  await open(A.page, `#/day/${DAY}`);

  r.section('만들기');
  r.check((await A.page.locator('[data-space-select]').count()) === 0, '든 그룹이 없으면 📂 공간 고르기가 없다');
  await A.page.locator(sel('account')).click();
  await A.page.locator(sel('account-groups')).click();
  r.check(await waitFor(A.page.locator(sel('groups-window')), 8000), "계정 칸 '👥 공유 그룹' → 공유 그룹 창");
  await A.page.locator(sel('group-new-name')).fill(NAME);
  await A.page.locator(sel('group-create')).click();
  const made = (await serverUntil(myGroups, (l) => l.length === 1, 10000))[0];
  const gid = made?.id ?? '';
  const g = made?.data() ?? {};
  r.check(gid.startsWith('g_') && g.kind === 'group' && g.ownerId === uidA && g.members?.[uidA] === 'owner' && /^[A-Z2-9]{6}$/.test(g.inviteCode ?? ''), `그룹 공간 문서 (${gid} · 코드 ${g.inviteCode})`);
  r.check((await getDoc(doc(em.db, 'spaceInvites', g.inviteCode ?? 'x'))).data()?.sid === gid, '초대 코드 → 그룹 (spaceInvites)');
  const labels = await serverUntil(async () => (await getDocs(collection(em.db, 'spaces', gid, 'labels'))).size, (n) => n > 0);
  r.check(labels > 0, `그룹 기본 라벨 (${labels}개 - 라벨은 그룹 것)`);
  r.check((await getDoc(doc(em.db, 'spaces', gid, 'people', uidA))).exists(), '구성원 이름 (people/나)');
  r.check(await waitFor(A.page.locator(sel('space-select', gid)), 8000), '만들면 그 그룹을 본다 (📂 공간 고르기에 그룹)');
  r.check(((await A.page.locator(sel('group-code-text')).textContent()) ?? '') === g.inviteCode, '창에 초대 코드');
  await A.page.evaluate(() => window.sp5.closeAllWindows());

  r.section('그룹에 쓰기');
  await addEvent(A.page, gid, '공유점검 그룹 일정');
  const ev = await serverUntil(async () => (await getDocs(collection(em.db, 'spaces', gid, 'items'))).docs.map((d) => d.data()), (l) => l.some((x) => x.text === '공유점검 그룹 일정'));
  r.check(ev.some((x) => x.text === '공유점검 그룹 일정'), '그룹 공간에 쓴 일정 = spaces/g_…/items');
  r.check(await waitFor(A.page.locator('[data-event-card]', { hasText: '공유점검 그룹 일정' }), 8000), '그룹 공간 화면에 그 일정');

  r.section('초대 코드로 참여 (teacher2)');
  const B = await newPage(browser);
  B.dialogs.answer = true;
  await open(B.page, `#/day/${DAY}`, { as: '2' });
  await B.page.evaluate(() => window.sp5.openWindow('group'));
  await B.page.locator(sel('group-join-code')).fill(` ${String(g.inviteCode).toLowerCase()} `);
  await B.page.locator(sel('group-join')).click();
  const joined = await serverUntil(async () => (await getDoc(doc(em.db, 'spaces', gid))).data(), (d) => d?.members?.[uidB] === 'member');
  r.check(joined?.members?.[uidB] === 'member', '참여 = members.{나} = member (소문자·띄어쓰기도 받는다)');
  r.check(await waitFor(B.page.locator(sel('space-select', gid)), 8000), '참여하면 그 그룹을 본다');
  r.check(await waitFor(B.page.locator('[data-event-card]', { hasText: '공유점검 그룹 일정' }), 10000), "teacher2 화면에 teacher가 쓴 그룹 일정");
  r.check(await waitFor(async () => ((await B.page.locator(sel('group-members')).textContent()) ?? '').includes('2명'), 8000), '구성원 2명');
  await B.page.evaluate(() => window.sp5.closeAllWindows());
  await addEvent(B.page, gid, '공유점검 둘째 일정');
  r.check(await waitFor(A.page.locator('[data-event-card]', { hasText: '공유점검 둘째 일정' }), 10000), 'teacher 화면에 teacher2가 쓴 일정이 들어온다');

  r.section('공간 바꾸기');
  await A.page.locator('[data-space-select]').click();
  await A.page.locator(sel('space-option', `u_${uidA}`)).click();
  r.check(await waitFor(A.page.locator(sel('space-select', `u_${uidA}`)), 5000), "📂 '🔒 개인 공간'으로");
  r.check(await waitFor(async () => (await A.page.locator('[data-event-card]', { hasText: '공유점검' }).count()) === 0, 8000), '개인 공간에는 그룹 일정이 없다');
  await A.page.reload();
  await A.page.locator(sel('session', 'signed-in')).waitFor({ timeout: 20000 });
  r.check(await waitFor(A.page.locator(sel('space-select', `u_${uidA}`)), 8000), '고른 공간은 이 기기에 남는다 (다시 열어도 개인)');
  await A.page.locator('[data-space-select]').click();
  r.check(await A.page.locator(sel('space-manage')).isVisible(), "목록 끝 '👥 그룹 관리…'");
  await A.page.locator(sel('space-option', gid)).click();
  r.check(await waitFor(A.page.locator('[data-event-card]', { hasText: '공유점검 둘째 일정' }), 8000), '다시 그룹으로');

  r.section('나가기 · 지우기');
  await B.page.evaluate(() => window.sp5.openWindow('group'));
  await B.page.locator(`${sel('group-row', gid)} ${sel('group-leave')}`).click();
  const left = await serverUntil(async () => (await getDoc(doc(em.db, 'spaces', gid))).data(), (d) => d && !d.members?.[uidB]);
  r.check(left && !left.members?.[uidB], 'teacher2 나가기 = members에서 빠진다');
  r.check(await waitFor(B.page.locator(sel('space-select', `u_${uidB}`)).or(B.page.locator(sel('groups-empty'))), 8000), '나가면 개인 공간으로');
  await A.page.evaluate(() => window.sp5.openWindow('group'));
  await A.page.locator(`${sel('group-row', gid)} ${sel('group-delete')}`).click();
  // 없는 공간 문서는 규칙이 읽기를 막는다(resource가 없다) - 막히면 없는 것
  const gone = await serverUntil(async () => (await getDoc(doc(em.db, 'spaces', gid)).catch(() => null))?.exists() ?? false, (x) => !x, 15000);
  r.check(!gone, '그룹 지우기 = 공간 문서가 없어진다');
  r.check(!(await getDoc(doc(em.db, 'spaceInvites', g.inviteCode))).exists(), '초대 코드도 지운다');
  r.check(A.dialogs.seen.some((m) => m.includes('영구히 지워지고')), '지우기 전에 묻는다');
  r.check(await waitFor(async () => (await A.page.locator('[data-space-select]').count()) === 0, 8000), '그룹이 없어지면 📂 공간 고르기도 사라진다 (개인으로)');
  r.check(A.errors.length === 0 && B.errors.length === 0, `화면 오류 없음 ${[...A.errors, ...B.errors].join(' | ')}`);
} catch (e) {
  r.bad(`점검이 멈췄다: ${e?.stack ?? e}`);
} finally {
  await undo.run();
  await browser.close();
  r.done();
  process.exit();
}
