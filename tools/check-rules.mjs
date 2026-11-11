// tools/check-rules.mjs
//
// 보안 규칙(firestore.rules)을 에뮬레이터에 올려 놓고, 되어야 하는 일과 막혀야 하는 일을
// 하나씩 해 본다. 규칙만 눈으로 읽어서는 무엇이 깨지는지 알 수 없다.
//
//   npm run emu   (다른 창 - 이 저장소에서 켜야 이 저장소의 규칙을 읽는다)
//   npm run check:rules
//
// 앞은 V3·V4 자리(users·groups·inviteCodes)가 모두 막혔는지(11-11 P31 - 규칙에서 지웠다. 예전 V4 35가지는 그 자리의 허락을 보았다)와
// 공용 문서(sharedConfig·admin), 뒤는 V5(spaces …).
//
// ⚠️ 이 스크립트는 에뮬레이터만 건드린다. 운영 데이터와는 아무 상관이 없다.
import { initializeApp, deleteApp } from 'firebase/app';
import {
  getFirestore, connectFirestoreEmulator, doc, setDoc, getDoc, getDocs, updateDoc,
  deleteDoc, collection, query, where, orderBy, limit, deleteField, writeBatch, serverTimestamp,
  getCountFromServer, FieldPath,
} from 'firebase/firestore';
import {
  getAuth, connectAuthEmulator, signInWithEmailAndPassword, createUserWithEmailAndPassword,
} from 'firebase/auth';

let pass = 0;
let fail = 0;

function client(name) {
  const app = initializeApp({ projectId: 'schoolplannerv3', apiKey: 'fake-api-key' }, name);
  const db = getFirestore(app);
  const auth = getAuth(app);
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  return { app, db, auth };
}

async function login(c, email) {
  try { await createUserWithEmailAndPassword(c.auth, email, 'test1234'); } catch { /* 이미 있음 */ }
  const cred = await signInWithEmailAndPassword(c.auth, email, 'test1234');
  return cred.user.uid;
}

/** 구글 로그인처럼 '메일 확인됨'으로 - 에뮬레이터 비밀번호 계정은 확인 안 됨이고, 규칙 isDeveloper가 그것을 본다 */
async function verifyEmail(c, uid) {
  const res = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/projects/schoolplannerv3/accounts:update', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
    body: JSON.stringify({ localId: uid, emailVerified: true }),
  });
  if (!res.ok) throw new Error(`메일 확인 표시 실패 ${res.status}`);
  await c.auth.currentUser.getIdToken(true);
}

/** 되어야 하는 일 */
async function must(what, fn) {
  try {
    await fn();
    console.log(`  ✔ ${what}`);
    pass++;
  } catch (e) {
    console.log(`  ✘ ${what} — 막혔다 (${e.code || e.message})`);
    fail++;
  }
}

/** 막혀야 하는 일 */
async function mustNot(what, fn) {
  try {
    await fn();
    console.log(`  ✘ ${what} — 그런데 됐다!`);
    fail++;
  } catch (e) {
    const denied = e.code === 'permission-denied';
    console.log(`  ${denied ? '✔' : '△'} ${what} — ${denied ? '막혔다' : '다른 이유로 실패: ' + (e.code || e.message)}`);
    if (denied) pass++;
    else fail++;
  }
}

// '기기 시각' 시험 값 - 지금보다 5초 앞. 에뮬레이터 request.time은 밀리초까지라 같은 PC에서 new Date()가 20번에 한 번쯤 같은 밀리초에 떨어져 통과한다(P19-1 ■1)
const deviceTime = () => new Date(Date.now() - 5000);

const p2 = (n) => String(n).padStart(2, '0');
const t = new Date();
const today = `${t.getFullYear()}-${p2(t.getMonth() + 1)}-${p2(t.getDate())}`;

async function run() {
  const A = client('owner');     // 그룹장
  const B = client('member');    // 초대 코드로 들어올 사람
  const X = client('outsider');  // 아무 관계 없는 사람

  const aUid = await login(A, 'teacher@example.com');
  const bUid = await login(B, 'teacher2@example.com');
  const xUid = await login(X, 'stranger@example.com');

  console.log('\n[V3·V4 자리] — 규칙에서 지웠다(P31): 내 것이어도 모두 막힌다');
  await mustNot('내 V4 개인 자료 읽기 (users/{나})', () => getDoc(doc(A.db, 'users', aUid, 'settings', 'labels')));
  await mustNot('내 V4 개인 자료 쓰기', () => setDoc(doc(A.db, 'users', aUid, 'journals', today), { entries: [], updatedAt: Date.now() }));
  await mustNot('V4 그룹 만들기 (groups)', () => setDoc(doc(A.db, 'groups', 'grp_rulecheck'), { name: '규칙 점검', ownerId: aUid, members: [aUid], createdAt: Date.now() }));
  await mustNot('내가 든 V4 그룹 목록', () => getDocs(query(collection(A.db, 'groups'), where('members', 'array-contains', aUid))));
  await mustNot('V4 그룹 아래 자료 읽기', () => getDoc(doc(A.db, 'groups', 'grp_rulecheck', 'journals', today)));
  await mustNot('V4 초대 코드 읽기 (inviteCodes)', () => getDoc(doc(B.db, 'inviteCodes', 'RULECHK')));
  await mustNot('V4 초대 코드 만들기', () => setDoc(doc(A.db, 'inviteCodes', 'RULECHK'), { groupId: 'grp_rulecheck', ownerId: aUid, createdAt: Date.now() }));

  console.log('\n[나이스 키 sharedConfig] — 로그인하면 읽고, 쓰기는 개발자만');
  const D = client('developer');
  await verifyEmail(D, await login(D, 'hyundonglim80@gmail.com'));
  await must('개발자가 키를 저장한다', async () => {
    await setDoc(doc(D.db, 'sharedConfig', 'neis'), { key: 'RULECHECK-KEY', updatedAt: Date.now() });
  });
  await must('아무 사용자나 키를 읽는다', async () => {
    const d = await getDoc(doc(X.db, 'sharedConfig', 'neis'));
    if (d.data()?.key !== 'RULECHECK-KEY') throw new Error('키를 못 읽었다');
  });
  await mustNot('개발자가 아니면 키를 못 바꾼다', async () => {
    await setDoc(doc(X.db, 'sharedConfig', 'neis'), { key: 'HIJACK' });
  });
  await mustNot('개발자가 아니면 admin/config는 못 읽는다', async () => {
    const d = await getDoc(doc(X.db, 'admin', 'config'));
    if (!d.exists()) throw Object.assign(new Error('없음'), { code: 'permission-denied' });
  });
  await must('개발자가 점검용 키를 지운다', async () => {
    await deleteDoc(doc(D.db, 'sharedConfig', 'neis'));
  });

  await runV5({ A, B, X, D, aUid, bUid, xUid });

  console.log(`\n───────── ${pass}개 통과 / ${fail}개 실패 ─────────`);
  for (const c of [A, B, X, D]) await deleteApp(c.app).catch(() => {});
  process.exit(fail === 0 ? 0 : 1);
}

