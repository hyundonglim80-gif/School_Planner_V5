// 그리기 오류 안내 (P14-2). 앱 바깥에 하나 - 화면 어디서 그리기가 깨져도 흰 화면 대신 안내와 [새로고침]을 보인다.
// 개발자에게 알리기는 여기서 하지 않는다 - main.tsx createRoot의 onCaughtError가 이 경계가 잡은 오류를 받는다(data/errorReport).
import { Component, type ReactNode } from 'react';

interface State {
  failed: boolean;
}

export default class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div data-app-crashed className="min-h-dvh flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-sm w-full bg-white rounded-2xl shadow-sm border border-slate-200 p-6 text-center">
          <p className="text-3xl mb-2">😥</p>
          <h1 className="text-base font-black text-slate-800">화면을 그리다 문제가 생겼습니다</h1>
          <p className="text-xs text-slate-500 mt-2 leading-relaxed">
            적어 둔 자료는 서버에 그대로 있습니다. 새로고침해 주세요.
            <br />
            오류 문장은 글 내용 없이 개발자에게 전해집니다.
          </p>
          <button
            type="button"
            data-app-reload
            onClick={() => window.location.reload()}
            className="mt-4 px-5 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl text-sm font-bold cursor-pointer"
          >
            새로고침
          </button>
          <p className="text-[10px] text-slate-300 mt-3">판 {__BUILD_ID__}</p>
        </div>
      </div>
    );
  }
}
