import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent, act, cleanup } from '@testing-library/react';
import { resetHistoryForTest } from '../../app/history';
import { setPopupStyle } from '../../app/layoutPrefs';
import { useSession } from '../../data/session';
import { useMySpaces, type GroupSpace } from '../../data/spaceChoice';
import GroupsWindow from './GroupsWindow';

// 진짜 Firebase 앱을 띄우지 않는다(PLAN 5장 'P3-1 테스트와 Firebase')
vi.mock('../../data/firebase', () => ({ auth: {}, db: {}, googleProvider: {} }));

// 그룹 자료 층은 흉내만 - 창이 무엇을 부르는지만 본다
const spaces = vi.hoisted(() => ({
  readPeople: vi.fn(() => Promise.resolve({ u1: { name: '김주인', photoURL: '' }, u2: { name: '이구성', photoURL: '' } })),
  writeMyName: vi.fn(() => Promise.resolve()),
  rotateInvite: vi.fn(() => Promise.resolve('NEW234')),
  closeInvite: vi.fn(() => Promise.resolve()),
  removeMember: vi.fn(() => Promise.resolve()),
  openInvite: vi.fn(() => Promise.resolve('OPN234')),
  createGroup: vi.fn(),
  joinGroup: vi.fn(),
  leaveGroup: vi.fn(),
  deleteGroup: vi.fn(),
  importedGroupSid: (id: string) => `g_${id}`,
}));
vi.mock('../../data/spaces', () => spaces);
// V4 그룹 가져오기 칸은 V4 자리를 읽는다 - 이 시험과 상관없다
vi.mock('./V4GroupsSection', () => ({ default: () => null }));

const q = (s: string) => document.querySelector<HTMLElement>(s);
const qa = (s: string) => [...document.querySelectorAll<HTMLElement>(s)];

const group = (over: Partial<GroupSpace> = {}): GroupSpace => ({ id: 'g_t1', name: '4학년 협의회', ownerId: 'u1', members: { u1: 'owner', u2: 'member' }, inviteCode: 'ABC234', ...over });
const signIn = (uid: string) => useSession.setState({ loading: false, user: { uid, email: `${uid}@example.com`, displayName: uid, photoURL: '' } });

async function openWith(g: GroupSpace) {
  useMySpaces.setState({ groups: [g], loaded: true });
  render(<GroupsWindow params={undefined} close={vi.fn()} raise={0} setParams={vi.fn()} />);
  // 구성원 이름(readPeople)을 받을 때까지
  await act(async () => {});
}

beforeEach(() => {
  resetHistoryForTest();
  setPopupStyle('center');
  vi.clearAllMocks();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('공유 그룹 창 - 그룹장 도구 (P14-1)', () => {
  it('그룹장에게만 🔄 코드 바꾸기·🚫 초대 닫기·구성원 ×, 나에게는 × 없음', async () => {
    signIn('u1');
    await openWith(group());
    expect(q('[data-group-rotate-code]')).not.toBeNull();
    expect(q('[data-group-close-code]')).not.toBeNull();
    expect(qa('[data-group-remove-member]').map((b) => b.dataset.groupRemoveMember)).toEqual(['u2']);
    expect(q('[data-group-person="u2"]')?.textContent).toContain('이구성');
  });

  it('구성원에게는 그룹장 도구가 없다 (나가기만)', async () => {
    signIn('u2');
    await openWith(group());
    expect(q('[data-group-rotate-code]')).toBeNull();
    expect(q('[data-group-close-code]')).toBeNull();
    expect(qa('[data-group-remove-member]')).toHaveLength(0);
    expect(q('[data-group-leave]')).not.toBeNull();
    // 코드는 구성원도 본다(그래서 새면 그룹장이 🔄)
    expect(q('[data-group-code-text]')?.textContent).toBe('ABC234');
  });

  it('× = 묻고 내보낸다 (코드도 바뀐다고 알림), 아니오면 그대로', async () => {
    signIn('u1');
    await openWith(group());
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    fireEvent.click(q('[data-group-remove-member="u2"]')!);
    expect(confirm.mock.calls[0][0]).toBe('이구성 선생님을 그룹에서 내보낼까요? 초대 코드도 새로 바뀝니다.');
    expect(spaces.removeMember).not.toHaveBeenCalled();
    confirm.mockReturnValue(true);
    await act(async () => {
      fireEvent.click(q('[data-group-remove-member="u2"]')!);
    });
    expect(spaces.removeMember).toHaveBeenCalledWith(expect.objectContaining({ uid: 'u1' }), expect.objectContaining({ id: 'g_t1' }), 'u2');
  });

  it('🔄 코드 바꾸기·🚫 초대 닫기는 묻고 부른다', async () => {
    signIn('u1');
    await openWith(group());
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    await act(async () => {
      fireEvent.click(q('[data-group-rotate-code]')!);
    });
    expect(confirm.mock.calls[0][0]).toContain('옛 코드로는 더 들어오지 못합니다');
    expect(spaces.rotateInvite).toHaveBeenCalledTimes(1);
    await act(async () => {
      fireEvent.click(q('[data-group-close-code]')!);
    });
    expect(spaces.closeInvite).toHaveBeenCalledTimes(1);
  });

  it('초대가 닫힌 그룹: 바꾸기·닫기 대신 🔑 만들기, 내보내도 코드는 닫힌 채 (알림에 코드 말 없음)', async () => {
    signIn('u1');
    await openWith(group({ inviteCode: undefined }));
    expect(q('[data-group-rotate-code]')).toBeNull();
    expect(q('[data-group-close-code]')).toBeNull();
    expect(q('[data-group-make-code]')).not.toBeNull();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    fireEvent.click(q('[data-group-remove-member="u2"]')!);
    expect(confirm.mock.calls[0][0]).toBe('이구성 선생님을 그룹에서 내보낼까요?');
  });
});
