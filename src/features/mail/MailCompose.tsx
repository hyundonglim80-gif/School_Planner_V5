// ✏️ 쪽지 쓰기 (P15-2 ■2 - 쪽지 창 '쓰기' 탭). 그룹 고르기 → 구성원 칩 여럿(+ 모두) → 글 → **보내기 단추·Ctrl+Enter만**.
//   Ctrl+S·배경 누르기·↗ 새 창은 보내지 않는다(PLAN 5장 'P15 쓰기') - <form>·onSave를 쓰지 않는다. 쓰던 글은 이 기기에(useDraft 'mail:compose' -
//   닫기·↗·배경 누르기에도 남고 다시 열면 '되살리기', '저장하지 않은 글' 띠에는 넣지 않는다).
//   받는 사람은 보내기 직전 지금 구성원으로 다시 거른다(나간 사람이 하나라도 있으면 규칙이 묶음 전체를 막는다). 끊기면 '저장을 기다립니다' 띠(data/mail).
//   첨부(P16 - 메모처럼): 📎 파일 첨부·윈도우 파일 끌어다 놓기(P21-1 - 쓰기 칸 어디든)·글 칸에 캡처 Ctrl+V = 내 구글 드라이브에 올려 붙임(notes/attach). 엑셀 표는 글자 그대로 붙는다(그림으로 올리지 않는다).
//   올리는 동안은 보내지 않는다. 첨부가 있으면 글은 비어도 된다. 쓰던 글 보관에 첨부도 함께(올린 것은 드라이브에 있다).
import { useEffect, useRef, useState, type ChangeEvent, type ClipboardEvent } from 'react';
import { showToast, ShownError, showErrorToast } from '../../app/toast';
import { openWindow } from '../../app/windows';
import { useDraft } from '../../data/drafts';
import { sendMail } from '../../data/mail';
import { useCurrentSpaceId, useSession } from '../../data/session';
import { useMySpaces } from '../../data/spaceChoice';
import { readPeople } from '../../data/spaces';
import type { Attachment } from '../../data/types';
import { MAIL_LIMITS, mailTextError, mailToAll, recipientsOf } from '../../domain/mail';
import DraftOffer from '../../ui/DraftOffer';
import FileDropCover from '../../ui/FileDropCover';
import { DROP_BUSY_TEXT, PASTE_BUSY_TEXT, useFileDrop } from '../../ui/fileDrop';
import { extractImageFiles, pastedTable, uploadAttachments } from '../notes/attach';
import SharedAttachments from '../notes/SharedAttachments';

/** 쓰는 쪽지 (쓰던 글 보관에 이 모양 그대로) */
export interface Compose {
  sid: string;
  to: string[];
  text: string;
  /** 답장하는 받은 쪽지 id */
  replyTo: string | null;
  /** 답장하는 글 첫 줄 (보이기만) */
  quote: string;
  /** 붙임 (내 드라이브에 올린 것) */
  attachments: Attachment[];
}

/** 쓰기 탭을 이렇게 채워 연다 (답장 · 그룹 창 구성원 칩 ✉) - 열 때마다 새 객체 */
export type ComposeAsk = Partial<Pick<Compose, 'sid' | 'to' | 'replyTo' | 'quote'>>;

const EMPTY: Compose = { sid: '', to: [], text: '', replyTo: null, quote: '', attachments: [] };
const DRAFT_KEY = 'mail:compose';

// 그룹마다 구성원 이름 - 탭을 바꿀 때마다 다시 읽지 않게(그룹을 고르면 새로 읽는다)
const peopleCache = new Map<string, Record<string, string>>();

