// 새 창으로 옮긴 창의 껍데기 (10-28 사용자 요청 - ui/popout). 화면·머리줄 없이 그 창 하나만 창 가득 그린다.
//   - 그 창을 닫으면(✕·닫기·저장 뒤 닫히는 창) 새 창도 닫힌다. 그 안에서 연 다른 창(링크 연결·라벨 관리 …)은 가운데에 뜬다.
//   - 키: Ctrl+S는 칸이 받는다(ui/useSaveKey), ESC = 모두 닫기(저장 안 한 글은 먼저 묻는다), 되돌리기·보고 있는 칸 닫기·체크리스트.
//   - 브라우저 ✕로 닫을 때 저장 안 한 글·서버가 아직 받지 않은 저장이 있으면 브라우저가 묻는다(쓰던 글은 보관에도 남는다 - data/drafts).
//   - 큰 창(Shell)의 일 가운데 쓰기에 따라오는 것만 여기서도 한다: 구글 캘린더 보내기(저장한 일정)·Claude 요청 표시.
//     알림·이월 표시·자동 백업·휴지통 비우기는 큰 창이 한다(두 번 하지 않게).
import { useEffect, useState } from 'react';
import GoogleLoginPrompt from '../features/auth/GoogleLoginPrompt';
import { useGcalAuto } from '../features/gcal/auto';
import { useClaudeRequestsWatch } from '../data/claudeRequests';
import type { ShortcutId } from '../domain/shortcuts';
import ImageViewer from '../ui/ImageViewer';
import { setPopoutRoot, type PopoutSpec } from '../ui/popout';
import { handleAppKeyDown } from './keys';
import PendingWritesBanner from './PendingWritesBanner';
import { usePendingWritesGuard } from './pendingWritesGuard';
import WindowHost from './WindowHost';
import './windowList';
import { anyWindowUnsaved, getWindowDef, openWindow, useWindows } from './windows';

const POPOUT_KEYS: ReadonlySet<ShortcutId> = new Set<ShortcutId>(['undo', 'closePanel', 'checklist']);

export default function PopoutShell({ spec }: { spec: PopoutSpec }) {
  const def = getWindowDef(spec.id);
  const [root, setRoot] = useState<number | null>(null);
  const rootOpen = useWindows((s) => root !== null && s.windows.some((w) => w.key === root));

  useEffect(() => {
    if (!getWindowDef(spec.id)) return;
    // 같은 창이 이미 열려 있으면(개발 StrictMode가 두 번 부른다) 그 창의 key가 온다
    const key = openWindow(spec.id, spec.params);
    setPopoutRoot(key);
    // 창의 key는 창 목록(바깥)이 연 그때 정한다
    // oxlint-disable-next-line react/set-state-in-effect
    setRoot(key);
  }, [spec]);

  // 그 창이 닫히면 새 창도
  useEffect(() => {
    if (root !== null && !rootOpen) window.close();
  }, [root, rootOpen]);

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
