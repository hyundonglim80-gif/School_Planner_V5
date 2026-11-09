// 내가 만든 그 밖의 단축키가 하는 일 (P28 - id는 domain/shortcuts CustomShortcutId).
//   'opt.…'   = 환경설정 값 고르기 (P28-2 - app/optionShortcuts가 단다)
//   'press.…' = 단추 대신 누르기 (P28-3)
// 키 처리(app/keys)·이름(app/tabShortcuts shortcutLabel)은 여기만 본다 - 하는 일 쪽(계정 설정·화면)은 무거워
// 창 목록이 부르는 open.ts·키 시험이 끌어오지 않게 등록으로 잇는다(창 안 탭의 setTabOpener와 같다).
import type { CustomShortcutId } from '../domain/shortcuts';

export interface CustomShortcut {
  /** 단축키 탭·띠에 보일 이름 ('창 위치 → 팝업창') */
  label: string;
  /** 누르면 하는 일 */
  run: () => void;
}

export type CustomShortcutKind = 'opt' | 'press';
type Lookup = (id: CustomShortcutId) => CustomShortcut | undefined;

const lookups = new Map<CustomShortcutKind, Lookup>();

/** 그 갈래('opt' / 'press')의 id를 아는 것을 단다 - 같은 갈래는 바꿔 끼운다(HMR로 다시 불려도 하나). 떼는 함수를 돌려준다 */
export function provideCustomShortcuts(kind: CustomShortcutKind, lookup: Lookup): () => void {
  lookups.set(kind, lookup);
  return () => {
    if (lookups.get(kind) === lookup) lookups.delete(kind);
  };
}

/** 이 판·이 기기가 아는 것이면 그 이름·할 일 (모르면 - 나중 판이 더한 것·다른 기기 종류의 값 - undefined) */
export function customShortcutOf(id: CustomShortcutId): CustomShortcut | undefined {
  const kind = id.slice(0, id.indexOf('.')) as CustomShortcutKind;
  return lookups.get(kind)?.(id);
}

/** 누른다. 할 수 있었으면 true (모르는 것은 false - 키를 막지 않는다) */
export function runCustomShortcut(id: CustomShortcutId): boolean {
  const s = customShortcutOf(id);
  if (!s) return false;
  s.run();
  return true;
}
