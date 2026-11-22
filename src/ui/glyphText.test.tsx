// 이모지 → 선 아이콘 바꿈표 (P53-3) - 모양 고르개·붙은 이모지(ZWJ)·표에 없는 이모지
import { render, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GLYPHS, glyphIcon } from './glyphs';
import { glyphText, leadGlyph, textWithGlyphs } from './glyphText';
import { ICON_PATHS } from './iconPaths';
import { LAZY_ICON_PATHS } from './iconPathsLazy';

const draw = (text: string) => render(<p>{glyphText(text)}</p>).container.querySelector('p')!;

describe('glyphText', () => {
  it('바꿈표 이모지는 아이콘, 글은 그대로', () => {
    const p = draw('📋 출석부');
    expect(p.querySelector('svg')?.getAttribute('data-icon')).toBe('clipboard-list');
    expect(p.querySelector('svg')?.getAttribute('data-glyph')).toBe('📋');
    expect(p.textContent).toBe(' 출석부');
  });

  it("모양 고르개(U+FE0F)가 붙어도 같은 아이콘 - '🗑️'·'⚙️'", () => {
    const p = draw('🗑️ 휴지통 · ⚙️ 설정');
    expect([...p.querySelectorAll('svg')].map((s) => s.getAttribute('data-icon'))).toEqual(['trash-2', 'settings']);
    expect(p.textContent).not.toContain('️');
    expect(glyphIcon('🗑️')).toBe('trash-2');
  });

  it('붙은 이모지(ZWJ)는 통째로 - 표에 있으면 그 아이콘, 없으면 앞 글자를 떼지 않는다', () => {
    expect(draw('🧑‍🎓 학생 기록').querySelector('svg')?.getAttribute('data-icon')).toBe('graduation-cap');
    const chef = draw('🧑‍🍳 요리');
    expect(chef.querySelector('svg')).toBeNull();
    expect(chef.textContent).toBe('🧑‍🍳 요리');
  });

  it('표에 없는 이모지·체크 줄 글자(☐ ☑)는 그대로', () => {
    const p = draw('🎉 ☐ 할 일 ☑ 끝');
    expect(p.querySelector('svg')).toBeNull();
    expect(p.textContent).toBe('🎉 ☐ 할 일 ☑ 끝');
  });

  it('바꿈표의 아이콘은 모두 경로 파일에 있다 (tools/gen-line-icons.mjs)', () => {
    for (const name of Object.values(GLYPHS)) expect({ ...ICON_PATHS, ...LAZY_ICON_PATHS }[name], name).toBeTruthy();
  });

  it('맨 앞 이모지만 (leadGlyph) - 뒤의 사용자 이름 속 이모지는 그대로 · textWithGlyphs는 아이콘을 이모지로 되읽는다 (P54-1)', () => {
    const p = render(<p>{leadGlyph('👥 📚독서 모임')}</p>).container.querySelector('p')!;
    expect(p.querySelectorAll('svg')).toHaveLength(1);
    expect(p.textContent).toBe(' 📚독서 모임');
    expect(textWithGlyphs(p)).toBe('👥 📚독서 모임');
    expect(render(<p>{leadGlyph('🎉 잔치')}</p>).container.querySelector('svg')).toBeNull();
  });

  it('창 안에서만 쓰는 아이콘(iconPathsLazy)은 받은 뒤 그린다 - 그 전에는 같은 크기의 빈 칸 (P54-1)', async () => {
    const p = draw('⭐ 즐겨찾기');
    const svg = p.querySelector('svg')!;
    expect(svg.getAttribute('data-icon')).toBe('star');
    await waitFor(() => expect(svg.querySelector('path')).not.toBeNull());
  });
});
