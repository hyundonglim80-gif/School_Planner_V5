// 우리 학교 (V4 hooks/useSchool·useNeis) - 계정 설정 common.school(고르는 즉시 - 1초 뒤 올라간다)과 그 학교의 나이스 급식·학사일정.
// 학교를 고르지 않았으면 부르지 않는다. 받은 것은 data/neis가 학교·달마다 담아 둔다.
import { useEffect, useState } from 'react';
import { setCommonSetting, useCommonSettings } from '../../app/prefs';
import { loadMonthMeals, loadMonthSchedule, type NeisMeal, type NeisScheduleItem, type NeisSchool } from '../../data/neis';
import { installNeisKey } from '../../data/neisKey';
import { filterScheduleByGrade, schoolFrom, type SchoolSetting } from '../../domain/schoolSetting';

export const useSchool = (): SchoolSetting | null => useCommonSettings((s) => s.school);

/** 학교를 고른다 (학년은 전 학년으로). null이면 지운다 */
export function saveSchool(s: NeisSchool | null) {
  setCommonSetting('school', s ? schoolFrom(s) : null);
}

export function saveSchoolGrade(grade: number) {
  const s = useCommonSettings.getState().school;
  if (s) setCommonSetting('school', { ...s, grade });
}

export type SchoolEventsByDate = Record<string, NeisScheduleItem[]>;
const NONE: SchoolEventsByDate = {};

/**
 * 여러 달(YYYY-MM)의 학사일정을 날짜별로. 고른 학년으로 거른다 (공휴일·토요휴업일은 data/neis가 뺐다).
 * 한 달을 못 받으면 그 달만 비운다 (다른 달은 보인다). 학교가 없으면 빈 표.
 */
export function useSchoolSchedule(months: readonly string[]): { byDate: SchoolEventsByDate; hasSchool: boolean } {
  const school = useSchool();
  const monthsKey = [...new Set(months)].sort().join(',');
  const id = school && monthsKey ? `${school.officeCode}:${school.schoolCode}:${school.grade}:${monthsKey}` : '';
  const [got, setGot] = useState<{ id: string; byDate: SchoolEventsByDate }>({ id: '', byDate: NONE });

  useEffect(() => {
    if (!school || !monthsKey) return;
    installNeisKey();
    let alive = true;
    void Promise.all(
      monthsKey.split(',').map((m) =>
        loadMonthSchedule(school, m).catch((e) => {
          console.warn(`${m} 학사일정을 불러오지 못했습니다:`, e);
          return [] as NeisScheduleItem[];
        }),
      ),
    ).then((lists) => {
      if (!alive) return;
      const byDate: SchoolEventsByDate = {};
      for (const it of filterScheduleByGrade(lists.flat(), school.grade)) (byDate[it.date] ||= []).push(it);
      setGot({ id, byDate });
    });
    return () => {
      alive = false;
    };
  }, [school, monthsKey, id]);

  return { byDate: got.id === id && id ? got.byDate : NONE, hasSchool: !!school };
}

/** 그날 급식 (조·중·석식). 학교가 없으면 school: null */
export function useDayMeals(date?: string) {
  const school = useSchool();
  const month = date?.slice(0, 7) || '';
  const id = school && month ? `${school.officeCode}:${school.schoolCode}:${month}` : '';
  const [got, setGot] = useState<{ id: string; meals: NeisMeal[]; failed: boolean }>({ id: '', meals: [], failed: false });

  useEffect(() => {
    if (!school || !month) return;
    installNeisKey();
    let alive = true;
    loadMonthMeals(school, month)
      .then((meals) => alive && setGot({ id, meals, failed: false }))
      .catch((e) => {
        console.warn('급식을 불러오지 못했습니다:', e);
        if (alive) setGot({ id, meals: [], failed: true });
      });
    return () => {
      alive = false;
    };
  }, [school, month, id]);

  const current = got.id === id && !!id;
  return {
    school,
    meals: current ? got.meals.filter((m) => m.date === date) : [],
    loading: !!id && !current,
    failed: current && got.failed,
  };
}
