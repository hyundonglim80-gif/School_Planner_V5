// 오류 알림 셈 (P14-2). 사용자 화면에서 난 오류를 개발자에게 보낼 문서로 만든다 - 보내기는 data/errorReport, 모아 보기는 개발자 탭(■5).
//   - 글 내용은 싣지 않는다: 오류 문장에서 메일·긴 숫자·문서 경로(users/…·spaces/…)·따옴표 안·파일 이름·주소 뒤 ?…를 지운다(`scrubText`).
//     스택은 앞 8줄, 주소는 파일:줄만(`stackHead`). 메모·학생 글을 담은 칸은 문서에 없다.
//   - 같은 오류는 세션(탭)에 한 번, 세션 10건·하루 30건까지(`shouldSend`) - 같은 오류가 그리기마다 나도 쓰기가 불어나지 않게.
//   - 버림(`isNoise`): 브라우저가 내는 소음(ResizeObserver loop·Script error.)·확장 프로그램·새 판 조각 404(lazyWithReload가 새로고침한다)·끊긴 동안·이미 안내한 실패(ShownError - 안내할 때 보냈다).

export type ErrorKind = 'error' | 'rejection' | 'react' | 'toast';
export const ERROR_KINDS: readonly ErrorKind[] = ['error', 'rejection', 'react', 'toast'];

/** 칸마다 가장 긴 글 - 규칙(firestore.rules `v5Errors`)과 같게 */
export const LIMITS = { message: 300, stack: 1500, note: 300, ua: 200, scope: 40, build: 40 } as const;
export const STACK_LINES = 8;
export const SESSION_MAX = 10;
export const DAY_MAX = 30;

