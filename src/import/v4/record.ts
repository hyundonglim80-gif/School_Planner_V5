// 가져오기 기록 (DESIGN 8-1) - 그 공간의 `settings/import` 문서 하나.
//
// 설정 문서(common·pc·mobile)에 두지 않는다: 설정 맞추기(data/settingsSync)가 그 문서를 아는 칸만으로 통째로 다시 쓰므로
// 모르는 칸(기록)은 다음 설정 저장에서 지워진다. 기록은 설정이 아니라 '언제 무엇을 가져왔나'라 따로 둔다(PLAN 5장 'P2-4 기록').
//
//   at        마지막으로 끝낸 때(ms - 보이기만 한다. 다시 가져오기 규칙은 문서마다 src.h로 - plan.ts)
//   counts    지난 결과 표 (종류 → 수)
//   labelMap  라벨 짝 표: V4 이름 → V5 라벨 id (종류마다). 이름이 같은 V5 라벨에 이은 것도 여기에 - 결정적 id만으로는 셈할 수 없다.
//             V4 항목은 라벨을 이름·id·'[이름]'으로 들고 있어 P3-4는 V4 라벨 목록으로 이름을 푼 뒤(resolveEventLabelNames) 이것으로 찾는다
//   settings  설정 칸마다 가져오기가 지난번에 적은 값 (pc·mobile·common) - 그 뒤 V5에서 바꿨는지 칸마다 본다(settings.ts)
//   dismissed 처음 로그인 띠를 닫았다(계정에 하나 - 다른 기기에서도 다시 뜨지 않는다)
//   notes     결과 표 아래에 적는 수 (뺀 공휴일 일정·자동 기록, 일정 날에 둔 알림, 합친 기간 일정, 반복 묶음, 뺀 링크 - P3-4)
import type { DocPath } from '../../data/types';
import type { ImportCounts } from './plan';

export interface ImportRecord {
  at?: number;
  counts?: Record<string, ImportCounts>;
  labelMap?: { event?: Record<string, string>; note?: Record<string, string> };
  settings?: Record<string, Record<string, unknown>>;
  dismissed?: boolean;
  notes?: Record<string, number>;
}

export const recordPath = (sid: string): DocPath<'settings'> => ({ sid, coll: 'settings', id: 'import' });

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

function readCounts(v: unknown): ImportCounts | null {
  if (!isObj(v)) return null;
  const n = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : 0);
  const out: ImportCounts = { added: n(v.added), changed: n(v.changed), same: n(v.same), kept: n(v.kept), removed: n(v.removed) };
  if (isObj(v.years)) out.years = Object.fromEntries(Object.entries(v.years).map(([y, c]) => [y, n(c)]));
  return out;
}

const readMap = (v: unknown): Record<string, string> =>
  isObj(v) ? Object.fromEntries(Object.entries(v).filter((e): e is [string, string] => typeof e[1] === 'string')) : {};

/** 문서 → 기록 (틀린 칸은 버린다). 문서가 없으면 빈 기록 */
export function readRecord(data: unknown): ImportRecord {
  if (!isObj(data)) return {};
  const out: ImportRecord = {};
  if (typeof data.at === 'number') out.at = data.at;
  if (isObj(data.counts)) {
    out.counts = {};
    for (const [k, v] of Object.entries(data.counts)) {
      const c = readCounts(v);
      if (c) out.counts[k] = c;
    }
  }
  if (isObj(data.labelMap)) out.labelMap = { event: readMap(data.labelMap.event), note: readMap(data.labelMap.note) };
  if (isObj(data.settings)) {
    out.settings = Object.fromEntries(Object.entries(data.settings).filter((e): e is [string, Record<string, unknown>] => isObj(e[1])));
  }
  if (data.dismissed === true) out.dismissed = true;
  if (isObj(data.notes)) out.notes = Object.fromEntries(Object.entries(data.notes).filter((e): e is [string, number] => typeof e[1] === 'number'));
  return out;
}

/** 기록 → 문서에 적을 것 (빈 칸은 뺀다) */
export function recordData(r: ImportRecord): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(r)) if (v !== undefined) out[k] = v;
  return out;
}

/** 결과 표의 줄 - 종류 열쇠와 화면 이름 (차례대로). 가져오기를 더하는 세션이 줄을 더한다 */
export const IMPORT_KINDS: ReadonlyArray<{ key: string; name: string }> = [
  { key: 'labels.event', name: '일정 라벨' },
  { key: 'labels.note', name: '메모·기록 라벨' },
  { key: 'settings', name: '설정' },
  { key: 'items.event', name: '일정' },
  { key: 'series', name: '반복 묶음' },
  { key: 'items.note', name: '기록·메모' },
  { key: 'timetables', name: '시간표' },
  { key: 'lessonDays', name: '수업 칸(날짜)' },
  { key: 'progress', name: '진도' },
  { key: 'classes', name: '학급(명렬표)' },
  { key: 'attendance', name: '출석부(날짜)' },
  { key: 'subjectAttendance', name: '교과 출결(날짜)' },
  { key: 'notices', name: '알림장(날짜)' },
  { key: 'evaluations', name: '조사표' },
  { key: 'seating', name: '자리표' },
  { key: 'classHub', name: '모둠·뽑기(학급)' },
  { key: 'quiz', name: '이름 암기(학급)' },
];

/** 결과 표 아래 한 줄 - notes 열쇠 → 글 (0이면 적지 않는다) */
export const IMPORT_NOTES: ReadonlyArray<{ key: string; text: (n: number) => string }> = [
  { key: 'periods', text: (n) => `기간 일정 ${n}개를 한 항목씩으로 합쳤습니다` },
  { key: 'series', text: (n) => `반복 일정 ${n}묶음을 이었습니다` },
  { key: 'holidays', text: (n) => `공휴일 일정 ${n}개는 가져오지 않았습니다(공휴일은 달력이 따로 보입니다)` },
  { key: 'autoJournals', text: (n) => `알림장·출결 자동 기록 ${n}개는 가져오지 않았습니다(기록 칸에 원본이 보입니다)` },
  { key: 'alarmMoved', text: (n) => `알림 날짜가 일정 날과 달랐던 ${n}개는 일정 날 그 시각으로 두었습니다` },
  { key: 'empty', text: (n) => `글이 비어 있던 ${n}개는 가져오지 않았습니다` },
  { key: 'linksDropped', text: (n) => `상대를 찾지 못한(지웠거나 공유 그룹의) 링크 ${n}개는 이지 않았습니다` },
  { key: 'classSkipped', text: (n) => `학년·반이 숫자가 아닌 학급 ${n}개는 가져오지 않았습니다` },
  { key: 'noClass', text: (n) => `학급을 알 수 없는 출결·조사표·자리표 ${n}개는 가져오지 않았습니다` },
  { key: 'quizDropped', text: (n) => `명렬표에 없는 이름의 암기 성적 ${n}개는 가져오지 않았습니다` },
];
