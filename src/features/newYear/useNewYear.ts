// 새 학년도 넘기기 (P9-2) - 띠·창이 함께 보는 '할 것' 상태와 쓰기. 셈은 domain/newYear.
//   학급은 개인 공간(classes), 시간표는 지금 공간(시간표 창과 같다), 방학·담임반은 계정 설정(common).
import { useMemo } from 'react';
import { useCommonLoaded, useCommonSettings } from '../../app/prefs';
import { newId } from '../../data/id';
import { batch, writeOp } from '../../data/repo';
import { isLive, useDocs, useMirrorStatus } from '../../data/select';
import { useCurrentSpaceId, usePersonalSpaceId } from '../../data/session';
import { recordUndo } from '../../data/undo';
import { classIdOf, cleanStudent, describeClass, withSids, type CsvStudent } from '../../domain/roster';
import { copiedTimetable, hasPastData, latestTimetableBefore, newYearPending, newYearState, type PeriodTimetable } from '../../domain/newYear';
import { presetOf } from '../../domain/teachingMode';
import { classPath, useClasses } from '../class/classes';
import { useTeaching } from '../lessons/teaching';
import { timetablePath } from '../timetable/timetableDraft';

export function useNewYear(year: number) {
  const { classes, sid: classSid, docs: classDocs } = useClasses();
  const sid = useCurrentSpaceId();
  const ttDocs = useDocs('timetables', sid);
  const terms = useCommonSettings((s) => s.terms);
  const { mode } = useTeaching();
  // 담임반은 (중등) 전담 + 담임만 고른다 - 초등 담임은 담임반 칸을 쓰지 않는다
  const homeroomClass = presetOf(mode) === 'subjectHomeroom' ? mode.homeroomClass : null;
  const timetables = useMemo<PeriodTimetable[]>(
    () =>
      Object.values(ttDocs)
        .filter(isLive)
        .map((t) => ({
          id: t.id,
          name: t.name,
          from: t.from,
          to: t.to,
          grid: t.grid ?? {},
        })),
    [ttDocs],
  );
  const state = useMemo(() => newYearState(year, { classes, timetables, terms, homeroomClass }), [year, classes, timetables, terms, homeroomClass]);
  const source = useMemo(() => latestTimetableBefore(timetables, year), [timetables, year]);
  const past = useMemo(() => hasPastData({ classes, timetables }, year), [classes, timetables, year]);
  return {
    state,
    pending: newYearPending(state),
    past,
    source,
    sid,
    classSid,
    classDocs,
    mode,
  };
}

/** 학급·시간표·계정 설정을 다 받았나 (받기 전의 '없음'은 모르는 것이다) */
export function useNewYearLoaded(): boolean {
  const common = useCommonLoaded((s) => s.loaded);
  const classes = useMirrorStatus('classes', usePersonalSpaceId());
  const timetables = useMirrorStatus('timetables');
  return common && classes === 'live' && timetables === 'live';
}

/** 새 학급 만들기 - 이미 있으면 null(명렬표에서 고친다). 실패하면 던진다 */
export async function createNewClass(
  sid: string,
  docs: ReturnType<typeof useClasses>['docs'],
  c: { year: number; grade: number; num: number },
  students: readonly CsvStudent[],
): Promise<string | null> {
  const id = classIdOf(c);
  if (docs[id] && !docs[id].deletedAt) return null;
  const data = {
    year: c.year,
    grade: c.grade,
    num: c.num,
    students: withSids(students, [], newId).map(cleanStudent),
  };
  const undo = await batch([writeOp.create(classPath(sid, id), data)], {
    fail: '학급을 만들지 못했습니다. 다시 눌러 주세요.',
  });
  recordUndo(sid, `✅ ${describeClass(c)}을 만들었습니다 (학생 ${students.length}명).`, undo, { what: '새 학급' });
  return id;
}

/** 지난 시간표를 베껴 그 학년도 시간표를 만든다 - 새 id. 실패하면 던진다 */
export async function createCopiedTimetable(sid: string, src: PeriodTimetable | null, year: number): Promise<string> {
  const id = newId();
  const undo = await batch([writeOp.create(timetablePath(sid, id), copiedTimetable(src, year))], { fail: '시간표를 만들지 못했습니다. 다시 눌러 주세요.' });
  recordUndo(sid, src ? `✅ [${src.name}]를 베껴 ${year}학년도 시간표를 만들었습니다.` : `✅ ${year}학년도 빈 시간표를 만들었습니다.`, undo, { what: '새 시간표' });
  return id;
}
