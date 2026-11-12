// 내 '초기화 설정' 저장·초기화 (P33-2 - 환경설정 앱 탭 '초기화' 절이 부른다).
//   💾 초기화 설정 = 지금 값(기기 칸·계정 칸·이 기기 값)을 모아 내 settings/reset의 이 기기 종류 몫 + 계정 몫에.
//   ↩️ 초기화     = 초기화 값(내 것 → 관리자 → 앱 기본 - app/resetTargets)을 같은 store 함수로 입힌다 → 계정 맞추기가 1초 뒤 올린다.
//   사람마다 다른 자료(학교·교시·D-Day …)와 학기 칩은 묶음에 없어 건드리지 않는다(domain/settingsSnapshot).
import {
  LOCAL_PREFS,
  resolveResetValues,
  saveIntoSnapshot,
  snapshotDoc,
  type CurrentValues,
  type Fields,
  type LocalPrefs,
  type SettingsSnapshot,
} from '../domain/settingsSnapshot';
import { readSettings } from '../domain/settings';
import { saveMyReset } from '../data/settingsReset';
import { applyDevicePrefs, currentDevicePrefs, detectDeviceKind, useCommonSettings, type CommonSettings, type DevicePrefs } from './prefs';
import { RESET_SPECS, useResetSnapshots } from './settingsReset';
import { useResetTargets } from './resetTargets';
import { setBoardSplit, useBoardPrefs } from './boardPrefs';
import { setLeftPanelWidth, setRightPanelWidth, useLayoutPrefs } from './layoutPrefs';
import { readThemeMode, setThemeMode } from './theme';
import { readContrast, readDim, setContrast, setDim } from './viewAids';
import { setHeaderFolded, useHeaderFold } from './headerFold';
import { useMemoView } from '../features/memo/memoView';
import { useMemoSort } from '../features/memo/memoSort';
import { setYearView, useYearView } from '../features/year/prefs';
import { useShowLastYear } from '../features/week/prefs';

/** 지금 이 기기에만 둔 값 */
export function currentLocalPrefs(): LocalPrefs {
  const board = useBoardPrefs.getState();
  const layout = useLayoutPrefs.getState();
  const sort = useMemoSort.getState();
  return {
    boardMain: board.main,
    boardDay: board.day,
    boardMemo: board.memo,
    rightPanelWidth: layout.rightPanelWidth,
    leftPanelWidth: layout.leftPanelWidth,
    theme: readThemeMode(),
    contrast: readContrast(),
    dim: readDim(),
    headerFold: useHeaderFold.getState().folded,
    memoView: useMemoView.getState().view,
    memoSortKey: sort.key,
    memoSortDir: sort.dir,
    yearView: useYearView.getState().view,
    lastYear: useShowLastYear.getState().on,
  };
}

/** 이 기기에만 둔 값을 입힌다 (바뀐 것만) */
function applyLocalPrefs(p: LocalPrefs) {
  const now = currentLocalPrefs();
  if (p.boardMain !== now.boardMain) setBoardSplit('main', p.boardMain);
  if (p.boardDay !== now.boardDay) setBoardSplit('day', p.boardDay);
  if (p.boardMemo !== now.boardMemo) setBoardSplit('memo', p.boardMemo);
  if (p.rightPanelWidth !== now.rightPanelWidth) setRightPanelWidth(p.rightPanelWidth);
  if (p.leftPanelWidth !== now.leftPanelWidth) setLeftPanelWidth(p.leftPanelWidth);
  if (p.theme !== now.theme) setThemeMode(p.theme);
  if (p.contrast !== now.contrast) setContrast(p.contrast);
  if (p.dim !== now.dim) setDim(p.dim);
  if (p.headerFold !== now.headerFold) setHeaderFolded(p.headerFold);
  if (p.memoView !== now.memoView) useMemoView.setState({ view: p.memoView });
  if (p.memoSortKey !== now.memoSortKey || p.memoSortDir !== now.memoSortDir) useMemoSort.setState({ key: p.memoSortKey, dir: p.memoSortDir });
  if (p.yearView !== now.yearView) setYearView(p.yearView);
  if (p.lastYear !== now.lastYear) useShowLastYear.setState({ on: p.lastYear });
}

/** 지금 값 (모든 칸) */
export function collectCurrentValues(): CurrentValues {
  return {
    device: currentDevicePrefs() as unknown as Fields,
    common: useCommonSettings.getState() as unknown as Fields,
    local: currentLocalPrefs(),
  };
}

/** 묶음의 값을 입힌다 - 기기·계정 칸은 묶음에 든 칸만(나머지는 지금 그대로) */
function applyValues(v: { device: Fields; common: Fields; local: LocalPrefs }) {
  applyDevicePrefs({ ...currentDevicePrefs(), ...(v.device as Partial<DevicePrefs>) });
  const now = useCommonSettings.getState() as unknown as Fields;
  const changed = Object.fromEntries(Object.entries(v.common).filter(([k, val]) => JSON.stringify(val) !== JSON.stringify(now[k])));
  if (Object.keys(changed).length > 0) useCommonSettings.setState(changed as Partial<CommonSettings>);
  applyLocalPrefs(readSettings(LOCAL_PREFS, v.local));
}

/** 💾 초기화 설정 - 지금 값을 내 초기화 값으로 (이 기기 종류 몫 + 계정 몫). 만든 묶음을 돌려준다 */
export async function saveMyResetSnapshot(uid: string, at = Date.now()): Promise<SettingsSnapshot> {
  const next = saveIntoSnapshot(useResetSnapshots.getState().mine, detectDeviceKind(), RESET_SPECS, collectCurrentValues(), at);
  await saveMyReset(uid, snapshotDoc(next));
  return next;
}

/**
 * ↩️ 초기화 - 초기화 값(내 것 → 관리자 → 앱 기본)으로. 되돌릴 함수(바꾸기 전 값으로)를 돌려준다.
 * 묶음에 든 칸만 바꾸고(계정 칸 가운데 보기·쓰는 법만) 사람마다 다른 자료는 그대로.
 */
export function resetToInitial(): () => void {
  const before = collectCurrentValues();
  // 받은 묶음이 없으면(로그인 전·받기 전) 앱 기본값 - 묶음에 드는 칸만
  applyValues(useResetTargets.getState().values ?? resolveResetValues(detectDeviceKind(), RESET_SPECS, null, null));
  return () => applyValues(before);
}
