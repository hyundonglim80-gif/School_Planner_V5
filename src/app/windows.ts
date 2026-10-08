// 창 목록 (DESIGN 7-2). 모든 창(오른쪽 칸 창·쓰는 칸·가운데 창)을 한 곳에 등록하고, ⋮ 메뉴·학급 화면 도구 카드·
// 하루 수업 머리줄·단축키·설명서 링크가 여기서 읽는다. V4 Layout은 창마다 열림 상태를 들고 있었다(30여 개).
//
//   registerWindow({ id, title, icon, menu?, classTool?, lessonHeader?, show?, kind, load, help? })
//   openWindow('seating', { classId })   // 껍데기가 열림 상태를 들지 않는다
//
// 열린 창은 store(useWindows)의 windows에 있다. 창 컴포넌트는 { params, close, raise }를 받아 ModalShell(창)이나
// SidePanelFrame(쓰는 칸)으로 스스로 틀을 그린다 - 오른쪽 줄의 탭 차례·숨은 탭은 그 틀이 맡는다(ui/sideColumn).
import type { ComponentType, LazyExoticComponent } from 'react';
import { create } from 'zustand';
import { closeAllLayers } from './history';
import { lazyWithReload } from './lazyWithReload';

/** ⋮ 메뉴 구역 (MENU.md 3-4) */
export type MenuSection = '일정' | '수업' | '자료' | '설정';

/** 창 컴포넌트가 받는 것 */
export interface WindowProps<P = unknown> {
  params: P;
  /** 이 창 하나만 닫기 (저장 없이) */
  close: () => void;
  /** 이미 열린 창을 다시 열면 바뀐다 - 틀(ModalShell·SidePanelFrame)에 그대로 넘긴다 */
  raise: number;
}

export interface WindowDef<P = unknown> {
  /** = 단축키 id (V4 SHORTCUT_ACTIONS의 id를 그대로) */
  id: string;
  title: string;
  icon: string;
  /** ⋮ 구역 (없으면 ⋮에 없다) */
  menu?: MenuSection;
  /** 학급 화면 도구 카드 */
  classTool?: true;
  /** 하루 수업 머리줄 단추 */
  lessonHeader?: true;
  /** 담임/교과 전담에 따라 숨기기 (V4 homeroom·classUnit) - P6-1에서 교사 유형을 넘긴다 */
  show?: (ctx: { homeroom: boolean; classUnit: boolean }) => boolean;
  /** 오른쪽 칸 창 / 쓰는 칸 */
  kind: 'side' | 'panel';
  /** 열 때 싣는다 */
  load: () => Promise<{ default: ComponentType<WindowProps<P>> }>;
  /** 설명서 주제 id */
  help?: string;
  /** 같은 창인가 - 다시 열면 새로 만들지 않고 그 탭을 보인다. 주지 않으면 창(side)은 하나만, 쓰는 칸은 params가 같을 때. */
  sameAs?: (a: P, b: P) => boolean;
  /** 개발·점검용 (⋮·단축키 목록·설명서 검사에서 뺀다) */
  dev?: true;
}

export interface OpenWindow {
  /** 열 때마다 새 번호 - React key, 닫기 */
  key: number;
  id: string;
  params: unknown;
  openedAt: number;
  /** 다시 연 때 (바뀌면 보이는 탭이 된다) */
  raisedAt: number;
}

const registry = new Map<string, WindowDef<never>>();
/** 창 컴포넌트 (등록할 때 만들어 두고, 처음 열 때 싣는다) */
export const windowComponents = new Map<string, LazyExoticComponent<ComponentType<WindowProps>>>();

export function registerWindow<P>(def: WindowDef<P>) {
  if (registry.has(def.id)) throw new Error(`창 id가 겹칩니다: ${def.id}`);
  registry.set(def.id, def as unknown as WindowDef<never>);
  windowComponents.set(def.id, lazyWithReload(def.load as unknown as () => Promise<{ default: ComponentType<WindowProps> }>));
}

export function getWindowDef(id: string): WindowDef<unknown> | undefined {
  return registry.get(id) as WindowDef<unknown> | undefined;
}

export function listWindows(): WindowDef<unknown>[] {
  return [...registry.values()] as WindowDef<unknown>[];
}

export const useWindows = create<{ windows: OpenWindow[] }>(() => ({ windows: [] }));

let lastKey = 0;
const stamp = () => {
  // 같은 ms에 둘을 열어도 차례가 갈리게
  lastKey = Math.max(lastKey + 1, Date.now());
  return lastKey;
};

const sameParams = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** 창을 연다. 이미 열린 같은 창이면 그 탭을 보인다. 열린 창의 key를 돌려준다. */
export function openWindow(id: string, params?: unknown): number {
  const def = getWindowDef(id);
  if (!def) throw new Error(`등록하지 않은 창: ${id}`);
  const same = (w: OpenWindow) =>
    w.id === id && (def.sameAs ? def.sameAs(w.params, params) : def.kind === 'side' || sameParams(w.params, params));
  const now = stamp();
  const existing = useWindows.getState().windows.find(same);
  if (existing) {
    useWindows.setState((s) => ({ windows: s.windows.map((w) => (w === existing ? { ...w, params: params ?? w.params, raisedAt: now } : w)) }));
    return existing.key;
  }
  useWindows.setState((s) => ({ windows: [...s.windows, { key: now, id, params, openedAt: now, raisedAt: now }] }));
  return now;
}

/** 창 하나를 닫는다 (저장 없이 - 묻는 것은 창이 닫기 전에 한다) */
export function closeWindow(key: number) {
  useWindows.setState((s) => ({ windows: s.windows.filter((w) => w.key !== key) }));
}

// ── 저장 안 한 글 ──

const unsavedChecks = new Set<{ current: (() => boolean) | null }>();

/** 창이 '저장 안 한 것이 있나'를 알린다 (열려 있는 동안). ESC로 모두 닫기 전에 본다. */
export function registerUnsavedCheck(ref: { current: (() => boolean) | null }): () => void {
  unsavedChecks.add(ref);
  return () => {
    unsavedChecks.delete(ref);
  };
}

/** 열린 창 가운데 저장 안 한 것이 있는가 */
export function anyWindowUnsaved(): boolean {
  for (const ref of unsavedChecks) {
    try {
      if (ref.current?.()) return true;
    } catch {
      /* 확인을 못 하면 없는 것으로 */
    }
  }
  return false;
}

/**
 * 오른쪽 줄 전체를 닫는다 (ESC·오른쪽 줄 ▶ 단추). 저장 안 한 것이 있으면 먼저 묻는다 - ESC 한 번에 적던 글이 사라지면
 * 되돌릴 길이 없다(V4). 닫았으면 true.
 */
export function closeAllWindows(): boolean {
  if (anyWindowUnsaved() && !window.confirm('저장하지 않은 내용이 있는 칸이 있습니다. 저장하지 않고 모두 닫을까요?')) {
    return false;
  }
  closeAllLayers();
  useWindows.setState({ windows: [] });
  return true;
}

/** 시험에서만 */
export function resetWindowsForTest() {
  registry.clear();
  windowComponents.clear();
  unsavedChecks.clear();
  useWindows.setState({ windows: [] });
}
