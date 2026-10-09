// D-Day 쓰기 (V4 hooks/useDDay.ts) - 계정 설정 `settings/common`의 ddays·ddayPick(app/prefs - 1초 뒤 올라간다).
// 지우기 = 지운 표시 + 안내의 되돌리기(휴지통에서도 되살린다 - P5-4). V4처럼 '추가했습니다' 안내.
import { setCommonSetting, useCommonSettings } from '../../app/prefs';
import { showToast } from '../../app/toast';
import { newId } from '../../data/id';
import { UNDO_LABEL, UNDO_TOAST_MS } from '../../data/undo';
import { addDDay, removeDDay, restoreDDay, type DDayState } from '../../domain/dday';

const state = (): DDayState => {
  const s = useCommonSettings.getState();
  return { list: s.ddays, pick: s.ddayPick };
};
const write = (s: DDayState) => {
  setCommonSetting('ddays', s.list);
  setCommonSetting('ddayPick', s.pick);
};

/** 더하기 (처음 것은 곧바로 머리줄에). 글이나 날짜가 비면 false */
export function addDDayItem(title: string, date: string): boolean {
  if (!title.trim() || !date) return false;
  write(addDDay(state(), { id: `dday_${newId()}`, title: title.trim(), date }));
  showToast('✅ D-Day를 추가했습니다.');
  return true;
}

/** 머리줄에 세우기·내리기 (하나만) */
export function pickDDay(id: string | null) {
  setCommonSetting('ddayPick', id);
}

/** 지우기 = 지운 표시 + 되돌리기 */
export function deleteDDayItem(id: string) {
  const before = state();
  write(removeDDay(before, id, Date.now()));
  showToast('🗑️ D-Day를 삭제했습니다. 휴지통에서 복원할 수 있습니다.', UNDO_TOAST_MS, 'info', {
    label: UNDO_LABEL,
    run: () => {
      write(restoreDDay(state(), id, before.pick === id ? id : null));
      showToast('↩️ 되돌렸습니다.');
    },
  });
}
