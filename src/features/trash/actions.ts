// 휴지통 쓰기 (V4 TrashModal·trashRestore·trashRetention). 되살리기 = 지운 표시 걷기, 영구 삭제 = 문서 지우기(purge - 휴지통에서만).
//   - 일정·기록·메모·라벨은 저장 도우미 한 묶음(되살리기는 안내의 되돌리기·Ctrl+Z로 다시 지운다). D-Day는 계정 설정, 클립보드는 이 기기.
//   - 영구 삭제는 되돌릴 수 없다(묻는 것은 창이). 붙어 있던 드라이브 첨부는 V5에서 올린 것만 정리한다(trashList.driveFilesToClean):
//     누른 때는 구글 로그인을 물을 수 있고(withGoogleToken), 자동 비우기는 조용한 토큰이 있을 때만 - 없으면 파일은 드라이브에 남는다.
import { setCommonSetting, useCommonSettings } from '../../app/prefs';
import { showToast } from '../../app/toast';
import { getGoogleTokenQuietly, googleFetch, withGoogleToken } from '../../data/google/token';
import { batch, writeOp, type WriteOp } from '../../data/repo';
import type { Docs } from '../../data/select';
import { recordUndo } from '../../data/undo';
import { deleteClipTrash, restoreClipFromTrash } from '../../data/clipboard';
import { purgeDDay, restoreDDay } from '../../domain/dday';
import { driveFilesToClean, type TrashEntry } from './trashList';

const itemAt = (sid: string, id: string) => ({ sid, coll: 'items' as const, id });
const labelAt = (sid: string, id: string) => ({ sid, coll: 'labels' as const, id });
const timetableAt = (sid: string, id: string) => ({ sid, coll: 'timetables' as const, id });
const progressAt = (sid: string, id: string) => ({ sid, coll: 'progress' as const, id });
const classAt = (sid: string, id: string) => ({ sid, coll: 'classes' as const, id });
const seatingAt = (sid: string, id: string) => ({ sid, coll: 'seating' as const, id });
const evalAt = (sid: string, id: string) => ({ sid, coll: 'evaluations' as const, id });

/** 휴지통이 보는 문서 묶음 (useTrashDocs) */
export interface TrashDocs {
  items: Docs<'items'>;
  labels: Docs<'labels'>;
  timetables: Docs<'timetables'>;
  progress: Docs<'progress'>;
  classes: Docs<'classes'>;
  seating: Docs<'seating'>;
  evaluations: Docs<'evaluations'>;
}

/** 되살리기 (여럿) - 되살린 수 */
export async function restoreEntries(sid: string, entries: readonly TrashEntry[]): Promise<number> {
  const ops: WriteOp[] = [];
  for (const e of entries) {
    if (e.kind === 'label') ops.push(writeOp.restore(labelAt(sid, e.id)));
    else if (e.kind === 'timetable') ops.push(writeOp.restore(timetableAt(sid, e.id)));
    else if (e.kind === 'progress') ops.push(writeOp.restore(progressAt(sid, e.id)));
    else if (e.kind === 'class') ops.push(writeOp.restore(classAt(sid, e.id)));
    else if (e.kind === 'seating') ops.push(writeOp.restore(seatingAt(sid, e.id)));
    else if (e.kind === 'evaluation') ops.push(writeOp.restore(evalAt(sid, e.id)));
    else if (e.kind === 'event' || e.kind === 'journal' || e.kind === 'memo') ops.push(writeOp.restore(itemAt(sid, e.id)));
  }
  const undo = ops.length ? await batch(ops, { fail: '되살리지 못했습니다.' }) : [];
  // D-Day·클립보드 (계정 설정·이 기기)
  const dd = entries.filter((e) => e.kind === 'dday');
  if (dd.length) {
    const s = useCommonSettings.getState();
    let st = { list: s.ddays, pick: s.ddayPick };
    for (const e of dd) st = restoreDDay(st, e.id, null);
    setCommonSetting('ddays', st.list);
  }
  for (const e of entries) if (e.kind === 'clip') await restoreClipFromTrash(e.id);
  recordUndo(sid, entries.length === 1 ? '✅ 복원했습니다.' : `✅ ${entries.length}개를 복원했습니다.`, undo, { what: '휴지통에서 복원' });
  return entries.length;
}

