import { describe, expect, it } from 'vitest';
import type { WriteOp } from '../../data/repo/ops';
import type { Stored } from '../../data/types';
import { addDays } from '../../domain/dateUtils';
import { timetableOn } from '../../domain/lessons';
import { isAppliedTimetable } from '../../domain/timetableApply';
import { applyOps, cleanGrid, firstTimetable, savedCopies, savedCopyOps, timetableOps } from './timetableDraft';

const doc = (id: string, over: Partial<Stored<'timetables'>> = {}) =>
  ({ id, name: '1학기', from: '2026-03-01', to: '2027-02-28', grid: { '1': { '1': '국어' } }, deletedAt: null, ...over }) as Stored<'timetables'>;
const saved = (id: string, over: Partial<Stored<'timetables'>> = {}) => doc(id, { kind: 'saved', from: '', to: '', ...over });
const at = (id: string) => ({ sid: 'u_me', coll: 'timetables', id });

/** 쓰기를 사본에 얹어 본다 (create·patch·remove만) */
function run(docs: Record<string, Stored<'timetables'>>, ops: WriteOp[]) {
  const out = { ...docs };
  for (const op of ops) {
    const id = op.at.id;
    if (op.type === 'create') out[id] = { id, ...op.data, deletedAt: null } as never;
    else if (op.type === 'patch') out[id] = { ...out[id], ...op.changes } as never;
    else if (op.type === 'remove') out[id] = { ...out[id], deletedAt: 1 } as never;
  }
  return out;
}
const live = (docs: Record<string, Stored<'timetables'>>) => Object.values(docs).filter((d) => !d.deletedAt && isAppliedTimetable(d));
/** 그날 수업 칸이 따르는 표의 월 1교시 */
const subjectOn = (docs: Record<string, Stored<'timetables'>>, date: string) => timetableOn(date, live(docs))?.grid['1']?.['1'] ?? '';
const ids = () => {
  let n = 0;
  return () => `new${++n}`;
};

describe('시간표 표 다듬기', () => {
  it('빈 칸·요일 밖·교시 밖을 빼고 글자를 다듬는다', () => {
    expect(cleanGrid({ '1': { '1': ' 국어 ', '2': '', '9': '보충' }, '6': { '1': '토' }, '3': { '2': '  ' } }, 6)).toEqual({ '1': { '1': '국어' } });
  });
});

describe('💾 저장 = 저장된 시간표만', () => {
  const docs = { a: saved('a'), b: saved('b', { name: '2학기' }), gone: saved('gone', { deletedAt: 1 as never }), applied: doc('applied') };

  it('바뀐 칸만 고치고, 새것은 이름·표만으로 만들고, 지운 것은 지운 표시 - 적용된 문서는 건드리지 않는다', () => {
    const ops = timetableOps(
      'u_me',
      docs,
      {
        a: { id: 'a', name: '1학기', grid: { '1': { '1': '국어', '2': '수학' } } },
        b: { id: 'b', name: ' 2학기 ', grid: { '1': { '1': ' 국어' } } },
        n: { id: 'n', name: '', grid: { '3': { '1': '음악' } } },
      },
      ['b'],
      6,
    );
    expect(ops).toEqual([
      { type: 'patch', at: at('a'), changes: { grid: { '1': { '1': '국어', '2': '수학' } } }, before: docs.a },
      { type: 'create', at: at('n'), data: { kind: 'saved', name: '시간표', from: '', to: '', grid: { '3': { '1': '음악' } } } },
      { type: 'remove', at: at('b') },
    ]);
  });

  it('아무것도 적지 않은 새 시간표는 만들지 않는다, 바뀐 것이 없으면 쓰지 않는다', () => {
    expect(timetableOps('u_me', docs, { x: firstTimetable('x'), a: { id: 'a', name: '1학기', grid: docs.a.grid } }, [], 6)).toEqual([]);
  });

  it('저장된 시간표를 지워도 수업 칸은 그대로 (P37 사용자 보고)', () => {
    const before = { s: saved('s'), t: doc('t', { saveId: 's' }) };
    const after = run(before, timetableOps('u_me', before, {}, ['s'], 6));
    expect(after.s.deletedAt).toBeTruthy();
    expect(subjectOn(after, '2026-10-12')).toBe('국어');
  });
});

