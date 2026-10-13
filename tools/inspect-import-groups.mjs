// tools/inspect-import-groups.mjs - P8-4 ■3: V4 공유 그룹 가져오기를 세 계정으로 실제 크롬에서 본다.
//   V4 그룹(주인 teacher, 구성원 teacher2)과 그 밑 자료를 심고 →
//   teacher2(주인이 아님)가 공유 그룹 창 'V4 그룹 가져오기'로 가져온다 = g_{V4 id} 공간이 V4 주인·구성원 그대로(초대 코드 없음)·그룹 자료·쓰는 라벨만·만든 사람 ·
//   teacher(주인)가 '🔑 초대 코드 만들기' · 다시 가져오기 = 바뀐 것 0 · V4에 나중에 든 teacher3가 가져오면 초대 코드 없이 구성원으로(겹치지 않음) ·
//   백업 창 '가져오기' 탭에서 공유 그룹 창으로. 심은 V4 그룹·가져온 공간은 끝에 지운다.
//
//   npm run emu · npm run dev:emu (켜 둔다) → V4 seed → npm run seed → node tools/inspect-import-groups.mjs
import { arrayUnion, collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc } from 'firebase/firestore';
import { emulator, launch, newPage, open, report, restorer, sel, serverUntil, waitFor } from './lib/probe.mjs';

const r = report();
const undo = restorer();
const em = emulator();
const uidA = await em.signIn('teacher@example.com');
const uidB = await emulator('inspectB').signIn('teacher2@example.com');
const uidC = await emulator('inspectC').signIn('teacher3@example.com');
const browser = await launch();
const DAY = '2027-10-11';
const GID = 'v4InspectGroup1';
const SID = `g_${GID}`;
const NAME = '점검 V4 그룹';
const V4_SUB = ['events', 'journals', 'tasks', 'schedules', 'notices', 'evaluations', 'settings'];
const V5_SUB = ['items', 'labels', 'people', 'series', 'lessonDays', 'notices', 'evaluations', 'timetables', 'settings'];

async function cleanAll() {
  // 가져온 V5 공간 (teacher = 주인). 없는 공간은 규칙이 읽기부터 막는다
  const space = await getDoc(doc(em.db, 'spaces', SID)).catch(() => null);
  if (space?.exists()) {
    for (const c of V5_SUB) for (const d of (await getDocs(collection(em.db, 'spaces', SID, c))).docs) await deleteDoc(d.ref);
    if (space.data().inviteCode) await deleteDoc(doc(em.db, 'spaceInvites', space.data().inviteCode)).catch(() => {});
    await deleteDoc(space.ref);
  }
  const v4 = await getDoc(doc(em.db, 'groups', GID)).catch(() => null);
  if (v4?.exists()) {
    for (const c of V4_SUB) for (const d of (await getDocs(collection(em.db, 'groups', GID, c))).docs) await deleteDoc(d.ref);
    await deleteDoc(v4.ref);
  }
}
undo.add(cleanAll);

const v5 = async (coll) => (await getDocs(collection(em.db, 'spaces', SID, coll))).docs.map((d) => ({ ...d.data(), id: d.id }));
/** 그 행의 결과 표에서 새로·바뀜·지움 합 */
const changedIn = async (page) =>
  page.locator(`${sel('v4-group', GID)} ${sel('v4-group-result')}`).evaluate((el) =>
    [...el.querySelectorAll('[data-import-count=added],[data-import-count=changed],[data-import-count=removed]')].reduce((n, td) => n + Number(td.textContent || 0), 0),
  );

