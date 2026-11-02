import { describe, it, expect, beforeEach } from 'vitest';
import { getTabShortcut, isKnownTabShortcut, runTabShortcut, setTabOpener, shortcutLabel, TAB_SHORTCUTS, tabTargetOf } from './tabShortcuts';
import './windowList';
import { getWindowDef, useWindows } from './windows';

// 창 목록(windowList)은 그대로 두고 열린 창만 비운다
beforeEach(() => useWindows.setState({ windows: [] }));

describe('창 안 탭 목록 (P18-2)', () => {
  it('id가 겹치지 않고, 창은 모두 창 목록에 있다', () => {
    expect(new Set(TAB_SHORTCUTS.map((t) => t.id)).size).toBe(TAB_SHORTCUTS.length);
    for (const t of TAB_SHORTCUTS) {
      expect(t.id).toBe(`${t.window}:${t.tab}`);
      expect(getWindowDef(t.window), t.window).toBeDefined();
      expect(t.label).toMatch(/ → /);
    }
  });

  it('같은 일을 하는 단축키가 있는 탭은 그 단축키를 고른다 - 목록에 두 줄이 되지 않는다', () => {
    expect(tabTargetOf('backup', 'send')).toBe('calendar');
    expect(tabTargetOf('timetable', 'teaching')).toBe('teachingMode');
    expect(tabTargetOf('notices', 'list')).toBe('notices');
    expect(isKnownTabShortcut('backup:send')).toBe(false);
    expect(tabTargetOf('settings', 'notify')).toBe('settings:notify');
    // 개발자 탭·없는 탭은 고를 수 없다
    expect(tabTargetOf('settings', 'dev')).toBeNull();
    expect(tabTargetOf('seating', 'x')).toBeNull();
  });

  it('이름: 창 안 탭은 창 → 탭, 기능은 단축키 목록 이름', () => {
    expect(shortcutLabel('settings:notify')).toBe('환경설정 → 알림');
    expect(shortcutLabel('timetable')).toBe('시간표');
    expect(getTabShortcut('trash:memo')?.label).toBe('휴지통 → 메모');
  });
});

describe('창 안 탭 열기', () => {
  it('그 창을 그 탭으로 연다', () => {
    expect(runTabShortcut('settings:notify')).toBe(true);
    expect(useWindows.getState().windows.map((w) => [w.id, w.params])).toEqual([['settings', { tab: 'notify' }]]);
  });

  it('이미 열린 창도 같은 탭으로 다시 열면 params가 새것이다 (그새 다른 탭을 눌렀어도 넘어가게)', () => {
    runTabShortcut('backup:import');
    const first = useWindows.getState().windows[0].params;
    runTabShortcut('backup:import');
    const [w] = useWindows.getState().windows;
    expect(w.params).toEqual({ tab: 'import' });
    expect(w.params).not.toBe(first);
  });

  it('여는 길을 단 창(출석부·알림장)은 그 길로', () => {
    const asked: string[] = [];
    const off = setTabOpener('attendance', (tab) => asked.push(tab));
    expect(runTabShortcut('attendance:summary')).toBe(true);
    expect(asked).toEqual(['summary']);
    expect(useWindows.getState().windows).toEqual([]);
    off();
  });

  it('모르는 탭은 false', () => {
    expect(runTabShortcut('settings:nope')).toBe(false);
  });
});

// 창 파일 (Vite ?raw - windowConventions.test 본보기)
const sources = import.meta.glob(['../features/**/*Window.tsx', '../features/**/*Panel.tsx'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const FILE_OF: Record<string, string> = {
  settings: 'settings/SettingsWindow',
  backup: 'backup/BackupWindow',
  mail: 'mail/MailWindow',
  timetable: 'timetable/TimetableWindow',
  labels: 'labels/LabelsWindow',
  trash: 'trash/TrashWindow',
  attendance: 'attendance/AttendancePanel',
  notices: 'notices/NoticePanel',
};

describe('탭 단추 표시', () => {
  it.each([...new Set(TAB_SHORTCUTS.map((t) => t.window))])('%s 창의 탭 단추가 useTabTarget으로 표시를 단다', (win) => {
    const src = sources[`../features/${FILE_OF[win]}.tsx`];
    expect(src, win).toBeDefined();
    expect(src).toContain('useTabTarget()');
    expect(src).toContain(`{...tabTarget('${win}', `);
  });
});
