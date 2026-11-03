// ✉ 쪽지 창 (P15-2 ■1·■2 - PLAN 6장 P15 '화면'). 오른쪽 칸 창 'mail' - 탭: 📥 받은 쪽지 · 📤 보낸 쪽지 · ✏️ 쓰기(MailCompose).
//   목록은 창을 열 때 서버에서 30개씩(기기 사본·백업 없음 - data/mail), 끊긴 채 비어 보이면 '인터넷이 필요합니다'.
//   안 읽은 쪽지는 굵게·점 - 펼치면 읽음. 지우기 = 바로 숨기고 7초 '되돌리기'(features/mail/actions).
//   창이 열린 동안 새 쪽지가 오면(머리줄 안 읽은 수가 늘면) 첫 쪽을 다시 받아 위에 더한다. 보내면 보낸 쪽지 탭으로(첫 쪽을 다시).
//   ↩ 답장 = 쓰기 탭에 그 사람·그 그룹 - 나와 그 사람이 지금 그 그룹 구성원일 때만(규칙이 막는다).
//   첨부(P16): 접힌 줄은 📎 n(글이 없으면 '🖼️ 그림 n'), 펼치면 글 아래 그림·파일(notes/SharedAttachments).
//   💬 대화로(P19-2 ■3) = 받은 쪽지의 보낸 사람과 1:1 대화(그 쪽지의 그룹을 연 곳으로).
import { useEffect, useRef, useState } from 'react';
import type { QueryDocumentSnapshot } from 'firebase/firestore';
import type { WindowProps } from '../../app/windows';
import { showToast } from '../../app/toast';
import { loadInbox, loadSent, markRead } from '../../data/mail';
import { useMailStore } from '../../data/mailStore';
import { useSession } from '../../data/session';
import { useMySpaces } from '../../data/spaceChoice';
import { mailFilesLabel, mailPreview, mailWhen, replyQuote, unreadLabel, type MailBox, type MailIn, type MailSent } from '../../domain/mail';
import ModalShell, { ModalCloseButton } from '../../ui/ModalShell';
import { removeMail, useHiddenMail } from './actions';
import SharedAttachments from '../notes/SharedAttachments';
import MailCompose, { type ComposeAsk } from './MailCompose';
import type { MailParams, MailTabId } from './open';
import { useTabTarget } from '../../app/keys';
import { dmPairId } from '../../domain/chat';
import { openChat } from '../chat/open';

type Item = MailIn | MailSent;
const isIn = (m: Item): m is MailIn => 'from' in m;

interface Page {
  items: Item[];
  cursor: QueryDocumentSnapshot | null;
  offline: boolean;
}

const fetchPage = (uid: string, box: MailBox, after: QueryDocumentSnapshot | null): Promise<Page> =>
  box === 'in' ? loadInbox(uid, after) : loadSent(uid, after);

/** 앞에 없던 것만 잇는다 (같은 쪽지를 두 번 받지 않게) */
const merge = (a: Item[], b: Item[]) => [...a, ...b.filter((x) => !a.some((y) => y.id === x.id))];

interface RowProps {
  m: Item;
  now: number;
  open: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onReply?: (m: MailIn) => void;
  /** 💬 대화로 - 보낸 사람과 1:1 (받은 쪽지만) */
  onChat?: (m: MailIn) => void;
}

