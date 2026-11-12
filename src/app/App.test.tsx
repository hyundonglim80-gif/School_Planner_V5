import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import App from './App';
import { setHeaderFolded } from './headerFold';
import { useSession } from '../data/session';

// 화면 구조만 본다 - Firebase에 붙지 않는다.
vi.mock('../data/firebase', () => ({ auth: {}, db: {}, googleProvider: {} }));
vi.mock('../data/settingsSync', () => ({ settingsPort: () => ({}), startSettingsSync: () => () => {} }));
vi.mock('../data/settingsReset', () => ({ watchMyReset: () => () => {}, watchInitialSettings: () => () => {}, saveMyReset: async () => {} }));
const useMirrorSync = vi.hoisted(() => vi.fn());
vi.mock('../data/mirror/sync', () => ({ useMirrorSync }));
// 구글 캘린더 큐는 Firestore를 바로 구독한다 (P8-1)
vi.mock('../data/gcalQueue', () => ({ watchGcalQueue: () => () => {} }));
vi.mock('../data/claudeRequests', () => ({ useClaudeRequestsWatch: () => {} }));
vi.mock('../data/mail', () => ({ useMailWatch: () => {} }));
vi.mock('../data/chat', () => ({ useChatWatch: () => {} }));
vi.mock('../data/spaces', () => ({ useMySpacesWatch: () => {} }));
vi.mock('../data/backupLog', () => ({ BACKUP_LOG_ID: 'backupLog', watchBackupLog: () => () => {} }));

// 하루 화면 조각을 먼저 싣는다 - 화면은 처음 볼 때 싣는데(app/screens), 전체 시험을 한꺼번에 돌려 바쁘면 그 변환·싣기가
// 아래 '받는 중' 기다림(10초)을 넘겨 가끔 틀렸다(P19-2·P19-3 11-03 - 이 시험만 10.2초, 나머지 2862 통과).
beforeAll(async () => {
  await import('../features/day/DayScreen');
}, 60_000);

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
    expect(container.querySelectorAll('[data-scope-tab]')).toHaveLength(7);
    // 첫 화면 = 하루 (사본이 비어 있으면 '받는 중')
    expect(await screen.findByText('일정을 받는 중…', {}, { timeout: 10_000 })).toBeInTheDocument();
    expect(container.querySelector('[data-build-id]')).toHaveTextContent('빌드 test');
    // 로그인한 동안 기기 사본을 맞춘다
    expect(useMirrorSync).toHaveBeenLastCalledWith('u1');
  }, 15_000); // 하루 화면은 나중에 불러온다 - 테스트를 한꺼번에 돌려 바쁠 때 5초를 넘긴다 (조각은 beforeAll에서 먼저 싣는다)

  it('머리줄 접기 (메모 요청 #142): ▲ = 첫 줄·둘째 줄을 감추고 본문만, ▼ = 다시 편다', async () => {
    useSession.setState({
      loading: false,
      user: { uid: 'u1', email: 't@example.com', displayName: '', photoURL: '' },
    });
    setHeaderFolded(false);
    const { container } = render(<App />);
    const header = container.querySelector('header')!;
    const rows = container.querySelector<HTMLElement>('[data-header-rows]')!;
    const main = container.querySelector('main')!;
    const handle = () => container.querySelector<HTMLElement>('[data-header-fold]')!;
    // 펴진 모습 - 손잡이는 머리줄 안(머리줄에 붙는다), 줄은 그대로
    expect(header.contains(handle())).toBe(true);
    expect(handle().dataset.headerFold).toBe('open');
    expect(header.hasAttribute('data-header-folded')).toBe(false);
    expect(rows.className).toBe('contents');
    expect(main.className).not.toContain('pt-5');

    fireEvent.click(handle());
    // 접힌 모습 - 머리줄은 높이 0으로 남고(높이를 재는 곳이 0을 받는다), 줄은 그린 채 감춘다
    expect(handle().dataset.headerFold).toBe('folded');
    expect(header.hasAttribute('data-header-folded')).toBe(true);
    expect(header.className).toContain('h-0');
    expect(header.className).toContain('sticky');
    expect(rows.className).toContain('invisible');
    expect(rows.className).toContain('overflow-hidden');
    // 줄을 지우지 않는다 - 화면 탭·둘째 줄 단추('단추 대신 누르기' 키가 찾는다)와 휴대폰 둥근 ＋(body)가 남는다
    expect(rows.querySelectorAll('[data-scope-tab]')).toHaveLength(7);
    expect(rows.querySelector('[data-date-label]')).not.toBeNull();
    expect(document.body.querySelector('[data-new-fab]')).not.toBeNull();
    // 손잡이에 보는 날짜(감춘 둘째 줄의 날짜 글자와 같다 - 주소가 정한 오늘) · 본문 위 여백
    const dateText = rows.querySelector('[data-date-label]')!.textContent;
    expect(dateText).toMatch(/^\d{4}년 \d{1,2}월 \d{1,2}일 \(.\)$/);
    expect(container.querySelector('[data-header-fold-date]')!.textContent).toBe(dateText);
    expect(main.className).toContain('pt-5');

    fireEvent.click(handle());
    expect(handle().dataset.headerFold).toBe('open');
    expect(header.hasAttribute('data-header-folded')).toBe(false);
    expect(rows.className).toBe('contents');
  }, 15_000);
});
