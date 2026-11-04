// 보기 쉽게 (P20-2) - 고대비·어둡게를 부드럽게는 이 기기에만(교실 TV·밤 - 장소를 따른다), 색약 배려는 계정에 하나(사람을 따른다 - common cvd) + 이 기기 사본.
// 색은 theme.css가 html.hc·html.dim·html.cvd에서 바꾼다. index.html이 그리기 전에 같은 키로 먼저 붙인다 - 키 이름을 바꾸면 거기도.
import { setCommonSetting, useCommonSettings } from './prefs';

export const CONTRAST_KEY = 'sp5_contrast';
export const DIM_KEY = 'sp5_dim';
export const CVD_KEY = 'sp5_cvd';
export const VIEW_AIDS_CHANGED_EVENT = 'sp5-view-aids-changed';

const CLASS_OF: Record<string, string> = { [CONTRAST_KEY]: 'hc', [DIM_KEY]: 'dim', [CVD_KEY]: 'cvd' };

function readOn(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function writeOn(key: string, on: boolean) {
  try {
    if (on) localStorage.setItem(key, '1');
    else localStorage.removeItem(key);
  } catch {
    /* 저장하지 못해도 이번에는 바뀐다 */
  }
}

const paint = (key: string, on: boolean) => document.documentElement.classList.toggle(CLASS_OF[key], on);

function setHere(key: string, on: boolean) {
  writeOn(key, on);
  paint(key, on);
  window.dispatchEvent(new Event(VIEW_AIDS_CHANGED_EVENT));
}

export const readContrast = () => readOn(CONTRAST_KEY);
export const readDim = () => readOn(DIM_KEY);
export const setContrast = (on: boolean) => setHere(CONTRAST_KEY, on);
export const setDim = (on: boolean) => setHere(DIM_KEY, on);
/** 고르기 (환경설정 보기 탭) - 계정 값을 바꾸면 watchViewAids가 입힌다 */
export const setCvd = (on: boolean) => setCommonSetting('cvd', on);

/**
 * 색약 배려는 계정 값을 따른다 - 서버에서 받거나 고르면 이 기기 사본과 화면을 바꾼다.
 * 다른 창(↗ 새 창 - 같은 기기 저장소)이 바꾸면 storage 이벤트로 받아 이 창도 맞춘다.
 */
export function watchViewAids(): () => void {
  paint(CONTRAST_KEY, readContrast());
  paint(DIM_KEY, readDim());
  const applyCvd = (on: boolean) => {
    writeOn(CVD_KEY, on);
    paint(CVD_KEY, on);
  };
  applyCvd(useCommonSettings.getState().cvd);
  const unsub = useCommonSettings.subscribe((s, prev) => {
    if (s.cvd !== prev.cvd) applyCvd(s.cvd);
  });
  const onStorage = (e: StorageEvent) => {
    if (!e.key || !(e.key in CLASS_OF)) return;
    const on = readOn(e.key);
    paint(e.key, on);
    if (e.key === CVD_KEY && useCommonSettings.getState().cvd !== on) setCommonSetting('cvd', on);
    window.dispatchEvent(new Event(VIEW_AIDS_CHANGED_EVENT));
  };
  window.addEventListener('storage', onStorage);
  return () => {
    unsub();
    window.removeEventListener('storage', onStorage);
  };
}
