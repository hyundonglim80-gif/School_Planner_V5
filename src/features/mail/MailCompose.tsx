// ✏️ 쪽지 쓰기 (P15-2 ■2 - 쪽지 창 '쓰기' 탭). 그룹 고르기 → 구성원 칩 여럿(+ 모두) → 글 → **보내기 단추·Ctrl+Enter만**.
//   Ctrl+S·배경 누르기·↗ 새 창은 보내지 않는다(PLAN 5장 'P15 쓰기') - <form>·onSave를 쓰지 않는다. 쓰던 글은 이 기기에(useDraft 'mail:compose' -
//   닫기·↗·배경 누르기에도 남고 다시 열면 '되살리기', '저장하지 않은 글' 띠에는 넣지 않는다).
//   받는 사람은 보내기 직전 지금 구성원으로 다시 거른다(나간 사람이 하나라도 있으면 규칙이 묶음 전체를 막는다). 끊기면 '저장을 기다립니다' 띠(data/mail).
import { useEffect, useRef, useState } from 'react';
import { showToast, ShownError, showErrorToast } from '../../app/toast';
import { openWindow } from '../../app/windows';
import { useDraft } from '../../data/drafts';
import { sendMail } from '../../data/mail';
import { useCurrentSpaceId, useSession } from '../../data/session';
import { useMySpaces } from '../../data/spaceChoice';
import { readPeople } from '../../data/spaces';
import { MAIL_LIMITS, mailTextError, recipientsOf } from '../../domain/mail';
import DraftOffer from '../../ui/DraftOffer';

/** 쓰는 쪽지 (쓰던 글 보관에 이 모양 그대로) */
export interface Compose {
  sid: string;
  to: string[];
  text: string;
  /** 답장하는 받은 쪽지 id */
  replyTo: string | null;
  /** 답장하는 글 첫 줄 (보이기만) */
  quote: string;
}

/** 쓰기 탭을 이렇게 채워 연다 (답장 · 그룹 창 구성원 칩 ✉) - 열 때마다 새 객체 */
export type ComposeAsk = Partial<Pick<Compose, 'sid' | 'to' | 'replyTo' | 'quote'>>;

const EMPTY: Compose = { sid: '', to: [], text: '', replyTo: null, quote: '' };
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
  const [names, setNames] = useState<Record<string, string>>({});

  // 고른 그룹이 없거나 나간 그룹이면 - 지금 보는 그룹, 아니면 첫 그룹
  const sid = groups.some((g) => g.id === c.sid) ? c.sid : (groups.find((g) => g.id === current)?.id ?? groups[0]?.id ?? '');
  const group = groups.find((g) => g.id === sid);
  const members = group ? Object.keys(group.members).filter((id) => id !== uid) : [];
  const nameOf = (id: string) => names[id]?.trim() || '이름 없음';
  members.sort((a, b) => nameOf(a).localeCompare(nameOf(b), 'ko'));
  const picked = c.to.filter((id) => members.includes(id));

  const draft = useDraft<Compose>(uid ? DRAFT_KEY : null, c, c.text.trim() !== '');

  useEffect(() => {
    if (!sid) return;
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
  }, [sid]);

  // 답장·구성원 칩 ✉로 열면 그 사람에게 (쓰던 글이 있으면 묻는다 - 아니오면 쓰던 것 그대로)
  const applied = useRef<ComposeAsk | undefined>(undefined);
  useEffect(() => {
    if (!ask || applied.current === ask) return;
    applied.current = ask;
    if (c.text.trim() && !window.confirm('쓰던 쪽지가 있습니다. 지우고 새로 쓸까요?')) return;
    setC({ ...EMPTY, sid: ask.sid ?? c.sid, to: ask.to ?? [], replyTo: ask.replyTo ?? null, quote: ask.quote ?? '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 새로 열 때만
  }, [ask]);

  const set = (patch: Partial<Compose>) => setC((prev) => ({ ...prev, ...patch }));
  const toggle = (id: string) => set({ to: picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id] });
  const all = members.length > 0 && members.every((id) => picked.includes(id));

  const send = async () => {
    if (busy || !user || !group) return;
    const textError = mailTextError(c.text);
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
    <div data-mail-compose className="flex flex-col gap-3 p-4 text-sm">
      {draft.offer && <DraftOffer savedAt={draft.offer.savedAt} onRestore={() => setC(draft.take() ?? EMPTY)} onDiscard={draft.discard} />}
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
              onClick={() => set({ to: all ? [] : members.slice(0, MAIL_LIMITS.to) })}
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
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !e.nativeEvent.isComposing) {
            e.preventDefault();
            void send();
          }
        }}
        rows={7}
        placeholder="보낼 글 (학생 이름 등 개인정보는 줄여 써 주세요)"
        className="w-full resize-y rounded-xl border border-slate-200 px-3 py-2 text-sm leading-relaxed"
      />
      <div className="flex items-center gap-2">
        <span data-mail-count className={`text-2xs ${c.text.length > MAIL_LIMITS.text ? 'font-bold text-red-600' : 'text-slate-400'}`}>
          {c.text.length} / {MAIL_LIMITS.text}자
        </span>
        <span className="ml-auto" />
        <button
          type="button"
          data-mail-send
          disabled={busy || !group}
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
