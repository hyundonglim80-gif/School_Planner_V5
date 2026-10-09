import { describe, expect, it } from 'vitest';
import { DELETE_FIELD, SERVER_TIME, toWrite, type WriteOp } from '../../data/repo/ops';
import { classIdOfKey, classIdOfV4, planClasses, studentSid, v4Rosters, type ExistingClassDocs, type V4ClassDocs } from './classes';
import { changedTotal } from './plan';

// V4 학급 → V5 (P7-5)

const SID = 'u_me';
const TODAY = '2026-10-09';
const TS = { seconds: 1, nanoseconds: 0 };

const v4 = (): V4ClassDocs => ({
  rosters: {
    classList: [
      {
        year: 2026,
        grade: '5',
        classNum: '2',
        students: [
          { num: 1, name: '김하나', gender: 'F', isActive: true, note: '안경' },
          { num: 2, name: '이 둘', gender: '남', isActive: true },
          { num: 3, name: '박셋', gender: 'M', isActive: false },
        ],
      },
      { year: 2026, grade: '특수', classNum: '1', students: [] },
    ],
  },
  attendance: {
    '2026_5_2_2026-10-05': { classKey: '2026_5_2', year: 2026, grade: '5', classNum: '2', date: '2026-10-05', records: { 2: { num: 2, name: '이 둘', kind: 'late', reason: 'sick', periods: [2, 1] } } },
    '2026_5_2_2026-10-06': { classKey: '2026_5_2', date: '2026-10-06', records: {} },
  },
  subjectAttendance: {
    '2026_5_2_2026-10-05': { classKey: '2026_5_2', date: '2026-10-05', periods: { 3: { 1: { num: 1, name: '김하나', kind: 'absent', reason: 'other', note: '체험' } } } },
  },
  notices: { '2026-10-05': { date: '2026-10-05', lines: ['준비물: 색연필', ' '] } },
  evaluations: {
    '2026-10-05': {
      list: [{ id: 'eval_a', title: '옛 목록' }],
      evalList: [
        {
          id: 'eval_a',
          title: '단원평가',
          subject: '수학',
          type: 'eval',
          methodObj: { indiv: true, group: true },
          steps: ['잘함', '보통'],
          groups: [{ name: 'A조', members: [1, 2] }],
          dateStr: '2026-10-05',
          periodStr: 3,
          context: { source: 'schedule', period: 3 },
          rosterMeta: { year: 2026, grade: '5', classNum: '2' },
          studentsSnapshot: [
            { num: 1, name: '김하나', gender: 'F' },
            { num: 3, name: '박셋 (전출/삭제됨)', gender: 'M' },
          ],
          records: { 1: { indivScore: '잘함', groupScore: '보통', reason: ' 식 ' }, 3: { score: '보통' }, 2: {} },
        },
        { id: 'eval_b', title: '준비물', type: 'check', periodStr: '', context: { source: 'journal', period: '' }, rosterMeta: { year: 2026, grade: '5', classNum: '2' }, studentsSnapshot: [], records: { 2: { checked: false } } },
        { id: 'eval_c', title: '학급 모름', type: 'memo', rosterMeta: {}, records: {} },
      ],
    },
  },
  seating: {
    st_1: { classKey: '2026_5_2', name: '10월', rows: 2, cols: 2, groupCols: 2, front: 'top', seats: { '0-0': 1, '0-1': 2 }, off: [], locked: ['0-0'], history: [{ at: 5, pairs: ['1-2'] }] },
  },
  classHub: {
    '2026_5_2': { apart: ['1-2', 'x'], draw: { picked: [2], round: 3 }, groupSets: { g1: { name: '실험', groups: [{ name: '1모둠', members: [1, 2] }], createdAt: 1, updatedAt: 2 } } },
  },
  photoQuiz: { records: { '2026-5-2-이둘': { o: 2, x: 1, streak: 2, seenAt: 9 }, '2026-5-2-없는사람': { o: 1, x: 0, streak: 1 } } },
});

const NONE: ExistingClassDocs = { classes: {}, attendance: {}, subjectAttendance: {}, notices: {}, evaluations: {}, seating: {}, classHub: {}, quiz: {} };
const C = '2026-5-2';
const sidOf = (num: number) => studentSid(SID, `${C}#${num}`);

