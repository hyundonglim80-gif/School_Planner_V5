// 쪽지 쓰기·받기 (P15-1 ■2 - 셈은 domain/mail, 규칙은 firestore.rules v5Mail).
//   - 공간 밖(v5Mail/{uid}/…)이라 저장 도우미(repo)·되돌리기 더미·기기 사본·JSON 백업을 거치지 않는다(DESIGN 4-9 - v5Errors·gcalQueue처럼 바로).
//     그래서 끊긴 동안 '저장을 기다립니다' 띠는 beginPendingWrite를 직접 부른다. 보내기 실패는 안내하고 던진다(칸은 그대로 - V4 교훈).
//   - 받기: 안 읽은 것만 듣는다(where readAt == null, 100개까지 - Shell에 하나, 새 창은 하지 않는다). 목록은 쪽지 창을 열 때만 30개씩.
//   - 쿼리는 칸 하나씩만(복합 색인 없음 - 운영 색인 0개, 에뮬레이터는 색인을 보지 않는다).
//   - 끊긴 채 받은 목록은 memoryLocalCache라 비어 보인다 → offline으로 알려 '쪽지 없음'과 다르게 보인다.
import { useEffect, useRef } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { failWithToast, showErrorToast } from '../app/toast';
import {
  MAIL_PAGE,
  UNREAD_MAX,
  mailDocs,
  mailExpireAt,
  readMailIn,
  readMailSent,
  type MailBox,
  type MailIn,
  type MailSent,
  type OutgoingMail,
} from '../domain/mail';
import { db } from './firebase';
import { newId } from './id';
import { useMailStore } from './mailStore';
import { beginPendingWrite } from './pendingWrites';
import { useSession } from './session';

const BOX: Record<MailBox, string> = { in: 'mailIn', sent: 'mailSent' };
const boxOf = (uid: string, box: MailBox) => collection(db, 'v5Mail', uid, BOX[box]);

/**
 * 보내기 - 받는 사람마다 mailIn + 내 mailSent를 같은 id로 한 묶음(규칙이 사본이 함께 있는지 본다).
 * 받는 사람은 부르는 쪽이 domain/mail recipientsOf로 지금 구성원만 넘긴다. 돌려주는 것 = 쪽지 id.
 */
export async function sendMail(m: OutgoingMail): Promise<string> {
  if (m.to.length === 0) failWithToast('받는 사람을 골라 주세요.');
  const id = newId();
  const { inbox, sent } = mailDocs(m, serverTimestamp(), Timestamp.fromMillis(mailExpireAt(Date.now())));
  const b = writeBatch(db);
  for (const uid of m.to) b.set(doc(db, 'v5Mail', uid, 'mailIn', id), inbox);
  b.set(doc(db, 'v5Mail', m.from, 'mailSent', id), sent);
  const done = beginPendingWrite();
  try {
    await b.commit();
  } catch (e) {
    failWithToast(
      (e as { code?: string })?.code === 'permission-denied'
        ? '쪽지를 보내지 못했습니다. 그룹을 나간 사람이 있거나 내가 그 그룹 구성원이 아닙니다.'
        : '쪽지를 보내지 못했습니다.',
      e,
    );
  } finally {
    done();
  }
  return id;
}

export interface MailPage<T> {
  items: T[];
  /** 다음 쪽을 받을 자리 (더 없으면 null) */
  cursor: QueryDocumentSnapshot | null;
  /** 끊긴 채 받아 서버 것이 아니다 */
  offline: boolean;
}

async function loadPage<T>(uid: string, box: MailBox, after: QueryDocumentSnapshot | null, read: (id: string, d: Record<string, unknown>) => T): Promise<MailPage<T>> {
  const parts = [orderBy('at', 'desc'), ...(after ? [startAfter(after)] : []), limit(MAIL_PAGE)];
  const snap = await getDocs(query(boxOf(uid, box), ...parts));
  return {
    items: snap.docs.map((d) => read(d.id, d.data())),
    cursor: snap.size === MAIL_PAGE ? snap.docs[snap.size - 1] : null,
    offline: snap.metadata.fromCache,
  };
}

/** 받은 쪽지 - 최근 것부터 30개씩 */
export const loadInbox = (uid: string, after: QueryDocumentSnapshot | null = null) => loadPage<MailIn>(uid, 'in', after, readMailIn);
/** 보낸 쪽지 - 최근 것부터 30개씩 */
export const loadSent = (uid: string, after: QueryDocumentSnapshot | null = null) => loadPage<MailSent>(uid, 'sent', after, readMailSent);

/** 읽음 표시 (펼쳤을 때) - 실패해도 다음에 펼치면 다시 적는다 */
export async function markRead(uid: string, id: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'v5Mail', uid, 'mailIn', id), { readAt: serverTimestamp() });
  } catch (e) {
    console.warn('[mail] 읽음 표시를 적지 못했습니다.', e);
  }
}

/** 내 목록에서 지우기 (진짜 지우기 - 되돌리기 안내는 화면이 지우기 전에 띄운다). 실패는 안내하고 false */
export async function deleteMail(uid: string, box: MailBox, id: string): Promise<boolean> {
  const done = beginPendingWrite();
  try {
    await deleteDoc(doc(db, 'v5Mail', uid, BOX[box], id));
    return true;
  } catch (e) {
    showErrorToast('쪽지를 지우지 못했습니다.', e);
    return false;
  } finally {
    done();
  }
}

/**
 * 안 읽은 받은 쪽지를 듣는다 → store(머리줄 수). onNew = 앱을 연 뒤 새로 온 것(처음 받은 것·끊긴 채 받은 것은 빼고).
 * 돌려준 함수로 끊으면 store를 비운다(로그아웃·계정 바뀜).
 */
export function watchUnread(uid: string, onNew?: (m: MailIn) => void): () => void {
  let primed = false;
  const stop = onSnapshot(
    query(boxOf(uid, 'in'), where('readAt', '==', null), limit(UNREAD_MAX)),
    // 메모리에 있던 것과 서버 것이 같으면 '서버에서 확인됨'만 바뀐다 - 그것도 받아야 ready가 선다(P15-1 ■2 자료 시험)
    { includeMetadataChanges: true },
    (snap) => {
      useMailStore.setState({ unread: snap.size, ready: !snap.metadata.fromCache });
      if (primed && onNew) for (const ch of snap.docChanges()) if (ch.type === 'added') onNew(readMailIn(ch.doc.id, ch.doc.data()));
      if (!snap.metadata.fromCache) primed = true;
    },
    (e) => console.warn('[mail] 안 읽은 쪽지를 받지 못했습니다.', e),
  );
  return () => {
    stop();
    useMailStore.setState({ unread: 0, ready: false });
  };
}

/** Shell에 하나 - 로그인한 동안 안 읽은 쪽지 (새 창 PopoutShell은 하지 않는다 - 두 번 읽지 않게) */
export function useMailWatch(onNew?: (m: MailIn) => void): void {
  const uid = useSession((s) => s.user?.uid);
  const latest = useRef(onNew);
  useEffect(() => {
    latest.current = onNew;
  }, [onNew]);
  useEffect(() => (uid ? watchUnread(uid, (m) => latest.current?.(m)) : undefined), [uid]);
}
