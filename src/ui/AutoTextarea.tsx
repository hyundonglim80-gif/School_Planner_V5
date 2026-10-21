// 내용에 맞춰 세로 높이가 늘어나는 입력칸 (V4 components/AutoTextarea.tsx). 앱의 모든 여러 줄 입력은 이걸 쓴다.
//
// 최소 높이는 CSS(min-h-*)에 맡긴다. 내용이 적을 때 scrollHeight는 min-height가
// 적용된 박스 높이로 나오므로, 따로 최소값을 계산할 필요가 없다.
//
// 높이를 다시 잴 때 둘레 스크롤을 지킨다(P10-5 사용자 의견 5f): 'auto'로 줄이는 순간 칸이 짧아져 브라우저가 둘레(쓰는 칸·오른쪽 줄)의
// 스크롤을 위로 당겨 놓았다 - 긴 메모 아래쪽에 쓰면 쓰는 곳이 화면 밖으로 밀려났다. 재기 전 자리를 적어 두었다 되돌리고,
// 커서가 든 칸이면 커서 줄이 둘레 스크롤 상자 안에 보이게 한다(칸 자체는 overflow-hidden이라 브라우저가 둘레를 움직여 주지 않는다).
//
// 폭이 바뀌어도 다시 잰다(10-21 사용자 보고 - 긴 메모의 마지막 줄이 가려짐): 오른쪽 칸 폭 끌기·창 크기·글자 크기로 폭이 바뀌면
// 줄바꿈이 늘어나는데, 글이 그대로라 높이를 다시 재지 않아 늘어난 줄만큼 아래가 잘렸다. 높이는 테두리까지 더한다(border-box).
import { useCallback, useEffect, useRef, type Ref, type RefObject, type TextareaHTMLAttributes } from 'react';

/** 스크롤해 둔 조상들과 그 자리 (창 스크롤 포함) */
function scrollSpots(el: HTMLElement): [Element, number][] {
  const out: [Element, number][] = [];
  for (let n = el.parentElement; n; n = n.parentElement) if (n.scrollTop > 0) out.push([n, n.scrollTop]);
  const doc = document.scrollingElement;
  if (doc && doc.scrollTop > 0 && !out.some(([n]) => n === doc)) out.push([doc, doc.scrollTop]);
  return out;
}

/** 세로로 스크롤하는 가장 가까운 조상 */
function scrollBoxOf(el: HTMLElement): HTMLElement | null {
  for (let n = el.parentElement; n; n = n.parentElement) {
    if (n.scrollHeight > n.clientHeight + 1 && /(auto|scroll|overlay)/.test(getComputedStyle(n).overflowY)) return n;
  }
  return null;
}

const MIRRORED = [
  'boxSizing', 'width', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
  'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth', 'borderStyle',
  'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'fontVariant', 'letterSpacing', 'lineHeight',
  'textTransform', 'textIndent', 'wordSpacing', 'tabSize', 'wordBreak',
] as const;

/** 칸 위에서 커서 줄 윗변까지 (같은 글꼴·폭의 보이지 않는 상자에 커서 앞 글을 넣어 잰다) */
function caretTop(el: HTMLTextAreaElement): number {
  const cs = getComputedStyle(el);
  const mirror = document.createElement('div');
  for (const k of MIRRORED) mirror.style[k] = cs[k];
  Object.assign(mirror.style, { position: 'absolute', visibility: 'hidden', top: '0', left: '-9999px', whiteSpace: 'pre-wrap', overflowWrap: 'break-word' });
  const pos = el.selectionEnd ?? el.value.length;
  mirror.textContent = el.value.slice(0, pos);
  const mark = document.createElement('span');
  mark.textContent = el.value.slice(pos, pos + 1) || '.';
  mirror.appendChild(mark);
  document.body.appendChild(mirror);
  const top = mark.offsetTop;
  mirror.remove();
  return top;
}

/** 커서가 든 칸이면 커서 줄이 둘레 스크롤 상자 안에 보이게 (위아래 여유 12px) */
function revealCaret(el: HTMLTextAreaElement) {
  if (document.activeElement !== el) return;
  const box = scrollBoxOf(el);
  if (!box) return;
  const line = parseFloat(getComputedStyle(el).lineHeight) || 20;
  const top = el.getBoundingClientRect().top + caretTop(el);
  const view = box.getBoundingClientRect();
  const gap = 12;
  if (top + line + gap > view.bottom) box.scrollTop += top + line + gap - view.bottom;
  else if (top - gap < view.top) box.scrollTop -= view.top - (top - gap);
}

/** border-box 칸의 위아래 테두리 - scrollHeight(글 + 여백)에 더해야 마지막 줄이 테두리에 먹히지 않는다 */
function borderY(el: HTMLElement): number {
  const cs = getComputedStyle(el);
  if (cs.boxSizing !== 'border-box') return 0;
  return (parseFloat(cs.borderTopWidth) || 0) + (parseFloat(cs.borderBottomWidth) || 0);
}

type AutoTextareaProps =TextareaHTMLAttributes<HTMLTextAreaElement> & {
  /**
   * 바깥에서 이 입력칸을 직접 집어야 할 때 쓴다 (초점을 되돌려 주는 자리 등).
   * 높이를 재려면 안에서도 같은 칸을 붙들고 있어야 하므로 둘 다에 매어 준다.
   */
  ref?: Ref<HTMLTextAreaElement>;
};

export default function AutoTextarea({
  className,
  value,
  onInput,
  ref: outerRef,
  ...rest
}: AutoTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const attach = useCallback(
    (el: HTMLTextAreaElement | null) => {
      ref.current = el;
      if (typeof outerRef === 'function') outerRef(el);
      else if (outerRef) (outerRef as RefObject<HTMLTextAreaElement | null>).current = el;
    },
    [outerRef]
  );

  /** reveal: 커서 줄을 보이게 둘레를 움직인다 (쓰는 중일 때만 - 폭이 바뀐 것만으로는 움직이지 않는다) */
  const resize = useCallback((reveal = true) => {
    const el = ref.current;
    if (!el) return;
    const spots = scrollSpots(el);
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight + borderY(el)}px`;
    for (const [n, top] of spots) n.scrollTop = top;
    el.scrollTop = 0;
    if (reveal) revealCaret(el);
  }, []);

  // 팝업 안에서는 마운트 직후 레이아웃이 아직 잡히지 않아 scrollHeight가 0으로
  // 나온다. 한 프레임 뒤에 재어야 처음부터 내용에 맞는 높이로 열린다.
  useEffect(() => {
    const frame = requestAnimationFrame(() => resize());
    return () => cancelAnimationFrame(frame);
  }, [value, resize]);

  // 폭이 바뀌면 줄바꿈이 달라진다 - 글이 그대로여도 다시 잰다. 높이만 바뀐 것(여기서 맞춘 것)은 넘긴다.
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    let width = el.clientWidth;
    let frame = 0;
    const ro = new ResizeObserver(() => {
      if (el.clientWidth === width) return;
      width = el.clientWidth;
      // 관찰 안에서 높이를 바꾸면 'ResizeObserver loop' 오류가 나므로 다음 프레임에
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => resize(false));
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [resize]);

  return (
    <textarea
      ref={attach}
      value={value}
      // onChange만으로는 한글 조합 중(IME) 높이가 늦게 따라온다.
      onInput={(e) => {
        resize();
        onInput?.(e);
      }}
      className={`resize-none overflow-hidden ${className ?? ''}`}
      {...rest}
    />
  );
}
