// ⌨️ 단축키 설정 띠의 문 (P44-2 첫 화면 JS) - 껍데기가 늘 그리는 것은 이것뿐, 띠(ShortcutRecordBar)는 고르는 동안만 나눠 받는다.
// 누르기·키 가로채기는 여기서 곧바로 건다 - 띠를 받는 사이에 누른 단추도 고른 것으로 센다.
import { Suspense } from 'react';
import { lazyWithReload } from './lazyWithReload';
import { useRecordListeners, useShortcutRecord } from './shortcutRecord';

const ShortcutRecordBar = lazyWithReload(() => import('./ShortcutRecordBar'), () => null);

export default function ShortcutRecordGate() {
  const stage = useShortcutRecord((s) => s.stage);
  useRecordListeners(stage);
  if (stage === 'off') return null;
  return (
    <Suspense fallback={null}>
      <ShortcutRecordBar />
    </Suspense>
  );
}
