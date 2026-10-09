// 명렬표에서 고치는 것 (V4 RosterModal의 currentClasses) - 💾 저장 전까지 여기에. 학급 화면을 떠났다 와도 고치던 것이 남는다(이 탭에서만).
//   고친 것이 없으면 서버(기기 사본)를 따라간다 - 다른 기기에서 고친 명렬표가 들어오면 그것으로.
import { create } from 'zustand';
import { newId } from '../../data/id';
import { academicYearOf, todayStr } from '../../domain/dateUtils';
import { addStudents, classIdOf, cleanStudent, nextClassNum, type RosterStudent } from '../../domain/roster';
import type { ClassDraft, ClassItem } from './classes';

interface DraftState {
  /** 고치는 학급들 (null = 아직 서버를 따라간다) */
  drafts: ClassDraft[] | null;
  /** 지금 고른 학급 (drafts 안의 자리) */
  index: number;
}

export const useRosterDraft = create<DraftState>(() => ({ drafts: null, index: 0 }));

const normalize = (list: readonly ClassDraft[]) =>
  JSON.stringify(
    list
      .map((c) => ({ id: classIdOf(c), origId: c.origId ?? null, name: c.name?.trim() || '', students: c.students.map(cleanStudent).sort((a, b) => a.num - b.num) }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  );

/** 저장된 학급 → 고칠 것 */
export const draftsOf = (classes: readonly ClassItem[]): ClassDraft[] =>
  classes.length
    ? classes.map((c) => ({ year: c.year, grade: c.grade, num: c.num, ...(c.name ? { name: c.name } : {}), students: c.students.map((s) => ({ ...s })), origId: c.id }))
    : [{ year: academicYearOf(todayStr()), grade: 1, num: 1, students: [] }];

/** 고친 것이 있나 (저장된 학급과 견준다 - 학급이 없을 때 처음 보이는 빈 1학년 1반은 빼고) */
export function isDirty(drafts: readonly ClassDraft[] | null, classes: readonly ClassItem[]): boolean {
  if (!drafts) return false;
  const base = draftsOf(classes);
  const meaningful = classes.length === 0 ? drafts.filter((d) => d.students.length > 0 || d.name) : drafts;
  return normalize(meaningful) !== normalize(classes.length === 0 ? [] : base);
}

const update = (fn: (drafts: ClassDraft[], index: number) => Partial<DraftState> | void, classes: readonly ClassItem[]) => {
  const s = useRosterDraft.getState();
  const drafts = (s.drafts ?? draftsOf(classes)).map((d) => ({ ...d, students: [...d.students] }));
  const patch = fn(drafts, s.index) ?? {};
  useRosterDraft.setState({ drafts, index: s.index, ...patch });
};

export const draftActions = (classes: readonly ClassItem[]) => ({
  select: (index: number) => useRosterDraft.setState({ index, drafts: useRosterDraft.getState().drafts }),
  setMeta: (field: 'year' | 'grade' | 'num' | 'name', value: number | string) =>
    update((d, i) => {
      d[i] = { ...d[i], [field]: value };
    }, classes),
  addClass: () =>
    update((d, i) => {
      const cur = d[i] ?? { year: academicYearOf(todayStr()), grade: 1 };
      d.push({ year: cur.year, grade: cur.grade, num: nextClassNum(d, cur.year, cur.grade), students: [] });
      return { index: d.length - 1 };
    }, classes),
  removeClass: () =>
    update((d, i) => {
      d.splice(i, 1);
      if (d.length === 0) d.push({ year: academicYearOf(todayStr()), grade: 1, num: 1, students: [] });
      return { index: Math.max(0, i - 1) };
    }, classes),
  addStudents: (count: number) =>
    update((d, i) => {
      d[i] = { ...d[i], students: addStudents(d[i].students, count, newId) };
    }, classes),
  setStudent: (row: number, patch: Partial<RosterStudent>) =>
    update((d, i) => {
      const students = [...d[i].students];
      students[row] = { ...students[row], ...patch };
      d[i] = { ...d[i], students };
    }, classes),
  removeStudent: (row: number) =>
    update((d, i) => {
      d[i] = { ...d[i], students: d[i].students.filter((_, k) => k !== row) };
    }, classes),
  setStudents: (students: RosterStudent[]) =>
    update((d, i) => {
      d[i] = { ...d[i], students };
    }, classes),
  /** 모든 학급 CSV - 같은 학급은 명단을 바꾸고 없으면 더한다(파일에 없는 학급은 그대로) */
  mergeClasses: (incoming: ClassDraft[]) =>
    update((d) => {
      for (const c of incoming) {
        const at = d.findIndex((x) => classIdOf(x) === classIdOf(c));
        if (at >= 0) d[at] = { ...d[at], students: c.students };
        else d.push(c);
      }
      return { index: 0 };
    }, classes),
  /** 저장했거나 버렸다 - 다시 서버를 따라간다 */
  reset: () => useRosterDraft.setState({ drafts: null }),
});
