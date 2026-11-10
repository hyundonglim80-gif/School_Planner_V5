// 창 안 탭 단축키 (P18-2 - PLAN 5장 'P18-2'). '환경설정 → 알림'처럼 그 창을 그 탭으로 여는 키.
//   대상 id = '<창 id>:<탭 id>' (domain/shortcuts TabShortcutId). 키는 기기 설정 칸 tabShortcuts(app/prefs) - 키를 준 탭만.
//   고를 수 있는 탭 = 창을 나누는 고정 탭. 탭 id는 그 창의 탭 타입으로 적어 창의 탭이 바뀌면 여기서 틀린다(tsc).
//   지금 단축키와 같은 일을 하는 탭은 그 단축키를 고른다(ALIAS - 같은 일이 두 줄이 되지 않게).
//   여는 길: 기본은 openWindow(창, { tab }). 날짜·공간이 있어야 열리는 쓰는 칸(출석부·알림장)은 그 기능이 setTabOpener로 단다.
// 탭 단추에 다는 표시·툴팁은 app/keys useTabTarget, 키 처리는 app/keys handleAppKeyDown.
import type { AnyShortcutId, ShortcutId, TabShortcutId } from '../domain/shortcuts';
import { isCustomShortcutId, isShortcutId, isTabShortcutId, labelOf } from '../domain/shortcuts';
import { customShortcutOf } from './customShortcuts';
import type { ItemKind } from '../data/types';
import type { AttendanceTab } from '../features/attendance/open';
import type { BackupTabId } from '../features/backup/open';
import type { MailTabId } from '../features/mail/open';
import type { NoticeTab } from '../features/notices/open';
import type { SettingsTabId } from '../features/settings/SettingsWindow';
import type { TimetableTab } from '../features/timetable/TimetableWindow';
import type { TrashTab } from '../features/trash/trashList';
import { getWindowDef, openWindow } from './windows';

export interface TabShortcut {
  id: TabShortcutId;
  /** 창 목록 id */
  window: string;
  tab: string;
  /** '환경설정 → 알림' */
  label: string;
}

function tabsOf<T extends string>(window: string, title: string, tabs: ReadonlyArray<readonly [T, string]>): TabShortcut[] {
  return tabs.map(([tab, name]) => ({ id: `${window}:${tab}`, window, tab, label: `${title} → ${name}` }));
}

export const TAB_SHORTCUTS: TabShortcut[] = [
  // 개발자 탭은 개발자 계정에만 보여 뺀다
  ...tabsOf<Exclude<SettingsTabId, 'dev'>>('settings', '환경설정', [
    ['view', '보기'],
    ['notify', '알림'],
    ['school', '학교'],
    ['shortcuts', '단축키'],
    ['app', '앱'],
  ]),
  // '보내기' = 단축키 '구글 캘린더로 보내기'(ALIAS)
  ...tabsOf<Exclude<BackupTabId, 'send'>>('backup', '백업', [
    ['backup', '백업'],
    ['import', '가져오기'],
    ['tidy', '정리'],
  ]),
  ...tabsOf<MailTabId>('mail', '쪽지', [
    ['in', '받은 쪽지'],
    ['sent', '보낸 쪽지'],
    ['write', '쓰기'],
  ]),
  // '교사 유형' = 단축키 '교사 유형 바꾸기'(ALIAS)
  ...tabsOf<Exclude<TimetableTab, 'teaching'>>('timetable', '시간표', [
    ['grid', '시간표'],
    ['periods', '교시'],
    ['terms', '학기·방학'],
  ]),
  ...tabsOf<ItemKind>('labels', '라벨 관리', [
    ['event', '일정 라벨'],
    ['note', '메모 라벨'],
  ]),
  ...tabsOf<Exclude<TrashTab, 'journal'>>('trash', '휴지통', [
    ['all', '전체'],
    ['event', '일정'],
    ['memo', '메모'],
    ['clip', '클립보드'],
    ['etc', '기타'],
  ]),
  ...tabsOf<AttendanceTab>('attendance', '출석부', [
    ['check', '출석 체크'],
    ['summary', '누계'],
  ]),
  // '모아 보기' = 단축키 '알림장 모아 보기'(ALIAS)
  ...tabsOf<Exclude<NoticeTab, 'list'>>('notices', '알림장', [['write', '쓰기']]),
];

