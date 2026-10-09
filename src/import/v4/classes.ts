// V4 학급 → V5 (DESIGN 8-3 학급 줄, P7-5) - 순수 함수. 읽기는 read.ts, 적기는 run.ts.
//
//   settings/rosters(classList·rosters)  → classes/{학년도-학년-반}     학생 sid = v4id('student', 공간, 'settings/rosters', '{classId}#{번호}')
//                                                                       - 셈한 값이라 다시 가져와도 같은 sid다(짝 표를 따로 두지 않는다 - PLAN 5장 P7-5).
//                                                                       V5에서 고친 학급(둠)은 번호 → sid를 그 V5 명렬표에서 찾는다(없으면 셈한 sid).
//   attendance/{classKey_date}           → attendance/{classId_date}   records 번호 → sid (적을 때의 이름은 빼다 - 명렬표에서 읽는다)
//   v4_subjectAttendance/{classKey_date} → subjectAttendance          periods.교시.번호 → sid
//   notices/{date}                       → notices/{date}             lines 그대로 (개인 공간 - 그룹 것은 P8-4)
//   evaluations/{date}(readEvalList)     → evaluations/{id} 한 장씩     학생 칸 번호 → sid, indivScore(옛 score) → indiv, groupScore → group,
//                                                                       명단 이름 끝의 '(전출/삭제됨)' → out, 개인·조별 = methodObj(옛 method 글자)
//   v4_seating/{id}                      → seating/{id}               seats 번호 → sid, 지난 짝 '3-5' → 'sidA|sidB'
//   v4_classHub/{classKey}               → classHub/{classId}         apart·draw.picked·groupSets의 번호 → sid
//   settings/photoQuiz.records           → quiz/{classId}.records     열쇠 '{학년도}-{학년}-{반}-{이름}'(V4는 이름으로 이었다) → 그 학급의 그 이름 학생 sid
//                                                                       (명렬표에 없는 이름은 버린다)
// 지운 표시가 없는 문서(출결·교과 출결·알림장·학급 허브·암기)는 V4에서 없어지면 칸을 비운다(수업 칸과 같다 - 지운 표시를 화면이 보지 않는다).
// 기록·메모의 '#26040305' → studentIds 는 items.ts가 여기서 셈한 명렬표로(studentKeysOf).
import { readMarks, type AttendanceMarks } from '../../domain/attendance';
import { academicYearOf, isValidDateStr } from '../../domain/dateUtils';
import { sanitizeDraw } from '../../domain/draw';
import { cleanEvalValue, type EvalDoc, type EvalValues } from '../../domain/evaluation';
import { sanitizeGroupSets } from '../../domain/groups';
import { readNoticeLines } from '../../domain/notices';
import { classIdOf, textToGender, type RosterClass, type RosterStudent } from '../../domain/roster';
import { pairKey, sanitizeChart } from '../../domain/seating';
import { studentKeysOfTags } from '../../domain/studentTag';
import { readSubjectPeriods } from '../../domain/subjectAttendance';
import { writeOp, type WriteOp } from '../../data/repo/ops';
import type { ClassHub, Editable, ImportSource, Stored } from '../../data/types';
import { sameValue } from './hash';
import { nthKey, v4id } from './ids';
import { readEvalList } from './legacy/evalList';
import { contentOf, emptyCounts, fingerprint, planDocs, tally, untouched, type ImportColl, type ImportCounts, type Planned } from './plan';

/** 읽어 온 V4 문서들 (개인 공간 밑) */
export interface V4ClassDocs {
  /** settings/rosters (없으면 V3 옛 settings/roster 한 학급) */
  rosters?: unknown;
  legacyRoster?: unknown;
  /** 문서 id → 문서 */
  attendance: Readonly<Record<string, unknown>>;
  subjectAttendance: Readonly<Record<string, unknown>>;
  notices: Readonly<Record<string, unknown>>;
  evaluations: Readonly<Record<string, unknown>>;
  seating: Readonly<Record<string, unknown>>;
  classHub: Readonly<Record<string, unknown>>;
  /** settings/photoQuiz */
  photoQuiz?: unknown;
}

