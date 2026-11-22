// 창 안에서만 쓰는 선 아이콘 경로(ui/iconPathsLazy)를 나눠 받는다 (P54-1 - 첫 화면 JS).
//   앱 껍데기가 열린 뒤 미리 받고(Shell → preloadLazyIcons), 그 전에 그려진 아이콘은 같은 크기의 빈 칸 → 받으면 다시 그린다(ui/Icon).
let lazyPaths: Readonly<Record<string, string>> | null = null;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

/** 창 안 아이콘 경로를 받는다 (한 번만 - 실패하면 다음 부름에 다시) */
export function preloadLazyIcons(): Promise<void> {
  loading ??= import('./iconPathsLazy').then(
    (m) => {
      lazyPaths = m.LAZY_ICON_PATHS;
      listeners.forEach((f) => f());
    },
    () => {
      loading = null;
    },
  );
  return loading;
}

/** useSyncExternalStore 짝 - 받은 경로 표(아직이면 null) */
export function subscribeLazyIcons(f: () => void): () => void {
  listeners.add(f);
  return () => {
    listeners.delete(f);
  };
}
export const lazyIconPaths = () => lazyPaths;
