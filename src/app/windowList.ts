// 창 등록 한 곳 (DESIGN 7-2). 창을 만드는 세션이 여기에 한 줄씩 더한다 - ⋮ 구역·학급 도구·수업 머리줄은 MENU.md대로.
import { EVENT_PANEL, sameEventPanel, type EventPanelParams } from '../features/events/open';
import { LINK_VIEWER, LINKER, sameLinkWindow, type LinkWindowParams } from '../features/links/open';
import { DAY_NOTES, NOTE_PANEL, sameDayNotes, sameNotePanel, type DayNotesParams, type NotePanelParams } from '../features/notes/open';
import { LESSON_PANEL, sameLessonPanel, type LessonPanelParams } from '../features/lessons/open';
import type { WeeklyGuideParams } from '../features/weeklyGuide/WeeklyGuideWindow';
import { SCHOOL_EVENT_WINDOW, type SchoolEventParams } from '../features/school/open';
import { ATTENDANCE_PANEL, type AttendancePanelParams } from '../features/attendance/open';
import { NOTICE_PANEL, sameNoticePanel, type NoticePanelParams } from '../features/notices/open';
import { SUBJECT_ATT_CELL, SUBJECT_ATT_SUMMARY, sameSubjectCell, type SubjectAttendanceCellParams, type SubjectAttendanceSummaryParams } from '../features/subjectAttendance/open';
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

// 수업 수정 칸 'N교시 수정' (P6-1) - 주간 수업 줄·링크 보기·검색에서 (하루 화면은 카드 자리에서 바로 고친다)
registerWindow<LessonPanelParams>({
  id: LESSON_PANEL,
  title: '수업',
  icon: '⏰',
  kind: 'panel',
  help: 'detail-popup',
  sameAs: sameLessonPanel,
  load: () => import('../features/lessons/LessonPanel'),
});

// 📋 출석부 (P7-2) - 쓰는 칸 하나(다시 열면 그 날·학급으로). 하루 수업 머리줄·학급 도구 카드·단축키 '출석부'. 담임 도구(전담은 숨긴다)
registerWindow<AttendancePanelParams>({
  id: ATTENDANCE_PANEL,
  title: '출석부',
  icon: '📋',
  kind: 'panel',
  classTool: true,
  lessonHeader: true,
  show: ({ homeroom }) => homeroom,
  help: 'attendance',
  sameAs: () => true,
  load: () => import('../features/attendance/AttendancePanel'),
});

// 📢 알림장 (P7-2) - 쓰는 칸, 공간마다 하나(칸을 연 공간에 저장). 하루 수업 머리줄·학급 도구 카드·단축키 '알림장 모아 보기'. 담임 도구
registerWindow<NoticePanelParams>({
  id: NOTICE_PANEL,
  title: '알림장',
  icon: '📢',
  kind: 'panel',
  classTool: true,
  lessonHeader: true,
  show: ({ homeroom }) => homeroom,
  help: 'notice',
  sameAs: sameNoticePanel,
  load: () => import('../features/notices/NoticePanel'),
});

// 🙋 교과 출결 (P7-2) - 교과 모드 하루 수업 칸의 🙋 = 그 반·그 교시 쓰는 칸 / 누계 창 = 학급 도구 카드·단축키 '교과 출결 누계'
registerWindow<SubjectAttendanceCellParams>({
  id: SUBJECT_ATT_CELL,
  title: '교과 출결',
  icon: '🙋',
  kind: 'panel',
  help: 'subject-attendance',
  sameAs: sameSubjectCell,
  load: () => import('../features/subjectAttendance/SubjectAttendancePanel'),
});
registerWindow<SubjectAttendanceSummaryParams | undefined>({
  id: SUBJECT_ATT_SUMMARY,
  title: '교과 출결 누계',
  icon: '🙋',
  kind: 'side',
  classTool: true,
  show: ({ classUnit }) => classUnit,
  help: 'subject-attendance',
  load: () => import('../features/subjectAttendance/SubjectAttendanceWindow'),
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

// 머리줄 🗑️ 휴지통 (P5-4) - 단축키 'trash'
registerWindow({
  id: 'trash',
  title: '휴지통',
  icon: '🗑️',
  kind: 'side',
  help: 'trash',
  load: () => import('../features/trash/TrashWindow'),
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

// 주간학습안내 (P6-3) - 주간 화면 단추(보는 주, 담임)·단축키 '주간학습안내'(다음 주). ⋮에서는 뺐다(MENU)
registerWindow<WeeklyGuideParams | undefined>({
  id: 'weeklyGuide',
  title: '주간학습안내',
  icon: '📰',
  kind: 'side',
  help: 'weekly-guide',
  load: () => import('../features/weeklyGuide/WeeklyGuideWindow'),
});

// 그날 학사일정 (P6-3) - 날짜 칸의 학사일정 이름·하루 '📚 학사' 줄. D-Day로·일정으로 담기
registerWindow<SchoolEventParams>({
  id: SCHOOL_EVENT_WINDOW,
  title: '학사일정',
  icon: '📚',
  kind: 'side',
  help: 'neis',
  load: () => import('../features/school/SchoolEventWindow'),
});

// ⋮ 수업 - 진도 관리(P6-2). 하루 수업 머리줄 📘에도(주간·월간·메모 화면에서도 열려고 ⋮에도 - MENU 규칙 3의 예외).
//   수업 칸의 진도 줄 = 그 진도 · '📘 진도 만들기' = 그 칸 글자로 새 진도 · 단축키 '진도 만들기 (여러 반)' = 새 과정(features/progress/shortcuts)
registerWindow({
  id: 'progress',
  title: '진도 관리',
  icon: '📘',
  menu: '수업',
  lessonHeader: true,
  kind: 'side',
  help: 'progress',
  load: () => import('../features/progress/ProgressWindow'),
});

// ⋮ 수업 - 시간표(교사 유형·시간표·교시·학기). 하루 수업 칸 ⚙️, 단축키 '시간표'·'교사 유형 바꾸기'(교사 유형 탭)
registerWindow({
  id: 'timetable',
  title: '시간표',
  icon: '⏰',
  menu: '수업',
  kind: 'side',
  help: 'timetable',
  load: () => import('../features/timetable/TimetableWindow'),
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
