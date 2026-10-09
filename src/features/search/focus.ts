// 찾은 글 짚기 (V4 lib/searchFocus.ts). 검색 결과를 누르면 그 화면으로 간 뒤, 그 카드가 나타나기를 기다려 가운데로 굴리고 잠깐 노랗게 짚는다.
//   - 카드는 이미 붙어 있는 표식으로 찾는다: 일정 `[data-event-card]` · 메모·기록 `[data-entry-card]` (본문이 먼저 - 창 안의 같은 카드보다 앞이다) ·
//     수업 `[data-lesson-id="lesson:날짜:교시"]`(하루 수업 칸 - P6-1).
//   - 접힌 칸은 펼친다: 그 칸이 useFocusReveal로 듣는다(하루 일정·기록 칸, 메모 화면의 진행/완료). 거르개(라벨로 보기)는 검색 창이 옮기기 전에 푼다.
//   - 자료가 늦게 올 수 있어 6초까지 기다리고, 못 찾으면 안내한다.
import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { showToast } from '../../app/toast';

export interface FocusTarget {
  /** 항목 id, 수업은 'lesson:날짜:교시' */
  id: string;
  kind: 'event' | 'note' | 'lesson';
  /** 그 카드가 있는 날 (메모는 null) */
  date: string | null;
  /** 부른 때 - 같은 항목을 다시 골라도 다시 짚는다 */
  at: number;
}

export const useFocusTarget = create<{ target: FocusTarget | null }>(() => ({ target: null }));

export function requestFocus(t: Omit<FocusTarget, 'at'>) {
  useFocusTarget.setState({ target: { ...t, at: Date.now() } });
}

/** 강조가 머무는 시간 */
const HIGHLIGHT_MS = 2600;
/** 카드가 나타나기를 기다리는 최대 시간 */
const WAIT_MS = 6000;
const POLL_MS = 150;

const selectorOf = (t: FocusTarget) =>
  t.kind === 'event' ? `[data-event-card="${t.id}"]` : t.kind === 'lesson' ? `[data-lesson-id="${t.id}"]` : `[data-entry-card="${t.id}"]`;

/** 카드를 찾아 가운데로 굴리고 짚는다. 찾으면 true */
export function scrollToFocus(t: FocusTarget): boolean {
  const el = document.querySelector<HTMLElement>(selectorOf(t));
  if (!el) return false;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.classList.remove('search-focus');
  // 같은 카드를 잇달아 고르면 다시 돌도록 한 번 그리게 한다
  void el.offsetWidth;
  el.classList.add('search-focus');
  el.dataset.searchFocus = '1';
  window.setTimeout(() => {
    el.classList.remove('search-focus');
    delete el.dataset.searchFocus;
  }, HIGHLIGHT_MS);
  return true;
}

/** Shell에 하나: 짚을 것이 오면 나타날 때까지 기다려 짚는다 */
export function useSearchFocusRunner() {
  const target = useFocusTarget((s) => s.target);
  useEffect(() => {
    if (!target) return;
    const started = Date.now();
    let timer = 0;
    const tryFind = () => {
      if (scrollToFocus(target)) {
        useFocusTarget.setState({ target: null });
        return;
      }
      if (Date.now() - started >= WAIT_MS) {
        showToast('항목을 화면에서 찾지 못했습니다. 지워졌거나 옮겨졌을 수 있습니다.');
        useFocusTarget.setState({ target: null });
        return;
      }
      timer = window.setTimeout(tryFind, POLL_MS);
    };
    // 화면이 바뀐 뒤 한 번 그려질 틈을 준다
    timer = window.setTimeout(tryFind, 50);
    return () => window.clearTimeout(timer);
  }, [target]);
}

/** 칸이 듣는다: 짚을 것이 이 칸 것이면 reveal (그리는 중에 - effect로 미루지 않는다) */
export function useFocusReveal(isMine: (t: FocusTarget) => boolean, reveal: (t: FocusTarget) => void) {
  const target = useFocusTarget((s) => s.target);
  const [seen, setSeen] = useState<number | null>(null);
  if (target && target.at !== seen) {
    setSeen(target.at);
    if (isMine(target)) reveal(target);
  }
}