/** 지금 V5 문서 (지운 것 포함) */
export interface ExistingClassDocs {
  classes: Readonly<Record<string, Stored<'classes'>>>;
  attendance: Readonly<Record<string, Stored<'attendance'>>>;
  subjectAttendance: Readonly<Record<string, Stored<'subjectAttendance'>>>;
  notices: Readonly<Record<string, Stored<'notices'>>>;
  evaluations: Readonly<Record<string, Stored<'evaluations'>>>;
  seating: Readonly<Record<string, Stored<'seating'>>>;
  classHub: Readonly<Record<string, Stored<'classHub'>>>;
  quiz: Readonly<Record<string, Stored<'quiz'>>>;
}

export const CLASS_KINDS = ['classes', 'attendance', 'subjectAttendance', 'notices', 'evaluations', 'seating', 'classHub', 'quiz'] as const;
type ClassKind = (typeof CLASS_KINDS)[number];

export interface ClassNotes {
  /** 학년·반이 숫자가 아니어서 뺀 학급 */
  classSkipped: number;
  /** 학급을 알 수 없어 뺀 조사표·출결·자리표 */
  noClass: number;
  /** 명렬표에 없는 이름이라 버린 암기 성적 */
  quizDropped: number;
}

export interface ClassesPlan {
  ops: WriteOp[];
  counts: Record<ClassKind, ImportCounts>;
  notes: ClassNotes;
  /** 가져온 뒤의 V5 명렬표 (V5에서 고친 학급은 V5 것) */
  classes: RosterClass[];
  /** 글의 '#26040305' → studentIds (기록·메모 가져오기) */
  studentKeysOf: (text: string) => string[];
}

type Raw = Record<string, unknown>;
const isObj = (v: unknown): v is Raw => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown) => (typeof v === 'string' ? v : v === undefined || v === null ? '' : String(v));
const posInt = (v: unknown): number | null => {
  const n = Number(typeof v === 'string' ? v.trim() : v);
  return Number.isInteger(n) && n > 0 ? n : null;
};

/** V4 학년도·학년·반 → V5 학급 id (숫자가 아니면 null) */
export function classIdOfV4(c: { year?: unknown; grade?: unknown; classNum?: unknown }): string | null {
  const year = posInt(c.year);
  const grade = posInt(c.grade);
  const num = posInt(c.classNum);
  return year && grade && num ? classIdOf({ year, grade, num }) : null;
}

/** V4 학급 키 '2026_5_2' → V5 학급 id */
export const classIdOfKey = (key: unknown): string | null => {
  const [year, grade, classNum, ...rest] = str(key).split('_');
  return rest.length === 0 ? classIdOfV4({ year, grade, classNum }) : null;
};

/** V4 명렬표 → 학급 목록 (V4 useRoster의 정규화 그대로 - 학년도가 없으면 그해) */
export function v4Rosters(doc: unknown, legacy: unknown, thisYear: number): Raw[] {
  const fix = (item: Raw): Raw => ({ ...item, year: item.year || thisYear });
  if (isObj(doc)) {
    const list = [doc.classList, doc.rosters, doc.list].find(Array.isArray) as unknown[] | undefined;
    return (list ?? []).filter(isObj).map(fix);
  }
  return isObj(legacy) ? [fix(legacy)] : [];
}

/** 셈한 학생 sid (다시 가져와도 같다) */
export const studentSid = (sid: string, key: string) => v4id('student', sid, 'settings/rosters', key);

/** 지운 표시가 없는 문서: V4에서 없어졌으면 칸을 비운다 (이미 비었으면 그대로) */
function planEmptiable<C extends ImportColl>(
  sid: string,
  coll: C,
  planned: readonly Planned<C>[],
  existing: Readonly<Record<string, Stored<C>>>,
  owns: (d: Stored<C>) => boolean,
  emptied: Raw,
): { ops: WriteOp[]; counts: ImportCounts } {
  const r = planDocs(sid, coll, planned, existing, () => false);
  const ids = new Set(planned.map((p) => p.id));
  for (const d of Object.values(existing) as Array<Stored<C> & Raw & { src?: ImportSource }>) {
    if (ids.has(d.id) || d.deletedAt || !owns(d)) continue;
    const after = contentOf({ ...d, ...emptied });
    if (sameValue(contentOf(d), after)) continue;
    if (untouched(d)) {
      r.ops.push(writeOp.patch({ sid, coll, id: d.id }, { ...emptied, src: { ...d.src!, h: fingerprint(after) } } as never, d));
      tally(r.counts, 'removed');
    } else tally(r.counts, 'kept');
  }
  return r;
}

