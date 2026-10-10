// 구글 Keep 메모 가져오기 - 넣기 (V4 KeepImportModal의 handleImport, P8-3). 셈은 domain/keepImport.
// 지금 공간의 메모로 넣는다. 딸린 사진·파일은 드라이브에 올려 첨부로(다른 첨부와 같은 자리), 못 올린 것은 본문 끝에 이름으로.
// 수백 건이 한꺼번에 들어가므로 되돌리기 더미에 넣지 않는다(백업 되살리기와 같다) - 400개씩 나눠 적는다.
import { create } from 'zustand';
import { makeAttachment } from '../../domain/attachments';
import { assetKey, keepIdOf, toMemoDraft, type KeepImportOptions, type KeepPlan } from '../../domain/keepImport';
import { cleanLabelName } from '../../domain/labels';
import { orderBetween } from '../../domain/order';
import { driveUrlToStore, uploadToDrive } from '../../data/google/drive';
import { GoogleAuthError } from '../../data/google/token';
import { ensureLabelOps } from '../../data/labels';
import { batch, newPath, writeOp, type WriteOp } from '../../data/repo';
import type { LabelDoc } from '../../data/select';
import type { Attachment } from '../../data/types';
import { itemPath, orderAfter, type ItemDoc } from '../events/eventOps';

/** 백업 탭에서 고른 Keep 파일을 '가져오기' 탭의 Keep 칸으로 넘긴다 (V4 '내보내기/가져오기' → Keep 창) */
export const useKeepInbox = create<{ files: File[] }>(() => ({ files: [] }));
export const sendToKeep = (files: File[]) => useKeepInbox.setState({ files });

export interface KeepRunResult {
  made: number;
  changed: number;
  skipped: number;
  uploaded: number;
  failedUpload: number;
  labelsAdded: number;
}

export function keepResultText(r: KeepRunResult): string {
  const tail = [
    r.changed > 0 ? `${r.changed}건은 바뀐 내용으로 고쳐 씀` : '',
    r.skipped > 0 ? `${r.skipped}건은 그대로라 건너뜀` : '',
    r.uploaded > 0 ? `사진·파일 ${r.uploaded}개 함께` : '',
    r.failedUpload > 0 ? `${r.failedUpload}개는 올리지 못해 이름만 남김` : '',
    r.labelsAdded > 0 ? `라벨 ${r.labelsAdded}개 새로 등록` : '',
  ]
    .filter(Boolean)
    .join(', ');
  return `Keep 메모 ${r.made}건을 가져왔습니다.${tail ? ` (${tail})` : ''}`;
}

/**
 * 넣는다. plans = planKeepNote 결과(미리보기와 같은 것), labels = 이 공간의 메모·기록 라벨(살아 있는 것), memoList = 지금 메모(차례).
 * 도중에 끊기면 그때까지 적은 것은 남는다 - 던지는 오류에 들어간 수를 붙인다.
 */
