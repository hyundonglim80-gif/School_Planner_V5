// 기록 칸의 '📢 알림장'·'📋 출결' 카드 하나 (고르기는 useDayCards.ts)
import type { DayCard } from '../../domain/dayCards';
import { openDayCard } from './useDayCards';

/** 카드 하나 (메모·기록 카드와 같은 틀, 누르면 원본 칸) */
export default function DayCardView({ card, sid }: { card: DayCard; sid: string | null }) {
  return (
    <button
      type="button"
      data-day-card={card.kind}
      data-day-card-key={card.key}
      onClick={() => openDayCard(card, sid)}
      title={card.kind === 'notice' ? '알림장 칸 열기' : '출석부 열기'}
      className={`w-full text-left rounded-2xl border p-4 shadow-xs hover:shadow-sm transition-all cursor-pointer ${
        card.kind === 'notice' ? 'bg-yellow-50/70 border-yellow-200 hover:border-yellow-400' : 'bg-rose-50/50 border-rose-200 hover:border-rose-400'
      }`}
    >
      <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-bold border mb-1.5 ${card.kind === 'notice' ? 'bg-yellow-100 text-yellow-900 border-yellow-300' : 'bg-rose-100 text-rose-800 border-rose-300'}`}>{card.title}</span>
      <span className="block text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">{card.lines.join('\n')}</span>
    </button>
  );
}
