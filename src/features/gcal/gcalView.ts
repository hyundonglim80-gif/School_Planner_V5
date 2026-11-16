// 구글 캘린더 겹쳐 그리기 - 화면이 쓰는 것 (P36-4 - PLAN 5장 'P36-4 구글 캘린더 겹쳐 그리기 ■0 정한 것').
//   - 켜고 끄기 = 이 기기에(sp5-gcal-view, 기본 켬 - 겹친 공간 기억(P17)과 같다). 둘째 줄 토글 '📅 구글'(GcalToggle).
//   - 인쇄 창은 그리지 않는다(GcalOffContext - 받은 범위가 인쇄 범위와 달라 빠진 달이 생기고, 학급 게시용 인쇄에 남의 캘린더가 섞이지 않게).
//   - useGcalShown(first, last) = 그 날들에 보이는 구글 일정(고른 캘린더 이름·색을 붙여) - 받은 것은 data/gcalOverlay(이 기기 IndexedDB).
import { createContext, useContext, useMemo } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useCommonSettings } from '../../app/prefs';
import { overlayBetween } from '../../domain/gcalOverlay';
import { gcalShownList, type GcalShown } from '../../domain/gcalShow';
import { useGcalOverlay, type MonthCache } from '../../data/gcalOverlay';
import { useSession } from '../../data/session';

export const useGcalView = create<{ on: boolean }>()(persist((): { on: boolean } => ({ on: true }), { name: 'sp5-gcal-view' }));

export const setGcalShown = (on: boolean) => useGcalView.setState({ on });

/** true = 이 안에서는 구글 일정을 그리지 않는다 (인쇄 창) */
export const GcalOffContext = createContext(false);

const NONE: readonly GcalShown[] = [];
const NO_ROWS: Record<string, MonthCache> = {};

/** 고른 구글 캘린더가 있나 (둘째 줄 토글을 세울지) */
export const useGcalPicked = () => useCommonSettings((s) => s.gcalOverlay.length > 0);

/** first~last(둘 다 그날 포함)에 보이는 구글 일정 - 끄거나·인쇄 창이거나·고른 캘린더가 없으면 빈 목록(늘 같은 배열) */
export function useGcalShown(first: string, last: string): readonly GcalShown[] {
  const off = useContext(GcalOffContext);
  const on = useGcalView((s) => s.on);
  const uid = useSession((s) => s.user?.uid ?? '');
  const picks = useCommonSettings((s) => s.gcalOverlay);
  // 다른 계정이 담겨 있던 것은 보이지 않는다 (계정을 바꾼 바로 뒤)
  const rows = useGcalOverlay((s) => (uid && s.uid === uid ? s.rows : NO_ROWS));
  return useMemo(() => {
    if (off || !on || !picks.length || rows === NO_ROWS || !first || !last) return NONE;
    const list = gcalShownList(
      overlayBetween(
        rows,
        picks.map((c) => c.id),
        first,
        last,
      ),
      picks,
    );
    return list.length ? list : NONE;
  }, [off, on, picks, rows, first, last]);
}
