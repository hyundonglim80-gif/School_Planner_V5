// 드라이브 백업 한 번 (auto.ts에서 떼어 냄 - P25-1 첫 화면 JS). 자료 모으기(data/backup)·드라이브 올리기는 백업할 때만 나눠 받는다.
// 부르는 곳은 auto.ts 둘뿐(자동 백업·'지금 백업') - 한 번에 하나만은 그쪽(inFlight)이 지킨다.
import { backupFileName, backupsToTrash } from '../../domain/autoBackup';
import { BACKUP_KINDS, countBackup, describeCounts } from '../../domain/backup';
import { buildBackup } from '../../data/backup';
import { BACKUP_LOG_ID } from '../../data/backupLog';
import { getOrCreateBackupFolder, listBackupFiles, trashDriveFile, uploadPrivateJson } from '../../data/google/driveBackup';
import { batch, writeOp } from '../../data/repo';
import { personalSpaceId } from '../../data/space';

export interface BackupRunResult {
  name: string;
  summary: string;
  trashed: number;
}

/** 지금 백업한다 - 실패하면 던진다(마지막 백업 시각은 성공했을 때만 고친다). step = 지금 하는 일(진행 글) */
export async function runDriveBackup(uid: string, token: string, keep: number, step: (busy: string) => void): Promise<BackupRunResult> {
  const sid = personalSpaceId(uid);
  step('백업할 자료를 모으는 중…');
  const file = await buildBackup(
    sid,
    '개인',
    BACKUP_KINDS.map((k) => k.key),
    null,
  );
  file.auto = true;
  const summary = describeCounts(countBackup(file.colls));

  step('드라이브에 올리는 중…');
  const folder = await getOrCreateBackupFolder(token);
  const before = await listBackupFiles(token, folder.id);
  const name = backupFileName(new Date(), before.map((f) => f.name));
  await uploadPrivateJson(token, folder.id, name, JSON.stringify(file));

  // 오래된 것 정리 - 실패해도 백업은 됐다
  let trashed = 0;
  try {
    const after = await listBackupFiles(token, folder.id);
    for (const f of backupsToTrash(after, keep)) {
      await trashDriveFile(token, f.id);
      trashed += 1;
    }
  } catch (e) {
    console.warn('오래된 자동 백업을 정리하지 못했습니다:', e);
  }

  const log: Record<string, unknown> = { lastAt: Date.now(), lastName: name, ...(summary ? { lastSummary: summary } : {}), ...(folder.webViewLink ? { folderLink: folder.webViewLink } : {}) };
  await batch([writeOp.merge({ sid, coll: 'settings', id: BACKUP_LOG_ID }, log, null)], { fail: '드라이브에는 올렸지만 마지막 백업 시각을 적지 못했습니다.' });
  return { name, summary, trashed };
}
