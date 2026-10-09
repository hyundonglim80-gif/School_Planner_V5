// 하루 화면 ⏰ 수업 칸 (V4 features/day/DaySchedule.tsx). 교시마다 카드 - 과목 굵고 크게(PC 18px·휴대폰 16px), 과목이 있으면 왼쪽 교시 색 막대.
//   - 수업 칸은 계산이다(domain/lessons): 그날 바꾼 칸(lessonDays) → 수업 없는 날 → 그 기간 시간표. '✎'는 그날만 바꾼 과목.
//   - 교시를 누르면 그 자리에서 고친다(과목·준비물·메모). 저장·Ctrl+S, 바깥을 누르면 고친 것을 저장하고 닫는다, 닫기·ESC는 저장 없이.
//     고친 것은 lessonDays의 그 칸만(field path) - 시간표와 같은 과목은 적지 않는다(features/lessons/lessonOps).
//   - 지금 몇 교시: 교시 시각(시간표 창 '교시')을 적어 두면 오늘은 '지금 · N분 남음' / '다음 · N분 뒤', 머리줄에 다음 교시와 준비물.
//   - 교과 모드(전담·(중등) 전담 + 담임): 반을 크게·반 색 막대, 수정 칸은 학년-반 + 과목 두 칸, '⏪ 지난 시간' 줄(같은 반·과목의 바로 앞 수업 메모).
//   - ▲▼ 위아래 교시와 맞바꾸기, 🔗 링크 추가, 📑 n 연결된 것, ✏️ 고치기. 머리줄 ⚙️ = 시간표 창.
//   - 📘 진도 줄(features/progress - P6-2): 진도를 넣은 과목이면 그 교시의 차시·준비물, 수정 칸에서 진도가 없으면 '📘 진도 만들기'(개인 공간만).
//   - 🔔 종(features/bell - P6-3): '수업' 옆 단추로 수업 종 설정을 펼친다.
//   - 🍚 급식·📚 학사(features/school - P6-3): 카드 아래, 환경설정 '우리 학교'를 골랐을 때만.
// 아직 옮기지 않은 것(그 세션이 머리줄·카드에 더한다): 📢 알림장·📋 출석부·🎯 뽑기(P7) · 📊 조사표(P7-4) · 🙋 교과 출결·반 도구(P7).
import { useEffect, useMemo, useRef, useState } from 'react';
import type React from 'react';
import { setDate } from '../../app/nav';
import { useCommonSettings } from '../../app/prefs';
import { listWindows, openWindow } from '../../app/windows';
import { addDays, shortDateLabel } from '../../domain/dateUtils';
import { lessonsOn, OFF_REASON_LABEL, type LessonCell } from '../../domain/lessons';
import { periodLabel, periodRangeLabel, periodStateAt, timesOf, validPeriods } from '../../domain/periodTimes';
import { normalizeSlotText, parseSlot, previousSlotOf } from '../../domain/teachingSlot';
import { useHolidayName } from '../../data/holidays';
import { useDocs } from '../../data/select';
import { useCurrentSpaceId, usePersonalSpaceId } from '../../data/session';
import AutoTextarea from '../../ui/AutoTextarea';
import { useClock } from '../../ui/useClock';
import { isSaveKey } from '../../ui/useSaveKey';
import { useToday } from '../../ui/useToday';
import { lessonLinkId } from '../links/linkOps';
import { openLinker, openLinkViewer } from '../links/open';
import { useClassBell } from '../bell/bell';
import BellSettings from '../bell/BellSettings';
import DayMeals from '../school/DayMeals';
import ProgressMarkLine, { ProgressCreateButton } from '../progress/ProgressMarkLine';
import { useProgressMarks } from '../progress/useProgress';
import { slotId } from '../../domain/progress';
import { useFocusReveal } from '../search/focus';
import { saveLesson, swapLessons } from './actions';
import { isEdited } from './lessonOps';
import SlotPairInput from './SlotPairInput';
import { useClassColorOf, useSlotPairOptions, useTeaching } from './teaching';
import { cachedSubjects, useLessonSource } from './useLessons';

