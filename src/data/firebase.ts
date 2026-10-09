// Firebase 연결. 프로젝트는 V4와 같은 schoolplannerv3다 - 로그인 uid·푸시·함수, 그리고 드라이브 drive.file
// 권한이 이 클라우드 프로젝트에 묶여 있어 V4가 올린 첨부를 그대로 열려면 같은 프로젝트여야 한다(DESIGN 3장).
// 자료는 V3·V4와 섞지 않는다 - V5는 spaces/… 아래에만 쓴다.
import { initializeApp } from 'firebase/app';
import { initializeFirestore, memoryLocalCache } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { connectEmulators } from './emulator';

const firebaseConfig = {
  apiKey: 'AIzaSyBd1z4RZnSbZWdwAIFvPOue5AaZ8wQ9ka0',
  // V5 Hosting 주소(P1-4). 로그인 처리(/__/auth/handler)가 앱과 같은 출처가 되어 휴대폰 리디렉트 로그인이 안정적이다(DESIGN 3장).
  // 바꾸려면 Auth 승인된 도메인과 OAuth 클라이언트의 리디렉션 URI(https://<주소>/__/auth/handler)가 먼저 있어야 한다.
  authDomain: 'schoolplanner-v5.web.app',
  projectId: 'schoolplannerv3',
  storageBucket: 'schoolplannerv3.firebasestorage.app',
  messagingSenderId: '906471951519',
  appId: '1:906471951519:web:1d3e6952d9579b2a9b26aa',
};

// 앱 이름을 V3('[DEFAULT]')·V4('SchoolPlannerV4')와 달리 두어 로그인 세션·기기 저장소 이름이 섞이지 않게 한다.
/** 구글 Picker(학생 사진 고르기)가 쓴다 - 웹 API 키와 프로젝트 번호 (V4와 같다) */
export const GOOGLE_API_KEY = firebaseConfig.apiKey;
export const GOOGLE_APP_ID = firebaseConfig.messagingSenderId;

export const app = initializeApp(firebaseConfig, 'SchoolPlannerV5');

// Firestore 오프라인 저장소(IndexedDB)는 쓰지 않는다(memoryLocalCache).
// V4는 그 저장소가 반쯤 지워진 채 잠기면('Failed to obtain primary lease') 서버 자료가 오류 한 줄 없이
// 영영 오지 않는 사고를 반년 되풀이했다(V4 src/lib/firebase.ts 주석, 09-22).
// V5의 기기 사본은 앱이 따로 둔다(P2-2, DESIGN 6-2) - 그것이 고장 나도 서버 구독은 멈추지 않게.
//
// ignoreUndefinedProperties: 값이 undefined인 칸은 빼고 보낸다. 없으면 배열 속 undefined 하나로
// 저장이 통째로 거부되고 어느 칸인지도 알려 주지 않는다(V4).
export const db = initializeFirestore(app, {
  localCache: memoryLocalCache(),
  ignoreUndefinedProperties: true,
});

export const auth = getAuth(app);

// 점검용 에뮬레이터. 에뮬레이터 빌드에서만 붙는다(운영 빌드에서는 빠진다).
connectEmulators(auth, db);

// V4와 같은 범위. 빠지면 그 API(캘린더·시트 …)를 부를 때 401이 난다.
export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/tasks',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
];

export const googleProvider = new GoogleAuthProvider();
for (const scope of GOOGLE_SCOPES) googleProvider.addScope(scope);
