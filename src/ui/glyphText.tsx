// 글 안의 바꿈표 이모지를 선 아이콘으로 (P53-3 - ui/Icon·ui/glyphs). 설명서 글·'📅 날짜' 같은 단추 글.
import type { ReactNode } from 'react';
import { GLYPH_RE } from './glyphs';
import { Glyph } from './Icon';

/** 글 안의 바꿈표 이모지를 아이콘으로 (나머지 글·이모지는 그대로) */
export function glyphText(text: string, className = ''): ReactNode {
  if (!text) return text;
  const parts = text.split(GLYPH_RE);
  if (parts.length === 1) return text;
  return parts.map((p, i) => (i % 2 === 1 ? <Glyph key={i} e={p} className={className} /> : p || null));
}
