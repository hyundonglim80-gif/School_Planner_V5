// 브라우저 기록 한 곳: 주소(화면·날짜)와 창 층(뒤로가기로 창 닫기)을 함께 다룬다.
// V4 hooks/useModalLayer.ts의 층·표지판을 옮기고, V5의 주소(DESIGN 7-3)를 더했다.
//
// ── 층 ──
// 창(팝업·오른쪽 칸)이 열린 순서대로 z-index를 올려, 창 안에서 연 창이 늘 위에 쌓이게 한다.
// 닫기 단추는 그 창 하나만, 배경 누르기·ESC는 모두(closeAllLayers - ESC는 저장 안 한 글을 먼저 묻는 껍데기 키 처리가 부른다).
// 휴대폰 뒤로가기는 맨 위 하나만 닫는다.
// 화면 옆에 붙은 오른쪽 칸(useBackLayer)은 팝업이 아니지만 뒤로가기는 받는다.
//
// ── 뒤로가기 ──
// 창이 열려 있는 동안 기록 맨 위에 자리를 딱 하나 둔다(표지판, 주소는 그대로). 뒤로가기가 오면 표지판이 물러나며
// 맨 위 창 하나만 닫고, 창이 더 남아 있으면 표지판을 다시 세운다. 창을 다 닫은 뒤의 뒤로가기라야 앞 화면으로 간다.
// ⚠️ 자리를 창마다 하나씩 쌓지 않는다(V4) - 되돌릴 자리 수를 세다가 한 번 어긋나면 진짜 뒤로가기를 삼킨다.
//
// ── 주소 ──
// 화면(탭)을 바꾸면 기록에 한 칸 더한다(뒤로가기 = 앞 화면). 같은 화면에서 날짜만 바꾸면 주소만 고친다
// (◀▶를 여러 번 누른 뒤 뒤로가기가 하루씩 되돌아가지 않게 - PLAN 5장).
// 기록마다 차례 번호(sp5Idx)를 적어 두어, popstate가 뒤로인지 앞으로인지·주소를 손으로 바꾼 것인지 가른다.
import { useEffect, useRef, useState } from 'react';
import { todayStr } from '../domain/dateUtils';
import { useNav } from './nav';
import { dateForRoute, parseRoute, routeHash } from './route';

interface Layer {
  id: number;
  close: () => void;
  /** 뒤로가기만 받는 층 (화면 옆에 붙은 오른쪽 칸) - ESC·배경 누르기(closeAllLayers)로 닫히지 않고 z-index에도 끼지 않는다 */
  backOnly: boolean;
}

interface EntryState {
  sp5Idx?: number;
  sp5Sign?: boolean;
}

const BASE_Z = 1000;
const STEP_Z = 10;

let stack: Layer[] = [];
let nextId = 1;
let openCount = 0;

/** 지금 기록 자리의 차례 */
let curIdx = 0;
/** 지금 기록 자리가 우리가 세운 표지판인가 */
let signPosted = false;
/** 우리가 스스로 물러나려고 back()을 불렀다. 그때 오는 popstate는 우리 것이다. */
let awaitingSelfPop = false;
let selfPopTimer: ReturnType<typeof setTimeout> | null = null;
/** 기록이 이미 물러난 층 id (뒤로가기로 닫혔거나 한꺼번에 정리됐다) */
const historyHandled = new Set<number>();

const modalLayers = () => stack.filter((l) => !l.backOnly);
const entryState = (): EntryState => (window.history.state as EntryState | null) ?? {};

function clearSelfPopWait() {
  awaitingSelfPop = false;
  if (selfPopTimer) {
    clearTimeout(selfPopTimer);
    selfPopTimer = null;
  }
}

function pushEntry(extra: EntryState, url?: string) {
  curIdx += 1;
  window.history.pushState({ sp5Idx: curIdx, ...extra }, '', url);
}

function postSign() {
  if (signPosted) return;
  try {
    pushEntry({ sp5Sign: true });
    signPosted = true;
    // 새 표지판을 세웠으면 앞의 기다림은 더 볼 것이 없다.
    clearSelfPopWait();
  } catch {
    /* 기록을 못 쓰는 환경이면 뒤로가기 연동만 빠지고 나머지는 그대로 돈다 */
  }
}

function removeSign() {
  if (!signPosted) return;
  signPosted = false;
  awaitingSelfPop = true;
  // popstate가 끝내 안 오면(뒤로 갈 자리가 없는 등) 기다림을 스스로 푼다. 안 풀면 그다음 진짜 뒤로가기를 삼킨다.
  if (selfPopTimer) clearTimeout(selfPopTimer);
  selfPopTimer = setTimeout(clearSelfPopWait, 600);
  try {
    window.history.back();
  } catch {
    clearSelfPopWait();
  }
}

