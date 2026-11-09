// 💬 대화 방 아래 글 칸 (P19-2 ■2 - PLAN 5장 'P19 Enter = 보내기'). 📎 · 글 칸(1~6줄로 늘어난다) · ➤.
//   - PC: Enter = 보내기, Shift + Enter = 줄 바꿈(Ctrl + Enter도 보내기). 휴대폰 화면 자판(pointer: coarse)의 Enter = 줄 바꿈, ➤로 보낸다.
//     한글을 짜는 중의 Enter(isComposing)는 보내지 않는다 - 보낼 글은 그 순간의 글 칸 값으로(상태는 한 박자 늦을 수 있다).
//   - Ctrl+S·배경 누르기·↗ 새 창은 보내지 않는다(쪽지와 같다 - <form>·onSave를 쓰지 않는다).
//   - 보내면 글 칸을 곧바로 비운다(글은 방에 '보내는 중…'으로 먼저 보인다). 보내지 못하면 글·첨부를 칸에 되돌린다(그 사이에 새로 쓴 것은 뒤에).
//     서버가 받을 때까지는 unsent가 이 기기에 따로 남긴다 - 끊긴 채 보내고 앱을 닫아도 다음에 칸으로 돌아온다(P22-5 ■1).
//   - 쓰던 글은 이 기기에(useDraft 'chat:<방 키>' - 앱 위 '저장하지 않은 글' 띠에는 들지 않는다). 방을 다시 열면 묻지 않고 칸에 채운다(메신저처럼).
//   - 메모 요청 글 칸(P23 - notes/ClaudeFollowBox)도 이 칸이다: 열쇠·길이·안내를 바꾸고(draftKey·maxText·label·hint) 첨부를 끈다(noAttach - 공개 이슈로 올라간다).
//     hold = 쓰기는 되고 보내기만 막는다(앞 요청이 도는 동안) - disabled는 글 칸째 막는다.
//   - 📎 파일·방에 끌어다 놓기(P21-1 - 방이 받아 ref의 attach로 건넨다)·글 칸에 캡처 Ctrl+V = 내 구글 드라이브에 올려 붙임(notes/attach - 쪽지·메모와 같은 길). 올리는 동안은 보내지 않는다. 첨부가 있으면 글은 비어도 된다.
import { useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type ChangeEvent, type ClipboardEvent, type KeyboardEvent, type ReactNode, type Ref } from 'react';
import { showToast } from '../../app/toast';
import { useDraft } from '../../data/drafts';
import { useSession } from '../../data/session';
import type { Attachment } from '../../data/types';
import { CHAT_LIMITS, chatTextError } from '../../domain/chat';
import { isImageAttachment } from '../../domain/attachments';
import { DROP_BUSY_TEXT, PASTE_BUSY_TEXT } from '../../ui/fileDrop';
import { extractImageFiles, pastedTable, uploadAttachments } from '../notes/attach';
import { holdUnsent, takeUnsent } from './unsent';

interface ChatDraft {
  text: string;
  attachments: Attachment[];
}

/** 글 칸이 늘어나는 가장 큰 높이(px) - 넘으면 칸 안에서 스크롤 */
const MAX_INPUT_PX = 160;

/** 휴대폰 화면 자판 - Enter = 줄 바꿈, ➤로 보낸다 */
const touchScreen = () => typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;

/** 글 여럿을 줄을 바꿔 잇는다 (빈 글은 뺀다) */
const joinText = (...parts: string[]) => parts.filter((p) => p.trim()).join('\n');

/** 방에 놓은 파일을 건네받는다 */
export interface ChatComposerHandle {
  attach: (files: File[]) => void;
  /** 글을 칸에 넣는다 (쓰던 글이 있으면 뒤에 잇는다) */
  fill: (text: string) => void;
}

interface Props {
  ref?: Ref<ChatComposerHandle>;
  roomKey: string;
  /** 보낸다 - 보냈으면 true. 보내지 못한 안내는 부르는 쪽이 한다 */
  onSend: (text: string, attachments: Attachment[]) => Promise<boolean>;
  /** 글 칸 위에 띄울 것 ('↓ 새 글' 단추) */
  above?: ReactNode;
  disabled?: boolean;
  /** 쓰던 글 열쇠 (기본 'chat:<방 키>') */
  draftKey?: string;
  /** 첨부를 받지 않는다 - 📎를 숨기고 캡처 Ctrl+V는 안내만 */
  noAttach?: boolean;
  /** 글 길이 한도 */
  maxText?: number;
  /** 글 칸 안내의 앞말 */
  label?: string;
  /** 쓰기는 되고 보내기만 막는다 - 까닭 글 (칸 아래에 보이고, 보내려 하면 알린다) */
  hold?: string | null;
  /** 글 칸 아래 안내 */
  hint?: string;
  /** 안내 줄 오른쪽에 둘 것 (메모 요청의 모델·노력 고르기 - 11-08) */
  footer?: ReactNode;
}

