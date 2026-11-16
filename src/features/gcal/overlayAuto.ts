// 구글 캘린더 겹쳐 보기 - 저절로 받기 (P36-3, Shell에 하나). 받는 일은 data/gcalOverlay, 고르기는 GcalOverlaySection.
//   보는 화면이 쓰는 달(domain/gcalOverlay neededMonths - ±1달, 년간 = 학년도)을 화면·날짜를 바꿀 때·탭이 다시 보일 때 맞춘다.
//   15분이 지난 달만, 조용한 토큰이 있을 때만 묻는다 - 로그인 창을 띄우지 않는다(끊기면 받은 것 그대로 + 고르기 칸 '🔄 다시 받기').
//   계정 설정을 서버에서 받은 뒤에만 돈다 - 새 기기의 빈 기본값([])으로 받은 것을 지우지 않게.
import { useEffect } from 'react';
import { useCommonLoaded, useCommonSettings } from '../../app/prefs';
import { useNav } from '../../app/nav';
import { neededMonths } from '../../domain/gcalOverlay';
import { ensureGcalMonths, pruneGcalCalendars } from '../../data/gcalOverlay';
import { useSession } from '../../data/session';

export function useGcalOverlayAuto() {
  const uid = useSession((s) => s.user?.uid ?? '');
  const loaded = useCommonLoaded((s) => s.loaded);
  const calKey = useCommonSettings((s) => s.gcalOverlay.map((c) => c.id).join('\n'));
  const scope = useNav((s) => s.scope);
  const date = useNav((s) => s.date);
  const monthKey = neededMonths(scope, date).join(',');

  useEffect(() => {
    if (!uid || !loaded) return;
    const ids = calKey ? calKey.split('\n') : [];
    // 다른 기기에서 뺀 캘린더도 이 기기에서 지운다
    void pruneGcalCalendars(uid, ids);
    if (!ids.length || !monthKey) return;
    const months = monthKey.split(',');
    const go = () => void ensureGcalMonths(uid, ids, months);
    go();
    const onShow = () => {
      if (document.visibilityState === 'visible') go();
    };
    document.addEventListener('visibilitychange', onShow);
    window.addEventListener('focus', onShow);
    return () => {
      document.removeEventListener('visibilitychange', onShow);
      window.removeEventListener('focus', onShow);
    };
  }, [uid, loaded, calKey, monthKey]);
}
