// 여러 개 고르기의 단추·ESC (P44-2) - 동작 줄(MultiSelectBar)을 받기 전부터 늘 듣는다. 껍데기의 문(MultiSelectGate)이 건다.
import { useEffect } from 'react';
import { addEscapeAction, setShortcutAction } from '../../app/keys';
import { endMulti, toggleMulti } from './multi';

/** ⋮ '여러 개 고르기' · ESC로 끝내기 */
export function useMultiSelectKeys() {
  useEffect(() => {
    const offs = [setShortcutAction('multiSelect', toggleMulti), addEscapeAction(endMulti)];
    return () => offs.forEach((off) => off());
  }, []);
}
