// 하루 수업 칸 - 받는 중 (P32-2): 시간표·그날 바꾼 칸이 사본에도 없고 서버에서도 다 받지 못했으면 교시 카드 대신 '수업을 받는 중…'
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render } from '@testing-library/react';
import { Timestamp } from 'firebase/firestore';
import { applyBase, resetMirrorStore, setStatus, trackColl, type MirrorStatus } from '../../data/mirror/store';
import { useSession } from '../../data/session';
import DayLessons from './DayLessons';
import { useDayView } from '../day/dayView';
import { setCardCols } from '../../app/cardCols';
import { useEntryOpen } from '../notes/entryOpen';

vi.mock('../../data/firebase', () => ({ auth: {}, db: {} }));

const SID = 'u_me';
const DAY = '2026-10-12'; // 월요일
const t = new Timestamp(1, 0);
const base = { deletedAt: null, updatedAt: t, v: 1, createdAt: 0, authorId: 'me' };
const TT = new Map<string, Record<string, unknown>>([
  ['tt1', { ...base, name: '1학기', from: '2026-03-01', to: '2027-02-28', grid: { '1': { '1': '국어', '2': '수학' } } }],
]);

const q = (s: string) => document.querySelector<HTMLElement>(s);
const qa = (s: string) => [...document.querySelectorAll<HTMLElement>(s)];

function seed(coll: 'timetables' | 'lessonDays', status: MirrorStatus, docs = new Map<string, Record<string, unknown>>()) {
  trackColl(SID, coll);
  if (docs.size) applyBase(SID, coll, docs);
  setStatus(SID, coll, status);
}

beforeEach(() => {
  resetMirrorStore();
  document.body.innerHTML = '';
  useSession.setState({ loading: false, user: { uid: 'me', email: '', displayName: '', photoURL: '' } });
});

describe('하루 수업 칸 - 받는 중 (P32-2)', () => {
  it('시간표도 바꾼 칸도 아직 받는 중이면 교시 카드 대신 받는 중', () => {
    seed('timetables', 'loading');
    seed('lessonDays', 'loading');
    render(<DayLessons date={DAY} />);
    expect(q('[data-lessons-loading]')?.textContent).toContain('수업을 받는 중');
    expect(qa('[data-lesson-card]')).toHaveLength(0);
  });

  it('끊겨서 사본이 빈 채면 이어질 때까지 받는 중 (빈 시간표로 보이지 않게)', () => {
    seed('timetables', 'offline');
    seed('lessonDays', 'live');
    render(<DayLessons date={DAY} />);
    expect(q('[data-lessons-loading]')).not.toBeNull();
  });

  it('시간표가 하나라도 오면(사본 포함) 곧바로 교시 카드 - 바꾼 칸을 받는 중이어도', () => {
    seed('timetables', 'copy', TT);
    seed('lessonDays', 'loading');
    render(<DayLessons date={DAY} />);
    expect(q('[data-lessons-loading]')).toBeNull();
    expect(q('[data-lesson-card="1"] [data-lesson-subject]')?.dataset.lessonSubject).toBe('국어');
  });

  it('둘 다 서버에서 받았는데 없으면(처음 쓰는 사람) 지금처럼 빈 교시', () => {
    seed('timetables', 'live');
    seed('lessonDays', 'live');
    render(<DayLessons date={DAY} />);
    expect(q('[data-lessons-loading]')).toBeNull();
    expect(qa('[data-lesson-card]').length).toBeGreaterThan(0);
    expect(q('[data-lesson-card="1"]')?.textContent).toContain('과목 미등록');
  });

  it('접으면 받는 중도 숨긴다', () => {
    seed('timetables', 'loading');
    seed('lessonDays', 'loading');
    render(<DayLessons date={DAY} />);
    q('[data-lessons-collapse]')!.click();
    return Promise.resolve().then(() => expect(q('[data-lessons-loading]')).toBeNull());
  });
});

