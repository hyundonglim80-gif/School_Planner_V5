// 단축키 설정(눌러서 고르기 - P18)이 고를 수 있는 단추 표시.
// 단추에 `{...shortcutTarget('timetable')}`를 펼쳐 두면, 단축키 설정 중에 그 단추를 누를 때 그 기능('시간표')을 고른다(app/shortcutRecord).
// 단추가 하는 일이 그 단축키와 같은(또는 같은 창을 여는) 곳에만 단다. 카드 하나에 묶인 단추(이 일정 완료 등)에는 달지 않는다.
import type { ShortcutId } from '../domain/shortcuts';

export function shortcutTarget(id: ShortcutId): { 'data-shortcut-target': ShortcutId } {
  return { 'data-shortcut-target': id };
}
