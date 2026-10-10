import { describe, expect, it } from 'vitest';
import { backupFileName, backupsToTrash, isBackupDue, overdueDays, readBackupLog, sanitizeAutoBackup, shouldNag } from './autoBackup';

// 드라이브 자동 백업 (V4 lib/autoBackup.test.ts의 셈 부분)
const DAY = 86_400_000;
const NOW = new Date(2026, 9, 1, 9, 0).getTime();

describe('설정 읽기', () => {
  it('이상한 값은 기본(켜짐·7일·8개)으로, 모양이 아니면 undefined(= 기본값)', () => {
    expect(sanitizeAutoBackup(undefined)).toBeUndefined();
    expect(sanitizeAutoBackup({ enabled: false, intervalDays: 3, keep: 100, lastAt: 5 })).toEqual({ enabled: false, intervalDays: 7, keep: 8 });
    expect(sanitizeAutoBackup({ intervalDays: 14, keep: 4 })).toEqual({ enabled: true, intervalDays: 14, keep: 4 });
  });
  it('마지막 백업 기록은 맞는 칸만', () => {
    expect(readBackupLog({ lastAt: 5, lastName: 'a.json', lastSummary: '', folderLink: 3 })).toEqual({ lastAt: 5, lastName: 'a.json' });
    expect(readBackupLog(undefined)).toEqual({});
  });
});

describe('언제 백업하나', () => {
  const base = { enabled: true, intervalDays: 7, keep: 8 };
  it('한 번도 안 했으면 지금, 정한 날 수가 지났으면 지금', () => {
    expect(isBackupDue(base, {}, NOW)).toBe(true);
    expect(isBackupDue(base, { lastAt: NOW - 6 * DAY }, NOW)).toBe(false);
    expect(isBackupDue(base, { lastAt: NOW - 7 * DAY }, NOW)).toBe(true);
    expect(isBackupDue({ ...base, enabled: false }, {}, NOW)).toBe(false);
  });

  it('할 때를 3일 넘기면 띠를 띄운다', () => {
    expect(overdueDays(base, { lastAt: NOW - 9 * DAY }, NOW)).toBe(2);
    expect(shouldNag(base, { lastAt: NOW - 9 * DAY }, NOW)).toBe(false);
    expect(shouldNag(base, { lastAt: NOW - 10 * DAY }, NOW)).toBe(true);
    expect(shouldNag(base, {}, NOW)).toBe(true); // 한 번도 안 했다
    expect(shouldNag({ ...base, enabled: false }, {}, NOW)).toBe(false);
  });

  it('같은 날 두 번째 백업은 시각을 붙여 덮지 않는다 (V4 파일과 이름 앞이 다르다)', () => {
    const now = new Date(2026, 9, 1, 14, 5);
    expect(backupFileName(now, [])).toBe('SP5_자동백업_2026-10-01.json');
    expect(backupFileName(now, ['SP5_자동백업_2026-10-01.json'])).toBe('SP5_자동백업_2026-10-01_1405.json');
    expect(backupFileName(now, ['SP4_자동백업_2026-10-01.json'])).toBe('SP5_자동백업_2026-10-01.json');
  });

  it('최신 N개만 남기고, 적어도 하나는 늘 남긴다', () => {
    expect(backupsToTrash([1, 2, 3, 4, 5], 3)).toEqual([4, 5]);
    expect(backupsToTrash([1, 2], 8)).toEqual([]);
    expect(backupsToTrash([1, 2], 0)).toEqual([2]);
  });
});
