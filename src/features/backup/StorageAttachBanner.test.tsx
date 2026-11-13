// '📎 예전 저장소에 첨부 n개' 띠 (P32-1) - PC·개인 공간·다 받은 뒤에만, '나중에' = 이 기기 7일
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { useMirror } from '../../data/mirror/store';
import { useSession } from '../../data/session';
import { useMySpaces, useSpaceChoice } from '../../data/spaceChoice';
import StorageAttachBanner from './StorageAttachBanner';
import { runCollect } from './collectRun';

vi.mock('../../data/firebase', () => ({ auth: {}, db: {} }));
const device = vi.hoisted(() => ({ kind: 'pc' as 'pc' | 'mobile' }));
vi.mock('../../app/deviceKind', () => ({ detectDeviceKind: () => device.kind }));
vi.mock('./collectRun', () => ({ runCollect: vi.fn(async () => '첨부 1개를 드라이브로 옮겼습니다') }));

const S = 'https://firebasestorage.googleapis.com/v0/b/x.appspot.com/o/users%2Fu%2F1712345678901_a.png?alt=media&token=t';
const banner = () => document.querySelector('[data-storage-attach-banner]');

function plant(status: 'live' | 'loading', items: Record<string, object>, days: Record<string, object> = {}, sid = 'u_me') {
  useMirror.setState({
    colls: {
      [`${sid}/items`]: { docs: items, status },
      [`${sid}/lessonDays`]: { docs: days, status },
    },
  } as never);
}

beforeEach(() => {
  device.kind = 'pc';
  localStorage.clear();
  vi.mocked(runCollect).mockClear();
  useSession.setState({ loading: false, user: { uid: 'me', email: '', displayName: '', photoURL: '' } });
  useSpaceChoice.setState({ uid: 'me', sid: null });
  useMySpaces.setState({ groups: [], loaded: true });
});
afterEach(() => {
  cleanup();
  useMirror.setState({ colls: {}, persisted: null });
});

describe('예전 저장소 첨부 띠', () => {
  it('다 받은 뒤 남은 수를 보인다 (메모·수업 칸, 지운 것은 빼고)', () => {
    plant('live', { a: { attachments: [{ url: S }] }, b: { deletedAt: 1, attachments: [{ url: S }] } }, { '2030-01-07': { periods: { 1: { attachments: [{ url: S }] } } } });
    render(<StorageAttachBanner />);
    expect(banner()?.getAttribute('data-storage-attach-banner')).toBe('2');
    expect(banner()?.textContent).toContain('첨부 2개');
  });

  it('받는 중이거나 남은 것이 없으면 띠가 없다', () => {
    plant('loading', { a: { attachments: [{ url: S }] } });
    const { rerender } = render(<StorageAttachBanner />);
    expect(banner()).toBeNull();
    plant('live', { a: { attachments: [{ url: 'https://drive.google.com/thumbnail?id=1' }] } });
    rerender(<StorageAttachBanner />);
    expect(banner()).toBeNull();
  });

  it('휴대폰·그룹 공간을 볼 때는 띄우지 않는다', () => {
    plant('live', { a: { attachments: [{ url: S }] } });
    device.kind = 'mobile';
    const { rerender } = render(<StorageAttachBanner />);
    expect(banner()).toBeNull();
    device.kind = 'pc';
    act(() => {
      useMySpaces.setState({ groups: [{ id: 'g_x' } as never], loaded: true });
      useSpaceChoice.setState({ uid: 'me', sid: 'g_x' });
    });
    rerender(<StorageAttachBanner />);
    expect(banner()).toBeNull();
  });

  it('모으기 = 개인 공간에서 곧바로 · 다 옮겨 0개가 되면 띠가 사라진다', async () => {
    plant('live', { a: { attachments: [{ url: S }] } });
    render(<StorageAttachBanner />);
    fireEvent.click(document.querySelector('[data-storage-attach-run]')!);
    await waitFor(() => expect(runCollect).toHaveBeenCalledWith('u_me', expect.any(Function)));
    act(() => plant('live', { a: { attachments: [{ url: 'https://drive.google.com/thumbnail?id=1', driveId: '1' }] } }));
    await waitFor(() => expect(banner()).toBeNull());
  });

  it("'나중에' = 이 기기에서 7일 동안 띄우지 않는다", () => {
    plant('live', { a: { attachments: [{ url: S }] } });
    const { unmount } = render(<StorageAttachBanner />);
    fireEvent.click(document.querySelector('[data-storage-attach-later]')!);
    expect(banner()).toBeNull();
    const until = Number(localStorage.getItem('sp5-storage-attach-snooze'));
    expect(until - Date.now()).toBeGreaterThan(6.9 * 86400000);
    unmount();
    render(<StorageAttachBanner />);
    expect(banner()).toBeNull();
  });
});