// ── 주소 ──

let routing = false;
/** 기록에서 읽은 값을 store에 넣는 중 (그 변화로 기록을 또 쓰지 않게) */
let applying = false;

const currentHash = () => {
  const s = useNav.getState();
  return routeHash(s.scope, s.date, s.classId);
};

/** 주소를 지금 화면에 맞춘다 (기록 칸은 늘리지 않는다) */
function fixUrl() {
  if (!routing) return;
  const hash = currentHash();
  if (window.location.hash !== hash) window.history.replaceState(window.history.state, '', hash);
}

/** 주소창의 주소대로 화면을 옮긴다. 모르는 주소면 지금 화면의 주소로 고친다. */
function applyLocation() {
  if (!routing) return;
  const route = parseRoute(window.location.hash);
  if (!route) {
    fixUrl();
    return;
  }
  const s = useNav.getState();
  applying = true;
  try {
    useNav.setState({
      scope: route.scope,
      date: dateForRoute(route, s.date, todayStr()),
      ...(route.scope === 'class' ? { classId: route.classId ?? null } : {}),
    });
  } finally {
    applying = false;
  }
  fixUrl();
}

function onPopState(e: PopStateEvent) {
  const st = (e.state as EntryState | null) ?? {};
  if (awaitingSelfPop) {
    clearSelfPopWait();
    if (typeof st.sp5Idx === 'number') curIdx = st.sp5Idx;
    signPosted = !!st.sp5Sign;
    fixUrl();
    return;
  }
  // 주소를 손으로 바꾸면(해시 이동) 브라우저가 차례 번호 없는 새 자리를 만든다
  if (typeof st.sp5Idx !== 'number') {
    curIdx += 1;
    window.history.replaceState({ sp5Idx: curIdx }, '');
    signPosted = false;
    applyLocation();
    return;
  }
  const back = st.sp5Idx < curIdx;
  const leftSign = signPosted;
  curIdx = st.sp5Idx;
  signPosted = !!st.sp5Sign;

  if (back && leftSign && stack.length > 0) {
    // 표지판이 물러났다 - 맨 위 층 하나만 닫는다
    const top = stack[stack.length - 1];
    historyHandled.add(top.id);
    try {
      top.close();
    } catch (err) {
      console.error('창 닫기 실패:', err);
    }
    // 아래에 층이 남아 있으면 다음 뒤로가기도 받아야 한다 (이 시점의 stack에는 방금 닫은 것이 아직 있다 - React가 나중에 뺀다)
    if (stack.length > 1) postSign();
    fixUrl();
    return;
  }
  applyLocation();
}

/** 해시만 바뀌고 popstate가 오지 않는 경우를 위한 덧받이 (같은 주소면 하는 일이 없다) */
function onHashChange() {
  if (routing && window.location.hash !== currentHash()) applyLocation();
}

let popStateBound = false;
function bindPopState() {
  if (popStateBound || typeof window === 'undefined') return;
  window.addEventListener('popstate', onPopState);
  window.addEventListener('hashchange', onHashChange);
  popStateBound = true;
}

/** store가 바뀌면 주소를 따라 고친다. 화면이 바뀌면 기록 한 칸, 날짜만이면 주소만. */
function onNavChange(s: ReturnType<typeof useNav.getState>, prev: ReturnType<typeof useNav.getState>) {
  if (!routing || applying) return;
  const hash = routeHash(s.scope, s.date, s.classId);
  if (window.location.hash === hash) return;
  const newScreen = s.scope !== prev.scope || (s.scope === 'class' && s.classId !== prev.classId);
  if (!newScreen) {
    window.history.replaceState(window.history.state, '', hash);
    return;
  }
  if (signPosted) {
    // 창이 열려 있다: 표지판 자리를 새 화면으로 바꾸고 그 위에 표지판을 다시 세운다 → [앞 화면][새 화면][표지판]
    window.history.replaceState({ sp5Idx: curIdx }, '', hash);
    pushEntry({ sp5Sign: true }, hash);
  } else {
    pushEntry({}, hash);
  }
}

/**
 * 주소 맞물리기를 시작한다 (로그인한 껍데기가 한 번). 주소에 화면이 있으면 그 화면으로, 없으면 지금 화면의 주소를 적는다.
 * 끝내는 함수를 돌려준다.
 */
