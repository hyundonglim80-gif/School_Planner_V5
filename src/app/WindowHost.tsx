// 열린 창을 그린다 (창 목록 useWindows). 창마다 따로 산다(key) - 다시 열어도 다시 그리지 않아 적던 것이 남는다.
import { Suspense } from 'react';
import { closeWindow, useWindows, windowComponents, type OpenWindow } from './windows';

export default function WindowHost() {
  const windows = useWindows((s) => s.windows);
  return (
    <>
      {windows.map((w) => (
        <WindowSlot key={w.key} win={w} />
      ))}
    </>
  );
}

function WindowSlot({ win }: { win: OpenWindow }) {
  const Component = windowComponents.get(win.id);
  if (!Component) return null;
  return (
    <Suspense fallback={null}>
      {/* 창 컴포넌트는 등록할 때 한 번 만들어 둔 것이다(windows.windowComponents) - 그릴 때마다 새로 만들지 않는다 */}
      {/* oxlint-disable-next-line react/static-components */}
      <Component params={win.params} close={() => closeWindow(win.key)} raise={win.raisedAt} />
    </Suspense>
  );
}
