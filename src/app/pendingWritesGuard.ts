// 서버가 아직 받지 않은 저장이 있는데 탭·창을 닫으면 브라우저가 묻는다 (P14-6 ■1 - data/pendingWrites).
// 큰 창(Shell)은 기다리는 저장만 묻는다 - 저장 안 한 칸은 쓰던 글 보관(data/drafts)이 남긴다. 새 창(PopoutShell)은 저장 안 한 칸도.
import { useEffect, useRef } from 'react';
import { hasPendingWrites } from '../data/pendingWrites';

/** 기다리는 저장이 있는데 탭·창을 닫으면(새로고침 포함) 브라우저가 묻는다. more = 그 밖에 물을 것(새 창 - 저장 안 한 칸) */
export function usePendingWritesGuard(more?: () => boolean) {
  const moreRef = useRef(more);
  useEffect(() => {
    moreRef.current = more;
  });
  useEffect(() => {
    const onLeave = (e: BeforeUnloadEvent) => {
      if (!hasPendingWrites() && !moreRef.current?.()) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onLeave);
    return () => window.removeEventListener('beforeunload', onLeave);
  }, []);
}