export async function runKeepImport(opts: {
  sid: string;
  plans: KeepPlan[];
  assets: ReadonlyMap<string, File>;
  options: KeepImportOptions;
  labels: readonly LabelDoc[];
  memoList: readonly ItemDoc[];
  items: Readonly<Record<string, ItemDoc>>;
  onStep?: (msg: string) => void;
}): Promise<KeepRunResult> {
  const { sid, plans, assets, options, labels, memoList, items, onStep } = opts;
  const r: KeepRunResult = { made: 0, changed: 0, skipped: 0, uploaded: 0, failedUpload: 0, labelsAdded: 0 };

  // 라벨: Keep에서 쓰던 라벨을 메모·기록 라벨 목록에 (없는 이름만 새로) - 넣을 메모의 라벨만
  const touch = plans.filter((p) => p.action !== 'skip');
  r.skipped = plans.length - touch.length;
  const names = options.keepLabels ? [...new Set(touch.flatMap((p) => p.draft.labels.map(cleanLabelName)).filter(Boolean))] : [];
  const made = ensureLabelOps(sid, 'note', names, labels);
  const idOf = new Map(names.map((n, i) => [n, made.ids[i]]));
  r.labelsAdded = made.ops.length;

  let pending: WriteOp[] = [...made.ops];
  let written = 0;
  const flush = async (force = false) => {
    if (!force && pending.length < 400) return;
    if (pending.length === 0) return;
    await batch(pending, { fail: `Keep 메모를 다 넣지 못했습니다 (${written}건까지 들어갔습니다). 다시 가져오면 들어간 것은 건너뜁니다.` });
    pending = [];
  };

  // 같은 파일을 두 메모가 함께 달고 있을 수 있다 - 한 번만 올린다
  const cache = new Map<string, Attachment>();
  let loginRefused = false;
  let order = orderAfter(memoList);
  let first = true;
  // 만든 차례대로 (새 메모는 목록 끝에 붙으니 옛 것부터 넣어야 Keep의 차례와 비슷하다)
  const ordered = [...touch].sort((a, b) => a.note.createdAt - b.note.createdAt);
  for (const plan of ordered) {
    const attachments: Attachment[] = [];
    const missing = [...plan.missing];
    for (const raw of plan.attachNames) {
      const key = assetKey(raw);
      const file = assets.get(key);
      if (!file) {
        missing.push(raw);
        continue;
      }
      const already = cache.get(key);
      if (already) {
        attachments.push(already);
        continue;
      }
      if (loginRefused) {
        r.failedUpload += 1;
        missing.push(raw);
        continue;
      }
      try {
        onStep?.(`사진·파일 올리는 중… ${file.name}`);
        const drive = await uploadToDrive(file, file.name);
        const att = makeAttachment({ name: file.name, type: file.type || 'application/octet-stream', size: file.size }, driveUrlToStore(file.type, drive), drive.id, cache.size);
        cache.set(key, att);
        attachments.push(att);
        r.uploaded += 1;
      } catch (e) {
        // 올리기가 막혀도 메모는 들어가야 한다 - 어떤 파일이었는지는 글로 남긴다
        console.error('Keep 첨부 올리기 실패:', e);
        if (e instanceof GoogleAuthError) loginRefused = true;
        r.failedUpload += 1;
        missing.push(raw);
      }
    }
    onStep?.('');
    const draft = toMemoDraft(plan.note, options, missing);
    const keepId = keepIdOf(plan.note);
    const found = plan.found ? items[plan.found.id] : undefined;
    if (plan.action === 'update' && found) {
      const labelIds = options.keepLabels ? draft.labels.map((n) => idOf.get(cleanLabelName(n))).filter((id): id is string => !!id) : found.labelIds;
      const changes: Record<string, unknown> = {};
      if (draft.content !== found.text) changes.text = draft.content;
      if (JSON.stringify(labelIds) !== JSON.stringify(found.labelIds ?? [])) changes.labelIds = labelIds;
      // 붙일 것이 없으면 칸을 빼서, 지워진 첨부가 남지 않게 (V4 그대로)
      if (JSON.stringify(attachments) !== JSON.stringify(found.attachments ?? [])) changes.attachments = attachments.length > 0 ? attachments : undefined;
      if (found.keepId !== keepId) changes.keepId = keepId;
      if (Object.keys(changes).length > 0) pending.push(writeOp.patch(itemPath(sid, found.id), changes, found));
      r.changed += 1;
    } else {
      if (!first) order = orderBetween(order, null);
      first = false;
      const labelIds = draft.labels.map((n) => idOf.get(cleanLabelName(n))).filter((id): id is string => !!id);
      pending.push(
        writeOp.create(newPath(sid, 'items'), {
          kind: 'note',
          date: null,
          text: draft.content,
          labelIds: [...new Set(labelIds)],
          order,
          keepId,
          ...(attachments.length > 0 ? { attachments } : {}),
        }),
      );
      r.made += 1;
    }
    written = r.made + r.changed;
    await flush();
  }
  await flush(true);
  return r;
}
