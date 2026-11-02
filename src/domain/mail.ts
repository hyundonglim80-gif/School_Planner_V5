// 쪽지 셈 (P15-1 ■2). 같은 그룹(공간 g_…) 구성원끼리 글만 주고받는다 - 쓰기·받기는 data/mail, 규칙은 firestore.rules v5Mail.
//   - 자료: 받는 사람마다 v5Mail/{그 사람}/mailIn/{id} 한 장 + 보낸 사람 사본 v5Mail/{나}/mailSent/{id} - 같은 id, 한 묶음.
//   - 칸과 길이는 규칙과 같게(MAIL_LIMITS). 글 길이는 규칙도 글자 칸 수(UTF-16 - 이모지는 2)로 센다(P15-1 ■0 에뮬레이터).
//   - 받는 사람은 보내기 직전에 지금 구성원으로 다시 거른다 - 나간 사람이 하나라도 있으면 규칙이 묶음 전체를 막는다.
//   - 첨부(P16 - 메모처럼 📎·캡처): 보낸 사람 드라이브에 올린 붙임 목록 `attachments`(있을 때만 칸째, 10개까지). 첨부가 있으면 글은 비어도 된다.
//     규칙은 목록 안 칸을 보지 못하므로 읽을 때 https 주소인 것만 받는다(남이 쓴 문서 - javascript: 주소 등을 걸지 않게).
import type { Attachment } from '../data/types';
import { isImageAttachment } from './attachments';

/** 칸마다 가장 긴 것 - 규칙(firestore.rules `v5Mail`)과 같게. 그룹 이름은 공간 이름 그대로(이름이 빈 공간만 60자) */
export const MAIL_LIMITS = { text: 2000, to: 50, toNames: 600, fromName: 40, groupName: 60, attachments: 10 } as const;
/** 1년 뒤 TTL 정책이 지운다(규칙은 370일 안) */
export const MAIL_KEEP_DAYS = 365;
/** 쪽지 창이 한 번에 받는 수 */
export const MAIL_PAGE = 30;
/** 안 읽은 쪽지는 이만큼까지만 센다(앱을 열 때마다 읽는 수) - 넘으면 '99+' */
export const UNREAD_MAX = 100;

export type MailBox = 'in' | 'sent';

/** 받은 쪽지 (mailIn) */
export interface MailIn {
  id: string;
  from: string;
  fromName: string;
  sid: string;
  groupName: string;
  to: string[];
  toNames: string;
  text: string;
  /** 보낸 시각(ms) - 내가 막 보내 서버가 아직 받지 않았으면 null */
  at: number | null;
  readAt: number | null;
  replyTo: string | null;
  /** 붙임 (보낸 사람 드라이브 - 없으면 빈 목록) */
  attachments: Attachment[];
}

/** 보낸 쪽지 사본 (mailSent) */
export type MailSent = Omit<MailIn, 'from' | 'fromName' | 'readAt'>;

/** 보낼 쪽지 - 이름·글은 아래 셈이 자른다 */
export interface OutgoingMail {
  from: string;
  fromName: string;
  sid: string;
  groupName: string;
  to: string[];
  /** 받는 사람 uid → 이름 (없으면 '이름 없음') */
  names: Record<string, string>;
  text: string;
  replyTo?: string | null;
  attachments?: readonly Attachment[];
}

const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** 글·첨부가 보낼 수 있는 것인가 - 안 되면 안내 글. 첨부가 있으면 글은 비어도 된다 */
export function mailTextError(text: string, files = 0): string | null {
  if (!text.trim() && files === 0) return '보낼 글을 적거나 파일을 붙여 주세요.';
  if (text.length > MAIL_LIMITS.text) return `쪽지는 ${MAIL_LIMITS.text}자까지 보낼 수 있습니다 (지금 ${text.length}자).`;
  if (files > MAIL_LIMITS.attachments) return `첨부는 한 통에 ${MAIL_LIMITS.attachments}개까지 보낼 수 있습니다 (지금 ${files}개).`;
  return null;
}

