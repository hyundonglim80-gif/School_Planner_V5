import { describe, it, expect, beforeAll } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import AutoTextarea from './AutoTextarea';

// jsdom은 레이아웃을 계산하지 않아 scrollHeight가 언제나 0이다.
// 줄 수에 비례하는 값을 돌려주도록 대신 세워두고 높이 계산만 확인한다.
beforeAll(() => {
  Object.defineProperty(HTMLTextAreaElement.prototype, 'scrollHeight', {
    configurable: true,
    get(this: HTMLTextAreaElement) {
      const lines = (this.value || '').split('\n').length;
      return lines * 20;
    },
  });
});

function Controlled({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial);
  return (
    <AutoTextarea
      value={value}
      onChange={(e) => setValue(e.target.value)}
      placeholder="내용"
    />
  );
}

describe('AutoTextarea', () => {
  it('처음 열릴 때부터 내용 높이에 맞춘다', async () => {
    render(<Controlled initial={'한 줄\n두 줄\n세 줄'} />);
    const el = screen.getByPlaceholderText('내용') as HTMLTextAreaElement;

    await waitFor(() => expect(el.style.height).toBe('60px'));
  });

  it('내용이 늘어나면 높이도 늘어난다', async () => {
    render(<Controlled initial={'한 줄'} />);
    const el = screen.getByPlaceholderText('내용') as HTMLTextAreaElement;

    await waitFor(() => expect(el.style.height).toBe('20px'));

    // 값이 바뀌면(=입력) 높이도 다시 계산된다
    render(<Controlled initial={'한 줄\n두 줄\n세 줄\n네 줄'} />);
    const grown = screen.getAllByPlaceholderText('내용')[1] as HTMLTextAreaElement;
    await waitFor(() => expect(grown.style.height).toBe('80px'));
  });

  it('border-box 칸은 테두리까지 더한다 (마지막 줄이 테두리에 먹히지 않게)', async () => {
    render(<AutoTextarea value={'한 줄\n두 줄'} onChange={() => {}} placeholder="테두리" style={{ boxSizing: 'border-box', border: '1px solid black' }} />);
    const el = screen.getByPlaceholderText('테두리') as HTMLTextAreaElement;

    await waitFor(() => expect(el.style.height).toBe('42px'));
  });

  it('폭이 바뀌면 글이 그대로여도 다시 잰다 (좁아져 늘어난 줄이 잘리지 않게)', async () => {
    // 폭 300 미만이면 줄마다 두 줄로 접힌다고 친다
    let width = 400;
    const observers: ResizeObserverCallback[] = [];
    const saved = { ro: globalThis.ResizeObserver, sh: Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'scrollHeight') };
    globalThis.ResizeObserver = class {
      constructor(cb: ResizeObserverCallback) {
        observers.push(cb);
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
    Object.defineProperty(HTMLTextAreaElement.prototype, 'clientWidth', { configurable: true, get: () => width });
    Object.defineProperty(HTMLTextAreaElement.prototype, 'scrollHeight', {
      configurable: true,
      get(this: HTMLTextAreaElement) {
        return (this.value || '').split('\n').length * 20 * (width < 300 ? 2 : 1);
      },
    });
    try {
      render(<AutoTextarea value={'한 줄\n두 줄\n세 줄'} onChange={() => {}} placeholder="폭" />);
      const el = screen.getByPlaceholderText('폭') as HTMLTextAreaElement;
      await waitFor(() => expect(el.style.height).toBe('60px'));

      width = 250;
      observers.forEach((cb) => cb([], {} as ResizeObserver));
      await waitFor(() => expect(el.style.height).toBe('120px'));
    } finally {
      globalThis.ResizeObserver = saved.ro;
      delete (HTMLTextAreaElement.prototype as { clientWidth?: number }).clientWidth;
      if (saved.sh) Object.defineProperty(HTMLTextAreaElement.prototype, 'scrollHeight', saved.sh);
    }
  });

  it('재는 동안 부모 높이를 붙들고, 다 재면 되돌린다 (둘레 스크롤바가 사라져 넓은 폭으로 재지 않게)', async () => {
    const seen: string[] = [];
    const saved = {
      sh: Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'scrollHeight'),
      oh: Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight'),
    };
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, get: () => 300 });
    Object.defineProperty(HTMLTextAreaElement.prototype, 'scrollHeight', {
      configurable: true,
      get(this: HTMLTextAreaElement) {
        seen.push(this.parentElement?.style.minHeight ?? '');
        return 40;
      },
    });
    try {
      render(
        <div data-testid="parent" style={{ minHeight: '10px' }}>
          <AutoTextarea value={'한 줄\n두 줄'} onChange={() => {}} placeholder="부모" />
        </div>
      );
      const el = screen.getByPlaceholderText('부모') as HTMLTextAreaElement;
      await waitFor(() => expect(el.style.height).toBe('40px'));
      expect(seen.length).toBeGreaterThan(0);
      expect(seen.every((h) => h === '300px')).toBe(true);
      expect(screen.getByTestId('parent').style.minHeight).toBe('10px');
    } finally {
      if (saved.sh) Object.defineProperty(HTMLTextAreaElement.prototype, 'scrollHeight', saved.sh);
      if (saved.oh) Object.defineProperty(HTMLElement.prototype, 'offsetHeight', saved.oh);
      else delete (HTMLElement.prototype as { offsetHeight?: number }).offsetHeight;
    }
  });

  it('스크롤바가 생기지 않도록 overflow를 감춘다', () => {
    render(<Controlled initial="한 줄" />);
    const el = screen.getByPlaceholderText('내용');

    expect(el.className).toContain('overflow-hidden');
    expect(el.className).toContain('resize-none');
  });
});
