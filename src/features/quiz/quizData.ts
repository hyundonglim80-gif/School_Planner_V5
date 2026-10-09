// 암기 성적 읽기·쓰기 (V4 hooks/usePhotoQuiz의 저장) - 개인 공간 quiz/{classId} = { records: { [sid]: 성적 } }.
//   V4는 계정에 문서 하나(settings/photoQuiz)에 모든 학급을 이름 열쇠로 담았다 - V5는 학급마다 문서 하나, 학생은 sid.
//   O/X를 누를 때마다 쓰지 않고 판이 모았다가 한 번에 쓴다(usePhotoQuiz). 되돌리기 더미에 넣지 않는다(성적은 되돌리기 단추가 따로 있다).
import { useMemo } from 'react';
import { writeOp, writeOps } from '../../data/repo';
import type { Changes } from '../../data/repo/ops';
import { useDocs, useMirrorStatus } from '../../data/select';
import { usePersonalSpaceId } from '../../data/session';
import type { DocPath } from '../../data/types';
import { quizKey, type QuizRecords } from '../../domain/photoQuiz';

export const quizPath = (sid: string, classId: string): DocPath<'quiz'> => ({ sid, coll: 'quiz', id: classId });

/** 그 학급들의 성적 - 열쇠 '{classId}/{sid}'. loaded = 사본을 서버와 맞췄다(또는 문서가 있다) */
export function useQuizRecords(classIds: readonly string[]): { records: QuizRecords; loaded: boolean } {
  const sid = usePersonalSpaceId();
  const docs = useDocs('quiz', sid);
  const status = useMirrorStatus('quiz', sid);
  const key = classIds.join(',');
  const records = useMemo(() => {
    const out: QuizRecords = {};
    for (const classId of key ? key.split(',') : []) {
      for (const [student, rec] of Object.entries(docs[classId]?.records ?? {})) out[quizKey(classId, student)] = rec;
    }
    return out;
  }, [docs, key]);
  return { records, loaded: status === 'live' || classIds.some((c) => !!docs[c]) };
}

/** 모은 성적을 학급마다 한 번에 (실패해도 판은 그대로 - 다음 답에서 다시 쓴다) */
export async function saveQuizRecords(sid: string, pending: QuizRecords, docsOf: (classId: string) => object | null): Promise<void> {
  const byClass = new Map<string, Record<string, unknown>>();
  for (const [k, rec] of Object.entries(pending)) {
    const at = k.lastIndexOf('/');
    if (at <= 0) continue;
    const classId = k.slice(0, at);
    const student = k.slice(at + 1);
    if (!byClass.has(classId)) byClass.set(classId, {});
    byClass.get(classId)![`records.${student}`] = rec;
  }
  const ops = [...byClass].map(([classId, changes]) => writeOp.merge(quizPath(sid, classId), changes as Changes<'quiz'>, docsOf(classId)));
  if (ops.length) await writeOps(ops);
}
