// 구글 캘린더 겹쳐 보기 - 받기 (P36-3 · P55-1 첫 화면 JS - overlayAuto가 고른 캘린더가 있을 때만 받아 부른다).
//   받는 일은 data/gcalOverlay - 이 몫과 함께 고르는 셈(gcalShownCalc)도 와 화면이 그린다.
import './gcalShownCalc';
import { ensureGcalMonths, pruneGcalCalendars } from '../../data/gcalOverlay';

/**
 * 고른 캘린더 ids의 그 달들을 맞추고, 탭이 다시 보일 때마다 또 (15분이 지난 달만 - data/gcalOverlay).
 * 다른 기기에서 뺀 캘린더 것은 먼저 지운다. 끝내면 돌려준 함수를 부른다.
 */
export function runOverlay(uid: string, ids: readonly string[], months: readonly string[]): () => void {
  void pruneGcalCalendars(uid, ids);
  if (!ids.length || !months.length) return () => {};
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
}