export default function ChatComposer({ ref, roomKey, onSend, above, disabled, draftKey, noAttach, maxText = CHAT_LIMITS.text, label = '글', hold, hint, footer }: Props) {
  const [text, setText] = useState('');
  const [files, setFiles] = useState<Attachment[]>([]);
  /** 드라이브에 올리는 중 (📎 파일 / 붙여넣은 캡처) */
  const [uploading, setUploading] = useState<'files' | 'paste' | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  const uid = useSession((s) => s.user?.uid ?? null);
  const key = draftKey ?? `chat:${roomKey}`;
  const hasContent = text.trim() !== '' || files.length > 0;
  const draft = useDraft<ChatDraft>(key, { text, attachments: files }, hasContent);
  // 쓰던 글이 남아 있으면 곧바로 칸에 (묻지 않는다 - 보내기 전까지 보관은 그대로). 칸에 이미 있는 글 뒤에 잇는다
  useEffect(() => {
    if (!draft.offer) return;
    const v = draft.take();
    if (!v) return;
    const kept = typeof v.text === 'string' ? v.text : '';
    setText((cur) => joinText(cur, kept));
    if (Array.isArray(v.attachments)) setFiles((cur) => [...cur, ...v.attachments]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 남은 글을 찾았을 때만
  }, [draft.offer]);
  // 지난번에 서버가 받지 못한 글도 칸에 (unsent - 끊긴 채 보내고 앱을 닫았다). 쓰던 글보다 앞에
  useEffect(() => {
    if (!uid) return;
    let alive = true;
    void takeUnsent(uid, key, () => alive).then((list) => {
      if (list.length === 0) return;
      setText((cur) => joinText(...list.map((l) => l.text), cur));
      setFiles((cur) => [...list.flatMap((l) => l.attachments), ...cur]);
    });
    return () => {
      alive = false;
    };
  }, [uid, key]);
  /** 칸이 닫혔다 - 그 뒤 서버가 막은 글은 되돌릴 칸이 없어 보관에 둔다 */
  const closed = useRef(false);
  useEffect(() => {
    closed.current = false;
    return () => {
      closed.current = true;
    };
  }, []);
  // 글을 손으로 다 지우면 보관도 지운다 (안 그러면 다음에 열 때 지운 글이 다시 채워진다)
  const hadContent = useRef(false);
  useEffect(() => {
    if (hasContent) hadContent.current = true;
    else if (hadContent.current) {
      hadContent.current = false;
      draft.clear();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 글이 생기고 없어질 때만
  }, [hasContent]);

  // 글 줄 수만큼 칸을 늘린다 (6줄쯤까지)
  useLayoutEffect(() => {
    const el = input.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_INPUT_PX)}px`;
  }, [text]);

  // ─── 붙이기 (notes/attach - 쪽지·메모와 같은 길) ───
  const attach = async (picked: File[], pasted: boolean) => {
    if (picked.length === 0 || uploading) return;
    setUploading(pasted ? 'paste' : 'files');
    try {
      const added = await uploadAttachments(picked, pasted);
      if (added.length === 0) return;
      // 올리는 동안 방을 떠났다 - 붙일 칸이 없으니 남겨 두고 다음에 열면 칸에
      if (closed.current) {
        if (uid) holdUnsent(uid, key, { text: '', attachments: added })(true);
        showToast('📎 올린 첨부는 그 방을 다시 열면 글 칸에 있습니다.', 4000);
      } else setFiles((prev) => [...prev, ...added]);
    } finally {
      setUploading(null);
    }
  };
  const onPickFiles = (e: ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = '';
    void attach(picked, false);
  };
  useImperativeHandle(ref, () => ({
    attach: (picked) => {
      if (uploading) showToast(DROP_BUSY_TEXT);
      else void attach(picked, false);
    },
    fill: (t) => {
      setText((cur) => (cur.trim() ? `${cur.trimEnd()}\n${t}` : t));
      input.current?.focus();
    },
  }));
  /** 캡처 그림만 올린다 - 표(엑셀은 그 범위 그림도 함께 복사한다)·글자는 그대로 글 칸에 */
  const onPaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    if (pastedTable(e.clipboardData)) return;
    const images = extractImageFiles(e.clipboardData);
    if (images.length === 0) return;
    e.preventDefault();
    if (noAttach) showToast('이 칸에는 그림을 붙일 수 없습니다. 글로 적어 주세요.', 4000);
    else if (uploading) showToast(PASTE_BUSY_TEXT);
    else void attach(images, true);
  };

  const send = async () => {
    if (disabled) return;
    const t = input.current?.value ?? text;
    if (!t.trim() && files.length === 0) return;
    if (hold) {
      showToast(hold);
      return;
    }
    if (uploading) {
      showToast('파일을 올리는 중입니다. 끝난 뒤 보내 주세요.');
      return;
    }
    const error = chatTextError(t, files.length, maxText);
    if (error) {
      showToast(error, 4000);
      return;
    }
    const sent = files;
    setText('');
    setFiles([]);
    draft.clear();
    input.current?.focus();
    // 서버가 받을 때까지 따로 남긴다 - 끊긴 동안 보낸 글은 앱을 닫으면 사라진다
    const release = uid ? holdUnsent(uid, key, { text: t, attachments: sent }) : null;
    const ok = await onSend(t, sent);
    release?.(!ok && closed.current);
    if (ok) return;
    // 보내지 못함 - 글을 칸에 되돌린다 (그 사이에 새로 쓴 것은 뒤에 둔다)
    setText((cur) => joinText(t, cur));
    setFiles((cur) => [...sent, ...cur]);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter' || e.nativeEvent.isComposing || e.keyCode === 229) return;
    if (e.shiftKey || e.altKey) return;
    // 휴대폰 화면 자판의 Enter는 줄 바꿈 (Ctrl + Enter는 어디서나 보내기)
    if (!e.ctrlKey && !e.metaKey && touchScreen()) return;
    e.preventDefault();
    void send();
  };

  const remove = (idx: number) => setFiles((prev) => prev.filter((_, i) => i !== idx));

  return (
    <div data-chat-composer className="sticky bottom-0 z-10 border-t border-slate-100 bg-white px-3 py-2">
      {above && <div className="absolute -top-11 left-1/2 -translate-x-1/2">{above}</div>}
      {files.length > 0 && (
        <ul data-chat-files={files.length} className="mb-1.5 flex flex-wrap gap-1.5">
          {files.map((f, i) => (
            <li key={`${f.url}-${i}`} data-chat-file={f.name} className="flex max-w-full items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 py-0.5 pl-2 pr-0.5 text-xs text-slate-600">
              <span className="min-w-0 truncate" title={f.name}>
                {isImageAttachment(f) ? '🖼️' : '📎'} {f.name}
              </span>
              <button
                type="button"
                data-chat-file-remove
                onClick={() => remove(i)}
                title="첨부 빼기"
                aria-label="첨부 빼기"
                className="h-5 w-5 shrink-0 rounded font-bold text-slate-400 hover:bg-rose-50 hover:text-rose-600 cursor-pointer"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      {uploading && (
        <p data-chat-uploading={uploading} className="mb-1 text-xs font-bold text-primary">
          ⏳ {uploading === 'paste' ? '붙여넣은 그림을 올리는 중…' : '파일을 올리는 중…'}
        </p>
      )}
      <div className="flex items-end gap-1.5">
        {!noAttach && (
          <label
            data-chat-attach
            aria-disabled={!!uploading}
            title="파일 첨부 - 구글 드라이브(School_Planner 폴더)에 올려 붙입니다. 링크가 있는 사람은 볼 수 있습니다. 윈도우 파일은 방에 끌어다 놓아도 되고, 캡처는 글 칸에 Ctrl+V."
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-lg hover:bg-slate-100 ${uploading ? 'opacity-50 cursor-wait' : 'cursor-pointer'}`}
          >
            📎
            <input type="file" multiple data-chat-file-input onChange={onPickFiles} className="hidden" disabled={!!uploading} />
          </label>
        )}
        <textarea
          ref={input}
          data-chat-input
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onPaste={onPaste}
          onKeyDown={onKeyDown}
          disabled={disabled}
          placeholder={touchScreen() ? `${label} (➤로 보내기)` : `${label} (Enter 보내기 · Shift + Enter 줄 바꿈)`}
          className="min-h-9 min-w-0 flex-1 resize-none rounded-xl border border-slate-200 px-3 py-1.5 text-sm leading-relaxed disabled:bg-slate-50"
        />
        <button
          type="button"
          data-chat-send
          disabled={disabled || !!hold || !!uploading || !hasContent}
          // 누를 때 글 칸이 커서를 잃지 않게 (휴대폰 자판이 닫히지 않게)
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => void send()}
          title={hold || '보내기 (Enter)'}
          aria-label="보내기"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-40 cursor-pointer"
        >
          ➤
        </button>
      </div>
      {text.length > maxText - 200 && (
        <p data-chat-count className={`mt-1 text-right text-2xs ${text.length > maxText ? 'font-bold text-red-600' : 'text-slate-400'}`}>
          {text.length} / {maxText}자
        </p>
      )}
      {hold && (
        <p data-chat-hold className="mt-1 text-2xs font-bold text-violet-700">
          {hold}
        </p>
      )}
      {(hint || footer) && (
        <div className="mt-1 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
          {hint && (
            <p data-chat-hint className="text-2xs text-slate-400">
              {hint}
            </p>
          )}
          {footer}
        </div>
      )}
    </div>
  );
}
