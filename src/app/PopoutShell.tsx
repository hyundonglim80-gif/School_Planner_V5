// 새 창으로 옮긴 창·팝업창의 껍데기 (10-28 사용자 요청 - ui/popout, 11-09 창 위치 '팝업창' - app/popupWindows). 화면·머리줄 없이 그 창 하나만 창 가득 그린다.
//   - 팝업창에서 화면을 옮기는 일(검색 결과·그날로 가기)은 연 창(큰 창)이 한다 · 자리·크기는 창마다 이 기기에 남긴다.
//   - 그 창을 닫으면(✕·닫기·저장 뒤 닫히는 창) 새 창도 닫힌다. 그 안에서 연 다른 창(링크 연결·라벨 관리 …)은 가운데에 뜬다.
//   - 키: Ctrl+S는 칸이 받는다(ui/useSaveKey), ESC = 모두 닫기(저장 안 한 글은 먼저 묻는다), 되돌리기·보고 있는 칸 닫기·체크리스트·글자 크기(팝업창 줄 - #145).
//   - 브라우저 ✕로 닫을 때 저장 안 한 글·서버가 아직 받지 않은 저장이 있으면 브라우저가 묻는다(쓰던 글은 보관에도 남는다 - data/drafts).
//   - 큰 창(Shell)의 일 가운데 쓰기에 따라오는 것만 여기서도 한다: 구글 캘린더 보내기(저장한 일정)·Claude 요청 표시.
//     알림·이월 표시·자동 백업·휴지통 비우기는 큰 창이 한다(두 번 하지 않게).
import { useCallback, useEffect, useState } from 'react';
import GoogleLoginPrompt from '../features/auth/GoogleLoginPrompt';
import { useGcalAuto } from '../features/gcal/auto';
import { useClaudeRequestsWatch } from '../data/claudeRequests';
import { useClipboardCapture } from '../features/clipboard/capture';
import ImageViewer from '../ui/ImageViewer';
import { setPopoutRoot, type PopoutSpec } from '../ui/popout';
import { handleAppKeyDown, POPOUT_KEYS } from './keys';
import PendingWritesBanner from './PendingWritesBanner';
import { usePendingWritesGuard } from './pendingWritesGuard';
import WindowHost from './WindowHost';
import { useNav } from './nav';
import { rememberPopupRect, sendNavToOpener, sendParamsToOpener, usePopupBridge } from './popupWindows';
import { pressInThisWindow } from './pressShortcuts';
import './windowList';
import { anyWindowUnsaved, getWindowDef, openWindow, useWindows } from './windows';

export default function PopoutShell({ spec }: { spec: PopoutSpec }) {
  const def = getWindowDef(spec.id);
  const [root, setRoot] = useState<number | null>(null);
  const rootOpen = useWindows((s) => root !== null && s.windows.some((w) => w.key === root));

  useEffect(() => {
    if (!getWindowDef(spec.id)) return;
    // 같은 창이 이미 열려 있으면(개발 StrictMode가 두 번 부른다) 그 창의 key가 온다
    const key = openWindow(spec.id, spec.params, { here: true });
    setPopoutRoot(key);
    // 창의 key는 창 목록(바깥)이 연 그때 정한다
    // oxlint-disable-next-line react/set-state-in-effect
    setRoot(key);
  }, [spec]);

  // 그 창이 닫히면 새 창도
  useEffect(() => {
    if (root !== null && !rootOpen) window.close();
  }, [root, rootOpen]);

  // 그린 창이 가리키는 것이 바뀌면(새 메모 저장) 연 창에 알린다 - 그 메모를 다시 열면 이 팝업창을 앞으로
  const rootParams = useWindows((s) => s.windows.find((w) => w.key === root)?.params);
  useEffect(() => {
    if (root !== null) sendParamsToOpener(spec.id, rootParams);
  }, [root, rootParams, spec.id]);

  // 연 창이 같은 창을 다시 열면 여기서(그 창을 앞으로 · 가리키는 것을 바꾼다)
  // 큰 창의 단추 대신 누르기 키(P28-3)가 이 창 안의 단추를 눌러 달라고 하면 여기서 누른다
  usePopupBridge(useCallback((id: string, params: unknown) => void openWindow(id, params, { here: true }), []), undefined, pressInThisWindow);
  useEffect(() => rememberPopupRect(spec.id), [spec.id]);
  // 화면 옮기기는 연 창으로 (이 창에는 화면이 없다)
  useEffect(
    () =>
      useNav.subscribe((s, prev) => {
        if (s.scope !== prev.scope || s.date !== prev.date || s.classId !== prev.classId) sendNavToOpener({ scope: s.scope, date: s.date, classId: s.classId });
      }),
    [],
  );

  useEffect(() => {
    document.title = def ? `${def.icon} ${def.title} - SP5` : 'SP5';
  }, [def]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => handleAppKeyDown(e, POPOUT_KEYS);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  // 저장 안 한 칸 · 서버가 아직 받지 않은 저장(P14-6 ■1)이 있으면 브라우저 ✕ 전에 묻는다
  usePendingWritesGuard(anyWindowUnsaved);

  useGcalAuto();
  useClaudeRequestsWatch();
  // 복사한 것 모으기 · 클립보드 팝업창에서 누른 항목을 이 창의 글 칸에 받기 (#140)
  useClipboardCapture('popout');

  if (!def) {
    return (
      <div data-popout-missing className="min-h-screen bg-bg-body p-6 text-sm text-slate-500">
        이 창을 열 수 없습니다. 창을 닫고 오른쪽 칸에서 다시 옮겨 주세요.
      </div>
    );
  }
  return (
    <div data-popout={spec.id} className="min-h-screen bg-bg-body text-slate-900">
      {/* 📴 끊겨 저장을 기다림 (P14-6 ■1) - 창 위에 */}
      <PendingWritesBanner floating />
      <WindowHost />
      {/* 드라이브·캘린더를 쓰다 구글 로그인이 만료됐을 때 · 그림 크게 보기 */}
      <GoogleLoginPrompt />
      <ImageViewer />
    </div>
  );
}
