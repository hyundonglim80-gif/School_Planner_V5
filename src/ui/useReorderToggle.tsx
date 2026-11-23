// 카드 차례 바꾸기 켜기 ⇅ (P59-1 - 환경설정 화면 배치 '카드 차례 단추: ⇅ 누를 때만').
//   휴대폰은 카드마다 ▲▼가 늘 한 줄·한 칸을 차지했다(수업 카드 '1교시 국어' 한 줄이 높이 두 배 - 5장 'P59' ㉯). 이 값을 고르면 ▲▼는 숨고,
//   칸 머리의 ⇅를 누른 칸만 ▲▼가 선다(다시 누르면 들어간다). 숨기기는 index.css(html data-order-arrows + 칸의 data-reorder-on).
//   손가락 화면에서만 보인다 - 마우스 화면은 ▲▼가 카드에 올렸을 때 보이고 끌어 놓기도 된다(ui/cardTools ORDER_ARROWS).
//   길게 누르기는 이미 '여러 개 고르기'라 쓰지 않는다(5장 'P59' ②).
import { useState, type ReactNode } from 'react';
import { useScreenPrefs } from '../app/screenPrefs';
import { Glyph } from './Icon';
import { PICK_ON } from './buttons';

/** 칸 이름(name)은 점검·단추 대신 누르기가 찾는 data-reorder-toggle 값 */
export function useReorderToggle(name: string): { reorderAttr: { 'data-reorder-on'?: '' }; reorderButton: ReactNode } {
  const mode = useScreenPrefs((s) => s.orderArrows);
  const [on, setOn] = useState(false);
  if (mode !== 'toggle') return { reorderAttr: {}, reorderButton: null };
  return {
    reorderAttr: on ? { 'data-reorder-on': '' } : {},
    reorderButton: (
      <button
        type="button"
        data-reorder-toggle={name}
        aria-pressed={on}
        onClick={(e) => {
          e.stopPropagation();
          setOn(!on);
        }}
        title={on ? '차례 바꾸기 끝' : '카드 차례 바꾸기 (▲▼)'}
        aria-label={on ? '차례 바꾸기 끝' : '카드 차례 바꾸기'}
        className={`tap-area pointer-fine:hidden shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-lg text-sm border transition-colors cursor-pointer ${
          on ? PICK_ON : 'border-transparent text-slate-500 hover:bg-slate-100'
        }`}
      >
        <Glyph e="⇅" />
      </button>
    ),
  };
}
