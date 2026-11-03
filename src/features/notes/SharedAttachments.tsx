// 쪽지·대화 글의 첨부 보이기 (P16 쪽지 MailAttachments → P19-2 ■2 대화도 함께 - 메모 쓰는 칸 NotePanel의 첨부 줄과 같은 모양).
//   쓰는 칸은 ✕(빼기)까지, 받은 글은 보기만. 그림은 크게(누르면 크게 보기 - 이 글의 그림들을 넘겨 본다), 파일은 종류 그림 + 이름(누르면 새 탭).
//   주소는 보낸 사람 드라이브의 '링크가 있는 사람은 보기'(data/google/drive) - 받는 사람은 로그인 없이 본다.
//   점검 고르개는 kind로 'data-mail-attachment…'·'data-chat-attachment…'(inspect-mail·inspect-chat).
import { fileIcon, formatFileSize, isImageAttachment } from '../../domain/attachments';
import { attachmentImageSrc } from '../../data/google/drive';
import type { Attachment } from '../../data/types';
import { openImageViewer } from '../../ui/imageViewerStore';

interface Props {
  items: readonly Attachment[];
  onRemove?: (index: number) => void;
  /** data-* 이름 앞 (쪽지 'mail' · 대화 'chat') */
  kind?: 'mail' | 'chat';
}

export default function SharedAttachments({ items, onRemove, kind = 'mail' }: Props) {
  if (items.length === 0) return null;
  const d = (name: string, value: string | number = '') => ({ [`data-${kind}-${name}`]: value });
  const pics = items.filter(isImageAttachment);
  const view = (att: Attachment) =>
    openImageViewer(
      pics.map((a) => ({ url: attachmentImageSrc(a), name: a.name })),
      pics.indexOf(att),
    );
  const remove = (idx: number, what: string) =>
    onRemove && (
      <button
        type="button"
        {...d('attachment-remove')}
        onClick={() => onRemove(idx)}
        className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-bold cursor-pointer shrink-0"
        title={`${what} 빼기`}
        aria-label={`${what} 빼기`}
      >
        ✕
      </button>
    );
  return (
    <div {...d('attachments', items.length)} className="space-y-2">
      {items.map((att, idx) =>
        isImageAttachment(att) ? (
          <div key={`${att.url}-${idx}`} {...d('attachment', att.name)} {...d('attachment-image')} className="relative bg-slate-50 border border-slate-200 rounded-xl overflow-hidden">
            <button type="button" {...d('attachment-view')} onClick={() => view(att)} className="block w-full cursor-pointer" title="눌러서 크게 보기">
              <img src={attachmentImageSrc(att)} alt={att.name} className="w-full max-h-64 object-contain bg-white" loading="lazy" />
            </button>
            <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 border-t border-slate-200">
              <span className="text-xs text-slate-500 truncate" title={att.name}>
                🖼️ {att.name}
                {att.size ? ` · ${formatFileSize(att.size)}` : ''}
              </span>
              {remove(idx, '그림')}
            </div>
          </div>
        ) : (
          <div key={`${att.url}-${idx}`} {...d('attachment', att.name)} className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-xl gap-2 hover:bg-slate-100/80 transition-colors">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <span className="text-xl shrink-0" aria-hidden>
                {fileIcon(att)}
              </span>
              <div className="min-w-0 flex-1">
                <a href={att.url} target="_blank" rel="noreferrer" className="text-xs font-bold text-slate-800 hover:text-primary truncate block hover:underline" title={att.name}>
                  {att.name}
                </a>
                {att.size ? <span className="text-xs text-slate-400 block">{formatFileSize(att.size)}</span> : null}
              </div>
            </div>
            {remove(idx, '첨부')}
          </div>
        ),
      )}
    </div>
  );
}
