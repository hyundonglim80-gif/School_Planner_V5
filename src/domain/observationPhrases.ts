// 관찰 문구 단추 (V4 lib/observationPhrases.ts) - 순수 함수. 목록은 계정 설정 common.phrases(기본값과 같으면 적지 않는다).
//   자리표 학생 칸에서 누르면 그 학생을 붙여 오늘 기록에 한 줄. 학생 기록(누가기록 - P7-4)도 같은 목록을 쓴다.

export const DEFAULT_PHRASES = ['발표를 잘함', '친구를 도움', '수업에 집중함', '과제를 성실히 함', '질문을 많이 함', '준비물을 안 가져옴'];

export const MAX_PHRASES = 30;
export const MAX_PHRASE_LENGTH = 40;

/** 한 문구 다듬기 (빈칸 하나로·앞뒤 빈칸 빼기·길이) */
export const cleanPhrase = (v: unknown) =>
  String(v ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_PHRASE_LENGTH);

/** 빈 것·겹치는 것·너무 긴 것을 걸러 차례대로 */
export function sanitizePhrases(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const v of raw) {
    const p = cleanPhrase(v);
    if (p && !out.includes(p)) out.push(p);
    if (out.length >= MAX_PHRASES) break;
  }
  return out;
}

/** 문구 더하기 - 안 되면 까닭 글자 */
export function addPhrase(list: readonly string[], raw: string): { list: string[] } | { problem: string } | null {
  const p = cleanPhrase(raw);
  if (!p) return null;
  if (list.includes(p)) return { problem: '이미 있는 문구입니다.' };
  if (list.length >= MAX_PHRASES) return { problem: `문구는 ${MAX_PHRASES}개까지 둘 수 있습니다.` };
  return { list: [...list, p] };
}
