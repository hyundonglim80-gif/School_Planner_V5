// 구글 캘린더 자동 보내기 - 머리줄이 보는 것 (P55-1 첫 화면 JS - auto에서 뗐다).
//   큐(gcalQueue)는 useGcalAuto가 늘 듣고 여기에 담는다 - '📅 못 보낸 일정 N'은 보내는 몫(auto)을 받지 않아도 선다.
import { create } from 'zustand';
import type { GcalQueueEntry } from '../../data/gcalQueue';

export const useGcal = create<{ pending: number; flushing: boolean; queue: GcalQueueEntry[] }>(() => ({ pending: 0, flushing: false, queue: [] }));
