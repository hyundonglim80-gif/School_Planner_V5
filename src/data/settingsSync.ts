// 설정 문서 하나를 이 기기 값(store)과 맞춘다 (V4 hooks/usePreferenceSync.ts).
//   spaces/u_{uid}/settings/common  - 계정에 하나 (교사 유형·이월 기간 …)
//   spaces/u_{uid}/settings/pc|mobile - 기기 종류마다 (글자 크기·창 위치·단축키 …)
//
// - 서버 값이 오면 이 기기에 입힌다. 같은 종류의 다른 기기에서 바꾸면 곧바로 따라간다.
// - 이 기기에서 바꾸면 1초 뒤 문서 통째로 적는다(숫자 칸에 글자를 칠 때마다 적지 않게). merge를 쓰지 않는다 -
//   기본값으로 되돌려 칸이 빠졌을 때 merge면 서버에 옛 값이 남는다(V4).
// - ⚠️ 서버 값을 한 번 받아 보기 전에는 올리지 않는다. 새 기기는 기본값으로 시작하므로, 먼저 올리면 계정 설정을
//   기본값으로 덮어쓴다(V4). Firestore는 기기 저장소 없이(memoryLocalCache) 쓰므로 첫 소식은 서버에서 온다 -
//   연결이 없어 캐시에서 온 '문서 없음'만 믿지 않는다.
// - 문서가 없으면: 이 기기 값이 기본값과 다를 때만 올린다(같으면 문서를 만들지 않는다 - 기본값은 저장하지 않는다).
//
// 서버와 이야기하는 부분(port)과 맞추는 규칙(startSettingsSync)을 나눠, 규칙은 서버 없이 시험한다.
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { personalSpaceId } from './space';
import { settingsKey } from '../domain/settings';

export type SettingsData = Record<string, unknown>;

export interface SettingsPort {
  /** 서버 값이 올 때마다 (내가 적고 아직 서버에 닿지 않은 것은 빼고). 문서가 없으면 null, fromCache = 연결 없이 캐시에서 */
  watch(onData: (data: SettingsData | null, fromCache: boolean) => void): () => void;
  save(data: SettingsData): Promise<void>;
}

export interface SettingsBinding {
  /** 지금 이 기기 값 → 문서에 적을 것 (기본값과 같은 칸은 뺀다) */
  local(): SettingsData;
  /** 문서 → 이 기기에 입힌다 (없는 칸은 기본값) */
  apply(data: SettingsData): void;
  /** 이 기기 값이 바뀌면 부른다. 끊는 함수를 돌려준다 */
  subscribe(onChange: () => void): () => void;
}

export const SETTINGS_WRITE_DELAY_MS = 1000;

/**
 * 맞추기를 시작한다. 끊는 함수를 돌려준다 - 기다리던 쓰기는 버리지 않고 바로 적고, 그 쓰기가 끝나면 풀리는 약속을 돌려준다
 * (로그아웃 앞에서 기다린다 - 로그아웃한 뒤에 가면 권한이 없어 버려진다).
 */
export function startSettingsSync(port: SettingsPort, binding: SettingsBinding, delayMs = SETTINGS_WRITE_DELAY_MS): () => Promise<void> {
  let ready = false;
  let applying = false;
  // 서버와 이 기기가 마지막으로 맞춰진 값. 같으면 다시 적지 않는다.
  let lastKey = '';
  let timer: ReturnType<typeof setTimeout> | null = null;

  const write = () => {
    timer = null;
    const data = binding.local();
    lastKey = settingsKey(data);
    return port.save(data).catch((e: unknown) => console.warn('[settings] 설정을 계정에 저장하지 못했습니다:', e));
  };

  const unsubLocal = binding.subscribe(() => {
    if (!ready || applying) return;
    if (settingsKey(binding.local()) === lastKey) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void write(), delayMs);
  });

  const unsubRemote = port.watch((data, fromCache) => {
    if (data) {
      // 이 기기에서 방금 바꿔 적기를 기다리는 중이면 그것이 더 새 값이다
      if (timer) return;
      applying = true;
      try {
        binding.apply(data);
      } finally {
        applying = false;
      }
      lastKey = settingsKey(binding.local());
      ready = true;
      return;
    }
    // 문서 없음: 처음 한 번만, 서버가 그렇다고 할 때만
    if (ready || fromCache) return;
    ready = true;
    const local = binding.local();
    lastKey = settingsKey(local);
    if (Object.keys(local).length > 0) void write();
  });

  return () => {
    unsubLocal();
    unsubRemote();
    if (!timer) return Promise.resolve();
    clearTimeout(timer);
    return write();
  };
}

/** 개인 공간의 설정 문서 하나 (규칙: 내 개인 공간 아래는 나만 - firestore.rules) */
export function settingsPort(uid: string, docId: 'common' | 'pc' | 'mobile'): SettingsPort {
  const ref = doc(db, 'spaces', personalSpaceId(uid), 'settings', docId);
  return {
    watch: (onData) =>
      onSnapshot(
        ref,
        (snap) => {
          // 내가 방금 적은 값의 메아리는 건너뛴다(서버에 닿은 뒤 다시 온다)
          if (snap.metadata.hasPendingWrites) return;
          // updatedAt·v는 그대로 넘긴다 - 읽는 쪽(readSettings)은 표에 있는 칸만 본다
          onData(snap.exists() ? snap.data() : null, snap.metadata.fromCache);
        },
        (e) => console.warn(`[settings] ${docId} 구독 실패:`, e),
      ),
    // 저장 도우미(P2-1) 전이라 여기서 서버 시각·판을 붙인다 - P2-1이 도우미로 옮긴다
    save: (data) => setDoc(ref, { ...data, updatedAt: serverTimestamp(), v: 1 }),
  };
}
