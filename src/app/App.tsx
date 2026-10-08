// 앱 맨 위: 로그인 상태에 따라 불러오는 중 / 로그인 화면 / 껍데기(Shell - 머리줄·화면·창).
import { useSession } from '../data/session';
import { useMirrorSync } from '../data/mirror/sync';
import LoginScreen from '../features/auth/LoginScreen';
import Shell from './Shell';
import { usePrefsSync } from './prefs';

export default function App() {
  const loading = useSession((s) => s.loading);
  const user = useSession((s) => s.user);
  // 로그인한 동안 설정(글자 크기·단축키 …)을 계정과 맞춘다
  usePrefsSync(user?.uid);
  // 로그인한 동안 기기 사본(일정·메모·기록·라벨 …)을 서버와 맞춘다 - 화면은 data/select로 고른다
  useMirrorSync(user?.uid);

  return (
    <>
      {loading ? (
        <p data-session="loading" className="p-6 text-slate-400">
          불러오는 중…
        </p>
      ) : !user ? (
        <LoginScreen />
      ) : (
        <div data-session="signed-in" data-user={user.email}>
          <Shell />
        </div>
      )}
      {/* 어느 빌드가 돌고 있는지 화면에서 본다(V4 규칙). */}
      <p data-build-id className="pointer-events-none fixed bottom-1 right-2 text-[10px] text-slate-400">
        빌드 {__BUILD_ID__}
      </p>
    </>
  );
}