/** 쓰기 묶음을 V5 문서 모음에 입힌다 (서버가 적은 것처럼) */
function apply(existing: ExistingClassDocs, ops: WriteOp[]): ExistingClassDocs {
  const out = Object.fromEntries(Object.entries(existing).map(([k, v]) => [k, { ...v }])) as Record<string, Record<string, Record<string, unknown>>>;
  for (const op of ops) {
    const w = toWrite(op, { uid: 'me', now: 1 });
    const coll = (out[op.at.coll] ??= {});
    const id = op.at.id;
    const fix = (data: Record<string, unknown>) =>
      Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v === SERVER_TIME ? TS : v]).filter(([, v]) => v !== DELETE_FIELD));
    if (w.kind === 'set') coll[id] = { ...fix(w.data), id };
    else if (w.kind === 'update') {
      const next: Record<string, unknown> = { ...coll[id], ...fix(w.data) };
      for (const [k, v] of Object.entries(w.data)) if (v === DELETE_FIELD) delete next[k];
      coll[id] = next;
    } else delete coll[id];
  }
  return out as unknown as ExistingClassDocs;
}

const total = (counts: Record<string, { added: number; changed: number; removed: number; same: number; kept: number }>) =>
  Object.values(counts).reduce((n, c) => n + changedTotal(c), 0);

describe('V4 학급 읽기', () => {
  it('학급 id: 학년도·학년·반이 숫자일 때만, 학급 키 2026_5_2', () => {
    expect(classIdOfV4({ year: 2026, grade: '05', classNum: '2' })).toBe('2026-5-2');
    expect(classIdOfV4({ year: 2026, grade: '특수', classNum: '1' })).toBeNull();
    expect(classIdOfKey('2026_5_2')).toBe('2026-5-2');
    expect(classIdOfKey('2026_5')).toBeNull();
  });
  it('명렬표: classList → rosters → list, 없으면 V3 옛 한 학급, 학년도가 없으면 그해', () => {
    expect(v4Rosters({ rosters: [{ grade: '1' }] }, undefined, 2026)).toEqual([{ grade: '1', year: 2026 }]);
    expect(v4Rosters(undefined, { grade: '3', classNum: '1', year: 2025 }, 2026)).toEqual([{ grade: '3', classNum: '1', year: 2025 }]);
    expect(v4Rosters(undefined, undefined, 2026)).toEqual([]);
  });
});

