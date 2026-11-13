// 메모 제목 (순수). **제목 = 글의 첫 줄**(11-13 사용자 요청 P35 - 쓰는 칸의 제목 줄을 없앴다. 10-26 '적은 것만 보인다'를 바꿈).
//   카드·목록 줄·보기 칸은 첫 줄을 굵은 제목으로 보이고 본문은 그 아래 줄부터(noteHeading - 첫 줄이 두 번 보이지 않게, #49 교훈).
//   첫 줄이 체크 줄(☐/☑)이면 제목 없이 본문 전체(체크 줄은 눌러서 체크하는 줄이라 떼면 누를 수 없다).
//   예전에 적은 제목(item.title)이 있으면 그것이 제목이고 본문은 전체 - 고치는 칸을 열면 그 제목을 글 첫 줄로 올린다(foldTitle).
// 제목을 기준으로 하는 곳(메모 화면 정렬 '제목'·검색·링크 고르기·휴지통 줄)은 titleKey(적은 제목, 없으면 첫 줄 - 저장하지 않는다).
import { checkLineState } from './checkLines';

const checkboxStrip = (line: string) => line.replace(/^[☐☑]\s*/, '');

/** 예전에 적은 제목 (앞뒤 빈칸을 뗀 것, 없으면 '') - P35부터 새로 적지 않는다 */
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

export interface NoteHeading {
  /** 보일 제목 ('' = 제목 줄 없음) */
  title: string;
  /** 제목으로 뗀 글의 줄 번호 (text.split('\n')) - 본문은 이 줄을 빼고 그린다. 예전 제목이거나 제목이 없으면 null */
  line: number | null;
}

/** 카드·목록 줄·보기 칸의 제목 = 예전 제목, 없으면 글의 첫 줄(체크 줄이면 없음) */
export function noteHeading(item: { title?: string; text?: string }): NoteHeading {
  const own = ownTitle(item);
  if (own) return { title: own, line: null };
  const lines = (item.text ?? '').split('\n');
  const line = lines.findIndex((l) => l.trim().length > 0);
  if (line < 0 || checkLineState(lines[line]) !== null) return { title: '', line: null };
  return { title: lines[line].trim(), line };
}

/** 제목 줄을 뺀 본문 (그 아래 줄부터 - 앞의 빈 줄도 뗀다). line이 null이면 글 그대로 */
export function bodyAfterHeading(text: string | undefined | null, line: number | null): string {
  const t = text ?? '';
  if (line === null) return t;
  const rest = t.split('\n').slice(line + 1);
  while (rest.length > 0 && !rest[0].trim()) rest.shift();
  return rest.join('\n');
}

/** 고치는 칸의 글 = 예전 제목을 첫 줄로 올린 글 (제목 줄이 없어 고칠 길이 없으니 - P35) */
export function foldTitle(item: { title?: string; text?: string }): string {
  const own = ownTitle(item);
  const text = item.text ?? '';
  if (!own) return text;
  return text.trim() ? `${own}\n${text}` : own;
}
