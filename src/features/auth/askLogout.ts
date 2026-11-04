// 로그아웃 단추 (P22-2). 로그아웃은 공용 PC를 위해 이 기기의 사본·쓰던 글 보관을 지운다 - 그래서 저장 안 한 칸·서버가 아직 받지 않은
// 저장·쓰던 글 보관이 있으면 말없이 사라졌다. 사라질 것이 있으면 먼저 묻는다.
import { anyWindowUnsaved } from '../../app/windows';
import { listDrafts } from '../../data/drafts';
import { usePendingWrites } from '../../data/pendingWrites';
import { useSession } from '../../data/session';
import { logout } from './login';

/** 로그아웃하면 이 기기에서 사라지는 것 (화면에 보일 글) */
export function logoutLosses({ unsaved, pending, drafts }: { unsaved: boolean; pending: number; drafts: number }): string[] {
  return [
    ...(unsaved ? ['저장하지 않은 칸'] : []),
    ...(pending > 0 ? [`서버에 아직 올라가지 않은 저장 ${pending}개`] : []),
    ...(drafts > 0 ? [`쓰던 글 보관 ${drafts}개`] : []),
  ];
}

/** 사라질 것이 있으면 묻고 로그아웃한다. 보관을 읽지 못해도 로그아웃을 막지 않는다 */
export async function askLogout() {
  const uid = useSession.getState().user?.uid;
  const drafts = uid ? await listDrafts(uid).catch(() => []) : [];
  const losses = logoutLosses({ unsaved: anyWindowUnsaved(), pending: usePendingWrites.getState().count, drafts: drafts.length });
  if (losses.length > 0 && !window.confirm(`로그아웃하면 이 기기에서 아래가 사라집니다.\n\n${losses.map((l) => `· ${l}`).join('\n')}\n\n그래도 로그아웃할까요?`)) return;
  await logout();
}
