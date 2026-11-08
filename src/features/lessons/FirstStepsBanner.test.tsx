// 처음 쓰는 사람의 띠 차례 (P22-7): 📥 V4 가져오기 → 👩‍🏫 교사 유형 → 👣 다음(⏰ 시간표 → 🏫 학급) · 받기 전(모름)에는 띄우지 않는다 · useHasLive
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, renderHook } from '@testing-library/react';
import { Timestamp } from 'firebase/firestore';
import { useNav } from '../../app/nav';
import { useCommonLoaded, useCommonSettings } from '../../app/prefs';
import { applyBase, resetMirrorStore, setStatus, trackColl } from '../../data/mirror/store';
import { useHasLive } from '../../data/select';
import { useSession } from '../../data/session';
import { DEFAULT_TEACHING_MODE } from '../../domain/teachingMode';
import { useImportRun } from '../../import/v4/runState';
import FirstStepsBanner from './FirstStepsBanner';
import TeachingBanner from './TeachingBanner';

vi.mock('../../data/firebase', () => ({ auth: {}, db: {} }));
const opened = vi.hoisted(() => [] as string[]);
vi.mock('../../app/windows', async (orig) => ({ ...(await orig<typeof import('../../app/windows')>()), openWindow: vi.fn((id: string) => opened.push(id)) }));

const SID = 'u_me';
const t = new Timestamp(1, 0);
const base = { deletedAt: null, updatedAt: t, v: 1, createdAt: 0, authorId: 'me' };
const q = (s: string) => document.querySelector<HTMLElement>(s);

function seed(coll: 'timetables' | 'classes', docs: Record<string, Record<string, unknown>>, status: 'live' | 'loading' | 'copy' = 'live') {
  trackColl(SID, coll);
  applyBase(SID, coll, new Map(Object.entries(docs)));
  setStatus(SID, coll, status);
}

beforeEach(() => {
  resetMirrorStore();
  opened.length = 0;
  document.body.innerHTML = '';
  useSession.setState({ loading: false, user: { uid: 'me', email: '', displayName: '', photoURL: '' } });
  useCommonLoaded.setState({ loaded: true });
  useCommonSettings.setState({ teaching: DEFAULT_TEACHING_MODE, firstStepsDone: false });
  useImportRun.setState({ offer: false, offerChecked: true, state: 'idle' });
  seed('timetables', {});
  seed('classes', {});
});

describe('useHasLive (P22-7)', () => {
  it('서버에서 받기 전에는 모른다(null), 받았는데 없으면 false, 살아 있는 문서가 있으면 true', () => {
    resetMirrorStore();
    seed('timetables', {}, 'copy');
    const { result, rerender } = renderHook(() => useHasLive(['timetables', 'classes'], SID));
    expect(result.current).toBeNull(); // 사본만 · 학급은 아직 없음
    act(() => {
      setStatus(SID, 'timetables', 'live');
      seed('classes', {}, 'loading');
    });
    rerender();
    expect(result.current).toBeNull();
    act(() => setStatus(SID, 'classes', 'live'));
    rerender();
    expect(result.current).toBe(false);
    act(() => seed('classes', { gone: { ...base, deletedAt: t } }));
    rerender();
    expect(result.current).toBe(false); // 지운 것은 세지 않는다
    act(() => seed('timetables', { tt: { ...base } }, 'loading'));
    rerender();
    expect(result.current).toBe(true); // 받는 중이어도 있는 것은 있다
  });
});

describe('다음 할 일 띠 (P22-7)', () => {
  it('시간표·학급이 없으면 ⏰ 시간표 넣기가 먼저, 누르면 시간표 창', () => {
    render(<FirstStepsBanner />);
    expect(q('[data-first-steps-banner]')).not.toBeNull();
    expect(q('[data-first-step="timetable"]')!.dataset.done).toBe('false');
    expect(q('[data-first-step="class"]')!.dataset.done).toBe('false');
    fireEvent.click(q('[data-first-step="timetable"]')!);
    expect(opened).toEqual(['timetable']);
  });

  it('시간표를 넣으면 ✓, 학급 만들기 = 학급 화면 · 둘 다 하면 사라진다', () => {
    seed('timetables', { tt: { ...base } });
    render(<FirstStepsBanner />);
    expect(q('[data-first-step="timetable"]')!.dataset.done).toBe('true');
    expect(q('[data-first-step="timetable"]')!.textContent).toContain('✓');
    fireEvent.click(q('[data-first-step="class"]')!);
    expect(useNav.getState().scope).toBe('class');
    act(() => seed('classes', { c: { ...base } }));
    expect(q('[data-first-steps-banner]')).toBeNull();
  });

  it('받기 전·교사 유형을 고르기 전·가져오기 띠가 있거나 아직 모르면·닫았으면 띄우지 않는다', () => {
    seed('classes', {}, 'loading');
    const { rerender } = render(<FirstStepsBanner />);
    expect(q('[data-first-steps-banner]')).toBeNull();
    act(() => setStatus(SID, 'classes', 'live'));
    rerender(<FirstStepsBanner />);
    expect(q('[data-first-steps-banner]')).not.toBeNull();
    act(() => useCommonSettings.setState({ teaching: null }));
    expect(q('[data-first-steps-banner]')).toBeNull();
    act(() => useCommonSettings.setState({ teaching: DEFAULT_TEACHING_MODE }));
    act(() => useImportRun.setState({ offer: true }));
    expect(q('[data-first-steps-banner]')).toBeNull();
    act(() => useImportRun.setState({ offer: false, offerChecked: false }));
    expect(q('[data-first-steps-banner]')).toBeNull();
    act(() => useImportRun.setState({ offerChecked: true, state: 'running' }));
    expect(q('[data-first-steps-banner]')).toBeNull();
    act(() => useImportRun.setState({ state: 'done' }));
    expect(q('[data-first-steps-banner]')).not.toBeNull();
  });

  it("'닫기' = 계정에 적고 사라진다", () => {
    render(<FirstStepsBanner />);
    fireEvent.click(q('[data-first-steps-close]')!);
    expect(useCommonSettings.getState().firstStepsDone).toBe(true);
    expect(q('[data-first-steps-banner]')).toBeNull();
  });
});

describe('교사 유형 띠 - 가져오기 띠가 먼저 (P22-7)', () => {
  it('가져오기 띠가 있거나 아직 모르면 띄우지 않는다', () => {
    useCommonSettings.setState({ teaching: null });
    useImportRun.setState({ offer: true });
    render(<TeachingBanner />);
    expect(q('[data-teacher-mode-banner]')).toBeNull();
    act(() => useImportRun.setState({ offer: false, offerChecked: false }));
    expect(q('[data-teacher-mode-banner]')).toBeNull();
    act(() => useImportRun.setState({ offerChecked: true }));
    expect(q('[data-teacher-mode-banner]')).not.toBeNull();
  });
});
