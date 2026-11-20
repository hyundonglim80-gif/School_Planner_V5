// '구글 로그인이 필요합니다' 창의 문 (V4 components/GoogleLoginPrompt.tsx · P49-3 나눔). Shell·새 창(PopoutShell)에 하나 -
//   늘 하는 일은 '창을 띄울 곳이 있다'를 알리는 것(registerGoogleLoginHost - 없으면 data/google/token이 묻지 않고 실패로 답한다)뿐이고,
//   창(GoogleLoginWindow)은 묻는 동안만 받아 그린다 - 첫 화면 JS에 실리지 않게. 끊겨서 창을 받지 못하면 안내하고 실패로 답한다.
import { Suspense, useEffect } from 'react';
import { lazyWithReload } from '../../app/lazyWithReload';
import { OfflineInlineWindow } from '../../app/OfflineChunk';
import { finishGoogleLogin, registerGoogleLoginHost, useGoogleLoginPrompt } from '../../data/google/prompt';

const GoogleLoginWindow = lazyWithReload(
  () => import('./GoogleLoginWindow'),
  () => <OfflineInlineWindow onClose={() => finishGoogleLogin(null)} />,
);

export default function GoogleLoginPrompt() {
  const open = useGoogleLoginPrompt((s) => s.open);
  useEffect(() => registerGoogleLoginHost(), []);
  if (!open) return null;
  return (
    <Suspense fallback={null}>
      <GoogleLoginWindow />
    </Suspense>
  );
}
