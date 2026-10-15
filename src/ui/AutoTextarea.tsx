// 내용에 맞춰 세로 높이가 늘어나는 입력칸 (V4 components/AutoTextarea.tsx). 앱의 모든 여러 줄 입력은 이걸 쓴다.
//
// 최소 높이는 CSS(min-h-*)에 맡긴다. 내용이 적을 때 scrollHeight는 min-height가
// 적용된 박스 높이로 나오므로, 따로 최소값을 계산할 필요가 없다.
//
// 높이를 다시 잴 때 둘레 스크롤을 지킨다(P10-5 사용자 의견 5f): 'auto'로 줄이는 순간 칸이 짧아져 브라우저가 둘레(쓰는 칸·오른쪽 줄)의
// 스크롤을 위로 당겨 놓았다 - 긴 메모 아래쪽에 쓰면 쓰는 곳이 화면 밖으로 밀려났다. 재기 전 자리를 적어 두었다 되돌리고,
// 커서가 든 칸이면 커서 줄이 둘레 스크롤 상자 안에 보이게 한다(칸 자체는 overflow-hidden이라 브라우저가 둘레를 움직여 주지 않는다).
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

type AutoTextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
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

  const resize = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const spots = scrollSpots(el);
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
    for (const [n, top] of spots) n.scrollTop = top;
    el.scrollTop = 0;
    revealCaret(el);
  }, []);

  // 팝업 안에서는 마운트 직후 레이아웃이 아직 잡히지 않아 scrollHeight가 0으로
  // 나온다. 한 프레임 뒤에 재어야 처음부터 내용에 맞는 높이로 열린다.
  useEffect(() => {
    const frame = requestAnimationFrame(resize);
    return () => cancelAnimationFrame(frame);
  }, [value, resize]);

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
