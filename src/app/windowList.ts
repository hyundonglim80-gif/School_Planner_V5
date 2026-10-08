// 창 등록 한 곳 (DESIGN 7-2). 창을 만드는 세션이 여기에 한 줄씩 더한다 - ⋮ 구역·학급 도구·수업 머리줄은 MENU.md대로.
import { EVENT_PANEL, sameEventPanel, type EventPanelParams } from '../features/events/open';
import { LINK_VIEWER, LINKER, sameLinkWindow, type LinkWindowParams } from '../features/links/open';
import { DAY_NOTES, NOTE_PANEL, sameDayNotes, sameNotePanel, type DayNotesParams, type NotePanelParams } from '../features/notes/open';
import { runShortcut } from './keys';
import { closeAllWindows, openWindow, registerWindow } from './windows';

// 쓰는 칸 (오른쪽 줄 - 어느 화면에서나 같은 칸)
registerWindow<EventPanelParams>({
  id: EVENT_PANEL,
  title: '일정',
  icon: '📅',
  kind: 'panel',
  help: 'event-add',
  sameAs: sameEventPanel,
  load: () => import('../features/events/EventPanel'),
});
registerWindow<NotePanelParams>({
  id: NOTE_PANEL,
  title: '메모·기록',
  icon: '📔',
  kind: 'panel',
  help: 'journal',
  sameAs: sameNotePanel,
  load: () => import('../features/notes/NotePanel'),
});

// 그날 기록 보기 (P5-1) - 주간·월간·년간 날짜 옆 📝 n
registerWindow<DayNotesParams>({
  id: DAY_NOTES,
  title: '그날 기록',
  icon: '📝',
  kind: 'side',
  help: 'badges',
  sameAs: sameDayNotes,
  load: () => import('../features/notes/DayNotesWindow'),
});

// 링크 (P4-3) - 쓰는 칸의 '🔗 링크 추가'·카드의 '🔗 n'에서 연다. 같은 항목이면 그 탭
registerWindow<LinkWindowParams>({
  id: LINKER,
  title: '링크 연결',
  icon: '🔗',
  kind: 'side',
  help: 'links',
  sameAs: sameLinkWindow,
  load: () => import('../features/links/LinkerWindow'),
});
registerWindow<LinkWindowParams>({
  id: LINK_VIEWER,
  title: '연결된 데이터',
  icon: '📑',
  kind: 'side',
  help: 'link-viewer',
  sameAs: sameLinkWindow,
  load: () => import('../features/links/LinkViewerWindow'),
});

// 머리줄 🔍 검색 (P5-4) - 단축키 'search'
registerWindow({
  id: 'search',
  title: '검색',
  icon: '🔍',
  kind: 'side',
  help: 'search',
  load: () => import('../features/search/SearchWindow'),
});

// 머리줄 ⏳ D-Day (P5-3) - 단축키 'dday'
registerWindow({
  id: 'dday',
  title: 'D-Day',
  icon: '⏳',
  kind: 'side',
  help: 'dday',
  load: () => import('../features/dday/DDayWindow'),
});

// ⋮ 일정
registerWindow({
  id: 'labels',
  title: '라벨 관리',
  icon: '🏷️',
  menu: '일정',
  kind: 'side',
  help: 'labels',
  load: () => import('../features/labels/LabelsWindow'),
});

// ⋮ 설정
registerWindow({
  id: 'settings',
  title: '환경설정',
  icon: '⚙️',
  menu: '설정',
  kind: 'side',
  help: 'settings',
  load: () => import('../features/settings/SettingsWindow'),
});

// 점검용 창 둘 (개발·에뮬레이터 빌드에만 - 운영 빌드에서는 통째로 빠진다)
if (import.meta.env.DEV || __USE_EMULATOR__) {
  registerWindow({ id: 'devWindow', title: '시험 창', icon: '🧪', kind: 'side', dev: true, load: () => import('../features/dev/TestWindow') });
  registerWindow({
    id: 'devPanel',
    title: '시험 쓰는 칸',
    icon: '🧪',
    kind: 'panel',
    dev: true,
    load: () => import('../features/dev/TestPanel'),
  });
  // 점검 스크립트(tools/inspect-*.mjs)가 창을 열고 키가 없는 단축키 일을 부른다
  (window as unknown as { sp5: unknown }).sp5 = { openWindow, closeAllWindows, runShortcut };
}
