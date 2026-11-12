// 내 '초기화 설정' 문서 (P33-2) - spaces/u_{uid}/settings/reset. 내 공간 아래라 새 규칙이 없다(공간 아래 자료 = 나만).
//   모양은 domain/settingsSnapshot(묶음 - 계정 몫 + 기기 종류 몫). 읽기는 그 모양만 믿는다(readSnapshot).
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import { personalSpaceId } from './space';
import { batch, writeOp } from './repo';

export const RESET_DOC_ID = 'reset';

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
