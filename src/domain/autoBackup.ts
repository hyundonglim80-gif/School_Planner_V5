// 드라이브 자동 백업의 셈 (V4 lib/autoBackup.ts 그대로 - 파일 이름만 SP5).
// 고르는 것(켜기·주기·남길 개수)은 계정 설정 common.autoBackup, 마지막 백업은 개인 공간 settings/backupLog(features/backup/auto).
import { formatDate } from './dateUtils';

export interface AutoBackupSettings {
  enabled: boolean;
  /** 며칠마다 */
  intervalDays: number;
  /** 몇 개까지 남기나 */
  keep: number;
}

/** 마지막 백업 (settings/backupLog) */
export interface BackupLog {
  /** 마지막으로 백업한 때 (ms) */
  lastAt?: number;
  lastName?: string;
  /** 무엇이 몇 건 들었나 (안내용) */
  lastSummary?: string;
  /** 백업 폴더 주소 (드라이브에서 열기) */
  folderLink?: string;
}

export const DEFAULT_AUTO_BACKUP: AutoBackupSettings = { enabled: true, intervalDays: 7, keep: 8 };
export const INTERVAL_CHOICES = [7, 14, 30] as const;
export const KEEP_CHOICES = [4, 8, 12] as const;
/** 할 때가 지나고도 이만큼 더 밀리면 화면 위에 '지금 백업' 띠를 띄운다 */
export const NAG_AFTER_DAYS = 3;
/** 드라이브 School_Planner/백업 폴더 (V4와 같은 폴더 - 이름 앞이 달라 서로의 파일을 지우지 않는다) */
export const BACKUP_FOLDER_NAME = '백업';
export const BACKUP_FILE_PREFIX = 'SP5_자동백업_';

const DAY = 86_400_000;

/** 저장된 모양을 믿지 않고 고쳐 읽는다 (설정 칸 read) */
export function sanitizeAutoBackup(raw: unknown): AutoBackupSettings | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  const pick = <T extends number>(v: unknown, choices: readonly T[], dflt: T): T => (choices.includes(Number(v) as T) ? (Number(v) as T) : dflt);
  return {
    enabled: o.enabled !== false,
    intervalDays: pick(o.intervalDays, INTERVAL_CHOICES, 7),
    keep: pick(o.keep, KEEP_CHOICES, 8),
  };
}

export function readBackupLog(raw: unknown): BackupLog {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    ...(typeof o.lastAt === 'number' ? { lastAt: o.lastAt } : {}),
    ...(typeof o.lastName === 'string' && o.lastName ? { lastName: o.lastName } : {}),
    ...(typeof o.lastSummary === 'string' && o.lastSummary ? { lastSummary: o.lastSummary } : {}),
    ...(typeof o.folderLink === 'string' && o.folderLink ? { folderLink: o.folderLink } : {}),
  };
}

/** 지금 백업할 때인가 (한 번도 안 했으면 그렇다) */
export function isBackupDue(s: AutoBackupSettings, log: BackupLog, now: number): boolean {
  if (!s.enabled) return false;
  return !log.lastAt || now - log.lastAt >= s.intervalDays * DAY;
}

/** 할 때가 지나고 며칠 더 밀렸나 (할 때가 아니면 0). 한 번도 안 했으면 Infinity */
export function overdueDays(s: AutoBackupSettings, log: BackupLog, now: number): number {
  if (!isBackupDue(s, log, now)) return 0;
  if (!log.lastAt) return Infinity;
  return Math.floor((now - log.lastAt - s.intervalDays * DAY) / DAY);
}

/** 띠를 띄울 만큼 밀렸나 */
export function shouldNag(s: AutoBackupSettings, log: BackupLog, now: number): boolean {
  return overdueDays(s, log, now) >= NAG_AFTER_DAYS;
}

/** 오늘 이미 같은 이름이 있으면 시각을 붙인다 ('지금 백업'을 하루에 여러 번 눌러도 덮지 않게) */
export function backupFileName(now: Date, existing: string[]): string {
  const base = `${BACKUP_FILE_PREFIX}${formatDate(now)}`;
  if (!existing.includes(`${base}.json`)) return `${base}.json`;
  const hhmm = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
  return `${base}_${hhmm}.json`;
}

/** 남길 것보다 오래된 것들 (목록은 최신 것부터, 적어도 하나는 늘 남긴다) */
export function backupsToTrash<T>(newestFirst: T[], keep: number): T[] {
  return newestFirst.slice(Math.max(1, keep));
}
