// 여러 개 고르기 줄의 문 (P44-2 첫 화면 JS) - 껍데기(Shell)가 늘 그리는 것은 이 작은 문뿐이다.
//   - ⋮ '여러 개 고르기' 단축키·ESC 끝내기는 늘 듣는다(꺼진 동안에도 켤 수 있어야 한다 - multiKeys).
//   - 동작 줄(MultiSelectBar - 라벨·옮기기 판·고른 것 셈)은 켰을 때만 나눠 받는다. 꺼진 동안 그 줄이 듣던 항목·라벨·이월 셈도 쉰다.
import { Suspense } from 'react';
import { lazyWithReload } from '../../app/lazyWithReload';
import { useCurrentSpaceId } from '../../data/session';
import { useMulti } from './multi';
import { useMultiSelectKeys } from './multiKeys';

const MultiSelectBar = lazyWithReload(() => import('./MultiSelectBar'), () => null);

export default function MultiSelectGate() {
  useMultiSelectKeys();
  const on = useMulti((s) => s.on);
  const sid = useCurrentSpaceId();
  if (!on || !sid) return null;
  return (
    <Suspense fallback={null}>
      <MultiSelectBar />
    </Suspense>
  );
}
