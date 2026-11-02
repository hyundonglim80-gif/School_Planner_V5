// 겹쳐 본 다른 공간 일정 앞의 공간 색 점 (P17-2 - 주간·월간·년간 칩·막대·줄). 하루 화면 카드는 ▲▼ 자리에 따로 그린다(day/DayEvents).
import type { OverlaySpace } from '../../data/select';
import { spaceTitle } from '../../domain/spaceColor';

export default function SpaceDot({ space, className = '' }: { space: Pick<OverlaySpace, 'sid' | 'name' | 'color'>; className?: string }) {
  return (
    <span
      data-event-space-dot={space.sid}
      title={spaceTitle(space)}
      className={`inline-block align-middle w-2 h-2 rounded-full shrink-0 mr-1 ${className}`}
      style={{ backgroundColor: space.color }}
    />
  );
}
