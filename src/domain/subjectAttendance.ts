// 교과 출결 (V4 lib/subjectAttendance.ts) - 순수 함수. 교과 모드 수업 칸('5-2 과학')에서 그 반 그 교시의 결과·지각·조퇴를 적는다.
//   담임 출석부(domain/attendance - 하루 단위)와 따로 둔다. 기록 칸에 들어가지 않는다.
//   자리: 개인 공간 subjectAttendance/{classId}_{date} = { classId, date, periods: { '3': { [sid]: { kind, reason, note? } } } } (DESIGN 4-6)
//   쓰기는 학생 한 칸만(periods.교시.sid) - 같은 날 두 교시를 따로 열어 적어도 서로 덮지 않는다. 적지 않은 학생은 출석.
import { REASONS, type AttendanceReason } from './attendance';

export type SubjectAttendanceKind = 'absent' | 'late' | 'early';

/** 교시 단위라 absent는 '결과'(그 시간에 없었다)로 부른다 - 나이스 출결 구분과 같다 */
export const SUBJECT_KIND_LABEL: Record<SubjectAttendanceKind, string> = { absent: '결과', late: '지각', early: '조퇴' };
export const SUBJECT_KINDS: SubjectAttendanceKind[] = ['absent', 'late', 'early'];

export interface SubjectMark {
  kind: SubjectAttendanceKind;
  reason: AttendanceReason;
  note?: string;
}

/** 교시('3') → sid → 출결 */
export type SubjectPeriods = Record<string, Record<string, SubjectMark>>;

export const subjectAttendanceDocId = (classId: string, date: string) => `${classId}_${date}`;

/** 저장된 한 칸을 믿지 않고 읽는다. 모르는 모양이면 null */
export function readSubjectMark(raw: unknown): SubjectMark | null {
  const r = raw as Partial<SubjectMark> | null;
  if (!r || typeof r !== 'object' || !SUBJECT_KINDS.includes(r.kind as SubjectAttendanceKind)) return null;
  const reason = REASONS.includes(r.reason as AttendanceReason) ? (r.reason as AttendanceReason) : 'sick';
  const note = typeof r.note === 'string' && r.note.trim() ? r.note.trim() : '';
  return { kind: r.kind as SubjectAttendanceKind, reason, ...(note ? { note } : {}) };
}

/** 문서 → 교시별 출결 (모르는 칸은 버린다) */
export function readSubjectPeriods(raw: unknown): SubjectPeriods {
  const out: SubjectPeriods = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [p, recs] of Object.entries(raw as Record<string, unknown>)) {
    if (!/^\d+$/.test(p) || !recs || typeof recs !== 'object') continue;
    const day: Record<string, SubjectMark> = {};
    for (const [sid, r] of Object.entries(recs as Record<string, unknown>)) {
      const rec = readSubjectMark(r);
      if (rec) day[sid] = rec;
    }
    if (Object.keys(day).length > 0) out[p] = day;
  }
  return out;
}

/** 교시 하나의 종류별 수 */
export function periodCounts(records: Record<string, SubjectMark> | undefined): Record<SubjectAttendanceKind, number> {
  const out: Record<SubjectAttendanceKind, number> = { absent: 0, late: 0, early: 0 };
  for (const r of Object.values(records || {})) out[r.kind]++;
  return out;
}

/** 교시 하나 요약 '결과 2 · 지각 1' (적힌 것이 없으면 '') */
export function periodSummary(records: Record<string, SubjectMark> | undefined): string {
  const c = periodCounts(records);
  return SUBJECT_KINDS.filter((k) => c[k] > 0)
    .map((k) => `${SUBJECT_KIND_LABEL[k]} ${c[k]}`)
    .join(' · ');
}

/**
 * 학생 한 칸 쓰기 (점으로 고른 깊은 칸). null = 출석으로(칸 지우기). 고친 칸은 칸마다 적는다 - 통째로 합치면 지운 사유가 남는다.
 */
export function subjectCellChanges(period: number | string, sid: string, before: SubjectMark | null | undefined, after: SubjectMark | null): Record<string, unknown> {
  const at = `periods.${period}.${sid}`;
  if (!after) return before ? { [at]: undefined } : {};
  const clean: SubjectMark = { kind: after.kind, reason: after.reason, ...(after.note?.trim() ? { note: after.note.trim() } : {}) };
  if (!before) return { [at]: clean };
  if (JSON.stringify(readSubjectMark(before)) === JSON.stringify(clean)) return {};
  return { [`${at}.kind`]: clean.kind, [`${at}.reason`]: clean.reason, [`${at}.note`]: clean.note };
}

export interface SubjectStudentTotal {
  absent: number;
  late: number;
  early: number;
  /** 날짜·교시별 내역 (날짜·교시 차례) */
  items: Array<{ date: string; period: number; record: SubjectMark }>;
}

/** 학생(sid)마다 누계 (교시 수). from·to를 주면 그 사이 날짜만 */
export function studentTotals(days: ReadonlyArray<{ date: string; periods?: unknown }>, from?: string, to?: string): Record<string, SubjectStudentTotal> {
  const out: Record<string, SubjectStudentTotal> = {};
  for (const day of [...days].sort((a, b) => a.date.localeCompare(b.date))) {
    if ((from && day.date < from) || (to && day.date > to)) continue;
    const periods = readSubjectPeriods(day.periods);
    for (const p of Object.keys(periods).sort((a, b) => Number(a) - Number(b))) {
      for (const [sid, r] of Object.entries(periods[p])) {
        const t = (out[sid] ||= { absent: 0, late: 0, early: 0, items: [] });
        t[r.kind]++;
        t.items.push({ date: day.date, period: Number(p), record: r });
      }
    }
  }
  return out;
}

/** '결과(질병) - 보건실' */
export function subjectRecordText(r: SubjectMark, reasonLabel: Record<AttendanceReason, string>): string {
  return `${SUBJECT_KIND_LABEL[r.kind]}(${reasonLabel[r.reason]})${r.note ? ` - ${r.note}` : ''}`;
}

/**
 * 누계 CSV 줄: 머리 한 줄 + 학생마다 '번호, 이름, 결과, 지각, 조퇴, 합계'. students = 명렬표 차례(전출 학생도 기록이 있으면).
 * 명렬표에 없는 학생(지운 학생)의 기록은 끝에 '(지운 학생)'으로.
 */
export function summaryCsvRows(students: ReadonlyArray<{ sid: string; num: number; name: string }>, totals: Record<string, SubjectStudentTotal>): (string | number)[][] {
  const rows: (string | number)[][] = [['번호', '이름', '결과', '지각', '조퇴', '합계']];
  const line = (num: number | string, name: string, t: SubjectStudentTotal | undefined) => {
    const a = t?.absent || 0;
    const l = t?.late || 0;
    const e = t?.early || 0;
    rows.push([num, name, a, l, e, a + l + e]);
  };
  const seen = new Set<string>();
  for (const s of students) {
    line(s.num, s.name, totals[s.sid]);
    seen.add(s.sid);
  }
  for (const [sid, t] of Object.entries(totals)) if (!seen.has(sid)) line('', '(지운 학생)', t);
  return rows;
}
