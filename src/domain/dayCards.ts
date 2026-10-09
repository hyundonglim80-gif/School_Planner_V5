// 기록 칸의 '📢 알림장'·'📋 출결' 카드 (DESIGN 5-4) - 저장하지 않고 그날 알림장·출석부 문서에서 계산한다(순수).
//   V4는 알림장·출석부를 저장할 때 그날 기록 칸에 사본 항목(notice_{date}·attendance_…)을 만들고 거꾸로도 맞췄다 - V5는 사본이 없다.
//   카드를 누르면 원본 칸(알림장·출석부)이 열린다. 검색에도 '기록'으로 나온다(searchDayCards).
import { dayLines, readMarks } from './attendance';
import { numberedNotice, readNoticeLines } from './notices';
import { classLabelOf, type RosterClass } from './roster';
import type { DateRange } from './search';

export interface DayCard {
  /** 'notice:날짜' · 'attendance:학급:날짜' */
  key: string;
  kind: 'notice' | 'attendance';
  date: string;
  /** '📢 알림장' · '📋 출결 5-2' */
  title: string;
  /** 카드 줄 (알림장은 번호를 붙여) */
  lines: string[];
  /** 출결 카드의 학급 */
  classId?: string;
}

/** 그날 알림장 카드 (줄이 없으면 null) */
export function noticeCard(date: string, lines: unknown): DayCard | null {
  const list = readNoticeLines(lines);
  if (list.length === 0) return null;
  return { key: `notice:${date}`, kind: 'notice', date, title: '📢 알림장', lines: numberedNotice(list).split('\n') };
}

/** 그날 출결 카드 - 학급마다 하나, 모두 출석이면 없다 (명렬표에서 지운 학급은 학급 id로) */
export function attendanceCard(doc: { classId: string; date: string; records?: unknown }, classes: readonly (RosterClass & { id: string })[]): DayCard | null {
  const marks = readMarks(doc.records);
  if (Object.keys(marks).length === 0) return null;
  const cls = classes.find((c) => c.id === doc.classId);
  return {
    key: `attendance:${doc.classId}:${doc.date}`,
    kind: 'attendance',
    date: doc.date,
    title: `📋 출결 ${cls ? classLabelOf(cls) : doc.classId}`,
    lines: dayLines(marks, cls?.students ?? []),
    classId: doc.classId,
  };
}

/** 찾기 - 제목·줄에서 (검색어가 비면 기간의 모든 것), 날짜 내림차순 */
export function searchDayCards(cards: readonly DayCard[], term: string, range: DateRange | null): DayCard[] {
  const raw = term.trim().toLowerCase();
  const all = raw === '' || raw === '*';
  return cards
    .filter((c) => !range || !range.start || !range.end || (c.date >= range.start && c.date <= range.end))
    .filter((c) => all || `${c.title}\n${c.lines.join('\n')}`.toLowerCase().includes(raw))
    .sort((a, b) => b.date.localeCompare(a.date));
}
