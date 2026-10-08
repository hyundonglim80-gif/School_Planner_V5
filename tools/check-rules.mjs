// tools/check-rules.mjs
//
// 보안 규칙(firestore.rules)을 에뮬레이터에 올려 놓고, 되어야 하는 일과 막혀야 하는 일을
// 하나씩 해 본다. 규칙만 눈으로 읽어서는 무엇이 깨지는지 알 수 없다.
//
//   npm run emu   (다른 창 - 이 저장소에서 켜야 이 저장소의 규칙을 읽는다)
//   npm run check:rules
//
// 앞 35개는 V4 저장소의 같은 스크립트를 그대로 옮긴 것(V3·V4 경로), 뒤는 V5(spaces …).
// 규칙의 정본은 이 저장소다 - V4 것은 복사본(firestore.rules 맨 위).
//
// ⚠️ 이 스크립트는 에뮬레이터만 건드린다. 운영 데이터와는 아무 상관이 없다.
import { initializeApp, deleteApp } from 'firebase/app';
import {
  getFirestore, connectFirestoreEmulator, doc, setDoc, getDoc, getDocs, updateDoc,
  deleteDoc, collection, query, where, arrayUnion, arrayRemove, deleteField, writeBatch, serverTimestamp,
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
  await runV5({ A, B, X, aUid, bUid, xUid });

  console.log(`\n───────── V4 ${v4.pass}개 통과 / ${v4.fail}개 실패 · V5 ${pass - v4.pass}개 통과 / ${fail - v4.fail}개 실패 ─────────`);
  for (const c of [A, B, X, C, D]) await deleteApp(c.app).catch(() => {});
  process.exit(fail === 0 ? 0 : 1);
}

// ─── V5: spaces · spaceInvites · v5alarms ─────────────────────────────
//
// V4 쪽과 달리 '문서가 없으면 막힌 것으로 친다'를 쓰지 않는다. 읽기 시험은 문서가 있는 데서만
// 하므로, 규칙이 열려 있으면 그대로 '그런데 됐다'가 나온다.
async function runV5({ A, B, X, aUid, bUid, xUid }) {
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

  console.log('\n[V5 참여] — 나만, member로만');
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
    await updateDoc(space(X, gs), { [`members.${xUid}`]: 'owner' });
  });
  await mustNot('참여하면서 남도 함께 넣는다', async () => {
    await updateDoc(space(X, gs), { [`members.${xUid}`]: 'member', [`members.${bUid}`]: 'member' });
  });
  await mustNot('참여하면서 그룹 이름도 바꾼다', async () => {
    await updateDoc(space(X, gs), { [`members.${xUid}`]: 'member', name: 'X가 바꿈' });
  });
  await must('나만 member로 참여한다', async () => {
    await updateDoc(space(B, gs), { [`members.${bUid}`]: 'member', updatedAt: now() });
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

  console.log('\n[V5 나가기·초대 닫기]');
  await must('구성원이 나간다', async () => {
    await updateDoc(space(B, gs), { [`members.${bUid}`]: deleteField() });
  });
  await mustNot('나간 뒤에는 그룹 항목을 못 읽는다', async () => {
    await getDoc(item(B, gs, 'rc_g1'));
  });
  await mustNot('주인은 나가지 못한다', async () => {
    await updateDoc(space(A, gs), { [`members.${aUid}`]: deleteField() });
  });
  await must('주인이 초대를 닫는다 (inviteCode 지우기)', async () => {
    await updateDoc(space(A, gs), { inviteCode: deleteField() });
  });
  await mustNot('초대가 닫히면 참여하지 못한다', async () => {
    await updateDoc(space(B, gs), { [`members.${bUid}`]: 'member' });
  });

  console.log('\n[V5 v5alarms] — 함수만');
  await mustNot('앱이 알림 큐를 읽는다', async () => {
    await getDoc(doc(A.db, 'v5alarms', 'rc_g1'));
  });
  await mustNot('앱이 알림 큐에 쓴다', async () => {
    await setDoc(doc(A.db, 'v5alarms', 'rc_g1'), { pendingAt: now() });
  });

  console.log('\n[V5 정리]');
  await must('주인이 그룹 항목을 비운다', async () => {
    await deleteDoc(item(A, gs, 'rc_g1'));
    await deleteDoc(item(A, gs, 'rc_g2'));
  });
  await must('주인이 초대 코드를 지운다', async () => {
    await deleteDoc(invite(A, code));
  });
  await must('주인이 그룹을 지운다', async () => {
    await deleteDoc(space(A, gs));
  });
}

run().catch((e) => { console.error(e); process.exit(1); });
