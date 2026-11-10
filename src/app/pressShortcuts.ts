// 단추 대신 누르기 단축키 (P28-3 - PLAN 5장 'P28 물음 넷' ④·'P28-3 고르는 법').
//   고르기(pickPressTarget): 단축키 설정 중에 기능 표시(data-shortcut-target)가 없는 단추를 누르면 그 단추를 '어디의 어느 단추'로 적는다(domain/pressTarget).
//     자리 = 창 안이면 그 창(+ 보던 탭), 밖이면 보던 화면 · 찾기 = 그 단추의 자기 data-* 중 그 자리에 하나뿐인 것.
//     못 고르는 것: 표시가 없는 단추 · 같은 단추가 여럿(카드마다 있는 ☐·🗑️) · 날짜·항목 id가 든 단추나 그 안의 단추(카드·날 칸) · 글 칸.
//   누르기(runPress): 보이면 누른다 → 창이 열려 있으면 그 탭으로 → 팝업창에 열려 있으면 그 팝업창에 '누르기' 소식(app/popupWindows) →
//     열 수 있는 창이면 열고 뜨면 → 화면 단추면 그 화면으로 가서 뜨면. 못 찾으면 안내. 쓰는 칸·값이 있어야 여는 창은 열려 있을 때만.
// 키 처리는 app/keys → app/customShortcuts('press' 갈래를 여기서 단다). 적은 것은 keys store press(기기 칸 pressTargets).
import {
  buttonName,
  isItemBoundValue,
  isPressShortcutId,
  isUsableAttr,
  needsParams,
  pressIdOf,
  type PressShortcutId,
  type PressTarget,
} from '../domain/pressTarget';
import type { CustomShortcutId } from '../domain/shortcuts';
import { activateSideSlot } from '../ui/sideColumn';
import { provideCustomShortcuts, type CustomShortcut } from './customShortcuts';
import { useShortcutOverrides } from './keys';
import { setScope, useNav } from './nav';
import { popupOpenFor, pressInPopup } from './popupWindows';
import type { Scope } from './route';
import { SCREENS } from './screens';
import { hasTabOpener, openWindowTab, tabLabelOf, tabOfTarget } from './tabShortcuts';
import { showToast } from './toast';
import { getWindowDef, openWindow, useWindows, type OpenWindow } from './windows';

/** 고를 수 없을 때의 까닭 (띠에 보인다) */
export const PRESS_MISS = {
  none: '이 단추는 단축키로 만들 수 없습니다',
  item: '항목(날짜)마다 다른 단추라 단축키로 만들 수 없습니다',
  many: '같은 단추가 여럿이라 단축키로 만들 수 없습니다',
  box: '글 칸·고르기 칸은 단축키로 만들 수 없습니다',
} as const;

/** 누르면 동작하는 것 - 이 가운데 하나를 눌러야 고른다 */
const BUTTON = 'button, a[href], [role="button"], [role="tab"], [role="menuitem"], [role="switch"], [role="checkbox"], summary, input[type="checkbox"], input[type="radio"]';
/** 글을 넣는 칸 - 만들 수 없다고 알린다 */
const BOX = 'input, select, textarea, label, [contenteditable="true"]';
/** 창 밖 단추를 찾을 때 빼는 곳 (창 틀·오른쪽 줄 탭·단축키 띠) */
const NOT_SCREEN = '[data-window-key], [data-side-column], [data-shortcut-record]';

// ── 보이는가 ──

/** 화면을 그리지 않는 곳(jsdom 시험)에서는 모두 보이는 것으로 */
const layoutless = () => document.documentElement.getClientRects().length === 0;
const isShown = (el: Element) => layoutless() || el.getClientRects().length > 0;

function attrSelector(attr: string, value?: string): string {
  return value === undefined ? `[${attr}]` : `[${attr}="${CSS.escape(value)}"]`;
}

// ── 자리 ──

/** 그 창(id)을 그린 틀들 - 맨 나중에 연(다시 연) 창 먼저 */
function framesOfWindow(win: string): Element[] {
  const wins = useWindows
    .getState()
    .windows.filter((w) => w.id === win)
    .sort((a, b) => b.raisedAt - a.raisedAt);
  return wins.flatMap((w) => [...document.querySelectorAll(`[data-window-key="${w.key}"]`)]);
}

/** 틀 안의 단추 (틀 차례대로 - 보이는 것 먼저 고르는 쪽이 본다) */
function inFrames(frames: Element[], sel: string): Element[] {
  return frames.flatMap((f) => [...f.querySelectorAll(sel)]);
}

/** 창 밖(머리줄·화면)의 단추 */
function onScreen(sel: string): Element[] {
  return [...document.querySelectorAll(sel)].filter((el) => !el.closest(NOT_SCREEN));
}

/** 그 틀에서 지금 고른 탭 (탭 단추 표시 + aria-selected/pressed) */
function activeTabOf(win: string, frames: Element[]): string | undefined {
  for (const f of frames) {
    for (const el of f.querySelectorAll<HTMLElement>('[data-shortcut-target][aria-selected="true"], [data-shortcut-target][aria-pressed="true"]')) {
      const tab = tabOfTarget(win, el.dataset.shortcutTarget ?? '');
      if (tab) return tab;
    }
  }
  return undefined;
}

