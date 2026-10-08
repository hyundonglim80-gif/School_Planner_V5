// ⏰ 알림 시간 설정 (V4 components/EventAlarmModal.tsx - V3 팝업). 창 목록에 등록하지 않는 작은 창(일정 칸·하루 카드 ⏰에서 띄운다).
//
// 시간은 24시간제 글(1430 · 14:30). V5 알림은 그 일정 날의 시각이라 날짜 칸이 없다(V4는 날짜도 골랐다 - PLAN 5장).
// 저장하면 닫는다(V4 - 닫지 않으면 안 된 줄 알고 또 눌렀다). 저장이 안 되면 닫지 않는다.
import { useState } from 'react';
import { showErrorToastOnce, showToast } from '../../app/toast';
import { shortDateLabel } from '../../domain/dateUtils';
import { normalizeTimeInput } from '../../domain/eventAlarm';
import ModalShell, { ModalCloseButton } from '../../ui/ModalShell';

export interface EventAlarmWindowProps {
  onClose: () => void;
  /** 알림이 울릴 날 (그 일정의 날) */
  date: string;
  /** 'HH:mm' ('' = 없음) */
  initialTime: string;
  onSave: (time: string) => void | Promise<void>;
  onTurnOff: () => void | Promise<void>;
  /** 저장한 뒤 안내. 일정 칸 안에서 열면 '일정을 저장하면 걸린다'고 알린다 (V4 - 일정 칸을 저장하지 않고 닫아 알림을 잃었다) */
  savedMessage?: string;
}

export default function EventAlarmWindow({ onClose, date, initialTime, onSave, onTurnOff, savedMessage = '✅ 알림을 맞췄습니다.' }: EventAlarmWindowProps) {
  const [value, setValue] = useState(initialTime);
  const [error, setError] = useState('');

  const save = async () => {
    const hhmm = normalizeTimeInput(value);
    if (!hhmm) {
      setError('시간을 "1430" 또는 "14:30" 형식으로 입력해주세요.');
      return;
    }
    try {
      await onSave(hhmm);
    } catch (e) {
      showErrorToastOnce('알림을 저장하지 못했습니다.', e);
      return;
    }
    showToast(savedMessage);
    onClose();
  };

  const turnOff = async () => {
    try {
      await onTurnOff();
    } catch (e) {
      showErrorToastOnce('알림을 끄지 못했습니다.', e);
      return;
    }
    onClose();
  };

  return (
    <ModalShell
      isOpen
      onClose={onClose}
      onSave={() => void save()}
      width="sm"
      title="⏰ 알림 시간 설정"
      footer={
        <>
          <button
            type="button"
            data-alarm-off
            onClick={() => void turnOff()}
            className="mr-auto px-3 py-2 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition-colors cursor-pointer"
          >
            알림 끄기
          </button>
          <ModalCloseButton onClose={onClose} />
          <button
            type="button"
            data-alarm-save
            onClick={() => void save()}
            className="px-4 py-2 text-xs font-bold text-white bg-primary hover:bg-blue-600 rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            저장
          </button>
        </>
      }
    >
      <div data-alarm-window>
        <p className="mb-3 text-xs font-bold text-slate-500">
          알림 날짜 <span className="text-slate-800">{shortDateLabel(date)}</span>
          <span className="font-normal text-slate-400"> · 일정 날짜를 옮기면 알림도 따라갑니다</span>
        </p>
        <label className="block text-xs font-bold text-slate-500 mb-1.5" htmlFor="sp5-alarm-time">
          시간 입력 (24시간제)
        </label>
        <input
          id="sp5-alarm-time"
          type="text"
          data-alarm-time
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError('');
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void save();
            }
          }}
          placeholder="예: 1430 (오후 2시 30분)"
          maxLength={5}
          autoFocus
          className="w-full px-3 py-2.5 text-center text-lg font-bold tracking-widest border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
        />
        {error && <p className="mt-2 text-xs font-bold text-red-500">{error}</p>}
      </div>
    </ModalShell>
  );
}