function MailRow({ m, now, open, onToggle, onDelete, onReply, onChat }: RowProps) {
  const inbox = isIn(m);
  const unread = inbox && m.readAt === null;
  const who = inbox ? m.fromName : `→ ${m.toNames || '받는 사람 없음'}`;
  return (
    <li
      data-mail-row={m.id}
      {...(inbox ? { 'data-mail-read': unread ? 'no' : 'yes' } : {})}
      className={`rounded-xl border ${open ? 'border-primary/40 bg-primary/5' : 'border-slate-200 bg-white'}`}
    >
      <button type="button" data-mail-open={m.id} aria-expanded={open} onClick={onToggle} className="flex w-full items-start gap-2 px-3 py-2 text-left cursor-pointer">
        <span aria-hidden className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${unread ? 'bg-primary' : 'bg-transparent'}`} />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-1.5">
            <span className={`truncate text-sm ${unread ? 'font-black text-slate-900' : 'font-semibold text-slate-700'}`}>{who}</span>
            {m.groupName && <span className="shrink-0 truncate text-2xs text-slate-400">👥 {m.groupName}</span>}
            {m.attachments.length > 0 && (
              <span data-mail-files={m.attachments.length} title={mailFilesLabel(m.attachments)} className="shrink-0 text-2xs text-slate-500">
                📎 {m.attachments.length}
              </span>
            )}
            <span className="ml-auto shrink-0 text-2xs text-slate-400">{mailWhen(m.at, now)}</span>
          </span>
          {!open && <span className={`block truncate text-xs ${unread ? 'font-bold text-slate-800' : 'text-slate-500'}`}>{mailPreview(m.text, m.attachments)}</span>}
        </span>
      </button>
      {open && (
        <div data-mail-body className="space-y-2 px-3 pb-3 pl-7">
          {m.text && (
            <p data-mail-text className="whitespace-pre-wrap break-words text-sm text-slate-800">
              {m.text}
            </p>
          )}
          <SharedAttachments items={m.attachments} />
          <p className="text-2xs text-slate-400">받는 사람 {m.toNames}</p>
          <div className="flex justify-end gap-1">
            {inbox && onReply && (
              <button type="button" data-mail-reply={m.id} onClick={() => onReply(m)} className="rounded-lg px-2 py-1 text-xs font-bold text-primary hover:bg-primary/10 cursor-pointer">
                ↩ 답장
              </button>
            )}
            {inbox && onChat && (
              <button type="button" data-mail-chat={m.id} onClick={() => onChat(m)} className="rounded-lg px-2 py-1 text-xs font-bold text-primary hover:bg-primary/10 cursor-pointer">
                💬 대화로
              </button>
            )}
            <button type="button" data-mail-delete={m.id} onClick={onDelete} className="rounded-lg px-2 py-1 text-xs font-bold text-slate-500 hover:bg-red-50 hover:text-red-600 cursor-pointer">
              🗑️ 지우기
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

interface ListProps {
  box: MailBox;
  active: boolean;
  focus?: { id: string };
  /** 늘면 첫 쪽을 다시 받는다 (보낸 뒤 - 보낸 쪽지) */
  bump?: number;
  onReply?: (m: MailIn) => void;
}

function MailList({ box, active, focus, bump = 0, onReply }: ListProps) {
  const uid = useSession((s) => s.user?.uid ?? null);
  const hidden = useHiddenMail((s) => s.ids);
  const unread = useMailStore((s) => s.unread);
  const [page, setPage] = useState<Page | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const seq = useRef(0);
  // 줄의 시각을 '오늘'과 견줄 때 (창을 연 때 - 그리는 사이에 바뀌지 않게)
  const [now] = useState(() => Date.now());
  const focused = useRef<{ id: string } | undefined>(undefined);

  const load = async (more: boolean) => {
    if (!uid) return;
    const my = ++seq.current;
    setBusy(true);
    setFailed(false);
    try {
      const p = await fetchPage(uid, box, more ? (page?.cursor ?? null) : null);
      if (my !== seq.current) return;
      setPage((prev) => (more && prev ? { ...p, items: merge(prev.items, p.items) } : p));
    } catch (e) {
      if (my !== seq.current) return;
      console.warn('[mail] 쪽지를 받지 못했습니다.', e);
      setFailed(true);
    } finally {
      if (my === seq.current) setBusy(false);
    }
  };

  // 처음 보일 때 · 계정이 바뀌면 다시 (창 목록은 로그아웃에도 남는다 - 앞 계정 것을 보이지 않게)
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  if (loadedFor !== null && loadedFor !== uid) {
    setLoadedFor(null);
    setPage(null);
    setOpen(null);
  }
  useEffect(() => {
    if (!active || !uid || loadedFor === uid) return;
    setLoadedFor(uid);
    void load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load는 그릴 때마다 새로 - 처음 보일 때·계정이 바뀔 때만
  }, [active, uid, loadedFor]);

  // 첫 쪽을 다시 받아 위에 더한다 - 새 쪽지가 왔을 때(안 읽은 수가 늘면)·푸시로 연 쪽지가 목록에 없을 때
  const refreshTop = () => {
    if (!uid) return;
    const my = ++seq.current;
    fetchPage(uid, box, null)
      .then((p) => {
        if (my !== seq.current) return;
        setPage((prev) => (prev && prev.items.length ? { ...prev, items: merge(p.items, prev.items) } : p));
      })
      .catch((e) => console.warn('[mail] 새 쪽지를 받지 못했습니다.', e));
  };
  const lastUnread = useRef(unread);
  useEffect(() => {
    const was = lastUnread.current;
    lastUnread.current = unread;
    if (box === 'in' && page && unread > was) refreshTop();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 수가 늘 때만
  }, [unread]);
  useEffect(() => {
    if (bump && page) refreshTop();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 보낸 뒤만
  }, [bump]);

  const toggle = (m: Item) => {
    if (open === m.id) {
      setOpen(null);
      return;
    }
    setOpen(m.id);
    // 펼치면 읽음 (화면은 곧바로 - 서버는 실패해도 다음에 펼치면 다시)
    if (uid && isIn(m) && m.readAt === null) {
      setPage((prev) => prev && { ...prev, items: prev.items.map((x) => (x.id === m.id ? { ...x, readAt: Date.now() } : x)) });
      void markRead(uid, m.id);
    }
  };

  // 푸시 알림으로 연 쪽지를 펼친다 (받은 뒤 한 번 - 같은 쪽지로 다시 열어도 새 focus 객체)
  //   목록에 없으면 첫 쪽을 한 번 다시 받는다(창이 열린 채 푸시가 왔을 때)
  const retried = useRef<{ id: string } | undefined>(undefined);
  useEffect(() => {
    if (!focus || !page || focused.current === focus) return;
    const m = page.items.find((x) => x.id === focus.id);
    if (!m && retried.current !== focus) {
      retried.current = focus;
      refreshTop();
      return;
    }
    focused.current = focus;
    if (m && open !== m.id) toggle(m);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 받은 뒤·새로 열 때만
  }, [focus, page]);

  const items = page?.items.filter((m) => !hidden.has(m.id)) ?? null;
  const empty = box === 'in' ? '받은 쪽지가 없습니다.' : '보낸 쪽지가 없습니다.';

  return (
    <div className="flex flex-col gap-2 p-4">
      {!uid ? (
        <p className="py-6 text-center text-xs text-slate-400">로그인하면 쪽지를 볼 수 있습니다.</p>
      ) : failed ? (
        <div data-mail-failed className="flex flex-col items-center gap-2 py-6 text-xs text-slate-500">
          <p>쪽지를 받지 못했습니다. 인터넷 연결을 확인해 주세요.</p>
          <button type="button" data-mail-retry onClick={() => void load(false)} className="rounded-lg border border-slate-300 px-2.5 py-1 font-bold hover:bg-slate-50 cursor-pointer">
            다시 받기
          </button>
        </div>
      ) : items === null ? (
        <p className="py-6 text-center text-xs text-slate-400">불러오는 중…</p>
      ) : (
        <>
          {page?.offline && (
            <div data-mail-offline className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <span className="flex-1">📴 인터넷에 연결되어 있지 않아 쪽지를 받지 못했습니다. 쪽지는 서버에만 있어 인터넷이 필요합니다.</span>
              <button type="button" data-mail-retry disabled={busy} onClick={() => void load(false)} className="shrink-0 rounded-lg px-2 py-1 font-bold hover:bg-amber-100 disabled:opacity-50 cursor-pointer">
                다시 받기
              </button>
            </div>
          )}
          {items.length === 0 ? (
            !page?.offline && (
              <p data-mail-empty={box} className="py-6 text-center text-xs text-slate-400">
                {empty}
              </p>
            )
          ) : (
            <ul data-mail-list={box} className="flex flex-col gap-1.5">
              {items.map((m) => (
                <MailRow
                  key={m.id}
                  m={m}
                  now={now}
                  open={open === m.id}
                  onToggle={() => toggle(m)}
                  onReply={onReply}
                  onChat={uid ? (x) => openChat({ room: dmPairId(uid, x.from), sid: x.sid }) : undefined}
                  onDelete={() => {
                    if (!uid) return;
                    setOpen(null);
                    removeMail(uid, box, m.id);
                  }}
                />
              ))}
            </ul>
          )}
          {page?.cursor && (
            <button
              type="button"
              data-mail-more={box}
              disabled={busy}
              onClick={() => void load(true)}
              className="self-center rounded-lg px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/5 disabled:opacity-50 cursor-pointer"
            >
              {busy ? '불러오는 중…' : '더 보기'}
            </button>
          )}
        </>
      )}
    </div>
  );
}

const TABS: ReadonlyArray<{ id: MailTabId; label: string }> = [
  { id: 'in', label: '📥 받은 쪽지' },
  { id: 'sent', label: '📤 보낸 쪽지' },
  { id: 'write', label: '✏️ 쓰기' },
];

/** 쓰기 탭을 채울 것 (그룹 창 구성원 칩 ✉ - 열 때마다 새 객체) */
const askOf = (p: MailParams | undefined): ComposeAsk | undefined => (p?.tab === 'write' && (p.sid || p.to) ? { sid: p.sid, to: p.to } : undefined);

export default function MailWindow({ params, close, raise }: WindowProps<MailParams | undefined>) {
  // 창 안 탭 단축키(P18-2) - 단축키 설정이 고르는 표시 + 키가 있으면 툴팁
  const tabTarget = useTabTarget();
  const [tab, setTab] = useState<MailTabId>(params?.tab ?? 'in');
  const [focus, setFocus] = useState(params?.id ? { id: params.id } : undefined);
  const [ask, setAsk] = useState(() => askOf(params));
  const [sentBump, setSentBump] = useState(0);
  const unread = useMailStore((s) => s.unread);
  const { groups } = useMySpaces();
  // 열린 창을 다시 열면 그 탭·쪽지로 (BackupWindow 본보기 - openWindow는 열 때마다 새 params)
  const [asked, setAsked] = useState(params);
  if (params !== asked) {
    setAsked(params);
    if (params?.id) {
      setTab('in');
      setFocus({ id: params.id });
    } else if (params?.tab) {
      setTab(params.tab);
      const next = askOf(params);
      if (next) setAsk(next);
    }
  }
  // 쓰기 탭은 처음 열 때 그린다 (구성원 이름 읽기) - 그 뒤로는 숨기기만(적던 글이 남게)
  const [composing, setComposing] = useState(tab === 'write');
  if (tab === 'write' && !composing) setComposing(true);

  const reply = (m: MailIn) => {
    const g = groups.find((x) => x.id === m.sid);
    const role = g?.members[m.from];
    if (!g || (role !== 'owner' && role !== 'member')) {
      showToast(g ? `${m.fromName} 선생님이 그 그룹에 없어 답장할 수 없습니다.` : `그 그룹(${m.groupName})에 들어 있지 않아 답장할 수 없습니다.`, 4000);
      return;
    }
    setAsk({ sid: m.sid, to: [m.from], replyTo: m.id, quote: replyQuote(m.text, 40, m.attachments) });
    setTab('write');
  };
  const sent = () => {
    setSentBump((n) => n + 1);
    setTab('sent');
  };

  return (
    <ModalShell isOpen onClose={close} raise={raise} width="lg" title="✉ 쪽지" bare footer={<ModalCloseButton onClose={close} />}>
      <div data-mail-window={tab} className="flex min-h-full flex-col">
        <div role="tablist" className="sticky top-0 z-10 flex gap-1 border-b border-slate-100 bg-white px-4 pt-3">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              data-mail-tab-btn={t.id}
              {...tabTarget('mail', t.id)}
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`-mb-px flex items-center gap-1 border-b-2 px-3 py-2 text-sm font-bold transition-colors cursor-pointer ${
                tab === t.id ? 'border-primary text-primary' : 'border-transparent text-slate-400 hover:text-slate-700'
              }`}
            >
              {t.label}
              {t.id === 'in' && unread > 0 && (
                <span data-mail-unread-count={unread} className="rounded-full bg-primary px-1.5 text-2xs font-black text-white">
                  {unreadLabel(unread)}
                </span>
              )}
            </button>
          ))}
        </div>
        <p className="px-4 pt-3 text-2xs text-slate-400">같은 그룹 선생님과 주고받는 쪽지입니다. 1년이 지나면 저절로 지워집니다.</p>
        <div role="tabpanel" data-mail-panel="in" hidden={tab !== 'in'}>
          <MailList box="in" active={tab === 'in'} focus={focus} onReply={reply} />
        </div>
        <div role="tabpanel" data-mail-panel="sent" hidden={tab !== 'sent'}>
          <MailList box="sent" active={tab === 'sent'} bump={sentBump} />
        </div>
        {/* 쓰기 칸이 창 아래까지 - 파일을 빈 곳에 놓아도 받는다 (P21-1) */}
        <div role="tabpanel" data-mail-panel="write" hidden={tab !== 'write'} className={tab === 'write' ? 'flex flex-1 flex-col' : undefined}>
          {composing && <MailCompose ask={ask} onSent={sent} />}
        </div>
      </div>
    </ModalShell>
  );
}
