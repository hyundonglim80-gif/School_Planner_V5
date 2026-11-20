// 대화 받기 - 내가 든 방 듣기 (P49-3 - data/chat에서 나눔: 껍데기의 받기(features/chat/receive)가 늘 부른다.
//   보내기·글 받기·읽음·🔕·방 고치기는 data/chat - 대화 창을 열 때 받는다. data/chat이 이 파일의 듣기를 다시 내보낸다.)
//   든 그룹마다 그룹 전체 방 문서 + 고른 사람 방 목록(where members.<나>) · 1:1 목록(where members.<나>) · 내 읽음 문서 → store.
//   그룹을 나가·내보내지면 그 그룹 듣기가 다음 글에서 permission-denied로 끊긴다(P19-1 ■0) → 그 그룹 방을 store에서 뺀다.
import { useEffect, useRef } from 'react';
import { collection, doc, onSnapshot, query, Timestamp, where } from 'firebase/firestore';
import { readChatRoom, roomPath, type ChatRoom, type ChatRoomRef } from '../domain/chatCore';
import { useChatStore } from './chatStore';
import { db } from './firebase';
import { useSession } from './session';
import { useMySpaces } from './spaceChoice';

/** 방 문서 (data/chat도 쓴다) */
export const roomDoc = (ref: ChatRoomRef) => {
  const [first, ...rest] = roomPath(ref);
  return doc(db, first, ...rest);
};
/** 내 읽음 문서 (data/chat도 쓴다) */
export const readsDoc = (uid: string) => doc(db, 'v5ChatReads', uid);
/** 막힌 그룹 듣기를 다시 거는 수 · 간격(이것의 1·2·3배) - 막 만든 그룹은 규칙이 그룹 문서를 아직 못 본다(쓰기보다 읽기가 먼저 나간다) */
const GROUP_RETRIES = 3;
const GROUP_RETRY_MS = 3000;
// 방·읽음 문서의 서버 시각은 막 쓴 동안 기기 짐작으로(읽음을 적은 순간 안 읽음이 사라지게 - 기본값 null이면 읽음 칸이 없는 것처럼 보인다)
const EST = { serverTimestamps: 'estimate' } as const;

/**
 * 내가 든 방을 듣는다 → store. sids = 지금 든 그룹(바뀌면 부르는 쪽이 다시 건다).
 * onNew = 앱을 연 뒤 남이 쓴 새 글이 온 방(처음 받은 것·끊긴 채 받은 것은 빼고). 돌려준 함수로 끊으면 store를 비운다.
 */
