// 하루 화면 ⏰ 수업 칸 (V4 features/day/DaySchedule.tsx). 교시마다 카드 - 과목 굵고 크게(PC 18px·휴대폰 16px), 과목이 있으면 왼쪽 교시 색 막대.
//   - 수업 칸은 계산이다(domain/lessons): 그날 바꾼 칸(lessonDays) → 수업 없는 날 → 그 기간 시간표. '바뀜'은 그날만 바꾼 과목(과목이 보이는 칸만 - 비운 칸은 '수업 없음', P11-1 · 10-16 ✎ → 글자 '바뀜' - 휴대폰은 title이 안 보여 뜻을 몰랐다).
//   - 카드: 첫 줄 교시·반·과목·내용(쪽수), 둘째 줄 단원·차시·준비물(진도 줄), 셋째 줄 비고(10-22 사용자 의견).
//   - 교시를 누르면 오른쪽 칸(LessonPanel)에서 고친다(과목·비고 - 일정·메모와 같게, 10-22 사용자 의견). 저장·Ctrl+S는 그 칸이 한다.
//     고친 것은 lessonDays의 그 칸만(field path) - 시간표와 같은 과목은 적지 않는다(features/lessons/lessonOps).
//   - 지금 몇 교시: 교시 시각(시간표 창 '교시')을 적어 두면 오늘은 '지금 · N분 남음' / '다음 · N분 뒤', 머리줄에 다음 교시와 비고 첫 줄.
//     카드에는 교시 시각을 적지 않는다(P11-1 사용자 의견 - 수업 종 설정에서만 본다, 카드 title에만).
//   - 교과 모드(전담·(중등) 전담 + 담임): 반을 크게·반 색 막대, 수정 칸은 학년-반 + 과목 두 칸, '⏪ 지난 시간' 줄(같은 반·과목의 바로 앞 수업 비고).
//   - ▲▼ 위아래 교시와 맞바꾸기, 🔗 링크 추가, 📑 n 연결된 것, ✏️ 고치기. 머리줄 ⚙️ = 시간표 창.
//   - 📘 진도 줄(features/progress - P6-2): 진도를 넣은 과목이면 그 교시의 차시·준비물, 수정 칸에서 진도가 없으면 '📘 진도 만들기'(개인 공간만).
//   - 🔔 종(features/bell - P6-3): '수업' 옆 단추로 수업 종 설정을 펼친다.
//   - 🍚 급식·📚 학사(features/school - P6-3): 카드 아래, 환경설정 '우리 학교'를 골랐을 때만.
// 교과 모드 칸의 🙋 = 그 반·그 교시 교과 출결(P7-2 - 개인 공간에서, 칸의 반이 그 학년도 명렬표에 있을 때). 교시 카드의 반 도구 = 🪑 자리표·🎯 뽑기(P7-3 - 그 반으로 연다).
// 교시마다 📊n = 그 교시 조사표(P7-4). 반 도구·🙋·📊는 적힌 것(출결·조사표 수)이 없으면 마우스를 올려야 보인다(P10-2), 수정 칸에도 같은 단추 줄.
import { useMemo, useState } from 'react';
import { setDate } from '../../app/nav';
import { useCommonSettings } from '../../app/prefs';
import { listWindows, openWindow } from '../../app/windows';
import { academicYearOf, addDays, shortDateLabel } from '../../domain/dateUtils';
import { classLabelOf } from '../../domain/roster';
import { periodSummary, readSubjectPeriods, subjectAttendanceDocId } from '../../domain/subjectAttendance';
import { firstLine, lessonNote, lessonsOn, OFF_REASON_LABEL, type LessonCell } from '../../domain/lessons';
import { periodLabel, periodRangeLabel, periodStateAt, timesOf, validPeriods } from '../../domain/periodTimes';
import { normalizeSlotText, parseSlot, previousSlotOf } from '../../domain/teachingSlot';
import { useHolidayName } from '../../data/holidays';
import { useDocs } from '../../data/select';
import { useCurrentSpaceId, usePersonalSpaceId } from '../../data/session';
import { useClock } from '../../ui/useClock';
import { useToday } from '../../ui/useToday';
import { lessonLinkId } from '../links/linkOps';
import { openLinker, openLinkViewer } from '../links/open';
import { useClassBell } from '../bell/bell';
import BellSettings from '../bell/BellSettings';
import DayMeals from '../school/DayMeals';
import ProgressMarkLine from '../progress/ProgressMarkLine';
import { useProgressMarks } from '../progress/useProgress';
import { lessonPageLabel, slotId } from '../../domain/progress';
import { useFocusReveal } from '../search/focus';
import { useClasses } from '../class/classes';
import { openSubjectAttendanceCell } from '../subjectAttendance/open';
import { openSeating } from '../seating/open';
import { reorderDragProps } from '../../ui/reorderDrag';
import { swapLessons } from './actions';
import { openLessonPanel } from './open';
import { useClassColorOf, useTeaching } from './teaching';
import { cachedSubjects, useLessonSource } from './useLessons';
import { evalCountsByPlace } from '../../domain/evaluation';
import { useEvalsOn } from '../evaluations/evalData';
import { openEvaluation } from '../evaluations/open';

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

