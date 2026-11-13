// 하루 수업 칸 - 받는 중 (P32-2): 시간표·그날 바꾼 칸이 사본에도 없고 서버에서도 다 받지 못했으면 교시 카드 대신 '수업을 받는 중…'
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { Timestamp } from 'firebase/firestore';
import { applyBase, resetMirrorStore, setStatus, trackColl, type MirrorStatus } from '../../data/mirror/store';
import { useSession } from '../../data/session';
import DayLessons from './DayLessons';

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
