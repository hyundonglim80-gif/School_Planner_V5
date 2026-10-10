// 백업 읽기·되살리기 쓰기 (P8-3 - 셈은 domain/backup). 백업 창과 드라이브 자동 백업이 같은 것을 쓴다.
// 서버에서 읽는다(기기 사본이 아직 다 받지 않았어도 맞게 - 지운 것까지 읽어 견준다). 시각은 기기 사본과 같은 표시 모양(codec)으로.
import { collection, getDocsFromServer } from 'firebase/firestore';
import { BACKUP_COLLS, BACKUP_VERSION, keepInBackup, type BackupColl, type BackupFile, type BackupKind, type DateRange, type RestorePlan } from '../domain/backup';
import { db } from './firebase';
import { decodeDoc, encodeDoc } from './mirror/codec';
import { batch, writeOp } from './repo';
import type { SpaceCollection } from './types';

type Doc = Record<string, unknown>;

async function readColl(sid: string, coll: BackupColl): Promise<Record<string, Doc>> {
  const snap = await getDocsFromServer(collection(db, 'spaces', sid, coll));
  const out: Record<string, Doc> = {};
  for (const d of snap.docs) out[d.id] = d.data() as Doc;
  return out;
}

/** 공간 하나의 백업 (고른 갈래·기간). onStep = 진행 글 */
export async function buildBackup(
  sid: string,
  spaceName: string,
  include: readonly BackupKind[],
  range: DateRange | null,
  onStep?: (msg: string) => void,
): Promise<BackupFile> {
  const want = new Set(include);
  const colls: BackupFile['colls'] = {};
  for (const coll of BACKUP_COLLS) {
    onStep?.(`${coll} 읽는 중…`);
    const docs = await readColl(sid, coll);
    const bag: Record<string, Doc> = {};
    for (const [id, doc] of Object.entries(docs)) if (keepInBackup(coll, id, doc, want, range)) bag[id] = encodeDoc(doc);
    if (Object.keys(bag).length) colls[coll] = bag;
  }
  return { version: BACKUP_VERSION, exportedAt: new Date().toISOString(), sid, spaceName, period: range ?? 'all', include: [...include], colls };
}

/** 되살리기 전에 지금 공간의 문서 (파일에 든 컬렉션만, 지운 것 포함) */
export async function readCurrentFor(sid: string, file: BackupFile): Promise<Partial<Record<BackupColl, Record<string, Doc>>>> {
  const out: Partial<Record<BackupColl, Record<string, Doc>>> = {};
  for (const coll of BACKUP_COLLS) if (file.colls[coll]) out[coll] = await readColl(sid, coll);
  return out;
}

/** 되살리기 적기 (500개씩 - 저장 도우미). 실패는 안내하고 던진다. 되돌리기에는 넣지 않는다(수백 개를 한꺼번에 지우면 더 위험하다) */
export async function writeRestore(sid: string, plan: RestorePlan, onProgress?: (done: number, total: number) => void): Promise<void> {
  const ops = plan.puts.map((p) => writeOp.put({ sid, coll: p.coll as SpaceCollection, id: p.id }, decodeDoc(p.data) as never, null));
  const fail = '백업을 다 되살리지 못했습니다. 네트워크를 확인하고 다시 해 주세요(이미 넣은 것은 두 번 들어가지 않습니다).';
  for (let i = 0; i < ops.length; i += 400) {
    await batch(ops.slice(i, i + 400), { fail });
    onProgress?.(Math.min(i + 400, ops.length), ops.length);
  }
}
