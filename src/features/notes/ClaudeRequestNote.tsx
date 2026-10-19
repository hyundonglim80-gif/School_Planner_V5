// Claude 요청의 결과 글 (10-19 사용자 의견 - '🤖 바꾼 것 없음'만 보여 왜인지 몰랐다).
// 바꾼 것 또는 바꾸지 않은 까닭을 표시 아래에 글로 - 카드는 세 줄까지, 메모 수정 칸·목록의 펼친 줄은 다.
import { claudeBadge, claudeNoteText } from '../../domain/claudeRequest';
import { useClaudeRequests } from '../../data/claudeRequestStore';

const TONE = {
  wait: 'bg-violet-50/70 text-violet-800 border-violet-200',
  ok: 'bg-emerald-50/70 text-emerald-800 border-emerald-200',
  bad: 'bg-rose-50/70 text-rose-800 border-rose-200',
};

export default function ClaudeRequestNote({ itemId, short = false }: { itemId: string; short?: boolean }) {
  const req = useClaudeRequests((s) => s.byId[itemId]);
  if (!req) return null;
  const text = claudeNoteText(req);
  if (!text) return null;
  const b = claudeBadge(req);
  return (
    <p
      data-entry-claude-note={req.state}
      title={short ? text : undefined}
      className={`text-xs leading-relaxed whitespace-pre-wrap break-words px-2 py-1.5 rounded-lg border ${TONE[b.tone]} ${short ? 'line-clamp-3' : ''}`}
    >
      {text}
    </p>
  );
}
