// 대화 쓰기·받기 (P19-1 ■2 - 셈은 domain/chat, 규칙은 firestore.rules v5Chat·v5Dm·v5ChatReads).
//   - 공간 밖이라 저장 도우미(repo)·되돌리기 더미·기기 사본·JSON 백업을 거치지 않는다(쪽지와 같다 - DESIGN 4-9).
//     그래서 끊긴 동안 '저장을 기다립니다' 띠는 beginPendingWrite를 직접 부른다. 보내기 실패는 안내하고 던진다(글 칸은 그대로 - V4 교훈).
//   - 받기(Shell에 하나 useChatWatch - 새 창은 하지 않는다): 든 그룹마다 그룹 전체 방 문서 + 고른 사람 방 목록(where members.<나>) ·
//     1:1 목록(where members.<나>) · 내 읽음 문서 → store. 그룹을 나가·내보내지면 그 그룹 듣기가 다음 글에서 permission-denied로
//     끊긴다(P19-1 ■0 - 나간 순간에는 끊기지 않는다) → 그 그룹 방을 store에서 뺀다.
//   - 방 글은 방을 열 때만 최근 50개를 듣고, 위로 올리면 50개씩 더(getDocs startAfter). 쿼리는 칸 하나씩만(복합 색인 없음 - 운영 색인 0개).
import { useEffect, useRef } from 'react';
import {
  collection,
  deleteField,
  doc,
  getCountFromServer,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAfter,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { failWithToast, showErrorToast } from '../app/toast';
import {
  CHAT_COUNT_MAX,
  CHAT_PAGE,
  chatExpireAt,
  chatSendDocs,
  cleanRoomName,
  msgsPath,
  readChatMsg,
  readChatRoom,
  refOf,
  roomKey,
  roomPath,
  type ChatMsg,
  type ChatRoom,
  type ChatRoomRef,
  type ChatTarget,
  type OutgoingChat,
} from '../domain/chat';
import { useChatStore } from './chatStore';
import { db } from './firebase';
import { newId } from './id';
import { beginPendingWrite } from './pendingWrites';
import { useSession } from './session';
import { useMySpaces } from './spaceChoice';

const roomDoc = (ref: ChatRoomRef) => {
  const [first, ...rest] = roomPath(ref);
  return doc(db, first, ...rest);
};
const msgsOf = (ref: ChatRoomRef) => {
  const [first, ...rest] = msgsPath(ref);
  return collection(db, first, ...rest);
};
const readsDoc = (uid: string) => doc(db, 'v5ChatReads', uid);
// 방·읽음 문서의 서버 시각은 막 쓴 동안 기기 짐작으로(읽음을 적은 순간 안 읽음이 사라지게 - 기본값 null이면 읽음 칸이 없는 것처럼 보인다)
const EST = { serverTimestamps: 'estimate' } as const;

/** 새 고른 사람 방 id */
export const newRoomId = () => `r_${newId()}`;

/**
 * 보내기 - 글 + 방 미리 보기를 한 묶음(규칙이 서로 본다). 돌려주는 것 = 글 id.
 * 1:1은 부르는 쪽이 보내기 직전에 함께 든 그룹(sid)을 다시 골라 넘긴다(그 그룹을 나갔으면 다른 그룹으로 옮긴다).
 */
export async function sendChat(t: ChatTarget, m: OutgoingChat): Promise<string> {
  const id = newId();
  const ref = refOf(t);
  const { msg, room, merge } = chatSendDocs(t, m, id, serverTimestamp(), Timestamp.fromMillis(chatExpireAt(Date.now())));
  const b = writeBatch(db);
  b.set(doc(msgsOf(ref), id), msg);
  if (merge) b.set(roomDoc(ref), room, { merge: true });
  else b.set(roomDoc(ref), room);
  const done = beginPendingWrite();
  try {
    await b.commit();
  } catch (e) {
    failWithToast(
      (e as { code?: string })?.code === 'permission-denied'
        ? '보내지 못했습니다. 그룹을 나갔거나 이 대화에서 빠졌습니다.'
        : '보내지 못했습니다.',
      e,
    );
  } finally {
    done();
  }
  return id;
}

export interface ChatPage {
  /** 오래된 것부터 */
  msgs: ChatMsg[];
  /** 더 오래된 글을 받을 자리 (더 없으면 null) */
  cursor: QueryDocumentSnapshot | null;
  /** 끊긴 채 받아 서버 것이 아니다 */
  offline: boolean;
}

/** 방 최근 글 50개를 듣는다 (방을 연 동안). 볼 수 없게 되면(나감·내보내짐) onError */
export function watchRoomMsgs(ref: ChatRoomRef, onPage: (p: ChatPage) => void, onError: (e: unknown) => void): () => void {
  return onSnapshot(
    query(msgsOf(ref), orderBy('at', 'desc'), limit(CHAT_PAGE)),
    { includeMetadataChanges: true },
    (snap) =>
      onPage({
        msgs: snap.docs.map((d) => readChatMsg(d.id, d.data())).reverse(),
        cursor: snap.size === CHAT_PAGE ? snap.docs[snap.size - 1] : null,
        offline: snap.metadata.fromCache,
      }),
    onError,
  );
}

/** 위로 올렸을 때 - cursor보다 오래된 글 50개 (오래된 것부터) */
export async function loadOlderMsgs(ref: ChatRoomRef, cursor: QueryDocumentSnapshot): Promise<ChatPage> {
  const snap = await getDocs(query(msgsOf(ref), orderBy('at', 'desc'), startAfter(cursor), limit(CHAT_PAGE)));
  return {
    msgs: snap.docs.map((d) => readChatMsg(d.id, d.data())).reverse(),
    cursor: snap.size === CHAT_PAGE ? snap.docs[snap.size - 1] : null,
    offline: snap.metadata.fromCache,
  };
}

/** 안 읽은 글 수 - 내 읽음 뒤의 글(읽음이 없으면 모두), CHAT_COUNT_MAX + 1까지만 센다 */
export async function countUnread(ref: ChatRoomRef, since: number | null): Promise<number> {
  const parts = [...(since === null ? [] : [where('at', '>', Timestamp.fromMillis(since))]), limit(CHAT_COUNT_MAX + 1)];
  return (await getCountFromServer(query(msgsOf(ref), ...parts))).data().count;
}

/** 읽음 - 1:1은 방 reads.<나>, 그룹 방은 내 읽음 문서. 실패해도 다음에 보면 다시 적는다 */
export async function markRoomRead(uid: string, ref: ChatRoomRef): Promise<void> {
  try {
    if (ref.kind === 'dm') await updateDoc(roomDoc(ref), { [`reads.${uid}`]: serverTimestamp() });
    // 칸 이름에 '~'가 있어 글자 경로(updateDoc 'rooms.…')는 SDK가 막는다 - merge로 그 칸만
    else await setDoc(readsDoc(uid), { rooms: { [roomKey(ref)]: serverTimestamp() }, v: 1 }, { merge: true });
  } catch (e) {
    console.warn('[chat] 읽음을 적지 못했습니다.', e);
  }
}

/** 그룹에 들 때 - 그 그룹 전체 방의 지난 글을 읽은 것으로(안 읽음 1개 방에 99+가 뜨지 않게) */
export const markChatJoined = (uid: string, sid: string) => markRoomRead(uid, { kind: 'all', sid, roomId: 'all' });

/** 🔕 이 방 알림 끄기·켜기 (내 칸만 - 푸시 함수와 새 글 안내가 거른다) */
export async function setRoomMuted(uid: string, ref: ChatRoomRef, muted: boolean): Promise<void> {
  const done = beginPendingWrite();
  try {
    await updateDoc(roomDoc(ref), { [`muted.${uid}`]: muted ? true : deleteField() });
  } catch (e) {
    showErrorToast('알림 설정을 바꾸지 못했습니다.', e);
  } finally {
    done();
  }
}

/** 방 문서 고치기 - 끊긴 동안 '저장을 기다립니다' 띠, 실패는 안내하고 던진다 */
async function updateRoom(ref: ChatRoomRef, data: Record<string, unknown>, fail: string): Promise<void> {
  const done = beginPendingWrite();
  try {
    await updateDoc(roomDoc(ref), data);
  } catch (e) {
    failWithToast(fail, e);
  } finally {
    done();
  }
}

/** 고른 사람 방 이름 바꾸기 (P19-4 - 방 사람 누구나) */
export const renameRoom = (ref: ChatRoomRef, name: string) => updateRoom(ref, { name: cleanRoomName(name) }, '방 이름을 바꾸지 못했습니다.');

/** 고른 사람 방에 그 그룹 사람 더하기 (P19-4 - 방 사람 누구나, 남을 빼지는 못한다. 50명까지는 부르는 쪽이 본다) */
export const addRoomMembers = (ref: ChatRoomRef, uids: readonly string[]) =>
  updateRoom(ref, Object.fromEntries(uids.map((u) => [`members.${u}`, true])), '사람을 더하지 못했습니다.');

/** 고른 사람 방 나가기 (P19-4 - 나만 뺀다. 다시 들려면 방 사람이 더해 주어야 한다) */
export const leaveRoom = (uid: string, ref: ChatRoomRef) => updateRoom(ref, { [`members.${uid}`]: deleteField() }, '방에서 나가지 못했습니다.');

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
  const dropGroup = (sid: string, e: unknown) => {
    console.warn('[chat] 그룹 대화를 받지 못했습니다 (그룹을 나갔거나 내보내졌을 수 있습니다).', e);
    groupAll.delete(sid);
    groupRooms.delete(sid);
    publish();
  };

  const stops: (() => void)[] = [];
  for (const sid of sids) {
    const allRef: ChatRoomRef = { kind: 'all', sid, roomId: 'all' };
    stops.push(
      onSnapshot(
        roomDoc(allRef),
        (snap) => {
          if (snap.exists()) groupAll.set(sid, readChatRoom(allRef, snap.data(EST)));
          else groupAll.delete(sid);
          notice(`all:${sid}`, snap.exists() ? [groupAll.get(sid)!] : [], snap.metadata.fromCache);
          publish();
        },
        (e) => dropGroup(sid, e),
      ),
      onSnapshot(
        query(collection(db, 'v5Chat', sid, 'chatRooms'), where(`members.${uid}`, '==', true)),
        (snap) => {
          const list = snap.docs.map((d) => readChatRoom({ kind: 'room', sid, roomId: d.id }, d.data(EST)));
          groupRooms.set(sid, list);
          notice(`rooms:${sid}`, list, snap.metadata.fromCache);
          publish();
        },
        (e) => dropGroup(sid, e),
      ),
    );
  }
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
