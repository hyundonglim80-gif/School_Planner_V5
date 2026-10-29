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
// 교사 유형(settings/common.teaching - P6-1): 고르지 않은 계정은 하루 화면 맨 위에 '교사 유형을 골라 주세요' 띠가 떠
// 다른 점검의 화면을 밀어낸다 - 셋 다 골라 둔다. 띠는 tools/inspect-lessons.mjs가 칸을 비우고 본 뒤 되돌린다.
const HOMEROOM = { unit: 'subject', hasHomeroom: true, homeroomClass: '', subjects: [], classes: [], classColors: {} };
const SUBJECT_ONLY = { unit: 'class', hasHomeroom: false, homeroomClass: '', subjects: ['과학'], classes: ['5-1', '5-2', '5-3'], classColors: {} };
const ACCOUNTS = [
  { email: 'teacher@example.com', note: '기본 계정 - V4 seed 자료가 있다', teaching: HOMEROOM },
  { email: 'teacher2@example.com', note: '공유 그룹 둘째 사람 (?as=2)', teaching: HOMEROOM },
  { email: 'teacher3@example.com', note: '교과 전담 (?as=3)', teaching: SUBJECT_ONLY },
  { email: 'teacher4@example.com', note: '성능 점검 (?as=4) - 1만 항목은 tools/inspect-perf가 심는다', teaching: HOMEROOM },
  // 에뮬레이터 안에서만 쓰는 개발자 계정(환경설정 '개발자' 탭·오류 기록 읽기 - P14-2). 메일은 규칙 isDeveloper 목록의 하나(check-rules도 같은 메일)
  { email: 'hyundonglim80@gmail.com', note: '개발자 (?as=5)', teaching: HOMEROOM },
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
  for (const { email, note, teaching } of ACCOUNTS) {
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
    // 드라이브 자동 백업(P8-3)은 1년 동안 할 때가 아니게 - 마지막 백업을 앞날로 둔다. 구글 토큰을 심는 점검(첨부·사진·캘린더)에
    // 자동 백업이 끼어들어 드라이브 흉내에 백업 파일을 올리지 않게. 자동 백업은 tools/inspect-backup.mjs가 이 기록을 바꿔 본 뒤 되돌린다.
    await setDoc(doc(db, 'spaces', `u_${uid}`, 'settings', 'backupLog'), { lastAt: Date.now() + 365 * 86400000, updatedAt: serverTimestamp(), v: 1 });
    // 계정 설정은 다른 칸을 두고 교사 유형만 (merge)
    // 새 학년도 띠(P9-2)는 2/15 ~ 3/31에 뜬다 - 그때 돌리는 다른 점검을 밀지 않게 '준비 끝'을 먼 학년도로 (tools/inspect-new-year.mjs가 바꿔 본다)
    await setDoc(doc(db, 'spaces', `u_${uid}`, 'settings', 'common'), { teaching, newYearDone: 9999, updatedAt: serverTimestamp(), v: 1 }, { merge: true });
    console.log(`${email} (${note}) → spaces/u_${uid}`);
  }
  console.log(`V5 자료를 심었습니다 - 개인 공간 ${ACCOUNTS.length}개`);
  await deleteApp(app);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