describe('✅ 적용', () => {
  const input = (name: string, subject: string) => ({ name, grid: { '1': { '1': subject } }, saveId: `s_${name}` });

  it('뒤 기간에 적용하면 앞 문서의 끝을 줄이고 새 문서 하나', () => {
    const docs = { a: doc('a', { saveId: 's_1' }) };
    const ops = applyOps('u_me', docs, { from: '2026-10-14', to: '2027-02-28' }, input('10월', '음악'), 6, ids());
    expect(ops).toEqual([
      { type: 'patch', at: at('a'), changes: { to: '2026-10-13' }, before: docs.a },
      { type: 'create', at: at('new1'), data: { name: '10월', from: '2026-10-14', to: '2027-02-28', grid: { '1': { '1': '음악' } }, saveId: 's_10월' } },
    ]);
  });

  it('같은 기간에 다시 적용하면 그 문서를 고쳐 쓴다 (휴지통이 쌓이지 않게)', () => {
    const docs = { a: doc('a') };
    const ops = applyOps('u_me', docs, { from: '2026-03-01', to: '2027-02-28' }, input('1학기', '도덕'), 6, ids());
    expect(ops).toEqual([
      { type: 'patch', at: at('a'), changes: { name: '1학기', from: '2026-03-01', to: '2027-02-28', grid: { '1': { '1': '도덕' } }, saveId: 's_1학기' }, before: docs.a },
    ]);
  });

  it('가운데에 적용하면 앞 문서가 둘로 (뒤 조각은 같은 표·같은 saveId) · 저장된 시간표는 그대로', () => {
    const docs = { a: doc('a', { saveId: 's_1' }), s: saved('s') };
    const after = run(docs, applyOps('u_me', docs, { from: '2026-05-01', to: '2026-05-31' }, input('5월', '체육'), 6, ids()));
    expect(after.new1).toMatchObject({ from: '2026-06-01', to: '2027-02-28', grid: { '1': { '1': '국어' } }, saveId: 's_1' });
    expect(after.s).toEqual(docs.s);
    expect(['2026-04-30', '2026-05-01', '2026-05-31', '2026-06-01'].map((d) => subjectOn(after, d))).toEqual(['국어', '체육', '체육', '국어']);
  });

  it('✕ 빼기 = 그 날들만 비운다', () => {
    const docs = { a: doc('a') };
    const after = run(docs, applyOps('u_me', docs, { from: '2026-12-01', to: '2026-12-31' }, null, 6, ids()));
    expect(['2026-11-30', '2026-12-15', '2027-01-01'].map((d) => subjectOn(after, d))).toEqual(['국어', '', '국어']);
  });

  it('여러 번 적용하면 날마다 마지막에 적용한 표 (옛 겹친 자료에서 시작해도)', () => {
    // 옛 자료: 1학기 3/1~, 2학기 9/1~ (늦게 시작한 것이 이긴다)
    let docs: Record<string, Stored<'timetables'>> = { a: doc('a'), b: doc('b', { from: '2026-09-01', grid: { '1': { '1': '2학기' } } }) };
    const paint: Record<string, string> = {};
    for (let d = '2026-03-01'; d <= '2027-02-28'; d = addDays(d, 1)) paint[d] = d < '2026-09-01' ? '국어' : '2학기';
    const steps: Array<[string, string, string | null]> = [
      ['2026-09-10', '2026-09-20', '가'],
      ['2026-08-01', '2026-10-31', '나'],
      ['2026-09-15', '2026-09-15', null],
      ['2026-03-01', '2026-03-31', '다'],
      ['2026-12-01', '2027-02-28', '라'],
      ['2026-09-01', '2027-01-15', '마'],
    ];
    const next = ids();
    for (const [from, to, subject] of steps) {
      docs = run(docs, applyOps('u_me', docs, { from, to }, subject ? input(subject, subject) : null, 6, next));
      for (let d = from; d <= to; d = addDays(d, 1)) paint[d] = subject ?? '';
      // 적용한 뒤에는 적용된 문서끼리 날이 겹치지 않는다
      const list = live(docs);
      for (const x of list) for (const y of list) if (x !== y) expect(x.to < y.from || y.to < x.from, `${x.id}·${y.id} 겹침`).toBe(true);
    }
    for (const [d, want] of Object.entries(paint)) expect(subjectOn(docs, d), d).toBe(want);
  });
});

