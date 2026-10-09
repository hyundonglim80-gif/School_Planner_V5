// 학생 태그 (V4 lib/studentTag.ts·mention.ts) - 순수 함수. V5는 기록·메모의 studentIds에 '{classId}/{sid}'로 든다(DESIGN 4-2).
//   글에 적은 '#26040305'(2026학년도 4학년 3반 5번 - 두 자리씩)는 V4 그대로 읽는다: 저장할 때 명렬표에서 그 학생을 찾아 studentIds에 더한다(글은 그대로).
//   '@이름'(쓰는 칸): '@김지' → 학생 목록 → 고르면 '@김지'가 이름으로 바뀌고 학생이 studentIds에 든다(번호가 바뀌어도 sid로 따라간다).
//   '@'는 줄 처음이나 빈칸 뒤에서만 - 메일 주소(teacher@school)에서 목록이 뜨지 않게.
import { matchesName } from './hangul';
import { classIdOf, isActive, type RosterClass, type RosterStudent } from './roster';

export interface StudentTag {
  /** 학년도 (2026) */
  year: number;
  grade: number;
  classNum: number;
  num: number;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** #26040305 꼴의 태그 */
export function makeStudentTag(t: StudentTag): string {
  return `#${pad2(t.year % 100)}${pad2(t.grade)}${pad2(t.classNum)}${pad2(t.num)}`;
}

/** 글 안의 태그를 모두 (처음·가운데·끝 어디든). 여덟 자리보다 긴 숫자는 태그가 아니다 */
export function findStudentTags(text: string): StudentTag[] {
  const out: StudentTag[] = [];
  const seen = new Set<string>();
  for (const m of String(text || '').matchAll(/#(\d{2})(\d{2})(\d{2})(\d{2})(?!\d)/g)) {
    if (seen.has(m[0])) continue;
    seen.add(m[0]);
    out.push({ year: 2000 + Number(m[1]), grade: Number(m[2]), classNum: Number(m[3]), num: Number(m[4]) });
  }
  return out;
}

// ── studentIds = '{classId}/{sid}' ──

type ClassWithId = RosterClass & { id?: string };

export const studentKeyOf = (cls: Pick<RosterClass, 'year' | 'grade' | 'num'>, sid: string) => `${classIdOf(cls)}/${sid}`;

export function parseStudentKey(key: string): { classId: string; sid: string } | null {
  const at = key.lastIndexOf('/');
  if (at <= 0 || at === key.length - 1) return null;
  return { classId: key.slice(0, at), sid: key.slice(at + 1) };
}

/** studentIds 하나 → 학급·학생 (명렬표에서 지웠으면 null) */
export function studentOfKey<C extends ClassWithId>(key: string, classes: readonly C[]): { cls: C; student: RosterStudent } | null {
  const p = parseStudentKey(key);
  if (!p) return null;
  const cls = classes.find((c) => classIdOf(c) === p.classId);
  const student = cls?.students.find((s) => s.sid === p.sid);
  return cls && student ? { cls, student } : null;
}

/** 글에 적은 '#26040305' → 명렬표의 학생 studentIds (명렬표에 없는 태그는 건너뛴다) */
export function studentKeysOfTags(text: string, classes: readonly RosterClass[]): string[] {
  const out: string[] = [];
  for (const t of findStudentTags(text)) {
    const cls = classes.find((c) => c.year === t.year && c.grade === t.grade && c.num === t.classNum);
    const st = cls?.students.find((s) => s.num === t.num);
    if (cls && st) {
      const key = studentKeyOf(cls, st.sid);
      if (!out.includes(key)) out.push(key);
    }
  }
  return out;
}

/** 저장할 studentIds: 고른 학생 + 이번에 글에 새로 적은 태그의 학생 (원래 글에 있던 태그는 다시 읽지 않는다 - 번호가 바뀌었으면 다른 학생이 된다) */
export function studentIdsToSave(picked: readonly string[], text: string, baseText: string, classes: readonly RosterClass[]): string[] {
  const before = new Set(findStudentTags(baseText).map(makeStudentTag));
  const fresh = findStudentTags(text).filter((t) => !before.has(makeStudentTag(t)));
  const out = [...picked];
  for (const key of studentKeysOfTags(fresh.map(makeStudentTag).join(' '), classes)) if (!out.includes(key)) out.push(key);
  return out;
}

// ── '@이름' ──

export interface Mention {
  /** '@'의 자리 */
  start: number;
  /** '@' 뒤에 친 글자 */
  query: string;
}

/** '@' 뒤로 칠 수 있는 길이 (그보다 길면 이름을 찾는 게 아니다) */
const MAX_QUERY = 10;

/** 커서 바로 앞의 '@찾는말'. 없으면 null */
export function findMention(text: string, caret: number): Mention | null {
  const before = text.slice(0, Math.max(0, caret));
  const m = /(^|[\s(])@([^\s@#]*)$/.exec(before);
  if (!m) return null;
  const query = m[2];
  if (query.length > MAX_QUERY) return null;
  return { start: before.length - query.length - 1, query };
}

export interface MentionCandidate<C extends ClassWithId = ClassWithId> {
  cls: C;
  student: RosterStudent;
  /** studentIds에 넣을 것 */
  key: string;
}

/**
 * 찾는말에 맞는 재학생. 앞에 둘 학급(prefer - 학급 화면에서 고른 학급)·올해 학년도 학급이 먼저, 학급 안에서는 번호 차례.
 * 찾는말이 숫자면 번호로, 비었으면 맨 앞 학급의 학생들(모든 학급을 늘어놓으면 고를 수 없다).
 */
export function matchMentionStudents<C extends ClassWithId>(
  classes: readonly C[],
  query: string,
  opts: { preferClassId?: string | null; schoolYear?: number; limit?: number } = {},
): MentionCandidate<C>[] {
  const limit = opts.limit ?? 8;
  const q = query.trim();
  const rank = (c: C) => (opts.preferClassId && classIdOf(c) === opts.preferClassId ? 0 : 2) + (c.year === opts.schoolYear ? 0 : 1);
  const sorted = classes.filter((c) => c.students.length > 0).sort((a, b) => rank(a) - rank(b));
  const pool = q ? sorted : sorted.slice(0, 1);
  const out: MentionCandidate<C>[] = [];
  for (const cls of pool) {
    for (const s of [...cls.students].filter(isActive).sort((a, b) => a.num - b.num)) {
      const hit = !q || (/^\d+$/.test(q) ? s.num === Number(q) : matchesName(s.name, q));
      if (!hit) continue;
      out.push({ cls, student: s, key: studentKeyOf(cls, s.sid) });
      if (out.length >= limit) return out;
    }
  }
  return out;
}

/** '@찾는말'을 넣을 글(이름)로 바꾼 글과 그 뒤 커서 자리. 뒤에는 빈칸 하나(이미 있으면 그대로) */
export function applyMention(text: string, mention: Mention, insertText: string): { text: string; caret: number } {
  const end = mention.start + 1 + mention.query.length;
  const after = text.slice(end);
  const spaced = /^\s/.test(after);
  const insert = spaced ? insertText : `${insertText} `;
  return { text: text.slice(0, mention.start) + insert + after, caret: mention.start + insert.length + (spaced ? 1 : 0) };
}
