// 선 아이콘 (P53-3) - lucide 경로(ui/iconPaths)에 선 굵기·글자색(currentColor)을 입힌다. 크기는 글자 크기를 따른다(1.15em).
//   <Icon name="settings" />            - 이름으로
//   <Glyph e="📋" />                    - 이모지로(바꿈표 ui/glyphs - 없으면 이모지 그대로)
//   glyphText('📋 출석부')               - 글 안의 바꿈표 이모지를 모두 아이콘으로(설명서·단추 글 - ui/glyphText)
// 아이콘은 aria-hidden - 단추의 뜻은 곁의 글·title·aria-label이 말한다. data-glyph = 원래 이모지(점검이 찾는다).
import { ICON_PATHS, type IconName } from './iconPaths';
import { bareEmoji, glyphIcon } from './glyphs';

const BASE = 'inline-block shrink-0 align-[-0.18em]';

export function Icon({ name, className = '', glyph }: { name: IconName; className?: string; glyph?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      data-icon={name}
      data-glyph={glyph}
      className={`${BASE} ${/\b(w|size)-/.test(className) ? '' : 'w-[1.15em] h-[1.15em]'} ${className}`}
      dangerouslySetInnerHTML={{ __html: ICON_PATHS[name] }}
    />
  );
}

/** 이모지 하나 - 바꿈표에 있으면 선 아이콘, 없으면 그 이모지 글자 */
export function Glyph({ e, className = '' }: { e: string; className?: string }) {
  const name = glyphIcon(e);
  return name ? <Icon name={name} className={className} glyph={bareEmoji(e)} /> : <span className={className}>{e}</span>;
}
