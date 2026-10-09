// 학사 D-Day 관리 (V4 components/DDayModal.tsx) - 머리줄 ⏳·단축키 'dday'. 창 'dday'.
//   새 D-Day 추가(일정명·날짜) · 목록을 누르면 ★ 머리줄에 세우기/내리기(하나만) · 삭제(되돌리기·휴지통).
//   남은 날은 늘 오늘 기준 (하루 화면에서 다른 날을 보면 둘째 줄에 그날 기준이 따로 - app/SecondRow).
import { useState, type FormEvent } from 'react';
import { useCommonSettings } from '../../app/prefs';
import type { WindowProps } from '../../app/windows';
import { ddayText, liveDDays } from '../../domain/dday';
import ModalShell, { ModalCloseButton } from '../../ui/ModalShell';
import { useToday } from '../../ui/useToday';
import { addDDayItem, deleteDDayItem, pickDDay } from './actions';

export default function DDayWindow({ close, raise }: WindowProps) {
  const ddays = useCommonSettings((s) => s.ddays);
  const pick = useCommonSettings((s) => s.ddayPick);
  const today = useToday();
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const list = liveDDays(ddays);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (addDDayItem(title, date)) {
      setTitle('');
      setDate('');
    }
  };

  return (
    <ModalShell isOpen onClose={close} raise={raise} width="md" title="⏳ 학사 D-Day 관리" footer={<ModalCloseButton onClose={close} />}>
      <div className="space-y-5" data-dday-window>
        {/* 한 줄에 밀어 넣지 않고 두 줄로 (좁은 화면에서 깨졌다 - V4) */}
        <form onSubmit={submit} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
          <div className="text-xs font-bold text-slate-700">새 D-Day 추가</div>
          <input
            type="text"
            data-dday-title
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="일정명 (예: 여름방학, 수능)"
            className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <div className="flex items-center gap-2">
            <input
              type="date"
              data-dday-date
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="flex-1 min-w-0 px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
            />
            <button
              type="submit"
              data-dday-add
              disabled={!title.trim() || !date}
              className="px-4 py-2 bg-primary hover:bg-blue-600 text-white text-xs font-bold rounded-lg shadow-xs transition-colors disabled:opacity-40 shrink-0 cursor-pointer"
            >
              + 추가
            </button>
          </div>
        </form>

        <div className="space-y-2">
          <div className="text-xs font-bold text-slate-500">
            등록된 D-Day ({list.length})<span className="font-medium text-slate-400"> · 항목을 누르면 상단에 표시되고, 다시 누르면 내려갑니다</span>
          </div>
          {list.length > 0 ? (
            list.map((item) => {
              const calc = ddayText(item.date, today);
              const selected = item.id === pick;
              return (
                <div
                  key={item.id}
                  data-dday-row={item.id}
                  data-dday-picked={selected ? '1' : '0'}
                  className={`p-2.5 bg-white border rounded-xl flex items-center gap-2 shadow-2xs transition-all ${selected ? 'border-primary ring-1 ring-primary/30' : 'border-slate-200/80 hover:border-slate-300'}`}
                >
                  <button
                    type="button"
                    data-dday-pick={item.id}
                    onClick={() => pickDDay(selected ? null : item.id)}
                    className="flex items-center gap-2.5 text-left flex-1 min-w-0 cursor-pointer"
                    title={selected ? '상단 표시 해제' : '상단에 표시'}
                  >
                    <span className={`px-2 py-1 rounded-lg text-xs font-black shrink-0 ${calc.diff >= 0 ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-slate-100 text-slate-500'}`}>
                      {calc.text}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-slate-800 truncate">
                        {selected && <span className="text-primary">★ </span>}
                        {item.title}
                      </span>
                      <span className="block text-xs text-slate-400">{item.date}</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    data-dday-delete={item.id}
                    onClick={() => deleteDDayItem(item.id)}
                    className="px-2.5 py-1.5 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors shrink-0 cursor-pointer"
                    title="이 D-Day 삭제 (휴지통에서 복원 가능)"
                  >
                    삭제
                  </button>
                </div>
              );
            })
          ) : (
            <div className="text-center py-8 text-slate-400 text-xs" data-dday-empty>
              등록된 D-Day 일정이 없습니다.
            </div>
          )}
        </div>
      </div>
    </ModalShell>
  );
}
