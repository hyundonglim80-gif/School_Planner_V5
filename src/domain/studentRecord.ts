// 학생 기록(누가기록) (V4 components/StudentRecordModal.tsx의 셈) - 순수 함수. 한 학생의 한 해를 날짜 차례로.
//   V4는 글에 적힌 학생 태그(#26040305)를 찾아 기록·메모를 범위로 다시 읽었다 - V5는 기록·메모의 studentIds('{classId}/{sid}')로 사본에서 고른다.
//   출결(출석부)·교과 출결(교과 모드)은 그 학급 문서에서, 조사표는 domain/evaluation.
import { recordText, type AttendanceMark } from './attendance';
import { EVAL_TYPE_LABEL, evalCellText, isEmptyCell, type EvalCell, type EvalType } from './evaluation';

export type TimelineKind = 'journal' | 'memo' | 'attendance' | 'subjectAttendance';
export const TIMELINE_LABEL: Record<TimelineKind, string> = { journal: '기록', memo: '메모', attendance: '출결', subjectAttendance: '교과 출결' };

export interface TimelineItem {
  key: string;
  date: string;
  kind: TimelineKind;
  text: string;
  /** 기록·메모: 그 항목 id와 공간 */
  itemId?: string;
  space?: string;
  shared?: boolean;
  /** 기록·메모의 라벨 이름 (', '로) */
  labels?: string;
}

interface NoteLike {
  id: string;
  date?: string | null;
  fromDate?: string | null;
  createdAt?: number;
  text?: string;
  studentIds?: readonly string[];
  deletedAt?: unknown;
}

const pad = (n: number) => String(n).padStart(2, '0');
const dayOf = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** 그 학생이 붙은 기록·메모 → 줄 (메모는 날짜가 없어 기록에서 옮겨 온 날, 없으면 만든 날 - V4 그대로) */
export function noteTimeline(
  notes: readonly NoteLike[],
  studentKey: string,
  space: string,
  shared: boolean,
  labelsOf: (n: NoteLike) => string = () => '',
): TimelineItem[] {
  const out: TimelineItem[] = [];
  for (const n of notes) {
    if (n.deletedAt || !n.studentIds?.includes(studentKey)) continue;
    const memo = !n.date;
    const date = n.date || n.fromDate || (n.createdAt ? dayOf(n.createdAt) : '');
    out.push({ key: `${space}:${n.id}`, date, kind: memo ? 'memo' : 'journal', text: n.text ?? '', itemId: n.id, space, shared, labels: labelsOf(n) });
  }
  return out;
}

/** 출결 내역 → 줄 */
export function attendanceTimeline(history: ReadonlyArray<{ date: string; record: AttendanceMark }>): TimelineItem[] {
  return history.map((h) => ({ key: `att:${h.date}`, date: h.date, kind: 'attendance' as const, text: recordText(h.record) }));
}

const KIND_ORDER: Record<TimelineKind, number> = { attendance: 0, subjectAttendance: 1, journal: 2, memo: 2 };

/** 날짜 차례 (같은 날은 출결 → 교과 출결 → 기록·메모) */
export function sortTimeline(items: readonly TimelineItem[]): TimelineItem[] {
  return [...items].sort((a, b) => a.date.localeCompare(b.date) || KIND_ORDER[a.kind] - KIND_ORDER[b.kind]);
}

/** '📋 전체 복사' 글 - 머리 한 줄 + 날짜 차례(조사표는 적은 값이 있는 것만 섞는다) */
export function recordCopyText(
  head: string,
  items: readonly TimelineItem[],
  evals: ReadonlyArray<{ date: string; type: EvalType; subject?: string; title: string; cell: EvalCell }>,
): string {
  const lines = [
    ...items.map((it) => ({ date: it.date, line: `${it.date} [${TIMELINE_LABEL[it.kind]}] ${it.text.replace(/\n+/g, ' / ')}` })),
    ...evals
      .filter((e) => !isEmptyCell(e.cell))
      .map((e) => ({ date: e.date, line: `${e.date} [${EVAL_TYPE_LABEL[e.type]}] ${e.subject ? `${e.subject} ` : ''}${e.title}: ${evalCellText(e.cell).replace(/\n+/g, ' / ')}` })),
  ];
  return [head, ...lines.sort((a, b) => a.date.localeCompare(b.date)).map((l) => l.line)].join('\n');
}
