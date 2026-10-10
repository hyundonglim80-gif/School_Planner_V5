// 구글 Keep 메모 → V5 메모 (V4 lib/keepImport.ts 그대로 - 이미 있는 메모를 V5 모양으로 받는 것만 다르다, P8-3).
//
// ⚠️ 실시간 연동은 안 된다. Keep API는 구글 워크스페이스 조직용이라 관리자가 도메인 위임을 걸어 서비스 계정으로만 부른다.
//    개인 지메일 계정에는 받을 수 있는 권한(scope) 자체가 없다. 그래서 구글이 주는 내보내기(Takeout)를 읽는다 -
//    Takeout > Keep을 받으면 메모 하나에 .json 하나씩, 사진·파일은 같은 폴더에 따로 들어 있다.
//
// Takeout 메모 한 건의 생김새 (쓰는 것만)
//   { "title", "textContent", "listContent": [{ "text", "isChecked" }], "labels": [{ "name" }],
//     "isArchived", "isTrashed", "isPinned", "createdTimestampUsec"(마이크로초), "attachments": [{ "filePath", "mimetype" }] }

export interface KeepNote {
  /** 메모로 저장할 본문 (제목 + 내용) */
  content: string;
  labels: string[];
  /** 만든 때 (밀리초). 없으면 0 */
  createdAt: number;
  archived: boolean;
  trashed: boolean;
  pinned: boolean;
  /** 딸려 있던 파일 이름들 */
  attachmentNames: string[];
  /** 어느 파일에서 왔는지 (화면에 보여 줄 때만) */
  sourceName?: string;
}

type Raw = Record<string, unknown>;
const obj = (v: unknown): Raw | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Raw) : null);

/** 마이크로초 → 밀리초. Takeout은 마이크로초로 준다(13자리 밀리초도 받아 준다) */
function usecToMs(usec: unknown): number {
  const n = Number(usec);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n > 1e14 ? Math.round(n / 1000) : Math.round(n);
}

/** 목록 메모 한 줄 - 체크 표시를 글자로 (V5 체크리스트 '☐ '/'☑ '와 같은 모양) */
function listLine(item: unknown): string {
  const o = obj(item);
  const text = String(o?.text ?? '').trim();
  if (!text) return '';
  return `${o?.isChecked ? '☑' : '☐'} ${text}`;
}

/** Takeout 메모 한 건을 읽는다. 메모가 아니면 null. 제목과 본문은 한 덩이로(메모에는 제목 칸이 없다) */
export function parseKeepNote(raw: unknown, sourceName?: string): KeepNote | null {
  const o = obj(raw);
  if (!o) return null;
  const title = String(o.title ?? '').trim();
  const body = String(o.textContent ?? '').trim();
  const list = Array.isArray(o.listContent) ? o.listContent.map(listLine).filter(Boolean).join('\n') : '';
  const attachmentNames = Array.isArray(o.attachments) ? o.attachments.map((a) => String(obj(a)?.filePath ?? '').trim()).filter(Boolean) : [];
  const content = [title, body || list].filter(Boolean).join('\n');
  // 글도 목록도 제목도 없으면 메모가 아니다 (파일만 딸린 메모는 살린다 - 무엇이 있었는지는 남긴다)
  if (!content && attachmentNames.length === 0) return null;
  const labels = Array.isArray(o.labels) ? o.labels.map((l) => String(obj(l)?.name ?? '').trim()).filter(Boolean) : [];
  return {
    content,
    labels,
    createdAt: usecToMs(o.createdTimestampUsec ?? o.userEditedTimestampUsec),
    archived: !!o.isArchived,
    trashed: !!o.isTrashed,
    pinned: !!o.isPinned,
    attachmentNames,
    sourceName,
  };
}

/** 이 JSON이 Keep 메모인가 (V4·V5 백업 파일과 가려낸다 - 백업 탭에 Keep 파일을 넣는 일이 잦다) */
export function looksLikeKeepNote(raw: unknown): boolean {
  const o = obj(raw);
  if (!o) return false;
  const keepish = 'textContent' in o || 'listContent' in o || 'isTrashed' in o || 'isArchived' in o || 'userEditedTimestampUsec' in o;
  const backupish = 'events' in o || 'schedules' in o || 'journals' in o || 'tasks' in o || 'rosters' in o || 'colls' in o;
  return keepish && !backupish;
}

/** 파일 내용이 Keep 메모인가 */
export function fileLooksLikeKeep(text: string): boolean {
  try {
    const data: unknown = JSON.parse(text);
    return Array.isArray(data) ? data.some(looksLikeKeepNote) : looksLikeKeepNote(data);
  } catch {
    return false;
  }
}

/** 파일 하나를 읽는다 (메모마다 파일 하나지만 배열로 준 것도 받는다). JSON이 아니면 [] */
export function parseKeepFile(text: string, sourceName?: string): KeepNote[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return [];
  }
  return (Array.isArray(data) ? data : [data]).map((item) => parseKeepNote(item, sourceName)).filter((n): n is KeepNote => n !== null);
}

export interface KeepImportOptions {
  /** 보관(Archive)한 메모도 가져오는가 */
  includeArchived: boolean;
  /** Keep의 라벨을 메모 라벨로 함께 가져오는가 */
  keepLabels: boolean;
}

