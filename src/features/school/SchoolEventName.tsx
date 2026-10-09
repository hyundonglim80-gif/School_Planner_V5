// 날짜 칸의 학사일정 이름 (V4 components/SchoolEventName.tsx). 공휴일 이름처럼 날짜 칸에 보인다 - 일정이 아니라 고칠 수 없다.
// 공휴일(빨강)과 섞이지 않게 청록색. 한 날에 여럿이면 ' · '로 잇고, 마우스를 올리면 모두(내용·학년까지) 보인다.
// 누르면 그날 학사일정 창('D-Day로'·'일정으로 담기').
import type { NeisScheduleItem } from '../../data/neis';
import { schoolEventTitle } from '../../domain/schoolSetting';
import { openSchoolEvent } from './open';

export default function SchoolEventName({ items, className = '' }: { items?: NeisScheduleItem[]; className?: string }) {
  if (!items?.length) return null;
  return (
    <button
      type="button"
      data-school-event={items[0].date}
      onClick={(e) => {
        // 날짜를 누르면 하루 화면으로 넘어가는 자리에 얹혀 있다 - 그 대신 학사일정 창만 연다
        e.stopPropagation();
        openSchoolEvent(items[0].date, items);
      }}
      title={`${schoolEventTitle(items)}\n(누르면 D-Day로·일정으로 담기)`}
      className={`text-2xs font-bold text-teal-700 truncate min-w-0 text-left hover:underline cursor-pointer ${className}`}
    >
      {items.map((it) => it.name).join(' · ')}
    </button>
  );
}