// ── 고르기 ──

/** 고르는 중인 단추 (키를 저장할 때 store에 넣는다 - 고르다 그만둔 것이 계정에 올라가지 않게) */
const pending = new Map<PressShortcutId, PressTarget>();

export type PressPick = { id: PressShortcutId } | { reason: string };

/**
 * 단축키 설정 중에 누른 것 → 고른 단추(id) / 고를 수 없는 까닭 / null(단추가 아니다 - 빈 곳·글).
 * 기능 표시(data-shortcut-target)가 있는 단추는 부르는 쪽(app/shortcutRecord)이 먼저 본다.
 */
export function pickPressTarget(clicked: Element): PressPick | null {
  const btn = clicked.closest(BUTTON);
  if (!btn) return clicked.closest(BOX) ? { reason: PRESS_MISS.box } : null;

  // 자리
  const frame = btn.closest<HTMLElement>('[data-window-key]');
  let place: { win: OpenWindow; frames: Element[] } | null = null;
  if (frame) {
    const key = Number(frame.dataset.windowKey);
    const win = useWindows.getState().windows.find((w) => w.key === key);
    if (!win || !getWindowDef(win.id)) return { reason: PRESS_MISS.none };
    place = { win, frames: [...document.querySelectorAll(`[data-window-key="${key}"]`)] };
  } else if (btn.closest(NOT_SCREEN)) {
    return { reason: PRESS_MISS.none };
  }
  const within = (sel: string) => (place ? inFrames(place.frames, sel) : onScreen(sel)).filter(isShown);
  const unique = (sel: string) => {
    const hits = within(sel);
    return hits.length === 1 && hits[0] === btn;
  };

  // 카드·날 칸 안의 단추 - 날짜·항목 id가 든 것 안에 있다 (창의 제 항목 - 일정 칸의 data-event-id처럼 그 창에 하나뿐인 것 - 은 괜찮다)
  for (let el = btn.parentElement; el && el !== frame && el !== document.body; el = el.parentElement) {
    if (el.hasAttribute('data-screen')) break;
    for (const a of el.attributes) {
      if (!isUsableAttr(a.name) || !a.value || !isItemBoundValue(a.value)) continue;
      if (place && within(attrSelector(a.name)).length <= 1) continue;
      return { reason: PRESS_MISS.item };
    }
  }

  // 찾기 - 자기 data-* 가운데 그 자리에 하나뿐인 것 (이름만 → 이름 = 값)
  //   값에 날짜·항목 id가 든 표시는 이름만으로도 쓰지 않는다 - 지금 하나뿐이어도(줄 하나인 휴지통) 항목이 늘면 다른 것을 누른다
  const own = [...btn.attributes].filter((a) => isUsableAttr(a.name));
  let found: { attr: string; value?: string } | null = null;
  for (const a of own) {
    if (a.value && isItemBoundValue(a.value)) continue;
    if (unique(attrSelector(a.name))) found = { attr: a.name };
    else if (a.value && unique(attrSelector(a.name, a.value))) found = { attr: a.name, value: a.value };
    if (found) break;
  }
  if (!found) {
    if (own.length === 0) return { reason: PRESS_MISS.none };
    return { reason: own.some((a) => isItemBoundValue(a.value)) ? PRESS_MISS.item : PRESS_MISS.many };
  }

  // 이름
  const input = btn instanceof HTMLInputElement ? btn.closest('label')?.textContent : null;
  const name = buttonName(btn.getAttribute('aria-label') || input || btn.textContent || btn.getAttribute('title') || '') || found.attr.replace(/^data-/, '');
  let target: PressTarget;
  if (place) {
    const { win } = place;
    const def = getWindowDef(win.id)!;
    const tab = activeTabOf(win.id, place.frames);
    const openable = hasTabOpener(win.id) || (def.kind === 'side' && !needsParams(win.params));
    target = { win: win.id, ...(tab ? { tab } : {}), ...found, label: `${tabLabelOf(win.id, tab, def.title)} → ${name}`, ...(openable ? {} : { only: true as const }) };
  } else {
    const screen = useNav.getState().scope;
    const where = btn.closest('header') ? '머리줄' : SCREENS.find((s) => s.id === screen)?.label ?? screen;
    target = { screen, ...found, label: `${where} → ${name}` };
  }
  const id = pressIdOf(target);
  pending.set(id, target);
  return { id };
}

/** 고르는 중이던 단추를 적은 것으로 (키를 저장할 때) - 그 단추면 돌려준다 */
export function takePendingPress(id: string): PressTarget | undefined {
  if (!isPressShortcutId(id)) return undefined;
  const t = pending.get(id);
  pending.clear();
  return t;
}

/** 그만두면 비운다 */
export function clearPendingPress() {
  pending.clear();
}

// ── 누르기 ──

const WAIT_MS = 4000;

