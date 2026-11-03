// 💬 방의 글 한 줄 (P19-2 ■1 - P19-4 ■2에 ChatRoomView에서 나눔). 남의 글 왼쪽(잇단 글의 첫 글에만 이름) · 내 글 오른쪽 · 시각 · 1:1 '1'.
//   내 글 지우기(P19-4 ■2): 마우스를 올리면 시각 옆 🗑️ · 휴대폰은 글을 길게 누르기 → 묻고 '지운 글'(자리는 남는다 - data/chat deleteChatMsg).
//   지운 글·보내는 중인 글(서버에 아직 없다)은 지우지 않는다.
import type { MouseEvent } from 'react';
import { chatTime, type ChatMsg } from '../../domain/chat';
import { useLongPress } from '../../ui/longPress';
import SharedAttachments from '../notes/SharedAttachments';

interface Props {
  msg: ChatMsg;
  mine: boolean;
  /** 이름을 보인다 (잇단 글의 첫 글) */
  head: boolean;
  /** 시각을 보인다 */
  time: boolean;
  /** 1:1 - 상대가 아직 안 읽음 */
  unseen: boolean;
  /** 지우기 (내 글만 - 묻기는 부르는 쪽) */
  onDelete?: (msg: ChatMsg) => void;
}

export default function ChatMsgRow({ msg, mine, head, time, unseen, onDelete }: Props) {
  const canDelete = !!onDelete && mine && !msg.deleted && msg.at !== null;
  const press = useLongPress(() => canDelete && onDelete!(msg));
  // 길게 눌러 물은 뒤 손을 떼면 오는 click - 첨부(그림 크게 보기)를 열지 않게
  const swallow = (e: MouseEvent) => {
    if (!press.consumed()) return;
    e.preventDefault();
    e.stopPropagation();
  };
  return (
    <li data-chat-msg={msg.id} data-chat-mine={mine ? 'yes' : 'no'} className={`group flex ${mine ? 'justify-end' : 'justify-start'} ${head ? 'mt-2' : 'mt-0.5'}`}>
      <div className={`flex min-w-0 max-w-[85%] flex-col ${mine ? 'items-end' : 'items-start'}`}>
        {!mine && head && (
          <span data-chat-name className="mb-0.5 px-1 text-2xs font-bold text-slate-500">
            {msg.fromName}
          </span>
        )}
        <div className={`flex min-w-0 items-end gap-1 ${mine ? 'flex-row-reverse' : ''}`}>
          <div className="flex min-w-0 flex-col gap-1" {...(canDelete ? press.handlers : {})} onClickCapture={canDelete ? swallow : undefined}>
            {(msg.text || msg.deleted) && (
              <p
                data-chat-text
                className={`whitespace-pre-wrap break-words rounded-2xl px-3 py-1.5 text-sm ${
                  msg.deleted ? 'italic text-slate-400 bg-slate-50 border border-slate-200' : mine ? 'bg-primary text-white' : 'bg-slate-100 text-slate-800'
                }`}
              >
                {msg.deleted ? '지운 글' : msg.text}
              </p>
            )}
            {msg.attachments.length > 0 && (
              <div className="w-60 max-w-full">
                <SharedAttachments kind="chat" items={msg.attachments} />
              </div>
            )}
          </div>
          <span className={`flex shrink-0 flex-col text-[10px] leading-tight text-slate-400 ${mine ? 'items-end' : 'items-start'}`}>
            {canDelete && (
              <button
                type="button"
                data-chat-delete={msg.id}
                onClick={() => onDelete!(msg)}
                title="이 글 지우기"
                aria-label="이 글 지우기"
                className="rounded px-0.5 text-xs opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100 hover:bg-red-50 pointer-coarse:hidden cursor-pointer"
              >
                🗑️
              </button>
            )}
            {unseen && (
              <span data-chat-unseen className="font-black text-amber-500" title="상대가 아직 읽지 않았습니다">
                1
              </span>
            )}
            {time && <span data-chat-time>{chatTime(msg.at)}</span>}
          </span>
        </div>
      </div>
    </li>
  );
}
