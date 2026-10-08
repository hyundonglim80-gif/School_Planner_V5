import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { signInWithPopup, signInWithRedirect } from 'firebase/auth';
import LoginScreen from './LoginScreen';

vi.mock('../../data/firebase', () => ({
  auth: {},
  googleProvider: { setCustomParameters: () => {} },
}));
vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: { credentialFromResult: () => null },
  getRedirectResult: vi.fn(async () => null),
  signInWithPopup: vi.fn(),
  signInWithRedirect: vi.fn(),
  signOut: vi.fn(async () => {}),
}));

// 두 번 누르면 앞의 요청이 취소되며 auth/cancelled-popup-request가 나고 둘 다 실패한다(V4).
beforeEach(() => vi.clearAllMocks());

const never = () => new Promise<never>(() => {});

describe('로그인 - 두 번 눌러도 한 번만 시작한다', () => {
  it('진행 중에는 다시 누를 수 없다', async () => {
    vi.mocked(signInWithPopup).mockImplementation(never);
    const user = userEvent.setup();
    render(<LoginScreen />);

    const btn = screen.getByRole('button');
    await user.click(btn);

    expect(btn).toBeDisabled();
    expect(screen.getByText(/로그인 창을 여는 중/)).toBeInTheDocument();
    expect(signInWithPopup).toHaveBeenCalledTimes(1);
  });

  it('팝업이 막히면 리디렉션으로 넘어간다', async () => {
    vi.mocked(signInWithPopup).mockRejectedValue({ code: 'auth/popup-blocked' });
    vi.mocked(signInWithRedirect).mockResolvedValue(undefined as never);
    const user = userEvent.setup();
    render(<LoginScreen />);

    await user.click(screen.getByRole('button'));

    expect(signInWithRedirect).toHaveBeenCalledTimes(1);
  });

  it('사용자가 창을 닫은 것은 오류로 취급하지 않는다', async () => {
    vi.mocked(signInWithPopup).mockRejectedValue({ code: 'auth/popup-closed-by-user' });
    const user = userEvent.setup();
    render(<LoginScreen />);

    await user.click(screen.getByRole('button'));

    expect(signInWithRedirect).not.toHaveBeenCalled();
    expect(document.querySelector('[data-toast]')).toBeNull();
    // 다시 누를 수 있어야 한다
    expect(screen.getByRole('button')).not.toBeDisabled();
  });
});