// ─── V5: spaces · spaceInvites · v5alarms · v5Errors · v5Mail · 대화(runChat) ─
//
// '문서가 없으면 막힌 것으로 친다'를 쓰지 않는다. 읽기 시험은 문서가 있는 데서만
// 하므로, 규칙이 열려 있으면 그대로 '그런데 됐다'가 나온다.
async function runV5({ A, B, X, D, aUid, bUid, xUid }) {
  const now = () => Date.now();
  const space = (c, sid) => doc(c.db, 'spaces', sid);
  const item = (c, sid, id) => doc(c.db, 'spaces', sid, 'items', id);
  const invite = (c, code) => doc(c.db, 'spaceInvites', code);
  // 저장 도우미(src/data/repo)가 적는 모양 - 서버 시각·지운 표시 null·판
  const note = (text) => ({
    kind: 'note', date: null, text, labelIds: [], order: 'a0',
    createdAt: now(), authorId: 'rc', deletedAt: null, updatedAt: serverTimestamp(), v: 1,
  });

  // 개인 공간 시험은 점검 전용 계정 X로 한다(teacher의 개인 공간은 앱·seed가 만든다).
  const xs = `u_${xUid}`;
  const personal = { kind: 'personal', name: '', ownerId: xUid, members: { [xUid]: 'owner' }, createdAt: now(), updatedAt: now(), v: 1 };

  console.log('\n══════════ V5 ══════════');
  console.log('\n[V5 개인 공간] — 그 사람만');
  await must('내 개인 공간 문서를 읽어 본다 (없어도 된다)', async () => {
    await getDoc(space(X, xs));
  });
  await must('내 개인 공간을 만든다', async () => {
    await setDoc(space(X, xs), personal);
  });
  await must('내 공간에 항목을 쓰고 읽는다', async () => {
    await setDoc(item(X, xs, 'rc_x'), note('X의 메모'));
    if (!(await getDoc(item(X, xs, 'rc_x'))).exists()) throw new Error('못 읽었다');
  });
  await mustNot('남의 이름(u_다른 uid)으로 개인 공간을 만든다', async () => {
    await setDoc(space(X, 'u_somebody_else'), personal);
  });
  await mustNot('남의 개인 공간 문서를 읽는다', async () => {
    await getDoc(space(A, xs));
  });
  await mustNot('남의 개인 공간 항목을 읽는다', async () => {
    await getDoc(item(A, xs, 'rc_x'));
  });
  await mustNot('남의 개인 공간 항목을 목록으로 읽는다', async () => {
    await getDocs(collection(A.db, 'spaces', xs, 'items'));
  });
  await mustNot('남의 개인 공간에 항목을 쓴다', async () => {
    await setDoc(item(A, xs, 'rc_a'), note('A가 몰래 씀'));
  });
  await mustNot('개인 공간에 남을 구성원으로 넣는다', async () => {
    await updateDoc(space(X, xs), { [`members.${aUid}`]: 'member' });
  });
  await mustNot('남이 내 개인 공간에 스스로 들어온다', async () => {
    await updateDoc(space(A, xs), { [`members.${aUid}`]: 'member' });
  });
  await mustNot('개인 공간을 그룹으로 바꾼다', async () => {
    await updateDoc(space(X, xs), { kind: 'group' });
  });
  await mustNot('개인 공간 문서를 지운다', async () => {
    await deleteDoc(space(X, xs));
  });
  await must('내 항목을 지운다', async () => {
    await deleteDoc(item(X, xs, 'rc_x'));
  });

  console.log('\n[V5 항목·라벨 모양] — 종류·지운 표시·판·서버 시각만 본다');
  const label = (name) => ({
    kind: 'note', name, color: '#888', parentId: null, order: 'a0',
    createdAt: now(), authorId: 'rc', deletedAt: null, updatedAt: serverTimestamp(), v: 1,
  });
  const label1 = doc(X.db, 'spaces', xs, 'labels', 'rc_l');
  await must('저장 도우미 모양으로 항목을 만든다', async () => {
    await setDoc(item(X, xs, 'rc_m'), note('모양 점검'));
  });
  await must('칸을 고치며 서버 시각을 붙인다', async () => {
    await updateDoc(item(X, xs, 'rc_m'), { text: '고침', updatedAt: serverTimestamp() });
  });
  await must('지운 표시를 붙인다', async () => {
    await updateDoc(item(X, xs, 'rc_m'), { deletedAt: serverTimestamp(), deletedBy: xUid, updatedAt: serverTimestamp() });
  });
  await must('되살린다 (지운 표시 null)', async () => {
    await updateDoc(item(X, xs, 'rc_m'), { deletedAt: null, deletedBy: deleteField(), updatedAt: serverTimestamp() });
  });
  await mustNot('서버 시각을 빠뜨리고 칸만 고친다 (다른 기기에 가지 않는다)', async () => {
    await updateDoc(item(X, xs, 'rc_m'), { text: '서버 시각 없이' });
  });
  await mustNot('기기 시각(ms)을 updatedAt에 쓴다', async () => {
    await setDoc(item(X, xs, 'rc_m2'), { ...note('기기 시각'), updatedAt: now() });
  });
  await mustNot('deletedAt 칸 없이 만든다 (쿼리로 거를 수 없다)', async () => {
    const { deletedAt: _omit, ...rest } = note('지운 표시 없음');
    await setDoc(item(X, xs, 'rc_m2'), rest);
  });
  await mustNot('deletedAt에 글자를 쓴다', async () => {
    await setDoc(item(X, xs, 'rc_m2'), { ...note('틀린 지운 표시'), deletedAt: 'yes' });
  });
  await mustNot("종류가 'event'·'note'가 아닌 항목", async () => {
    await setDoc(item(X, xs, 'rc_m2'), { ...note('틀린 종류'), kind: 'task' });
  });
  await mustNot('판(v)이 없는 항목', async () => {
    const { v: _omit, ...rest } = note('판 없음');
    await setDoc(item(X, xs, 'rc_m2'), rest);
  });
  await must('라벨을 만든다', async () => {
    await setDoc(label1, label('수업'));
  });
  await mustNot('종류 없는 라벨', async () => {
    const { kind: _omit, ...rest } = label('종류 없음');
    await setDoc(doc(X.db, 'spaces', xs, 'labels', 'rc_l2'), rest);
  });
  await must('설정 문서는 모양을 보지 않는다', async () => {
    await setDoc(doc(X.db, 'spaces', xs, 'settings', 'rc_settings'), { fontScale: 1.1 });
  });
  await must('영구 지우기 (모양과 상관없이)', async () => {
    await deleteDoc(item(X, xs, 'rc_m'));
    await deleteDoc(label1);
    await deleteDoc(doc(X.db, 'spaces', xs, 'settings', 'rc_settings'));
  });

  const gs = 'g_rulecheck';
  const code = 'V5RULECHK';
  const code2 = 'V5RULECK2';
  const code3 = 'V5RULECK3';
  const group = {
    kind: 'group', name: '규칙 점검 그룹', ownerId: aUid, members: { [aUid]: 'owner' },
    inviteCode: code, createdAt: now(), updatedAt: now(), v: 1,
  };

  console.log('\n[V5 그룹 만들기·초대 코드]');
  await mustNot('처음부터 남을 구성원으로 넣어 그룹을 만든다', async () => {
    await setDoc(space(A, 'g_rulecheck_bad'), { ...group, members: { [aUid]: 'owner', [bUid]: 'member' } });
  });
  await mustNot('g_로 시작하지 않는 이름으로 그룹을 만든다', async () => {
    await setDoc(space(A, 'rulecheck'), group);
  });
  await must('그룹 공간과 초대 코드를 한 묶음으로 만든다 (getAfter)', async () => {
    const b = writeBatch(A.db);
    b.set(space(A, gs), group);
    b.set(invite(A, code), { sid: gs, ownerId: aUid });
    await b.commit();
  });
  await must('주인이 그룹에 항목을 쓴다', async () => {
    await setDoc(item(A, gs, 'rc_g1'), note('그룹 메모'));
  });
  await mustNot('남이 내 그룹을 가리키는 초대 코드를 만든다', async () => {
    await setDoc(invite(X, 'V5HIJACK'), { sid: gs, ownerId: xUid });
  });
  await mustNot('남이 이미 있는 초대 코드를 덮는다', async () => {
    await setDoc(invite(X, code), { sid: xs, ownerId: xUid });
  });
  await mustNot('초대 코드를 목록으로 훑는다', async () => {
    await getDocs(collection(X.db, 'spaceInvites'));
  });

  console.log('\n[V5 참여] — 나만, member로만, 지금 열린 코드를 joinCodes.<나>에 (P14-1)');
  await must('코드를 아는 사람은 초대 코드 하나를 읽는다', async () => {
    const d = await getDoc(invite(B, code));
    if (d.data()?.sid !== gs) throw new Error('초대 코드를 못 읽었다');
  });
  await mustNot('참여 전에는 그룹 문서를 읽지 못한다', async () => {
    await getDoc(space(B, gs));
  });
  await mustNot('참여 전에는 그룹 항목을 읽지 못한다', async () => {
    await getDoc(item(B, gs, 'rc_g1'));
  });
  await mustNot('공간 전체를 목록으로 훑는다', async () => {
    await getDocs(collection(X.db, 'spaces'));
  });
  await mustNot("스스로 'owner'로 참여한다", async () => {
    await updateDoc(space(X, gs), { [`members.${xUid}`]: 'owner', [`joinCodes.${xUid}`]: code });
  });
  await mustNot('참여하면서 남도 함께 넣는다', async () => {
    await updateDoc(space(X, gs), { [`members.${xUid}`]: 'member', [`members.${bUid}`]: 'member', [`joinCodes.${xUid}`]: code });
  });
  await mustNot('참여하면서 그룹 이름도 바꾼다', async () => {
    await updateDoc(space(X, gs), { [`members.${xUid}`]: 'member', [`joinCodes.${xUid}`]: code, name: 'X가 바꿈' });
  });
  await mustNot('코드 없이 그룹 이름(sid)만 알고 참여한다', async () => {
    await updateDoc(space(X, gs), { [`members.${xUid}`]: 'member', updatedAt: now() });
  });
  await mustNot('틀린 코드로 참여한다', async () => {
    await updateDoc(space(X, gs), { [`members.${xUid}`]: 'member', [`joinCodes.${xUid}`]: 'WRONG1', updatedAt: now() });
  });
  await mustNot('참여하면서 남의 joinCodes 칸도 적는다', async () => {
    await updateDoc(space(X, gs), { [`members.${xUid}`]: 'member', [`joinCodes.${xUid}`]: code, [`joinCodes.${bUid}`]: code, updatedAt: now() });
  });
  await must('맞는 코드로 나만 member로 참여한다', async () => {
    await updateDoc(space(B, gs), { [`members.${bUid}`]: 'member', [`joinCodes.${bUid}`]: code, updatedAt: now() });
  });
  await mustNot('앞사람이 맞는 코드로 들어온 뒤 코드 없이 참여한다 (남은 joinCodes 값)', async () => {
    await updateDoc(space(X, gs), { [`members.${xUid}`]: 'member', updatedAt: now() });
  });
  await must('참여한 뒤 그룹 문서를 읽는다', async () => {
    if (!(await getDoc(space(B, gs))).exists()) throw new Error('못 읽었다');
  });
  await must('참여한 뒤 그룹 항목을 읽고 쓴다', async () => {
    if (!(await getDoc(item(B, gs, 'rc_g1'))).exists()) throw new Error('못 읽었다');
    await setDoc(item(B, gs, 'rc_g2'), note('B가 남긴 메모'));
  });
  await must("내 공간 목록 (where members.<uid> in ['owner','member'])", async () => {
    const s = await getDocs(query(collection(B.db, 'spaces'), where(`members.${bUid}`, 'in', ['owner', 'member'])));
    if (!s.docs.some((d) => d.id === gs)) throw new Error('내 그룹이 안 나온다');
  });

  console.log('\n[V5 구성원이 못 하는 것]');
  await mustNot('그룹 이름을 바꾼다', async () => {
    await updateDoc(space(B, gs), { name: 'B가 바꿈' });
  });
  await mustNot('주인을 뺀다', async () => {
    await updateDoc(space(B, gs), { [`members.${aUid}`]: deleteField() });
  });
  await mustNot('스스로 owner가 된다', async () => {
    await updateDoc(space(B, gs), { [`members.${bUid}`]: 'owner' });
  });
  await mustNot('그룹을 지운다', async () => {
    await deleteDoc(space(B, gs));
  });

  // 내보내기 (P14-1 ■2 - data/spaces removeMember): 주인 갈래로 members·joinCodes·people을 지우고 코드도 바꾼다
  console.log('\n[V5 내보내기] — 주인만, 코드도 바꾼다');
  await must('(준비) 구성원 이름 people/B', async () => {
    await setDoc(doc(B.db, 'spaces', gs, 'people', bUid), { name: 'B', updatedAt: now(), v: 1 });
  });
  await must('주인이 구성원을 내보낸다 (members·joinCodes·people + 새 코드 한 묶음)', async () => {
    const b = writeBatch(A.db);
    b.update(space(A, gs), { [`members.${bUid}`]: deleteField(), [`joinCodes.${bUid}`]: deleteField(), inviteCode: code2, updatedAt: now() });
    b.set(invite(A, code2), { sid: gs, ownerId: aUid });
    b.delete(doc(A.db, 'spaces', gs, 'people', bUid));
    await b.commit();
  });
  await must('주인이 옛 코드 문서를 지운다 (묶음 밖)', async () => {
    await deleteDoc(invite(A, code));
  });
  await mustNot('내보낸 사람은 그룹 항목을 못 읽는다', async () => {
    await getDoc(item(B, gs, 'rc_g1'));
  });
  await mustNot('내보낸 사람이 옛 코드로 다시 참여한다', async () => {
    await updateDoc(space(B, gs), { [`members.${bUid}`]: 'member', [`joinCodes.${bUid}`]: code, updatedAt: now() });
  });
  await must('내보낸 사람도 새 코드를 받으면 다시 참여한다', async () => {
    await updateDoc(space(B, gs), { [`members.${bUid}`]: 'member', [`joinCodes.${bUid}`]: code2, updatedAt: now() });
  });

  console.log('\n[V5 나가기·코드 바꾸기·초대 닫기]');
  await must('구성원이 나간다', async () => {
    await updateDoc(space(B, gs), { [`members.${bUid}`]: deleteField() });
  });
  await mustNot('나간 뒤에는 그룹 항목을 못 읽는다', async () => {
    await getDoc(item(B, gs, 'rc_g1'));
  });
  await mustNot('주인은 나가지 못한다', async () => {
    await updateDoc(space(A, gs), { [`members.${aUid}`]: deleteField() });
  });
  await must('주인이 초대 코드를 바꾼다 (공간 inviteCode + 새 코드 한 묶음, 옛 코드 지우기)', async () => {
    const b = writeBatch(A.db);
    b.update(space(A, gs), { inviteCode: code3, updatedAt: now() });
    b.set(invite(A, code3), { sid: gs, ownerId: aUid });
    b.delete(invite(A, code2));
    await b.commit();
  });
  await mustNot('코드가 바뀐 뒤 옛 코드로 참여한다', async () => {
    await updateDoc(space(B, gs), { [`members.${bUid}`]: 'member', [`joinCodes.${bUid}`]: code2, updatedAt: now() });
  });
  await mustNot('코드가 바뀐 뒤 나갈 때 남은 옛 코드 칸으로 참여한다', async () => {
    await updateDoc(space(B, gs), { [`members.${bUid}`]: 'member', updatedAt: now() });
  });
  await must('새 코드로는 참여한다', async () => {
    await updateDoc(space(B, gs), { [`members.${bUid}`]: 'member', [`joinCodes.${bUid}`]: code3, updatedAt: now() });
  });
  await must('구성원이 다시 나간다', async () => {
    await updateDoc(space(B, gs), { [`members.${bUid}`]: deleteField(), updatedAt: now() });
  });
  await must('주인이 초대를 닫는다 (inviteCode 지우기)', async () => {
    await updateDoc(space(A, gs), { inviteCode: deleteField() });
  });
  await mustNot('초대가 닫히면 코드를 적어도 참여하지 못한다', async () => {
    await updateDoc(space(B, gs), { [`members.${bUid}`]: 'member', [`joinCodes.${bUid}`]: code3, updatedAt: now() });
  });

  const C = client('member2');
  const cUid = await login(C, 'teacher3@example.com');

  // 예전 V4 그룹 가져오기 갈래(P8-4 ■2 - V4 구성원이 g_{V4 id}를 남까지 넣어 만들었다)는 11-11 P31에 뗐다
  console.log('\n[V5 그룹 만들기] — 나 혼자 주인으로만 (V4 그룹 가져오기 갈래 없음 - P31)');
  const v4like = { kind: 'group', name: 'V4 그룹', ownerId: aUid, members: { [aUid]: 'owner', [bUid]: 'member' }, createdAt: now(), updatedAt: now(), v: 1 };
  await mustNot('구성원이 남(A)을 주인으로 넣어 만든다 (옛 V4 가져오기 모양)', () => setDoc(space(B, 'g_v4grpRulecheck'), v4like));
  await mustNot('주인이 남(B)을 함께 넣어 만든다', () => setDoc(space(A, 'g_v4grpRulecheck'), v4like));

  console.log('\n[V5 v5alarms] — 함수만');
  await mustNot('앱이 알림 큐를 읽는다', async () => {
    await getDoc(doc(A.db, 'v5alarms', 'rc_g1'));
  });
  await mustNot('앱이 알림 큐에 쓴다', async () => {
    await setDoc(doc(A.db, 'v5alarms', 'rc_g1'), { pendingAt: now() });
  });

  console.log('\n[V5 v5Errors] — 제 오류는 만들기만, 읽기·지우기는 개발자 (P14-2)');
  // src/data/errorReport.ts가 보내는 모양 (expireAt = 30일 뒤)
  const report = (uid, extra = {}) => ({
    kind: 'error', message: 'TypeError: x is undefined', stack: 'at f (A.tsx:1:2)', note: '', build: 'rc', scope: 'day',
    device: 'pc', standalone: false, ua: 'rule-check', uid, at: serverTimestamp(), expireAt: new Date(now() + 30 * 86400000), ...extra,
  });
  const errDoc = (c, id) => doc(c.db, 'v5Errors', id);
  await must('로그인한 사람이 제 오류를 보낸다', async () => {
    await setDoc(errDoc(A, 'rc_e1'), report(aUid));
  });
  await mustNot('남의 uid로 보낸다', async () => {
    await setDoc(errDoc(A, 'rc_e2'), report(bUid));
  });
  await mustNot('긴 문장 (301자)', async () => {
    await setDoc(errDoc(A, 'rc_e3'), report(aUid, { message: 'x'.repeat(301) }));
  });
  await mustNot('긴 스택 (1501자)', async () => {
    await setDoc(errDoc(A, 'rc_e3'), report(aUid, { stack: 'x'.repeat(1501) }));
  });
  await mustNot('모르는 칸 (메모 글)', async () => {
    await setDoc(errDoc(A, 'rc_e3'), report(aUid, { text: '김철수 상담' }));
  });
  await mustNot('모르는 종류', async () => {
    await setDoc(errDoc(A, 'rc_e3'), report(aUid, { kind: 'log' }));
  });
  await mustNot('서버 시각이 아닌 at', async () => {
    await setDoc(errDoc(A, 'rc_e3'), report(aUid, { at: deviceTime() }));
  });
  await mustNot('먼 expireAt (40일 - TTL을 피해 오래 남기기)', async () => {
    await setDoc(errDoc(A, 'rc_e3'), report(aUid, { expireAt: new Date(now() + 40 * 86400000) }));
  });
  await mustNot('칸을 빼고 보낸다 (stack 없이)', async () => {
    const { stack: _s, ...rest } = report(aUid);
    await setDoc(errDoc(A, 'rc_e3'), rest);
  });
  await mustNot('보낸 사람도 제 오류를 읽지 못한다', async () => {
    await getDoc(errDoc(A, 'rc_e1'));
  });
  await mustNot('개발자 아닌 사람의 목록', async () => {
    await getDocs(collection(B.db, 'v5Errors'));
  });
  await mustNot('보낸 오류를 고친다', async () => {
    await updateDoc(errDoc(A, 'rc_e1'), { message: 'changed' });
  });
  await mustNot('개발자 아닌 사람이 지운다', async () => {
    await deleteDoc(errDoc(A, 'rc_e1'));
  });
  const U = client('unverifiedDeveloper');
  await login(U, 'hyundonglim.work@gmail.com');
  await mustNot('메일 확인이 안 된 계정은 개발자 메일이어도 목록을 읽지 못한다', async () => {
    await getDocs(query(collection(U.db, 'v5Errors'), limit(1)));
  });
  await mustNot('메일 확인이 안 된 계정은 개발자 메일이어도 공휴일을 쓰지 못한다', async () => {
    await setDoc(doc(U.db, 'holidays', '1999'), { days: [] });
  });
  await must('개발자가 목록을 읽는다', async () => {
    const snap = await getDocs(collection(D.db, 'v5Errors'));
    if (!snap.docs.some((d) => d.id === 'rc_e1')) throw new Error('보낸 오류가 목록에 없다');
  });
  await must('개발자가 지운다', async () => {
    await deleteDoc(errDoc(D, 'rc_e1'));
  });

  console.log('\n[V5 그룹장이 남 넣기] — 구성원은 스스로만 들어온다 (P15-1)');
  await mustNot('그룹장이 남을 구성원으로 넣는다', async () => {
    await updateDoc(space(A, gs), { [`members.${xUid}`]: 'member', updatedAt: now() });
  });

  // 쪽지 (P15-1 - src/data/mail.ts): 받는 사람마다 v5Mail/{그 사람}/mailIn/{id} + 내 v5Mail/{나}/mailSent/{id}를 한 묶음으로
  console.log('\n[V5 쪽지] — 같은 그룹 구성원끼리, 받는 쪽 한 장씩 + 내 사본 한 묶음 (P15-1)');
  const ms = 'g_rcmail';
  const mcode = 'V5RCMAIL';
  const rid = now().toString(36); // 지난 실행이 남긴 같은 id가 있으면 만들기가 고치기가 된다
  const inbox = (c, uid, id) => doc(c.db, 'v5Mail', uid, 'mailIn', id);
  const sentBox = (c, uid, id) => doc(c.db, 'v5Mail', uid, 'mailSent', id);
  const sentOf = (to, extra = {}) => ({
    sid: ms, groupName: '쪽지 점검', to, toNames: to.map(() => '선생님').join(', '), text: '내일 협의회는 3시입니다',
    at: serverTimestamp(), replyTo: null, expireAt: new Date(now() + 365 * 86400000), v: 1, ...extra,
  });
  const inOf = (from, to, extra = {}) => ({ from, fromName: '김선생', ...sentOf(to), readAt: null, ...extra });
  // 앱이 하는 대로 한 묶음. both = 두 상자에 같이, boxes = 받는 쪽을 쓸 상자(기본 to), noSent = 사본 없이, drop = 뺄 칸
  const send = async (c, from, id, to, { both = {}, inExtra = {}, sentExtra = {}, boxes = to, noSent = false, drop } = {}) => {
    const b = writeBatch(c.db);
    for (const uid of boxes) {
      const d = inOf(from, to, { ...both, ...inExtra });
      if (drop) delete d[drop];
      b.set(inbox(c, uid, id), d);
    }
    if (!noSent) b.set(sentBox(c, from, id), sentOf(to, { ...both, ...sentExtra }));
    await b.commit();
  };
  const m1 = `m1_${rid}`;
  const m2 = `m2_${rid}`;
  const m3 = `m3_${rid}`;
  const m4 = `m4_${rid}`; // 첨부와 함께 (P16)
  const m5 = `m5_${rid}`; // 첨부만 (P16)
  const r1 = `r1_${rid}`;
  const mx = `mx_${rid}`; // 막혀야 하는 시도들 - 막히면 아무것도 남지 않는다

  await must('(준비) 쪽지 그룹: 주인 A + 코드로 B·C가 들어온다', async () => {
    const b = writeBatch(A.db);
    b.set(space(A, ms), { ...group, name: '쪽지 점검', inviteCode: mcode });
    b.set(invite(A, mcode), { sid: ms, ownerId: aUid });
    await b.commit();
    await updateDoc(space(B, ms), { [`members.${bUid}`]: 'member', [`joinCodes.${bUid}`]: mcode, updatedAt: now() });
    await updateDoc(space(C, ms), { [`members.${cUid}`]: 'member', [`joinCodes.${cUid}`]: mcode, updatedAt: now() });
  });
  await must('A가 B에게 (B 받은 쪽지 + A 보낸 사본 한 묶음)', () => send(A, aUid, m1, [bUid]));
  await must('A가 B·C 둘에게', () => send(A, aUid, m2, [bUid, cUid]));
  await must('한글 2000자', () => send(A, aUid, m3, [bUid], { both: { text: '가'.repeat(2000) } }));
  // 첨부(P16) - 보낸 사람 드라이브의 붙임 목록, 있을 때만 칸째 1~10개
  const att = (i) => ({ id: `file_${i}`, name: `캡처${i}.png`, url: `https://drive.google.com/thumbnail?id=D${i}&sz=w1000`, type: 'image/png', size: 1234, driveId: `D${i}` });
  const atts = (n) => Array.from({ length: n }, (_, i) => att(i));
  await must('첨부 둘과 함께 (attachments)', () => send(A, aUid, m4, [bUid], { both: { attachments: atts(2) } }));
  await must('글 없이 첨부만 · 10개', () => send(A, aUid, m5, [bUid], { both: { text: '', attachments: atts(10) } }));
  await must('B가 받은 쪽지 목록을 읽는다', async () => {
    const s = await getDocs(collection(B.db, 'v5Mail', bUid, 'mailIn'));
    if (!s.docs.some((d) => d.id === m1)) throw new Error('받은 쪽지가 없다');
  });
  await must("B가 안 읽은 것만 묻는다 (where readAt == null, limit)", async () => {
    const s = await getDocs(query(collection(B.db, 'v5Mail', bUid, 'mailIn'), where('readAt', '==', null), limit(100)));
    if (!s.docs.some((d) => d.id === m1)) throw new Error('안 읽은 쪽지가 안 나온다');
  });
  await must("B가 최근 것부터 30개 (orderBy at desc)", async () => {
    await getDocs(query(collection(B.db, 'v5Mail', bUid, 'mailIn'), orderBy('at', 'desc'), limit(30)));
  });
  await must('B가 펼쳐 읽음 (readAt = 서버 시각)', () => updateDoc(inbox(B, bUid, m1), { readAt: serverTimestamp() }));
  await must('다른 기기에서 다시 읽음 (이미 읽은 것)', () => updateDoc(inbox(B, bUid, m1), { readAt: serverTimestamp() }));
  await must('B가 답장한다 (replyTo)', () => send(B, bUid, r1, [aUid], { both: { replyTo: m1 } }));
  await must('A가 보낸 사본을 읽고 목록을 본다', async () => {
    if (!(await getDoc(sentBox(A, aUid, m1))).exists()) throw new Error('사본이 없다');
    await getDocs(collection(A.db, 'v5Mail', aUid, 'mailSent'));
  });
  await must('B가 받은 쪽지를 지운다', () => deleteDoc(inbox(B, bUid, m1)));
  await must('A가 보낸 사본을 지운다', () => deleteDoc(sentBox(A, aUid, m1)));

  await mustNot('그룹 밖 X가 B에게', () => send(X, xUid, mx, [bUid]));
  await mustNot('A가 그룹 밖 X에게', () => send(A, aUid, mx, [xUid]));
  await mustNot('from을 남(B)으로 적는다', () => send(A, aUid, mx, [cUid], { inExtra: { from: bUid } }));
  await mustNot('받는 사람 목록에 없는 C의 상자에도 넣는다', () => send(A, aUid, mx, [bUid], { boxes: [bUid, cUid] }));
  await mustNot('나에게 보낸다', () => send(A, aUid, mx, [aUid]));
  await mustNot('보낸 사본 없이 받는 쪽만 만든다', () => send(A, aUid, mx, [bUid], { noSent: true }));
  await mustNot('남(B)의 보낸 사본을 만든다', () => setDoc(sentBox(A, bUid, mx), sentOf([cUid])));
  await mustNot('2001자', () => send(A, aUid, mx, [bUid], { both: { text: '가'.repeat(2001) } }));
  await mustNot('빈 글', () => send(A, aUid, mx, [bUid], { both: { text: '' } }));
  await mustNot('첨부 11개', () => send(A, aUid, mx, [bUid], { both: { attachments: atts(11) } }));
  await mustNot('빈 첨부 목록', () => send(A, aUid, mx, [bUid], { both: { attachments: [] } }));
  await mustNot('빈 글 + 빈 첨부 목록', () => send(A, aUid, mx, [bUid], { both: { text: '', attachments: [] } }));
  await mustNot('첨부가 목록이 아니다', () => send(A, aUid, mx, [bUid], { both: { attachments: 'https://example.com/x' } }));
  await mustNot('B가 받은 쪽지 첨부를 고친다', () => updateDoc(inbox(B, bUid, m4), { attachments: atts(1) }));
  await mustNot('모르는 칸', () => send(A, aUid, mx, [bUid], { inExtra: { secret: '김철수' } }));
  await mustNot('칸을 뺀다 (replyTo 없이 - undefined는 칸째 빠진다)', () => send(A, aUid, mx, [bUid], { drop: 'replyTo' }));
  await mustNot('at을 기기 시각으로', () => send(A, aUid, mx, [bUid], { both: { at: deviceTime() } }));
  await mustNot('읽음을 적은 채 만든다', () => send(A, aUid, mx, [bUid], { inExtra: { readAt: serverTimestamp() } }));
  await mustNot('먼 expireAt (400일 - TTL을 피해 오래 남기기)', () => send(A, aUid, mx, [bUid], { both: { expireAt: new Date(now() + 400 * 86400000) } }));
  await mustNot('개인 공간을 sid로', () => send(A, aUid, mx, [bUid], { both: { sid: `u_${aUid}` } }));
  await mustNot("'/'가 든 sid", () => send(A, aUid, mx, [bUid], { both: { sid: `${ms}/people/${bUid}` } }));
  await mustNot('그룹 이름을 꾸민다', () => send(A, aUid, mx, [bUid], { both: { groupName: '교육청 공지' } }));
  await mustNot('구성원이 아닌 사람을 사본 받는 사람에', () => setDoc(sentBox(A, aUid, mx), sentOf([xUid])));
  await mustNot('X가 B의 받은 쪽지를 읽는다', () => getDoc(inbox(X, bUid, m2)));
  await mustNot('X가 B의 받은 쪽지 목록을 본다', () => getDocs(collection(X.db, 'v5Mail', bUid, 'mailIn')));
  await mustNot('보낸 A도 B의 받은 쪽은 읽지 못한다', () => getDoc(inbox(A, bUid, m2)));
  await mustNot('B가 A의 보낸 사본을 읽는다', () => getDoc(sentBox(B, aUid, m2)));
  await mustNot('B가 받은 쪽지 글을 고친다', () => updateDoc(inbox(B, bUid, m2), { text: '바꿈' }));
  await mustNot('B가 읽음과 함께 보낸 사람도 고친다', () => updateDoc(inbox(B, bUid, m2), { readAt: serverTimestamp(), fromName: '교감' }));
  await mustNot('C가 B의 읽음을 적는다', () => updateDoc(inbox(C, bUid, m2), { readAt: serverTimestamp() }));
  await mustNot('읽음을 기기 시각으로', () => updateDoc(inbox(B, bUid, m2), { readAt: deviceTime() }));
  await mustNot('A가 보낸 사본을 고친다', () => updateDoc(sentBox(A, aUid, m2), { text: '바꿈' }));
  await mustNot('v5Mail/{나} 문서 자신에 쓴다', () => setDoc(doc(B.db, 'v5Mail', bUid), { x: 1 }));
  await mustNot('v5Mail/{나} 아래 다른 상자에 쓴다', () => setDoc(doc(B.db, 'v5Mail', bUid, 'other', 'x'), { x: 1 }));

  // 받는 사람이 많아도 한 묶음 - 규칙의 get은 같은 문서(그룹·사본)라 한 번씩만 센다(서로 다른 문서는 20개까지)
  const J = client('mailJoiners');
  const joiners = [];
  await must('(준비) 49명이 코드로 들어온다 (B·C와 함께 51명)', async () => {
    for (let i = 0; i < 49; i++) {
      const uid = await login(J, `rc-mail-${i}@example.com`);
      await updateDoc(space(J, ms), { [`members.${uid}`]: 'member', [`joinCodes.${uid}`]: mcode, updatedAt: now() });
      joiners.push(uid);
    }
  });
  const m50 = `m50_${rid}`;
  await must('50명에게 한 묶음 (쓰기 51개)', () => send(A, aUid, m50, [bUid, cUid, ...joiners.slice(0, 48)]));
  await mustNot('51명에게', () => send(A, aUid, mx, [bUid, cUid, ...joiners]));
  await must('(정리) 49명이 받은 쪽지를 지우고 나간다', async () => {
    for (let i = 0; i < 49; i++) {
      const uid = await login(J, `rc-mail-${i}@example.com`);
      if (i < 48) await deleteDoc(inbox(J, uid, m50));
      await updateDoc(space(J, ms), { [`members.${uid}`]: deleteField(), updatedAt: now() });
    }
  });

  await must('(준비) C가 그룹을 나간다', () => updateDoc(space(C, ms), { [`members.${cUid}`]: deleteField(), updatedAt: now() }));
  await mustNot('A가 나간 C에게', () => send(A, aUid, mx, [cUid]));
  await mustNot('나간 C가 A에게', () => send(C, cUid, mx, [aUid]));
  await must('나간 C도 받은 쪽지는 읽고 지운다', async () => {
    if (!(await getDoc(inbox(C, cUid, m2))).exists()) throw new Error('받은 쪽지가 없다');
    await deleteDoc(inbox(C, cUid, m2));
    await deleteDoc(inbox(C, cUid, m50));
  });

  await must('(정리) 쪽지·쪽지 그룹을 지운다', async () => {
    for (const id of [m2, m3, m4, m5]) await deleteDoc(inbox(B, bUid, id));
    await deleteDoc(inbox(B, bUid, m50));
    await deleteDoc(sentBox(B, bUid, r1));
    await deleteDoc(inbox(A, aUid, r1));
    for (const id of [m2, m3, m4, m5, m50]) await deleteDoc(sentBox(A, aUid, id));
    await deleteDoc(invite(A, mcode));
    await deleteDoc(space(A, ms));
  });
  await runChat({ A, B, C, X, J, aUid, bUid, cUid, xUid, group, space, invite, now });
  await deleteApp(J.app).catch(() => {});

  console.log('\n[V5 정리]');
  await must('주인이 그룹 항목을 비운다', async () => {
    await deleteDoc(item(A, gs, 'rc_g1'));
    await deleteDoc(item(A, gs, 'rc_g2'));
  });
  await must('주인이 초대 코드를 지운다', async () => {
    await deleteDoc(invite(A, code3));
  });
  await must('주인이 그룹을 지운다', async () => {
    await deleteDoc(space(A, gs));
  });
}

