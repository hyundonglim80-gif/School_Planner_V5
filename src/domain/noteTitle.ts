// 메모 제목 (순수). 제목은 적은 것만 보여 준다 - 적지 않았으면 제목 자리를 비워 둔다(10-26 사용자 요청 - #49는 첫 줄을 제목처럼 보였다).
// 제목을 기준으로 하는 곳(메모 화면 정렬 '제목'·검색·링크 고르기·휴지통 줄)은 제목이 없으면 첫 줄을 대신 쓴다(titleKey - 저장하지 않는다).

const checkboxStrip = (line: string) => line.replace(/^[☐☑]\s*/, '');

/** 적은 제목 (앞뒤 빈칸을 뗀 것, 없으면 '') */
export const ownTitle = (item: { title?: string }): string => (item.title ?? '').trim();

/** 본문의 첫 줄 (빈 줄은 건너뛰고 '☐ '·'☑ ' 표시는 뗀다, 없으면 '') */
export function firstTextLine(text: string | undefined | null): string {
  return (
    (text || '')
      .split('\n')
      .map((l) => checkboxStrip(l.trim()))
      .find((l) => l.length > 0) ?? ''
  );
}

/** 제목을 기준으로 할 때의 글 = 적은 제목, 없으면 본문 첫 줄 (정렬·검색·목록에서 메모를 가리킬 때) */
export const titleKey = (item: { title?: string; text?: string }): string => ownTitle(item) || firstTextLine(item.text);