/** 드라이브 파일 지우기 - 지운 수 (못 지운 것은 세지 않는다) */
async function deleteDriveFiles(ids: readonly string[], token: string): Promise<number> {
  let n = 0;
  for (const id of ids) {
    try {
      await googleFetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}`, 'DELETE', token);
      n++;
    } catch (e) {
      // 토큰이 만료됐으면 withGoogleToken이 다시 받아 한 번 더 (처음부터 - 이미 지운 것은 404로 센다)
      if ((e as { needsLogin?: boolean })?.needsLogin) throw e;
      // 이미 없는 파일(404)은 지운 것으로 친다
      if ((e as { status?: number })?.status === 404) n++;
      else console.warn('드라이브 파일을 지우지 못했습니다.', id, e);
    }
  }
  return n;
}

/**
 * 영구 삭제 (여럿) - 문서를 지우고 V5에서 올린 첨부를 드라이브에서 정리한다. 지운 수.
 * interactive = 누른 때(구글 로그인을 물을 수 있다) · 아니면 조용한 토큰이 있을 때만.
 */
export async function purgeEntries(sid: string, entries: readonly TrashEntry[], docs: TrashDocs, interactive: boolean): Promise<number> {
  const { items, labels, timetables, progress, classes, seating, evaluations } = docs;
  const ops: WriteOp[] = [];
  const purgedItems = [];
  for (const e of entries) {
    if (e.kind === 'label' && labels[e.id]) ops.push(writeOp.purge(labelAt(sid, e.id), labels[e.id]));
    else if (e.kind === 'timetable' && timetables[e.id]) ops.push(writeOp.purge(timetableAt(sid, e.id), timetables[e.id]));
    else if (e.kind === 'progress' && progress[e.id]) ops.push(writeOp.purge(progressAt(sid, e.id), progress[e.id]));
    else if (e.kind === 'class' && classes[e.id]) ops.push(writeOp.purge(classAt(sid, e.id), classes[e.id]));
    else if (e.kind === 'seating' && seating[e.id]) ops.push(writeOp.purge(seatingAt(sid, e.id), seating[e.id]));
    else if (e.kind === 'evaluation' && evaluations[e.id]) ops.push(writeOp.purge(evalAt(sid, e.id), evaluations[e.id]));
    else if ((e.kind === 'event' || e.kind === 'journal' || e.kind === 'memo') && items[e.id]) {
      ops.push(writeOp.purge(itemAt(sid, e.id), items[e.id]));
      purgedItems.push(items[e.id]);
    }
  }
  if (ops.length) await batch(ops, { fail: '영구 삭제하지 못했습니다.' });
  const dd = entries.filter((e) => e.kind === 'dday');
  if (dd.length) {
    const s = useCommonSettings.getState();
    let st = { list: s.ddays, pick: s.ddayPick };
    for (const e of dd) st = purgeDDay(st, e.id);
    setCommonSetting('ddays', st.list);
  }
  const clips = entries.filter((e) => e.kind === 'clip').map((e) => e.id);
  if (clips.length) await deleteClipTrash(clips);

  // 드라이브 첨부 정리 (문서는 이미 지웠다 - 파일 정리가 안 되어도 영구 삭제는 끝난 것)
  const gone = new Set(purgedItems.map((it) => it.id));
  const files = driveFilesToClean(
    purgedItems,
    Object.values(items).filter((it) => !gone.has(it.id)),
  );
  if (files.length) {
    if (interactive) {
      try {
        const n = await withGoogleToken('휴지통의 첨부 파일을 드라이브에서 정리하려면 구글 로그인이 필요합니다.', (t) => deleteDriveFiles(files, t));
        if (n < files.length) showToast(`첨부 파일 ${files.length - n}개는 드라이브에서 지우지 못했습니다. 드라이브 School_Planner 폴더에 남아 있습니다.`);
      } catch {
        showToast(`첨부 파일 ${files.length}개는 드라이브에 남겼습니다 (구글 로그인이 없어 정리하지 못했습니다).`);
      }
    } else {
      const token = await getGoogleTokenQuietly();
      if (token) await deleteDriveFiles(files, token).catch(() => 0);
    }
  }
  return entries.length;
}

const LAST_RUN_KEY = 'sp5-trash-auto-last';
const DAY_MS = 86_400_000;

/** 자동 비우기 - 앱을 열 때 하루 한 번 (이 기기 기준, V4 그대로). 지운 수 */
export async function autoEmptyTrash(sid: string, expired: readonly TrashEntry[], docs: TrashDocs, now = Date.now()): Promise<number> {
  try {
    const last = Number(localStorage.getItem(LAST_RUN_KEY) || 0);
    if (now - last < DAY_MS) return 0;
    localStorage.setItem(LAST_RUN_KEY, String(now));
  } catch {
    /* 기억 못 하면 열 때마다 - 지울 것이 없으면 아무 일도 하지 않는다 */
  }
  if (expired.length === 0) return 0;
  try {
    return await purgeEntries(sid, expired, docs, false);
  } catch {
    return 0;
  }
}
