// ＋ 새로 → 새 기록 = 보는 날의 새 기록 칸(메모·학급 화면이면 오늘), 새 메모 = 날짜 없는 칸
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { runShortcut } from '../../app/keys';
import { setDate, setScope } from '../../app/nav';
import '../../app/windowList';
import { useWindows } from '../../app/windows';
import { todayStr } from '../../domain/dateUtils';
import { useSession } from '../../data/session';
import { openNewNote, useNoteShortcuts } from './shortcuts';

vi.mock('../../data/firebase', () => ({ auth: {}, db: {} }));

const SID = 'u_me';
const opened = () => useWindows.getState().windows.map((w) => [w.id, w.params]);

beforeEach(() => {
  useWindows.setState({ windows: [] });
  useSession.setState({ loading: false, user: { uid: 'me', email: '', displayName: '', photoURL: '' } });
});

describe('메모·기록 ＋ 새로', () => {
  it('새 기록 = 보는 날, 메모 화면이면 오늘', () => {
    setScope('week');
    setDate('2026-10-14');
    openNewNote();
    expect(opened()).toEqual([['note', { sid: SID, date: '2026-10-14' }]]);
    useWindows.setState({ windows: [] });
    setScope('memo');
    openNewNote();
    expect(opened()).toEqual([['note', { sid: SID, date: todayStr() }]]);
  });

  it('useNoteShortcuts가 newNote·newMemo에 건다 (새 메모 = 날짜 없음)', () => {
    setScope('day');
    setDate('2026-10-08');
    function Hook() {
      useNoteShortcuts();
      return null;
    }
    const { unmount } = render(<Hook />);
    expect(runShortcut('newMemo')).toBe(true);
    expect(opened()).toEqual([['note', { sid: SID, date: null }]]);
    expect(runShortcut('newNote')).toBe(true);
    expect(opened().at(-1)).toEqual(['note', { sid: SID, date: '2026-10-08' }]);
    unmount();
    expect(runShortcut('newMemo')).toBe(false);
  });
});