describe('planClasses', () => {
  const r = planClasses(SID, v4(), NONE, { today: TODAY });
  const docs = apply(NONE, r.ops);

  it('명렬표 → 학급, 학생마다 셈한 sid(번호로), 성별 남/여 → M/F, 전출, 숫자가 아닌 학급은 뺀다', () => {
    const cls = docs.classes[C];
    expect(cls).toMatchObject({ year: 2026, grade: 5, num: 2, src: { from: 'v4', path: 'settings/rosters', id: C } });
    expect(cls.students).toEqual([
      { sid: sidOf(1), num: 1, name: '김하나', gender: 'F', status: 'active', note: '안경' },
      { sid: sidOf(2), num: 2, name: '이 둘', gender: 'M', status: 'active' },
      { sid: sidOf(3), num: 3, name: '박셋', gender: 'M', status: 'out' },
    ]);
    expect(r.notes.classSkipped).toBe(1);
    expect(r.counts.classes.added).toBe(1);
  });

  it('출결: 번호 → sid, 교시 차례, 빈 문서는 뺀다 / 교과 출결 · 알림장', () => {
    expect(Object.keys(docs.attendance)).toEqual([`${C}_2026-10-05`]);
    expect(docs.attendance[`${C}_2026-10-05`]).toMatchObject({ classId: C, date: '2026-10-05', records: { [sidOf(2)]: { kind: 'late', reason: 'sick', periods: [1, 2] } } });
    expect(docs.subjectAttendance[`${C}_2026-10-05`].periods).toEqual({ '3': { [sidOf(1)]: { kind: 'absent', reason: 'other', note: '체험' } } });
    expect(docs.notices['2026-10-05']).toMatchObject({ date: '2026-10-05', lines: ['준비물: 색연필'] });
  });

  it('조사표: evalList 먼저, 한 장씩, 학생 칸 → sid, 옛 score, 전출 표시 → out, 기록 칸 = period null, 학급을 모르면 뺀다', () => {
    const evals = Object.values(docs.evaluations).sort((a, b) => a.title.localeCompare(b.title, 'ko'));
    expect(evals.map((e) => e.title)).toEqual(['단원평가', '준비물']);
    const [a, b] = evals;
    expect(a).toMatchObject({
      date: '2026-10-05',
      period: 3,
      classId: C,
      type: 'eval',
      subject: '수학',
      indiv: true,
      group: true,
      steps: ['잘함', '보통'],
      groups: [{ name: 'A조', members: [sidOf(1), sidOf(2)] }],
      students: [
        { sid: sidOf(1), num: 1, name: '김하나' },
        { sid: sidOf(3), num: 3, name: '박셋', out: true },
      ],
      values: { [sidOf(1)]: { indiv: '잘함', group: '보통', reason: '식' }, [sidOf(3)]: { indiv: '보통' } },
    });
    expect(b).toMatchObject({ period: null, type: 'check', values: { [sidOf(2)]: { checked: false } } });
    expect(b.indiv).toBeUndefined();
    expect(r.notes.noClass).toBe(1);
  });

  it('자리표·학급 허브: 번호 → sid, 짝 → sidA|sidB', () => {
    const chart = Object.values(docs.seating)[0];
    expect(chart).toMatchObject({ classId: C, name: '10월', rows: 2, cols: 2, seats: { '0-0': sidOf(1), '0-1': sidOf(2) }, locked: ['0-0'] });
    const pair = [sidOf(1), sidOf(2)].sort().join('|');
    expect(chart.history).toEqual([{ at: 5, pairs: [pair] }]);
    expect(docs.classHub[C]).toMatchObject({
      apart: [pair],
      draw: { picked: [sidOf(2)], round: 3 },
      groupSets: { g1: { name: '실험', groups: [{ name: '1모둠', members: [sidOf(1), sidOf(2)] }], createdAt: 1, updatedAt: 2 } },
    });
  });

  it('암기: 이름 열쇠(빈칸 없이) → 그 학급의 sid, 명렬표에 없는 이름은 버린다', () => {
    expect(docs.quiz[C].records).toEqual({ [sidOf(2)]: { o: 2, x: 1, streak: 2, seenAt: 9 } });
    expect(r.notes.quizDropped).toBe(1);
  });

  it('학생 태그 #26050201 → studentIds (명렬표에 없는 것은 건너뛴다)', () => {
    expect(r.studentKeysOf('#26050201 발표, #26050209')).toEqual([`${C}/${sidOf(1)}`]);
  });

  it('두 번째 가져오기는 바뀐 것 0', () => {
    const again = planClasses(SID, v4(), docs, { today: TODAY });
    expect(again.ops).toEqual([]);
    expect(total(again.counts)).toBe(0);
  });

  it('V5에서 고친 학급은 둔다 - 출결은 그 V5 명렬표의 번호로 sid를 찾는다', () => {
    const edited = { ...docs.classes[C], students: [{ sid: 'mine', num: 2, name: '이둘', status: 'active' as const }] };
    const again = planClasses(SID, v4(), { ...docs, classes: { [C]: edited } }, { today: TODAY });
    expect(again.counts.classes.kept).toBe(1);
    const op = again.ops.find((o) => o.at.coll === 'attendance');
    expect(op?.type === 'patch' && op.changes.records).toEqual({ mine: { kind: 'late', reason: 'sick', periods: [1, 2] } });
  });

  it('V4에서 없어지면: 조사표·자리표는 지운 표시, 출결·알림장·허브·암기는 칸을 비운다(다시 하면 0)', () => {
    const empty: V4ClassDocs = { ...v4(), attendance: {}, subjectAttendance: {}, notices: {}, evaluations: {}, seating: {}, classHub: {}, photoQuiz: undefined };
    const gone = planClasses(SID, empty, docs, { today: TODAY });
    expect(gone.counts.evaluations.removed).toBe(2);
    expect(gone.counts.seating.removed).toBe(1);
    expect(gone.counts.attendance.removed).toBe(1);
    expect(gone.counts.classHub.removed).toBe(1);
    expect(gone.counts.quiz.removed).toBe(1);
    const after = apply(docs, gone.ops);
    expect(after.attendance[`${C}_2026-10-05`].records).toEqual({});
    expect(after.notices['2026-10-05'].lines).toEqual([]);
    expect(after.classHub[C].apart).toBeUndefined();
    expect(Object.values(after.evaluations).every((e) => !!e.deletedAt)).toBe(true);
    const again = planClasses(SID, empty, after, { today: TODAY });
    expect(total(again.counts)).toBe(0);
    expect(again.ops).toEqual([]);
  });

  it('V5에서 적은 출결(가져오지 않은 문서)은 건드리지 않는다', () => {
    const mine = { [`${C}_2026-10-05`]: { id: `${C}_2026-10-05`, classId: C, date: '2026-10-05', records: { x: { kind: 'absent', reason: 'sick' } } } };
    const again = planClasses(SID, v4(), { ...NONE, attendance: mine as never }, { today: TODAY });
    expect(again.counts.attendance.kept).toBe(1);
    expect(again.ops.some((o) => o.at.coll === 'attendance')).toBe(false);
  });
});
