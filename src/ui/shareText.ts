// 글 보내기 (V4 lib/shareText.ts) - 휴대폰·윈도우의 '공유하기' 창(카카오톡·문자·메일…)과 복사. 알림장이 쓴다.
//   공유 창이 없는 브라우저에서는 단추를 보이지 않는다(canShare). 공유가 막히면 복사로 대신한다.
import { showErrorToast, showToast } from '../app/toast';

/** 이 브라우저에 공유 창이 있나 */
export const canShare = (): boolean => typeof navigator !== 'undefined' && typeof navigator.share === 'function';

/** 복사하고 안내한다 */
export async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    showToast('📋 복사했습니다. 붙여 넣을 곳에서 Ctrl+V');
  } catch {
    showErrorToast('복사하지 못했습니다. 글을 직접 골라 복사해 주세요.');
  }
}

/** 공유 창으로 보낸다. 사용자가 창을 닫으면(AbortError) 그만, 그 밖의 까닭으로 막히면 fallback(대개 복사). 어떻게 끝났는지 돌려준다 */
export async function shareText(title: string, text: string, fallback: (text: string) => Promise<void> | void = copyText): Promise<'shared' | 'cancelled' | 'fallback'> {
  try {
    await navigator.share({ title, text });
    return 'shared';
  } catch (e) {
    if ((e as { name?: string } | null)?.name === 'AbortError') return 'cancelled';
    await fallback(text);
    return 'fallback';
  }
}
