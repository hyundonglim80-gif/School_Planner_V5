// 일정 완료 칩 (P10-1 - 사용자 의견 6a·2d): 완료한 일정은 칩 색을 그대로 두고 칩 안에 ✓ (흑백·줄긋기를 없앴다 - 끝낸 것도 찾기 쉽게).
//   라벨 칩은 글자를 줄여 ✓ 자리를 만들고 칩 크기는 완료 전과 같다 (10-29 메모 요청 #123·#127).
// 하루·주간·월간·년간이 이 하나를 쓴다. 칩을 누르면 완료·풀기 (☐ 체크 칸은 없앴다).
// - 라벨이 있으면 라벨 칩, 없으면 회색 작은 칩(완료 전 ○ → ✓ - 이 칩이 없으면 완료할 길이 없다).
// - 여러 라벨이면 ✓는 첫 칩에만 (mark), 어느 칩을 눌러도 완료.
// - onToggle이 없으면 보기만 (작년 이맘때 등) - 라벨 없는 일정은 끝냈을 때만 ✓.
// - 기간 일정은 하루·주간 칩 = 그날만, 월간 막대·년간 기간 줄 칩 = 기간 전체(whole - 10-30 사용자 보고).
import type { CSSProperties, KeyboardEvent, MouseEvent } from 'react';
import { labelColor } from '../../domain/labels';
import type { LabelDoc } from '../../data/select';

interface Props {
  label: LabelDoc | null;
  done: boolean;
  /** ✓를 이 칩에 붙이나 (여러 라벨이면 첫 칩만 - 기본 true) */
  mark?: boolean;
  onToggle?: () => void;
  /** 이월 라벨 - 누르면 이월도 멈춘다 (안내 글에만) */
  forward?: boolean;
  /** 기간 전체 완료 (안내 글에만 - 월간 막대·년간 기간 줄) */
  whole?: boolean;
  /** 크기·여백 (자리마다 다르다) */
  className: string;
  /** 자리마다의 data-* (점검이 찾는다) */
  data?: Record<string, string | undefined>;
  /** 칩 빛깔 덧칠 (월간 기간 막대 - 같은 라벨 빛 막대 위라 흰 바탕) */
  style?: CSSProperties;
}

/** 완료 표시 ✓ - 칩이 없는 좁은 자리(휴대폰 월간·여러 개 고르기·학사력)는 글 앞에 이것만 */
export function DoneMark({ className = '' }: { className?: string }) {
  return (
    <span data-event-check className={`inline align-middle mr-1 font-black text-emerald-600 ${className}`} aria-label="완료">
      ✓
    </span>
  );
}

export default function EventDoneChip({ label, done, mark = true, onToggle, forward, whole, className, data, style }: Props) {
  if (!label && !onToggle && !done) return null;
  const c = label ? labelColor(label.color) : null;
  const act = onToggle
    ? {
        role: 'button',
        tabIndex: 0,
        'aria-pressed': done,
        onClick: (e: MouseEvent) => {
          e.stopPropagation();
          onToggle();
        },
        onKeyDown: (e: KeyboardEvent) => {
          if (e.key !== 'Enter' && e.key !== ' ') return;
          e.preventDefault();
          e.stopPropagation();
          onToggle();
        },
        title: whole
          ? done
            ? '눌러서 기간 전체 완료 풀기'
            : '눌러서 기간 전체 완료 (하루만은 하루·주간 화면에서)'
          : done
            ? '눌러서 완료 풀기'
            : forward
              ? '눌러서 완료 (이월 정지)'
              : '눌러서 완료',
      }
    : {};
  const check = done && mark;
  // 눈에 띄게 초록 동그라미에 흰 ✓ (#123)
  const checkMark = (
    <span data-event-check className="inline-flex items-center justify-center w-[1.15em] h-[1.15em] rounded-full bg-emerald-600 text-white text-[0.75em] font-black leading-none shrink-0">
      ✓
    </span>
  );
  return (
    <span
      {...data}
      {...act}
      data-event-done-chip={mark && onToggle ? (done ? '1' : '0') : undefined}
      aria-label={c ? undefined : done ? '완료 풀기' : '일정 완료'}
      className={`relative inline-flex items-center gap-1 align-middle font-bold rounded shadow-2xs whitespace-nowrap ${onToggle ? 'cursor-pointer hover:brightness-95' : ''} ${className}`}
      style={{
        ...(c
          ? { backgroundColor: c.bg, color: c.text, border: '1px solid ' + c.border }
          : { backgroundColor: 'var(--color-slate-100)', color: 'var(--color-slate-500)', border: '1px solid var(--color-slate-200)' }),
        ...style,
      }}
    >
      {label ? (
        check ? (
          // 라벨 칩 완료 (#123·#127): 칩 크기는 원래 글자가 그대로 잡고(보이지 않게 - 글은 ::before라 textContent에 겹치지 않는다),
          // 그 칩 안에 ✓와 줄인 글자를 겹쳐 그린다 - 완료 전후 칩 크기가 같다(여백까지 쓴다)
          <>
            <span aria-hidden data-ghost={label.name} className="invisible before:content-[attr(data-ghost)]" />
            <span className="absolute inset-0 flex items-center justify-center gap-px px-px overflow-hidden">
              {checkMark}
              <span className="text-[0.75em] leading-none">{label.name}</span>
            </span>
          </>
        ) : (
          label.name
        )
      ) : check ? (
        checkMark
      ) : (
        // 라벨 없는 칩: 완료 전 ○ (✓와 같은 크기)
        mark && <span className="inline-block w-[1.15em] h-[1.15em] text-[0.75em] shrink-0 rounded-full border-[1.5px] border-current opacity-70" />
      )}
    </span>
  );
}
