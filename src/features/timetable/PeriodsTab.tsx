// 시간표 창 '🕘 교시' 탭 (V4 '수업 시간 명칭'(환경설정) + PeriodTimesEditor를 한 곳에 - MENU 2-3). 계정에 하나 settings/common.periods.
// 교시 수·이름·시각. 시각을 적어 두면 하루 화면이 지금 몇 교시인지 짚고, 쉬는 시간에는 다음 교시를 알려 준다. 비워 두면 보이지 않는다.
// 창의 💾 저장으로 함께 저장한다(시간표 표의 교시 이름 칸과 같은 값).
import { useState } from 'react';
import { showToast } from '../../app/toast';
import { addPeriod, fillPeriodTimes, removePeriod, type PeriodDef } from '../../domain/periodTimes';

interface Props {
  periods: PeriodDef[];
  onChange: (next: PeriodDef[]) => void;
}

export default function PeriodsTab({ periods, onChange }: Props) {
  // 빠르게 채우기 (초등 40분·중학교 45분·고등학교 50분 수업이 흔하다)
  const [firstStart, setFirstStart] = useState('09:00');
  const [classMin, setClassMin] = useState(40);
  const [breakMin, setBreakMin] = useState(10);
  const [lunchAfter, setLunchAfter] = useState(4);
  const [lunchMin, setLunchMin] = useState(50);

  const set = (i: number, patch: Partial<PeriodDef>) => onChange(periods.map((p, j) => (j === i ? { ...p, ...patch } : p)));

  const fill = () => {
    const filled = fillPeriodTimes({
      count: periods.length,
      firstStart,
      classMinutes: Number(classMin) || 0,
      breakMinutes: Number(breakMin) || 0,
      lunchAfter: Number(lunchAfter) || 0,
      lunchMinutes: Number(lunchMin) || 0,
    });
    if (!filled) {
      showToast('1교시 시작 시각과 수업 길이를 적어 주세요.');
      return;
    }
    onChange(periods.map((p) => ({ ...p, start: filled[String(p.n)]?.start ?? '', end: filled[String(p.n)]?.end ?? '' })));
  };

  const num = (v: number, setV: (n: number) => void, label: string) => (
    <input
      type="number"
      min={0}
      max={180}
      value={v}
      onChange={(e) => setV(Number(e.target.value))}
      aria-label={label}
      className="w-12 border border-slate-200 rounded px-1 py-0.5 text-center font-bold text-slate-700"
    />
  );

  return (
    <div className="space-y-3" data-periods-tab>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-xs text-slate-500 leading-relaxed">
          교시 수와 이름은 하루·주간의 수업 칸이 이대로 나뉩니다. 시각을 적어 두면 오늘 하루 화면에서 지금 몇 교시인지, 쉬는 시간에는 다음 교시를 짚어 줍니다.
        </p>
        <div className="flex items-center gap-1.5 shrink-0">
          <button type="button" data-period-add onClick={() => onChange(addPeriod(periods))} className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-bold border border-slate-200 cursor-pointer">
            + 교시 추가
          </button>
          <button type="button" data-period-remove onClick={() => onChange(removePeriod(periods))} className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-bold border border-slate-200 cursor-pointer">
            - 교시 삭제
          </button>
        </div>
      </div>

      {/* 빠르게 채우기 */}
      <div className="flex items-center gap-1.5 flex-wrap text-xs bg-violet-50/60 border border-violet-200 rounded-lg px-2.5 py-1.5" data-period-fill>
        <span className="font-bold text-violet-800">빠르게 채우기</span>
        <span>1교시 시작</span>
        <input
          type="time"
          value={firstStart}
          onChange={(e) => setFirstStart(e.target.value)}
          aria-label="빠르게 채우기 - 1교시 시작"
          className="border border-slate-200 rounded px-1 py-0.5 font-bold text-slate-700 bg-white"
        />
        <span>수업</span>
        {num(classMin, setClassMin, '수업 길이(분)')}
        <span>분 · 쉬는 시간</span>
        {num(breakMin, setBreakMin, '쉬는 시간(분)')}
        <span>분 · 점심</span>
        <select
          value={lunchAfter}
          onChange={(e) => setLunchAfter(Number(e.target.value))}
          aria-label="점심 앞 교시"
          className="border border-slate-200 rounded px-1 py-0.5 font-bold text-slate-700 bg-white"
        >
          <option value={0}>없음</option>
          {periods.map((p) => (
            <option key={p.n} value={p.n}>
              {p.name} 뒤
            </option>
          ))}
        </select>
        {num(lunchMin, setLunchMin, '점심 시간(분)')}
        <span>분</span>
        <button type="button" data-period-fill-run onClick={fill} className="ml-auto px-2 py-0.5 bg-violet-100 hover:bg-violet-200 text-violet-800 border border-violet-300 rounded font-bold cursor-pointer">
          채우기
        </button>
      </div>

      {/* 한 줄에 교시 하나 (오른쪽 칸 폭에서 두 줄로 나누면 시각 칸이 좁아 잘렸다 - V4) */}
      <div className="grid grid-cols-1 gap-y-1.5 text-xs">
        {periods.map((p, i) => (
          <div key={p.n} className="flex items-center gap-1.5" data-period-row={p.n}>
            <input
              type="text"
              value={p.name}
              data-period-name={p.n}
              onChange={(e) => set(i, { name: e.target.value })}
              aria-label={`${p.n}교시 이름`}
              className="w-20 shrink-0 border border-slate-200 rounded px-1.5 py-0.5 font-bold text-slate-700 bg-white"
            />
            <input
              type="time"
              value={p.start}
              data-period-start={p.n}
              onChange={(e) => set(i, { start: e.target.value })}
              aria-label={`${p.name} 시작`}
              className="w-32 shrink-0 border border-slate-200 rounded px-1.5 py-0.5 font-bold text-slate-700 bg-white"
            />
            <span>~</span>
            <input
              type="time"
              value={p.end}
              data-period-end={p.n}
              onChange={(e) => set(i, { end: e.target.value })}
              aria-label={`${p.name} 끝`}
              className="w-32 shrink-0 border border-slate-200 rounded px-1.5 py-0.5 font-bold text-slate-700 bg-white"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
