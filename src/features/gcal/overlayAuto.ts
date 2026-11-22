// 구글 캘린더 겹쳐 보기 - 저절로 받기 (P36-3, Shell에 하나). 받는 일은 data/gcalOverlay(overlayRun), 고르기는 GcalOverlaySection.
//   보는 화면이 쓰는 달(domain/gcalOverlayPick neededMonths - ±1달, 년간 = 학년도)을 화면·날짜를 바꿀 때·탭이 다시 보일 때 맞춘다.
//   15분이 지난 달만, 조용한 토큰이 있을 때만 묻는다 - 로그인 창을 띄우지 않는다(끊기면 받은 것 그대로 + 고르기 칸 '🔄 다시 받기').
//   계정 설정을 서버에서 받은 뒤에만 돈다 - 새 기기의 빈 기본값([])으로 받은 것을 지우지 않게.
//   첫 화면 JS(P55-1): 받는 몫(overlayRun - 받기·IndexedDB·고르는 셈)은 고른 캘린더가 있을 때만 받는다.
//   고른 캘린더가 없으면(처음부터·다른 기기에서 모두 뺐다) 이 기기에 받아 둔 것을 지운다 - 이 탭에서 계정마다 한 번(날짜를 옮길 때마다 지우지 않게).
import { useEffect } from 'react';
import { useCommonLoaded, useCommonSettings } from '../../app/prefs';
import { useNav } from '../../app/nav';
import { neededMonths } from '../../domain/gcalOverlayPick';
import { useGcalOverlay, wipeGcalCache } from '../../data/gcalOverlayStore';
import { useSession } from '../../data/session';

/** 고른 캘린더가 없어 이 탭에서 받아 둔 것을 지운 계정 */
const wiped = new Set<string>();

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
    if (!ids.length) {
      // 받은 것이 담겨 있거나(그새 모두 뺐다) 이 탭에서 아직 안 지웠으면
      if (useGcalOverlay.getState().uid === uid || !wiped.has(uid)) {
        wiped.add(uid);
        void wipeGcalCache(uid);
      }
      return;
    }
    wiped.delete(uid);
    let gone = false;
    let stop: (() => void) | undefined;
    import('./overlayRun').then(
      (m) => {
        if (!gone) stop = m.runOverlay(uid, ids, monthKey ? monthKey.split(',') : []);
      },
      (e: unknown) => console.warn('[gcalOverlay] 겹쳐 볼 구글 캘린더 몫을 받지 못했습니다.', e),
    );
    return () => {
      gone = true;
      stop?.();
    };
  }, [uid, loaded, calKey, monthKey]);
}
