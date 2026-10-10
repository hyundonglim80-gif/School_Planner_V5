// 드라이브 자동 백업 (V4 hooks/useAutoBackup.ts·lib/autoBackup.ts, P8-3).
//
// - PC에서만. 마지막 백업에서 정한 날(처음 7일)이 지났고 구글 권한(토큰)이 **이미** 있으면 개인 공간 전체를 V5 백업 JSON으로
//   드라이브 School_Planner/백업 폴더에 공개하지 않고 올린다. 최근 N개(처음 8개)만 남기고 오래된 것은 드라이브 휴지통으로.
// - 권한 창은 띄우지 않는다(시키지 않은 로그인 창 금지). 앱을 연 채 30분마다 다시 본다. 3일 넘게 밀리면 본문 위 띠가 '지금 백업'을 권한다.
// - 고르는 것은 계정 설정 common.autoBackup, 마지막 백업은 settings/backupLog(백업이 적는다 - 기기마다 같은 것을 본다).
import { useCallback, useEffect, useRef, useState } from 'react';
import { create } from 'zustand';
import { detectDeviceKind, useCommonSettings } from '../../app/prefs';
import { showErrorToast, showToast } from '../../app/toast';
import { backupFileName, backupsToTrash, overdueDays, isBackupDue, shouldNag, type BackupLog } from '../../domain/autoBackup';
import { BACKUP_KINDS, countBackup, describeCounts } from '../../domain/backup';
import { buildBackup } from '../../data/backup';
import { BACKUP_LOG_ID, watchBackupLog } from '../../data/backupLog';
import { getOrCreateBackupFolder, listBackupFiles, trashDriveFile, uploadPrivateJson } from '../../data/google/driveBackup';
import { getGoogleTokenQuietly, withGoogleToken } from '../../data/google/token';
import { batch, writeOp } from '../../data/repo';
import { useSession } from '../../data/session';
import { personalSpaceId } from '../../data/space';

const RECHECK_MS = 30 * 60 * 1000;
const SNOOZE_KEY = 'sp5-auto-backup-snooze';

/** 마지막 백업 (계정에 하나) + 지금 하는 일 */
export const useBackupLog = create<{ log: BackupLog; loaded: boolean; busy: string }>(() => ({ log: {}, loaded: false, busy: '' }));

/** 마지막 백업 문서를 지켜본다 (띠·백업 탭이 함께 - 처음 부른 곳이 켜고 마지막이 끈다) */
let watchers = 0;
let stopWatch: (() => void) | null = null;
export function useBackupLogWatch() {
  const uid = useSession((s) => s.user?.uid);
  useEffect(() => {
    if (!uid) return;
    watchers += 1;
    if (watchers === 1) {
      stopWatch = watchBackupLog(uid, (log) => useBackupLog.setState({ log, loaded: true }));
    }
    return () => {
      watchers -= 1;
      if (watchers === 0) {
        stopWatch?.();
        stopWatch = null;
        useBackupLog.setState({ log: {}, loaded: false });
      }
    };
  }, [uid]);
}

export interface BackupRunResult {
  name: string;
  summary: string;
  trashed: number;
}

/** 한 번에 하나만 (자동과 '지금 백업'이 겹치지 않게, 탭 안에서) */
let inFlight = false;

/** 지금 백업한다 - 실패하면 던진다(마지막 백업 시각은 성공했을 때만 고친다) */
async function runDriveBackup(uid: string, token: string, keep: number): Promise<BackupRunResult> {
  const sid = personalSpaceId(uid);
  const step = (busy: string) => useBackupLog.setState({ busy });
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

/** '지금 백업' - 사용자가 눌렀을 때(권한을 물어도 된다). 성공하면 true */
export async function backupNow(): Promise<boolean> {
  const uid = useSession.getState().user?.uid;
  if (!uid) return false;
  if (inFlight) {
    showToast('백업이 이미 진행 중입니다.');
    return false;
  }
  inFlight = true;
  try {
    const keep = useCommonSettings.getState().autoBackup.keep;
    const r = await withGoogleToken('드라이브에 백업하려면 구글 로그인이 필요합니다.', (token) => runDriveBackup(uid, token, keep));
    showToast(`✅ 드라이브에 백업했습니다: ${r.name}${r.summary ? ` (${r.summary})` : ''}`, 5000);
    return true;
  } catch (e) {
    showErrorToast('드라이브에 백업하지 못했습니다.', e);
    return false;
  } finally {
    inFlight = false;
    useBackupLog.setState({ busy: '' });
  }
}

function snoozedNow(): boolean {
  try {
    return Number(localStorage.getItem(SNOOZE_KEY) || 0) > Date.now();
  } catch {
    return false;
  }
}

/**
 * 띠(AutoBackupBanner)가 한 번 부른다 - 할 때가 되면 조용히 백업하고, 띠를 띄울지(nag)와 '나중에'(snooze)를 준다.
 */
export function useAutoBackupRunner() {
  useBackupLogWatch();
  const uid = useSession((s) => s.user?.uid);
  const settings = useCommonSettings((s) => s.autoBackup);
  const { log, loaded } = useBackupLog();
  const isPc = detectDeviceKind() === 'pc';
  const [snoozed, setSnoozed] = useState(snoozedNow);
  // 띠와 자동 실행이 보는 '지금' - 30분마다 다시 잰다
  const [now, setNow] = useState(() => Date.now());
  // 조용히 해 보았나 - 해 보기 전에는 띠를 띄우지 않는다(열자마자 백업할 수 있는데 띠가 번쩍이지 않게)
  const [tried, setTried] = useState(false);
  const failedAt = useRef(0);

  useEffect(() => {
    if (!isPc) return;
    const id = window.setInterval(() => setNow(Date.now()), RECHECK_MS);
    return () => window.clearInterval(id);
  }, [isPc]);

  useEffect(() => {
    if (!isPc || !loaded || !uid || inFlight) return;
    if (!isBackupDue(settings, log, now)) return;
    // 방금 실패했으면 다음 판까지 기다린다 (실패를 되풀이하며 드라이브를 두드리지 않게)
    if (Date.now() - failedAt.current < RECHECK_MS) return;
    let cancelled = false;
    void (async () => {
      const token = await getGoogleTokenQuietly();
      if (cancelled || inFlight) return;
      if (!token) return setTried(true);
      inFlight = true;
      try {
        const r = await runDriveBackup(uid, token, settings.keep);
        showToast(`💾 드라이브에 자동 백업했습니다${r.summary ? ` (${r.summary})` : ''}`, 4000);
      } catch (e) {
        failedAt.current = Date.now();
        console.warn('자동 백업에 실패했습니다:', e);
      } finally {
        inFlight = false;
        useBackupLog.setState({ busy: '' });
        setTried(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isPc, loaded, uid, settings, log, now]);

  const snooze = useCallback(() => {
    try {
      localStorage.setItem(SNOOZE_KEY, String(Date.now() + 24 * 60 * 60 * 1000));
    } catch {
      /* 시크릿 모드 등 - 이번 화면에서만 */
    }
    setSnoozed(true);
  }, []);

  return {
    nag: isPc && loaded && tried && !snoozed && shouldNag(settings, log, now),
    overdue: overdueDays(settings, log, now),
    snooze,
  };
}
