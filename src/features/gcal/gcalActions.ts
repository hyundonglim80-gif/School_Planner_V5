// 겹쳐 그린 구글 캘린더 일정의 풍선 글·누르기 (P36-4) - 그리는 부품(GcalItems)과 학사력이 함께 쓴다.
import type { MouseEvent as ReactMouseEvent } from 'react';
import { gcalWhenLabel, type GcalShown } from '../../domain/gcalShow';
import { useMulti } from '../events/multi';
import { openGcalEvent } from './open';

/** 마우스를 올리면 보일 글 */
export function gcalTip(s: GcalShown): string {
  return `${s.ev.title}\n${s.cal.name} (구글 캘린더) · ${gcalWhenLabel(s)}${s.ev.location ? `\n📍 ${s.ev.location}` : ''}\n누르면 자세히 (보기만 - 고치기는 구글 캘린더에서)`;
}

/** 누르기 - 여러 개 고르는 동안은 아무 일 없음(겹친 공간 일정과 같다). instead = 그 자리만의 누르기(휴대폰 월간 칸 = 그날 목록) */
export function gcalClick(s: GcalShown, date: string, instead?: () => void) {
  return (e: ReactMouseEvent) => {
    e.stopPropagation();
    if (useMulti.getState().on) return;
    if (instead) instead();
    else openGcalEvent(s, date);
  };
}