const PERIOD_COLORS = [
  'bg-blue-50 text-blue-700 border-blue-200',
  'bg-emerald-50 text-emerald-700 border-emerald-200',
  'bg-amber-50 text-amber-700 border-amber-200',
  'bg-purple-50 text-purple-700 border-purple-200',
  'bg-rose-50 text-rose-700 border-rose-200',
  'bg-indigo-50 text-indigo-700 border-indigo-200',
  'bg-slate-50 text-slate-700 border-slate-200',
];
/** 과목이 있는 교시 카드 왼쪽의 굵은 막대 - 교시 칩과 같은 색 (차례도 같다) */
const PERIOD_ACCENTS = ['border-l-blue-400', 'border-l-emerald-400', 'border-l-amber-400', 'border-l-purple-400', 'border-l-rose-400', 'border-l-indigo-400', 'border-l-slate-400'];

/** 지난 시간을 거슬러 찾는 날 수 */
const PREV_LOOKBACK_DAYS = 60;

interface Editing {
  sid: string;
  date: string;
  n: number;
  subject: string;
  memo: string;
  supplies: string;
}

/** 바깥을 누르면 (▼ 목록은 몸 밖에 붙지만 안으로 친다) */
function useOutside(active: boolean, onOutside: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const cb = useRef(onOutside);
  useEffect(() => {
    cb.current = onOutside;
  });
  useEffect(() => {
    if (!active) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Element | null;
      if (!ref.current || !t || ref.current.contains(t) || t.closest?.('[data-combobox-list]')) return;
      cb.current();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [active]);
  return ref;
}

export default function DayLessons({ date }: { date: string }) {
  const sid = useCurrentSpaceId();
  const src = useLessonSource(sid);
  const view = useMemo(() => lessonsOn(date, src), [date, src]);
  const dayDoc = useDocs('lessonDays', sid)[date];
  const periods = useCommonSettings((s) => s.periods);
  const times = useMemo(() => timesOf(periods), [periods]);
  const holidayName = useHolidayName();
  const today = useToday();
  const isToday = date === today;
  const nowMs = useClock(isToday);
  const nowState = isToday ? periodStateAt(times, new Date(nowMs), view.cells.length) : null;
  const { isClassUnit, showHomeroomTools } = useTeaching();
  const classColorOf = useClassColorOf(date, sid);
  const pairOptions = useSlotPairOptions(date, sid);

  const [collapsed, setCollapsed] = useState(false);
  // 수업 종 설정 - '⏰ 수업' 옆 🔔 단추로 펼친다 (V4 10-07 사용자 요청 - 시간표 창에서 옮김)
  const bell = useClassBell();
  const [bellOpen, setBellOpen] = useState(false);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [saving, setSaving] = useState(false);
  useFocusReveal((t) => t.kind === 'lesson' && t.date === date, () => setCollapsed(false));

  // 교과 모드: 같은 반·과목의 바로 앞 수업 (그 수업에 적은 메모 첫 줄을 보인다)
  const recent = isClassUnit ? cachedSubjects(src, addDays(date, -PREV_LOOKBACK_DAYS), date) : null;
  // 진도는 개인 공간 수업으로 센다 - 그룹 공간에서는 겹치지 않는다
  const { marks } = useProgressMarks(date);
  const personalSid = usePersonalSpaceId();
  const inPersonal = !!sid && sid === personalSid;

  const subjectToSave = (text: string) => (isClassUnit ? normalizeSlotText(text) : text.trim());
  const cellOf = (n: number) => view.cells.find((c) => c.n === n);
  const open = editing && editing.date === date && editing.sid === sid ? editing : null;

  const startEdit = (c: LessonCell) => {
    if (!sid) return;
    setEditing({ sid, date, n: c.n, subject: c.subject, memo: c.memo, supplies: c.supplies });
  };

  /** 저장 - 칸을 연 순간의 공간·날짜에. 실패하면 칸을 닫지 않는다 */
  const save = async (e: Editing): Promise<boolean> => {
    if (saving) return false;
    const cell = lessonsOn(e.date, src).cells.find((c) => c.n === e.n);
    if (!cell) return false;
    setSaving(true);
    try {
      await saveLesson(e.sid, e.date, e.date === date ? dayDoc : undefined, cell, { subject: subjectToSave(e.subject), memo: e.memo, supplies: e.supplies });
      setEditing(null);
      return true;
    } catch {
      return false;
    } finally {
      setSaving(false);
    }
  };

  // 바깥을 누르면: 고친 것이 없으면 닫고, 있으면 저장하고 닫는다
  const editRef = useOutside(!!open, () => {
    if (!open || saving) return;
    const cell = cellOf(open.n);
    if (cell && isEdited(cell, { subject: subjectToSave(open.subject), memo: open.memo, supplies: open.supplies })) void save(open);
    else setEditing(null);
  });

  const editorKeys = (e: React.KeyboardEvent) => {
    if (!open) return;
    if (isSaveKey(e.nativeEvent)) {
      e.preventDefault();
      e.stopPropagation();
      void save(open);
    } else if (e.key === 'Escape' && !e.nativeEvent.isComposing) {
      // 고치던 칸만 닫는다 (오른쪽 줄까지 닫지 않게)
      e.stopPropagation();
      setEditing(null);
    }
  };

  const swap = (a: number, b: number) => {
    const ca = cellOf(a);
    const cb = cellOf(b);
    if (!sid || !ca || !cb) return;
    void swapLessons(sid, date, dayDoc, ca, cb).catch(() => {});
  };

  const subjectOf = (n: number) => cellOf(n)?.subject ?? '';
  /** 머리줄에 적는 한 줄 - 지금 교시 / 다음 교시까지 */
  const nowLine = (() => {
    if (!nowState) return '';
    if (nowState.kind === 'during') {
      return `지금 ${nowState.period}교시${subjectOf(nowState.period) ? ' ' + subjectOf(nowState.period) : ''} · ${nowState.minutesLeft}분 남음`;
    }
    if (nowState.kind === 'break' || nowState.kind === 'before') {
      const p = nowState.next;
      const supplies = (cellOf(p)?.supplies ?? '').trim();
      return (
        (nowState.kind === 'break' ? '쉬는 시간 · ' : '') +
        `다음 ${p}교시${subjectOf(p) ? ' ' + subjectOf(p) : ''} ${nowState.minutes}분 뒤` +
        (supplies ? ` · 준비물 ${supplies}` : '')
      );
    }
    return '';
  })();

  const offText = view.off ? (view.off === 'holiday' ? `🎌 ${holidayName(date) ?? OFF_REASON_LABEL.holiday}` : view.off === 'vacation' ? '🏖️ 방학' : `🚫 ${OFF_REASON_LABEL.skip}`) : '';
  // 하루 수업 머리줄 단추 (창 목록의 lessonHeader - 알림장·출석부·진도·뽑기는 그 기능을 옮기는 세션이 등록한다)
  const headerWindows = listWindows().filter((d) => d.lessonHeader && (d.show?.({ homeroom: showHomeroomTools, classUnit: isClassUnit }) ?? true));

  return (
    <section data-day-lessons={date} className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5">
      <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${collapsed ? '' : 'mb-4'}`}>
        {/* 제목은 줄어들지 않는다. 좁으면 오른쪽의 '지금' 안내만 줄어든다 (V4 - '수업'이 '수/업'으로 꺾였다) */}
        <div className="flex items-center gap-2 shrink-0 whitespace-nowrap">
          <button
            type="button"
            data-lessons-collapse
            onClick={() => setCollapsed(!collapsed)}
            className="text-slate-400 hover:text-slate-700 text-xs px-1 py-0.5 rounded hover:bg-slate-100 transition-colors cursor-pointer"
            title={collapsed ? '수업 펼치기' : '수업 접기'}
          >
            {collapsed ? '▶' : '▼'}
          </button>
          <span className="text-xl" aria-hidden>
            ⏰
          </span>
          <h3 className="text-base font-extrabold text-slate-800">수업</h3>
          <button
            type="button"
            data-day-bell
            aria-expanded={bellOpen}
            onClick={() => setBellOpen((v) => !v)}
            className={`px-2 py-1 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
              bell.enabled ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200' : 'bg-white hover:bg-slate-50 text-slate-500 border-slate-200'
            }`}
            title="수업 종 - 교시 시작·끝 시각에 종을 울립니다"
          >
            {bell.enabled ? '🔔 종' : '🔕 종'}
          </button>
          {offText && (
            <span data-lessons-off={view.off} className="text-2xs font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-100" title="이날은 시간표 수업이 없습니다 (그날 따로 적은 과목은 보입니다)">
              {offText}
            </span>
          )}
          {!collapsed &&
            headerWindows.map((d) => (
              <button
                key={d.id}
                type="button"
                data-lessons-tool={d.id}
                onClick={() => openWindow(d.id, { date })}
                className="px-2 py-1 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                {d.icon} {d.title}
              </button>
            ))}
        </div>
        {!collapsed && (
          <div className="flex items-center justify-end gap-1.5 min-w-0 flex-1">
            {nowLine && (
              <span data-now-line className="min-w-0 truncate text-xs font-bold text-primary bg-blue-50 border border-blue-100 rounded-lg px-2 py-1" title={nowLine}>
                🕘 {nowLine}
              </span>
            )}
            <button
              type="button"
              data-lessons-settings
              onClick={() => openWindow('timetable')}
              className="shrink-0 w-7 h-7 flex items-center justify-center rounded-md text-sm text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
              title="시간표 설정 (시간표·교시·학기·교사 유형)"
              aria-label="시간표 설정"
            >
              ⚙️
            </button>
          </div>
        )}
      </div>

      {bellOpen && (
        <div className="mb-3 relative" data-day-bell-panel>
          <button
            type="button"
            data-day-bell-close
            onClick={() => setBellOpen(false)}
            className="absolute -top-2 -right-2 z-10 w-6 h-6 flex items-center justify-center bg-white border border-slate-200 rounded-full shadow-xs text-slate-400 hover:text-slate-700 text-xs hover:bg-slate-100 cursor-pointer"
            title="수업 종 설정 닫기"
            aria-label="수업 종 설정 닫기"
          >
            ✕
          </button>
          <BellSettings hasTimes={validPeriods(times).length > 0} />
        </div>
      )}

      {!collapsed && (
        <div className="grid grid-cols-1 gap-3">
          {view.cells.map((c) => {
            const n = c.n;
            const colorClass = PERIOD_COLORS[(n - 1) % PERIOD_COLORS.length];
            const accentClass = PERIOD_ACCENTS[(n - 1) % PERIOD_ACCENTS.length];
            const name = periodLabel(periods, n);
            const linkCount = c.linkIds.length;
            const id = lessonLinkId(date, n);

            if (open && open.n === n) {
              const set = (patch: Partial<Editing>) => setEditing({ ...open, ...patch });
              return (
                <div
                  key={n}
                  ref={editRef}
                  data-lesson-editor={n}
                  data-lesson-id={id}
                  onKeyDown={editorKeys}
                  className="p-4 rounded-xl border-2 border-primary bg-blue-50/20 shadow-xs flex flex-col gap-2"
                >
                  <div className="flex items-center justify-between">
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-black border ${colorClass}`}>{name}</span>
                    <div className="flex items-center gap-1">
                      <button type="button" data-lesson-close onClick={() => setEditing(null)} disabled={saving} className="px-2.5 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer">
                        닫기
                      </button>
                      <button type="button" data-lesson-save onClick={() => void save(open)} disabled={saving} className="px-3 py-1 bg-primary text-white text-xs font-bold rounded-lg hover:bg-blue-600 transition-colors shadow-xs cursor-pointer">
                        {saving ? '저장 중...' : '저장'}
                      </button>
                    </div>
                  </div>
                  {/* 링크는 팝업을 열지 않고도 이 자리에서 붙인다 */}
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      data-lesson-editor-link
                      onClick={() => sid && openLinker({ sid, id })}
                      className="px-3 py-1.5 bg-yellow-50 text-yellow-700 hover:bg-yellow-100 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                    >
                      🔗 링크 추가
                    </button>
                    {linkCount > 0 && (
                      <button
                        type="button"
                        data-lesson-editor-links
                        onClick={() => sid && openLinkViewer({ sid, id })}
                        className="px-3 py-1.5 bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                      >
                        📑 연결된 링크 ({linkCount})
                      </button>
                    )}
                    {/* 이 교시에 진도가 없으면 그 칸 글자로 진도 만들기 (개인 공간만 - 진도는 개인 수업으로 센다) */}
                    {!marks[slotId(date, n)] && inPersonal && <ProgressCreateButton subject={subjectToSave(open.subject)} />}
                  </div>
                  {marks[slotId(date, n)] && <ProgressMarkLine mark={marks[slotId(date, n)]} date={date} period={n} alwaysShowAction />}
                  <div className="grid grid-cols-3 gap-2">
                    {isClassUnit ? (
                      // 전담: 수업하는 학년-반 + 과목 두 칸. 저장은 '5-2 과학' 한 글자
                      <SlotPairInput
                        value={open.subject}
                        onValueChange={(v) => set({ subject: v })}
                        classOptions={pairOptions.classes}
                        subjectOptions={pairOptions.subjects}
                        className="col-span-2"
                        inputClassName="w-full px-3 py-1.5 text-xs font-bold bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                        autoFocus
                      />
                    ) : (
                      <input
                        type="text"
                        data-lesson-subject-input
                        value={open.subject}
                        onChange={(e) => set({ subject: e.target.value })}
                        placeholder="과목"
                        aria-label="과목"
                        className="col-span-1 px-3 py-1.5 text-xs font-bold bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                        autoFocus
                      />
                    )}
                    <input
                      type="text"
                      data-lesson-supplies-input
                      value={open.supplies}
                      onChange={(e) => set({ supplies: e.target.value })}
                      placeholder="준비물"
                      aria-label="준비물"
                      className={`${isClassUnit ? 'col-span-1' : 'col-span-2'} px-3 py-1.5 text-xs font-bold bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary`}
                    />
                  </div>
                  <AutoTextarea
                    data-lesson-memo-input
                    value={open.memo}
                    onChange={(e) => set({ memo: e.target.value })}
                    placeholder="수업 메모..."
                    aria-label="수업 메모"
                    className="w-full min-h-[40px] p-2.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary placeholder-slate-400 leading-relaxed"
                  />
                  {c.changed && (
                    <p className="text-2xs text-slate-400" data-lesson-base>
                      시간표: {c.base || '(수업 없음)'} - 과목을 이것으로 고치면 다시 시간표를 따릅니다.
                    </p>
                  )}
                </div>
              );
            }

            // 빈 메모·준비물은 그리지 않는다(둘 다 비면 한 줄 카드 - 휴대폰에서도 아래 일정 칸이 금방 나온다)
            const isNow = nowState?.kind === 'during' && nowState.period === n;
            const isNext = (nowState?.kind === 'break' || nowState?.kind === 'before') && nowState.next === n;
            const range = periodRangeLabel(times, n);
            // 교과 모드에서 칸 글자에 반이 있으면('5-2 과학') 반을 크게, 막대는 반 색. 반이 없는 칸('창체')은 그대로
            const slot = isClassUnit && c.subject ? parseSlot(c.subject) : null;
            const slotColor = slot?.cls ? classColorOf(slot.cls) : null;
            const prev = slot?.cls && recent ? previousSlotOf(recent, c.subject, date, n) : null;
            const prevNote = prev ? (src.days[prev.date]?.periods?.[prev.period]?.memo ?? '').split('\n')[0].trim() : '';
            const mark = marks[slotId(date, n)];
            const hasDetails = !!(c.memo || c.supplies || prevNote || mark);
            return (
              <div
                key={n}
                data-lesson-card={n}
                data-lesson-id={id}
                data-now={isNow ? 'true' : isNext ? 'next' : undefined}
                data-slot-color={slotColor?.name}
                onClick={() => startEdit(c)}
                title="눌러서 고치기"
                className={`group relative ${hasDetails ? 'p-3.5' : 'px-3.5 py-2'} rounded-xl border border-slate-200/70 transition-all flex flex-col justify-between min-h-[40px] hover:border-primary/50 hover:bg-slate-50/50 cursor-pointer ${
                  c.subject ? `border-l-4 ${slotColor ? slotColor.bar : accentClass}` : ''
                } ${isNow ? 'ring-2 ring-primary/60 bg-blue-50/40' : isNext ? 'ring-1 ring-primary/30' : ''}`}
              >
                <div className="flex gap-3 h-full items-stretch">
                  <div className="flex flex-col items-center justify-center gap-1 shrink-0 px-1">
                    <button
                      type="button"
                      data-lesson-up={n}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (n > 1) swap(n, n - 1);
                      }}
                      disabled={n <= 1}
                      title="위 교시와 맞바꾸기"
                      aria-label="위 교시와 맞바꾸기"
                      className="text-slate-300 hover:text-primary disabled:opacity-30 disabled:hover:text-slate-300 p-0.5 leading-none text-xs cursor-pointer"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      data-lesson-down={n}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (n < view.cells.length) swap(n, n + 1);
                      }}
                      disabled={n >= view.cells.length}
                      title="아래 교시와 맞바꾸기"
                      aria-label="아래 교시와 맞바꾸기"
                      className="text-slate-300 hover:text-primary disabled:opacity-30 disabled:hover:text-slate-300 p-0.5 leading-none text-xs cursor-pointer"
                    >
                      ▼
                    </button>
                  </div>
                  <div className="flex-1 flex flex-col min-w-0">
                    <div className={`flex items-center justify-between gap-1 ${hasDetails ? 'mb-2' : ''}`}>
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <span className={`px-2 py-0.5 shrink-0 rounded-lg text-xs font-bold border ${colorClass}`}>{name}</span>
                        {range && <span className="shrink-0 text-2xs font-semibold text-slate-400 tabular-nums">{range}</span>}
                        {slot?.cls ? (
                          <span data-lesson-subject={c.subject} className="flex items-baseline gap-1.5 min-w-0 leading-tight">
                            <span data-slot-class className="shrink-0 font-black text-base sm:text-lg text-slate-900 tabular-nums">
                              {slot.cls}
                            </span>
                            {slot.subject && (
                              <span data-slot-subject className="truncate text-xs sm:text-sm font-bold text-slate-500">
                                {slot.subject}
                              </span>
                            )}
                          </span>
                        ) : (
                          <span data-lesson-subject={c.subject} className={`truncate leading-tight ${c.subject ? 'font-black text-base sm:text-lg text-slate-900' : 'text-sm'}`}>
                            {c.subject || <span className="text-slate-300 font-normal">{view.off && !c.changed ? '수업 없음' : '과목 미등록'}</span>}
                          </span>
                        )}
                        {c.changed && (
                          <span data-lesson-changed className="shrink-0 text-2xs font-bold text-amber-600" title={`이날만 바꾼 과목 (시간표: ${c.base || '수업 없음'})`}>
                            ✎
                          </span>
                        )}
                        {isNow && nowState?.kind === 'during' && (
                          <span className="shrink-0 text-2xs font-black text-white bg-primary rounded-full px-1.5 py-0.5">지금 · {nowState.minutesLeft}분 남음</span>
                        )}
                        {isNext && (nowState?.kind === 'break' || nowState?.kind === 'before') && (
                          <span className="shrink-0 text-2xs font-bold text-primary bg-blue-50 border border-blue-200 rounded-full px-1.5 py-0.5">다음 · {nowState.minutes}분 뒤</span>
                        )}
                        {linkCount > 0 && (
                          <button
                            type="button"
                            data-lesson-links={n}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (sid) openLinkViewer({ sid, id });
                            }}
                            className="bg-yellow-100 text-yellow-800 text-xs px-1.5 py-0.5 rounded font-bold border border-yellow-300 shrink-0 hover:bg-yellow-200 cursor-pointer"
                            title="연결된 항목 보기"
                          >
                            📑 {linkCount}
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          type="button"
                          data-lesson-link={n}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (sid) openLinker({ sid, id });
                          }}
                          className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-blue-600 p-1 rounded hover:bg-slate-100 text-xs transition-all cursor-pointer"
                          title="링크 추가"
                          aria-label="링크 추가"
                        >
                          🔗
                        </button>
                        <button
                          type="button"
                          data-lesson-edit={n}
                          onClick={(e) => {
                            e.stopPropagation();
                            startEdit(c);
                          }}
                          className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-blue-600 p-1 rounded hover:bg-slate-100 text-xs transition-all cursor-pointer"
                          title="수업 수정"
                          aria-label="수업 수정"
                        >
                          ✏️
                        </button>
                      </div>
                    </div>

                    {prevNote && prev && (
                      <button
                        type="button"
                        data-lesson-prev={prev.date}
                        onClick={(e) => {
                          e.stopPropagation();
                          setDate(prev.date);
                        }}
                        title={`지난 시간 수업 메모 - 누르면 ${shortDateLabel(prev.date)}로 갑니다`}
                        className={`self-start max-w-full truncate text-left text-xs text-slate-500 hover:text-primary hover:underline cursor-pointer ${mark || c.memo || c.supplies ? 'mb-1.5' : ''}`}
                      >
                        ⏪ 지난 시간 {shortDateLabel(prev.date)} {prev.period}교시: <span className="text-slate-700">{prevNote}</span>
                      </button>
                    )}

                    {mark && (
                      <div className={c.memo || c.supplies ? 'mb-2' : ''}>
                        <ProgressMarkLine mark={mark} date={date} period={n} />
                      </div>
                    )}

                    {/* 차례: 과목 / 진도 줄 / 준비물 / 메모 */}
                    {(c.memo || c.supplies) && (
                      <div className={`grid grid-cols-1 ${c.memo && c.supplies ? 'sm:grid-cols-2' : ''} gap-3 text-xs`}>
                        {c.supplies && (
                          <div className="flex flex-col" data-lesson-supplies>
                            <span className="text-slate-400 text-xs mb-0.5">📌 비고 / 준비물</span>
                            <p className="text-amber-600 font-medium whitespace-pre-wrap leading-relaxed">{c.supplies}</p>
                          </div>
                        )}
                        {c.memo && (
                          <div className="flex flex-col" data-lesson-memo>
                            <span className="text-slate-400 text-xs mb-0.5">📝 수업 메모</span>
                            <p className="text-slate-600 whitespace-pre-wrap leading-relaxed">{c.memo}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {/* 우리 학교의 그날 학사일정·급식 (P6-3 - 학교를 고르지 않았으면 없다) */}
      {!collapsed && <DayMeals date={date} />}
    </section>
  );
}
