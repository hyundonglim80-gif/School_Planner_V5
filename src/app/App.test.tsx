import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';
import { useSession } from '../data/session';

// 화면 구조만 본다 - Firebase에 붙지 않는다.
vi.mock('../data/firebase', () => ({ auth: {}, db: {}, googleProvider: {} }));

beforeEach(() => useSession.setState({ loading: true, user: null }));

describe('App 껍데기', () => {
  it('로그인 상태를 모르는 동안은 불러오는 중', () => {
    const { container } = render(<App />);
    expect(container.querySelector('[data-session="loading"]')).toBeInTheDocument();
    expect(container.querySelector('[data-build-id]')).toHaveTextContent('빌드 test');
  });

  it('로그인 전이면 로그인 화면', () => {
    useSession.setState({ loading: false, user: null });
    const { container } = render(<App />);
    expect(container.querySelector('[data-login-google]')).toBeInTheDocument();
  });

  it('로그인하면 SP5와 빌드 번호', () => {
    useSession.setState({
      loading: false,
      user: { uid: 'u1', email: 't@example.com', displayName: '', photoURL: '' },
    });
    const { container } = render(<App />);
    expect(screen.getByText('SP5')).toBeInTheDocument();
    expect(container.querySelector('[data-session="signed-in"]')).toHaveTextContent('t@example.com');
    expect(container.querySelector('[data-build-id]')).toHaveTextContent('빌드 test');
  });
});
