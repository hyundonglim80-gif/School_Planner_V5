// 달력 칸의 공휴일 이름 (V4 components/HolidayName.tsx). 긴 이름('부처님오신날')은 한 단계 작게, 칸이 모자라면 잘리고 올리면 온전한 이름.
// 글자 크기는 typeScale의 이름 있는 단계만(px를 쓰면 글자 크기 키우기를 비껴간다 - V4).
import { META_TEXT, type DensityTier } from '../domain/typeScale';

/** 이 글자 수를 넘으면 한 단계 줄인다 */
const LONG_NAME = 5;
const ONE_STEP_SMALLER: Record<string, string> = { 'text-sm': 'text-xs', 'text-xs': 'text-2xs', 'text-2xs': 'text-2xs' };

export default function HolidayName({ name, tier, fill = true, className = '' }: { name: string; tier: DensityTier; fill?: boolean; className?: string }) {
  const base = META_TEXT[tier];
  const size = name.length > LONG_NAME ? (ONE_STEP_SMALLER[base] ?? base) : base;
  return (
    <span data-holiday-name={name} title={name} className={`${size} font-bold text-red-600 truncate ${fill ? 'min-w-0 flex-1' : ''} ${className}`}>
      {name}
    </span>
  );
}
