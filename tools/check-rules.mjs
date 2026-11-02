// tools/check-rules.mjs
//
// 보안 규칙(firestore.rules)을 에뮬레이터에 올려 놓고, 되어야 하는 일과 막혀야 하는 일을
// 하나씩 해 본다. 규칙만 눈으로 읽어서는 무엇이 깨지는지 알 수 없다.
//
//   npm run emu   (다른 창 - 이 저장소에서 켜야 이 저장소의 규칙을 읽는다)
//   npm run check:rules
//
// 앞 35개는 V4 저장소의 같은 스크립트를 그대로 옮긴 것(V3·V4 경로 - P15-1에 '구성원 넣기' 셋을 더했다), 뒤는 V5(spaces …).
// 규칙의 정본은 이 저장소다 - V4 것은 10-30까지의 옛 복사본(11-02부터 V5만, firestore.rules 맨 위).
//
// ⚠️ 이 스크립트는 에뮬레이터만 건드린다. 운영 데이터와는 아무 상관이 없다.
import { initializeApp, deleteApp } from 'firebase/app';
import {
  getFirestore, connectFirestoreEmulator, doc, setDoc, getDoc, getDocs, updateDoc,
  deleteDoc, collection, query, where, orderBy, limit, arrayUnion, arrayRemove, deleteField, writeBatch, serverTimestamp,
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

  const gid = 'grp_rulecheck';
  const code = 'RULECHK';

  console.log('\n[그룹장 A]');
  await must('그룹 만들기', async () => {
    await setDoc(doc(A.db, 'groups', gid), {
      name: '규칙 점검용 공유방',
      ownerId: aUid,
      ownerName: '김선생',
      inviteCode: code,
      members: [aUid],
      memberDetails: { [aUid]: { name: '김선생', joinedAt: Date.now(), photoURL: '' } },
      createdAt: Date.now(),
    });
  });
  await mustNot('남을 넣어 그룹을 만든다 (P15-1 - V5 가져오기로 동의 없이 구성원이 된다)', async () => {
    await setDoc(doc(A.db, 'groups', 'grp_rulecheck_bad'), {
      name: '남을 넣은 방', ownerId: aUid, inviteCode: 'BAD', members: [aUid, bUid], createdAt: Date.now(),
    });
  });
  await must('초대 코드 매핑 만들기', async () => {
    await setDoc(doc(A.db, 'inviteCodes', code), { groupId: gid, ownerId: aUid, createdAt: Date.now() });
  });
  await must('같은 매핑을 다시 쓰기 (경합 때 거부되던 것)', async () => {
    await setDoc(doc(A.db, 'inviteCodes', code), { groupId: gid, ownerId: aUid, createdAt: Date.now() });
  });
  await must('내 그룹 목록 조회 (array-contains)', async () => {
    const s = await getDocs(query(collection(A.db, 'groups'), where('members', 'array-contains', aUid)));
    if (s.empty) throw new Error('내 그룹이 안 나온다');
  });
  await must('그룹 안에 기록 쓰기', async () => {
    await setDoc(doc(A.db, 'groups', gid, 'journals', today), {
      entries: [{ id: 'jr_x', content: '박OO 학생 상담 내용', createdAt: Date.now() }],
      updatedAt: Date.now(),
    });
  });

  console.log('\n[아무 관계 없는 사람 X] — 전부 막혀야 한다');
  await mustNot('그룹 목록 전체 훑기', async () => {
    const s = await getDocs(collection(X.db, 'groups'));
    if (s.size === 0) throw Object.assign(new Error('빈 목록'), { code: 'permission-denied' });
  });
  await mustNot('그룹 ID를 알 때 단건 읽기', async () => {
    const d = await getDoc(doc(X.db, 'groups', gid));
    if (!d.exists()) throw Object.assign(new Error('없음'), { code: 'permission-denied' });
  });
  await mustNot('초대 코드로 그룹 찾기 (폴백 조회)', async () => {
    const s = await getDocs(query(collection(X.db, 'groups'), where('inviteCode', '==', code)));
    if (s.empty) throw Object.assign(new Error('빈 목록'), { code: 'permission-denied' });
  });
  await mustNot('남의 그룹 상담 기록 읽기', async () => {
    const d = await getDoc(doc(X.db, 'groups', gid, 'journals', today));
    if (!d.exists()) throw Object.assign(new Error('없음'), { code: 'permission-denied' });
  });
  await mustNot('남의 그룹 기록 고쳐 쓰기', async () => {
    await setDoc(doc(X.db, 'groups', gid, 'journals', today), { entries: [], updatedAt: Date.now() });
  });
  await mustNot('남의 그룹 지우기', async () => {
    await deleteDoc(doc(X.db, 'groups', gid));
  });
  await mustNot('남을 마음대로 구성원으로 넣기', async () => {
    await updateDoc(doc(X.db, 'groups', gid), { members: arrayUnion('somebody_else') });
  });
  await mustNot('그룹 이름 바꾸기', async () => {
    await updateDoc(doc(X.db, 'groups', gid), { name: '내가 바꿈' });
  });

  console.log('\n[초대받은 B] — 참여가 되어야 한다');
  await must('코드 -> 그룹 매핑 한 건 읽기', async () => {
    const d = await getDoc(doc(B.db, 'inviteCodes', code));
    if (!d.exists() || d.data().groupId !== gid) throw new Error('매핑을 못 읽었다');
  });
  await mustNot('참여 전에는 그룹을 읽지 못한다 (앱이 이걸 가정하면 안 됨)', async () => {
    const d = await getDoc(doc(B.db, 'groups', gid));
    if (!d.exists()) throw Object.assign(new Error('없음'), { code: 'permission-denied' });
  });
  await must('자기 자신만 구성원으로 넣기 (참여) — updateDoc', async () => {
    await updateDoc(doc(B.db, 'groups', gid), {
      members: arrayUnion(bUid),
      [`memberDetails.${bUid}`]: { name: '이선생', joinedAt: Date.now(), photoURL: '' },
    });
  });
  await must('참여한 뒤에는 그룹을 읽는다', async () => {
    const d = await getDoc(doc(B.db, 'groups', gid));
    if (!d.exists()) throw new Error('못 읽었다');
  });
  await must('참여한 뒤 그룹 기록을 읽는다', async () => {
    const d = await getDoc(doc(B.db, 'groups', gid, 'journals', today));
    if (!d.exists()) throw new Error('못 읽었다');
  });
  await must('참여한 뒤 그룹 기록을 쓴다', async () => {
    await setDoc(doc(B.db, 'groups', gid, 'journals', today), {
      entries: [{ id: 'jr_b', content: 'B가 남긴 기록', createdAt: Date.now() }],
      updatedAt: Date.now(),
    });
  });
  await mustNot('그룹장이 남을 구성원으로 넣는다 (P15-1)', async () => {
    await updateDoc(doc(A.db, 'groups', gid), { members: arrayUnion('somebody_else') });
  });
  await mustNot('구성원이어도 그룹 이름은 못 바꾼다', async () => {
    await updateDoc(doc(B.db, 'groups', gid), { name: 'B가 바꿈' });
  });
  await mustNot('구성원이어도 그룹은 못 지운다', async () => {
    await deleteDoc(doc(B.db, 'groups', gid));
  });

  console.log('\n[옛 V3 방식] — setDoc으로 점이 든 키를 쓰면 막혀야 한다');
  const C = client('legacy');
  const cUid = await login(C, 'legacy@example.com');
  await mustNot("setDoc({'memberDetails.<uid>': ...}, {merge:true}) 로 참여", async () => {
    await setDoc(doc(C.db, 'groups', gid), {
      members: arrayUnion(cUid),
      [`memberDetails.${cUid}`]: { name: '옛방식', joinedAt: Date.now(), photoURL: '' },
    }, { merge: true });
  });
  await must('updateDoc으로 고친 방식은 된다', async () => {
    await updateDoc(doc(C.db, 'groups', gid), {
      members: arrayUnion(cUid),
      [`memberDetails.${cUid}`]: { name: '새방식', joinedAt: Date.now(), photoURL: '' },
    });
  });

  console.log('\n[탈퇴]');
  await must('자기 자신만 빼기 (탈퇴)', async () => {
    await updateDoc(doc(B.db, 'groups', gid), { members: arrayRemove(bUid) });
  });
  await must('그룹장은 구성원을 뺀다 (빼기는 그대로)', async () => {
    await updateDoc(doc(A.db, 'groups', gid), { members: arrayRemove(cUid) });
  });
  await mustNot('탈퇴한 뒤에는 그룹 기록을 못 읽는다', async () => {
    const d = await getDoc(doc(B.db, 'groups', gid, 'journals', today));
    if (!d.exists()) throw Object.assign(new Error('없음'), { code: 'permission-denied' });
  });

  console.log('\n[그룹장 정리]');
  await must('그룹장이 하위 자료를 비운다', async () => {
    await deleteDoc(doc(A.db, 'groups', gid, 'journals', today));
  });
  await must('그룹장이 그룹을 지운다', async () => {
    await deleteDoc(doc(A.db, 'groups', gid));
  });
  await must('그룹장이 매핑을 지운다', async () => {
    await deleteDoc(doc(A.db, 'inviteCodes', code));
  });

  console.log('\n[개인 공간] — 원래도 막혀 있었다');
  await mustNot('남의 개인 공간 읽기', async () => {
    const d = await getDoc(doc(X.db, 'users', aUid, 'journals', today));
    if (!d.exists()) throw Object.assign(new Error('없음'), { code: 'permission-denied' });
  });
  await must('내 개인 공간은 읽는다', async () => {
    await getDoc(doc(A.db, 'users', aUid, 'settings', 'labels'));
  });

  console.log('\n[나이스 키 sharedConfig] — 로그인하면 읽고, 쓰기는 개발자만');
  const D = client('developer');
  await login(D, 'hyundonglim80@gmail.com');
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

  const v4 = { pass, fail };
  await runV5({ A, B, X, D, aUid, bUid, xUid });

  console.log(`\n───────── V4 ${v4.pass}개 통과 / ${v4.fail}개 실패 · V5 ${pass - v4.pass}개 통과 / ${fail - v4.fail}개 실패 ─────────`);
  for (const c of [A, B, X, C, D]) await deleteApp(c.app).catch(() => {});
  process.exit(fail === 0 ? 0 : 1);
}