describe('🧩 빈 칸만 채우기 (P39 사용자 요청)', () => {
  const input = (name: string, grid: Record<string, Record<string, string>>) => ({ name, grid, saveId: `s_${name}` });
  /** 그날 수업 칸이 따르는 표의 그 칸 글자 */
  const cellOn = (docs: Record<string, Stored<'timetables'>>, date: string, wd: string, n: string) => timetableOn(date, live(docs))?.grid[wd]?.[n] ?? '';

  it('가운데 기간을 채우면 앞 표가 셋으로 - 가운데는 채운 표(이름 A + B, 앞 표의 saveId), 앞 표 과목은 그대로', () => {
    const docs = { a: doc('a', { name: '1학기', saveId: 's_1', grid: { '1': { '1': '국어', '2': '수학' } } }) };
    const after = run(docs, applyOps('u_me', docs, { from: '2026-10-05', to: '2026-10-30' }, input('방과후', { '1': { '1': '체육', '5': '방과후' } }), 6, ids(), 'fill'));
    const made = Object.values(after).filter((d) => d.id !== 'a');
    expect(after.a).toMatchObject({ from: '2026-03-01', to: '2026-10-04' });
    expect(made).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: '1학기 + 방과후', from: '2026-10-05', to: '2026-10-30', grid: { '1': { '1': '국어', '2': '수학', '5': '방과후' } }, saveId: 's_1' }),
        expect.objectContaining({ name: '1학기', from: '2026-10-31', to: '2027-02-28', grid: { '1': { '1': '국어', '2': '수학' } }, saveId: 's_1' }),
      ]),
    );
    expect(['2026-10-02', '2026-10-05', '2026-10-30', '2026-11-02'].map((d) => [cellOn(after, d, '1', '1'), cellOn(after, d, '1', '5')])).toEqual([
      ['국어', ''],
      ['국어', '방과후'],
      ['국어', '방과후'],
      ['국어', ''],
    ]);
  });

  it('적용된 표가 없는 날은 새 표 그대로 · 채울 칸이 없으면 쓰지 않는다 · 다 덮인 문서는 고쳐 쓴다', () => {
    const docs = { a: doc('a', { from: '2026-03-02', to: '2026-07-20' }) };
    // 1학기는 이미 그 칸(월 1교시)이 있어 채울 것이 없다 → 2학기(적용된 표 없음)만 새 표
    const ops = applyOps('u_me', docs, { from: '2026-03-02', to: '2027-02-28' }, input('2학기', { '1': { '1': '도덕' } }), 6, ids(), 'fill');
    expect(ops).toEqual([
      { type: 'create', at: at('new1'), data: { name: '2학기', from: '2026-07-21', to: '2027-02-28', grid: { '1': { '1': '도덕' } }, saveId: 's_2학기' } },
    ]);
    expect(applyOps('u_me', docs, { from: '2026-04-01', to: '2026-04-30' }, input('같은', { '1': { '1': '도덕' } }), 6, ids(), 'fill')).toEqual([]);
    // 앞 문서가 기간 안에 다 들면 그 문서를 채운 표로 고쳐 쓴다(휴지통이 쌓이지 않게)
    const whole = applyOps('u_me', docs, { from: '2026-03-01', to: '2026-07-31' }, input('더', { '2': { '3': '영어' } }), 6, ids(), 'fill');
    expect(whole).toEqual([
      { type: 'create', at: at('new1'), data: { name: '더', from: '2026-03-01', to: '2026-03-01', grid: { '2': { '3': '영어' } }, saveId: 's_더' } },
      {
        type: 'patch',
        at: at('a'),
        changes: { name: '1학기 + 더', from: '2026-03-02', to: '2026-07-20', grid: { '1': { '1': '국어' }, '2': { '3': '영어' } }, saveId: 's_더' },
        before: docs.a,
      },
      { type: 'create', at: at('new2'), data: { name: '더', from: '2026-07-21', to: '2026-07-31', grid: { '2': { '3': '영어' } }, saveId: 's_더' } },
    ]);
  });

  it('덮어쓰기·채우기·빼기를 섞어 여러 번 - 날마다·칸마다 마지막 뜻대로, 적용된 문서끼리 겹치지 않는다', () => {
    let docs: Record<string, Stored<'timetables'>> = { a: doc('a', { grid: { '1': { '1': '국어' } } }) };
    // 날 → 월 1·2교시 (기대값)
    const paint: Record<string, [string, string]> = {};
    for (let d = '2026-03-01'; d <= '2027-02-28'; d = addDays(d, 1)) paint[d] = ['국어', ''];
    const steps: Array<[string, string, 'replace' | 'fill' | null, [string, string]]> = [
      ['2026-05-01', '2026-06-30', 'fill', ['체육', '수학']],
      ['2026-06-01', '2026-07-31', 'replace', ['', '과학']],
      ['2026-06-15', '2026-09-15', 'fill', ['음악', '미술']],
      ['2026-08-01', '2026-08-31', null, ['', '']],
      ['2026-07-20', '2026-10-10', 'fill', ['도덕', '']],
      ['2027-02-01', '2027-03-31', 'fill', ['영어', '영어']],
    ];
    const next = ids();
    for (const [from, to, mode, [p1, p2]] of steps) {
      const grid = { '1': { '1': p1, '2': p2 } };
      docs = run(docs, applyOps('u_me', docs, { from, to }, mode ? input(`${p1}${p2}`, grid) : null, 6, next, mode ?? 'replace'));
      for (let d = from; d <= to; d = addDays(d, 1)) {
        const was = paint[d] ?? ['', ''];
        paint[d] = mode === 'fill' ? [was[0] || p1, was[1] || p2] : mode === 'replace' ? [p1, p2] : ['', ''];
      }
      const list = live(docs);
      for (const x of list) for (const y of list) if (x !== y) expect(x.to < y.from || y.to < x.from, `${x.id}·${y.id} 겹침`).toBe(true);
    }
    for (const [d, want] of Object.entries(paint)) expect([cellOn(docs, d, '1', '1'), cellOn(docs, d, '1', '2')], d).toEqual(want);
  });
});

