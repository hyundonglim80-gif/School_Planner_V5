// 환경설정 '학교' 탭 (MENU 3-6). 교사 유형(→ 시간표 창으로 가는 단추 - V4 그대로, P6-1) · 이월 기간. 우리 학교(급식·학사일정)는 P6-3이 더한다.
// 계정에 하나(settings/common - app/prefs useCommonSettings). 고치는 즉시 바뀐다(다른 기기에는 1초 뒤).
import { useState } from 'react';
import { setCommonSetting, useCommonSettings } from '../../app/prefs';
import { openWindow } from '../../app/windows';
import { TEACHER_PRESETS } from '../../domain/teachingMode';
import { useTeaching } from '../lessons/teaching';
import { Section } from './parts';

export const MIN_FORWARD_DAYS = 1;
export const MAX_FORWARD_DAYS = 60;

export default function SchoolTab() {
  const forwardDays = useCommonSettings((s) => s.forwardDays);
  const { preset, chosen } = useTeaching();
  // 적는 동안은 칸 글자 그대로 (지우고 새로 적을 때 1로 튀지 않게), 범위 밖은 칸을 떠날 때 맞춘다
  const [text, setText] = useState<string | null>(null);

  const change = (raw: string) => {
    setText(raw);
    const n = Math.floor(Number(raw));
    if (raw.trim() !== '' && Number.isFinite(n) && n >= MIN_FORWARD_DAYS && n <= MAX_FORWARD_DAYS) setCommonSetting('forwardDays', n);
  };

  return (
    <>
      <Section id="teaching" title="교사 유형" desc="(초등) 담임 / 전담 / (중등) 전담 + 담임 - 가르치는 반·과목·반 색·담임반과 함께 ⏰ 시간표 창에서 정합니다.">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-slate-800" data-teaching-current>
            {chosen ? TEACHER_PRESETS.find((p) => p.value === preset)?.label : '아직 고르지 않음'}
          </span>
          <button
            type="button"
            data-open-teaching
            onClick={() => openWindow('timetable', { tab: 'teaching' })}
            className="ml-auto px-3 py-1.5 bg-white border border-slate-200 hover:border-primary hover:text-primary rounded-lg text-xs font-bold text-slate-600 transition-colors cursor-pointer"
          >
            ⏰ 시간표 창에서 바꾸기
          </button>
        </div>
      </Section>
      <Section
        id="forward"
        title="이월"
        desc="'이월' 속성이 켜진(이월 라벨이 붙은) 끝내지 않은 일정을 오늘 칸에 함께 보일 때 며칠 전까지 거슬러 볼지 정합니다. 그보다 오래된 것은 이미 따라오던 일정만 계속 따라옵니다. '지난 일정' 줄도 같은 값을 씁니다."
      >
        <div className="flex items-center gap-2">
          <input
            type="number"
            data-forward-days
            min={MIN_FORWARD_DAYS}
            max={MAX_FORWARD_DAYS}
            value={text ?? String(forwardDays)}
            onChange={(e) => change(e.target.value)}
            onBlur={() => {
              const n = Math.floor(Number(text));
              if (text !== null && text.trim() !== '' && Number.isFinite(n)) {
                setCommonSetting('forwardDays', Math.min(MAX_FORWARD_DAYS, Math.max(MIN_FORWARD_DAYS, n)));
              }
              setText(null);
            }}
            aria-label="이월 기간 (일)"
            className="w-24 px-3 py-2 border border-slate-200 rounded-lg text-sm font-bold text-slate-800 focus:outline-none focus:border-primary"
          />
          <span className="text-xs font-bold text-slate-500">일 전까지</span>
          <span className="text-xs text-slate-400 ml-auto">
            {MIN_FORWARD_DAYS}~{MAX_FORWARD_DAYS}일
          </span>
        </div>
      </Section>
    </>
  );
}
