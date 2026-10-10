// 드라이브 자동 백업 파일 (V4 lib/driveApi.ts의 백업 부분). School_Planner/백업 폴더에 **공개하지 않고** 올린다.
// V4와 같은 폴더다 - 이름 앞(SP5_자동백업_)으로 V5 것만 훑고 지운다.
import { BACKUP_FILE_PREFIX, BACKUP_FOLDER_NAME } from '../../domain/autoBackup';
import { driveFetch, getOrCreateFolder } from './drive';
import { GoogleApiError } from './token';

export interface DriveBackupFile {
  id: string;
  name: string;
  createdTime?: string;
  webViewLink?: string;
}

/** School_Planner 안의 '백업' 폴더를 찾고, 없으면 만든다 */
export async function getOrCreateBackupFolder(token: string): Promise<{ id: string; webViewLink?: string }> {
  const parent = await getOrCreateFolder(token);
  const q = encodeURIComponent(`mimeType='application/vnd.google-apps.folder' and name='${BACKUP_FOLDER_NAME}' and '${parent}' in parents and trashed=false`);
  const res = await driveFetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,webViewLink)`, token);
  const data = (await res.json()) as { files?: Array<{ id: string; webViewLink?: string }> };
  if (data.files?.length) return { id: data.files[0].id, webViewLink: data.files[0].webViewLink };
  const created = await driveFetch('https://www.googleapis.com/drive/v3/files?fields=id,webViewLink', token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: BACKUP_FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder', parents: [parent] }),
  });
  const c = (await created.json()) as { id: string; webViewLink?: string };
  return { id: c.id, webViewLink: c.webViewLink };
}

/** 백업 폴더의 V5 자동 백업 파일들 (최신 것부터) */
export async function listBackupFiles(token: string, folderId: string): Promise<DriveBackupFile[]> {
  const q = encodeURIComponent(`'${folderId}' in parents and trashed=false and name contains '${BACKUP_FILE_PREFIX}'`);
  const res = await driveFetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&orderBy=createdTime%20desc&pageSize=100&fields=files(id,name,createdTime,webViewLink)`,
    token,
  );
  const data = (await res.json()) as { files?: DriveBackupFile[] };
  // 이름 앞까지 맞는 것만 ('contains'는 가운데에 든 것도 준다)
  return Array.isArray(data.files) ? data.files.filter((f) => f.name.startsWith(BACKUP_FILE_PREFIX)) : [];
}

/** JSON 하나를 공개하지 않고 올린다 */
export async function uploadPrivateJson(token: string, folderId: string, name: string, json: string): Promise<DriveBackupFile> {
  const init = await driveFetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,webViewLink', token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: 'application/json', parents: [folderId] }),
  });
  const uploadUrl = init.headers.get('Location');
  if (!uploadUrl) throw new Error('업로드 주소를 받지 못했습니다.');
  const up = await fetch(uploadUrl, { method: 'PUT', body: new Blob([json], { type: 'application/json' }) });
  if (up.status === 401) throw new GoogleApiError(401, '구글 드라이브가 로그인을 받지 않았습니다 (401).');
  if (!up.ok) throw new Error(`구글 드라이브 업로드 실패 ${up.status}`);
  return (await up.json()) as DriveBackupFile;
}

/** 드라이브 휴지통으로 보낸다 (드라이브에서 30일 동안 되살릴 수 있다) */
export async function trashDriveFile(token: string, fileId: string): Promise<void> {
  await driveFetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, token, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ trashed: true }),
  });
}
