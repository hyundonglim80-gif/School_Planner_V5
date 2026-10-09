// 교사 유형 읽기·고치기 (V4 hooks/useTeachingMode·useTeachingClasses·useClassColor). 값은 계정에 하나인 설정 settings/common.teaching(app/prefs).
//   고르지 않았으면(null) 초등 담임으로 보고, 하루 화면에 '교사 유형을 골라 주세요' 띠(TeachingBanner).
//   교과 모드(unit 'class' - 전담·(중등) 전담 + 담임)일 때만 칸 글자를 '5-2 과학'으로 맞추고 반을 크게·반 색으로 보인다.
import { useMemo } from 'react';
import { setCommonSetting, useCommonSettings } from '../../app/prefs';
import { academicYearOf, todayStr } from '../../domain/dateUtils';
import { DEFAULT_TEACHING_MODE, presetOf, showsHomeroomTools, type TeachingMode } from '../../domain/teachingMode';
import { classColor, teachingClasses, teachingSubjects, type ClassColorClasses, type SlotGrid } from '../../domain/teachingSlot';
import { isLive, useDocs } from '../../data/select';
import { usePersonalSpaceId } from '../../data/session';

export function useTeaching() {
  const teaching = useCommonSettings((s) => s.teaching);
  return useMemo(() => {
    const mode = teaching ?? DEFAULT_TEACHING_MODE;
    return {
      mode,
      /** 한 번이라도 골랐나 (안 골랐으면 띠) */
      chosen: teaching !== null,
      preset: presetOf(mode),
      isClassUnit: mode.unit === 'class',
      showHomeroomTools: showsHomeroomTools(mode),
    };
  }, [teaching]);
}

/** 교사 유형의 칸 몇 개를 바꾼다 (계정에 1초 뒤) */
export function updateTeaching(patch: Partial<TeachingMode>) {
  const cur = useCommonSettings.getState().teaching ?? DEFAULT_TEACHING_MODE;
  setCommonSetting('teaching', { ...cur, ...patch });
}

/** 시간표 표들 (살아 있는 것) - 반·과목 목록이 본다 */
function useGrids(sid?: string | null, extra?: readonly SlotGrid[]): SlotGrid[] {
  const docs = useDocs('timetables', sid);
  return useMemo(
    () => [
      ...Object.values(docs)
        .filter(isLive)
        .map((t) => t.grid as SlotGrid),
      ...(extra ?? []),
    ],
    [docs, extra],
  );
}

/** 그 학년도 수업 칸(lessonDays)에 적힌 과목 - 날짜 → 교시 → 글자 */
function useDaySubjects(sid?: string | null): Record<string, Record<string, string>> {
  const days = useDocs('lessonDays', sid);
  return useMemo(() => {
    const out: Record<string, Record<string, string>> = {};
    for (const [date, d] of Object.entries(days)) {
      const row: Record<string, string> = {};
      for (const [n, cell] of Object.entries(d.periods ?? {})) if (cell?.subject) row[n] = cell.subject;
      if (Object.keys(row).length) out[date] = row;
    }
    return out;
  }, [days]);
}

/** 명렬표의 학급 (개인 공간) - 반 표기 '5-2'를 셈하는 모양으로 */
function useRosterLikes() {
  const docs = useDocs('classes', usePersonalSpaceId());
  return useMemo(() => Object.values(docs).filter(isLive).map((c) => ({ year: c.year, grade: c.grade, classNum: c.num })), [docs]);
}

/**
 * 가르치는 반 (V4 19번 U1): 명렬표의 반(P7-1) + 시간표에 적힌 반 + 그 학년도 수업 칸의 반 + 시간표 창 '가르치는 반'.
 * extra = 시간표 창이 고치는 중인 표(아직 저장 전)
 */
export function useTeachingClasses(date?: string, sid?: string | null, extra?: readonly SlotGrid[]): string[] {
  const { mode } = useTeaching();
  const rosters = useRosterLikes();
  const grids = useGrids(sid, extra);
  const subjectsByDate = useDaySubjects(sid);
  const schoolYear = academicYearOf(date ?? todayStr());
  return useMemo(
    () => teachingClasses({ rosters, grids, subjectsByDate, settingClasses: mode.classes, schoolYear }),
    [rosters, grids, subjectsByDate, mode.classes, schoolYear],
  );
}

/** 교과 모드 칸의 ▼ 목록 둘 - 반 / 과목 */
export function useSlotPairOptions(date?: string, sid?: string | null, extra?: readonly SlotGrid[]): { classes: string[]; subjects: string[] } {
  const { mode } = useTeaching();
  const classes = useTeachingClasses(date, sid, extra);
  const grids = useGrids(sid, extra);
  const subjects = useMemo(() => teachingSubjects(mode.subjects, grids), [mode.subjects, grids]);
  return useMemo(() => ({ classes, subjects }), [classes, subjects]);
}

/** 반 색 고르기 (정한 색 → 그 학년도 반 차례) */
export function useClassColorOf(date?: string, sid?: string | null): (cls: string) => ClassColorClasses {
  const { mode } = useTeaching();
  const labels = useTeachingClasses(date, sid);
  return useMemo(() => (cls: string) => classColor(cls, mode.classColors, labels), [mode.classColors, labels]);
}
