import { describe, expect, it } from 'vitest';
import {
  cleanLessons,
  draftForSlot,
  draftTarget,
  emptyLesson,
  insertRowAfter,
  lessonsToSave,
  newCourseDraft,
  newDraft,
  sameAsSaved,
  toDraft,
  withKey,
  type Draft,
} from './progressDraft';
import { sanitizePlan, type ProgressPlan } from '../../domain/progress';

// 진도 관리 창의 고치는 모양 (19번 U2)

const lesson = (content: string, page = '') => ({ unit: '', no: '', content, page, supplies: '' });
const plan = (extra: Partial<ProgressPlan>): ProgressPlan => ({
  id: 'p1',
  key: '',
  startDate: '2026-09-01',
  lessons: [lesson('가'), lesson('나', '12~13')],
  bumps: [],
  ...extra,
});

// 10-21 사용자: 행을 늘리지 않고 차시 칸의 수만큼 수업에 되풀이한다 - 늘려 저장한 옛 표는 열면 한 행으로
describe('차시 칸 = 차시 수 (행은 늘리지 않는다)', () => {
  const L = (content: string, no = '', linkIds?: string[]) => ({ ...lesson(content), no, ...(linkIds ? { linkIds } : {}) });

  it("'1, 2' 표는 그대로 2행 - 열어 보기만 해서는 고친 것이 아니다", () => {
    const saved = plan({ lessons: [L('왕복오래달리기', '1'), L('작은 공을 치고 받아요', '2')] });
    const d = toDraft(saved, false);
    expect(d.lessons.map((l) => [l.content, l.no, l._from])).toEqual([
      ['왕복오래달리기', '1', 0],
      ['작은 공을 치고 받아요', '2', 1],
    ]);
    expect(d.noCount).toBe(true);
    expect(sameAsSaved(d, saved)).toBe(true);
  });

  it('늘려 저장한 옛 표는 한 행으로 열고(고친 것 아님), 저장하면 한 행에 이은 메모를 모은다', () => {
    const saved = plan({ lessons: [L('가', '2', ['m1']), L('가', '', ['m2']), L('나', '1', ['m3'])] });
    const d = toDraft(saved, false);
    expect(d.lessons.map((l) => [l.content, l.no, l._from, l._merged])).toEqual([
      ['가', '2', 0, [1]],
      ['나', '1', 2, undefined],
    ]);
    expect(sameAsSaved(d, saved)).toBe(true);
    expect(lessonsToSave(d.lessons, saved.lessons).map((l) => [l.content, l.linkIds])).toEqual([
      ['가', ['m1', 'm2']],
      ['나', ['m3']],
    ]);
  });

  it("표시가 없는 옛 1, 2, 3 … 차례 번호 표는 그대로(noCount false) - '차시 수로 세기'로 바꾸면 고친 것", () => {
    const ordered = plan({ lessons: ['1', '2', '3', '4'].map((no, i) => L(`내용${i}`, no)) });
    const d = toDraft(ordered, false);
    expect(d.lessons).toHaveLength(4);
    expect(d.noCount).toBe(false);
    expect(sameAsSaved(d, ordered)).toBe(true);
    expect(sameAsSaved({ ...d, noCount: true }, ordered)).toBe(false);
    // 표시가 있으면 1, 2, 3도 차시 수
    expect(toDraft({ ...ordered, noCount: true }, false).noCount).toBe(true);
  });

  it('새 진도는 차시 칸 = 차시 수', () => {
    expect(newDraft().noCount).toBe(true);
    expect(newCourseDraft('과학').noCount).toBe(true);
  });
});

describe('행 가운데 넣기', () => {
  it('그 행 바로 아래에 빈 행 (번호는 뒤가 하나씩 밀린다)', () => {
    const rows = ['가', '나', '다', '라'].map((c) => withKey(lesson(c)));
    const { lessons, at } = insertRowAfter(rows, 2);
    expect(at).toBe(3);
    expect(lessons.map((l) => l.content)).toEqual(['가', '나', '다', '', '라']);
    // 다른 행의 key는 그대로 - React가 입력 중인 칸을 새로 만들지 않는다
    expect(lessons.filter((l) => l.content).map((l) => l._k)).toEqual(rows.map((l) => l._k));
    expect(new Set(lessons.map((l) => l._k)).size).toBe(5);
  });

  it('커서가 없었으면(-1 = 맨 아래 앞 행이 없음) 맨 위, 범위를 넘으면 맨 아래', () => {
    expect(insertRowAfter([], -1).at).toBe(0);
    const rows = [withKey(lesson('가'))];
    expect(insertRowAfter(rows, 0).at).toBe(1);
    expect(insertRowAfter(rows, 9).at).toBe(1);
  });

  it('저장할 모양에는 _k가 없고 빈 행·앞뒤 빈칸은 빠진다', () => {
    const rows = [withKey(lesson(' 가 ', ' 8~9 ')), emptyLesson()];
    expect(cleanLessons(rows)).toEqual([{ unit: '', no: '', content: '가', page: '8~9', supplies: '' }]);
  });
});