/** 실제로 가져올 것만. 휴지통에 있던 것은 언제나 뺀다 */
export function selectNotesToImport(notes: KeepNote[], opts: KeepImportOptions): KeepNote[] {
  return notes.filter((n) => !n.trashed && (opts.includeArchived || !n.archived));
}

/** 메모로 저장할 모양. 끝내 못 붙인 파일(missing)은 본문 끝에 이름으로 남긴다(Takeout 폴더에서 찾을 수 있게) */
export function toMemoDraft(note: KeepNote, opts: KeepImportOptions, missing: string[] = note.attachmentNames): { content: string; labels: string[] } {
  const lines = [note.content];
  if (missing.length > 0) lines.push(`📎 Keep에 붙어 있던 파일: ${missing.join(', ')}`);
  return { content: lines.filter(Boolean).join('\n'), labels: opts.keepLabels ? note.labels : [] };
}

/**
 * 같은 Keep 메모인지 알아보는 열쇠. Takeout에는 메모 id가 없다 - '만든 때'(마이크로초까지, 고쳐도 바뀌지 않는다)로.
 * V4가 메모에 적어 둔 keepId와 같은 모양이라 V4에서 가져온 메모도 알아본다.
 */
export function keepIdOf(note: KeepNote): string {
  if (note.createdAt > 0) return `keep_${note.createdAt}`;
  let h = 0;
  for (let i = 0; i < note.content.length; i++) h = ((h << 5) - h + note.content.charCodeAt(i)) | 0;
  return `keep_c${Math.abs(h).toString(36)}`;
}

/** 지금 있는 메모 (라벨은 이름으로, 첨부는 파일 이름으로) */
export interface ExistingMemo {
  id: string;
  text: string;
  keepId?: string;
  labels: string[];
  attachmentNames: string[];
}

/** 이미 들어와 있는 메모 - 열쇠가 먼저, 없으면 열쇠 없는 메모 중 내용이 똑같은 것 */
export function findExistingMemo(note: KeepNote, memos: readonly ExistingMemo[], draftContent: string): ExistingMemo | undefined {
  const id = keepIdOf(note);
  const byKey = memos.find((m) => m.keepId === id);
  if (byKey) return byKey;
  const body = draftContent.trim();
  return memos.find((m) => !m.keepId && m.text.trim() === body);
}

const sameList = (a: string[], b: string[]) => {
  const x = [...a].sort();
  const y = [...b].sort();
  return x.length === y.length && x.every((v, i) => v === y[i]);
};

/** 이미 있는 메모를 고쳐 써야 하는가 - 글·라벨·붙은 파일 가운데 하나라도 달라졌으면 */
export function memoNeedsUpdate(draft: { content: string; labels: string[]; attachmentNames: string[] }, memo: ExistingMemo): boolean {
  if (memo.text.trim() !== draft.content.trim()) return true;
  if (!sameList(memo.labels, draft.labels)) return true;
  return !sameList(memo.attachmentNames.map(assetKey).filter(Boolean), draft.attachmentNames.map(assetKey));
}

/** 파일 이름만 소문자로 - 딸린 파일 짝 찾기 열쇠 (filePath에 폴더가 붙기도, 고르기 창 이름과 대소문자가 다르기도 하다) */
export function assetKey(path: string): string {
  return (
    String(path ?? '')
      .split(/[\\/]/)
      .pop()
      ?.trim()
      .toLowerCase() ?? ''
  );
}

/** Keep에 딸린 것으로 받아 두는 파일 (사진·소리·PDF) */
export const isKeepAsset = (name: string) => /\.(jpe?g|png|gif|webp|heic|bmp|3gp|m4a|mp3|wav|pdf)$/i.test(name);

export type KeepAction = 'add' | 'update' | 'skip';

export interface KeepPlan {
  note: KeepNote;
  draft: { content: string; labels: string[] };
  /** 짝을 찾아 올릴 파일 (Keep에 적힌 이름) */
  attachNames: string[];
  missing: string[];
  found?: ExistingMemo;
  action: KeepAction;
}

/** 메모 한 건을 어떻게 넣을지 - 미리보기와 실제 넣기가 같은 것을 쓴다 */
export function planKeepNote(note: KeepNote, opts: KeepImportOptions, withFiles: boolean, assets: ReadonlySet<string>, existing: readonly ExistingMemo[]): KeepPlan {
  const attachNames: string[] = [];
  const missing: string[] = [];
  for (const raw of note.attachmentNames) {
    if (withFiles && assets.has(assetKey(raw))) attachNames.push(raw);
    else missing.push(raw);
  }
  const draft = toMemoDraft(note, opts, missing);
  const found = findExistingMemo(note, existing, draft.content);
  // 라벨을 가져오지 않기로 했으면 지금 붙은 라벨은 견주지도 바꾸지도 않는다 (V5 - V4는 라벨을 비웠다)
  const labels = opts.keepLabels ? draft.labels : (found?.labels ?? []);
  const action: KeepAction = !found ? 'add' : memoNeedsUpdate({ ...draft, labels, attachmentNames: attachNames }, found) ? 'update' : 'skip';
  return { note, draft, attachNames, missing, ...(found ? { found } : {}), action };
}
