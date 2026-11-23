// 메모 펼침·접힘 기억 (11-23 사용자 요청 '펼쳤던 메모는 펼친 상태를 유지하고 접힌 메모는 접힌 상태를 유지').
//   메모마다 사용자가 ▶/▼를 누른 것만 이 기기에 담는다 - 하루 메모 칸·메모 화면(카드·목록 줄)·그날 메모 창이 같은 값.
//   누른 적 없는 메모는 화면 기본값(카드 = 길이, 목록 줄 = 접힘) - 셈은 domain/entryCollapse.
//   계정에 올리지 않는다: 누를 때마다 서버 쓰기가 생기고, PC와 휴대폰은 화면 폭이 달라 따로 두는 편이 낫다(머리줄 접기·카드/목록과 같다).
//   다른 창(↗ 새 창·팝업창)에서 누른 것도 곧바로 따라온다(storage 알림).
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { rememberEntryOpen, type EntryOpenMap } from '../../domain/entryCollapse';

const KEY = 'sp5-entry-open';

export const useEntryOpen = create<{ open: EntryOpenMap }>()(persist((): { open: EntryOpenMap } => ({ open: {} }), { name: KEY }));

/** 이 메모를 펼친 채(true)·접힌 채(false)로 기억한다 */
export const setEntryOpen = (id: string, open: boolean) => useEntryOpen.setState((s) => ({ open: rememberEntryOpen(s.open, id, open) }));

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) void useEntryOpen.persist.rehydrate();
  });
}