/** 보일 때까지 기다린다 (창·화면을 막 열었을 때 - 나눠 받는 부품은 늦게 뜬다) */
function waitFor<T>(find: () => T | null, ms = WAIT_MS): Promise<T | null> {
  return new Promise((resolve) => {
    const start = Date.now();
    const tick = () => {
      const el = find();
      if (el || Date.now() - start > ms) resolve(el);
      else window.setTimeout(tick, 80);
    };
    tick();
  });
}

/** 누른다 - 오른쪽 줄의 숨은 탭에 있으면 그 탭을 먼저 보인다 */
function press(el: Element) {
  const slot = el.closest<HTMLElement>('[data-side-slot]');
  if (slot && !isShown(el) && slot.dataset.sideSlot) activateSideSlot(slot.dataset.sideSlot);
  (el as HTMLElement).click();
}

/** 여럿이 보이면 누르지 않는다 (고를 때는 하나였는데 늘었다 - 엉뚱한 것을 누르지 않게) */
const MANY = 'many' as const;
type Hit = Element | typeof MANY | null;

/**
 * 하나 고르기 - 보이는 것이 하나면 그것, 여럿이면 MANY. 보이는 것이 없으면 창은 숨은 탭의 것(틀 차례 = 맨 나중에 연 창 먼저),
 * 화면은 없음(좁은 화면용 짝처럼 감춘 것은 누르지 않는다)
 */
function pickOne(hits: Element[], hidden: boolean): Hit {
  const shown = hits.filter(isShown);
  if (shown.length > 1) return MANY;
  return shown[0] ?? (hidden ? hits[0] ?? null : null);
}

function notFound(t: PressTarget, hit: Hit = null) {
  if (hit === MANY) return void showToast(`⌨️ '${t.label}' 단추가 여럿이라 누르지 않았습니다`, 4000);
  const def = t.win ? getWindowDef(t.win) : undefined;
  const why = t.only && def ? ` - '${def.title}' 칸이 열려 있을 때 누를 수 있습니다` : '';
  showToast(`⌨️ '${t.label}' 단추를 찾지 못했습니다${why}`, 4000);
}

/** 이 창(큰 창·팝업창) 안에서 그 창의 단추를 찾는다 */
const findInWindow = (t: PressTarget): Hit => pickOne(inFrames(framesOfWindow(t.win!), attrSelector(t.attr, t.value)), true);
const findOnScreen = (t: PressTarget): Hit => pickOne(onScreen(attrSelector(t.attr, t.value)), false);

/**
 * 키를 눌렀다 - 그 단추를 대신 누른다. 창을 여는 일은 키를 누른 그 박자에 한다(팝업창은 '방금 누름'이 있어야 뜬다).
 * 끝나면(눌렀거나 못 찾았거나) 풀린다 - 시험이 기다린다.
 */
export async function runPress(t: PressTarget): Promise<boolean> {
  const done = (hit: Hit) => {
    if (hit && hit !== MANY) {
      press(hit);
      return true;
    }
    notFound(t, hit);
    return false;
  };
  if (t.win) {
    if (!getWindowDef(t.win)) return done(null);
    const now = findInWindow(t);
    if (now) return done(now);
    const isOpen = useWindows.getState().windows.some((w) => w.id === t.win);
    const inPopup = popupOpenFor(t.win);
    if (!isOpen && !inPopup && t.only) return done(null);
    // 그 탭으로(열려 있지 않으면 연다) - 쓰는 칸처럼 열 길을 모르는 창은 열려 있는 그대로
    if (t.tab && !t.only) openWindowTab(t.win, t.tab);
    else if (!isOpen && !inPopup) openWindow(t.win);
    if (popupOpenFor(t.win)) {
      if (await pressInPopup(t.win, t)) return true;
      return done(null);
    }
    return done(await waitFor(() => findInWindow(t)));
  }
  const here = findOnScreen(t);
  if (here) return done(here);
  const screen = t.screen as Scope | undefined;
  if (screen && SCREENS.some((s) => s.id === screen) && useNav.getState().scope !== screen) {
    setScope(screen);
    return done(await waitFor(() => findOnScreen(t)));
  }
  return done(null);
}

/** 팝업창 안에서 - 큰 창의 키가 이 창의 단추를 눌러 달라고 했다 (그 창이 막 뜨는 중이면 기다린다). 여럿이면 누르지 않는다 */
export async function pressInThisWindow(t: PressTarget): Promise<boolean> {
  if (!t.win || !t.attr || !isUsableAttr(t.attr)) return false;
  const hit = await waitFor(() => findInWindow(t));
  if (!hit || hit === MANY) return false;
  press(hit);
  return true;
}

// ── 키 처리에 단다 ──

function lookup(id: CustomShortcutId): CustomShortcut | undefined {
  if (!isPressShortcutId(id)) return undefined;
  const t = useShortcutOverrides.getState().press[id] ?? pending.get(id);
  return t ? { label: t.label, run: () => void runPress(t) } : undefined;
}

provideCustomShortcuts('press', lookup);