// ─── V5: spaces · spaceInvites · v5alarms · v5Errors · v5Mail ─────────
//
// V4 쪽과 달리 '문서가 없으면 막힌 것으로 친다'를 쓰지 않는다. 읽기 시험은 문서가 있는 데서만
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

  // V4 그룹 가져오기 (P8-4 ■2): V4 groups/{gid}의 구성원이 g_{gid}를 V4 주인·구성원 그대로 만든다
  console.log('\n[V5 V4 그룹 가져오기] — V4 구성원이 g_{V4 id}를 V4 그대로');
  const v4gid = 'v4grpRulecheck';
  const v4gs = `g_${v4gid}`;
  const C = client('member2');
  const cUid = await login(C, 'teacher3@example.com');
  await must('(준비) V4 그룹: 주인 A가 만들고 B가 스스로 들어온다', async () => {
    await setDoc(doc(A.db, 'groups', v4gid), { name: 'V4 그룹', ownerId: aUid, ownerName: 'A', inviteCode: 'V4RCHK', members: [aUid], createdAt: now() });
    await updateDoc(doc(B.db, 'groups', v4gid), { members: arrayUnion(bUid) });
  });
  const imported = { kind: 'group', name: 'V4 그룹', ownerId: aUid, members: { [aUid]: 'owner', [bUid]: 'member' }, createdAt: now(), updatedAt: now(), v: 1 };
  await mustNot('V4 구성원이 아닌 사람이 가져온다', async () => {
    await setDoc(space(X, v4gs), { ...imported, members: { [aUid]: 'owner', [bUid]: 'member', [xUid]: 'member' } });
  });
  await mustNot('구성원이 스스로 주인이 되어 가져온다', async () => {
    await setDoc(space(B, v4gs), { ...imported, ownerId: bUid, members: { [aUid]: 'member', [bUid]: 'owner' } });
  });
  await mustNot('V4에 없는 사람을 함께 넣어 가져온다', async () => {
    await setDoc(space(B, v4gs), { ...imported, members: { ...imported.members, [cUid]: 'member' } });
  });
  await mustNot('V4 구성원을 빼고 가져온다', async () => {
    await setDoc(space(B, v4gs), { ...imported, members: { [aUid]: 'owner' }, ownerId: aUid });
  });
  await mustNot('구성원을 둘 다 owner로 가져온다', async () => {
    await setDoc(space(B, v4gs), { ...imported, members: { [aUid]: 'owner', [bUid]: 'owner' } });
  });
  await mustNot('주인이 아닌 구성원이 초대 코드를 열어 가져온다', async () => {
    await setDoc(space(B, v4gs), { ...imported, inviteCode: 'V5OPEN' });
  });
  await mustNot('V4 그룹이 없는 g_ 이름으로 남을 넣어 만든다', async () => {
    await setDoc(space(B, 'g_noSuchV4Group'), imported);
  });
  await must('주인이 아닌 V4 구성원이 V4 그대로 가져온다', async () => {
    await setDoc(space(B, v4gs), imported);
  });
  await must('가져온 뒤 주인은 그룹 문서를 읽는다 (V4 주인 = V5 주인)', async () => {
    const d = await getDoc(space(A, v4gs));
    if (d.data()?.members?.[aUid] !== 'owner') throw new Error('주인이 아니다');
  });
  await must('가져온 구성원이 그룹에 항목을 쓴다', async () => {
    await setDoc(item(B, v4gs, 'rc_v4g1'), note('가져온 그룹 메모'));
  });
  await mustNot('초대가 닫힌 그룹에 V4 구성원이 아닌 사람이 참여한다', async () => {
    await updateDoc(space(C, v4gs), { [`members.${cUid}`]: 'member', updatedAt: now() });
  });
  await must('(준비) 가져온 뒤 V4에 C가 들어온다', async () => {
    await updateDoc(doc(C.db, 'groups', v4gid), { members: arrayUnion(cUid) });
  });
  await mustNot('V4 구성원이어도 owner로는 참여하지 못한다', async () => {
    await updateDoc(space(C, v4gs), { [`members.${cUid}`]: 'owner', updatedAt: now() });
  });
  await must('V4 구성원은 초대 코드 없이 member로 참여한다', async () => {
    await updateDoc(space(C, v4gs), { [`members.${cUid}`]: 'member', updatedAt: now() });
  });
  await must('주인이 나중에 초대 코드를 연다 (공간 + 초대 코드 한 묶음)', async () => {
    const b = writeBatch(A.db);
    b.update(space(A, v4gs), { inviteCode: 'V5RCV4', updatedAt: now() });
    b.set(invite(A, 'V5RCV4'), { sid: v4gs, ownerId: aUid });
    await b.commit();
  });
  await must('(정리) 가져온 그룹·V4 그룹을 지운다', async () => {
    await deleteDoc(item(A, v4gs, 'rc_v4g1'));
    await deleteDoc(invite(A, 'V5RCV4'));
    await deleteDoc(space(A, v4gs));
    await deleteDoc(doc(A.db, 'groups', v4gid));
  });

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
    await setDoc(errDoc(A, 'rc_e3'), report(aUid, { at: new Date() }));
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
  await mustNot('at을 기기 시각으로', () => send(A, aUid, mx, [bUid], { both: { at: new Date() } }));
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
  await mustNot('읽음을 기기 시각으로', () => updateDoc(inbox(B, bUid, m2), { readAt: new Date() }));
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

run().catch((e) => { console.error(e); process.exit(1); });
