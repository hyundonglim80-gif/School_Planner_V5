// 학급·명렬표 셈 (V4 lib/classPicker.ts·rosterCsv.ts·utils/csvHelper.ts) - 순수 함수. 자료 모양은 DESIGN 4-6 (classes/{classId}).
//   classId = '{학년도}-{학년}-{반}' (예 '2026-5-2'). 학생은 sid로 가리킨다 - 번호가 바뀌어도 기록이 따라간다.
//   V4는 학년·반을 글자('5')로 들었다 - V5는 숫자.

/** 명렬표의 학생 (data/types Student와 같은 모양) */
export interface RosterStudent {
  sid: string;
  num: number;
  name: string;
  /** 'M' | 'F' | '' */
  gender?: string;
  status: 'active' | 'out';
  outDate?: string;
  /** 특이사항 (V4 note) */
  note?: string;
}

export interface RosterClass {
  year: number;
  grade: number;
  num: number;
  name?: string;
  students: RosterStudent[];
}

export const classIdOf = (c: Pick<RosterClass, 'year' | 'grade' | 'num'>) => `${c.year}-${c.grade}-${c.num}`;

/** '5-2' (수업 칸·반 색의 반 글자) */
export const classLabelOf = (c: Pick<RosterClass, 'grade' | 'num'>) => `${c.grade}-${c.num}`;

/** '2026학년도 5학년 2반' */
export function describeClass(c: Pick<RosterClass, 'year' | 'grade' | 'num'>): string {
  const parts = [`${c.year}학년도`];
  if (c.grade) parts.push(`${c.grade}학년`);
  if (c.num) parts.push(`${c.num}반`);
  return parts.join(' ');
}

export const isActive = (s: Pick<RosterStudent, 'status'>) => s.status !== 'out';

/** 학급 차례: 학년도 최근 것부터, 학년·반 숫자 차례 */
export const compareClasses = (a: RosterClass, b: RosterClass) => b.year - a.year || a.grade - b.grade || a.num - b.num;

// ── 학년도 / 학년 / 반 세 칸으로 고르기 (V4 classPicker) ──

/** 세 칸에 걸린 값. 빈 문자열은 '전체'(검색 탭에서만) */
export interface ClassPick {
  year: string;
  grade: string;
  num: string;
}

const uniqueSorted = (values: number[]) => [...new Set(values.filter((v) => Number.isFinite(v) && v > 0))].sort((a, b) => a - b).map(String);

/** 학년도 - 최근 것이 앞 */
export const yearOptions = (classes: readonly RosterClass[]) => uniqueSorted(classes.map((c) => c.year)).reverse();
export const gradeOptions = (classes: readonly RosterClass[], year: string) => uniqueSorted(classes.filter((c) => !year || String(c.year) === year).map((c) => c.grade));
export const numOptions = (classes: readonly RosterClass[], year: string, grade: string) =>
  uniqueSorted(classes.filter((c) => (!year || String(c.year) === year) && (!grade || String(c.grade) === grade)).map((c) => c.num));

export const pickOf = (c: RosterClass | undefined): ClassPick => (c ? { year: String(c.year), grade: String(c.grade), num: String(c.num) } : { year: '', grade: '', num: '' });

/** 한 칸을 바꿨을 때 나머지를 고를 수 있는 첫 값으로 추스른다 */
export function reconcilePick(classes: readonly RosterClass[], want: ClassPick): ClassPick {
  const years = yearOptions(classes);
  const year = years.includes(want.year) ? want.year : years[0] || '';
  const grades = gradeOptions(classes, year);
  const grade = grades.includes(want.grade) ? want.grade : grades[0] || '';
  const nums = numOptions(classes, year, grade);
  const num = nums.includes(want.num) ? want.num : nums[0] || '';
  return { year, grade, num };
}

export const indexOfPick = (classes: readonly RosterClass[], p: ClassPick) =>
  classes.findIndex((c) => String(c.year) === p.year && String(c.grade) === p.grade && String(c.num) === p.num);

/** 검색 범위의 학급 - 빈 칸은 전체 */
export const classesInScope = (classes: readonly RosterClass[], p: ClassPick) =>
  classes.filter((c) => (!p.year || String(c.year) === p.year) && (!p.grade || String(c.grade) === p.grade) && (!p.num || String(c.num) === p.num));

// ── 고치기 ──

/** 같은 학년도·학년에서 비어 있는 첫 반 번호 ('+ 새 학급 추가') */
export function nextClassNum(classes: readonly RosterClass[], year: number, grade: number): number {
  const taken = new Set(classes.filter((c) => c.year === year && c.grade === grade).map((c) => c.num));
  let n = 1;
  while (taken.has(n)) n++;
  return n;
}

/** 학생 n명 더하기 (번호는 이어서, 이름은 비워 둔다) */
export function addStudents(students: readonly RosterStudent[], count: number, newSid: () => string): RosterStudent[] {
  const start = students.reduce((m, s) => Math.max(m, s.num), 0) + 1;
  return [...students, ...Array.from({ length: Math.max(0, Math.min(50, count)) }, (_, i) => ({ sid: newSid(), num: start + i, name: '', gender: '', status: 'active' as const }))];
}

// ── 성별 글자 ──

export function genderToText(gender?: string): string {
  if (gender === 'M') return '남';
  if (gender === 'F') return '여';
  return '';
}

/** 남/여/M/F/male/female 을 모두 받는다 (엑셀에서 손으로 고친다) */
export function textToGender(text: string): string {
  const v = String(text ?? '').trim();
  if (/^(남|남자|M|male)$/i.test(v)) return 'M';
  if (/^(여|여자|F|female)$/i.test(v)) return 'F';
  return '';
}

