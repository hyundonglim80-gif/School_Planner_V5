// 📅 구글 캘린더 일정 (P36-4 - PLAN 5장 'P36-4 구글 캘린더 겹쳐 그리기 ■0 정한 것' ②). 창 'gcalEvent' = { date, shown } - 겹쳐 그린 구글 일정을 누르면.
// 구글 일정은 보여 주기만 한다(이 기기에 받아 둔 것 - 앱 자료가 아니다):
//   - 제목·때·캘린더(색 점 + 이름)·📍 장소·설명(글로만 - 구글이 섞어 준 HTML은 걷는다)
//   - '↗ 구글 캘린더에서 열기' = 구글 주소(htmlLink) 새 탭 - 고치기·지우기는 구글에서
//   - '📅 일정으로 담기' = 그 날 새 일정 칸을 제목을 적어 둔 채 연다(학사일정 창과 같다 - 담은 것은 내 일정이라 구글이 바꿔도 따라가지 않는다)
import type { WindowProps } from '../../app/windows';
import { shortDateLabel } from '../../domain/dateUtils';
import { gcalPlainText, gcalWhenLabel } from '../../domain/gcalShow';
import { useCurrentSpaceId } from '../../data/session';
import ModalShell, { ModalCloseButton } from '../../ui/ModalShell';
import { openEventPanel } from '../events/open';
import type { GcalEventParams } from './open';
import { Glyph } from '../../ui/Icon';

export default function GcalEventWindow({ params, close, raise }: WindowProps<GcalEventParams>) {
  const { date, shown } = params;
  const { ev, cal } = shown;
  const sid = useCurrentSpaceId();
  const description = ev.description ? gcalPlainText(ev.description) : '';

  const toEvent = () => {
    // 쓰는 칸이 오른쪽 줄에 서므로 이 창은 닫는다 (다시 누르면 또 열린다)
    close();
    if (sid) openEventPanel({ sid, date, draftText: ev.title });
  };

  return (
    <ModalShell
      isOpen
      onClose={close}
      raise={raise}
      width="sm"
      title={
        <span>
          <Glyph e="📅" /> 구글 캘린더 일정 <span className="text-sm font-bold text-slate-500">· {shortDateLabel(date)}</span>
        </span>
      }
      footer={<ModalCloseButton onClose={close} />}
    >
      <div className="space-y-3" data-gcal-window={`${ev.cal}\n${ev.id}`}>
        <div className="p-3 rounded-xl border border-dashed border-slate-300 bg-white space-y-2">
          <div data-gcal-window-title className="text-base font-extrabold text-slate-800 break-words">
            {ev.title}
          </div>
          <div data-gcal-window-when className="text-sm font-bold text-slate-600">
            <Glyph e="🕘" /> {gcalWhenLabel(shown)}
          </div>
          <div data-gcal-window-cal className="flex items-center gap-1.5 text-xs font-bold text-slate-600 min-w-0">
            <span aria-hidden className="w-3 h-3 shrink-0 rounded-full" style={{ backgroundColor: cal.color }} />
            <span className="truncate">{cal.name}</span>
            <span className="shrink-0 font-normal text-slate-500">(구글 캘린더)</span>
          </div>
          {ev.location && (
            <div data-gcal-window-location className="text-sm text-slate-700 break-words">
              <Glyph e="📍" /> {ev.location}
            </div>
          )}
          {description && (
            <div data-gcal-window-description className="text-sm text-slate-700 whitespace-pre-wrap break-words max-h-64 overflow-y-auto border-t border-slate-100 pt-2">
              {description}
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {ev.link && (
            <a
              data-gcal-window-open
              href={ev.link}
              target="_blank"
              rel="noopener noreferrer"
              title="구글 캘린더에서 이 일정을 엽니다 (새 탭) - 고치기·지우기는 구글에서"
              className="px-2.5 py-1.5 text-xs font-bold rounded-lg border transition-colors bg-white border-blue-200 text-blue-700 hover:bg-blue-50 cursor-pointer"
            >
              ↗ 구글 캘린더에서 열기
            </a>
          )}
          <button
            type="button"
            data-gcal-window-to-event
            onClick={toEvent}
            title="이 날짜의 새 일정 칸을 제목을 적어 둔 채 엽니다 - 라벨을 골라 저장하세요"
            className="px-2.5 py-1.5 text-xs font-bold rounded-lg border transition-colors bg-white border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            <Glyph e="📅" /> 일정으로 담기
          </button>
        </div>
        <p className="text-xs text-slate-500 leading-relaxed">
          고치거나 지우려면 구글 캘린더에서 하세요. 담은 일정은 구글이 바뀌어도 그대로입니다.
        </p>
      </div>
    </ModalShell>
  );
}