export function watchChatRooms(uid: string, sids: readonly string[], onNew?: (room: ChatRoom) => void): () => void {
  const groupAll = new Map<string, ChatRoom>();
  const groupRooms = new Map<string, ChatRoom[]>();
  let dms: ChatRoom[] = [];
  let reads: Record<string, number> = {};
  let dmReady = false;
  const lastSeen = new Map<string, string | null>();
  const primed = new Set<string>(); // 서버에서 한 번 받은 듣기 - 그 뒤로 바뀐 방만 onNew

  const publish = () => {
    const rooms: Record<string, ChatRoom> = {};
    for (const r of [...groupAll.values(), ...[...groupRooms.values()].flat(), ...dms]) rooms[r.key] = r;
    useChatStore.setState({ rooms, reads, ready: dmReady });
  };
  const notice = (source: string, list: ChatRoom[], fromCache: boolean) => {
    for (const r of list) {
      const before = lastSeen.get(r.key);
      if (primed.has(source) && onNew && r.lastId && before !== r.lastId && r.lastFrom !== uid && r.lastAt !== null) onNew(r);
      lastSeen.set(r.key, r.lastId);
    }
    if (!fromCache) primed.add(source);
  };
  const groupStops = new Map<string, () => void>();
  const tries = new Map<string, number>();
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const dropGroup = (sid: string, e: unknown) => {
    const stop = groupStops.get(sid);
    if (!stop) return; // 두 듣기가 함께 막힌다 - 한 번만
    console.warn('[chat] 그룹 대화를 받지 못했습니다 (그룹을 나갔거나 내보내졌을 수 있습니다).', e);
    stop();
    groupStops.delete(sid);
    groupAll.delete(sid);
    groupRooms.delete(sid);
    publish();
    // 잠시 뒤 다시 듣는다 - 막 만든 그룹이면 그때는 들린다. 정말 나갔으면 또 막혀 몇 번 뒤 그친다
    const n = tries.get(sid) ?? 0;
    if (n >= GROUP_RETRIES) return;
    tries.set(sid, n + 1);
    const t = setTimeout(() => {
      timers.delete(t);
      listenGroup(sid);
    }, GROUP_RETRY_MS * (n + 1));
    timers.add(t);
  };
  const listenGroup = (sid: string) => {
    const allRef: ChatRoomRef = { kind: 'all', sid, roomId: 'all' };
    const stopAll = onSnapshot(
      roomDoc(allRef),
      (snap) => {
        if (snap.exists()) groupAll.set(sid, readChatRoom(allRef, snap.data(EST)));
        else groupAll.delete(sid);
        notice(`all:${sid}`, snap.exists() ? [groupAll.get(sid)!] : [], snap.metadata.fromCache);
        publish();
      },
      (e) => dropGroup(sid, e),
    );
    const stopRooms = onSnapshot(
      query(collection(db, 'v5Chat', sid, 'chatRooms'), where(`members.${uid}`, '==', true)),
      (snap) => {
        const list = snap.docs.map((d) => readChatRoom({ kind: 'room', sid, roomId: d.id }, d.data(EST)));
        groupRooms.set(sid, list);
        notice(`rooms:${sid}`, list, snap.metadata.fromCache);
        publish();
      },
      (e) => dropGroup(sid, e),
    );
    groupStops.set(sid, () => {
      stopAll();
      stopRooms();
    });
  };

  const stops: (() => void)[] = [];
  for (const sid of sids) listenGroup(sid);
  stops.push(
    onSnapshot(
      query(collection(db, 'v5Dm'), where(`members.${uid}`, '==', true)),
      { includeMetadataChanges: true },
      (snap) => {
        dms = snap.docs.map((d) => readChatRoom({ kind: 'dm', pairId: d.id }, d.data(EST)));
        if (!snap.metadata.fromCache) dmReady = true;
        notice('dm', dms, snap.metadata.fromCache);
        publish();
      },
      (e) => console.warn('[chat] 1:1 대화를 받지 못했습니다.', e),
    ),
    onSnapshot(
      readsDoc(uid),
      (snap) => {
        reads = {};
        for (const [k, t] of Object.entries((snap.data(EST)?.rooms as Record<string, unknown>) ?? {})) {
          const ms = t instanceof Timestamp ? t.toMillis() : null;
          if (ms !== null) reads[k] = ms;
        }
        publish();
      },
      (e) => console.warn('[chat] 읽음을 받지 못했습니다.', e),
    ),
  );
  return () => {
    for (const t of timers) clearTimeout(t);
    for (const s of groupStops.values()) s();
    for (const s of stops) s();
    useChatStore.setState({ rooms: {}, reads: {}, ready: false });
  };
}

/** Shell에 하나 - 로그인한 동안 내가 든 방 (새 창 PopoutShell은 하지 않는다 - 두 번 읽지 않게). 그룹이 바뀌면 다시 건다 */
export function useChatWatch(onNew?: (room: ChatRoom) => void): void {
  const uid = useSession((s) => s.user?.uid);
  const loaded = useMySpaces((s) => s.loaded);
  const sidsKey = useMySpaces((s) => s.groups.map((g) => g.id).sort().join(','));
  const latest = useRef(onNew);
  useEffect(() => {
    latest.current = onNew;
  }, [onNew]);
  useEffect(
    () => (uid && loaded ? watchChatRooms(uid, sidsKey ? sidsKey.split(',') : [], (r) => latest.current?.(r)) : undefined),
    [uid, loaded, sidsKey],
  );
}
