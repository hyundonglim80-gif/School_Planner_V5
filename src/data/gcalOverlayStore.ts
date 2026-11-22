// 구글 캘린더 겹쳐 보기 - 받은 것을 담는 store (P55-1 첫 화면 JS - data/gcalOverlay에서 뗐다, 그쪽이 그대로 다시 내보낸다).
//   화면(features/gcal/gcalView)은 늘 이 store를 읽는다 - 받기·IndexedDB(data/gcalOverlay)는 고른 캘린더가 있을 때만 받는다(overlayAuto).
//   그래서 store가 차 있으면 받는 몫도 이미 받은 것이다.
import { create } from 'zustand';
import { deleteDB } from 'idb';
import type { OverlayEvent } from '../domain/gcalOverlay';

export const gcalDbName = (uid: string) => `sp5-gcal-${uid}`;

export interface MonthCache {
  events: OverlayEvent[];
  /** 끝까지 받은 때(ms) */
  at: number;
}

export interface GcalOverlayState {
  /** 지금 담고 있는 계정 (다른 계정이 들어오면 비운다) */
  uid: string;
  /** 이 기기 사본을 읽었나 */
  loaded: boolean;
  /** '<캘린더 id>|YYYY-MM' → 받은 것 */
  rows: Record<string, MonthCache>;
  /** 묻는 중인 수 */
  fetching: number;
  /** 로그인이 끊겨 받지 못했다 - '🔄 다시 받기' */
  needsLogin: boolean;
  /** 구글이 찾지 못한(지웠거나 구독을 푼) 캘린더 */
  missing: Record<string, true>;
  /** 마지막 실패 (끊김 등 - 받은 것은 그대로) */
  error: string;
  /** 마지막으로 끝까지 받은 때 (0 = 없음) */
  lastAt: number;
}

export const blankGcalOverlay = (uid = ''): GcalOverlayState => ({ uid, loaded: false, rows: {}, fetching: 0, needsLogin: false, missing: {}, error: '', lastAt: 0 });

export const useGcalOverlay = create<GcalOverlayState>(() => blankGcalOverlay());

/** 받는 몫(data/gcalOverlay)을 받았으면 그 지우기 - 연 DB를 닫고 지운다 */
let loadedWipe: ((uid: string) => Promise<void>) | null = null;
export const setGcalWipe = (wipe: (uid: string) => Promise<void>) => {
  loadedWipe = wipe;
};

/**
 * 이 계정의 받은 것을 통째로 지운다 - 로그아웃(공용 PC)·고른 캘린더가 하나도 없을 때(다른 기기에서 모두 뺐다).
 * 받는 몫을 받지 않은 탭은 이름으로 지운다(이 탭은 열지 않았다 - 다른 탭이 열어 두었으면 그 탭이 비켜 준다). 없는 DB를 지워도 된다.
 */
export async function wipeGcalCache(uid: string): Promise<void> {
  if (loadedWipe) return loadedWipe(uid);
  try {
    await deleteDB(gcalDbName(uid));
  } catch (e) {
    // IndexedDB가 없거나 막힘 - 담은 것도 없다
    console.warn('[gcalOverlay] 받은 구글 일정을 지우지 못했습니다.', e);
  }
}
