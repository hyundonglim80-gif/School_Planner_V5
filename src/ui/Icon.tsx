// 선 아이콘 (P53-3) - lucide 경로(ui/iconPaths)에 선 굵기·글자색(currentColor)을 입힌다. 크기는 글자 크기를 따른다(1.15em).
//   <Icon name="settings" />            - 이름으로
//   <Glyph e="📋" />                    - 이모지로(바꿈표 ui/glyphs - 없으면 이모지 그대로)
//   glyphText('📋 출석부')               - 글 안의 바꿈표 이모지를 모두 아이콘으로(설명서·단추 글 - ui/glyphText)
// 아이콘은 aria-hidden - 단추의 뜻은 곁의 글·title·aria-label이 말한다. data-glyph = 원래 이모지(점검이 찾는다).
//
// 창 안에서만 쓰는 아이콘 경로(ui/iconPathsLazy)는 나눠 받는다 (P54-1 - 첫 화면 JS, ui/lazyIcons): 그 전에 그려지면 같은 크기의 빈 칸
// → 받으면 다시 그린다(자리는 그대로라 글이 밀리지 않는다).
import { useEffect, useSyncExternalStore } from 'react';
import { ICON_PATHS, type IconName } from './iconPaths';
import { bareEmoji, glyphIcon } from './glyphs';
import { lazyIconPaths, preloadLazyIcons, subscribeLazyIcons } from './lazyIcons';

const BASE = 'inline-block shrink-0 align-[-0.18em]';

const CORE: Readonly<Record<string, string>> = ICON_PATHS;

export function Icon({ name, className = '', glyph }: { name: IconName; className?: string; glyph?: string }) {
  const lazy = useSyncExternalStore(subscribeLazyIcons, lazyIconPaths, lazyIconPaths);
  const html = CORE[name] ?? lazy?.[name];
  useEffect(() => {
    if (html === undefined) void preloadLazyIcons();
  }, [html]);
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
      dangerouslySetInnerHTML={{ __html: html ?? '' }}
    />
  );
}

/** 이모지 하나 - 바꿈표에 있으면 선 아이콘, 없으면 그 이모지 글자 */
export function Glyph({ e, className = '' }: { e: string; className?: string }) {
  const name = glyphIcon(e);
  return name ? <Icon name={name} className={className} glyph={bareEmoji(e)} /> : <span className={className}>{e}</span>;
}