/** 마우스를 올렸을 때만 보이는 반 도구 (P10-2) - 휴대폰(sm 아래)은 마우스가 없으니 지금처럼 늘, 키보드로 오면 보인다.
 *  📊🔗✏️는 예전대로 휴대폰에서도 숨는다 - 휴대폰은 교시를 눌러 연 수정 칸에서 (그 줄에 모두 있다) */
const HOVER_ONLY = 'sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100';
/** 지난 시간을 거슬러 찾는 날 수 */
const PREV_LOOKBACK_DAYS = 60;

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
  const { isClassUnit, showHomeroomTools, preset, mode } = useTeaching();
  const classColorOf = useClassColorOf(date, sid);

  const [collapsed, setCollapsed] = useState(false);
  // 수업 종 설정 - '⏰ 수업' 옆 🔔 단추로 펼친다 (V4 10-07 사용자 요청 - 시간표 창에서 옮김)
  const bell = useClassBell();
  const [bellOpen, setBellOpen] = useState(false);
  useFocusReveal((t) => t.kind === 'lesson' && t.date === date, () => setCollapsed(false));

  // 교과 모드: 같은 반·과목의 바로 앞 수업 (그 수업에 적은 비고 첫 줄을 보인다)
  const recent = isClassUnit ? cachedSubjects(src, addDays(date, -PREV_LOOKBACK_DAYS), date) : null;
  // 진도는 개인 공간 수업으로 센다 - 그룹 공간에서는 겹치지 않는다
  const { marks } = useProgressMarks(date);
  const personalSid = usePersonalSpaceId();
  const inPersonal = !!sid && sid === personalSid;
  // 교시마다 조사표 수 (📊n - P7-4)
  const evalCounts = evalCountsByPlace(useEvalsOn(date, sid));
  // 교과 출결 (P7-2): 칸의 반 → 그 학년도 명렬표의 학급
  const { classes } = useClasses();
  const subjectAtt = useDocs('subjectAttendance', personalSid ?? '');
  const schoolYear = academicYearOf(date);
  // 🎯 뽑기(담임)의 학급: 교과 + 담임은 담임반, 담임은 학급 화면에서 고른 학급(자리표가 고른다)
  const homeroomClass = preset === 'subjectHomeroom' ? classes.find((k) => k.year === schoolYear && classLabelOf(k) === normalizeSlotText(mode.homeroomClass)) : undefined;

  const cellOf = (n: number) => view.cells.find((c) => c.n === n);

  /** 교시를 누르면 오른쪽 칸에서 고친다 (일정·메모와 같게) - 칸을 연 순간의 공간·날짜에 저장 */
  const startEdit = (c: LessonCell) => {
    if (!sid) return;
    openLessonPanel({ sid, date, n: c.n });
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
      const note = firstLine(cellOf(p)?.note ?? '');
      return (
        (nowState.kind === 'break' ? '쉬는 시간 · ' : '') +
        `다음 ${p}교시${subjectOf(p) ? ' ' + subjectOf(p) : ''} ${nowState.minutes}분 뒤` +
        (note ? ` · 📌 ${note}` : '')
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
        {/* 제목은 줄어들지 않는다. 좁으면 오른쪽의 '지금' 안내만 줄어든다 (V4 - '수업'이 '수/업'으로 꺾였다).
            휴대폰은 단추(종·출석부·알림장·진도·뽑기)가 제목 뒤에서 줄을 바꾼다 - 한 줄이면 390px 화면 밖으로 나갔다(P9-3). */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 min-w-0 sm:shrink-0">
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
          </div>
          <button
            type="button"
            data-day-bell
            aria-expanded={bellOpen}
            onClick={() => setBellOpen((v) => !v)}
            className={`whitespace-nowrap px-2 py-1 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
              bell.enabled ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200' : 'bg-white hover:bg-slate-50 text-slate-500 border-slate-200'
            }`}
            title="수업 종 - 교시 시작·끝 시각에 종을 울립니다"
          >
            {bell.enabled ? '🔔 종' : '🔕 종'}
          </button>
          {offText && (
            <span data-lessons-off={view.off} className="whitespace-nowrap text-2xs font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-100" title="이날은 시간표 수업이 없습니다 (그날 따로 적은 과목은 보입니다)">
              {offText}
            </span>
          )}
          {!collapsed &&
            headerWindows.map((d) => (
              <button
                key={d.id}
                type="button"
                data-lessons-tool={d.id}
                onClick={() => openWindow(d.id, { date, ...(sid ? { sid } : {}) })}
                className="whitespace-nowrap px-2 py-1 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                {d.icon} {d.title}
              </button>
            ))}
          {!collapsed && showHomeroomTools && inPersonal && (
            <button
              type="button"
              data-lessons-tool="drawStudent"
              onClick={() => openSeating({ draw: true, classId: homeroomClass?.id })}
              title="발표자 뽑기 - 자리표가 뽑기 칸을 펴서 열립니다"
              className="whitespace-nowrap px-2 py-1 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold transition-colors cursor-pointer"
            >
              🎯 뽑기
            </button>
          )}
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
            // 교과 모드에서 칸 글자에 반이 있으면('5-2 과학') 반을 크게, 막대는 반 색. 반이 없는 칸('창체')은 그대로
            const slot = isClassUnit && c.subject ? parseSlot(c.subject) : null;
            const slotClass = slot?.cls && inPersonal ? classes.find((k) => k.year === schoolYear && classLabelOf(k) === slot.cls) : undefined;
            const attSummary = slotClass ? periodSummary(readSubjectPeriods(subjectAtt[subjectAttendanceDocId(slotClass.id, date)]?.periods)[String(n)]) : '';
            const evalCount = evalCounts[String(n)] ?? 0;
            const openAtt = () => slotClass && openSubjectAttendanceCell({ classId: slotClass.id, date, n, subject: slot?.subject });
            const openEval = () => sid && openEvaluation({ sid, date, place: String(n), slot: c.subject });

            // 빈 비고(준비물)는 그리지 않는다(비면 한 줄 카드 - 휴대폰에서도 아래 일정 칸이 금방 나온다)
            const isNow = nowState?.kind === 'during' && nowState.period === n;
            const isNext = (nowState?.kind === 'break' || nowState?.kind === 'before') && nowState.next === n;
            const range = periodRangeLabel(times, n);
            const slotColor = slot?.cls ? classColorOf(slot.cls) : null;
            const prev = slot?.cls && recent ? previousSlotOf(recent, c.subject, date, n) : null;
            const prevNote = prev ? firstLine(lessonNote(src.days[prev.date]?.periods?.[prev.period])) : '';
            const mark = marks[slotId(date, n)];
            const hasDetails = !!(c.note || prevNote || mark);
            return (
              <div
                key={n}
                data-lesson-card={n}
                data-lesson-id={id}
                data-now={isNow ? 'true' : isNext ? 'next' : undefined}
                data-slot-color={slotColor?.name}
                {...reorderDragProps(`lesson:${date}`, n, swap)}
                onClick={() => startEdit(c)}
                title={`${range ? `${range} · ` : ''}눌러서 고치기`}
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
                            {c.subject || (
                              <span className="text-slate-300 font-normal" title={c.changed ? `이날만 비움 (시간표: ${c.base})` : undefined}>
                                {view.off || c.changed ? '수업 없음' : '과목 미등록'}
                              </span>
                            )}
                          </span>
                        )}
                        {/* 교사에게 가장 필요한 것 = 수업 내용·쪽수: 첫 줄에 교시/반/과목 다음으로 (진도 단원·준비물은 다음 줄) */}
                        {mark && !mark.bumped && (mark.lesson?.content || lessonPageLabel(mark.lesson?.page)) && (
                          <span data-lesson-content className="min-w-0 truncate text-sm sm:text-base font-extrabold text-indigo-700">
                            {mark.lesson?.content}
                            {lessonPageLabel(mark.lesson?.page) && (
                              <span data-progress-page className="font-bold text-indigo-500">
                                {mark.lesson?.content ? ' · ' : ''}📖 {lessonPageLabel(mark.lesson?.page)}
                              </span>
                            )}
                          </span>
                        )}
                        {slotClass && (
                          <button
                            type="button"
                            data-subject-attendance={n}
                            onClick={(e) => {
                              e.stopPropagation();
                              openAtt();
                            }}
                            title={`${slot?.cls} ${n}교시 교과 출결 (결과·지각·조퇴)`}
                            className={`shrink-0 text-2xs font-bold rounded-full px-1.5 py-0.5 border transition-all cursor-pointer ${
                              attSummary
                                ? 'text-rose-700 bg-rose-50 border-rose-200 hover:bg-rose-100'
                                : `text-slate-400 bg-white border-slate-200 hover:text-slate-600 hover:border-slate-400 ${HOVER_ONLY}`
                            }`}
                          >
                            {attSummary ? <span data-subject-att-chip>{attSummary}</span> : '🙋 출결'}
                          </button>
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
                        {/* 교과 모드: 이 반으로 바로 가는 학급 도구 (V4 S8) - 📊🔗✏️처럼 마우스를 올렸을 때만 (P10-2, 휴대폰은 늘) */}
                        {slotClass && (
                          <span data-class-tools={slotClass.id} className="flex items-center gap-0.5">
                            {(
                              [
                                ['seating', '🪑', '자리표'],
                                ['drawStudent', '🎯', '발표자 뽑기'],
                              ] as const
                            ).map(([tool, icon, label]) => (
                              <button
                                key={tool}
                                type="button"
                                data-class-tool-btn={tool}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openSeating({ classId: slotClass.id, draw: tool === 'drawStudent' });
                                }}
                                title={`${slot?.cls} ${label}`}
                                aria-label={`${slot?.cls} ${label}`}
                                className={`text-slate-400 hover:text-blue-600 p-1 rounded hover:bg-slate-100 text-xs transition-all cursor-pointer ${HOVER_ONLY}`}
                              >
                                {icon}
                              </button>
                            ))}
                          </span>
                        )}
                        {sid && (
                          <button
                            type="button"
                            data-lesson-evals={n}
                            data-eval-count={evalCount}
                            onClick={(e) => {
                              e.stopPropagation();
                              openEval();
                            }}
                            className={`p-1 rounded hover:bg-slate-100 text-xs transition-all cursor-pointer ${
                              evalCount ? 'text-emerald-700 font-bold' : 'opacity-0 group-hover:opacity-100 text-slate-400 hover:text-emerald-600'
                            }`}
                            title={evalCount ? `조사표 ${evalCount}건` : slot?.cls ? `${slot.cls} 조사표` : '조사표 관리'}
                            aria-label={evalCount ? `조사표 ${evalCount}건` : '조사표 관리'}
                          >
                            📊{evalCount || ''}
                          </button>
                        )}
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
                        title={`지난 시간 비고(준비물) - 누르면 ${shortDateLabel(prev.date)}로 갑니다`}
                        className={`self-start max-w-full truncate text-left text-xs text-slate-500 hover:text-primary hover:underline cursor-pointer ${mark || c.note ? 'mb-1.5' : ''}`}
                      >
                        ⏪ 지난 시간 {shortDateLabel(prev.date)} {prev.period}교시: <span className="text-slate-700">{prevNote}</span>
                      </button>
                    )}

                    {mark && (
                      <div className={c.note ? 'mb-2' : ''}>
                        <ProgressMarkLine mark={mark} date={date} period={n} hideContent />
                      </div>
                    )}

                    {/* 차례: 교시·반·과목·내용 / 단원·준비물(진도 줄) / 비고 */}
                    {c.note && (
                      <div className="flex flex-col text-xs" data-lesson-note>
                        <span className="text-slate-400 text-xs mb-0.5">📌 비고</span>
                        <p className="text-amber-700 font-medium whitespace-pre-wrap leading-relaxed">{c.note}</p>
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
