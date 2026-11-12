// 내 '초기화 설정' 문서 (P33-2) - spaces/u_{uid}/settings/reset. 내 공간 아래라 새 규칙이 없다(공간 아래 자료 = 나만).
//   모양은 domain/settingsSnapshot(묶음 - 계정 몫 + 기기 종류 몫). 읽기는 그 모양만 믿는다(readSnapshot).
// 관리자 '처음 설정' = 새 사용자 기본값 (P33-3) - sharedConfig/initialSettings(같은 묶음 모양 - 로그인하면 읽기, 관리자만 쓰기 · 규칙 그대로).
//   누가 저장했나는 관리자만 읽는 admin/initialSettings에 따로(모두가 읽는 문서에 관리자 메일을 두지 않는다 - P33 ②).
import { doc, getDoc, onSnapshot, writeBatch } from 'firebase/firestore';
import { db } from './firebase';
import { personalSpaceId } from './space';
import { batch, writeOp } from './repo';

export const RESET_DOC_ID = 'reset';
export const INITIAL_SETTINGS_ID = 'initialSettings';

/** 내 초기화 설정 문서를 듣는다 (없으면 null). 내가 방금 적은 것도 곧바로 온다 - 💾 뒤 ↩️가 곧바로 그 값으로 */
export function watchMyReset(uid: string, onData: (data: unknown) => void): () => void {
  return onSnapshot(
    doc(db, 'spaces', personalSpaceId(uid), 'settings', RESET_DOC_ID),
    (snap) => onData(snap.exists() ? snap.data() : null),
    (e) => console.warn('[settings] 초기화 설정 구독 실패:', e),
  );
}

/** 통째로 적는다 (사용자가 누른 저장 - 실패하면 안내하고 던진다) */
export async function saveMyReset(uid: string, data: Record<string, unknown>): Promise<void> {
  await batch([writeOp.put({ sid: personalSpaceId(uid), coll: 'settings', id: RESET_DOC_ID }, data)], {
    fail: '초기화 설정을 저장하지 못했습니다. 인터넷 연결을 확인하고 다시 눌러 주세요.',
  });
}

const initialRef = () => doc(db, 'sharedConfig', INITIAL_SETTINGS_ID);
const initialLogRef = () => doc(db, 'admin', INITIAL_SETTINGS_ID);

/** 관리자 '처음 설정'을 듣는다 (없으면 null) - '초기화'가 내 것 다음으로 가는 값 */
export function watchInitialSettings(onData: (data: unknown) => void): () => void {
  return onSnapshot(
    initialRef(),
    (snap) => onData(snap.exists() ? snap.data() : null),
    (e) => console.warn('[settings] 처음 설정 구독 실패:', e),
  );
}

/** 관리자 '처음 설정'을 한 번 읽는다 (새 사용자 - 설정 문서가 없을 때만). 못 읽으면 던진다 */
export async function loadInitialSettings(): Promise<unknown> {
  const snap = await getDoc(initialRef());
  return snap.exists() ? snap.data() : null;
}

/** 기기 종류마다 누가·언제 저장했나 (관리자만 읽는다) */
export type InitialSettingsLog = Partial<Record<'pc' | 'mobile', { by: string; at: number }>>;

export async function loadInitialSettingsLog(): Promise<InitialSettingsLog> {
  const snap = await getDoc(initialLogRef());
  const d = snap.exists() ? (snap.data() as Record<string, unknown>) : {};
  const out: InitialSettingsLog = {};
  for (const kind of ['pc', 'mobile'] as const) {
    const v = d[kind] as { by?: unknown; at?: unknown } | undefined;
    if (v && typeof v.by === 'string' && typeof v.at === 'number') out[kind] = { by: v.by, at: v.at };
  }
  return out;
}

const SAVE_WAIT_MS = 20_000;

/**
 * 관리자 '처음 설정' 저장 - 그 기기 종류 몫 + 계정 몫만 바꾼다(다른 기기 종류 몫은 그대로 - mergeFields).
 * 문서 하나를 덮으므로 여러 관리자면 마지막 저장이 이긴다. 누가·언제는 관리자 문서에. 실패·오래 걸리면 던진다(누른 저장 - 안내).
 */
export async function saveInitialSettings(kind: 'pc' | 'mobile', data: { common: Record<string, unknown>; at: number; part: Record<string, unknown> }, by: string): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new Error('인터넷 연결이 없습니다');
  const b = writeBatch(db);
  b.set(initialRef(), { common: data.common, at: data.at, [kind]: data.part }, { mergeFields: ['common', 'at', kind] });
  b.set(initialLogRef(), { [kind]: { by, at: data.at } }, { merge: true });
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      b.commit(),
      new Promise((_, reject) => (timer = setTimeout(() => reject(new Error('서버가 대답하지 않습니다')), SAVE_WAIT_MS))),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