// ─── V5 대화 (P19-1 - src/data/chat.ts) ─────────────────────────────
// 그룹 방 v5Chat/{sid}/chatRooms/{all | r_…} · 1:1 v5Dm/{d_작은uid_큰uid} · 글은 그 아래 chatMsgs · 내 읽음 v5ChatReads/{uid}.
// 글 + 방 미리 보기를 한 묶음으로 쓴다(앱이 하는 대로). 대화는 지우기 규칙이 없어(TTL) 정리는 에뮬레이터 관리자 지우기('Bearer owner').
async function runChat({ A, B, C, X, J, aUid, bUid, cUid, xUid, group, space, invite, now }) {
  console.log('\n[V5 대화] — 같은 그룹 구성원끼리, 방 + 함께 보는 글 (P19-1)');
  const rid = now().toString(36);
  const made = []; // 관리자가 끝에 지울 경로
  const adminRemove = (path) =>
    fetch(`http://127.0.0.1:8080/v1/projects/schoolplannerv3/databases/(default)/documents/${path}`, { method: 'DELETE', headers: { Authorization: 'Bearer owner' } });
  const g1 = `g_rcchat${rid}`; // A 주인 + B·C
  const g2 = `g_rcchatb${rid}`; // A 주인 + B
  const code1 = `CH1${rid}`.toUpperCase();
  const code2 = `CH2${rid}`.toUpperCase();
  const room = (c, sid, r) => doc(c.db, 'v5Chat', sid, 'chatRooms', r);
  const msgs = (c, sid, r) => collection(c.db, 'v5Chat', sid, 'chatRooms', r, 'chatMsgs');
  const [lo, hi] = [aUid, bUid].sort();
  const pair = `d_${lo}_${hi}`;
  const dm = (c, p) => doc(c.db, 'v5Dm', p);
  const dmMsgs = (c, p) => collection(c.db, 'v5Dm', p, 'chatMsgs');
  const reads = (c, uid) => doc(c.db, 'v5ChatReads', uid);
  const exp = (days = 365) => new Date(now() + days * 86400000);
  const att = (i) => ({ name: `캡처${i}.png`, url: `https://drive.google.com/thumbnail?id=D${i}&sz=w1000`, type: 'image/png', driveId: `D${i}` });
  const atts = (n) => Array.from({ length: n }, (_, i) => att(i));
  const msgOf = (from, text, extra = {}) => ({ from, fromName: '김선생', text, at: serverTimestamp(), expireAt: exp(), v: 1, ...extra });
  const lastOf = (from, id, text) => ({ lastId: id, lastAt: serverTimestamp(), lastFrom: from, lastFromName: '김선생', lastText: text.slice(0, 80), expireAt: exp() });
  let seq = 0;
  const newMid = () => `cm${rid}${seq++}`;
  // 앱이 하는 대로 한 묶음. noRoom = 방 고치기 없이 글만, noMsg = 글 없이 방만, lastId = 방에 적을 글 id(기본 이 글)
  const sendTo = async (c, uid, msgsRef, roomRef, text, roomShape, { msgExtra = {}, roomExtra = {}, noRoom = false, noMsg = false, lastId } = {}) => {
    const id = newMid();
    const b = writeBatch(c.db);
    if (!noMsg) b.set(doc(msgsRef, id), msgOf(uid, text, msgExtra));
    if (!noRoom) b.set(roomRef, { ...roomShape, ...lastOf(uid, lastId ?? id, text), ...roomExtra }, { merge: true });
    await b.commit();
    if (!noMsg) made.push(`${msgsRef.path}/${id}`);
    return id;
  };
  // 그룹 전체 방 - 늘 같은 모양 (만들기·고치기)
  const sendAll = (c, uid, sid, text, opt) => sendTo(c, uid, msgs(c, sid, 'all'), room(c, sid, 'all'), text, { kind: 'all', v: 1 }, opt);
  // 고른 사람 방 - 만든 뒤에는 last*만
  const sendRoom = (c, uid, sid, r, text, opt) => sendTo(c, uid, msgs(c, sid, r), room(c, sid, r), text, {}, opt);
  const makeRoom = async (c, uid, sid, r, members, name = '학년 부장') => {
    const id = newMid();
    const b = writeBatch(c.db);
    b.set(doc(msgs(c, sid, r), id), msgOf(uid, '방을 만들었습니다'));
    b.set(room(c, sid, r), { kind: 'room', name, members: Object.fromEntries(members.map((u) => [u, true])), ...lastOf(uid, id, '방을 만들었습니다'), v: 1 });
    await b.commit();
    made.push(`v5Chat/${sid}/chatRooms/${r}/chatMsgs/${id}`, `v5Chat/${sid}/chatRooms/${r}`);
  };
  // 1:1 - 늘 같은 모양 (names는 내 칸만)
  const sendDm = (c, uid, p, other, sid, text, opt = {}) =>
    sendTo(c, uid, dmMsgs(c, p), dm(c, p), text, { kind: 'dm', members: { [uid]: true, [other]: true }, sid, names: { [uid]: '김선생' }, v: 1 }, opt);
  const count = async (q) => (await getCountFromServer(q)).data().count;

  await adminRemove(`v5Dm/${pair}`); // 지난 실행이 남긴 1:1 방 (지우기 규칙이 없다)
  await must('(준비) 대화 그룹1 A + B·C, 그룹2 A + B (코드로 스스로)', async () => {
    for (const [sid, code, who] of [[g1, code1, [[B, bUid], [C, cUid]]], [g2, code2, [[B, bUid]]]]) {
      const b = writeBatch(A.db);
      b.set(space(A, sid), { ...group, name: `대화 점검 ${sid.slice(-4)}`, inviteCode: code });
      b.set(invite(A, code), { sid, ownerId: aUid });
      await b.commit();
      for (const [c, uid] of who) await updateDoc(space(c, sid), { [`members.${uid}`]: 'member', [`joinCodes.${uid}`]: code, updatedAt: now() });
    }
    made.push(`v5Chat/${g1}/chatRooms/all`, `v5Chat/${g2}/chatRooms/all`);
  });

  console.log('  · 그룹 전체 방');
  await must('없는 all 방 get = 없음 (구성원 - 듣기를 미리 건다)', async () => {
    if ((await getDoc(room(B, g1, 'all'))).exists()) throw new Error('있다');
  });
  await must('A 첫 글 (all 방 만들기 + 글 한 묶음)', () => sendAll(A, aUid, g1, '안녕하세요'));
  const t0 = now();
  await must('B 이어 쓰기 (같은 모양 merge = 고치기)', () => sendAll(B, bUid, g1, '네 반갑습니다'));
  await must('둘이 함께 첫 글 (그룹2 - 만들기 겹침)', async () => {
    const r = await Promise.allSettled([sendAll(A, aUid, g2, '동시 A'), sendAll(B, bUid, g2, '동시 B')]);
    const bad = r.filter((x) => x.status === 'rejected');
    if (bad.length) throw new Error(bad.map((x) => x.reason.code || x.reason.message).join(','));
  });
  await must('첨부 둘과 함께', () => sendAll(A, aUid, g1, '자료입니다', { msgExtra: { attachments: atts(2) } }));
  await must('글 없이 첨부만 · 10개', () => sendAll(A, aUid, g1, '', { msgExtra: { attachments: atts(10) }, roomExtra: { lastText: '📎 10' } }));
  await must('C가 all 방을 읽는다', async () => {
    if (!(await getDoc(room(C, g1, 'all'))).data()?.lastText) throw new Error('미리 보기가 없다');
  });
  await must('C 최근 글 50개 (orderBy at desc limit 50)', async () => {
    if ((await getDocs(query(msgs(C, g1, 'all'), orderBy('at', 'desc'), limit(50)))).size < 4) throw new Error('글이 모자란다');
  });
  await must('C 안 읽은 수 (getCountFromServer where at > 내 읽음)', async () => {
    if ((await count(query(msgs(C, g1, 'all'), where('at', '>', new Date(t0 - 60000))))) < 4) throw new Error('수가 모자란다');
  });
  await mustNot('X(그룹 밖)가 all 방 get', () => getDoc(room(X, g1, 'all')));
  await mustNot('X가 글 목록', () => getDocs(query(msgs(X, g1, 'all'), limit(5))));
  await mustNot('X가 수 세기', () => getCountFromServer(msgs(X, g1, 'all')));
  await mustNot('X가 보낸다', () => sendAll(X, xUid, g1, '끼어들기'));
  await mustNot('from을 남(B)으로', () => sendAll(A, aUid, g1, '위조', { msgExtra: { from: bUid } }));
  await mustNot('lastFrom을 남(B)으로', () => sendAll(A, aUid, g1, '위조', { roomExtra: { lastFrom: bUid } }));
  await mustNot('at을 기기 시각으로', () => sendAll(A, aUid, g1, '시각', { msgExtra: { at: deviceTime() } }));
  await mustNot('lastAt을 기기 시각으로', () => sendAll(A, aUid, g1, '시각', { roomExtra: { lastAt: deviceTime() } }));
  await mustNot('2001자', () => sendAll(A, aUid, g1, '가'.repeat(2001)));
  await mustNot('빈 글', () => sendAll(A, aUid, g1, ''));
  await mustNot('첨부 11개', () => sendAll(A, aUid, g1, 'x', { msgExtra: { attachments: atts(11) } }));
  await mustNot('빈 첨부 목록', () => sendAll(A, aUid, g1, '', { msgExtra: { attachments: [] } }));
  await mustNot('모르는 칸 (글)', () => sendAll(A, aUid, g1, 'x', { msgExtra: { secret: '김철수' } }));
  await mustNot('모르는 칸 (방)', () => sendAll(A, aUid, g1, 'x', { roomExtra: { pinned: 'x' } }));
  await mustNot('미리 보기 81자', () => sendAll(A, aUid, g1, 'x', { roomExtra: { lastText: '가'.repeat(81) } }));
  await mustNot('먼 expireAt (400일 - TTL을 피해 오래 남기기)', () => sendAll(A, aUid, g1, 'x', { msgExtra: { expireAt: exp(400) } }));
  await mustNot('방 expireAt을 가깝게 (30일 - 남의 방을 TTL로 지우기)', () => sendAll(A, aUid, g1, 'x', { roomExtra: { expireAt: exp(30) } }));
  await mustNot('방 고치기 없이 글만', () => sendAll(A, aUid, g1, '글만', { noRoom: true }));
  await mustNot('글 없이 방 미리 보기만', () => sendAll(A, aUid, g1, '미리 보기만', { noMsg: true }));
  let oldId;
  await must('(준비) A 글 하나', async () => { oldId = await sendAll(A, aUid, g1, '옛 글'); });
  await mustNot('옛 글 id로 미리 보기만 꾸민다', () => sendAll(A, aUid, g1, '꾸민 미리 보기', { noMsg: true, lastId: oldId }));
  await mustNot('방 lastId가 함께 쓴 글이 아니다', () => sendAll(A, aUid, g1, 'x', { lastId: oldId }));
  await mustNot('남의 글을 고친다 (A가 B 글)', async () => {
    const s = await getDocs(query(msgs(A, g1, 'all'), where('from', '==', bUid), limit(1)));
    await updateDoc(s.docs[0].ref, { text: '바꿈' });
  });
  await mustNot('내 글을 지우기 말고 고친다', () => updateDoc(doc(msgs(A, g1, 'all'), oldId), { text: '고침' }));
  await mustNot('글을 진짜 지운다', () => deleteDoc(doc(msgs(A, g1, 'all'), oldId)));
  await mustNot('방을 지운다', () => deleteDoc(room(A, g1, 'all')));
  await mustNot('개인 공간 u_ 방', () => sendAll(A, aUid, `u_${aUid}`, '개인'));
  await mustNot('v5Chat/{sid} 문서 자신에 쓴다', () => setDoc(doc(A.db, 'v5Chat', g1), { x: 1 }));
  await mustNot('v5Chat/{sid} 아래 다른 상자에 쓴다', () => setDoc(doc(A.db, 'v5Chat', g1, 'other', 'x'), { x: 1 }));

  console.log('  · 🔕 방마다');
  await must('B가 muted.<B>', () => updateDoc(room(B, g1, 'all'), { [`muted.${bUid}`]: true }));
  await mustNot('B가 muted.<C>', () => updateDoc(room(B, g1, 'all'), { [`muted.${cUid}`]: true }));
  await must('A가 보내도 B의 🔕는 그대로 (보내기에 muted 없음)', async () => {
    await sendAll(A, aUid, g1, '알림 끈 뒤');
    if ((await getDoc(room(B, g1, 'all'))).data().muted?.[bUid] !== true) throw new Error('🔕가 사라졌다');
  });
  await must('B가 🔕 풀기 (deleteField)', () => updateDoc(room(B, g1, 'all'), { [`muted.${bUid}`]: deleteField() }));
  await mustNot('보내기에 남의 🔕를 섞는다', () => sendAll(A, aUid, g1, 'x', { roomExtra: { muted: { [bUid]: true } } }));

  console.log('  · 고른 사람 방 (P19-4)');
  const r1 = `r_${rid}a`;
  await must('A가 방 만들기 {A,B} + 첫 글', () => makeRoom(A, aUid, g1, r1, [aUid, bUid]));
  await must('B 방 목록 where(members.<B> == true)', async () => {
    const s = await getDocs(query(collection(B.db, 'v5Chat', g1, 'chatRooms'), where(`members.${bUid}`, '==', true)));
    if (!s.docs.some((d) => d.id === r1)) throw new Error('방이 목록에 없다');
  });
  await mustNot('B 방 목록 where 없이', () => getDocs(collection(B.db, 'v5Chat', g1, 'chatRooms')));
  await mustNot('C가 남의 uid로 방 목록 (where members.<B>)', () => getDocs(query(collection(C.db, 'v5Chat', g1, 'chatRooms'), where(`members.${bUid}`, '==', true))));
  await mustNot('방에 없는 C가 방 get', () => getDoc(room(C, g1, r1)));
  await mustNot('방에 없는 C가 글 목록', () => getDocs(msgs(C, g1, r1)));
  await mustNot('방에 없는 C가 수 세기', () => getCountFromServer(msgs(C, g1, r1)));
  await must('B 이어 쓰기 (last*만)', () => sendRoom(B, bUid, g1, r1, '네'));
  await mustNot('방에 없는 C가 보낸다', () => sendRoom(C, cUid, g1, r1, '끼어들기'));
  await mustNot('그룹 밖 X를 더한다', () => updateDoc(room(B, g1, r1), { [`members.${xUid}`]: true }));
  await must('B가 그룹 사람 C를 더한다', () => updateDoc(room(B, g1, r1), { [`members.${cUid}`]: true }));
  await must('더한 C는 지난 글도 읽는다', async () => {
    if ((await getDocs(msgs(C, g1, r1))).size < 2) throw new Error('지난 글이 없다');
  });
  await must('B 이름 바꾸기', () => updateDoc(room(B, g1, r1), { name: '부장 셋' }));
  await mustNot('이름 41자', () => updateDoc(room(B, g1, r1), { name: '가'.repeat(41) }));
  await mustNot('B가 A를 뺀다', () => updateDoc(room(B, g1, r1), { [`members.${aUid}`]: deleteField() }));
  await mustNot('B가 이름과 사람을 함께 고친다 (C 빼기)', () => updateDoc(room(B, g1, r1), { name: 'x', [`members.${cUid}`]: deleteField() }));
  await must('C 나가기 (나 빼기)', () => updateDoc(room(C, g1, r1), { [`members.${cUid}`]: deleteField() }));
  await mustNot('나간 C가 글 목록', () => getDocs(msgs(C, g1, r1)));
  await mustNot('나간 C가 스스로 다시 들어온다', () => updateDoc(room(C, g1, r1), { [`members.${cUid}`]: true }));
  await mustNot('그룹 밖 X를 넣어 방을 만든다', () => makeRoom(A, aUid, g1, `r_${rid}x`, [aUid, xUid]));
  await mustNot('나만 든 방을 만든다', () => makeRoom(A, aUid, g1, `r_${rid}x`, [aUid]));
  await mustNot('나를 빼고 남끼리 방을 만든다', () => makeRoom(A, aUid, g1, `r_${rid}x`, [bUid, cUid]));
  await mustNot("all이 아닌 이름의 그룹 전체 방 ('r_' 모양 아님)", () => sendTo(A, aUid, msgs(A, g1, 'x1'), room(A, g1, 'x1'), 'x', { kind: 'all', v: 1 }));
  await mustNot('all 방에 이름을 붙인다', () => updateDoc(room(A, g1, 'all'), { name: '바꿈' }));

  console.log('  · 50명 방');
  const joiners = [];
  await must('(준비) 48명이 그룹1에 코드로 들어온다 (A·B·C와 함께 51명)', async () => {
    for (let i = 0; i < 48; i++) {
      const uid = await login(J, `rc-mail-${i}@example.com`);
      await updateDoc(space(J, g1), { [`members.${uid}`]: 'member', [`joinCodes.${uid}`]: code1, updatedAt: now() });
      joiners.push(uid);
    }
  });
  await must('50명 방 (A·B + 48)', () => makeRoom(A, aUid, g1, `r_${rid}f`, [aUid, bUid, ...joiners]));
  await mustNot('51명 방', () => makeRoom(A, aUid, g1, `r_${rid}x`, [aUid, bUid, cUid, ...joiners]));
  await mustNot('50명 방에 한 사람 더 (C)', () => updateDoc(room(A, g1, `r_${rid}f`), { [`members.${cUid}`]: true }));
  await must('(정리) 48명이 그룹1을 나간다', async () => {
    for (let i = 0; i < 48; i++) {
      const uid = await login(J, `rc-mail-${i}@example.com`);
      await updateDoc(space(J, g1), { [`members.${uid}`]: deleteField(), updatedAt: now() });
    }
  });

  console.log('  · 내 글 지우기 (P19-4 - 모두에게 지운 글)');
  let bLast, bMid;
  await must('(준비) B가 방에 글 둘', async () => {
    bMid = await sendRoom(B, bUid, g1, r1, '지울 글 하나');
    bLast = await sendRoom(B, bUid, g1, r1, '지울 마지막 글');
  });
  const clear = { deletedAt: serverTimestamp(), text: '', attachments: deleteField() };
  await must('B가 마지막이 아닌 내 글을 지운다 (글만)', () => updateDoc(doc(msgs(B, g1, r1), bMid), clear));
  await must('B가 마지막 글을 지운다 (글 + 방 미리 보기 빈 글 한 묶음)', async () => {
    const b = writeBatch(B.db);
    b.update(doc(msgs(B, g1, r1), bLast), clear);
    b.update(room(B, g1, r1), { lastText: '' });
    await b.commit();
  });
  await mustNot('지운 글을 또 지운다', () => updateDoc(doc(msgs(B, g1, r1), bLast), clear));
  await mustNot('A가 B의 글을 지운다', () => updateDoc(doc(msgs(A, g1, r1), bMid), clear));
  await mustNot('지우며 글을 남긴다', async () => {
    const id = await sendRoom(B, bUid, g1, r1, '남길 글');
    await updateDoc(doc(msgs(B, g1, r1), id), { deletedAt: serverTimestamp(), text: '남김' });
  });
  await mustNot('글을 지우지 않고 미리 보기만 빈 글로', () => updateDoc(room(B, g1, r1), { lastText: '' }));
  await must('첨부 글 지우기 (첨부 칸째 빼기 - all 방)', async () => {
    const id = await sendAll(B, bUid, g1, '그림', { msgExtra: { attachments: atts(1) } });
    await updateDoc(doc(msgs(B, g1, 'all'), id), clear);
  });

  console.log('  · 1:1');
  await must(`id 글자 견주기 (작은 uid가 앞)`, async () => {
    if (!(lo < hi)) throw new Error('견주기가 거꾸로');
  });
  await must('A가 1:1 첫 글 (방 만들기 - names는 내 칸만)', () => sendDm(A, aUid, pair, bUid, g1, '1:1 안녕'));
  made.push(`v5Dm/${pair}`);
  await must('B 1:1 목록 where(members.<B> == true)', async () => {
    const s = await getDocs(query(collection(B.db, 'v5Dm'), where(`members.${bUid}`, '==', true)));
    if (!s.docs.some((d) => d.id === pair)) throw new Error('방이 목록에 없다');
  });
  await must('B 답장 (names.<B> 더하기)', () => sendDm(B, bUid, pair, aUid, g1, '1:1 답'));
  await must('B 읽음 reads.<B> = 서버 시각', () => updateDoc(dm(B, pair), { [`reads.${bUid}`]: serverTimestamp() }));
  await must('B 1:1 안 읽은 수', async () => count(query(dmMsgs(B, pair), where('at', '>', new Date(t0 - 60000)))));
  await must('A 1:1 🔕', () => updateDoc(dm(A, pair), { [`muted.${aUid}`]: true }));
  await must('A가 내 1:1 글을 지운다', async () => {
    const id = await sendDm(A, aUid, pair, bUid, g1, '지울 1:1');
    const b = writeBatch(A.db);
    b.update(doc(dmMsgs(A, pair), id), clear);
    b.update(dm(A, pair), { lastText: '' });
    await b.commit();
  });
  await mustNot('B 읽음을 기기 시각으로', () => updateDoc(dm(B, pair), { [`reads.${bUid}`]: deviceTime() }));
  await mustNot('B가 reads.<A>', () => updateDoc(dm(B, pair), { [`reads.${aUid}`]: serverTimestamp() }));
  await mustNot('B가 muted.<A>를 푼다', () => updateDoc(dm(B, pair), { [`muted.${aUid}`]: deleteField() }));
  await mustNot('B가 보내며 names.<A>를 바꾼다', () => sendDm(B, bUid, pair, aUid, g1, 'n', { roomExtra: { names: { [aUid]: '바꿈' } } }));
  await mustNot('X가 1:1 get', () => getDoc(dm(X, pair)));
  await mustNot('X가 1:1 글', () => getDocs(dmMsgs(X, pair)));
  await mustNot('X가 남의 uid로 1:1 목록', () => getDocs(query(collection(X.db, 'v5Dm'), where(`members.${bUid}`, '==', true))));
  await mustNot('X가 1:1에 보낸다', () => sendDm(X, xUid, pair, bUid, g1, '끼어들기', { roomExtra: { members: { [aUid]: true, [bUid]: true }, names: { [xUid]: 'X' } } }));
  await mustNot('id 순서 바꿈', () => sendDm(A, aUid, `d_${hi}_${lo}`, bUid, g1, 'x'));
  await mustNot('세 사람 id', () => sendDm(A, aUid, `d_${lo}_${hi}_${cUid}`, bUid, g1, 'x'));
  await mustNot('남끼리 1:1 (A가 B·C 방을 만든다)', () => {
    const [l, h] = [bUid, cUid].sort();
    return sendDm(A, aUid, `d_${l}_${h}`, cUid, g1, 'x', { roomExtra: { members: { [bUid]: true, [cUid]: true } } });
  });
  await mustNot('만들 때 상대 이름까지 적는다 (A↔C)', () => {
    const [l, h] = [aUid, cUid].sort();
    return sendDm(A, aUid, `d_${l}_${h}`, cUid, g1, 'x', { roomExtra: { names: { [aUid]: '김선생', [cUid]: '박선생' } } });
  });
  await mustNot('함께 든 그룹이 아닌 sid (C는 그룹2에 없다)', () => {
    const [l, h] = [aUid, cUid].sort();
    return sendDm(A, aUid, `d_${l}_${h}`, cUid, g2, 'x');
  });
  await mustNot('그룹 밖 X와 1:1', () => {
    const [l, h] = [aUid, xUid].sort();
    return sendDm(A, aUid, `d_${l}_${h}`, xUid, g1, 'x');
  });

  console.log('  · 내 읽음 (그룹 방)');
  await must("setDoc merge { rooms: { '<sid>~all': 서버 시각 } }", () => setDoc(reads(B, bUid), { rooms: { [`${g1}~all`]: serverTimestamp() }, v: 1 }, { merge: true }));
  await must('둘째 칸 FieldPath(rooms, <sid>~<방>) - 첫 칸이 남는다', async () => {
    await updateDoc(reads(B, bUid), new FieldPath('rooms', `${g1}~${r1}`), serverTimestamp());
    if (!(await getDoc(reads(B, bUid))).data().rooms[`${g1}~all`]) throw new Error('첫 칸이 사라졌다');
  });
  await mustNot('A가 B의 읽음을 읽는다', () => getDoc(reads(A, bUid)));
  await mustNot('A가 B의 읽음에 쓴다', () => setDoc(reads(A, bUid), { rooms: { [`${g1}~all`]: serverTimestamp() }, v: 1 }, { merge: true }));
  await mustNot('모르는 칸', () => setDoc(reads(B, bUid), { other: 1 }, { merge: true }));

  console.log('  · 나간·내보낸 사람');
  await must('(준비) C가 그룹1을 나간다', () => updateDoc(space(C, g1), { [`members.${cUid}`]: deleteField(), updatedAt: now() }));
  await mustNot('나간 C가 all 방 get', () => getDoc(room(C, g1, 'all')));
  await mustNot('나간 C가 all 글 목록', () => getDocs(query(msgs(C, g1, 'all'), limit(5))));
  await mustNot('나간 C가 수 세기', () => getCountFromServer(msgs(C, g1, 'all')));
  await mustNot('나간 C가 보낸다', () => sendAll(C, cUid, g1, '나간 뒤'));
  await mustNot('나간 C가 🔕', () => updateDoc(room(C, g1, 'all'), { [`muted.${cUid}`]: true }));
  await must('(준비) B가 그룹1을 나간다', () => updateDoc(space(B, g1), { [`members.${bUid}`]: deleteField(), updatedAt: now() }));
  await mustNot('그룹1을 나간 B에게 그룹1로 1:1', () => sendDm(A, aUid, pair, bUid, g1, '그룹1로'));
  await must('함께 든 그룹2로 sid를 옮겨 1:1', () => sendDm(A, aUid, pair, bUid, g2, '그룹2로'));
  await must('(준비) 주인 A가 그룹2에서 B를 내보낸다 (members·joinCodes + 새 코드)', async () => {
    const code3 = `CH3${rid}`.toUpperCase();
    const b = writeBatch(A.db);
    b.update(space(A, g2), { [`members.${bUid}`]: deleteField(), [`joinCodes.${bUid}`]: deleteField(), inviteCode: code3, updatedAt: now() });
    b.set(invite(A, code3), { sid: g2, ownerId: aUid });
    await b.commit();
    made.push(`spaceInvites/${code3}`);
  });
  await mustNot('내보낸 B가 그룹2 all 방 get', () => getDoc(room(B, g2, 'all')));
  await mustNot('내보낸 B가 그룹2 글 목록', () => getDocs(query(msgs(B, g2, 'all'), limit(5))));
  await mustNot('함께 든 그룹이 없는 1:1에 보낸다 (A→B)', () => sendDm(A, aUid, pair, bUid, g2, 'x'));
  await mustNot('함께 든 그룹이 없는 1:1에 보낸다 (B→A)', () => sendDm(B, bUid, pair, aUid, g2, 'x'));
  await must('함께 든 그룹이 없어도 1:1 지난 글은 읽는다', async () => {
    if ((await getDocs(dmMsgs(B, pair))).size < 3) throw new Error('지난 글이 없다');
  });

  await must('(정리) 대화 문서(관리자)·읽음·그룹·코드를 지운다', async () => {
    for (const p of made) await adminRemove(p);
    await deleteDoc(reads(B, bUid));
    for (const [sid, code] of [[g1, code1], [g2, code2]]) {
      await deleteDoc(invite(A, code));
      await deleteDoc(space(A, sid));
    }
  });
}

run().catch((e) => { console.error(e); process.exit(1); });