/** 문서에 적을 붙임 - 아는 칸만, 값이 없는 칸은 빼고(undefined 칸 하나로 저장이 통째로 막히던 V4) */
function cleanAttachment(a: Attachment): Attachment {
  return {
    ...(a.id ? { id: a.id } : {}),
    name: a.name,
    url: a.url,
    type: a.type || 'application/octet-stream',
    ...(typeof a.size === 'number' ? { size: a.size } : {}),
    ...(a.driveId ? { driveId: a.driveId } : {}),
  };
}

/**
 * 받는 사람을 지금 구성원으로 거른다 - 겹침·나·구성원이 아닌 사람을 뺀다.
 * gone = 고른 사람 중 지금 그 그룹에 없는 사람(안내용).
 */
export function recipientsOf(picked: readonly string[], me: string, members: Readonly<Record<string, string>>): { to: string[]; gone: string[] } {
  const to: string[] = [];
  const gone: string[] = [];
  for (const uid of new Set(picked)) {
    if (uid === me) continue;
    if (members[uid] === 'owner' || members[uid] === 'member') to.push(uid);
    else gone.push(uid);
  }
  return { to, gone };
}

/** 받는 사람 이름을 한 줄로 (', ' - 600자) */
export function joinNames(to: readonly string[], names: Readonly<Record<string, string>>): string {
  return cut(to.map((uid) => names[uid]?.trim() || '이름 없음').join(', '), MAIL_LIMITS.toNames);
}

/** 지울 날(ms) */
export const mailExpireAt = (now: number) => now + MAIL_KEEP_DAYS * 86_400_000;

/**
 * 쪽지 문서 둘 - 받는 쪽(mailIn, 받는 사람마다 같은 것)과 내 사본(mailSent).
 * at·expireAt은 자료 층이 서버 시각·Timestamp로 넣는다(이 파일은 Firebase를 모른다). readAt·replyTo는 null도 칸째 적는다(규칙 hasAll·`== null` 쿼리).
 */
export function mailDocs<A, E>(m: OutgoingMail, at: A, expireAt: E) {
  const common = {
    sid: m.sid,
    // 자르지 않는다 - 규칙이 공간 이름과 같은지 본다(이름이 빈 공간만 60자까지)
    groupName: m.groupName,
    to: [...m.to],
    toNames: joinNames(m.to, m.names),
    text: m.text,
    at,
    replyTo: m.replyTo ?? null,
    // 붙임이 있을 때만 칸째(첨부 없는 쪽지는 P15 모양 그대로)
    ...(m.attachments?.length ? { attachments: m.attachments.map(cleanAttachment) } : {}),
    expireAt,
    v: 1 as const,
  };
  return {
    inbox: { from: m.from, fromName: cut(m.fromName.trim() || '이름 없음', MAIL_LIMITS.fromName), ...common, readAt: null },
    sent: common,
  };
}

// 서버 문서 → 앱 모양. Timestamp는 toMillis로(이 파일은 Firebase를 import하지 않는다).
const millis = (v: unknown): number | null =>
  v && typeof (v as { toMillis?: unknown }).toMillis === 'function' ? (v as { toMillis: () => number }).toMillis() : typeof v === 'number' ? v : null;
const str = (v: unknown) => (typeof v === 'string' ? v : '');
const strs = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