describe('P37 전 자료 → 저장된 시간표로 베끼기', () => {
  it('쓰이는 적용된 문서마다 하나(같은 이름·표는 하나로) · saveId가 있거나 늘 가려진 것은 빼고 · 같은 저장된 시간표가 있으면 잇기만', () => {
    const docs = {
      a: doc('a'),
      a2: doc('a2', { from: '2027-03-01', to: '2028-02-29' }),
      b: doc('b', { name: '2학기', from: '2026-09-01' }),
      hidden: doc('hidden', { name: '옛 V4', from: '2026-09-01', to: '2026-12-31', createdAt: -1 }),
      linked: doc('linked', { from: '2028-03-01', to: '2029-02-28', saveId: 'x' }),
      s2: saved('s2', { name: '2학기' }),
    };
    expect(savedCopies(docs)).toEqual([
      { id: 'a-saved', name: '1학기', grid: { '1': { '1': '국어' } }, of: ['a', 'a2'], exists: false },
      { id: 's2', name: '2학기', grid: { '1': { '1': '국어' } }, of: ['b'], exists: true },
    ]);
    const ops = savedCopyOps('u_me', docs);
    expect(ops.map((op) => `${op.type}:${op.at.id}`)).toEqual(['create:a-saved', 'patch:a', 'patch:a2', 'patch:b']);
    const after = run(docs, ops);
    expect(after['a-saved']).toMatchObject({ kind: 'saved', name: '1학기', from: '', to: '' });
    expect(after.b.saveId).toBe('s2');
    expect(savedCopies(after)).toEqual([]); // 한 번이면 끝
  });
});
