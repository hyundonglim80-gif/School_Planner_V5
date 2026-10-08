// 구글 드라이브에 첨부·캡처를 올린다 (V4 lib/driveApi.ts의 첨부 부분 - 백업은 P8-3).
//
// 모두 내 드라이브의 'School_Planner' 폴더 한 곳에 둔다 - V4가 올린 파일도 거기 있어 V5에서 그대로 열린다
// (같은 클라우드 프로젝트의 drive.file 권한 - data/firebase 주석).
//
// ⚠️ 그림을 화면에 펼칠 때: 드라이브의 uc?export=download 주소는 <img>로 직접 불러오면 안내 페이지가 오기도 한다.
//    화면에는 thumbnail 주소를 쓴다(공식 문서에 없는 경로라 구글이 바꾸면 깨질 수 있다 - V4와 같다).
import { googleFetch, GoogleApiError, withGoogleToken } from './token';

export const DRIVE_FOLDER_NAME = 'School_Planner';

export interface DriveFile {
  id: string;
  name: string;
  webViewLink?: string;
  /** 내려받기 주소 */
  downloadLink: string;
}

/** 드라이브에 올린 그림을 화면에 펼칠 때의 주소 */
export function driveImageSrc(fileId: string, width = 1000): string {
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w${width}`;
}

/** 주소에서 드라이브 파일 id (없으면 null) */
export function driveFileIdOf(url: string | undefined | null): string | null {
  if (!url) return null;
  const m = url.match(/[?&]id=([A-Za-z0-9_-]+)/) || url.match(/\/file\/d\/([A-Za-z0-9_-]+)/) || url.match(/\/d\/([A-Za-z0-9_-]+)/);
  return m ? m[1] : null;
}

/**
 * 첨부를 그림으로 펼칠 때의 주소. 드라이브 것이면 thumbnail로(driveId가 없는 옛 것은 주소에서 id를 뽑는다),
 * 아니면(옛 Storage 주소 등) 그대로.
 */
export function attachmentImageSrc(att: { url?: string; driveId?: string } | null | undefined, width = 1000): string {
  if (!att?.url && !att?.driveId) return '';
  const id = att?.driveId || (att?.url?.includes('drive.google.com') ? driveFileIdOf(att.url) : null);
  return id ? driveImageSrc(id, width) : att?.url || '';
}

/**
 * 첨부 목록에 적을 주소: 그림이면 thumbnail, 그 밖은 내려받기 주소.
 * (V4가 V3와 함께 쓰려고 정한 모양 그대로 - V4에서 가져온 첨부와 같은 모양이 되게)
 */
export function driveUrlToStore(mimeType: string | undefined, file: DriveFile): string {
  return mimeType?.startsWith('image/') ? driveImageSrc(file.id) : file.downloadLink;
}

/** 올리기 실패를 알릴 때 붙일 까닭. 우리가 만든 안내(한글)만 붙이고 알 수 없는 것은 비운다. */
export function uploadFailReason(e: unknown): string {
  if (e instanceof TypeError) return '인터넷 연결을 확인해 주세요.';
  const m = e instanceof Error ? e.message : '';
  return /[가-힣]/.test(m) ? m.slice(0, 120) : '';
}

/** 드라이브 부르기 (본문 그대로). 거절하면 GoogleApiError - 401·권한 모자람은 needsLogin */
async function driveFetch(url: string, token: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(url, { ...init, headers: { Authorization: `Bearer ${token}`, ...(init?.headers || {}) } });
  if (res.ok) return res;
  const body = await res.text().catch(() => '');
  if (res.status === 401) throw new GoogleApiError(401, '구글 드라이브가 로그인을 받지 않았습니다 (401).');
  if (res.status === 403) {
    // 로그인할 때 드라이브 권한 칸을 빼고 허용한 토큰 - 다시 로그인하며 허용하면 된다
    if (/insufficient/i.test(body)) throw new GoogleApiError(403, '구글 드라이브 권한이 없습니다. 다시 로그인하며 드라이브 권한을 허용해 주세요.', true);
    if (/storageQuotaExceeded/i.test(body)) throw new GoogleApiError(403, '구글 드라이브 저장 공간이 가득 찼습니다.');
    throw new GoogleApiError(403, '구글 드라이브 접근 권한이 없습니다. 로그아웃 후 다시 로그인하실 때 드라이브 권한을 허용해 주세요.');
  }
  throw new GoogleApiError(res.status, `구글 드라이브 오류 ${res.status} ${body.slice(0, 200)}`);
}

/** School_Planner 폴더를 찾고, 없으면 만든다. 한 번 찾으면 이 탭에서 기억한다. */
let cachedFolderId: string | null = null;
export async function getOrCreateFolder(token: string): Promise<string> {
  if (cachedFolderId) return cachedFolderId;
  const q = encodeURIComponent(`mimeType='application/vnd.google-apps.folder' and name='${DRIVE_FOLDER_NAME}' and trashed=false`);
  const found = await googleFetch<{ files?: { id: string }[] }>(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)`, 'GET', token);
  if (found?.files?.length) return (cachedFolderId = found.files[0].id);
  const created = await googleFetch<{ id: string }>('https://www.googleapis.com/drive/v3/files', 'POST', token, {
    name: DRIVE_FOLDER_NAME,
    mimeType: 'application/vnd.google-apps.folder',
  });
  if (!created?.id) throw new Error('구글 드라이브에 School_Planner 폴더를 만들지 못했습니다.');
  return (cachedFolderId = created.id);
}

/** 시험용 - 폴더 기억을 지운다 */
export function forgetDriveFolder() {
  cachedFolderId = null;
}

async function uploadOnce(file: Blob, name: string, token: string): Promise<DriveFile> {
  const folderId = await getOrCreateFolder(token);
  const init = await driveFetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,webViewLink', token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: file.type || 'application/octet-stream', parents: [folderId] }),
  });
  const uploadUrl = init.headers.get('Location');
  if (!uploadUrl) throw new Error('업로드 주소를 받지 못했습니다.');
  const up = await fetch(uploadUrl, { method: 'PUT', body: file });
  if (up.status === 401) throw new GoogleApiError(401, '구글 드라이브가 로그인을 받지 않았습니다 (401).');
  if (!up.ok) throw new Error(`구글 드라이브 업로드 실패 ${up.status}`);
  const data = (await up.json()) as { id: string; name: string; webViewLink?: string };

  // '링크가 있는 사람은 볼 수 있음' - 기록·메모의 주소로 그림이 보이고 공유 공간의 다른 선생님도 연다.
  // 실패해도 올리기는 된 것이다(그림이 안 보일 수는 있다).
  await driveFetch(`https://www.googleapis.com/drive/v3/files/${data.id}/permissions`, token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'reader', type: 'anyone' }),
  }).catch((e: unknown) => console.warn('드라이브 공개 설정 실패(무시 가능):', e));

  return { id: data.id, name: data.name, webViewLink: data.webViewLink, downloadLink: `https://drive.google.com/uc?export=download&id=${data.id}` };
}

/**
 * 파일 하나를 드라이브에 올린다(원본 그대로 - 캡처는 글자가 많아 다시 그리면 뭉개진다).
 * 토큰은 사용자가 시킨 일이라 getValidGoogleToken - 만료면 로그인을 묻고, 겉보기만 살아 있던 토큰이면 잊고 한 번 더.
 */
export function uploadToDrive(file: Blob, name: string): Promise<DriveFile> {
  return withGoogleToken(undefined, (token) => uploadOnce(file, name, token));
}
