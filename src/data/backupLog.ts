// 드라이브 자동 백업의 마지막 기록 (P8-3) - 개인 공간 settings/backupLog. 백업이 적고(features/backup/auto), 띠·백업 탭이 지켜본다.
import { doc, onSnapshot } from 'firebase/firestore';
import { readBackupLog, type BackupLog } from '../domain/autoBackup';
import { db } from './firebase';
import { personalSpaceId } from './space';

export const BACKUP_LOG_ID = 'backupLog';

export function watchBackupLog(uid: string, onData: (log: BackupLog) => void): () => void {
  return onSnapshot(
    doc(db, 'spaces', personalSpaceId(uid), 'settings', BACKUP_LOG_ID),
    (snap) => onData(readBackupLog(snap.data())),
    (e) => console.warn('자동 백업 기록을 읽지 못했습니다:', e),
  );
}
