// 화면 아래 잠깐 뜨는 안내(V4 utils/toast.ts에서 옮김).
//
// 저장 실패처럼 사용자가 꼭 알아야 하는 것은 showErrorToast / failWithToast로 띄운다.
// V4에서 쓰기 실패가 console.error로만 남아 사용자는 그냥 "자료가 없네"로 오인했다.

/** 안내 옆에 붙는 단추 (되돌리기 등). 누르면 안내를 닫고 run을 부른다. */
export interface ToastAction {
  label: string;
  run: () => void;
}

const CONTAINER_ID = 'sp5-toast-container';

export function showToast(message: string, duration = 2500, type: 'info' | 'error' = 'info', action?: ToastAction) {
  let container = document.getElementById(CONTAINER_ID);
  if (!container) {
    container = document.createElement('div');
    container.id = CONTAINER_ID;
    // 좁은 화면에서는 아래 탭바 위로 올린다 (bottom-24 -> sm 이상에서 bottom-8)
    container.className =
      'fixed bottom-24 sm:bottom-8 left-1/2 -translate-x-1/2 z-[999999] pointer-events-none flex flex-col items-center gap-2 transition-all duration-300 px-4 max-w-full';
    document.body.appendChild(container);
  }

  const toastEl = document.createElement('div');
  const tone = type === 'error' ? 'bg-red-600/95 border-red-400/50' : 'bg-slate-900/90 border-slate-700/50';
  toastEl.className = `pointer-events-auto flex items-center gap-2 px-5 py-2.5 ${tone} text-white text-xs sm:text-sm font-semibold rounded-xl shadow-xl backdrop-blur-sm border transform transition-all duration-300 translate-y-2 opacity-0`;
  toastEl.setAttribute('role', 'status');
  toastEl.dataset.toast = type;

  // 여러 줄 안내도 줄을 바꿔 보이게 (innerText 대신 - jsdom은 innerText를 모른다)
  const textEl = document.createElement('span');
  textEl.className = 'whitespace-pre-line';
  textEl.textContent = message;
  toastEl.appendChild(textEl);

  container.appendChild(toastEl);

  requestAnimationFrame(() => {
    toastEl.classList.remove('translate-y-2', 'opacity-0');
    toastEl.classList.add('translate-y-0', 'opacity-100');
  });

  let closed = false;
  const dismiss = () => {
    if (closed) return;
    closed = true;
    toastEl.classList.remove('translate-y-0', 'opacity-100');
    toastEl.classList.add('translate-y-2', 'opacity-0');
    setTimeout(() => toastEl.remove(), 300);
  };
  let timer = setTimeout(dismiss, duration);

  if (action) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = action.label;
    btn.dataset.toastAction = action.label;
    btn.className =
      'shrink-0 ml-1 px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/30 text-amber-200 hover:text-white font-bold cursor-pointer transition-colors';
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (closed) return;
      clearTimeout(timer);
      dismiss();
      action.run();
    });
    toastEl.appendChild(btn);
    // 단추를 누르려고 마우스를 올린 사이에 사라지지 않게, 올려 둔 동안은 기다린다
    toastEl.addEventListener('mouseenter', () => clearTimeout(timer));
    toastEl.addEventListener('mouseleave', () => {
      clearTimeout(timer);
      if (!closed) timer = setTimeout(dismiss, 2000);
    });
  }
}

/** 사용자가 꼭 알아야 하는 실패를 띄운다. ❌ 표시를 붙여 빛깔을 못 가려도 성공과 갈리게 한다(V4). */
export function showErrorToast(message: string, error?: unknown) {
  if (error) console.error(message, error);
  // ⚠️는 두 글자(⚠ + 모양 고르기 U+FE0F)라 [ ] 안에 넣지 않고 | 로 고른다.
  const marked = /^(✅|❌|⚠️)/u.test(message.trim()) ? message : `❌ ${message}`;
  showToast(marked, 4000, 'error');
}

/**
 * 이미 사용자에게 알린 실패. 부르는 쪽은 '실패했다'만 알면 되고 안내를 또 띄우지 않는다.
 *
 * ⚠️ V4에서 저장 함수가 실패를 안내만 하고 삼키자, 쓰는 칸은 성공으로 알고 '✅ 저장했습니다'를 띄운 뒤
 *    묻지도 않고 닫아 적던 글이 사라졌다. 안내한 뒤 이것을 던져 부르는 쪽이 멈추게 한다.
 */
export class ShownError extends Error {
  readonly shown = true;
  readonly original?: unknown;
  constructor(message: string, original?: unknown) {
    super(message);
    this.name = 'ShownError';
    this.original = original;
  }
}

/** 실패를 안내하고 ShownError로 던진다 */
export function failWithToast(message: string, error?: unknown): never {
  showErrorToast(message, error);
  throw new ShownError(message, error);
}

/** 아직 안내하지 않은 실패만 안내한다 (ShownError는 이미 안내했다) */
export function showErrorToastOnce(message: string, error?: unknown) {
  if (error instanceof ShownError) return;
  showErrorToast(message, error);
}

const AFTER_RELOAD_KEY = 'sp5_toast_after_reload';

/**
 * 화면을 새로 그린 다음에 알린다. 백업 복원처럼 안내 바로 뒤에 새로고침하면 안내가 쓸려 사라져
 * 됐는지 안 됐는지 알 수 없었다(V4). 새로고침을 건너온 뒤에 띄우도록 맡겨 둔다.
 */
export function showToastAfterReload(message: string) {
  try {
    sessionStorage.setItem(AFTER_RELOAD_KEY, message);
  } catch {
    showToast(message);
  }
}

/** 앱이 처음 뜰 때 한 번 불러, 맡겨 둔 안내가 있으면 띄운다 */
export function flushPendingToast() {
  try {
    const msg = sessionStorage.getItem(AFTER_RELOAD_KEY);
    if (!msg) return;
    sessionStorage.removeItem(AFTER_RELOAD_KEY);
    showToast(msg, 4000);
  } catch {
    /* 못 읽으면 넘어간다 */
  }
}
