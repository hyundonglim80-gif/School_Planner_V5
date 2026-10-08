// 휴대폰 세로 화면의 화면 탭 (V4 components/MobileTabBar.tsx). 세로로 긴 화면에서는 위 탭이 엄지에서 가장 멀어 아래로 내린다.
import { setScope, useNav } from './nav';
import { SCREENS } from './screens';

export default function MobileTabBar() {
  const scope = useNav((s) => s.scope);

  return (
    <nav
      data-mobile-tabbar
      className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-sm border-t border-border shadow-[0_-1px_3px_rgba(0,0,0,0.04)]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-stretch">
        {SCREENS.map((tab) => {
          const isActive = scope === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              data-tabbar-tab={tab.id}
              aria-pressed={isActive}
              onClick={() => setScope(tab.id)}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 transition-colors ${
                isActive ? 'text-primary' : 'text-slate-400'
              }`}
            >
              <span className={`text-lg leading-none ${isActive ? '' : 'opacity-60 grayscale'}`}>{tab.icon}</span>
              <span className="text-xs font-bold leading-none">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
