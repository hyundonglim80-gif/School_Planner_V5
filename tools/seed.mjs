// tools/seed.mjs (V5)
//
// 점검용 에뮬레이터에 V5 자료를 심는다. 계정과 V4 자료는 V4 저장소의 seed가 만든다 - 먼저 돌린다.
//
//   (V4 저장소) npm run seed   → 계정 teacher·teacher2·teacher3 + V4 자료(가져오기 시험용)
//   (이 저장소) npm run seed   → 그 계정들의 V5 개인 공간
//
// 설정 기본값은 문서로 심지 않는다 - 앱이 기본값을 셈한다(DESIGN 2장 '계산할 수 있는 것은 저장하지 않는다').
// 점검 계정이 기본값과 달라야 하는 설정(교과 전담 teacher3의 교사 유형 등)은 그 설정을 만드는 세션(P1-4·P6-1)에서 여기에 더한다.
// 되풀이해 돌려도 같은 결과가 나온다.
//
// ⚠️ 에뮬레이터만 건드린다. 운영 자료와는 아무 상관이 없다.
import { initializeApp, deleteApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getAuth, connectAuthEmulator, signInWithEmailAndPassword } from 'firebase/auth';

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
      console.error(`${email}로 들어가지 못했습니다 (${e.code || e.message}). V4 저장소에서 npm run seed를 먼저 돌리세요.`);
      process.exit(1);
    }
    await setDoc(doc(db, 'spaces', `u_${uid}`), personalSpace(uid));
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
