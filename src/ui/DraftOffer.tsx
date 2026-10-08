// 쓰는 칸 맨 위의 '저장하지 않은 글이 있습니다 - 되살리기 / 버리기' (쓰던 글 보관 - data/drafts).
import { formatDate, shortDateLabel } from '../domain/dateUtils';

export default function DraftOffer({ savedAt, onRestore, onDiscard }: { savedAt: number; onRestore: () => void; onDiscard: () => void }) {
  const at = new Date(savedAt);
  const when = `${shortDateLabel(formatDate(at))} ${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`;
  return (
    <div data-draft-offer className="flex flex-wrap items-center gap-2 px-3 py-2 rounded-xl border border-amber-200 bg-amber-50 text-xs font-bold text-amber-800">
      <span className="flex-1 min-w-0">📝 저장하지 않은 글이 있습니다 ({when}에 적던 것)</span>
      <button type="button" data-draft-restore onClick={onRestore} className="px-2.5 py-1 rounded-lg bg-amber-500 text-white hover:bg-amber-600 cursor-pointer">
        되살리기
      </button>
      <button type="button" data-draft-discard onClick={onDiscard} className="px-2.5 py-1 rounded-lg text-amber-700 hover:bg-amber-100 cursor-pointer">
        버리기
      </button>
    </div>
  );
}
