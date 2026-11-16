// 메모 틀 문서 (P36-2) - spaces/u_{uid}/settings/noteTemplates. 내 공간 아래라 새 규칙이 없다(공간 아래 자료 = 나만 - P33-2 settings/reset과 같다).
//   모양·셈은 domain/noteTemplate(틀마다 칸 `t.<id>`). 쓰기는 저장 도우미의 merge(그 틀의 칸만 - 문서가 없으면 만든다), 되돌리기를 남긴다.
//   그룹 공간 메모에서도 이 문서(내 틀)를 쓴다.
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import { personalSpaceId } from './space';
import { batch, writeOp, type Changes } from './repo';
import { recordUndo } from './undo';
import { NOTE_TEMPLATES_DOC_ID } from '../domain/noteTemplate';

const pathOf = (uid: string) => ({ sid: personalSpaceId(uid), coll: 'settings' as const, id: NOTE_TEMPLATES_DOC_ID });

/** 내 틀 문서를 듣는다 (없으면 null). 내가 방금 적은 것도 곧바로 온다 */
export function watchNoteTemplates(uid: string, onData: (data: Record<string, unknown> | null) => void): () => void {
  const at = pathOf(uid);
  return onSnapshot(
    doc(db, 'spaces', at.sid, at.coll, at.id),
    (snap) => onData(snap.exists() ? (snap.data() as Record<string, unknown>) : null),
    (e) => console.warn('[noteTemplates] 메모 틀 구독 실패:', e),
  );
}

/**
 * 틀 칸 고치기 (domain/noteTemplate templateWrite·templateRemove·…). before = 지금 문서(되돌리기에 쓴다 - 없으면 null).
 * message가 있으면 '되돌리기' 안내, 없으면 Ctrl+Z 더미에만. 실패는 안내하고 던진다(누른 단추에서 `.catch`).
 */
export async function writeNoteTemplates(
  uid: string,
  changes: Record<string, unknown>,
  before: Record<string, unknown> | null,
  opts: { fail: string; message?: string; what: string },
): Promise<void> {
  const at = pathOf(uid);
  const undo = await batch([writeOp.merge(at, changes as Changes<'settings'>, before)], { fail: opts.fail });
  recordUndo(at.sid, opts.message ?? '', undo, { what: opts.what, quiet: !opts.message });
}
