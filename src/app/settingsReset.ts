// 초기화 값 받기 (P33-2): 로그인한 동안 내 settings/reset을 듣고, 이 기기 종류가 '초기화'로 갈 값을 app/resetTargets에 채운다.
//   겹치기 = 내 것 → 관리자 것(P33-3이 admin을 채운다) → 앱 기본 (domain/settingsSnapshot resolveResetValues).
//   로그아웃하면 비운다(다음 사람이 앞 사람 초기화 값으로 가지 않게).
import { useEffect } from 'react';
import { create } from 'zustand';
import { readSnapshot, resolveResetValues, type Fields, type SettingsSnapshot, type SnapshotSpecs } from '../domain/settingsSnapshot';
import type { SettingsSpec } from '../domain/settings';
import { watchMyReset } from '../data/settingsReset';
import { COMMON_SETTINGS, DEVICE_PREFS, detectDeviceKind } from './prefs';
import { useResetTargets } from './resetTargets';

/** 묶음이 쓰는 칸 표 (기기·계정 칸은 계정 설정 표 그대로) */
export const RESET_SPECS: SnapshotSpecs = {
  device: DEVICE_PREFS as unknown as SettingsSpec<Fields>,
  common: COMMON_SETTINGS as unknown as SettingsSpec<Fields>,
};

interface ResetSnapshots {
  /** 내 초기화 설정 (없으면 null) */
  mine: SettingsSnapshot | null;
  /** 관리자 '새 사용자 기본값' (P33-3) */
  admin: SettingsSnapshot | null;
  /** 내 것을 서버에서 한 번 받았나 */
  loaded: boolean;
}

export const useResetSnapshots = create<ResetSnapshots>(() => ({ mine: null, admin: null, loaded: false }));

// 묶음이 바뀌면 이 기기 종류가 갈 값을 다시 셈한다
useResetSnapshots.subscribe((s, prev) => {
  if (s.mine === prev.mine && s.admin === prev.admin) return;
  useResetTargets.setState({ values: s.mine || s.admin ? resolveResetValues(detectDeviceKind(), RESET_SPECS, s.mine, s.admin) : null });
});

/** 받은 문서 → 내 묶음 */
export function receiveMyReset(data: unknown) {
  useResetSnapshots.setState({ mine: readSnapshot(data, RESET_SPECS), loaded: true });
}

/** 로그인한 동안 내 초기화 설정을 듣는다 */
export function useResetSync(uid: string | undefined) {
  useEffect(() => {
    if (!uid) return;
    const stop = watchMyReset(uid, receiveMyReset);
    return () => {
      stop();
      useResetSnapshots.setState({ mine: null, admin: null, loaded: false });
    };
  }, [uid]);
}