const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** 오류 문장에서 사람·글을 가리킬 수 있는 것을 지운다 (300자) */
export function scrubText(text: string, max: number = LIMITS.message): string {
  const s = text
    // 주소의 ?·# 뒤(토큰·검색어)
    .replace(/((?:https?|blob):\/\/[^\s?#'"`)]+)[?#][^\s'"`)]*/g, '$1')
    // 메일 (스택의 이름@파일.tsx:줄은 빼고)
    .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+(?![\w-]|:\d)/g, '…')
    // 문서 경로 - 공간·사람 id와 그 뒤 문서 이름
    .replace(/\b(users|spaces)\/[^\s'"`),]+/g, '$1/…')
    // 따옴표 안(라벨·파일 이름 등 사용자가 쓴 것) - 코드 이름처럼 생긴 것((reading 'foo'))은 둔다
    .replace(/'([^'\n]*)'|"([^"\n]*)"|‘([^’\n]*)’|“([^”\n]*)”|「([^」\n]*)」/g, (all: string, ...g: Array<string | undefined>) =>
      /^[A-Za-z_$][\w$.]{0,40}$/.test(g.slice(0, 5).find((x) => x !== undefined) ?? '') ? all : '…',
    )
    // 파일 이름 (사진.png, 명렬표.csv)
    .replace(/[^\s/\\:'"`()]+\.(?:png|jpe?g|gif|webp|heic|pdf|csv|tsv|xlsx?|json|txt|hwpx?|docx?|pptx?|zip)\b/gi, '…')
    // 긴 숫자(전화·학번·시각 - 스택의 :줄:칸은 둔다)와 숫자가 섞인 긴 id(uid·문서 id)
    .replace(/(?<![:\d])\d{6,}/g, '…')
    .replace(/\b(?=[A-Za-z_-]*\d)[A-Za-z0-9_-]{20,}\b/g, '…')
    .replace(/\s+/g, ' ')
    .trim();
  return cut(s, max);
}

/**
 * 스택 앞 8줄 - 주소는 파일:줄:칸만, 줄마다 scrubText (1500자).
 * 자리 줄(at …·이름@주소)만 둔다 - 크롬 스택 첫 줄은 오류 문장을 되풀이해, 'toast'에서 빼 둔 오류 문장이 스택으로 실린다.
 */
export function stackHead(stack: string | undefined | null): string {
  if (!stack) return '';
  const lines = stack
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => /^at\s/.test(l) || /^[^\s]*@\S/.test(l))
    .slice(0, STACK_LINES)
    .map((l) => scrubText(l.replace(/(?:blob:)?(?:https?|file|webpack|chrome-extension):\/\/[^\s)]*\/([^/\s)?#]+?)(?:[?#][^\s):]*)?(:\d+(?::\d+)?)?(?=[\s)]|$)/g, '$1$2'), 300));
  return cut(lines.join('\n'), LIMITS.stack);
}

/** 오류 값에서 이름·문장·코드·스택 (Error가 아닌 것을 던져도) */
export function describeError(err: unknown): { name: string; message: string; code: string; stack: string } {
  if (err instanceof Error || (err && typeof err === 'object' && 'message' in err)) {
    const e = err as { name?: unknown; message?: unknown; code?: unknown; stack?: unknown };
    return {
      name: typeof e.name === 'string' ? e.name : 'Error',
      message: String(e.message ?? ''),
      code: typeof e.code === 'string' || typeof e.code === 'number' ? String(e.code) : '',
      stack: typeof e.stack === 'string' ? e.stack : '',
    };
  }
  return { name: '', message: err === undefined || err === null ? '' : String(err), code: '', stack: '' };
}

/** 새 판이 나가 옛 조각 파일이 없어진 것 (app/lazyWithReload가 새로고침으로 푼다) */
export function looksLikeStaleChunk(message: string): boolean {
  return (
    message.includes('Failed to fetch dynamically imported module') ||
    message.includes('error loading dynamically imported module') ||
    message.includes('Importing a module script failed')
  );
}

/** 보내지 않을 것 */
export function isNoise(e: { name: string; message: string; stack: string; source?: string }, online: boolean): boolean {
  if (!online) return true;
  if (e.name === 'ShownError') return true;
  if (/ResizeObserver loop/.test(e.message)) return true;
  // 다른 곳(교차 출처) 스크립트 오류 - 브라우저가 내용을 가려 알 수 있는 것이 없다
  if (e.message === 'Script error.' || e.message === 'Script error') return true;
  if (/(?:chrome|moz|safari(?:-web)?)-extension:\/\//.test(`${e.stack}\n${e.source ?? ''}`)) return true;
  return looksLikeStaleChunk(e.message);
}

/** 같은 오류인지 가르는 열쇠: 종류 + 문장 + 스택 첫 자리 */
export function errorKey(kind: ErrorKind, message: string, stack: string): string {
  const frame = stack.split('\n').find((l) => /:\d+/.test(l)) ?? '';
  return `${kind}|${message.slice(0, 120)}|${frame.slice(0, 120)}`;
}

/** 이 탭에서 보낸 것 (sessionStorage) */
export interface SessionSent {
  keys: string[];
}
/** 이 기기에서 오늘 보낸 수 (localStorage) */
export interface DaySent {
  day: string;
  count: number;
}

/** 보낼까 - 보낼 때만 바뀐 기록을 돌려준다. 같은 오류는 세션에 한 번, 세션 10건·하루 30건 */
export function shouldSend(session: SessionSent, day: DaySent, key: string, today: string): { session: SessionSent; day: DaySent } | null {
  if (session.keys.includes(key) || session.keys.length >= SESSION_MAX) return null;
  const count = day.day === today ? day.count : 0;
  if (count >= DAY_MAX) return null;
  return { session: { keys: [...session.keys, key] }, day: { day: today, count: count + 1 } };
}

/** 저장소에서 읽은 값이 망가져 있어도 빈 기록으로 */
export function readSessionSent(raw: string | null): SessionSent {
  try {
    const v = JSON.parse(raw ?? '');
    return Array.isArray(v?.keys) ? { keys: v.keys.filter((k: unknown) => typeof k === 'string') } : { keys: [] };
  } catch {
    return { keys: [] };
  }
}
export function readDaySent(raw: string | null): DaySent {
  try {
    const v = JSON.parse(raw ?? '');
    return typeof v?.day === 'string' && Number.isFinite(v?.count) ? { day: v.day, count: v.count } : { day: '', count: 0 };
  } catch {
    return { day: '', count: 0 };
  }
}

export interface ErrorContext {
  build: string;
  /** 화면 이름만(day·week·memo …) - 날짜·글은 싣지 않는다 */
  scope: string;
  device: 'pc' | 'mobile';
  standalone: boolean;
  ua: string;
}

/** 서버에 올릴 칸 (uid·at·expireAt은 보낼 때 붙인다) */
export interface ErrorReportFields {
  kind: ErrorKind;
  message: string;
  stack: string;
  note: string;
  build: string;
  scope: string;
  device: 'pc' | 'mobile';
  standalone: boolean;
  ua: string;
}

/**
 * 오류 하나 → 올릴 칸. 'toast'는 앱이 띄운 안내 글(따옴표 안·파일 이름은 지운다) + 오류의 이름·코드만, 그 밖은 오류 문장.
 * `note`: 'react'는 컴포넌트 스택(이름뿐), 'toast'는 오류 이름·코드.
 */
export function buildReport(kind: ErrorKind, err: unknown, ctx: ErrorContext, opts: { toastText?: string; componentStack?: string } = {}): ErrorReportFields {
  const e = describeError(err);
  const head = e.name && e.name !== 'Error' ? `${e.name}: ` : '';
  const message = kind === 'toast' ? scrubText(opts.toastText ?? '') : scrubText(`${head}${e.code && !e.message.includes(e.code) ? `[${e.code}] ` : ''}${e.message}`);
  const note =
    kind === 'toast'
      ? scrubText([e.name, e.code].filter(Boolean).join(' '), LIMITS.note)
      : kind === 'react' && opts.componentStack
        ? stackHead(opts.componentStack).slice(0, LIMITS.note)
        : '';
  return {
    kind,
    message: message || '(빈 문장)',
    stack: stackHead(e.stack),
    note,
    build: cut(ctx.build, LIMITS.build),
    scope: cut(ctx.scope.replace(/[^\w-]/g, ''), LIMITS.scope),
    device: ctx.device,
    standalone: ctx.standalone,
    ua: cut(ctx.ua, LIMITS.ua),
  };
}

/** 개발자 탭에서 읽은 문서 하나 */
export interface ErrorReportDoc extends ErrorReportFields {
  id: string;
  /** ms */
  at: number;
}

export interface ErrorGroup {
  message: string;
  kind: ErrorKind;
  count: number;
  lastAt: number;
  builds: string[];
  devices: string[];
  /** 가장 나중 것 (스택을 보인다) */
  latest: ErrorReportDoc;
  ids: string[];
}

/** 같은 문장끼리 묶는다 - 마지막 시각이 늦은 묶음부터 */
export function groupErrors(docs: readonly ErrorReportDoc[]): ErrorGroup[] {
  const byMessage = new Map<string, ErrorGroup>();
  for (const d of [...docs].sort((a, b) => b.at - a.at)) {
    const k = `${d.kind}|${d.message}`;
    const g = byMessage.get(k);
    const device = `${d.device}${d.standalone ? '·앱' : ''}`;
    if (!g) {
      byMessage.set(k, { message: d.message, kind: d.kind, count: 1, lastAt: d.at, builds: [d.build], devices: [device], latest: d, ids: [d.id] });
      continue;
    }
    g.count++;
    g.ids.push(d.id);
    if (!g.builds.includes(d.build)) g.builds.push(d.build);
    if (!g.devices.includes(device)) g.devices.push(device);
  }
  return [...byMessage.values()].sort((a, b) => b.lastAt - a.lastAt);
}
