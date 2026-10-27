// 열린 창을 그린다 (창 목록 useWindows). 창마다 따로 산다(key) - 다시 열어도 다시 그리지 않아 적던 것이 남는다.
import { Suspense, useMemo } from 'react';
import { isPopoutRoot, WindowSlotContext } from '../ui/popout';
import { SideOwnerContext } from '../ui/sideColumn';
import { closeWindow, setWindowParams, useWindows, windowComponents, type OpenWindow } from './windows';

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
  // 창의 맨 바깥 틀이 보는 것 - 머리 ↗(새 창으로 옮기기)·새 창에서 창 가득 (ui/popout)
  const slot = useMemo(() => ({ key: win.key, fill: isPopoutRoot(win.key) }), [win.key]);
  if (!Component) return null;
  return (
    <Suspense fallback={null}>
      {/* 오른쪽 줄의 칸이 어느 창 것인지 (보이는 탭의 창 - windows.useShownWindowPick) */}
      <SideOwnerContext.Provider value={win.key}>
        <WindowSlotContext.Provider value={slot}>
          {/* 창 컴포넌트는 등록할 때 한 번 만들어 둔 것이다(windows.windowComponents) - 그릴 때마다 새로 만들지 않는다 */}
          {/* oxlint-disable-next-line react/static-components */}
          <Component params={win.params} close={() => closeWindow(win.key)} raise={win.raisedAt} setParams={(p) => setWindowParams(win.key, p)} />
        </WindowSlotContext.Provider>
      </SideOwnerContext.Provider>
    </Suspense>
  );
}
