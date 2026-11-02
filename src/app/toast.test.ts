import { describe, it, expect, vi, afterEach } from 'vitest';
import { failWithToast, showErrorToast, showErrorToastOnce, showToast, ShownError } from './toast';

const toasts = () => [...document.querySelectorAll('[data-toast]')].map((el) => el.textContent);

afterEach(() => {
  document.getElementById('sp5-toast-container')?.remove();
  vi.restoreAllMocks();
});

describe('안내(toast)', () => {
  it('실패 안내에는 ❌를 붙인다 (이미 표시가 있으면 그대로)', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    showErrorToast('저장하지 못했습니다');
    showErrorToast('⚠️ 연결이 없습니다');
    expect(toasts()).toEqual(['❌ 저장하지 못했습니다', '⚠️ 연결이 없습니다']);
  });

  it('failWithToast는 안내하고 ShownError로 던진다 - 부르는 쪽이 멈추게', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const cause = new Error('permission-denied');
    let thrown: unknown;
    try {
      failWithToast('저장하지 못했습니다', cause);
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(ShownError);
    expect((thrown as ShownError).original).toBe(cause);
    expect(toasts()).toEqual(['❌ 저장하지 못했습니다']);
  });

  it('showErrorToastOnce는 이미 안내한 실패(ShownError)를 다시 띄우지 않는다', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    showErrorToastOnce('또 띄우면 안 된다', new ShownError('이미 알림'));
    expect(toasts()).toEqual([]);
    showErrorToastOnce('처음 알림', new Error('x'));
    expect(toasts()).toEqual(['❌ 처음 알림']);
  });

  it('단추 안내: 시간이 지나 닫히면 expire, 단추를 누르면 run만 (쪽지 지우기 - P15-2)', () => {
    vi.useFakeTimers();
    try {
      const a = { run: vi.fn(), expire: vi.fn() };
      showToast('지웠습니다', 7000, 'info', { label: '되돌리기', ...a });
      vi.advanceTimersByTime(6999);
      expect(a.expire).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);
      expect(a.expire).toHaveBeenCalledTimes(1);
      expect(a.run).not.toHaveBeenCalled();

      const b = { run: vi.fn(), expire: vi.fn() };
      showToast('지웠습니다', 7000, 'info', { label: '되돌리기', ...b });
      document.querySelectorAll<HTMLButtonElement>('[data-toast-action]')[1].click();
      vi.advanceTimersByTime(10_000);
      expect(b.run).toHaveBeenCalledTimes(1);
      expect(b.expire).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
