// 글 안의 바꿈표 이모지를 선 아이콘으로 (P53-3 - ui/Icon·ui/glyphs). 설명서 글·'📅 날짜' 같은 단추 글.
import type { ReactNode } from 'react';
import { GLYPH_RE, glyphIcon } from './glyphs';
import { Glyph } from './Icon';

/** 글 안의 바꿈표 이모지를 아이콘으로 (나머지 글·이모지는 그대로) */
export function glyphText(text: string, className = ''): ReactNode {
  if (!text) return text;
  const parts = text.split(GLYPH_RE);
  if (parts.length === 1) return text;
  return parts.map((p, i) => (i % 2 === 1 ? <Glyph key={i} e={p} className={className} /> : p || null));
}

/**
 * 글 맨 앞의 이모지 하나만 아이콘으로 (P54-1) - 뒤에 사용자가 적은 이름(그룹·대화 방·라벨)이 오는 글.
 *   이름 속 이모지는 사용자가 쓴 글이라 그대로 둔다('👥 📚독서 모임' → 아이콘 + '📚독서 모임').
 */
export function leadGlyph(text: string, className = ''): ReactNode {
  const m = /^(\p{Extended_Pictographic}(?:\uFE0F)?(?:\u200D\p{Extended_Pictographic}\uFE0F?)*)/u.exec(text);
  if (!m || !glyphIcon(m[1])) return text;
  return (
    <>
      <Glyph e={m[1]} className={className} />
      {text.slice(m[1].length)}
    </>
  );
}

/** 요소의 글 - 선 아이콘은 원래 이모지(data-glyph)로 되읽는다 (탭 이름·시험이 '📋 출석부'처럼 읽게 - P54-1) */
export function textWithGlyphs(el: Element): string {
  const copy = el.cloneNode(true) as Element;
  copy.querySelectorAll('[data-glyph]').forEach((g) => g.replaceWith(g.getAttribute('data-glyph') || ''));
  return copy.textContent || '';
}
