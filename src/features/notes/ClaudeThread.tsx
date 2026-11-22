// 메모 칸 안 Claude 대화 (P23 11-04 사용자 요청 - '채팅창에서 대화를 주고받는 것처럼'). 메모 글·첨부 아래, 스크롤 칸 맨 아래.
//   턴 하나 = 내 글(오른쪽) + Claude(왼쪽 - 표시 + 결과 글, 표시를 누르면 이슈). 카드·목록 줄은 그대로 마지막 결과 글만 보인다.
//   - 첫 요청은 한 줄로 접는다(메모 글이 바로 위에 있다, 글이 없으면 턴이 없는 옛 메모·보내기 전).
//   - '바꾼 것 없음'은 실패 색이 아니다(되물음·답일 수 있다) · ❌·⚠ 턴은 보낸 글을 글 칸에 다시 넣을 수 있다.
//   - 턴이 둘 이상이면 열 때 맨 아래로(메모 글이 길면 답이 안 보인다). 턴이 늘면 맨 아래로, 답이 오면 맨 아래를 보던 때만 따라간다.
//     내린 뒤 잠깐(SETTLE_MS)은 사용자가 손대기 전까지 프레임마다 맨 아래를 지킨다 - 그동안 글 칸이 높이를 재고 오른쪽 칸이 자리를 잡는다
//     (P44-1 11-17~18 CI - 세 번 모두 칸이 맨 위(2006px)에 남았는데 PC·컨테이너에서는 재현되지 않았다. 스크롤 알림·크기 알림 한 번에 기대지 않는다.
//      11-18 P45-1에 찾은 진짜 원인은 점검 - ESC가 칸을 닫지 못해 '다시 열기'가 열린 칸을 그대로 봤다(PLAN 5장 'P44-1 정한 것' ⑥). 지키기는 해가 없어 둔다).
//   말풍선은 턴이 있을 때만 그린다(부르는 쪽) - 스크롤 듣기가 처음 그릴 때 칸을 찾는다.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { claudeNoteText, claudeRunLabel, claudeTurnBadge, type ClaudeTurn } from '../../domain/claudeRequest';
import { ClaudeBadgeChip } from './ClaudeRequestBadge';
import { CLAUDE_NOTE_TONE } from './claudeTone';
import { Glyph } from '../../ui/Icon';

/** 맨 아래에서 이만큼 안이면 맨 아래를 보는 것으로 친다(px) */
const NEAR_BOTTOM_PX = 80;
/** 맨 아래로 내린 뒤 이만큼(ms)은 프레임마다 맨 아래를 지킨다 - 사용자가 손대면(휠·터치·누르기·키) 곧바로 그만 */
export const SETTLE_MS = 1500;
/** 사용자가 칸에 손댔다 - 이 뒤의 스크롤은 사용자의 것 */
const USER_INPUT = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const;

const MINE = 'max-w-[85%] rounded-2xl bg-primary px-3 py-1.5 text-left text-sm text-white';

/** 내 글 - 첫 요청은 한 줄로 접는다 */
function AskBubble({ turn }: { turn: ClaudeTurn }) {
  const [open, setOpen] = useState(false);
  const text = turn.askText.trim();
  if (turn.n !== 1)
    return (
      <p data-claude-turn-ask className={`${MINE} whitespace-pre-wrap break-words`}>
        {text}
      </p>
    );
  if (!text)
    return (
      <p data-claude-turn-ask className={MINE}>
        메모 글을 보냈습니다
      </p>
    );
  return (
    <button
      type="button"
      data-claude-turn-ask
      data-claude-turn-fold={open ? 'open' : 'closed'}
      aria-expanded={open}
      onClick={() => setOpen((v) => !v)}
      title={open ? '접기' : '보낸 글 다 보기'}
      className={`${MINE} min-w-0 cursor-pointer ${open ? 'whitespace-pre-wrap break-words' : 'truncate'}`}
    >
      {open ? '▾' : '▸'} {text}
    </button>
  );
}