const ownsPath = (prefix: string) => (d: { src?: ImportSource }) => d.src?.from === 'v4' && (d.src.path ?? '').startsWith(prefix);

export function planClasses(sid: string, docs: V4ClassDocs, existing: ExistingClassDocs, opts: { today: string }): ClassesPlan {
  const notes: ClassNotes = { classSkipped: 0, noClass: 0, quizDropped: 0 };
  const thisYear = Number(opts.today.slice(0, 4));

  // ───────── 명렬표 ─────────
  const rosterPlanned: Planned<'classes'>[] = [];
  /** V4 명렬표 한 학급 (암기 열쇠를 이름으로 찾을 때) */
  const v4Classes: Array<{ classId: string; prefix: string; students: RosterStudent[] }> = [];
  for (const item of v4Rosters(docs.rosters, docs.legacyRoster, thisYear)) {
    const classId = classIdOfV4(item);
    if (!classId) {
      notes.classSkipped++;
      continue;
    }
    if (rosterPlanned.some((p) => p.id === classId)) continue;
    const seen = new Map<string, number>();
    const raw = Array.isArray(item.students) ? item.students : [];
    const students: RosterStudent[] = raw.map((s: unknown, idx: number) => {
      const o = isObj(s) ? s : {};
      const num = o.num !== undefined ? Number(o.num) : o.number !== undefined ? Number(o.number) : idx + 1;
      const note = str(o.note).trim();
      return {
        sid: studentSid(sid, nthKey(seen, `${classId}#${num}`)),
        num: Number.isFinite(num) ? num : idx + 1,
        name: str(o.name),
        gender: textToGender(str(o.gender)),
        status: o.isActive === false ? 'out' : 'active',
        ...(note ? { note } : {}),
      };
    });
    const [year, grade, num] = classId.split('-').map(Number);
    rosterPlanned.push({ id: classId, data: { year, grade, num, students }, src: { path: 'settings/rosters', id: classId }, year: String(year) });
    v4Classes.push({ classId, prefix: `${str(item.year)}-${str(item.grade)}-${str(item.classNum)}-`, students });
  }
  const classesPlan = planDocs(sid, 'classes', rosterPlanned, existing.classes, ownsPath('settings/rosters'));

  // 가져온 뒤의 명렬표: V5에서 고친(둔) 학급은 V5 것, 나머지는 V4에서 셈한 것
  const finalClasses = new Map<string, RosterClass>();
  for (const d of Object.values(existing.classes)) if (!d.deletedAt) finalClasses.set(d.id, d);
  for (const p of rosterPlanned) {
    const cur = existing.classes[p.id];
    const keep = cur && !cur.deletedAt && !untouched(cur);
    if (!keep && !(cur?.deletedAt && cur.deletedBy !== 'v4-import')) finalClasses.set(p.id, p.data as RosterClass);
  }
  /** 학급의 번호 → sid (명렬표에 없으면 셈한 sid - 다시 가져와도 같다) */
  const sidOf = (classId: string, num: unknown): string => {
    const n = Number(num);
    const found = finalClasses.get(classId)?.students.find((s) => s.num === n);
    return found?.sid ?? studentSid(sid, `${classId}#${n}`);
  };
  const bySid = <T>(classId: string, rec: unknown, conv: (v: unknown) => T | null): Record<string, T> => {
    const out: Record<string, T> = {};
    if (!isObj(rec)) return out;
    for (const [n, v] of Object.entries(rec)) {
      if (posInt(n) === null) continue;
      const value = conv(v);
      if (value !== null) out[sidOf(classId, n)] = value;
    }
    return out;
  };
  const dateOfDoc = (d: Raw, docId: string) => (isValidDateStr(str(d.date)) ? str(d.date) : docId.slice(-10));
  const classOfDoc = (d: Raw, docId: string) => classIdOfV4(d) ?? classIdOfKey(d.classKey) ?? classIdOfKey(docId.slice(0, -11));

  // ───────── 출결 ─────────
  const attPlanned: Planned<'attendance'>[] = [];
  for (const [docId, d] of Object.entries(docs.attendance)) {
    if (!isObj(d)) continue;
    const classId = classOfDoc(d, docId);
    const date = dateOfDoc(d, docId);
    if (!classId || !isValidDateStr(date)) {
      notes.noClass++;
      continue;
    }
    const records: AttendanceMarks = readMarks(bySid(classId, d.records, (v) => v));
    if (Object.keys(records).length === 0) continue;
    attPlanned.push({ id: `${classId}_${date}`, data: { classId, date, records }, src: { path: `attendance/${docId}`, id: docId }, year: String(academicYearOf(date)) });
  }
  const att = planEmptiable(sid, 'attendance', attPlanned, existing.attendance, ownsPath('attendance/'), { records: {} });

  // ───────── 교과 출결 ─────────
  const subPlanned: Planned<'subjectAttendance'>[] = [];
  for (const [docId, d] of Object.entries(docs.subjectAttendance)) {
    if (!isObj(d)) continue;
    const classId = classOfDoc(d, docId);
    const date = dateOfDoc(d, docId);
    if (!classId || !isValidDateStr(date)) {
      notes.noClass++;
      continue;
    }
    const raw: Raw = {};
    for (const [p, recs] of Object.entries(isObj(d.periods) ? d.periods : {})) raw[p] = bySid(classId, recs, (v) => v);
    const periods = readSubjectPeriods(raw);
    if (Object.keys(periods).length === 0) continue;
    subPlanned.push({ id: `${classId}_${date}`, data: { classId, date, periods }, src: { path: `v4_subjectAttendance/${docId}`, id: docId }, year: String(academicYearOf(date)) });
  }
  const sub = planEmptiable(sid, 'subjectAttendance', subPlanned, existing.subjectAttendance, ownsPath('v4_subjectAttendance/'), { periods: {} });

  // ───────── 알림장 ─────────
  const noticePlanned: Planned<'notices'>[] = [];
  for (const [docId, d] of Object.entries(docs.notices)) {
    if (!isObj(d)) continue;
    const date = dateOfDoc(d, docId);
    const lines = readNoticeLines(d.lines);
    if (!isValidDateStr(date) || lines.length === 0) continue;
    noticePlanned.push({ id: date, data: { date, lines }, src: { path: `notices/${docId}`, id: docId }, year: String(academicYearOf(date)) });
  }
  const notice = planEmptiable(sid, 'notices', noticePlanned, existing.notices, ownsPath('notices/'), { lines: [] });

  // ───────── 조사표 ─────────
  const evalPlanned: Planned<'evaluations'>[] = [];
  for (const [docId, d] of Object.entries(docs.evaluations)) {
    const seen = new Map<string, number>();
    for (const item of readEvalList(d)) {
      if (!isObj(item)) continue;
      const date = isValidDateStr(docId) ? docId : str(item.dateStr);
      const classId = classIdOfV4(isObj(item.rosterMeta) ? item.rosterMeta : {});
      if (!classId || !isValidDateStr(date)) {
        notes.noClass++;
        continue;
      }
      const key = str(item.id) || nthKey(seen, `${date}|${str(item.title)}`);
      const ev = v4Eval(item, date, classId, sidOf);
      evalPlanned.push({ id: v4id('evaluation', sid, `evaluations/${docId}`, key), data: ev, src: { path: `evaluations/${docId}`, id: key }, year: String(academicYearOf(date)) });
    }
  }
  const evals = planDocs(sid, 'evaluations', evalPlanned, existing.evaluations, ownsPath('evaluations/'));

  // ───────── 자리표 ─────────
  const seatPlanned: Planned<'seating'>[] = [];
  for (const [docId, d] of Object.entries(docs.seating)) {
    if (!isObj(d)) continue;
    const classId = classIdOfKey(d.classKey);
    if (!classId) {
      notes.noClass++;
      continue;
    }
    const seats: Record<string, string> = {};
    for (const [k, n] of Object.entries(isObj(d.seats) ? d.seats : {})) if (posInt(n) !== null) seats[k] = sidOf(classId, n);
    const history = (Array.isArray(d.history) ? d.history : []).filter(isObj).map((h) => ({
      at: h.at,
      pairs: (Array.isArray(h.pairs) ? h.pairs : []).flatMap((p) => {
        const nums = numPair(p);
        return nums ? [pairKey(sidOf(classId, nums[0]), sidOf(classId, nums[1]))] : [];
      }),
    }));
    const { id: _id, createdAt: _c, updatedAt: _u, ...chart } = sanitizeChart(docId, { ...d, classId, seats, history });
    void _id;
    void _c;
    void _u;
    seatPlanned.push({ id: v4id('seating', sid, 'v4_seating', docId), data: chart, src: { path: `v4_seating/${docId}`, id: docId } });
  }
  const seats = planDocs(sid, 'seating', seatPlanned, existing.seating, ownsPath('v4_seating/'));

  // ───────── 학급 허브 (떨어뜨릴 학생·뽑기·모둠) ─────────
  const hubPlanned: Planned<'classHub'>[] = [];
  for (const [docId, d] of Object.entries(docs.classHub)) {
    if (!isObj(d)) continue;
    const classId = classIdOfKey(docId);
    if (!classId) {
      notes.noClass++;
      continue;
    }
    const data = v4Hub(d, classId, sidOf);
    if (Object.keys(data).length === 0) continue;
    hubPlanned.push({ id: classId, data, src: { path: `v4_classHub/${docId}`, id: docId } });
  }
  const hub = planEmptiable(sid, 'classHub', hubPlanned, existing.classHub, ownsPath('v4_classHub/'), { apart: undefined, draw: undefined, groupSets: undefined });

  // ───────── 암기 성적 ─────────
  const quizRecords = new Map<string, Record<string, { o: number; x: number; streak: number; seenAt?: number }>>();
  const keyToStudent = new Map<string, { classId: string; num: number }>();
  for (const c of v4Classes) for (const s of c.students) keyToStudent.set(c.prefix + s.name.replace(/\s+/g, ''), { classId: c.classId, num: s.num });
  const quizDoc = isObj(docs.photoQuiz) && isObj(docs.photoQuiz.records) ? docs.photoQuiz.records : {};
  for (const [key, rec] of Object.entries(quizDoc)) {
    const who = keyToStudent.get(key);
    if (!who || !isObj(rec)) {
      notes.quizDropped++;
      continue;
    }
    const n = (v: unknown) => Math.max(0, Math.floor(Number(v) || 0));
    const seenAt = Number(rec.seenAt);
    const out = { o: n(rec.o), x: n(rec.x), streak: n(rec.streak), ...(Number.isFinite(seenAt) && seenAt > 0 ? { seenAt } : {}) };
    const map = quizRecords.get(who.classId) ?? {};
    map[sidOf(who.classId, who.num)] = out;
    quizRecords.set(who.classId, map);
  }
  const quizPlanned: Planned<'quiz'>[] = [...quizRecords].map(([classId, records]) => ({ id: classId, data: { records }, src: { path: 'settings/photoQuiz', id: classId } }));
  const quiz = planEmptiable(sid, 'quiz', quizPlanned, existing.quiz, ownsPath('settings/photoQuiz'), { records: {} });

  const classes = [...finalClasses.values()];
  return {
    ops: [...classesPlan.ops, ...att.ops, ...sub.ops, ...notice.ops, ...evals.ops, ...seats.ops, ...hub.ops, ...quiz.ops],
    counts: {
      classes: classesPlan.counts ?? emptyCounts(),
      attendance: att.counts,
      subjectAttendance: sub.counts,
      notices: notice.counts,
      evaluations: evals.counts,
      seating: seats.counts,
      classHub: hub.counts,
      quiz: quiz.counts,
    },
    notes,
    classes,
    studentKeysOf: (text: string) => studentKeysOfTags(text, classes),
  };
}

