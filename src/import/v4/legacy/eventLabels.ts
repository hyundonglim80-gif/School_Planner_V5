// V4 hooks/useLabels.ts(normalizeEventLabel·기본 라벨)와 lib/eventLabels.ts(resolveEventLabelNames)에서 옮긴 읽기 (DESIGN 8-1).
//
// V4 일정 라벨은 settings/labels 문서의 eventLabels 배열(V3와 함께 쓴다). 속성 이름이 두 벌이다:
//   V3 isSkip/isForward/isPeriod/isRecur/showInCalendar, V4 skip/forward/period/recur/calendar.
// ⚠️ 둘 다 있으면 V3 이름을 믿는다 - V4는 늘 두 이름을 같게 쓰는데 V3는 제 이름만 고친다(다르면 V3가 나중에 고친 것).
//
// V4 일정 항목의 라벨은 세 자리에 있을 수 있다: label('회의,완료' - 이름 또는 id), labelIds(이름 또는 id), 본문 앞 '[회의]'(V3).
// 등록된 라벨만 찾는다(지운 라벨은 뺀다). 가져오기는 V4 라벨 목록을 늘 읽은 뒤에 부르므로 V4의 keepUnknown(목록을 못 읽었을 때)은 옮기지 않았다.

export interface V4EventLabel {
  id: string;
  name: string;
  color: string;
  calendar: boolean;
  skip: boolean;
  forward: boolean;
  period: boolean;
  recur: boolean;
}

/** V4가 라벨 문서가 없을 때 보이는 기본 일정 라벨 (V4 DEFAULT_EVENT_LABELS 그대로 - 항목이 이 id·이름을 들고 있다) */
export const V4_DEFAULT_EVENT_LABELS: readonly V4EventLabel[] = [
  { id: 'ev_1', name: '달력', color: 'red', calendar: true, skip: false, forward: false, period: false, recur: false },
  { id: 'ev_2', name: '수업X', color: 'orange', calendar: true, skip: true, forward: false, period: false, recur: false },
  { id: 'ev_3', name: '이월', color: 'green', calendar: false, skip: false, forward: true, period: false, recur: false },
  { id: 'ev_4', name: '기간', color: 'indigo', calendar: false, skip: false, forward: false, period: true, recur: false },
  { id: 'ev_5', name: '반복', color: 'purple', calendar: false, skip: false, forward: false, period: false, recur: true },
];

const preferV3 = (v3: unknown, v4: unknown) => (typeof v3 === 'boolean' ? v3 : !!v4);

/** 저장된 라벨 하나 → 속성을 채운 모양. id가 없으면 V4처럼 `ev_차례_이름` */
export function normalizeEventLabel(raw: unknown, i: number): V4EventLabel {
  const l = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const name = typeof l.name === 'string' ? l.name : '';
  return {
    id: typeof l.id === 'string' && l.id ? l.id : `ev_${i}_${name}`,
    name,
    color: typeof l.color === 'string' && l.color ? l.color : 'blue',
    calendar: typeof l.showInCalendar === 'boolean' ? l.showInCalendar : l.calendar !== false,
    skip: preferV3(l.isSkip, l.skip),
    forward: preferV3(l.isForward, l.forward),
    period: preferV3(l.isPeriod, l.period),
    recur: preferV3(l.isRecur, l.recur),
  };
}

const LABEL_PREFIX = /^\[(.*?)\]\s*(.*)$/;

/** 본문 앞 '[라벨명]'의 이름 */
function prefixLabelOf(item: Record<string, unknown>): string | null {
  const content = String(item.content ?? item.text ?? '');
  const match = content.match(LABEL_PREFIX);
  return match ? match[1].trim() : null;
}

/** 항목이 들고 있는 라벨 → 등록된 라벨 이름들 (차례대로, 한 번씩) */
export function resolveEventLabelNames(item: unknown, eventLabels: ReadonlyArray<{ id: string; name: string }>): string[] {
  const it = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
  const keys: string[] = [];
  if (it.label) keys.push(...String(it.label).split(',').map((s) => s.trim()));
  if (Array.isArray(it.labelIds)) keys.push(...it.labelIds.map((k: unknown) => String(k ?? '').trim()));
  const prefix = prefixLabelOf(it);
  if (prefix) keys.push(prefix);

  const names: string[] = [];
  for (const key of keys) {
    if (!key) continue;
    const found = eventLabels.find((l) => l.id === key || l.name === key);
    if (found && !names.includes(found.name)) names.push(found.name);
  }
  return names;
}
