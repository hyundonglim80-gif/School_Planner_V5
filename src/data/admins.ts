// 관리자 계정 읽기·고치기 (P33-1 - 목록 모양·셈은 domain/admins). 서버 `admin/admins` { emails, updatedAt, updatedBy } - 규칙이 관리자만 읽고 쓰게 한다.
//   - 기본 셋은 곧바로 관리자(서버를 보지 않는다). 그 밖의 계정은 로그인한 동안 한 번 목록을 읽어 본다 - 막히면(관리자가 아니면 규칙이 막는다) 관리자가 아니다.
//     그 막힘은 그냥 '아님'이다(오류 보고·안내 없음). 더한 계정은 다음에 앱을 열 때부터 관리자 탭이 보인다.
//   - 더하기·빼기는 트랜잭션으로 읽고 고쳐 쓴다(두 관리자가 함께 고쳐도 한쪽이 지워지지 않게).
import { doc, getDoc, runTransaction } from 'firebase/firestore';
import { useEffect } from 'react';
import { create } from 'zustand';
import { isAdminEmail, isBaseAdmin, readAdminEmails } from '../domain/admins';
import { db } from './firebase';
import { useSession } from './session';

const adminsRef = () => doc(db, 'admin', 'admins');

interface AdminState {
  /** 이 메일로 확인했다 (다른 계정으로 바뀌면 다시) */
  email: string;
  /** 서버 목록에 있나 - null = 아직 모름 */
  listed: boolean | null;
}

const useAdminState = create<AdminState>(() => ({ email: '', listed: null }));
let checking: { email: string; done: Promise<void> } | null = null;

/** 목록 읽기 - 관리자가 아니면 규칙이 막아 던진다 */
export async function loadAdmins(): Promise<string[]> {
  const snap = await getDoc(adminsRef());
  return snap.exists() ? readAdminEmails(snap.data()) : [];
}

/** 지금 계정이 목록에 있나를 한 번 본다 (같은 계정이면 다시 읽지 않는다) */
function checkListed(email: string): Promise<void> {
  if (checking?.email === email) return checking.done;
  useAdminState.setState({ email, listed: null });
  const done = loadAdmins()
    .then((list) => isAdminEmail(email, list))
    .catch(() => false)
    .then((listed) => {
      if (useAdminState.getState().email === email) useAdminState.setState({ listed });
    });
  checking = { email, done };
  return done;
}

/** 지금 로그인한 계정이 관리자인가 (기본 셋은 곧바로, 그 밖은 목록을 읽은 뒤 - 읽기 전에는 false) */
export function useIsAdmin(): boolean {
  const email = useSession((s) => s.user?.email ?? '');
  const base = isBaseAdmin(email);
  const listed = useAdminState((s) => (s.email === email ? s.listed : null));
  useEffect(() => {
    if (email && !base) void checkListed(email);
  }, [email, base]);
  return base || listed === true;
}

/** 목록을 고쳐 쓴다 - 서버의 지금 목록에 change를 입혀서. 고친 목록을 돌려준다 */
export async function updateAdmins(change: (list: string[]) => string[]): Promise<string[]> {
  const me = useSession.getState().user?.email ?? '';
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(adminsRef());
    const next = change(snap.exists() ? readAdminEmails(snap.data()) : []);
    tx.set(adminsRef(), { emails: next, updatedAt: Date.now(), updatedBy: me });
    return next;
  }).then((next) => {
    // 나를 뺐으면 이 창에서도 곧바로 관리자가 아니다(기본 셋은 그대로)
    const st = useAdminState.getState();
    if (st.email === me) useAdminState.setState({ listed: isAdminEmail(me, next) });
    return next;
  });
}

/** 시험용 - 확인한 것을 잊는다 */
export function forgetAdminCheck() {
  checking = null;
  useAdminState.setState({ email: '', listed: null });
}