export default function MailCompose({ ask, onSent }: { ask?: ComposeAsk; onSent: () => void }) {
  const user = useSession((s) => s.user);
  const uid = user?.uid ?? '';
  const { groups, loaded } = useMySpaces();
  const current = useCurrentSpaceId();
  const [c, setC] = useState<Compose>(EMPTY);
  const [busy, setBusy] = useState(false);
  /** 드라이브에 올리는 중 (📎 파일 / 붙여넣은 캡처) */
  const [uploading, setUploading] = useState<'files' | 'paste' | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});

  // 고른 그룹이 없거나 나간 그룹이면 - 지금 보는 그룹, 아니면 첫 그룹
  const sid = groups.some((g) => g.id === c.sid) ? c.sid : (groups.find((g) => g.id === current)?.id ?? groups[0]?.id ?? '');
  const group = groups.find((g) => g.id === sid);
  const members = group ? Object.keys(group.members).filter((id) => id !== uid) : [];
  const nameOf = (id: string) => names[id]?.trim() || '이름 없음';
  members.sort((a, b) => nameOf(a).localeCompare(nameOf(b), 'ko'));
  const picked = c.to.filter((id) => members.includes(id));

  const hasContent = c.text.trim() !== '' || c.attachments.length > 0;
  const draft = useDraft<Compose>(uid ? DRAFT_KEY : null, c, hasContent);

  useEffect(() => {
    // 기억한 그룹(서버 답 전)은 묻지 않는다 - 끊긴 채 읽은 빈 이름을 이어진 뒤에도 쓰게 된다
    if (!sid || !loaded) return;
    let alive = true;
    setNames(peopleCache.get(sid) ?? {});
    readPeople(sid)
      .then((p) => {
        const m = Object.fromEntries(Object.entries(p).map(([id, x]) => [id, x.name]));
        peopleCache.set(sid, m);
        if (alive) setNames(m);
      })
      .catch((e) => console.warn('[mail] 구성원 이름을 받지 못했습니다.', e));
    return () => {
      alive = false;
    };
  }, [sid, loaded]);

  // 답장·구성원 칩 ✉로 열면 그 사람에게 (쓰던 글이 있으면 묻는다 - 아니오면 쓰던 것 그대로)
  const applied = useRef<ComposeAsk | undefined>(undefined);
  useEffect(() => {
    if (!ask || applied.current === ask) return;
    applied.current = ask;
    if (hasContent && !window.confirm('쓰던 쪽지가 있습니다. 지우고 새로 쓸까요?')) return;
    setC({ ...EMPTY, sid: ask.sid ?? c.sid, to: ask.to ?? [], replyTo: ask.replyTo ?? null, quote: ask.quote ?? '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 새로 열 때만
  }, [ask]);

  const set = (patch: Partial<Compose>) => setC((prev) => ({ ...prev, ...patch }));
  const toggle = (id: string) => set({ to: picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id] });
  // '모두' = 한 번에 보낼 수 있는 만큼 - 넘으면 빠진 수를 알린다 (다시 누르면 풀린다)
  const everyone = mailToAll(members);
  const all = everyone.to.length > 0 && everyone.to.every((id) => picked.includes(id));
  const toggleAll = () => {
    set({ to: all ? [] : everyone.to });
    if (!all && everyone.cut > 0) showToast(`한 번에 ${MAIL_LIMITS.to}명까지 보낼 수 있어 ${everyone.cut}명은 고르지 않았습니다. 그 선생님께는 따로 보내 주세요.`, 5000);
  };

  // ─── 붙이기 (notes/attach - 메모와 같은 길) ───
  const attach = async (files: File[], pasted: boolean) => {
    if (files.length === 0 || uploading) return;
    setUploading(pasted ? 'paste' : 'files');
    try {
      const added = await uploadAttachments(files, pasted);
      if (added.length > 0) setC((prev) => ({ ...prev, attachments: [...prev.attachments, ...added] }));
    } finally {
      setUploading(null);
    }
  };
  const onPickFiles = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = '';
    void attach(files, false);
  };
  const fileDrop = useFileDrop((files) => {
    if (uploading) showToast(DROP_BUSY_TEXT);
    else void attach(files, false);
  });
  /** 캡처 그림만 올린다 - 표(엑셀은 그 범위 그림도 함께 복사한다)·글자는 그대로 글 칸에 */
  const onTextPaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    if (pastedTable(e.clipboardData)) return;
    const images = extractImageFiles(e.clipboardData);
    if (images.length === 0) return;
    e.preventDefault();
    if (uploading) showToast(PASTE_BUSY_TEXT);
    else void attach(images, true);
  };

  const send = async () => {
    if (busy || !user || !group) return;
    if (uploading) {
      showToast('파일을 올리는 중입니다. 끝난 뒤 보내 주세요.');
      return;
    }
    const textError = mailTextError(c.text, c.attachments.length);
    if (textError) {
      showToast(textError);
      return;
    }
    // 보내기 직전 지금 구성원으로 (창을 연 사이에 나간 사람)
    const { to, gone } = recipientsOf(c.to, uid, group.members);
    if (gone.length) {
      set({ to });
      showToast(`그룹을 나간 선생님 ${gone.length}명을 받는 사람에서 뺐습니다. 확인하고 다시 보내 주세요.`, 4000);
      return;
    }
    if (to.length === 0) {
      showToast('받는 사람을 골라 주세요.');
      return;
    }
    if (to.length > MAIL_LIMITS.to) {
      showToast(`한 번에 ${MAIL_LIMITS.to}명까지 보낼 수 있습니다.`);
      return;
    }
    setBusy(true);
    try {
      await sendMail({
        from: uid,
        fromName: names[uid]?.trim() || user.displayName || user.email || '선생님',
        sid: group.id,
        groupName: group.name || '공유 그룹',
        to,
        names: Object.fromEntries(to.map((id) => [id, nameOf(id)])),
        text: c.text,
        replyTo: c.replyTo,
        attachments: c.attachments,
      });
      draft.clear();
      setC({ ...EMPTY, sid: group.id });
      showToast(`✉ 쪽지를 보냈습니다 (${to.length}명).`);
      onSent();
    } catch (e) {
      // 안내는 sendMail이 (failWithToast) - 글은 그대로 둔다
      if (!(e instanceof ShownError)) showErrorToast('쪽지를 보내지 못했습니다.', e);
    } finally {
      setBusy(false);
    }
  };

  if (loaded && groups.length === 0) {
    return (
      <div data-mail-no-group className="flex flex-col items-center gap-2 px-4 py-8 text-center text-xs text-slate-500">
        <p>그룹에 들어가면 같은 그룹 선생님에게 쪽지를 보낼 수 있습니다.</p>
        <button type="button" onClick={() => openWindow('group')} className="rounded-lg border border-slate-300 px-2.5 py-1 font-bold hover:bg-slate-50 cursor-pointer">
          👥 공유 그룹
        </button>
      </div>
    );
  }

  return (
    <div data-mail-compose className="relative flex flex-1 flex-col gap-3 p-4 text-sm" {...fileDrop.dropProps}>
      {fileDrop.over && <FileDropCover />}
      {/* 첨부가 생기기 전(P15)의 보관에는 attachments가 없다 */}
      {draft.offer && <DraftOffer savedAt={draft.offer.savedAt} onRestore={() => setC({ ...EMPTY, ...draft.take() })} onDiscard={draft.discard} />}
      <label className="flex items-center gap-2 text-xs font-bold text-slate-500">
        그룹
        <select
          data-mail-group={sid}
          value={sid}
          onChange={(e) => set({ sid: e.target.value, to: [], replyTo: null, quote: '' })}
          className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm font-semibold text-slate-800"
        >
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              👥 {g.name || '공유 그룹'}
            </option>
          ))}
        </select>
      </label>
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-bold text-slate-500">받는 사람 {picked.length > 0 && <b className="text-primary">{picked.length}명</b>}</span>
        {members.length === 0 ? (
          <p data-mail-no-members className="text-xs text-slate-400">
            이 그룹에는 아직 다른 선생님이 없습니다. 공유 그룹 창의 초대 코드를 보내 주세요.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              data-mail-to-all
              aria-pressed={all}
              onClick={toggleAll}
              className={`rounded-full border px-2.5 py-1 text-xs font-bold cursor-pointer ${all ? 'border-primary bg-primary text-white' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}
            >
              모두
            </button>
            {members.map((id) => {
              const on = picked.includes(id);
              return (
                <button
                  key={id}
                  type="button"
                  data-mail-to={id}
                  aria-pressed={on}
                  onClick={() => toggle(id)}
                  className={`rounded-full border px-2.5 py-1 text-xs font-bold cursor-pointer ${on ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                >
                  {on ? '✓ ' : ''}
                  {nameOf(id)}
                </button>
              );
            })}
          </div>
        )}
      </div>
      {c.replyTo && (
        <p data-mail-reply-to={c.replyTo} className="flex items-center gap-1 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs text-slate-500">
          <span className="min-w-0 flex-1 truncate">↩ 답장: 「{c.quote}」</span>
          <button type="button" onClick={() => set({ replyTo: null, quote: '' })} title="답장 표시 떼기" aria-label="답장 표시 떼기" className="shrink-0 px-1 font-bold hover:text-slate-800 cursor-pointer">
            ×
          </button>
        </p>
      )}
      <textarea
        data-mail-text-input
        value={c.text}
        onChange={(e) => set({ text: e.target.value })}
        onPaste={onTextPaste}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !e.nativeEvent.isComposing) {
            e.preventDefault();
            void send();
          }
        }}
        rows={7}
        placeholder="보낼 글 (학생 이름 등 개인정보는 줄여 써 주세요) - 캡처한 그림은 여기에 Ctrl+V"
        className="w-full resize-y rounded-xl border border-slate-200 px-3 py-2 text-sm leading-relaxed"
      />
      {/* 첨부 (드라이브 School_Planner 폴더 - 메모 쓰는 칸과 같게) */}
      <div className="space-y-2">
        <label
          data-mail-attach
          aria-disabled={!!uploading}
          className={`flex items-center justify-center gap-2 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition-colors border border-dashed border-slate-300 shadow-2xs ${
            uploading ? 'opacity-60 cursor-wait' : 'cursor-pointer'
          }`}
          title="파일을 골라 구글 드라이브(School_Planner 폴더)에 올려 붙입니다. 여러 개를 한 번에 골라도 되고, 윈도우 파일을 이 칸에 끌어다 놓아도 됩니다. 링크가 있는 사람은 볼 수 있습니다."
        >
          <span>{uploading === 'files' ? '⏳' : '📎'}</span>
          <span data-mail-uploading={uploading === 'files' ? 'files' : undefined}>{uploading === 'files' ? '업로드 중...' : `파일 첨부${c.attachments.length ? ` (${c.attachments.length}개)` : ''}`}</span>
          <input type="file" multiple data-mail-file-input onChange={onPickFiles} className="hidden" disabled={!!uploading} />
        </label>
        {uploading === 'paste' && (
          <p data-mail-uploading="paste" className="text-xs font-bold text-primary">
            ⏳ 붙여넣은 이미지 업로드 중...
          </p>
        )}
        <SharedAttachments items={c.attachments} onRemove={(idx) => set({ attachments: c.attachments.filter((_, i) => i !== idx) })} />
        {/* 드라이브 첨부는 '링크가 있는 사람은 보기'로 올린다(drive.ts - 메모와 같은 안내) */}
        <p data-mail-attach-public className="text-2xs text-slate-400">
          📎 올린 파일은 내 구글 드라이브에 남고 &apos;링크가 있는 사람은 보기&apos;로 열립니다. 학생 얼굴·성적처럼 퍼지면 안 되는 것은 올리지 마세요.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <span data-mail-count className={`text-2xs ${c.text.length > MAIL_LIMITS.text ? 'font-bold text-red-600' : 'text-slate-400'}`}>
          {c.text.length} / {MAIL_LIMITS.text}자
        </span>
        <span className="ml-auto" />
        <button
          type="button"
          data-mail-send
          disabled={busy || !group || !!uploading}
          onClick={() => void send()}
          title="보내기 (글 칸에서 Ctrl + Enter)"
          className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white hover:bg-primary/90 disabled:opacity-50 cursor-pointer"
        >
          {busy ? '보내는 중…' : '✉ 보내기'}
        </button>
      </div>
    </div>
  );
}
