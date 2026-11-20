// 대화 쓰기·받기 (P19-1 ■2 - 셈은 domain/chat, 규칙은 firestore.rules v5Chat·v5Dm·v5ChatReads).
//   - 공간 밖이라 저장 도우미(repo)·되돌리기 더미·기기 사본·JSON 백업을 거치지 않는다(쪽지와 같다 - DESIGN 4-9).
//     그래서 끊긴 동안 '저장을 기다립니다' 띠는 beginPendingWrite를 직접 부른다. 보내기 실패는 안내하고 던진다(글 칸은 그대로 - V4 교훈).
//   - 받기(Shell에 하나 useChatWatch - 새 창은 하지 않는다)는 data/chatWatch(P49-3 - 껍데기가 늘 부른다, 이 파일은 대화 창을 열 때 받는다).
//   - 방 글은 방을 열 때만 최근 50개를 듣고, 위로 올리면 50개씩 더(getDocs startAfter). 쿼리는 칸 하나씩만(복합 색인 없음 - 운영 색인 0개).
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
  refOf,
  roomKey,
  type ChatMsg,
  type ChatRoomRef,
  type ChatTarget,
  type OutgoingChat,
} from '../domain/chat';
import { readsDoc, roomDoc } from './chatWatch';
import { db } from './firebase';
import { newId } from './id';
import { beginPendingWrite } from './pendingWrites';

const msgsOf = (ref: ChatRoomRef) => {
  const [first, ...rest] = msgsPath(ref);
  return collection(db, first, ...rest);
};

/** 새 고른 사람 방 id */
export const newRoomId = () => `r_${newId()}`;

/**
 * 보내기 - 글 + 방 미리 보기를 한 묶음(규칙이 서로 본다). 돌려주는 것 = 글 id.
 * 1:1은 부르는 쪽이 보내기 직전에 함께 든 그룹(sid)을 다시 골라 넘긴다(그 그룹을 나갔으면 다른 그룹으로 옮긴다).
 * id = 듣기 전에 방에 먼저 그린 글의 id(새 방 - 서버 글이 오면 같은 id로 바뀐다).
 */
export async function sendChat(t: ChatTarget, m: OutgoingChat, id = newId()): Promise<string> {
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
  // 내 글까지 읽은 것으로 - 안 읽은 수는 내 읽음 뒤의 글을 세므로, 안 적으면 내가 보낸 글이 남의 새 글과 함께 세어진다.
  // 기다리지 않는다(새 방은 보낸 뒤에야 글을 듣기 시작한다 - 늦추지 않게). 실패해도 다음에 보면 다시 적는다
  void markRoomRead(m.from, ref);
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
 * 내 글 지우기 (P19-4 ■2) - 글은 남기고 '지운 글'로(deletedAt + 빈 글·첨부 없음 - 모두에게 그 자리에 '지운 글').
 * 방의 마지막 글이면 같은 묶음에서 방 미리 보기도 빈 글로(규칙이 서로 본다 - 목록·안내 '지운 글'). room = 지금 아는 방(마지막 글 견주기).
 * 그 사이에 새 글이 와 마지막 글이 바뀌었으면 규칙이 막는다 - 안내하고 던진다(다시 하면 새 방으로 간다).
 */
export async function deleteChatMsg(uid: string, ref: ChatRoomRef, msgId: string, room: { lastId: string | null; lastFrom: string } | undefined): Promise<void> {
  const b = writeBatch(db);
  b.update(doc(msgsOf(ref), msgId), { deletedAt: serverTimestamp(), text: '', attachments: deleteField() });
  if (room?.lastId === msgId && room.lastFrom === uid) b.update(roomDoc(ref), { lastText: '' });
  const done = beginPendingWrite();
  try {
    await b.commit();
  } catch (e) {
    failWithToast('글을 지우지 못했습니다. 다시 해 보세요.', e);
  } finally {
    done();
  }
}

// 내가 든 방 듣기는 껍데기가 늘 부르는 chatWatch에 (P49-3) - 대화 창 쪽은 여기서 함께 부른다
export { useChatWatch, watchChatRooms } from './chatWatch';
