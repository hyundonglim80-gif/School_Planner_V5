// 출석부 규칙 (V4 lib/attendance.ts) - 순수 함수. 나이스(NEIS) 출결 구분과 같게 둔다.
//   종류: 결석 · 지각 · 조퇴 · 결과 / 사유: 질병 · 미인정 · 기타 · 출석인정 - 학기 말에 생활기록부로 옮겨 적을 때 표가 그대로 맞아야 한다.
// 기본값은 '출석'이다. 달라진 학생만 적어 두고, 적힌 것이 없으면 출석으로 본다(날마다 25명을 하나씩 누르게 하면 아무도 쓰지 않는다).
// 자리: 개인 공간 attendance/{classId}_{date} = { classId, date, records: { [sid]: { kind, reason, periods?, note? } } } (DESIGN 4-6).
//   V4는 번호를 열쇠로 하고 이름을 함께 적었다 - V5는 학생 sid(번호가 밀려도 그 학생), 이름은 명렬표에서 읽는다.
import { schoolYearSpan, semesterConfigOf, semesterSpan, type SchoolTerms } from './semester';
import type { RosterStudent } from './roster';

export type AttendanceKind = 'absent' | 'late' | 'early' | 'result';
export type AttendanceReason = 'sick' | 'unexcused' | 'other' | 'approved';

export const KIND_LABEL: Record<AttendanceKind, string> = { absent: '결석', late: '지각', early: '조퇴', result: '결과' };
export const KINDS: AttendanceKind[] = ['absent', 'late', 'early', 'result'];
export const REASON_LABEL: Record<AttendanceReason, string> = { sick: '질병', unexcused: '미인정', other: '기타', approved: '출석인정' };
export const REASONS: AttendanceReason[] = ['sick', 'unexcused', 'other', 'approved'];

/** 교시를 적는 종류 (결석은 하루 전체라 교시가 없다) */
export const KIND_HAS_PERIODS: Record<AttendanceKind, boolean> = { absent: false, late: true, early: true, result: true };

export interface AttendanceMark {
  kind: AttendanceKind;
  reason: AttendanceReason;
  /** 지각·조퇴·결과의 교시 */
  periods?: number[];
  /** 사유 설명 (감기, 체험학습 등) */
  note?: string;
}

/** sid → 그날 출결 (출석한 학생은 없다) */
export type AttendanceMarks = Record<string, AttendanceMark>;

export interface AttendanceDayLike {
  date: string;
  /** 저장된 칸 그대로 (readMarks가 읽는다) */
  records?: unknown;
}

export const attendanceDocId = (classId: string, date: string) => `${classId}_${date}`;

const isKind = (v: unknown): v is AttendanceKind => KINDS.includes(v as AttendanceKind);
const isReason = (v: unknown): v is AttendanceReason => REASONS.includes(v as AttendanceReason);

/** 저장된 칸 → 출결 (모르는 종류·사유는 뺀다 - 틀린 칸 하나가 화면을 깨지 않게) */
export function readMarks(records: unknown): AttendanceMarks {
  const out: AttendanceMarks = {};
  if (!records || typeof records !== 'object') return out;
  for (const [sid, r] of Object.entries(records as Record<string, unknown>)) {
    const m = r as Partial<AttendanceMark> | null;
    if (!m || !isKind(m.kind)) continue;
    const periods = Array.isArray(m.periods) ? m.periods.map(Number).filter((n) => Number.isFinite(n) && n > 0) : [];
    out[sid] = {
      kind: m.kind,
      reason: isReason(m.reason) ? m.reason : 'sick',
      ...(KIND_HAS_PERIODS[m.kind] && periods.length ? { periods: [...new Set(periods)].sort((a, b) => a - b) } : {}),
      ...(typeof m.note === 'string' && m.note.trim() ? { note: m.note } : {}),
    };
  }
  return out;
}

/** 저장할 모양 - 빈 칸은 뺀다, 교시는 차례로 (결석은 교시 없이) */
export function cleanMark(m: AttendanceMark): AttendanceMark {
  return {
    kind: m.kind,
    reason: m.reason,
    ...(KIND_HAS_PERIODS[m.kind] && m.periods?.length ? { periods: [...m.periods].sort((a, b) => a - b) } : {}),
    ...(m.note?.trim() ? { note: m.note.trim() } : {}),
  };
}

/**
 * 고친 출결 → 바뀐 학생의 칸만 (`records.{sid}.kind` 처럼 깊은 칸 - 학생 칸을 통째로 합치면 지각을 결석으로 바꿔도 옛 교시가 남는다, V4).
 * 지운(출석으로 돌린) 학생은 `records.{sid}` = undefined(지우기). 바뀐 것이 없으면 빈 표.
 */