/** V4 짝 '3-5' → [3, 5] */
function numPair(p: unknown): [number, number] | null {
  const m = /^(\d+)-(\d+)$/.exec(str(p));
  return m && m[1] !== m[2] ? [Number(m[1]), Number(m[2])] : null;
}

/** V4 조사표 한 장 → V5 칸 */
export function v4Eval(item: Raw, date: string, classId: string, sidOf: (classId: string, num: unknown) => string): Omit<Editable<'evaluations'>, 'src'> {
  const type: EvalDoc['type'] = item.type === 'check' || item.type === 'memo' ? item.type : 'eval';
  const context = isObj(item.context) ? item.context : {};
  const p = posInt(item.periodStr ?? context.period);
  const period = context.source === 'journal' || p === null ? null : p;
  const method = isObj(item.methodObj)
    ? { indiv: !!item.methodObj.indiv, group: !!item.methodObj.group }
    : { indiv: item.method !== 'group', group: item.method === 'group' };
  const students = (Array.isArray(item.studentsSnapshot) ? item.studentsSnapshot : []).filter(isObj).flatMap((s) => {
    const num = posInt(s.num);
    if (num === null) return [];
    const name = str(s.name);
    const out = /\(전출/.test(name);
    return [{ sid: sidOf(classId, num), num, name: name.replace(/\s*\(전출[^)]*\)\s*$/, ''), ...(out ? { out: true as const } : {}) }];
  });
  const values: EvalValues = {};
  for (const [n, rec] of Object.entries(isObj(item.records) ? item.records : {})) {
    if (posInt(n) === null || !isObj(rec)) continue;
    const v = cleanEvalValue({
      indiv: str(rec.indivScore || rec.score) || undefined,
      group: str(rec.groupScore) || undefined,
      groupName: str(rec.groupName) || undefined,
      checked: typeof rec.checked === 'boolean' ? rec.checked : undefined,
      reason: str(rec.reason) || undefined,
      memo: str(rec.memo) || undefined,
    });
    if (v) values[sidOf(classId, n)] = v;
  }
  const subject = str(item.subject).trim();
  const groups = (Array.isArray(item.groups) ? item.groups : []).filter(isObj).map((g, i) => ({
    name: str(g.name).trim() || `${String.fromCharCode(65 + i)}조`,
    members: (Array.isArray(g.members) ? g.members : []).filter((m) => posInt(m) !== null).map((m) => sidOf(classId, m)),
  }));
  return {
    date,
    period,
    classId,
    title: str(item.title).trim() || '조사표',
    type,
    ...(subject ? { subject } : {}),
    ...(type === 'eval'
      ? {
          indiv: method.indiv,
          group: method.group,
          steps: (Array.isArray(item.steps) ? item.steps : []).map(str).filter((s) => s.trim()),
          ...(method.group ? { groups } : {}),
        }
      : {}),
    students,
    values,
  };
}

