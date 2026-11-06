// 로그인한 사람이 바뀌면(로그아웃 포함) 앞 사람 것을 이 탭 메모리에서 비운다 - 공용 PC (P22-4).
// 로그아웃 단추를 누른 탭만이 아니라 다른 탭도 세션이 바뀌면 여기를 지난다. 없던 사람이 들어올 때는 건드리지 않는다 - 막 받은 구글 토큰이 지워진다.
import { useWindows } from '../../app/windows';
import { forgetGoogleToken } from '../../data/google/token';
import { useSession } from '../../data/session';
import { useRosterDraft } from '../class/rosterDraft';

/** main에서 한 번 */
export function watchAccountChange(): () => void {
  return useSession.subscribe((s, prev) => {
    const left = prev.user?.uid;
    if (!left || left === s.user?.uid) return;
    forgetGoogleToken();
    useRosterDraft.setState({ drafts: null, index: 0 });
    useWindows.setState({ windows: [] });
  });
}
