// 학기 셈 한 곳 (V4 lib/semester.ts 그대로 - 링크 연결 창·검색·내보내기·출석 누계·시간표가 함께 쓴다).
// 방학은 계정에 하나인 설정 `settings/common.terms`(학년도마다 - 아래 'V5: 학년도마다 방학')를 시간표 창 '학기·방학' 탭에서 적는다.
import { academicYearOf, formatDate } from './dateUtils';

// 학기는 직접 입력하지 않고 방학 기간에서 계산한다.
//   1학기 = 3월 1일 ~ 여름방학 시작 전날
//   2학기 = 여름방학 끝난 다음 날 ~ 겨울방학 시작 전날
export interface SemesterConfig {
  summerStart: string; // 여름 방학 시작일
  summerEnd: string;   // 여름 방학 종료일
  winterStart: string; // 겨울 방학 시작일
  winterEnd: string;   // 겨울 방학 종료일

  // 예전 문서에 남아 있는 학기 직접 입력값 (읽기 전용, 더 이상 쓰지 않음)
  sem1Start?: string;
  sem1End?: string;
  sem2Start?: string;
  sem2End?: string;
}

export const DEFAULT_SEMESTER_CONFIG: SemesterConfig = {
  summerStart: `${new Date().getFullYear()}-07-21`,
  summerEnd: `${new Date().getFullYear()}-08-16`,
  winterStart: `${new Date().getFullYear() + 1}-01-05`,
  winterEnd: `${new Date().getFullYear() + 1}-02-28`,
};

/** 날짜 문자열을 days만큼 이동시킨다. */
export function shiftDate(dateStr: string, days: number): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return '';
  d.setDate(d.getDate() + days);
  return formatDate(d);
}

/** 방학 기간에서 1·2학기 기간을 계산한다. */
export function getSemesterRanges(cfg: SemesterConfig) {
  const year = cfg.summerStart
    ? Number(cfg.summerStart.slice(0, 4))
    : new Date().getFullYear();
  return {
    sem1: {
      start: `${year}-03-01`,
      end: shiftDate(cfg.summerStart, -1),
    },
    sem2: {
      start: shiftDate(cfg.summerEnd, 1),
      end: shiftDate(cfg.winterStart, -1),
    },
  };
}

/**
 * 학년도 범위 (3월 1일 ~ 이듬해 2월 말일 - 윤년이면 29일).
 * 예전에는 곳곳에서 2월 28일로 끝내 윤년의 2월 29일 자료가 검색·링크·내보내기에서 빠졌다.
 * (날짜 칸에 그대로 보이므로 없는 날 '2027-02-29'를 쓰지 않는다 - 날짜 칸이 비어 버린다)
 */
export function schoolYearSpan(year: number): { start: string; end: string } {
  const febLast = new Date(year + 1, 2, 0).getDate();
  return { start: `${year}-03-01`, end: `${year + 1}-02-${febLast}` };
}

/**
 * 그 학년도의 1·2학기 범위 (검색·링크·내보내기·출석 누계의 '1학기 / 2학기').
 * evalSummary.semesterOf와 같은 규칙으로 학년도를 빈틈없이 나눈다:
 *   그 학년도의 방학 설정이 있으면 2학기 = 여름 방학 끝난 다음 날 ~ 2월 끝, 1학기 = 3월 1일 ~ 그 전날.
 *   (여름 방학은 1학기, 겨울 방학과 2월은 2학기 쪽 - 방학 중에 적은 것도 어느 학기엔가 들어간다)
 *   설정이 없거나 다른 학년도의 설정이면 3~8월이 1학기, 9월 ~ 2월이 2학기.
 * 예전에는 화면마다 '8/15까지', '8/31까지'로 따로 정했고, 1~2월에 열면 달력의 해로 셈해 다음 학년도를 찾았다.
 */
export function semesterSpan(year: number, sem: 1 | 2, cfg?: SemesterConfig | null): { start: string; end: string } {
  const all = schoolYearSpan(year);
  let sem2Start = `${year}-09-01`;
  if (cfg?.summerStart && cfg.summerEnd && Number(cfg.summerStart.slice(0, 4)) === year) {
    const s = shiftDate(cfg.summerEnd, 1);
    if (s) sem2Start = s;
  }
  return sem === 1 ? { start: all.start, end: shiftDate(sem2Start, -1) } : { start: sem2Start, end: all.end };
}

