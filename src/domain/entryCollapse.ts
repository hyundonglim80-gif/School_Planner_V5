// 기록·메모 카드를 언제 접어서 보여 줄지 (V4 lib/entryCollapse.ts) - 한 곳에서 정한다.
//
// 긴 기록 하나가 목록의 한 칸을 통째로 차지해 버리면, 그 아래 것들을 보려고
// 한참을 내려야 한다. 그래서 일정 크기를 넘는 것은 접은 채로 시작하고,
// 필요할 때 펼치게 한다. 기록과 메모가 서로 다른 기준을 쓰면 같은 길이의 글이
// 화면마다 다르게 보이므로 기준을 나누지 않는다.

// 기준을 정한 근거.
// 기록·메모는 넓은 화면에서 4단으로 늘어서고, 카드 한 칸의 본문 폭은 250px 남짓,
// 한 줄에 한글 16자쯤 들어간다. 그래서 글자 수가 곧 카드 높이가 된다.
//   120자 -> 약 8줄,  180자 -> 약 11줄
// 처음에 200자로 잡았다가, 실제 화면에서 181자짜리 상담 기록이 안 접혀 한 칸을
// 통째로 차지하는 것을 보고 120자로 낮췄다. 숫자만 보지 말고 눈으로 확인할 것.
/** 이 글자 수를 넘으면 길다고 본다 */
export const COLLAPSE_CHAR_LIMIT = 120;

/** 이 줄 수를 넘으면 길다고 본다 (짧은 줄이 여러 개인 목록형 글) */
export const COLLAPSE_LINE_LIMIT = 5;

/** 접었을 때 보여 줄 미리보기 길이 */
export const PREVIEW_CHAR_LIMIT = 60;

/**
 * 접은 채로 시작할 만큼 긴가.
 * 첨부나 이미지는 기준에 넣지 않는다. 사진 한 장만 붙은 짧은 메모까지
 * 접히면 오히려 답답하고, 그림은 그 자체로 훑어보기 좋은 정보다.
 */
export function isLongEntry(text: string | undefined | null): boolean {
  const t = (text || '').trim();
  if (!t) return false;
  if (t.length > COLLAPSE_CHAR_LIMIT) return true;
  return t.split('\n').length > COLLAPSE_LINE_LIMIT;
}

/**
 * 접힌 카드에 한 줄로 보여 줄 요약.
 * 접었을 때 아무것도 안 보이면 어느 항목인지 알 수 없어 펼쳐 봐야만 한다.
 */
export function previewLine(text: string | undefined | null): string {
  const first = (text || '')
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.length > 0);
  if (!first) return '';
  return first.length > PREVIEW_CHAR_LIMIT ? first.slice(0, PREVIEW_CHAR_LIMIT) + '…' : first;
}

// ── 펼침·접힘 기억 (11-23 사용자 요청 '펼쳤던 메모는 펼친 채로, 접은 메모는 접힌 채로') ──
// 메모마다 사용자가 누른 것만 담는다(true = 펼침, false = 접힘). 누른 적 없는 메모는 화면 기본값 -
// 카드는 길이를 보고(isLongEntry), 메모 화면 목록 줄은 접힌 채. 카드와 목록 줄·하루 칸과 메모 화면이 같은 값을 쓴다(같은 메모).

/** 기억하는 메모 수 - 넘으면 가장 오래 손대지 않은 것부터 잊는다 (이 기기 저장소가 끝없이 늘지 않게) */
export const ENTRY_OPEN_LIMIT = 1000;

export type EntryOpenMap = Readonly<Record<string, boolean>>;

/** id의 펼침을 적은 새 표 - 방금 누른 것을 맨 뒤로 옮기고, 한도를 넘으면 앞(오래된 것)부터 뺀다 */
export function rememberEntryOpen(map: EntryOpenMap, id: string, open: boolean, limit = ENTRY_OPEN_LIMIT): Record<string, boolean> {
  const next: Record<string, boolean> = {};
  const keys = Object.keys(map).filter((k) => k !== id);
  for (const k of keys.slice(Math.max(0, keys.length - (limit - 1)))) next[k] = map[k];
  next[id] = open;
  return next;
}

/** 카드가 접혀 있나 - 누른 적이 있으면 그 값, 없으면 길이로 */
export function isCardCollapsed(map: EntryOpenMap, id: string, text: string | undefined | null): boolean {
  const open = map[id];
  return open === undefined ? isLongEntry(text) : !open;
}

/** 목록 줄이 펼쳐져 있나 - 누른 적이 없으면 접힌 채 (P11-1) */
export function isRowExpanded(map: EntryOpenMap, id: string): boolean {
  return map[id] === true;
}