describe('저장할 모양 (draftTarget)', () => {
  it('초등 담임: 과목 하나 (앞뒤 빈칸만 뗀다)', () => {
    expect(draftTarget({ ...newDraft(), key: ' 국어 ' })).toEqual({ key: '국어' });
    const d = toDraft(plan({ key: '국어' }), false);
    expect(d.classes).toBeNull();
    expect(draftTarget(d)).toEqual({ key: '국어' });
  });

  it('교과 모드 새 진도: 반이 하나여도 과정 모양 (subject·classes)', () => {
    const d: Draft = { ...newCourseDraft('과학'), classes: ['5-2'] };
    expect(draftTarget(d)).toEqual({ key: '', subject: '과학', classes: ['5-2'] });
    expect(draftTarget({ ...d, classes: ['5-1', '5-2'] })).toMatchObject({ classes: ['5-1', '5-2'] });
  });

  it("교과 모드 새 진도에 반이 없으면 반 없이 과목만 적힌 칸 ('창체')", () => {
    expect(draftTarget(newCourseDraft(' 창체 '))).toEqual({ key: '창체' });
  });

  it("교과 모드에서 연 옛 칸 글자 진도 - 과목 + 반 하나로 보이고, 그대로 두면 글자도 그대로 ('5-2과학')", () => {
    const old = plan({ key: '5-2과학' });
    const d = toDraft(old, true);
    expect(d).toMatchObject({ subject: '과학', classes: ['5-2'], legacyKey: '5-2과학' });
    expect(draftTarget(d)).toEqual({ key: '5-2과학' });
    expect(sameAsSaved(d, old)).toBe(true);
  });

  it('옛 진도의 반·과목을 바꾸면 옛 모양 새 글자, 반을 둘 이상 고르면 과정', () => {
    const d = toDraft(plan({ key: '5-2 과학' }), true);
    expect(draftTarget({ ...d, classes: ['5-3'] })).toEqual({ key: '5-3 과학' });
    expect(draftTarget({ ...d, subject: '실과' })).toEqual({ key: '5-2 실과' });
    expect(draftTarget({ ...d, classes: ['5-2', '5-3'] })).toEqual({ key: '', subject: '과학', classes: ['5-2', '5-3'] });
  });

  it("반이 없는 옛 진도 ('창체') - 과목만, 그대로 두면 그대로", () => {
    const old = plan({ key: '창체' });
    const d = toDraft(old, true);
    expect(d).toMatchObject({ subject: '창체', classes: [], legacyKey: '창체' });
    expect(sameAsSaved(d, old)).toBe(true);
  });

  it('과정은 어느 모드에서 열어도 과정', () => {
    const course = sanitizePlan('c', { subject: '과학', classes: ['5-1', '5-2'], startDate: '2026-09-01', lessons: [] });
    for (const unit of [true, false]) {
      const d = toDraft(course, unit);
      expect(d).toMatchObject({ subject: '과학', classes: ['5-1', '5-2'], legacyKey: null });
      expect(sameAsSaved(d, course)).toBe(true);
    }
  });

  it('교과서 쪽을 고치면 저장한 것과 다르다', () => {
    const old = plan({ key: '국어' });
    const d = toDraft(old, false);
    expect(sameAsSaved(d, old)).toBe(true);
    d.lessons[0] = { ...d.lessons[0], page: '30' };
    expect(sameAsSaved(d, old)).toBe(false);
  });
});

describe('저장된 교과서 쪽 읽기', () => {
  it('page를 읽고, 옛 문서(page 없음)는 빈 글자', () => {
    const p = sanitizePlan('x', { key: '국어', lessons: [{ content: '가', page: '12~15' }, { content: '나' }] });
    expect(p.lessons.map((l) => l.page)).toEqual(['12~15', '']);
  });
});

describe("'📘 진도 만들기' - 수업 칸 글자로 새 진도 (19번 U3)", () => {
  it("초등 담임: 과목 '국어'", () => {
    expect(draftForSlot(' 국어 ', false)).toMatchObject({ key: '국어', classes: null });
  });
  it("교과 모드: '5-2 과학' → 과목 과학 + 반 5-2 (과정 모양), 반 없는 칸은 과목만", () => {
    const d = draftForSlot('5-2과학', true);
    expect(d).toMatchObject({ subject: '과학', classes: ['5-2'], legacyKey: null });
    expect(draftTarget(d)).toEqual({ key: '', subject: '과학', classes: ['5-2'] });
    expect(draftTarget(draftForSlot('창체', true))).toEqual({ key: '창체' });
  });
});

describe('차시에 이은 메모 (P10-4)', () => {
  it('이은 메모는 고친 것으로 치지 않고, 저장할 때 지금 문서의 그 행에서 가져온다 (행을 넣어도·지우면 함께 사라진다)', () => {
    const saved = sanitizePlan('p1', { key: '국어', startDate: '2026-09-01', lessons: [lesson('가'), { ...lesson('나'), linkIds: ['m1'] }], bumps: [] });
    expect(saved.lessons[1].linkIds).toEqual(['m1']);
    const d = toDraft(saved, false);
    expect(sameAsSaved(d, saved)).toBe(true);
    // 창을 연 채 수업 칸에서 '가'에 메모를 이었다 (문서만 바뀜)
    const doc = [{ ...lesson('가'), linkIds: ['m9'] }, { ...lesson('나'), linkIds: ['m1'] }];
    const { lessons } = insertRowAfter(d.lessons, -1);
    lessons[0] = { ...lessons[0], content: '새' };
    expect(lessonsToSave(lessons, doc).map((l) => [l.content, l.linkIds])).toEqual([
      ['새', undefined],
      ['가', ['m9']],
      ['나', ['m1']],
    ]);
    expect(lessonsToSave(lessons.filter((l) => l.content !== '나'), doc).map((l) => l.linkIds)).toEqual([undefined, ['m9']]);
  });
});