/** 그 날이 방학인지 (방학에는 시간표 수업을 채우지 않는다) */
export function isVacationDay(dateStr: string, cfg: SemesterConfig): boolean {
  const inRange = (start?: string, end?: string) =>
    !!start && !!end && dateStr >= start && dateStr <= end;
  return inRange(cfg.summerStart, cfg.summerEnd) || inRange(cfg.winterStart, cfg.winterEnd);
}

// ── V5: 학년도마다 방학 (settings/common.terms - DESIGN 4-5) ──
// V4는 방학 설정이 한 벌이라 해가 바뀌면 고쳐 적어야 했다(지난 학년도 날의 수업 칸도 새 방학으로 셈했다).
// V5는 학년도를 열쇠로 둔다. 학기는 저장하지 않고 방학에서 셈한다(원칙 '계산할 수 있는 것은 저장하지 않는다' - V4 getSemesterRanges).

export interface DateSpan {
  from: string;
  to: string;
}

export interface YearTerms {
  summer?: DateSpan;
  winter?: DateSpan;
}

/** 학년도('2026') → 방학 */
export type SchoolTerms = Record<string, YearTerms>;

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

function readSpan(v: unknown): DateSpan | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const { from, to } = v as Record<string, unknown>;
  return typeof from === 'string' && typeof to === 'string' && YMD_RE.test(from) && YMD_RE.test(to) && from <= to ? { from, to } : undefined;
}

/** 설정 문서 값 → 방학 표 (틀린 칸은 뺀다). 표 모양이 아니면 undefined = 기본값 */
export function readTerms(v: unknown): SchoolTerms | undefined {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return undefined;
  const out: SchoolTerms = {};
  for (const [year, t] of Object.entries(v as Record<string, unknown>)) {
    if (!/^\d{4}$/.test(year) || !t || typeof t !== 'object') continue;
    const summer = readSpan((t as Record<string, unknown>).summer);
    const winter = readSpan((t as Record<string, unknown>).winter);
    if (summer || winter) out[year] = { ...(summer ? { summer } : {}), ...(winter ? { winter } : {}) };
  }
  return out;
}

/** 그 학년도의 방학을 옛 모양(SemesterConfig)으로 - 학기 셈(semesterSpan)이 받는다. 여름 방학이 없으면 null(3~8월 / 9~2월) */
export function semesterConfigOf(terms: SchoolTerms | null | undefined, year: number): SemesterConfig | null {
  const t = terms?.[String(year)];
  if (!t?.summer) return null;
  return {
    summerStart: t.summer.from,
    summerEnd: t.summer.to,
    winterStart: t.winter?.from ?? '',
    winterEnd: t.winter?.to ?? '',
  };
}

/** 그 날이 그 학년도의 방학인가 (방학에는 시간표 수업이 없다 - domain/lessons) */
export function isVacation(date: string, terms: SchoolTerms | null | undefined): boolean {
  const t = terms?.[String(academicYearOf(date))];
  if (!t) return false;
  const inSpan = (s?: DateSpan) => !!s && date >= s.from && date <= s.to;
  return inSpan(t.summer) || inSpan(t.winter);
}

/** 시간표 창에 보이는 학기 (V4 '학기는 자동으로 계산됩니다': 1학기 = 3/1 ~ 여름 방학 전날, 2학기 = 여름 방학 다음 날 ~ 겨울 방학 전날) */
export function termSemesters(t: YearTerms | undefined, year: number): { sem1: DateSpan | null; sem2: DateSpan | null } {
  const sem1 = t?.summer ? { from: `${year}-03-01`, to: shiftDate(t.summer.from, -1) } : null;
  const sem2 = t?.summer && t.winter ? { from: shiftDate(t.summer.to, 1), to: shiftDate(t.winter.from, -1) } : null;
  return { sem1: sem1 && sem1.from <= sem1.to ? sem1 : null, sem2: sem2 && sem2.from <= sem2.to ? sem2 : null };
}