export function startRouting(): () => void {
  if (routing) return () => {};
  const st = entryState();
  curIdx = typeof st.sp5Idx === 'number' ? st.sp5Idx : 0;
  // 새로고침하면 창은 없다 - 남은 표지판 자리는 보통 자리로
  signPosted = false;
  window.history.replaceState({ sp5Idx: curIdx }, '');
  routing = true;
  bindPopState();
  applyLocation();
  const unsub = useNav.subscribe(onNavChange);
  return () => {
    unsub();
    routing = false;
  };
}

// ── 층 ──

/** 지금 창(팝업)이 하나라도 열려 있는지. 화면의 손짓·바깥 누르기가 창 위의 일을 화면 일로 세지 않게. */
export function isAnyLayerOpen(): boolean {
  return modalLayers().length > 0;
}

/**
 * 팝업 층을 모두 닫는다 (배경 누르기, 그리고 ESC - 껍데기의 키 처리가 windows.closeAllWindows로 부른다).
 * 옆에 붙은 칸(뒤로가기만 받는 층)은 그대로.
 */
export function closeAllLayers() {
  const snapshot = modalLayers().reverse();
  stack = stack.filter((l) => l.backOnly);
  openCount = 0;
  // 한꺼번에 닫으므로 아래 각 층의 정리에서 또 물러나지 않도록 미리 표시한다.
  snapshot.forEach((l) => historyHandled.add(l.id));
  snapshot.forEach((l) => {
    try {
      l.close();
    } catch (err) {
      console.error('창 닫기 실패:', err);
    }
  });
  // 옆에 붙은 칸이 남아 있으면 그 칸이 표지판을 계속 쓴다.
  if (snapshot.length > 0 && stack.length === 0) removeSign();
}

/**
 * 팝업 층. 열린 동안 z-index를 돌려준다.
 * raise가 바뀌면 층에서 빠졌다가 맨 위로 다시 선다 (휴대폰에서 이미 열린 쓰는 칸을 다시 열 때).
 */
export function useModalLayer(isOpen: boolean, onClose: () => void, raise?: number): number {
  return useLayer(isOpen, onClose, false, raise);
}

/**
 * 뒤로가기만 받는 층. 화면 옆에 붙은 오른쪽 칸이 쓴다 - 폭이 768px 이상인 휴대 기기(태블릿·가로 화면)에서
 * 칸을 열고 뒤로가기를 누르면 칸이 아니라 크롬이 닫혔다(V4).
 */
export function useBackLayer(isOpen: boolean, onClose: () => void): void {
  useLayer(isOpen, onClose, true);
}

function useLayer(isOpen: boolean, onClose: () => void, backOnly: boolean, raise?: number): number {
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });
  const [zIndex, setZIndex] = useState(BASE_Z);

  useEffect(() => {
    if (!isOpen) return;
    const id = nextId++;
    if (!backOnly) {
      openCount += 1;
      // 층 차례는 모듈 밖(열린 창들)과 맞추는 값이라 열린 그때 정한다
      // oxlint-disable-next-line react/set-state-in-effect
      setZIndex(BASE_Z + openCount * STEP_Z);
    }
    stack.push({ id, close: () => closeRef.current(), backOnly });
    bindPopState();
    postSign();

    return () => {
      stack = stack.filter((l) => l.id !== id);
      if (modalLayers().length === 0) openCount = 0;
      // 뒤로가기로 닫혔거나 한꺼번에 정리된 것이면 기록은 이미 물러나 있다.
      if (historyHandled.has(id)) {
        historyHandled.delete(id);
        return;
      }
      // 닫기 단추처럼 스스로 닫힌 경우. 마지막 층이었으면 표지판을 치운다.
      // ⚠️ 한 박자 늦게 본다. 오른쪽 칸에서 다른 항목을 열거나 화면을 돌려 칸이 붙었다 떴다 하면, 같은 순간에
      //    앞 층이 닫히고 새 층이 열린다. 곧바로 back()을 부르면 새 층이 세운 표지판 뒤에 도착해 방금 연 칸을 닫는다.
      queueMicrotask(() => {
        if (stack.length === 0) removeSign();
      });
    };
  }, [isOpen, backOnly, raise]);

  return zIndex;
}

/** 시험에서만: 모듈 상태를 처음으로 */
export function resetHistoryForTest() {
  stack = [];
  openCount = 0;
  curIdx = 0;
  signPosted = false;
  routing = false;
  applying = false;
  clearSelfPopWait();
  historyHandled.clear();
}