try {
  await cleanAll();
  // V4 그룹 심기 (teacher = 주인 - V4 규칙대로)
  await setDoc(doc(em.db, 'groups', GID), {
    name: NAME, ownerId: uidA, ownerName: '선생님A', inviteCode: 'V4INSP', members: [uidA, uidB],
    memberDetails: { [uidB]: { name: '둘째 선생님', joinedAt: 1, photoURL: '' } }, createdAt: Date.now(),
  });
  await setDoc(doc(em.db, 'groups', GID, 'events', DAY), {
    eventList: [
      { id: 'g_e1', content: 'V4 그룹 협의', label: '달력', authorId: uidA },
      { id: 'g_e2', content: 'V4 그룹 둘째 일정', authorId: uidB, linkedItems: [{ targetType: 'memo', targetId: 'gm1', targetFId: GID }] },
    ],
  });
  await setDoc(doc(em.db, 'groups', GID, 'journals', DAY), { entries: [{ id: 'g_j1', content: 'V4 그룹 기록', labelIds: ['j_3'], authorId: uidB }] });
  await setDoc(doc(em.db, 'groups', GID, 'tasks', 'gm1'), { text: 'V4 그룹 메모', labels: ['업무'], order: 1, authorId: uidA });
  await setDoc(doc(em.db, 'groups', GID, 'schedules', DAY), { periods: { 2: { subject: '협의', memo: '3층' } } });
  await setDoc(doc(em.db, 'groups', GID, 'notices', DAY), { date: DAY, lines: ['그룹 알림장 줄'] });
  await setDoc(doc(em.db, 'groups', GID, 'evaluations', DAY), {
    evalList: [{ id: 'g_ev1', title: '그룹 조사표', type: 'check', authorId: uidA, rosterMeta: { year: 2027, grade: 5, classNum: 2 }, studentsSnapshot: [{ num: 1, name: '가' }], records: { 1: { checked: true } } }],
  });

  r.section('구성원(teacher2)이 가져온다');
  const B = await newPage(browser);
  await open(B.page, `#/day/${DAY}`, { as: '2' });
  await B.page.evaluate(() => window.sp5.openWindow('group'));
  const rowB = B.page.locator(sel('v4-group', GID));
  r.check(await waitFor(rowB, 10000), "공유 그룹 창 'V4 그룹 가져오기'에 내가 든 V4 그룹");
  r.check((await rowB.getAttribute('data-v4-group-state')) === 'new', '아직 V5에 없다 (new)');
  await waitFor(async () => await rowB.locator(sel('v4-group-import')).isEnabled(), 8000);
  await rowB.locator(sel('v4-group-import')).click();
  const space = await serverUntil(async () => (await getDoc(doc(em.db, 'spaces', SID)).catch(() => null))?.data(), (d) => !!d, 15000);
  r.check(space?.kind === 'group' && space.name === NAME && space.ownerId === uidA, `공간 g_{V4 id} = V4 이름·주인 그대로 (${SID})`);
  r.check(space?.members?.[uidA] === 'owner' && space?.members?.[uidB] === 'member' && Object.keys(space?.members ?? {}).length === 2, '구성원 배열 → 맵 (주인 owner·나 member)');
  r.check(space && !('inviteCode' in space), '주인이 아닌 사람이 가져오면 초대 코드는 없다');
  r.check(await waitFor(rowB.locator(sel('v4-group-result')), 20000), '결과 표');
  const items = await serverUntil(() => v5('items'), (l) => l.length >= 4, 10000);
  const byText = (t) => items.find((i) => i.text === t);
  r.check(items.length === 4, `일정·기록·메모 ${items.length}개`);
  r.check(byText('V4 그룹 협의')?.authorId === uidA && byText('V4 그룹 둘째 일정')?.authorId === uidB && byText('V4 그룹 기록')?.authorId === uidB, '만든 사람 = V4 authorId (가져온 사람이 아니다)');
  r.check(JSON.stringify(byText('V4 그룹 둘째 일정')?.linkIds) === JSON.stringify([byText('V4 그룹 메모')?.id]), '같은 그룹 메모 링크');
  const labels = (await v5('labels')).filter((l) => !l.deletedAt).map((l) => l.name).sort();
  r.check(JSON.stringify(labels) === JSON.stringify(['달력', '업무', '업무전달']), `라벨은 그룹 자료가 쓰는 것만 (${labels.join(', ')})`);
  r.check((await getDoc(doc(em.db, 'spaces', SID, 'lessonDays', DAY))).data()?.periods?.['2']?.subject === '협의', '수업 칸 (schedules → lessonDays)');
  r.check((await getDoc(doc(em.db, 'spaces', SID, 'notices', DAY))).data()?.lines?.[0] === '그룹 알림장 줄', '알림장');
  const evals = await v5('evaluations');
  r.check(evals.length === 1 && evals[0].authorId === uidA && evals[0].classId === '2027-5-2', '조사표 (만든 사람 그대로)');
  const people = Object.fromEntries((await v5('people')).map((p) => [p.id, p.name]));
  r.check(!!people[uidB] && people[uidA] === '선생님A', `구성원 이름 (나 + V4 그룹장 이름 '${people[uidA]}')`);
  r.check(await waitFor(B.page.locator(sel('space-select', SID)), 8000), '가져오면 그 그룹을 본다');
  r.check((await rowB.getAttribute('data-v4-group-state')) === 'imported', '줄이 imported로');
  r.check((await B.page.locator(`${sel('group-row', SID)} ${sel('group-role', 'member')}`).count()) === 1 && (await B.page.locator(sel('group-make-code')).count()) === 0, '내 그룹 줄 = 구성원 (초대 코드 만들기 없음)');
  await B.page.evaluate(() => window.sp5.closeAllWindows());
  r.check(await waitFor(B.page.locator('[data-event-card]', { hasText: 'V4 그룹 협의' }), 10000), '하루 화면에 그룹 일정');

  r.section('그룹장(teacher) - 초대 코드 만들기 · 다시 가져오기');
  const A = await newPage(browser);
  await open(A.page, `#/day/${DAY}`);
  await A.page.evaluate(() => window.sp5.openWindow('group'));
  const myRow = A.page.locator(sel('group-row', SID));
  r.check(await waitFor(myRow.locator(sel('group-role', 'owner')), 10000), '그룹장에게도 그룹이 보인다 (owner)');
  await myRow.locator(sel('group-make-code')).click();
  const withCode = await serverUntil(async () => (await getDoc(doc(em.db, 'spaces', SID))).data(), (d) => !!d?.inviteCode, 10000);
  const code = withCode?.inviteCode ?? '';
  r.check(/^[A-Z2-9]{6}$/.test(code) && (await getDoc(doc(em.db, 'spaceInvites', code))).data()?.sid === SID, `'🔑 초대 코드 만들기' = 공간 + spaceInvites (${code})`);
  r.check(await waitFor(async () => ((await myRow.locator(sel('group-code-text')).textContent().catch(() => '')) ?? '') === code, 8000), '창에 초대 코드');
  const rowA = A.page.locator(sel('v4-group', GID));
  r.check(await waitFor(async () => (await rowA.getAttribute('data-v4-group-state').catch(() => null)) === 'imported', 10000), "그룹장 V4 칸 = imported ('다시 가져오기')");
  await rowA.locator(sel('v4-group-import')).click();
  r.check(await waitFor(rowA.locator(sel('v4-group-result')), 20000), '다시 가져오기 결과 표');
  r.check((await changedIn(A.page)) === 0, '다시 가져오기 = 바뀐 것 0 (남이 가져온 라벨에 이름으로 잇는다)');
  r.check((await v5('items')).length === 4 && (await v5('labels')).filter((l) => !l.deletedAt).length === 3, '항목·라벨 그대로 (겹치지 않는다)');
  await A.page.evaluate(() => window.sp5.closeAllWindows());

  r.section('V4에 나중에 든 teacher3 - 초대 코드 없이 구성원으로');
  await updateDoc(doc(em.db, 'groups', GID), { members: arrayUnion(uidC) });
  const C = await newPage(browser);
  await open(C.page, `#/day/${DAY}`, { as: '3' });
  await C.page.evaluate(() => window.sp5.openWindow('group'));
  const rowC = C.page.locator(sel('v4-group', GID));
  r.check(await waitFor(rowC, 10000), 'teacher3에게도 V4 그룹');
  await waitFor(async () => await rowC.locator(sel('v4-group-import')).isEnabled(), 8000);
  await rowC.locator(sel('v4-group-import')).click();
  const joined = await serverUntil(async () => (await getDoc(doc(em.db, 'spaces', SID))).data(), (d) => d?.members?.[uidC] === 'member', 15000);
  r.check(joined?.members?.[uidC] === 'member' && joined?.ownerId === uidA, '이미 있는 공간에 member로 들어간다 (주인 그대로)');
  r.check(await waitFor(rowC.locator(sel('v4-group-result')), 20000), 'teacher3 결과 표');
  r.check((await v5('items')).length === 4, '항목이 겹치지 않는다 (결정적 id)');
  await C.page.evaluate(() => window.sp5.closeAllWindows());
  r.check(await waitFor(C.page.locator('[data-event-card]', { hasText: 'V4 그룹 둘째 일정' }), 10000), 'teacher3 하루 화면에 그룹 일정');

  r.section('백업 창에서 공유 그룹 창으로');
  await A.page.evaluate(() => window.sp5.openWindow('backup', { tab: 'import' }));
  await A.page.locator(sel('import-groups-open')).click();
  r.check(await waitFor(A.page.locator(sel('groups-window')), 8000), "백업 창 '가져오기' 탭 → 👥 공유 그룹 창");
  await A.page.evaluate(() => window.sp5.closeAllWindows());
  r.check(A.errors.length === 0 && B.errors.length === 0 && C.errors.length === 0, `화면 오류 없음 ${[...A.errors, ...B.errors, ...C.errors].join(' | ')}`);
} catch (e) {
  r.bad(`점검이 멈췄다: ${e?.stack ?? e}`);
} finally {
  await undo.run();
  await browser.close();
  r.done();
  process.exit();
}
