// 년간 보기: 📅 학사력(열두 달 한 장) / 📋 자세히(날마다 일정) - 이 기기에 남긴다 (V4 sp4_yearView 그대로).
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type YearView = 'sheet' | 'detail';

export const useYearView = create<{ view: YearView }>()(persist((): { view: YearView } => ({ view: 'sheet' }), { name: 'sp5-year-view' }));
export const setYearView = (view: YearView) => useYearView.setState({ view });