/** V4 학급 허브 → V5 칸 (빈 칸은 뺀다) */
export function v4Hub(d: Raw, classId: string, sidOf: (classId: string, num: unknown) => string): Omit<Editable<'classHub'>, 'src'> {
  const out: Omit<ClassHub, 'src' | 'updatedAt' | 'v'> = {};
  const apart = (Array.isArray(d.apart) ? d.apart : []).flatMap((p) => {
    const nums = numPair(p);
    return nums ? [pairKey(sidOf(classId, nums[0]), sidOf(classId, nums[1]))] : [];
  });
  if (apart.length) out.apart = [...new Set(apart)];
  if (isObj(d.draw)) {
    const picked = (Array.isArray(d.draw.picked) ? d.draw.picked : []).filter((n) => posInt(n) !== null).map((n) => sidOf(classId, n));
    out.draw = sanitizeDraw({ picked, round: d.draw.round });
  }
  if (isObj(d.groupSets)) {
    const raw: Raw = {};
    for (const [id, set] of Object.entries(d.groupSets)) {
      if (!isObj(set)) continue;
      const groups = (Array.isArray(set.groups) ? set.groups : []).filter(isObj).map((g) => ({
        name: g.name,
        members: (Array.isArray(g.members) ? g.members : []).filter((n) => posInt(n) !== null).map((n) => sidOf(classId, n)),
      }));
      raw[id] = { ...set, groups };
    }
    const sets = sanitizeGroupSets(raw);
    if (sets.length) out.groupSets = Object.fromEntries(sets.map(({ id, ...rest }) => [id, rest]));
  }
  return out as Omit<Editable<'classHub'>, 'src'>;
}
