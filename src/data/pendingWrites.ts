// 서버가 아직 받지 않은 쓰기 (P14-6 ■1). 저장 도우미(repo writeOps)가 적기 시작할 때 하나 더하고, 끝나면(받음·실패) 뺀다.
//
// Firestore는 기기 저장소 없이(memoryLocalCache - V4 09-22 교훈) 쓰므로 인터넷이 끊긴 동안 쓰기는 **메모리에만** 기다린다 -
// 그대로 앱을 닫으면 사라진다(10-30 사용자 휴대폰 (a) ②). 그래서 기다리는 것이 있으면
//   - 머리줄 안내 "📴 인터넷이 끊겨 저장을 기다립니다 - 앱을 닫지 마세요 (n개)" (app/PendingWritesBanner)
//   - 탭·창을 닫을 때 브라우저가 묻는다 (app/pendingWritesGuard)
// 세기만 한다 - 쓰기를 늦추거나 실패를 삼키지 않는다(저장 실패는 던진다 - V4 교훈).
import { create } from 'zustand';

interface PendingWritesState {
  /** 기다리는 쓰기 묶음 수 (writeOps 한 번 = 하나) */
  count: number;
  /** 가장 오래 기다린 쓰기의 시작 시각(ms) - 없으면 null */
  since: number | null;
}

export const usePendingWrites = create<PendingWritesState>(() => ({ count: 0, since: null }));

/** 시작 시각 - 열쇠는 쓰기마다 따로 (같은 ms에 둘이 시작해도) */
const started = new Map<number, number>();
let nextId = 1;

function publish() {
  let since: number | null = null;
  for (const t of started.values()) if (since === null || t < since) since = t;
  usePendingWrites.setState({ count: started.size, since });
}

/** 쓰기 하나를 센다 - 돌려준 함수를 끝날 때 한 번 부른다(두 번 불러도 한 번만 뺀다) */
export function beginPendingWrite(now = Date.now()): () => void {
  const id = nextId++;
  started.set(id, now);
  publish();
  return () => {
    if (started.delete(id)) publish();
  };
}

export function hasPendingWrites(): boolean {
  return started.size > 0;
}

/** 시험에서 센 것을 비운다 */
export function resetPendingWritesForTest() {
  started.clear();
  publish();
}