describe('하루 수업 칸 - 카드 / 목록 (#204)', () => {
  it('머리 ☰ = 목록 - 교시 하나 = 한 줄(비고는 첫 줄만 과목 뒤에), ▦ = 카드로 (비고 칸이 다시)', () => {
    useDayView.setState({ lessons: 'card' });
    seed('timetables', 'live', TT);
    seed('lessonDays', 'live', new Map([['2026-10-12', { ...base, periods: { '1': { supplies: '돋보기\n모둠 활동' } } }]]));
    try {
      render(<DayLessons date={DAY} />);
      expect(q('[data-day-lessons]')?.dataset.lessonsView).toBe('card');
      expect(q('[data-lesson-card="1"] [data-lesson-note]')?.textContent).toContain('모둠 활동');
      expect(q('[data-lesson-note-line]')).toBeNull();
      fireEvent.click(q('[data-lessons-view-toggle="card"]')!);
      expect(useDayView.getState().lessons).toBe('list');
      expect(q('[data-day-lessons]')?.dataset.lessonsView).toBe('list');
      expect(qa('[data-lesson-card]').map((c) => c.dataset.lessonCard)).toEqual(['1', '2', '3', '4', '5', '6']);
      expect(q('[data-lesson-card="1"] [data-lesson-note]')).toBeNull();
      const line = q('[data-lesson-card="1"] [data-lesson-note-line]')!;
      expect(line.textContent).toContain('돋보기');
      expect(line.textContent).not.toContain('모둠 활동');
      expect(line.title).toContain('모둠 활동');
      expect(q('[data-lesson-card="1"] [data-lesson-subject]')?.dataset.lessonSubject).toBe('국어');
      fireEvent.click(q('[data-lessons-view-toggle="list"]')!);
      expect(useDayView.getState().lessons).toBe('card');
      expect(q('[data-lesson-card="1"] [data-lesson-note]')).not.toBeNull();
    } finally {
      useDayView.setState({ lessons: 'card' });
    }
  });
});

describe('하루 수업 칸 - 카드 열 · 목록 줄 펴기 (#206)', () => {
  const grid = () => q('[data-lesson-card="1"]')!.parentElement!.className;

  it('카드 열 자동 = 휴대폰 2열(일정·메모 칸과 같게)·PC 1열, 고르면 어디서나 그 수 - 좁은 카드는 첫 줄이 줄을 바꾼다 · 목록은 늘 한 줄에 하나', () => {
    useDayView.setState({ lessons: 'card' });
    seed('timetables', 'live', TT);
    seed('lessonDays', 'live');
    try {
      render(<DayLessons date={DAY} />);
      expect(grid()).toContain('grid-cols-2 gap-2 sm:grid-cols-1');
      const firstRow = () => q('[data-lesson-card="1"] [data-lesson-subject]')!.parentElement!.className;
      expect(firstRow()).toContain('flex-wrap gap-y-1 sm:flex-nowrap');
      act(() => setCardCols('lessonCols', 3));
      expect(grid()).toContain('grid-cols-3');
      expect(grid()).not.toContain('sm:grid-cols-1');
      expect(firstRow()).not.toContain('sm:flex-nowrap');
      act(() => setCardCols('lessonCols', 1));
      expect(grid()).toContain('grid-cols-1');
      expect(grid()).not.toContain('grid-cols-2');
      expect(firstRow()).not.toContain('flex-wrap');
      act(() => setCardCols('lessonCols', 4));
      fireEvent.click(q('[data-lessons-view-toggle="card"]')!);
      expect(grid()).toContain('grid-cols-1');
      expect(grid()).not.toContain('grid-cols-4');
    } finally {
      useDayView.setState({ lessons: 'card' });
      setCardCols('lessonCols', 0);
    }
  });

  it('목록 줄 맨 앞 ▶ = 그 줄 아래에 비고 전체(이 기기에 기억) · ▼ = 다시 한 줄 · 펼 것이 없는 교시는 자리만', () => {
    useDayView.setState({ lessons: 'list' });
    useEntryOpen.setState({ open: {} });
    seed('timetables', 'live', TT);
    seed('lessonDays', 'live', new Map([[DAY, { ...base, periods: { '1': { supplies: '돋보기\n모둠 활동' } } }]]));
    try {
      render(<DayLessons date={DAY} />);
      const btn = () => q('[data-lesson-row-expand="lesson:2026-10-12:1"]')!;
      expect(qa('[data-lesson-row-expand]')).toHaveLength(qa('[data-lesson-card]').length);
      expect(btn().getAttribute('aria-expanded')).toBe('false');
      expect(q('[data-lesson-card="1"] [data-lesson-note-line]')).not.toBeNull();
      expect(q('[data-lesson-card="1"] [data-lesson-note]')).toBeNull();
      fireEvent.click(btn());
      expect(useEntryOpen.getState().open['lesson:2026-10-12:1']).toBe(true);
      expect(btn().getAttribute('aria-expanded')).toBe('true');
      expect(q('[data-lesson-card="1"] [data-lesson-note]')?.textContent).toContain('모둠 활동');
      expect(q('[data-lesson-card="1"] [data-lesson-note-line]')).toBeNull();
      fireEvent.click(btn());
      expect(q('[data-lesson-card="1"] [data-lesson-note]')).toBeNull();
      expect(q('[data-lesson-card="1"] [data-lesson-note-line]')).not.toBeNull();
      // 2교시는 펼 것(진도 줄·지난 시간·비고)이 없다 - 줄 머리를 맞추는 자리만
      const empty = q('[data-lesson-row-expand="lesson:2026-10-12:2"]')!;
      expect(empty.className).toContain('invisible');
      expect(empty).toBeDisabled();
    } finally {
      useDayView.setState({ lessons: 'card' });
      useEntryOpen.setState({ open: {} });
    }
  });
});
