// 알림장 (V4 lib/notices.ts) - 순수 함수. 날짜마다 한 장, 줄마다 한 항목. 자리: 공간마다 notices/{date} = { date, lines } (DESIGN 4-7).
//   V4는 저장하면 그날 기록 칸에 '알림장' 항목을 만들었다 - V5는 기록 칸이 계산해 보인다(DESIGN 5-4).
import { addDays, shortDateLabel, weekdayOf } from './dateUtils';

/** 입력칸의 글을 항목 줄로. 앞에 붙은 '1.' '2)' '-' 같은 번호는 뗀다 */
export function splitNoticeLines(text: string): string[] {
  return String(text || '')
    .split('\n')
    .map((l) => l.replace(/^\s*(\d+\s*[.)]|[-•·*])\s*/, '').trim())
    .filter(Boolean);
}

/** 1. … 2. … 꼴로 (복사·카드에 쓴다) */
export function numberedNotice(lines: readonly string[]): string {
  return lines.map((l, i) => `${i + 1}. ${l}`).join('\n');
}

/** 보내는 글: 첫 줄에 날짜, 그 아래 번호 붙인 줄 */
export const noticeMessage = (date: string, lines: readonly string[]) => `[${shortDateLabel(date)} 알림장]\n${numberedNotice(lines)}`;

/** 저장된 칸 → 줄 (글자가 아닌 것은 뺀다) */
export const readNoticeLines = (lines: unknown): string[] => (Array.isArray(lines) ? lines.filter((l): l is string => typeof l === 'string' && !!l.trim()) : []);

/** 다음 수업일 - 주말·쉬는 날(공휴일·방학·수업X 일정)은 건너뛴다. 2주 안에 없으면 null */
export function nextClassDay(date: string, isOffDay: (d: string) => boolean): string | null {
  for (let i = 1; i <= 14; i++) {
    const d = addDays(date, i);
    const wd = weekdayOf(d);
    if (wd === 0 || wd === 6) continue;
    if (isOffDay(d)) continue;
    return d;
  }
  return null;
}

/**
 * 그날 수업 칸의 준비물과 일정으로 알림장 초안 줄.
 *   '국어 준비물: 색연필' · '현장체험학습 동의서 제출'
 * 수업 메모는 교사용이라 넣지 않는다. 그날 끝낸 일정도 뺀다.
 * lessonSupplies: 교시 → 그 교시에 하는 차시의 준비물(진도) - 수업 칸의 준비물과 한 줄로 합친다(같은 것은 한 번).
 */
export function draftLinesFrom(
  cells: readonly { n: number; subject: string; supplies: string }[],
  events: readonly { text?: string; done: boolean }[],
  lessonSupplies: Record<string, string> = {},
): string[] {
  const lines: string[] = [];
  const byN = new Map(cells.map((c) => [c.n, c]));
  const ns = new Set([...cells.map((c) => c.n), ...Object.keys(lessonSupplies).map(Number).filter(Number.isInteger)]);
  for (const n of [...ns].sort((a, b) => a - b)) {
    const cell = byN.get(n);
    const parts = [String(cell?.supplies ?? '').trim(), String(lessonSupplies[n] ?? '').trim()].filter(Boolean);
    const supplies = [...new Set(parts)].join(', ');
    if (!supplies) continue;
    const subject = String(cell?.subject ?? '').trim();
    lines.push(subject ? `${subject} 준비물: ${supplies}` : `준비물: ${supplies}`);
  }
  for (const ev of events) {
    if (ev.done) continue;
    const text = String(ev.text ?? '').trim();
    if (text) lines.push(text);
  }
  return lines;
}

/**
 * 알림장에 넣을 급식 줄 (나이스). 알레르기 번호는 뺀다 - 번호표 없이는 읽을 수 없다(하루 화면에는 보인다).
 *   '10/2(금) 급식: 현미밥, 꽃게된장국' · 조식·석식이 있는 학교는 끼니를 붙인다: '10/2(금) 중식: …'
 */
export function mealNoticeLines(meals: readonly { date: string; kind: string; dishes: readonly { name: string }[] }[], date: string): string[] {
  const label = shortDateLabel(date);
  const today = meals.filter((m) => m.date === date && m.dishes.length > 0);
  return today.map((m) => `${label} ${today.length > 1 ? m.kind : '급식'}: ${m.dishes.map((d) => d.name).join(', ')}`);
}

/** 지금 줄에 없는 것만 더한다 (불러오기·급식) */
export function appendFresh(current: readonly string[], more: readonly string[]): { lines: string[]; added: number } {
  const fresh = more.filter((l) => !current.includes(l));
  return { lines: [...current, ...fresh], added: fresh.length };
}
