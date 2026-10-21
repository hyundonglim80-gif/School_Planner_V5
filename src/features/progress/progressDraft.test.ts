import { describe, expect, it } from 'vitest';
import {
  cleanLessons,
  draftForSlot,
  draftTarget,
  emptyLesson,
  expandRowRepeat,
  growMarked,
  growRow,
  insertRowAfter,
  lessonsToSave,
  newCourseDraft,
  newDraft,
  sameAsSaved,
  toDraft,
  withKey,
  type Draft,
} from './progressDraft';
import { isOrderNumbered, sanitizePlan, type ProgressPlan } from '../../domain/progress';

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

describe('차시 칸을 고치면 행 늘리기', () => {
  it('2면 같은 내용을 2행으로, 다시 해도 더 늘지 않는다', () => {
    const rows = [withKey({ ...lesson('가'), no: '2' }), withKey(lesson('나'))];
    const once = expandRowRepeat(rows, 0);
    expect(once.map((l) => [l.content, l.no])).toEqual([['가', '2'], ['가', ''], ['나', '']]);
    expect(expandRowRepeat(once, 0)).toBe(once);
  });
  it('숫자가 아니거나 1이면 그대로', () => {
    const rows = [withKey({ ...lesson('가'), no: '1' }), withKey({ ...lesson('나'), no: '가' })];
    expect(expandRowRepeat(rows, 0)).toBe(rows);
    expect(expandRowRepeat(rows, 1)).toBe(rows);
  });

  // 10-21: 새 행을 왼쪽부터(단원 → 차시 → 내용) 적으면 차시 칸을 벗어날 때 내용이 없어 늘지 않았다
  it('차시 칸을 내용보다 먼저 적어도 - 내용이 생긴 뒤 늘리고 표시를 뗀다', () => {
    const typed = [{ ...withKey({ ...lesson(''), no: '2' }), _grow: true }];
    expect(growRow(typed, 0)).toBe(typed); // 내용이 없으면 기다린다
    const filled = [{ ...typed[0], content: '작은 공' }, withKey(lesson('다음'))];
    const grown = growRow(filled, 0);
    expect(grown.map((l) => [l.content, l.no])).toEqual([['작은 공', '2'], ['작은 공', ''], ['다음', '']]);
    expect(grown[0]._grow).toBeUndefined();
    expect(grown[0]._k).toBe(typed[0]._k);
    expect(growRow(grown, 0)).toBe(grown);
  });

  it('저장 직전 - 차시 칸을 고친 행만 모두 (뒤 행 번호가 밀려도)', () => {
    const rows = [
      { ...withKey({ ...lesson('가'), no: '2' }), _grow: true },
      withKey({ ...lesson('나'), no: '3' }), // 고치지 않은 행은 그대로
      { ...withKey({ ...lesson('다'), no: '3' }), _grow: true },
    ];
    expect(growMarked(rows).map((l) => l.content)).toEqual(['가', '가', '나', '다', '다', '다']);
  });

  it("저장한 표를 열 때 - 차시 칸 '1, 2' = 1차시 + 2차시 = 3행, 이미 늘린 표·차례 번호 표는 그대로", () => {
    const saved = plan({ lessons: [{ ...lesson('왕복오래달리기'), no: '1' }, { ...lesson('작은 공을 치고 받아요'), no: '2' }] });
    const d = toDraft(saved, false);
    expect(d.lessons.map((l) => [l.content, l.no, l._from])).toEqual([
      ['왕복오래달리기', '1', 0],
      ['작은 공을 치고 받아요', '2', 1],
      ['작은 공을 치고 받아요', '', undefined],
    ]);
    expect(d.grown).toBe(1);
    expect(sameAsSaved(d, saved)).toBe(false); // 저장해야 수업 칸에 반영
    const again = plan({ lessons: lessonsToSave(d.lessons, saved.lessons) });
    expect(toDraft(again, false).lessons).toHaveLength(3);
    expect(toDraft(again, false).grown).toBeUndefined();
    // 10-07 전에 붙여 넣은 1, 2, 3 … 차례 번호 표
    const ordered = plan({ lessons: ['1', '2', '3', '4'].map((no, i) => ({ ...lesson(`내용${i}`), no })) });
    expect(toDraft(ordered, false).lessons).toHaveLength(4);
  });
});

describe('차시 칸이 차례 번호인 옛 표 (isOrderNumbered)', () => {
  const nos = (...list: string[]) => list.map((no) => ({ no }));
  it('셋 이상 늘 커지거나, 범위가 있거나, 10을 넘으면 차례 번호', () => {
    expect(isOrderNumbered(nos('1', '2', '3'))).toBe(true);
    expect(isOrderNumbered(nos('5', '', '6', '7'))).toBe(true);
    expect(isOrderNumbered(nos('1', '2~3'))).toBe(true);
    expect(isOrderNumbered(nos('11', '12'))).toBe(true);
  });
  it('둘뿐이거나 커지지 않으면 차시 수', () => {
    expect(isOrderNumbered(nos('1', '2'))).toBe(false);
    expect(isOrderNumbered(nos('1', '2', '1'))).toBe(false);
    expect(isOrderNumbered(nos('2', '', '2', '2'))).toBe(false);
    expect(isOrderNumbered(nos('', ''))).toBe(false);
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