function Turn({ turn, onRefill }: { turn: ClaudeTurn; onRefill?: (text: string) => void }) {
  const badge = claudeTurnBadge(turn);
  const note = claudeNoteText(turn);
  const again = onRefill && (turn.state === 'failed' || turn.state === 'dropped') && turn.askText.trim();
  const run = turn.run ? claudeRunLabel(turn.run) : '';
  return (
    <li data-claude-turn={turn.n} data-claude-turn-state={turn.state} className="space-y-1.5">
      <div className="flex justify-end">
        <AskBubble turn={turn} />
      </div>
      <div className="flex justify-start">
        <div className={`min-w-0 max-w-[85%] space-y-1 rounded-2xl border px-3 py-1.5 ${CLAUDE_NOTE_TONE[badge.tone]}`}>
          <ClaudeBadgeChip badge={badge} url={turn.url} data={{ 'data-claude-turn-badge': turn.state }} />
          {/* 고른 모델·노력 (11-08) - 기본이면 적지 않는다 */}
          {run && (
            <span data-claude-turn-run className="ml-1.5 text-2xs opacity-75">
              {run}
            </span>
          )}
          {note && (
            <p data-claude-turn-note className="whitespace-pre-wrap break-words text-xs leading-relaxed">
              {note}
            </p>
          )}
          {again && (
            <button
              type="button"
              data-claude-turn-refill
              onClick={() => onRefill(turn.askText)}
              title="보낸 글을 아래 글 칸에 넣습니다 - 고쳐서 다시 보낼 수 있습니다"
              className="block text-2xs font-bold underline underline-offset-2 hover:no-underline cursor-pointer"
            >
              ↻ 글 칸에 다시 넣기
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

export default function ClaudeThread({ turns, onRefill }: { turns: ClaudeTurn[]; onRefill?: (text: string) => void }) {
  const root = useRef<HTMLElement>(null);
  /** 그린 턴 수 (0 = 아직 처음 그리기 전) */
  const drawn = useRef(0);
  /** 맨 아래를 보고 있다 */
  const atBottom = useRef(false);
  const scroller = () => root.current?.closest<HTMLElement>('[data-scroll-lock]') ?? null;
  /** 이때(performance.now)까지 맨 아래를 지킨다 (0 = 지키지 않음) */
  const settleUntil = useRef(0);
  const frame = useRef(0);
  const settling = () => performance.now() < settleUntil.current;
  /** 맨 아래로 내리고 잠깐 지킨다 - 늦게 높이를 재는 글 칸·자리를 잡는 칸이 밀어내도, 그 알림이 오지 않아도 */
  const pinBottom = (box: HTMLElement) => {
    box.scrollTop = box.scrollHeight;
    atBottom.current = true;
    settleUntil.current = performance.now() + SETTLE_MS;
    if (frame.current) return;
    const tick = () => {
      if (!settling()) {
        frame.current = 0;
        return;
      }
      if (box.scrollHeight - box.scrollTop - box.clientHeight > 1) box.scrollTop = box.scrollHeight;
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  };

  const changes = turns.map((t) => `${t.n}:${t.state}:${t.note.length}`).join();
  useLayoutEffect(() => {
    const box = scroller();
    if (!box) return;
    const opened = drawn.current === 0;
    const grew = turns.length > drawn.current;
    drawn.current = turns.length;
    if (opened ? turns.length > 1 : grew || atBottom.current) pinBottom(box);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 턴·상태·답이 바뀔 때만
  }, [changes]);
  useEffect(() => {
    const box = scroller();
    if (!box) return;
    const onScroll = () => {
      if (settling()) return; // 지키는 동안의 스크롤은 칸이 자리 잡는 것 - 사용자가 손대면 먼저 그만둔다(아래)
      atBottom.current = box.scrollHeight - box.scrollTop - box.clientHeight < NEAR_BOTTOM_PX;
    };
    const onUser = () => {
      settleUntil.current = 0;
    };
    box.addEventListener('scroll', onScroll, { passive: true });
    for (const type of USER_INPUT) box.addEventListener(type, onUser, { capture: true, passive: true });
    // 맨 아래를 보는 동안 위가 늘어나도 따라간다 - 다시 열면 턴이 캐시에서 곧바로 와, 글 칸이 한 프레임 뒤에 높이를 재며 답을 밀어냈다(대화 방과 같다)
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => atBottom.current && (box.scrollTop = box.scrollHeight));
    for (const el of [box, ...box.children]) ro?.observe(el); // box = 글 칸이 늘어나 스크롤 칸이 줄 때
    return () => {
      box.removeEventListener('scroll', onScroll);
      for (const type of USER_INPUT) box.removeEventListener(type, onUser, { capture: true });
      ro?.disconnect();
      cancelAnimationFrame(frame.current);
      frame.current = 0;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 처음 그릴 때 한 번 (칸은 그대로다)
  }, []);

  return (
    <section ref={root} data-claude-thread={turns.length} className="space-y-2 border-t border-slate-100 pt-4">
      <span className="block text-xs font-semibold text-slate-600"><Glyph e="🤖" /> Claude와 주고받은 글</span>
      <ol className="space-y-3">
        {turns.map((t) => (
          <Turn key={t.n} turn={t} onRefill={onRefill} />
        ))}
      </ol>
    </section>
  );
}
