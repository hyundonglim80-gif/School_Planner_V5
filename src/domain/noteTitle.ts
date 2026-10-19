// 메모 제목 (순수). 적은 제목이 있으면 그것, 없으면 본문 첫 줄의 앞 몇 글자를 제목으로 보여 준다(저장하지 않는다 - 계산할 수 있는 것은 저장하지 않는다).

const checkboxStrip = (line: string) => line.replace(/^[☐☑]\s*/, '');

/** 제목 없는 메모의 첫 줄을 자를 글자 수 */
export const AUTO_TITLE_LIMIT = 20;

/** 적은 제목 (앞뒤 빈칸을 뗀 것, 없으면 '') */
export const ownTitle = (item: { title?: string }): string => (item.title ?? '').trim();

/** 본문 첫 줄의 앞 몇 글자 ('☐ '·'☑ ' 표시는 뗀다) */
export function autoTitle(text: string | undefined | null): string {
  const first = (text || '')
    .split('\n')
    .map((l) => checkboxStrip(l.trim()))
    .find((l) => l.length > 0);
  if (!first) return '';
  const chars = Array.from(first);
  return chars.length > AUTO_TITLE_LIMIT ? chars.slice(0, AUTO_TITLE_LIMIT).join('') + '…' : first;
}

/** 보여 줄 제목 = 적은 제목, 없으면 첫 줄의 앞 몇 글자 */
export const noteTitle = (item: { title?: string; text?: string }): string => ownTitle(item) || autoTitle(item.text);
