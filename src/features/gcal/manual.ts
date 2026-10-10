// 구글 캘린더로 손으로 보내기 (V4 lib/calendarSync exportCalendarData·calendarSyncTask) - 창 밖에서 돈다.
// 진행 상황은 이 store가 들고 창은 구경만 한다 - 창을 닫아도 끝까지 돌고, 끝나면 알린다. 두 번 눌러도 두 번 돌지 않는다.
// 종류마다 전용 캘린더(SP(work)·SP(class)·SP(commentary)), 우리 표시(app=SchoolPlannerV3)가 붙은 것만 맞춘다. 보내기만 한다(구글에서 고친 것은 돌아오지 않는다).
import { create } from 'zustand';
import type { Scope } from '../../app/route';
import { showErrorToast, showToast } from '../../app/toast';
import { CALENDAR_NAME, dateRange, manualPayloads, planManualSync, type GoogleEvent, type ManualDay, type SyncKind, type SyncMode } from '../../domain/gcal';
import { deleteCalendarEvent, getOrCreateCalendarByName, insertCalendarEvent, listCalendarEvents, updateCalendarEvent } from '../../data/google/calendar';
import { academicYearOf, monthEnd, weekDates } from '../../domain/dateUtils';
import { schoolYearSpan } from '../../domain/semester';
import { GoogleApiError } from '../../data/google/token';

export interface CalendarSyncState {
  running: boolean;
  message: string;
  percent: number;
  /** 마지막으로 끝난 보내기의 결과 (창을 다시 열면 보인다) */
  lastResult: string;
}

const IDLE: CalendarSyncState = { running: false, message: '', percent: 0, lastResult: '' };

export const useCalendarSync = create<CalendarSyncState>(() => IDLE);

const set = (p: Partial<CalendarSyncState>) => useCalendarSync.setState(p);

export const KIND_NAME: Record<SyncKind, string> = { event: '일정', class: '수업', journal: '기록' };

export interface ManualSyncArgs {
  token: string;
  start: string;
  end: string;
  mode: SyncMode;
  include: Record<SyncKind, boolean>;
  /** 그날 보낼 것 (화면 store로 셈한다) */
  dayOf: (date: string) => ManualDay;
}

const isAuth = (e: unknown) => e instanceof GoogleApiError && (e.status === 401 || e.status === 403);

/** 보내기 시작 (이미 돌고 있으면 알리기만). 창을 닫아도 끝까지 돈다 */
export async function startCalendarSync(args: ManualSyncArgs): Promise<void> {
  if (useCalendarSync.getState().running) {
    showToast('이미 보내는 중입니다. 끝나면 알려드립니다.');
    return;
  }
  const kinds = (['event', 'class', 'journal'] as SyncKind[]).filter((k) => args.include[k]);
  set({ running: true, message: '준비 중...', percent: 0, lastResult: '' });
  try {
    set({ message: '캘린더를 확인하는 중...', percent: 5 });
    const calIds = {} as Record<SyncKind, string>;
    for (const k of kinds) calIds[k] = await getOrCreateCalendarByName(args.token, CALENDAR_NAME[k]);

    set({ message: '이미 올라가 있는 일정을 확인하는 중...', percent: 15 });
    const range = { timeMin: new Date(`${args.start}T00:00:00+09:00`).toISOString(), timeMax: new Date(`${args.end}T23:59:59+09:00`).toISOString() };
    const existing = {} as Record<SyncKind, Map<string, GoogleEvent[]>>;
    for (const k of kinds) {
      const byDate = new Map<string, GoogleEvent[]>();
      for (const ev of await listCalendarEvents(args.token, calIds[k], ['app=SchoolPlannerV3'], range)) {
        const d = ev.extendedProperties?.private?.dateStr;
        if (d) byDate.set(d, [...(byDate.get(d) ?? []), ev]);
      }
      existing[k] = byDate;
    }

    const days = dateRange(args.start, args.end);
    const counts: Record<SyncKind, number> = { event: 0, class: 0, journal: 0 };
    let failed = 0;
    for (let i = 0; i < days.length; i++) {
      const date = days[i];
      set({ message: `구글 캘린더에 반영하는 중... (${date})`, percent: Math.round(20 + (75 * (i + 1)) / days.length) });
      const payloads = manualPayloads(args.dayOf(date));
      for (const k of kinds) {
        const there = existing[k].get(date) ?? [];
        if (payloads[k].length === 0 && there.length === 0) continue;
        const plan = planManualSync(there, payloads[k], args.mode);
        const run = async (fn: () => Promise<unknown>) => {
          try {
            await fn();
          } catch (e) {
            if (isAuth(e)) throw e;
            failed++;
            console.warn('[gcal] 구글 캘린더 반영 실패', date, e);
          }
        };
        for (const p of plan.post) await run(() => insertCalendarEvent(args.token, calIds[k], p));
        for (const { id, payload } of plan.put) await run(() => updateCalendarEvent(args.token, calIds[k], id, payload));
        for (const id of plan.del) await run(() => deleteCalendarEvent(args.token, calIds[k], id));
        counts[k] += payloads[k].length;
      }
    }
    const summary = kinds.map((k) => `${KIND_NAME[k]} ${counts[k]}건`).join(', ');
    set({ running: false, message: '', percent: 0, lastResult: summary });
    if (failed) showErrorToast(`구글 캘린더로 보냈지만 ${failed}건은 반영하지 못했습니다. 다시 보내면 맞춥니다. (${summary})`);
    else showToast(`✅ 구글 캘린더로 보냈습니다. (${summary})`);
  } catch (e) {
    set({ running: false, message: '', percent: 0 });
    showErrorToast(isAuth(e) ? '구글 캘린더 권한이 없습니다. 다시 로그인해 캘린더 접근을 허용해 주세요.' : '구글 캘린더로 보내지 못했습니다.', e);
  }
}

/** 시험용 */
export function resetCalendarSync() {
  useCalendarSync.setState(IDLE, true);
}

/** 지금 보는 화면의 기간 (V4 rangeForScope - 하루·메모·학급은 그날, 주간은 그 주, 월간은 그 달, 년간은 학년도) */
export function rangeForScope(scope: Scope, date: string): { start: string; end: string } {
  if (scope === 'week') {
    const w = weekDates(date);
    return { start: w[0], end: w[6] };
  }
  if (scope === 'month') {
    const [y, m] = date.split('-').map(Number);
    return { start: `${date.slice(0, 7)}-01`, end: monthEnd(y, m) };
  }
  if (scope === 'year') return schoolYearSpan(academicYearOf(date));
  return { start: date, end: date };
}
