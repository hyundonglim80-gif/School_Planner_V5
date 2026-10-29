// 오류 알림 보내기 (P14-2). 사용자 화면에서 난 오류를 `v5Errors`에 문서 하나로 남긴다 - 개발자가 환경설정 '개발자' 탭에서 본다(아래 load·delete).
//   - 무엇을 싣나·무엇을 버리나·몇 번까지는 domain/errorReport. 메모·학생 글은 싣지 않는다('toast'는 앱이 띄운 안내 글 + 오류 이름·코드).
//   - 저장 도우미(repo)·되돌리기·기기 사본을 거치지 않고 addDoc 하나. 보내기가 실패하면 조용히 버린다(오류 알림이 또 오류를 부르지 않게).
//   - 로그인하지 않았으면·개발 서버·에뮬레이터 빌드면 보내지 않는다(콘솔에는 원래대로 남는다) - 점검은 enableErrorReports(true)로 켠다.
import { addDoc, collection, doc, getDocs, limit, orderBy, query, serverTimestamp, Timestamp, writeBatch } from 'firebase/firestore';
import type { ErrorInfo } from 'react';
import { db } from './firebase';
import { USING_EMULATOR } from './emulator';
import { useSession } from './session';
import { detectDeviceKind } from '../app/prefs';
import { useNav } from '../app/nav';
import { setErrorToastReporter } from '../app/toast';
import { todayStr } from '../domain/dateUtils';
import {
  buildReport,
  describeError,
  errorKey,
  isNoise,
  readDaySent,
  readSessionSent,
  shouldSend,
  type DaySent,
  type ErrorKind,
  type ErrorReportDoc,
  type SessionSent,
} from '../domain/errorReport';

const SESSION_KEY = 'sp5-error-sent';
const DAY_KEY = 'sp5-error-day';
const KEEP_DAYS = 30;

let enabled = !import.meta.env.DEV && !USING_EMULATOR;
/** 점검·자료 시험에서 켠다 (개발 서버·에뮬레이터 빌드는 처음에 꺼져 있다) */
export function enableErrorReports(on: boolean) {
  enabled = on;
}

// 저장소를 못 쓰는 브라우저(사생활 모드 등)에서도 이 탭 안에서는 같은 상한을 지킨다
let memSession: SessionSent = { keys: [] };
let memDay: DaySent = { day: '', count: 0 };

function loadSent(): { session: SessionSent; day: DaySent } {
  try {
    return { session: readSessionSent(sessionStorage.getItem(SESSION_KEY)), day: readDaySent(localStorage.getItem(DAY_KEY)) };
  } catch {
    return { session: memSession, day: memDay };
  }
}

function saveSent(session: SessionSent, day: DaySent) {
  memSession = session;
  memDay = day;
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    localStorage.setItem(DAY_KEY, JSON.stringify(day));
  } catch {
    /* 메모리 것으로 */
  }
}

const isStandalone = () => {
  try {
    return !!window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  } catch {
    return false;
  }
};

/**
 * 오류 하나를 알린다. 보냈으면 true(시험용) - 버리거나 막히면 false. 던지지 않는다.
 * `source`는 오류가 난 파일 주소(window error) - 확장 프로그램 오류를 가린다.
 */
export async function reportError(
  kind: ErrorKind,
  err: unknown,
  opts: { toastText?: string; componentStack?: string; source?: string } = {},
): Promise<boolean> {
  try {
    const uid = useSession.getState().user?.uid;
    if (!enabled || !uid) return false;
    const e = describeError(err);
    if (isNoise({ ...e, source: opts.source }, navigator.onLine !== false)) return false;
    const fields = buildReport(
      kind,
      err,
      {
        build: __BUILD_ID__,
        scope: useNav.getState().scope,
        device: detectDeviceKind(),
        standalone: isStandalone(),
        ua: navigator.userAgent,
      },
      opts,
    );
    const { session, day } = loadSent();
    const next = shouldSend(session, day, errorKey(kind, fields.message, fields.stack), todayStr());
    if (!next) return false;
    saveSent(next.session, next.day);
    await addDoc(collection(db, 'v5Errors'), {
      ...fields,
      uid,
      at: serverTimestamp(),
      expireAt: Timestamp.fromMillis(Date.now() + KEEP_DAYS * 86400000),
    });
    return true;
  } catch {
    // 규칙이 막거나(배포 전)·끊겼거나 - 알리지 않는다
    return false;
  }
}

let started = false;

/** 앱을 열 때 한 번 (main.tsx): 잡지 못한 오류·약속 거절·오류 안내(showErrorToast)를 알린다 */
export function startErrorReports() {
  if (started) return;
  started = true;
  window.addEventListener('error', (ev) => {
    // 그림·스크립트 파일 읽기 실패(ev.error 없음)는 오류 알림이 아니다
    if (!ev.error && !ev.message) return;
    void reportError('error', ev.error ?? new Error(ev.message), { source: ev.filename });
  });
  window.addEventListener('unhandledrejection', (ev) => {
    void reportError('rejection', ev.reason);
  });
  setErrorToastReporter((message, error) => void reportError('toast', error, { toastText: message }));
}

/** React 그리기 오류 (main.tsx createRoot의 onCaughtError·onUncaughtError) */
export function reportReactError(error: unknown, info: Pick<ErrorInfo, 'componentStack'>) {
  void reportError('react', error, { componentStack: info.componentStack ?? undefined });
}

// ── 개발자 탭 '오류 기록'(■5) - 규칙이 개발자에게만 읽기·지우기를 허락한다. 기기 사본(MIRRORED)에 넣지 않고 누를 때 한 번 읽는다 ──

/** 최근 오류 (늦은 것부터) */
export async function loadErrorReports(max = 50): Promise<ErrorReportDoc[]> {
  const snap = await getDocs(query(collection(db, 'v5Errors'), orderBy('at', 'desc'), limit(max)));
  return snap.docs.map((d) => {
    const v = d.data();
    return {
      id: d.id,
      kind: v.kind,
      message: String(v.message ?? ''),
      stack: String(v.stack ?? ''),
      note: String(v.note ?? ''),
      build: String(v.build ?? ''),
      scope: String(v.scope ?? ''),
      device: v.device === 'mobile' ? 'mobile' : 'pc',
      standalone: v.standalone === true,
      ua: String(v.ua ?? ''),
      at: v.at instanceof Timestamp ? v.at.toMillis() : 0,
    };
  });
}

/** 오류 기록 지우기 (한 묶음 500개까지 - 읽는 것이 50개라 한 번) */
export async function deleteErrorReports(ids: readonly string[]): Promise<void> {
  for (let i = 0; i < ids.length; i += 500) {
    const b = writeBatch(db);
    for (const id of ids.slice(i, i + 500)) b.delete(doc(db, 'v5Errors', id));
    await b.commit();
  }
}

/** 시험용 - 보낸 기록·시작 표시를 비운다 */
export function resetErrorReportsForTest() {
  memSession = { keys: [] };
  memDay = { day: '', count: 0 };
  try {
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(DAY_KEY);
  } catch {
    /* 없음 */
  }
}