export function marksChanges(before: AttendanceMarks, after: AttendanceMarks): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const sid of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const a = after[sid] ? cleanMark(after[sid]) : null;
    const b = before[sid] ? cleanMark(before[sid]) : null;
    if (JSON.stringify(a) === JSON.stringify(b)) continue;
    if (!a) {
      out[`records.${sid}`] = undefined;
      continue;
    }
    if (!b) {
      out[`records.${sid}`] = a;
      continue;
    }
    out[`records.${sid}.kind`] = a.kind;
    out[`records.${sid}.reason`] = a.reason;
    out[`records.${sid}.periods`] = a.periods;
    out[`records.${sid}.note`] = a.note;
  }
  return out;
}

/** 출결을 고른다 - 사유·교시·메모는 고른 적이 있으면 이어받는다(처음이면 질병 - 초등에서 가장 흔하다). null = 출석 */
export function withKind(marks: AttendanceMarks, sid: string, kind: AttendanceKind | null): AttendanceMarks {
  const next = { ...marks };
  if (!kind) {
    delete next[sid];
    return next;
  }
  const old = marks[sid];
  next[sid] = {
    kind,
    reason: old?.reason || 'sick',
    ...(KIND_HAS_PERIODS[kind] && old?.periods ? { periods: old.periods } : {}),
    ...(old?.note ? { note: old.note } : {}),
  };
  return next;
}

export function togglePeriod(marks: AttendanceMarks, sid: string, period: number): AttendanceMarks {
  const r = marks[sid];
  if (!r) return marks;
  const set = new Set(r.periods || []);
  if (set.has(period)) set.delete(period);
  else set.add(period);
  return { ...marks, [sid]: { ...r, periods: [...set].sort((a, b) => a - b) } };
}

/** '결석(질병)', '지각(미인정) 1·2교시 - 감기' */
export function recordText(r: AttendanceMark): string {
  const periods = KIND_HAS_PERIODS[r.kind] && r.periods?.length ? ` ${[...r.periods].sort((a, b) => a - b).join('·')}교시` : '';
  const note = r.note?.trim() ? ` - ${r.note.trim()}` : '';
  return `${KIND_LABEL[r.kind]}(${REASON_LABEL[r.reason]})${periods}${note}`;
}

/**
 * 그날 출결의 줄 (기록 칸의 '📋 출결' 카드·검색 - 계산, DESIGN 5-4). 번호 차례, 명렬표에서 지운 학생은 '(지운 학생)'.
 *   ['5번 김지우 결석(질병) - 감기', '12번 박하늘 지각(미인정) 1교시']
 */
export function dayLines(marks: AttendanceMarks, students: readonly Pick<RosterStudent, 'sid' | 'num' | 'name'>[]): string[] {
  const bySid = new Map(students.map((s) => [s.sid, s]));
  return Object.entries(marks)
    .map(([sid, r]) => ({ st: bySid.get(sid), r }))
    .sort((a, b) => (a.st?.num ?? 999) - (b.st?.num ?? 999))
    .map(({ st, r }) => `${st ? `${st.num}번 ${st.name}` : '(지운 학생)'} ${recordText(r)}`);
}

/** 종류×사유 칸의 합계. 결석은 날 수, 지각·조퇴·결과는 횟수다(나이스와 같다) */
export type Tally = Record<AttendanceKind, Record<AttendanceReason, number>>;

export function emptyTally(): Tally {
  const t = {} as Tally;
  for (const k of KINDS) t[k] = { sick: 0, unexcused: 0, other: 0, approved: 0 };
  return t;
}

/** 학생별 합계 (sid → 합계) */
export function tallyByStudent(days: readonly AttendanceDayLike[]): Record<string, Tally> {
  const out: Record<string, Tally> = {};
  for (const day of days) {
    for (const [sid, r] of Object.entries(readMarks(day.records))) {
      out[sid] = out[sid] || emptyTally();
      out[sid][r.kind][r.reason] += 1;
    }
  }
  return out;
}

/** 한 학생의 출결을 날짜 차례로 */
export function historyOf(days: readonly AttendanceDayLike[], sid: string): Array<{ date: string; record: AttendanceMark }> {
  return days
    .map((d) => ({ date: d.date, record: readMarks(d.records)[sid] }))
    .filter((h) => !!h.record)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export type SummaryRange = 'year' | 'sem1' | 'sem2' | 'month';

/** 누계 기간 - 학년도는 그 학급의 학년도, 달은 보는 날의 달, 학기는 학년도를 빈틈없이 나눈다(V4 semesterSpan - 2월까지 2학기) */
export function summaryRangeOf(range: SummaryRange, classYear: number, date: string, terms: SchoolTerms | null | undefined): { start: string; end: string } {
  if (range === 'month') return { start: `${date.slice(0, 7)}-01`, end: `${date.slice(0, 7)}-31` };
  if (range === 'year') return schoolYearSpan(classYear);
  return semesterSpan(classYear, range === 'sem1' ? 1 : 2, semesterConfigOf(terms, classYear));
}