/** 지금 단축키와 같은 일을 하는 탭 → 그 단축키 */
const ALIAS: Partial<Record<TabShortcutId, ShortcutId>> = {
  'backup:send': 'calendar',
  'timetable:teaching': 'teachingMode',
  'notices:list': 'notices',
};

const byId = new Map(TAB_SHORTCUTS.map((t) => [t.id, t]));

export const getTabShortcut = (id: TabShortcutId): TabShortcut | undefined => byId.get(id);
export const isKnownTabShortcut = (id: TabShortcutId): boolean => byId.has(id);

/** 그 탭 단추가 고르는 것 - 목록에 있는 탭, 같은 일을 하는 단축키, 없으면(고를 수 없는 탭) null */
export function tabTargetOf(window: string, tab: string): ShortcutId | TabShortcutId | null {
  const id: TabShortcutId = `${window}:${tab}`;
  return ALIAS[id] ?? (byId.has(id) ? id : null);
}

/** 화면에 보일 이름 - 기능은 단축키 목록의 이름, 창 안 탭은 '창 → 탭', 내가 만든 것은 단 쪽의 이름('창 위치 → 팝업창') */
export function shortcutLabel(id: AnyShortcutId): string {
  if (isTabShortcutId(id)) return byId.get(id)?.label ?? id;
  if (isCustomShortcutId(id)) return customShortcutOf(id)?.label ?? id;
  return labelOf(id);
}

/** 키를 줄 수 있는 것으로 아는 id인가 (눌러서 고르기·팝업창 부탁이 받는 것 - 기능·있는 창 안 탭·이 판이 아는 내가 만든 것) */
export function isKnownShortcut(id: string): id is AnyShortcutId {
  if (isTabShortcutId(id)) return byId.has(id);
  if (isCustomShortcutId(id)) return !!customShortcutOf(id);
  return isShortcutId(id);
}

const openers = new Map<string, (tab: string) => void>();

/** 그 창을 탭으로 여는 길 (날짜·공간이 있어야 열리는 쓰는 칸). 떼는 함수를 돌려준다 */
export function setTabOpener(window: string, open: (tab: string) => void): () => void {
  openers.set(window, open);
  return () => {
    if (openers.get(window) === open) openers.delete(window);
  };
}

/** 그 창을 탭으로 여는 길이 따로 있나 (날짜·공간이 있어야 열리는 쓰는 칸 - 단추 대신 누르기가 열 수 있는지 본다, P28-3) */
export const hasTabOpener = (window: string): boolean => openers.has(window);

/** 그 창을 그 탭으로 연다 (따로 단 여는 길이 있으면 그것 - 출석부·알림장) */
export function openWindowTab(window: string, tab: string) {
  const open = openers.get(window);
  if (open) open(tab);
  else openWindow(window, { tab });
}

/** 그 창을 그 탭으로 연다. 열 수 있으면 true (창을 등록하지 않았으면 false) */
export function runTabShortcut(id: TabShortcutId): boolean {
  const t = byId.get(id);
  if (!t || !getWindowDef(t.window)) return false;
  openWindowTab(t.window, t.tab);
  return true;
}

/** 탭 단추의 표시(data-shortcut-target) → 그 창의 탭 id ('settings:notify' → 'notify', 같은 일을 하는 단축키 'calendar' → 'send'). 그 창의 탭이 아니면 null */
export function tabOfTarget(window: string, target: string): string | null {
  if (target.startsWith(`${window}:`)) return target.slice(window.length + 1) || null;
  for (const [id, alias] of Object.entries(ALIAS)) if (alias === target && id.startsWith(`${window}:`)) return id.slice(window.length + 1);
  return null;
}

/** '환경설정 → 알림' (목록에 없는 탭은 창 이름만) */
export function tabLabelOf(window: string, tab: string | undefined, title: string): string {
  return (tab && byId.get(`${window}:${tab}`)?.label) || title;
}
