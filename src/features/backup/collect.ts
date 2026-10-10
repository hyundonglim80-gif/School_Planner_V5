// 첨부 모으기 - 넣기 (V4 lib/driveMigration.ts runDriveMigration, P8-3). 셈은 domain/attachCollect.
// 한 건: 내려받기 → 드라이브에 올리기(공개 읽기 - 다른 첨부와 같다) → V5 문서의 주소 바꾸기. Storage 원본은 지우지 않는다(V4가 쓴다).
// 내려받기가 막히면(버킷 CORS) 파일마다 같은 말을 쌓지 않고 한 번 알리고 멈춘다. 실패한 건은 옛 주소 그대로 둔다.
import { changesForNewUrls, collectStorageFiles } from '../../domain/attachCollect';
import { driveUrlToStore, uploadToDrive } from '../../data/google/drive';
import { GoogleAuthError } from '../../data/google/token';
import { batch, writeOp } from '../../data/repo';
import type { Docs } from '../../data/select';

type Coll = 'items' | 'lessonDays';

export interface CollectTarget {
  coll: Coll;
  id: string;
  data: Record<string, unknown>;
  files: ReturnType<typeof collectStorageFiles>;
}

/** 이 공간에서 옮길 것 (지운 것은 빼고) */
export function collectTargets(items: Docs<'items'>, lessonDays: Docs<'lessonDays'>): CollectTarget[] {
  const out: CollectTarget[] = [];
  const add = (coll: Coll, docs: Readonly<Record<string, object>>) => {
    for (const [id, doc] of Object.entries(docs)) {
      const data = { ...(doc as Record<string, unknown>) };
      if (data.deletedAt) continue;
      delete data.id;
      const files = collectStorageFiles(data);
      if (files.length > 0) out.push({ coll, id, data, files });
    }
  };
  add('items', items);
  add('lessonDays', lessonDays);
  return out;
}

export interface CollectResult {
  moved: number;
  failed: number;
  docs: number;
  corsBlocked: boolean;
  loginRefused: boolean;
  errors: string[];
}

export async function collectAttachments(sid: string, targets: readonly CollectTarget[], onStep?: (msg: string) => void): Promise<CollectResult> {
  const r: CollectResult = { moved: 0, failed: 0, docs: 0, corsBlocked: false, loginRefused: false, errors: [] };
  const total = targets.reduce((n, t) => n + t.files.length, 0);
  // 같은 파일을 두 문서가 함께 달고 있을 수 있다 - 한 번만 올린다
  const cache = new Map<string, { url: string; driveId: string }>();
  let done = 0;
  for (const t of targets) {
    const changes: Array<{ path: (string | number)[]; url: string; driveId: string }> = [];
    for (const f of t.files) {
      done += 1;
      onStep?.(`옮기는 중… ${done}/${total} · ${f.name}`);
      const known = cache.get(f.url);
      if (known) {
        changes.push({ path: f.path, ...known });
        continue;
      }
      let blob: Blob;
      try {
        const res = await fetch(f.url);
        if (!res.ok) throw new Error(`내려받기 실패 ${res.status}`);
        blob = await res.blob();
      } catch (e) {
        r.failed += 1;
        // 다른 주소의 파일을 읽지 못하게 막힌 것(TypeError) - 원인이 하나라 한 번 알리고 멈춘다
        if (e instanceof TypeError) {
          r.corsBlocked = true;
          return r;
        }
        r.errors.push(`${f.name}: ${e instanceof Error ? e.message : String(e)}`);
        continue;
      }
      try {
        const drive = await uploadToDrive(blob, f.name);
        const moved = { url: driveUrlToStore(blob.type, drive), driveId: drive.id };
        cache.set(f.url, moved);
        changes.push({ path: f.path, ...moved });
        r.moved += 1;
      } catch (e) {
        r.failed += 1;
        if (e instanceof GoogleAuthError) {
          r.loginRefused = true;
          return r;
        }
        r.errors.push(`${f.name}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    if (changes.length === 0) continue;
    const patch = changesForNewUrls(t.data, changes, t.coll === 'lessonDays' ? 2 : 1);
    await batch([writeOp.patch({ sid, coll: t.coll, id: t.id }, patch, t.data)], { fail: '드라이브에는 올렸지만 문서의 주소를 바꾸지 못했습니다. 다시 눌러 주세요.' });
    r.docs += 1;
  }
  return r;
}
