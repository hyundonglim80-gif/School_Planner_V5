// 사진 크게 보기 - 열기·넘기기(돌아 감)·(2/3)·ESC는 이 창만(뒤의 칸은 그대로)·원본 주소
import { beforeEach, describe, expect, it } from 'vitest';
import { act, fireEvent, render } from '@testing-library/react';
import { handleAppKeyDown } from '../app/keys';
import { useWindows } from '../app/windows';
import ImageViewer from './ImageViewer';
import { closeImageViewer, openImageViewer, useImageViewer } from './imageViewer';

const q = (s: string) => document.querySelector<HTMLElement>(s);
const IMGS = [
  { url: 'https://x/1.png', name: '하나' },
  { url: 'https://x/2.png', name: '둘' },
  { url: 'https://x/3.png', name: '셋' },
];

beforeEach(() => {
  act(() => closeImageViewer());
  useWindows.setState({ windows: [] });
});

describe('사진 크게 보기', () => {
  it('누른 그림부터, ‹ ›로 넘기고 끝에서 처음으로', () => {
    render(<ImageViewer />);
    expect(q('[data-image-viewer]')).toBeNull();
    act(() => openImageViewer(IMGS, 2));
    expect(q('[data-image-viewer-title]')?.textContent).toContain('셋 (3/3)');
    fireEvent.click(q('[data-image-viewer-next]')!);
    expect(q('[data-image-viewer-title]')?.textContent).toContain('하나 (1/3)');
    fireEvent.click(q('[data-image-viewer-prev]')!);
    expect(q('[data-image-viewer-img]')?.getAttribute('src')).toBe('https://x/3.png');
    expect(q('[data-image-viewer-original]')?.getAttribute('href')).toBe('https://x/3.png');
  });

  it('ESC는 사진 창만 닫는다 (뒤의 쓰는 칸은 그대로)', () => {
    render(<ImageViewer />);
    useWindows.setState({ windows: [{ key: 1, id: 'note', params: null, openedAt: 1, raisedAt: 1 }] });
    act(() => openImageViewer(IMGS.slice(0, 1)));
    expect(q('[data-image-viewer-next]')).toBeNull();
    act(() => {
      const e = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
      // 앱 키 처리(window 거품)도 걸어 두고 보낸다
      window.addEventListener('keydown', handleAppKeyDown);
      document.body.dispatchEvent(e);
      window.removeEventListener('keydown', handleAppKeyDown);
    });
    expect(useImageViewer.getState().images).toEqual([]);
    expect(useWindows.getState().windows).toHaveLength(1);
  });

  it('학생 사진은 3:4 틀', () => {
    render(<ImageViewer />);
    act(() => openImageViewer(IMGS.slice(0, 1), 0, { frame: 'portrait' }));
    expect(q('[data-viewer-frame="portrait"]')?.className).toContain('aspect-[3/4]');
  });
});
