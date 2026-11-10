// 단추 대신 누르기 단축키 (P28-3 - 11-09 사용자 '될 수 있으면 모든 버튼 또는 선택이 단축키로', PLAN 5장 'P28 물음 넷' ④).
// 단축키 설정으로 고른 단추를 '어디의 어느 단추'로 적어 둔다 - 키를 누르면 그 단추를 찾아 대신 누른다(app/pressShortcuts).
//
//   자리 : 창 안이면 그 창(win, 탭이 있으면 tab) / 창 밖(머리줄·화면)이면 고를 때 보던 화면(screen)
//   찾기 : 그 단추의 자기 data-* 하나(attr, 그 자리에 하나뿐인 것). 이름만으로 하나면 이름만(값이 바뀌는 단추 - 카드/목록 보기 - 도 찾는다),
//          아니면 이름 = 값. 값에 날짜·항목 id가 들면 쓰지 않는다(항목마다 다르다).
//   이름 : '메모 → 목록으로 보기' (단추 글·aria-label·title)
//   only : 쓰는 칸(메모·일정 칸)이나 열 때 값이 있어야 하는 창(학급 도구 등)의 단추 = 그 창이 열려 있을 때만 (열 길을 모른다)
// id는 'press.<해시>'(위 넷으로 셈 - 같은 단추를 또 고르면 같은 id). 적은 것은 기기 칸 pressTargets(app/prefs), 키는 customShortcuts.
import type { CustomShortcutId } from './shortcuts';

export interface PressTarget {
  /** 창 id (창 목록) - 창 안 단추 */
  win?: string;
  /** 그 창의 탭 (탭이 있는 창 - 창 안 탭 단축키와 같은 이름) */
  tab?: string;
  /** 고를 때 보던 화면 (창 밖 단추) */
  screen?: string;
  /** 단추의 자기 data-* 이름 ('data-memo-view-toggle') */
  attr: string;
  /** 이름만으로 하나가 아닐 때 그 값 */
  value?: string;
  /** 단축키 탭·띠에 보일 이름 */
  label: string;
  /** 그 창이 열려 있을 때만 누른다 (쓰는 칸·값이 있어야 여는 창) */
  only?: true;
}

export type PressShortcutId = `press.${string}`;
export type PressTargets = Partial<Record<PressShortcutId, PressTarget>>;

export const isPressShortcutId = (id: string): id is PressShortcutId => /^press\.[A-Za-z0-9]+$/.test(id);

/** 같은 단추면 같은 id (자리·찾기로 셈 - 이름은 넣지 않는다: 단추 글이 바뀌어도 같은 단추) */
export function pressIdOf(t: Pick<PressTarget, 'win' | 'tab' | 'screen' | 'attr' | 'value'>): PressShortcutId {
  const s = [t.win ?? '', t.tab ?? '', t.win ? '' : t.screen ?? '', t.attr, t.value ?? ''].join('|');
  // FNV-1a 32비트 두 번(씨앗을 달리) - 짧고 겹치기 어렵게
  let a = 0x811c9dc5;
  let b = 0x01000193 ^ 0x5bd1e995;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193) >>> 0;
    b = Math.imul(b ^ c, 0x5bd1e995) >>> 0;
  }
  return `press.${a.toString(36)}${b.toString(36)}`;
}

/** 날짜(2027-03·2027-03-05)나 항목 id(영문·숫자 20자 이상 - data/id·V4 결정적 id·계정 uid)가 든 값 - 항목·날짜마다 다르다 */
export function isItemBoundValue(v: string): boolean {
  return /\d{4}-\d{2}/.test(v) || /[A-Za-z0-9]{20,}/.test(v);
}

/** 찾는 표시로 쓸 수 있는 data-* 이름인가 - 고르기 표시·틀·상태 표시는 뺀다 */
export function isUsableAttr(name: string): boolean {
  return /^data-[a-z0-9-]+$/.test(name) && !SKIP_ATTRS.has(name);
}

/** 단추가 무엇인지 말하지 않는 표시 (고르기·틀·화면 상태) */
const SKIP_ATTRS: ReadonlySet<string> = new Set([
  'data-shortcut-target',
  'data-state',
  'data-active',
  'data-selected',
  'data-open',
  'data-disabled',
  'data-side-slot',
  'data-window-key',
]);

/** 단추 글을 이름으로 - 줄바꿈·겹친 빈칸을 하나로, 길면 자른다 */
export function buttonName(text: string, max = 24): string {
  const s = text.replace(/\s+/g, ' ').trim();
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/** 열 때 탭 말고 다른 값이 있는 창인가 (그런 창은 열 길을 몰라 열려 있을 때만) */
export function needsParams(params: unknown): boolean {
  if (params === undefined || params === null) return false;
  if (typeof params !== 'object' || Array.isArray(params)) return true;
  return Object.entries(params as Record<string, unknown>).some(([k, v]) => k !== 'tab' && k !== 'focus' && v !== undefined && v !== null);
}

const str = (v: unknown, max: number): string | undefined => (typeof v === 'string' && v.length > 0 && v.length <= max ? v : undefined);

/** 계정 설정 문서의 단추 적은 것 → 믿을 만한 것만 (모양이 틀린 것은 뺀다). 통째로 틀리면 undefined */
export function readPressTargets(v: unknown): PressTargets | undefined {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return undefined;
  const out: PressTargets = {};
  for (const [id, raw] of Object.entries(v as Record<string, unknown>)) {
    if (!isPressShortcutId(id) || !raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    const attr = str(r.attr, 80);
    const label = str(r.label, 120);
    if (!attr || !isUsableAttr(attr) || !label) continue;
    const t: PressTarget = { attr, label };
    const win = str(r.win, 40);
    const tab = str(r.tab, 40);
    const screen = str(r.screen, 20);
    const value = str(r.value, 200);
    if (win) t.win = win;
    if (win && tab) t.tab = tab;
    if (!win && screen) t.screen = screen;
    if (value) t.value = value;
    if (r.only === true) t.only = true;
    out[id] = t;
  }
  return out;
}

/** 키가 걸린 것만 남긴다 (서버에 올릴 때 - 해제한 단추의 적은 것은 이 기기에만 남아 되돌리기가 쓴다) */
export function prunePressTargets(targets: PressTargets, keyed: Partial<Record<CustomShortcutId, unknown>>): PressTargets {
  const out: PressTargets = {};
  for (const [id, t] of Object.entries(targets) as Array<[PressShortcutId, PressTarget | undefined]>) if (t && keyed[id]) out[id] = t;
  return out;
}
