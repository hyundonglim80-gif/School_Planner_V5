// 메모 카드의 Claude 요청 진행 표시 (10-16 - 'Claude요청' 라벨을 붙여 저장한 메모만, docs/CLAUDE-REQUEST.md).
// 🤖 보냄 → 고치는 중 → 배포 중 → ✅ 배포됨 / ❌ 실패 · 바꾼 것 없음. 누르면 GitHub 이슈(자세히).
import { claudeBadge } from '../../domain/claudeRequest';
import { useClaudeRequests } from '../../data/claudeRequestStore';

const TONE = {
  wait: 'bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100',
  ok: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100',
  bad: 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100',
};

/** 표시 칩 하나 - 카드와 메모 칸 안 말풍선(P23)이 같이 쓴다. 주소가 있으면 누르면 이슈 */
export function ClaudeBadgeChip({ badge, url, data }: { badge: ReturnType<typeof claudeBadge>; url: string | null; data: Record<`data-${string}`, string> }) {
  const cls = `inline-block text-2xs font-bold px-1.5 py-0.5 rounded border whitespace-nowrap ${TONE[badge.tone]}`;
  if (!url)
    return (
      <span {...data} title={badge.title} className={cls}>
        {badge.text}
      </span>
    );
  return (
    <a {...data} href={url} target="_blank" rel="noreferrer" title={badge.title} onClick={(e) => e.stopPropagation()} className={`${cls} cursor-pointer`}>
      {badge.text}
    </a>
  );
}

export default function ClaudeRequestBadge({ itemId }: { itemId: string }) {
  const req = useClaudeRequests((s) => s.byId[itemId]);
  if (!req) return null;
  return <ClaudeBadgeChip badge={claudeBadge(req)} url={req.url} data={{ 'data-entry-claude': req.state }} />;
}
