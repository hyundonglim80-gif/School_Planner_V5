// tools/seed.mjs (V5)
//
// 점검용 에뮬레이터에 V5 자료를 심는다. 계정과 V4 자료는 V4 저장소의 seed가 만든다 - PC에서는 먼저 돌린다.
//
//   (V4 저장소) npm run seed   → 계정 teacher·teacher2·teacher3 + V4 자료(가져오기 시험용)
//   (이 저장소) npm run seed   → 그 계정들의 V5 개인 공간
//
// 계정이 없으면(클라우드 세션처럼 옆에 V4 저장소가 없을 때) 같은 메일·비밀번호로 만든다 - V4 seed도 있는 계정은 그대로 쓰므로
// 나중에 V4 seed를 돌려도 겹치지 않는다. V4 자료가 필요한 가져오기 세션은 V4 저장소를 옆에 받아 V4 seed를 돌린다(PLAN 1-7).
//
// 설정 기본값은 문서로 심지 않는다 - 앱이 기본값을 셈한다(DESIGN 2장 '계산할 수 있는 것은 저장하지 않는다').
// 점검 계정이 기본값과 달라야 하는 설정(교과 전담 teacher3의 교사 유형 등)은 그 설정을 만드는 세션(P1-4·P6-1)에서 여기에 더한다.
// 되풀이해 돌려도 같은 결과가 나온다.
//
// ⚠️ 에뮬레이터만 건드린다. 운영 자료와는 아무 상관이 없다.
import { initializeApp, deleteApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';

const PASSWORD = 'test1234';
const ACCOUNTS = [
  { email: 'teacher@example.com', note: '기본 계정 - V4 seed 자료가 있다' },
  { email: 'teacher2@example.com', note: '공유 그룹 둘째 사람 (?as=2)' },
  { email: 'teacher3@example.com', note: '교과 전담 (?as=3)' },
];

const app = initializeApp({ projectId: 'schoolplannerv3', apiKey: 'fake-api-key' }, 'seed-v5');
const db = getFirestore(app);
const auth = getAuth(app);
connectFirestoreEmulator(db, '127.0.0.1', 8080);
connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });

/** 앱의 ensurePersonalSpace(src/data/space.ts)와 같은 모양 */
const personalSpace = (uid) => ({
  kind: 'personal',
  name: '',
  ownerId: uid,
  members: { [uid]: 'owner' },
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
  v: 1,
});

async function main() {
  for (const { email, note } of ACCOUNTS) {
    let uid;
    try {
      uid = (await signInWithEmailAndPassword(auth, email, PASSWORD)).user.uid;
    } catch (e) {
      if (e.code !== 'auth/user-not-found' && e.code !== 'auth/invalid-credential') throw e;
      uid = (await createUserWithEmailAndPassword(auth, email, PASSWORD)).user.uid;
      console.log(`${email} 계정이 없어 만들었습니다 (V4 자료는 없다 - V4 seed를 돌리면 더해진다)`);
    }
    await setDoc(doc(db, 'spaces', `u_${uid}`), personalSpace(uid));
    // 처음 로그인 'V4 자료 가져오기' 띠는 닫아 둔다 - seed 계정에는 V4 자료가 있어 띠가 다른 점검의 화면을 밀어낸다.
    // 띠와 가져오기는 tools/inspect-import-labels.mjs가 이 기록을 비우고 본 뒤 되돌린다.
    await setDoc(doc(db, 'spaces', `u_${uid}`, 'settings', 'import'), { dismissed: true, updatedAt: serverTimestamp(), v: 1 });
    console.log(`${email} (${note}) → spaces/u_${uid}`);
  }
  console.log('V5 자료를 심었습니다 - 개인 공간 3개');
  await deleteApp(app);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
