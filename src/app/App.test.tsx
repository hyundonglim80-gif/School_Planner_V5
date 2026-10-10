import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';
import { useSession } from '../data/session';

// 화면 구조만 본다 - Firebase에 붙지 않는다.
vi.mock('../data/firebase', () => ({ auth: {}, db: {}, googleProvider: {} }));
vi.mock('../data/settingsSync', () => ({ settingsPort: () => ({}), startSettingsSync: () => () => {} }));
const useMirrorSync = vi.hoisted(() => vi.fn());
vi.mock('../data/mirror/sync', () => ({ useMirrorSync }));
// 구글 캘린더 큐는 Firestore를 바로 구독한다 (P8-1)
vi.mock('../data/gcalQueue', () => ({ watchGcalQueue: () => () => {} }));
vi.mock('../data/backupLog', () => ({ BACKUP_LOG_ID: 'backupLog', watchBackupLog: () => () => {} }));

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

  it('로그인하면 껍데기(SP5·화면 탭)와 빌드 번호', async () => {
    useSession.setState({
      loading: false,
      user: { uid: 'u1', email: 't@example.com', displayName: '', photoURL: '' },
    });
    const { container } = render(<App />);
    expect(screen.getByText('SP5')).toBeInTheDocument();
    expect(container.querySelector('[data-session="signed-in"]')).toHaveAttribute('data-user', 't@example.com');
    expect(container.querySelectorAll('[data-scope-tab]')).toHaveLength(6);
    // 첫 화면 = 하루 (사본이 비어 있으면 '받는 중')
    expect(await screen.findByText('일정을 받는 중…')).toBeInTheDocument();
    expect(container.querySelector('[data-build-id]')).toHaveTextContent('빌드 test');
    // 로그인한 동안 기기 사본을 맞춘다
    expect(useMirrorSync).toHaveBeenLastCalledWith('u1');
  });
});
