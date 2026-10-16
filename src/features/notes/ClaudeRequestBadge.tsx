// 메모 카드의 Claude 요청 진행 표시 (10-16 - 'Claude요청' 라벨을 붙여 저장한 메모만, docs/CLAUDE-REQUEST.md).
// 🤖 보냄 → 고치는 중 → 배포 중 → ✅ 배포됨 / ❌ 실패 · 바꾼 것 없음. 누르면 GitHub 이슈(자세히).
import { claudeBadge } from '../../domain/claudeRequest';
import { useClaudeRequests } from '../../data/claudeRequestStore';

const TONE = {
  wait: 'bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100',
  ok: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100',
  bad: 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100',
};

export default function ClaudeRequestBadge({ itemId }: { itemId: string }) {
  const req = useClaudeRequests((s) => s.byId[itemId]);
  if (!req) return null;
  const b = claudeBadge(req);
  const cls = `text-2xs font-bold px-1.5 py-0.5 rounded border whitespace-nowrap ${TONE[b.tone]}`;
  if (!req.url)
    return (
      <span data-entry-claude={req.state} title={b.title} className={cls}>
        {b.text}
      </span>
    );
  return (
    <a
      data-entry-claude={req.state}
      href={req.url}
      target="_blank"
      rel="noreferrer"
      title={b.title}
      onClick={(e) => e.stopPropagation()}
      className={`${cls} cursor-pointer`}
    >
      {b.text}
    </a>
  );
}
