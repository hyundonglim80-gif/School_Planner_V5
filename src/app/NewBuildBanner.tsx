// '새 판이 있습니다' 띠 (P8-3 - app/newBuild). 새로고침은 누를 때만 - 쓰던 글을 잃지 않게.
import { useNewBuild, useNewBuildCheck } from './newBuild';

export default function NewBuildBanner() {
  useNewBuildCheck();
  const ready = useNewBuild((s) => s.ready);
  if (!ready) return null;
  return (
    <div role="status" data-new-build className="mb-3 flex items-center gap-2 flex-wrap rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
      <span className="font-bold">🔄 새 판이 있습니다.</span>
      <span className="text-emerald-700">쓰던 글을 저장한 뒤 새로고침하면 새 판으로 바뀝니다.</span>
      <button
        type="button"
        data-new-build-reload
        onClick={() => window.location.reload()}
        className="ml-auto px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer"
      >
        새로고침
      </button>
    </div>
  );
}
