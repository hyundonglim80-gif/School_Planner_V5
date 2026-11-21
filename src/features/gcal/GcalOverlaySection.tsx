// 환경설정 보기 탭 '📅 구글 캘린더 겹쳐 보기' (P36-3 - PLAN 5장 'P36-3 구글 캘린더 받기 ■0 정한 것' ①②⑥⑦).
//   📋 내 캘린더 목록 받기(누른 때라 로그인 창이 막히지 않는다) → 캘린더마다 체크(색 점 + 이름) - 고른 것은 계정 칸 common gcalOverlay(10개까지).
//   고른 것은 목록을 받지 않아도 늘 보인다(이름·색은 고를 때 적은 것). 앱이 보내는 SP(work)·SP(class)·SP(commentary)는 목록에 없다.
//   받아 둔 일정 수·받은 때 + 🔄 다시 받기(누른 때 - 로그인이 끊겼으면 묻는다). 받는 일은 data/gcalOverlay, 저절로 받기는 overlayAuto.
import { useState } from 'react';
import { setCommonSetting, useCommonSettings } from '../../app/prefs';
import { useNav } from '../../app/nav';
import { showErrorToast, showToast } from '../../app/toast';
import { MAX_OVERLAY_CALENDARS, neededMonths, pickableCalendars, type OverlayCalendar, type PickableCalendar } from '../../domain/gcalOverlay';
import { ensureGcalMonths, pruneGcalCalendars, useGcalOverlay } from '../../data/gcalOverlay';
import { listCalendars } from '../../data/google/calendar';
import { withGoogleToken } from '../../data/google/token';
import { useSession } from '../../data/session';

const LIST_REASON = '내 구글 캘린더 목록을 받으려면 구글 로그인이 필요합니다.';

const timeLabel = (ms: number) => new Date(ms).toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' });

/** 고른 캘린더의 받아 둔 일정 수 (여러 달에 담긴 것은 하나) */
function countEvents(rows: Record<string, { events: ReadonlyArray<{ id: string }> }>, ids: readonly string[]): number {
  const keep = new Set(ids);
  const seen = new Set<string>();
  for (const [key, row] of Object.entries(rows)) {
    const cal = key.slice(0, key.lastIndexOf('|'));
    if (keep.has(cal)) for (const ev of row.events) seen.add(`${cal}\n${ev.id}`);
  }
  return seen.size;
}

