// 쪽지 셈 (P15-1 ■2). 같은 그룹(공간 g_…) 구성원끼리 글만 주고받는다 - 쓰기·받기는 data/mail, 규칙은 firestore.rules v5Mail.
//   - 자료: 받는 사람마다 v5Mail/{그 사람}/mailIn/{id} 한 장 + 보낸 사람 사본 v5Mail/{나}/mailSent/{id} - 같은 id, 한 묶음.
//   - 칸과 길이는 규칙과 같게(MAIL_LIMITS). 글 길이는 규칙도 글자 칸 수(UTF-16 - 이모지는 2)로 센다(P15-1 ■0 에뮬레이터).
//   - 받는 사람은 보내기 직전에 지금 구성원으로 다시 거른다 - 나간 사람이 하나라도 있으면 규칙이 묶음 전체를 막는다.

/** 칸마다 가장 긴 것 - 규칙(firestore.rules `v5Mail`)과 같게. 그룹 이름은 공간 이름 그대로(이름이 빈 공간만 60자) */
export const MAIL_LIMITS = { text: 2000, to: 50, toNames: 600, fromName: 40, groupName: 60 } as const;
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
}

const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** 글이 보낼 수 있는 것인가 - 안 되면 안내 글 */
export function mailTextError(text: string): string | null {
  if (!text.trim()) return '보낼 글을 적어 주세요.';
  if (text.length > MAIL_LIMITS.text) return `쪽지는 ${MAIL_LIMITS.text}자까지 보낼 수 있습니다 (지금 ${text.length}자).`;
  return null;
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

/** 답장 글 머리 - 받은 글 첫 줄을 짧게 */
export function replyQuote(text: string, max = 40): string {
  const first = text.split('\n').find((l) => l.trim()) ?? '';
  return cut(first.trim(), max);
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
