import { useGoogleLogin } from './login';

export default function LoginScreen() {
  const { loginWithGoogle, signingIn } = useGoogleLogin();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg-body p-4">
      <div className="rounded-2xl bg-white p-12 text-center shadow-lg">
        <h1 className="mb-3 overflow-hidden whitespace-nowrap text-3xl font-bold text-primary md:text-4xl">SP5</h1>
        <p className="mb-10 text-lg text-slate-500">
          자료를 안전하게 저장하고 여러 기기에서 함께 쓰려면
          <br />
          구글 계정으로 시작해주세요.
        </p>
        {/* 누른 뒤 아무 반응이 없으면 한 번 더 누르게 된다. 진행 중임을 보여 주고 다시 못 누르게 막는다(V4). */}
        <button
          type="button"
          data-login-google
          onClick={loginWithGoogle}
          disabled={signingIn}
          className="mx-auto flex cursor-pointer items-center gap-3 rounded-lg border-none bg-[#4285F4] px-6 py-3 text-lg font-bold text-white shadow-md transition-all hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {signingIn ? '로그인 창을 여는 중...' : 'Google 계정으로 로그인'}
        </button>
        {signingIn && (
          <p className="mt-4 text-sm text-slate-400">구글 로그인 창이 열립니다. 창이 안 보이면 팝업 차단을 확인해 주세요.</p>
        )}
      </div>
    </div>
  );
}