export default function GcalOverlaySection() {
  const uid = useSession((s) => s.user?.uid ?? '');
  const picked = useCommonSettings((s) => s.gcalOverlay);
  const scope = useNav((s) => s.scope);
  const date = useNav((s) => s.date);
  const st = useGcalOverlay();
  const [list, setList] = useState<PickableCalendar[] | null>(null);
  const [listing, setListing] = useState(false);

  const ids = picked.map((c) => c.id);
  const months = () => {
    const m = neededMonths(scope, date);
    // 메모·학급 화면에서 열었으면 그달 ±1
    return m.length ? m : neededMonths('month', date);
  };
  const shown = st.uid === uid ? st : null;
  const count = shown ? countEvents(shown.rows, ids) : 0;

  const loadList = async () => {
    if (listing) return;
    setListing(true);
    try {
      const got = pickableCalendars(await withGoogleToken(LIST_REASON, listCalendars));
      setList(got);
      // 고른 것의 이름·색이 구글에서 바뀌었으면 따라간다
      const fresh = new Map(got.map((c) => [c.id, c]));
      const next = picked.map((c) => {
        const f = fresh.get(c.id);
        return f ? { id: c.id, name: f.name, color: f.color } : c;
      });
      if (next.some((c, i) => c.name !== picked[i].name || c.color !== picked[i].color)) setCommonSetting('gcalOverlay', next);
      if (!got.length) showToast('고를 수 있는 구글 캘린더가 없습니다.');
    } catch (e) {
      showErrorToast(e instanceof Error ? e.message : '구글 캘린더 목록을 받지 못했습니다.', e);
    } finally {
      setListing(false);
    }
  };

  const toggle = (cal: OverlayCalendar, on: boolean) => {
    if (on) {
      if (ids.includes(cal.id)) return;
      if (picked.length >= MAX_OVERLAY_CALENDARS) return showToast(`구글 캘린더는 ${MAX_OVERLAY_CALENDARS}개까지 고를 수 있습니다.`);
      setCommonSetting('gcalOverlay', [...picked, { id: cal.id, name: cal.name, color: cal.color }]);
      // 고르면 곧바로 그 캘린더만 받는다 (누른 때라 로그인을 물어도 된다)
      void ensureGcalMonths(uid, [cal.id], months(), { interactive: true });
    } else {
      const rest = picked.filter((c) => c.id !== cal.id);
      setCommonSetting('gcalOverlay', rest);
      void pruneGcalCalendars(uid, rest.map((c) => c.id));
    }
  };

  const refresh = () => void ensureGcalMonths(uid, ids, months(), { interactive: true, force: true });

  // 고른 것 먼저(고른 차례), 그다음 받은 목록의 나머지
  const rows: Array<OverlayCalendar & { primary?: boolean; on: boolean }> = [
    ...picked.map((c) => ({ ...c, primary: list?.find((l) => l.id === c.id)?.primary, on: true })),
    ...(list ?? []).filter((c) => !ids.includes(c.id)).map((c) => ({ ...c, on: false })),
  ];

  return (
    <div data-gcal-overlay className="space-y-2">
      <button
        type="button"
        data-gcal-overlay-load
        onClick={() => void loadList()}
        aria-busy={listing}
        className="px-3 py-1.5 rounded-lg text-xs font-bold border bg-white text-slate-600 border-slate-200 hover:border-primary hover:text-primary transition-colors cursor-pointer"
      >
        {listing ? '받는 중...' : list ? '📋 목록 다시 받기' : '📋 내 캘린더 목록 받기'}
      </button>

      {rows.length > 0 && (
        <ul data-gcal-overlay-list className="divide-y divide-slate-100 border border-slate-100 rounded-xl">
          {rows.map((c) => (
            <li key={c.id}>
              <label data-gcal-overlay-row={c.id} className="flex items-center gap-2.5 px-3 py-2 cursor-pointer">
                <input
                  type="checkbox"
                  data-gcal-overlay-pick={c.id}
                  checked={c.on}
                  onChange={(e) => toggle(c, e.target.checked)}
                  className="w-4 h-4 shrink-0 rounded border-slate-300 accent-primary cursor-pointer"
                />
                <span aria-hidden className="w-3 h-3 shrink-0 rounded-full" style={{ backgroundColor: c.color }} />
                <span className="min-w-0 flex-1 truncate text-sm font-bold text-slate-700" title={c.name}>
                  {c.name}
                  {c.primary && <span className="ml-1 text-xs font-normal text-slate-500">(기본)</span>}
                </span>
                {c.on && shown?.missing[c.id] && (
                  <span data-gcal-overlay-missing={c.id} className="shrink-0 text-xs font-bold text-amber-700">
                    구글에서 찾을 수 없음
                  </span>
                )}
              </label>
            </li>
          ))}
        </ul>
      )}

      {picked.length > 0 && (
        <div data-gcal-overlay-status className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
          <span data-gcal-overlay-count={count}>
            받아 둔 일정 {count}개{shown?.lastAt ? ` · ${timeLabel(shown.lastAt)}에 받음` : ''}
            {shown?.fetching ? ' · 받는 중...' : ''}
          </span>
          <button
            type="button"
            data-gcal-overlay-refresh
            onClick={refresh}
            className="px-2 py-1 rounded-lg font-bold border bg-white text-slate-600 border-slate-200 hover:border-primary hover:text-primary transition-colors cursor-pointer"
          >
            🔄 다시 받기
          </button>
          {shown?.needsLogin && (
            <span data-gcal-overlay-login className="basis-full text-amber-700">
              구글 로그인이 끊겨 전에 받아 둔 일정을 보여 줍니다. 🔄 다시 받기를 누르면 로그인하고 새로 받습니다.
            </span>
          )}
          {shown?.error && !shown.needsLogin && (
            <span data-gcal-overlay-error className="basis-full text-amber-700">
              {shown.error} 전에 받아 둔 일정은 그대로입니다.
            </span>
          )}
        </div>
      )}
    </div>
  );
}
