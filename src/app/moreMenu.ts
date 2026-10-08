// ⋮ 메뉴 (MENU.md 3-4) - 4구역 8항목. 어느 화면에서나 가끔 쓰는 것만 둔다(V4는 5구역 18항목).
// 항목 id = 단축키 id = 창 목록 id. 창을 등록하면 그 항목이 살아난다(그 전에는 흐리게, 누르면 '아직 옮기지 않은 기능').
// 자리를 바꾸면 이 파일·MENU.md·설명서를 같은 커밋에서 고친다. 창 목록 테스트(windowConventions)가 이 표를 지킨다.
import type { ShortcutId } from '../domain/shortcuts';
import type { Scope } from './route';
import type { MenuSection } from './windows';

export interface MoreMenuItem {
  id: ShortcutId;
  icon: string;
  label: string;
  /** 이 화면에서만 보인다 (없으면 모든 화면) */
  screens?: Scope[];
}

export const MORE_MENU: ReadonlyArray<{ section: MenuSection; items: MoreMenuItem[] }> = [
  {
    section: '일정',
    items: [
      { id: 'labels', icon: '🏷️', label: '라벨 관리' },
      { id: 'multiSelect', icon: '☑️', label: '여러 개 고르기' },
    ],
  },
  {
    // 진도 관리는 하루 수업 머리줄 📘에도 있다(주간·월간·메모에서도 열려고 ⋮에 둔다)
    section: '수업',
    items: [
      { id: 'progress', icon: '📘', label: '진도 관리' },
      { id: 'timetable', icon: '⏰', label: '시간표' },
    ],
  },
  {
    section: '자료',
    items: [
      { id: 'backup', icon: '💾', label: '백업 · 가져오기 · 보내기' },
      // 주간·년간 화면의 🖨️ 단추를 여기로 (MENU.md 4장)
      { id: 'print', icon: '🖨️', label: '이 화면 인쇄', screens: ['week', 'year'] },
    ],
  },
  {
    section: '설정',
    items: [
      { id: 'settings', icon: '⚙️', label: '환경설정' },
      { id: 'help', icon: '💡', label: '사용 설명서' },
    ],
  },
];
