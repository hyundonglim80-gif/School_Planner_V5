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
import type { DocPath } from '../../data/types';
import type { ImportCounts } from './plan';

export interface ImportRecord {
  at?: number;
  counts?: Record<string, ImportCounts>;
  labelMap?: { event?: Record<string, string>; note?: Record<string, string> };
  settings?: Record<string, Record<string, unknown>>;
  dismissed?: boolean;
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
];
