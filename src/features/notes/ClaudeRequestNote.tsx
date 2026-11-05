// Claude 요청의 결과 글 (10-19 사용자 의견 - '🤖 바꾼 것 없음'만 보여 왜인지 몰랐다).
// 바꾼 것 또는 바꾸지 않은 까닭을 표시 아래에 글로 - 카드는 세 줄까지, 목록의 펼친 줄은 다. 메모 수정 칸은 말풍선(ClaudeThread - P23).
import { claudeBadge, claudeNoteText } from '../../domain/claudeRequest';
import { useClaudeRequests } from '../../data/claudeRequestStore';
import { CLAUDE_NOTE_TONE } from './claudeTone';

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
      className={`text-xs leading-relaxed whitespace-pre-wrap break-words px-2 py-1.5 rounded-lg border ${CLAUDE_NOTE_TONE[b.tone]} ${short ? 'line-clamp-3' : ''}`}
    >
      {text}
    </p>
  );
}
