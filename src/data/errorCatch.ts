// 오류 알림 - 늘 듣는 문 (P14-2 · P55-1 첫 화면 JS - data/errorReport에서 뗐다).
//   잡지 못한 오류·약속 거절·CSP 위반·오류를 넘긴 안내(showErrorToast)·React 그리기 오류를 받아 보내는 몫(data/errorReport -
//   무엇을 싣나·몇 번까지·보내기)에 넘긴다. 그 몫은 처음 오류가 났을 때 받는다 - 오류가 없으면 받지 않는다.
//   받는 동안 온 것은 모아 두었다 차례로(20개까지 - 한 번 열린 동안 보내는 것은 어차피 10개까지 domain/errorReport SESSION_MAX).
//   받지 못하면(끊김·새 판으로 조각 이름이 바뀜) 그 오류들은 버린다 - 콘솔에는 원래대로 남는다.
import type { ErrorInfo } from 'react';
import { setErrorToastReporter } from '../app/toast';

type Reporter = typeof import('./errorReport');

const WAIT_MAX = 20;
let reporter: Reporter | null = null;
let waiting: Array<(m: Reporter) => void> | null = null;

function withReporter(job: (m: Reporter) => void) {
  if (reporter) {
    job(reporter);
    return;
  }
  if (waiting) {
    if (waiting.length < WAIT_MAX) waiting.push(job);
    return;
  }
  waiting = [job];
  import('./errorReport').then(
    (m) => {
      reporter = m;
      const jobs = waiting ?? [];
      waiting = null;
      for (const run of jobs) run(m);
    },
    () => {
      waiting = null; // 다음 오류에서 다시 받아 본다
    },
  );
}

let started = false;

/** 앱을 열 때 한 번 (main.tsx - 다른 시작보다 먼저): 잡지 못한 오류·약속 거절·CSP 위반·오류 안내를 알린다 */
export function startErrorReports() {
  if (started) return;
  started = true;
  window.addEventListener('error', (ev) => {
    // 그림·스크립트 파일 읽기 실패(ev.error 없음)는 오류 알림이 아니다
    if (!ev.error && !ev.message) return;
    const err: unknown = ev.error ?? new Error(ev.message);
    const source = ev.filename;
    withReporter((m) => void m.reportError('error', err, { source }));
  });
  window.addEventListener('unhandledrejection', (ev) => {
    const reason: unknown = ev.reason;
    withReporter((m) => void m.reportError('rejection', reason));
  });
  document.addEventListener('securitypolicyviolation', (ev) => {
    // 이벤트는 넘기지 않고 쓸 칸만 (받는 동안 그대로 두게)
    const v = { effectiveDirective: ev.effectiveDirective, blockedURI: ev.blockedURI, sourceFile: ev.sourceFile };
    withReporter((m) => m.reportCspViolation(v));
  });
  setErrorToastReporter((message, error) => withReporter((m) => void m.reportError('toast', error, { toastText: message })));
}

/** React 그리기 오류 (main.tsx createRoot의 onCaughtError·onUncaughtError) */
export function reportReactError(error: unknown, info: Pick<ErrorInfo, 'componentStack'>) {
  const componentStack = info.componentStack ?? undefined;
  withReporter((m) => m.reportReactError(error, { componentStack }));
}