// ── CSV (학급 하나 · 모든 학급) ──

export const CLASS_CSV_HEADER = ['번호', '이름', '성별', '상태', '특이사항'];
export const ROSTER_CSV_HEADER = ['학년도', '학년', '반', '번호', '이름', '성별', '상태', '특이사항'];

const studentCells = (s: RosterStudent) => [String(s.num ?? ''), s.name || '', genderToText(s.gender), isActive(s) ? '재학' : '전출', s.note || ''];

/** 학급 하나 → 표 */
export function classCsvRows(students: readonly RosterStudent[]): string[][] {
  return [CLASS_CSV_HEADER, ...students.map(studentCells)];
}

/** 모든 학급 → 표 */
export function rosterCsvRows(classes: readonly RosterClass[]): string[][] {
  const rows = [ROSTER_CSV_HEADER];
  for (const c of classes) for (const s of c.students) rows.push([String(c.year), String(c.grade), String(c.num), ...studentCells(s)]);
  return rows;
}

/** 학생 칸 (sid는 아직 없다 - 붙일 때 이어 준다) */
export type CsvStudent = Omit<RosterStudent, 'sid'>;

const columnsOf = (header: string[], names: string[]) => Object.fromEntries(names.map((n, i) => [n, header.indexOf(n) === -1 ? i : header.indexOf(n)])) as Record<string, number>;

/** 학급 하나 CSV → 학생 (머리말 이름으로 칸을 찾는다, 번호가 숫자가 아닌 줄은 뺀다) */
export function parseClassCsv(rows: string[][]): CsvStudent[] {
  if (rows.length < 2) return [];
  const col = columnsOf(rows[0].map((h) => String(h ?? '').trim()), CLASS_CSV_HEADER);
  const out: CsvStudent[] = [];
  for (const row of rows.slice(1)) {
    const cell = (i: number) => String(row[i] ?? '').trim();
    const num = parseInt(cell(col['번호']), 10);
    if (!Number.isFinite(num)) continue;
    out.push({ num, name: cell(col['이름']), gender: textToGender(cell(col['성별'])), status: cell(col['상태']).includes('전출') ? 'out' : 'active', note: cell(col['특이사항']) });
  }
  return out;
}

export interface RosterCsvResult {
  classes: Array<Omit<RosterClass, 'students'> & { students: CsvStudent[] }>;
  /** 읽지 못하고 건너뛴 줄 */
  skipped: number;
}

/** 모든 학급 CSV → 학급들 (학년도·학년·반이 같으면 한 학급, 학급·학생 차례로) */
export function parseRosterCsv(rows: string[][]): RosterCsvResult {
  if (rows.length < 2) return { classes: [], skipped: 0 };
  const col = columnsOf(rows[0].map((h) => String(h ?? '').trim()), ROSTER_CSV_HEADER);
  const byClass = new Map<string, RosterCsvResult['classes'][number]>();
  let skipped = 0;
  for (const row of rows.slice(1)) {
    const cell = (i: number) => String(row[i] ?? '').trim();
    const num = parseInt(cell(col['번호']), 10);
    const name = cell(col['이름']);
    const year = parseInt(cell(col['학년도']), 10);
    const grade = parseInt(cell(col['학년']), 10);
    const classNum = parseInt(cell(col['반']), 10);
    if (!Number.isFinite(num) || !name || !Number.isFinite(grade) || !Number.isFinite(classNum) || !Number.isFinite(year)) {
      skipped++;
      continue;
    }
    const key = `${year}-${grade}-${classNum}`;
    if (!byClass.has(key)) byClass.set(key, { year, grade, num: classNum, students: [] });
    byClass.get(key)!.students.push({ num, name, gender: textToGender(cell(col['성별'])), status: cell(col['상태']).includes('전출') ? 'out' : 'active', note: cell(col['특이사항']) });
  }
  const classes = [...byClass.values()].map((c) => ({ ...c, students: [...c.students].sort((a, b) => a.num - b.num) }));
  classes.sort((a, b) => a.year - b.year || a.grade - b.grade || a.num - b.num);
  return { classes, skipped };
}

/**
 * 읽어 온 명단을 지금 학생에 맞춰 sid를 잇는다 - 이름이 같으면 그 학생(번호가 바뀌었어도), 아니면 번호가 같고 이름이 비었던 칸,
 * 그 밖은 새 학생. 그래야 다시 올려도 학생 기록이 이어진다.
 */
export function withSids(incoming: readonly CsvStudent[], current: readonly RosterStudent[], newSid: () => string): RosterStudent[] {
  const left = [...current];
  const take = (pred: (s: RosterStudent) => boolean) => {
    const i = left.findIndex(pred);
    return i === -1 ? undefined : left.splice(i, 1)[0];
  };
  return incoming.map((s) => {
    const same = (s.name && take((c) => c.name === s.name)) || take((c) => c.num === s.num && !c.name);
    return { ...s, sid: same ? same.sid : newSid() };
  });
}

/** 저장할 학생 칸 - 빈 칸은 뺀다 (문서에 undefined를 남기지 않는다) */
export function cleanStudent(s: RosterStudent): RosterStudent {
  const out: RosterStudent = { sid: s.sid, num: Number(s.num) || 0, name: (s.name ?? '').trim(), status: s.status === 'out' ? 'out' : 'active' };
  if (s.gender === 'M' || s.gender === 'F') out.gender = s.gender;
  if (s.status === 'out' && s.outDate) out.outDate = s.outDate;
  if (s.note?.trim()) out.note = s.note.trim();
  return out;
}
