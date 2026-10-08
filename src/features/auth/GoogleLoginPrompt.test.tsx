// '구글 로그인이 필요합니다' 창 - 묻는 동안만 열린다, 닫기 = 실패로 답, 구글 로그인 = 받은 토큰으로 답, 못 받으면 창에 까닭
import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { askGoogleLogin } from '../../data/google/prompt';
import GoogleLoginPrompt from './GoogleLoginPrompt';

vi.mock('../../data/firebase', () => ({ auth: {}, db: {}, GOOGLE_SCOPES: [] }));
const renew = vi.hoisted(() => ({ next: (): Promise<string | null> => Promise.resolve('tok') }));
vi.mock('../../data/google/token', () => ({ renewGoogleToken: () => renew.next() }));

const q = (s: string) => document.querySelector<HTMLElement>(s);

describe('구글 로그인이 필요합니다', () => {
  it('묻는 동안만 열리고 닫기 = null', async () => {
    const { unmount } = render(<GoogleLoginPrompt />);
    expect(q('[data-google-login-prompt]')).toBeNull();
    let answer: Promise<string | null> = Promise.resolve('x');
    act(() => {
      answer = askGoogleLogin('구글 캘린더에 올리려면');
    });
    expect(screen.getByText('구글 캘린더에 올리려면')).toBeTruthy();
    fireEvent.click(q('[data-google-login-close]')!);
    expect(await answer).toBeNull();
    expect(q('[data-google-login-prompt]')).toBeNull();
    unmount();
  });

  it('구글 로그인 = 받은 토큰으로 답, 실패하면 창에 까닭을 남긴다', async () => {
    const { unmount } = render(<GoogleLoginPrompt />);
    let answer: Promise<string | null> = Promise.resolve(null);
    act(() => {
      answer = askGoogleLogin();
    });
    expect(q('[data-google-login-prompt]')?.textContent).toContain('구글 드라이브');
    renew.next = () => Promise.reject(new Error('팝업이 차단되었습니다.'));
    await act(async () => fireEvent.click(q('[data-google-login]')!));
    expect(q('[data-google-login-error]')?.textContent).toBe('팝업이 차단되었습니다.');
    renew.next = () => Promise.resolve('tok');
    await act(async () => fireEvent.click(q('[data-google-login]')!));
    expect(await answer).toBe('tok');
    expect(q('[data-google-login-prompt]')).toBeNull();
    unmount();
  });
});
