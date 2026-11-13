// 메모 본문 - 제목으로 보인 첫 줄은 빼고 그린다 (P35). 체크 줄 번호는 원래 글의 번호.
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import type { ItemDoc } from '../events/eventOps';
import EntryBody from './EntryBody';

vi.mock('../../data/firebase', () => ({ auth: {}, db: {}, GOOGLE_SCOPES: [] }));

const note = (text: string) => ({ id: 'n1', kind: 'note', text, labelIds: [], order: 'a0' }) as unknown as ItemDoc;

describe('EntryBody 제목 줄 빼기 (P35)', () => {
  it('제목 줄 아래부터 그린다 - 앞 빈 줄도 뗀다', () => {
    const { container } = render(<EntryBody item={note('회의 준비\n\n자료 복사')} onToggleCheckLine={vi.fn()} skipLine={0} />);
    expect(container.querySelector('[data-entry-text]')?.textContent).toBe('자료 복사');
  });

  it('한 줄 메모는 본문 글이 없다 (그 줄은 제목)', () => {
    const { container } = render(<EntryBody item={note('회의 준비')} onToggleCheckLine={vi.fn()} skipLine={0} />);
    expect(container.querySelector('[data-entry-text]')).toBeNull();
  });

  it('제목 아래 체크 줄은 원래 줄 번호로 누른다', () => {
    const toggle = vi.fn(async () => {});
    const { container } = render(<EntryBody item={note('장보기\n☐ 우유\n☑ 빵')} onToggleCheckLine={toggle} skipLine={0} />);
    expect(container.querySelector('[data-entry-text]')?.textContent).not.toContain('장보기');
    fireEvent.click(container.querySelector('[data-check-line="1"]')!);
    expect(toggle).toHaveBeenCalledWith(1, '☐ 우유');
    expect(container.querySelector('[data-check-done="2"]')).not.toBeNull();
  });

  it('skipLine이 없으면 글 전체 (체크 줄로 시작하는 메모·예전 제목)', () => {
    const { container } = render(<EntryBody item={note('☐ 우유\n☐ 빵')} onToggleCheckLine={vi.fn()} />);
    expect(container.querySelectorAll('[data-check-line]')).toHaveLength(2);
  });
});
