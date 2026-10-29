// 남은 쓰던 글 목록의 줄 하나 (P14-6 ■1b - 창 'drafts'·앱을 열 때 띠). 보관 열쇠(data/drafts)를 읽어 어느 칸의 글인지·무엇이라 보일지 정한다.
//   열쇠 = 'note:{sid}:{id}' · 'note:{sid}:new:{날짜|memo}' · 'event:{sid}:{id}' · 'event:{sid}:new:{날짜}' (NotePanel·EventPanel의 useDraft)
//   '열기'는 그 칸을 같은 열쇠로 다시 연다 → 칸 맨 위 '📝 저장하지 않은 글이 있습니다 - 되살리기'.
import { shortDateLabel, todayStr } from '../../domain/dateUtils';
import type { YMD } from '../../data/types';

export interface DraftPlace {
  kind: 'note' | 'event';
  sid: string;
  /** 고치던 항목 (없으면 새 칸) */
  id?: string;
  /** 새 칸의 자리(날짜 - 메모 화면의 새 메모는 null) · 고치던 칸은 연 때의 날(보이기만) */
  date: YMD | null;
}

const isDay = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

/** 열쇠 → 칸 자리. 모르는 열쇠(다른 칸이 쓰기 시작한 것)는 null - 목록에서 뺀다 */
export function draftPlace(key: string, value: unknown): DraftPlace | null {
  const [kind, sid, ...rest] = key.split(':');
  if ((kind !== 'note' && kind !== 'event') || !sid || rest.length === 0) return null;
  const v = (value ?? {}) as { date?: unknown; dates?: unknown };
  if (rest[0] === 'new') {
    const at = rest.slice(1).join(':');
    if (kind === 'note') return { kind, sid, date: isDay(at) ? at : null };
    return isDay(at) ? { kind, sid, date: at } : null;
  }
  const id = rest.join(':');
  const firstDate = Array.isArray(v.dates) && typeof v.dates[0] === 'string' ? v.dates[0] : null;
  const date = typeof v.date === 'string' && isDay(v.date) ? v.date : firstDate && isDay(firstDate) ? firstDate : null;
  // 일정 칸은 날이 있어야 열린다 - 남은 글에 날이 없으면 오늘로 열고 칸이 항목의 날을 보인다
  return { kind, sid, id, date: kind === 'event' ? (date ?? todayStr()) : date };
}

/** 줄의 자리 글: '새 메모 · 10/30(목)' · '고치던 일정' … (그룹 공간이면 뒤에 '· 그룹') */
export function draftPlaceLabel(p: DraftPlace): string {
  const noun = p.kind === 'note' ? '메모' : '일정';
  const head = p.id ? `고치던 ${noun}` : `새 ${noun}`;
  const day = !p.id && p.date ? ` · ${shortDateLabel(p.date)}` : '';
  return `${head}${day}${p.sid.startsWith('u_') ? '' : ' · 그룹'}`;
}

/** 줄의 글: 제목(메모) 또는 글의 첫 줄, 40자까지 */
export function draftSummary(value: unknown): string {
  const v = (value ?? {}) as { title?: unknown; text?: unknown };
  const title = typeof v.title === 'string' ? v.title.trim() : '';
  const line = typeof v.text === 'string' ? (v.text.split('\n').find((l) => l.trim()) ?? '').trim() : '';
  const s = title || line;
  if (!s) return '(글 없음 - 첨부·표·날짜만)';
  return s.length > 40 ? `${s.slice(0, 40)}…` : s;
}