/** 받은 붙임 - 이름과 https 주소가 있는 것만(규칙이 못 보는 목록 안을 여기서 거른다), 10개까지 */
export function readMailAttachments(v: unknown): Attachment[] {
  if (!Array.isArray(v)) return [];
  const out: Attachment[] = [];
  for (const x of v) {
    if (!x || typeof x !== 'object') continue;
    const a = x as Record<string, unknown>;
    const url = str(a.url);
    if (!str(a.name) || !/^https:\/\//i.test(url)) continue;
    out.push({
      ...(str(a.id) ? { id: str(a.id) } : {}),
      name: str(a.name).slice(0, 200),
      url,
      type: str(a.type) || 'application/octet-stream',
      ...(typeof a.size === 'number' ? { size: a.size } : {}),
      ...(/^[\w-]+$/.test(str(a.driveId)) ? { driveId: str(a.driveId) } : {}),
    });
    if (out.length === MAIL_LIMITS.attachments) break;
  }
  return out;
}

export function readMailSent(id: string, d: Record<string, unknown>): MailSent {
  return {
    id,
    sid: str(d.sid),
    groupName: str(d.groupName),
    to: strs(d.to),
    toNames: str(d.toNames),
    text: str(d.text),
    at: millis(d.at),
    replyTo: typeof d.replyTo === 'string' && d.replyTo ? d.replyTo : null,
    attachments: readMailAttachments(d.attachments),
  };
}

export function readMailIn(id: string, d: Record<string, unknown>): MailIn {
  return { ...readMailSent(id, d), from: str(d.from), fromName: str(d.fromName) || '이름 없음', readAt: millis(d.readAt) };
}

/** 머리줄 숫자 - UNREAD_MAX(100)까지만 세므로 그때는 '99+' */
export function unreadLabel(n: number): string {
  return n >= UNREAD_MAX ? '99+' : String(n);
}

/** 앱 안 새 쪽지 안내 글 */
export function newMailNotice(m: Pick<MailIn, 'fromName' | 'groupName'>): string {
  return `✉ ${m.fromName} 선생님의 쪽지${m.groupName ? ` (${m.groupName})` : ''}`;
}

/** 쪽지 창 줄의 시각 - 오늘이면 '오후 3:05', 올해면 '11/2 오후 3:05', 그 전이면 '2025/11/2'. null = 내가 막 보내 서버가 아직 받지 않음 */
export function mailWhen(at: number | null, now: number): string {
  if (at === null) return '보내는 중…';
  const d = new Date(at);
  const n = new Date(now);
  const time = d.toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' });
  if (d.toDateString() === n.toDateString()) return time;
  if (d.getFullYear() === n.getFullYear()) return `${d.getMonth() + 1}/${d.getDate()} ${time}`;
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

/** 붙임 수를 한 마디로 - '🖼️ 그림 2 · 📎 파일 1' (없으면 빈 글) */
export function mailFilesLabel(attachments: readonly Attachment[]): string {
  const images = attachments.filter(isImageAttachment).length;
  const files = attachments.length - images;
  return [images ? `🖼️ 그림 ${images}` : '', files ? `📎 파일 ${files}` : ''].filter(Boolean).join(' · ');
}

/** 쪽지 창 줄에 보일 글 - 빈 줄을 건너뛴 첫 줄. 글이 없으면(첨부만) 붙임 수 */
export function mailPreview(text: string, attachments: readonly Attachment[] = []): string {
  return (text.split('\n').find((l) => l.trim()) ?? '').trim() || mailFilesLabel(attachments);
}

/** 답장 글 머리 - 받은 글 첫 줄을 짧게 (글이 없으면 붙임 수) */
export function replyQuote(text: string, max = 40, attachments: readonly Attachment[] = []): string {
  return cut(mailPreview(text, attachments), max);
}

// 푸시 알림을 눌러 앱을 열 때 주소 ?mail=<id> (public/sw.js notificationclick) - ?share= 본보기(domain/share)

/** 주소의 ?mail= 값 - 없거나 id 모양이 아니면 null */
export function mailParamOf(search: string): string | null {
  const id = new URLSearchParams(search).get('mail');
  return id && /^[A-Za-z0-9]{1,40}$/.test(id) ? id : null;
}

/** 주소에서 ?mail=을 지운다 (새로고침해도 다시 열리지 않게). 다른 값(?as= 등)과 # 뒤는 둔다 */
export function stripMailParam(href: string): string {
  const u = new URL(href);
  u.searchParams.delete('mail');
  return u.pathname + (u.searchParams.toString() ? `?${u.searchParams}` : '') + u.hash;
}
