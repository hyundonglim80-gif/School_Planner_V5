import { describe, it, expect, vi, afterEach } from 'vitest';
import { failWithToast, showErrorToast, showErrorToastOnce, ShownError } from './toast';

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
});
