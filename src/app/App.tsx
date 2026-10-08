// 앱 껍데기. P1-3에서 화면 탭·주소·창 목록·오른쪽 칸을 여기에 세운다(DESIGN 7장).
import { useSession } from '../data/session';
import LoginScreen from '../features/auth/LoginScreen';

export default function App() {
  const loading = useSession((s) => s.loading);
  const user = useSession((s) => s.user);

  return (
    <>
      {loading ? (
        <p data-session="loading" className="p-6 text-slate-400">
          불러오는 중…
        </p>
      ) : !user ? (
        <LoginScreen />
      ) : (
        <div data-session="signed-in" className="min-h-screen bg-bg-body p-6 text-slate-800">
          <h1 className="text-2xl font-black text-primary">SP5</h1>
          <p className="mt-2 text-sm text-slate-500">{user.email}</p>
        </div>
      )}
      {/* 어느 빌드가 돌고 있는지 화면에서 본다(V4 규칙). */}
      <p data-build-id className="pointer-events-none fixed bottom-1 right-2 text-[10px] text-slate-400">
        빌드 {__BUILD_ID__}
      </p>
    </>
  );
}
