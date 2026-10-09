// 📋 출석부 (V4 components/AttendanceDrawer.tsx) - 오른쪽 쓰는 칸 'attendance' = { date, classId?, tab? }.
//   '✔️ 출석 체크' = 하루치(적지 않은 학생은 출석, 나이스 구분 - 결석·지각·조퇴·결과 × 질병·미인정·기타·출석인정, 교시·사유 메모),
//   '📊 누계' = 학생별 합계(학년도·학기·달)와 누르면 날짜별 내역·🖨️ 인쇄.
//   고친 뒤 2.5초 손을 떼면 저절로 저장(저장 단추·Ctrl+S도) - 바뀐 학생 칸만(domain/attendance marksChanges). 날짜·학급을 바꾸기 전에도 저장한다.
//   자리: 개인 공간 attendance/{classId}_{date}, 학생은 sid. V4의 '그날 기록 칸에 출결 항목 만들기'는 없다 - 기록 칸이 계산해 보인다(P7-2 ■3).
//   연 채로 다른 기기에서 고친 것도 따라온다(적던 것이 있으면 덮지 않는다).
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useCommonSettings } from '../../app/prefs';
import { showErrorToastOnce } from '../../app/toast';
import { registerUnsavedCheck, type WindowProps } from '../../app/windows';
import { useDocs, useMirrorStatus } from '../../data/select';
import {
  KINDS,
  KIND_HAS_PERIODS,
  KIND_LABEL,
  REASONS,
  REASON_LABEL,
  attendanceDocId,
  cleanMark,
  historyOf,
  readMarks,
  recordText,
  summaryRangeOf,
  tallyByStudent,
  togglePeriod,
  withKind,
  type AttendanceKind,
  type AttendanceMark,
  type AttendanceMarks,
  type SummaryRange,
} from '../../domain/attendance';
import { academicYearOf, addDays, shortDateLabel } from '../../domain/dateUtils';
import { describeClass, isActive } from '../../domain/roster';
import { normalizeSlotText } from '../../domain/teachingSlot';
import { printNode } from '../../ui/print';
import SidePanelFrame from '../../ui/SidePanelFrame';
import { rememberHubClass, useClasses, useHubClass } from '../class/classes';
import { useTeaching } from '../lessons/teaching';
import { saveAttendance } from './actions';
import { pickAttendanceClass } from './attendanceClass';
import type { AttendancePanelParams, AttendanceTab } from './open';

/** 고친 뒤 이만큼 손을 떼면 저장 (V4 UX-AUDIT C4 - 결석 한 번 누르고 저장까지 3번이던 것을 2번으로) */
const AUTO_SAVE_MS = 2500;

interface Draft {
  /** attendance 문서 id */
  key: string;
  classId: string;
  date: string;
  marks: AttendanceMarks;
}

const sameMarks = (a: AttendanceMarks, b: AttendanceMarks) => {
  const clean = (m: AttendanceMarks) => JSON.stringify(Object.keys(m).sort().map((k) => [k, cleanMark(m[k])]));
  return clean(a) === clean(b);
};

export default function AttendancePanel({ params, close, raise }: WindowProps<AttendancePanelParams>) {
  const { classes, sid } = useClasses();
  const docs = useDocs('attendance', sid);
  const status = useMirrorStatus('attendance', sid);
  const hub = useHubClass((s) => s.id);
  const { mode, preset } = useTeaching();
  const periodCount = useCommonSettings((s) => s.periods.length) || 6;
  const terms = useCommonSettings((s) => s.terms);

  const [tab, setTab] = useState<AttendanceTab>(params.tab ?? 'check');
  const [date, setDate] = useState(params.date);
  const [chosen, setChosen] = useState<string | null>(params.classId ?? null);
  const cls = pickAttendanceClass(classes, {
    classId: chosen,
    homeroom: preset === 'subjectHomeroom' ? normalizeSlotText(mode.homeroomClass) : null,
    remembered: hub,
    year: academicYearOf(date),
  });
  const classId = cls?.id ?? null;
  const docId = classId ? attendanceDocId(classId, date) : null;
  const stored = docId ? docs[docId] : undefined;
  const serverMarks = useMemo(() => readMarks(stored?.records), [stored]);

  // 고치는 중인 것 (어느 학급·날짜의 것인지 함께 - 다른 날로 가면 남은 것은 곧바로 그 날에 저장한다)
  const [draft, setDraft] = useState<Draft | null>(null);
  const marks = draft && draft.key === docId ? draft.marks : serverMarks;
  const draftDirty = (d: Draft | null) => !!d && !sameMarks(d.marks, readMarks(docs[d.key]?.records));
  const dirty = draftDirty(draft);
  const edit = (fn: (m: AttendanceMarks) => AttendanceMarks) => {
    if (!docId || !classId) return;
    setDraft({ key: docId, classId, date, marks: fn(marks) });
  };

  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  /** 고친 것을 저장한다. 저장했거나 저장할 것이 없으면 true */
  const save = async (d: Draft | null = draft): Promise<boolean> => {
    if (!sid || !d || !draftDirty(d)) {
      if (d) setDraft((cur) => (cur === d ? null : cur));
      return true;
    }
    if (savingRef.current) return false;
    savingRef.current = true;
    setSaving(true);
    try {
      const stored = docs[d.key];
      await saveAttendance(sid, d.classId, d.date, stored, readMarks(stored?.records), d.marks);
      // 그새 더 고쳤으면 남긴다
      setDraft((cur) => (cur === d ? null : cur));
      return true;
    } catch (e) {
      showErrorToastOnce('출석부를 저장하지 못했습니다. 적던 것은 그대로 두었으니 다시 저장해 주세요.', e);
      return false;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  });
  // 고친 뒤 잠시 손을 떼면 저절로 저장 (사유를 치는 동안은 칠 때마다 다시 센다)
  useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(() => void saveRef.current(), AUTO_SAVE_MS);
    return () => clearTimeout(t);
  }, [draft, dirty]);
  // 다른 날·학급으로 옮겼는데 적던 것이 남았으면 곧바로 그 날에 저장한다
  useEffect(() => {
    if (draft && draft.key !== docId) void saveRef.current(draft);
  }, [draft, docId]);

  // 다시 열면(다른 날·학급으로) 따라간다 - 적던 것은 위에서 저장한다
  const paramKey = `${params.date}|${params.classId ?? ''}|${params.tab ?? ''}`;
  const [seenParams, setSeenParams] = useState(paramKey);
  if (paramKey !== seenParams) {
    setSeenParams(paramKey);
    setDate(params.date);
    if (params.classId) setChosen(params.classId);
    if (params.tab) setTab(params.tab);
  }
  const moveDate = (next: string) => {
    if (next) setDate(next);
  };
  const chooseClass = (id: string) => {
    setChosen(id);
    // 학급 화면·다른 학급 도구도 이 학급으로 연다
    rememberHubClass(id);
  };

  // ESC로 모두 닫기 전에 저장 안 한 것을 묻는다
  const unsaved = useRef<(() => boolean) | null>(null);
  useEffect(() => {
    unsaved.current = () => dirty;
  });
  useEffect(() => registerUnsavedCheck(unsaved), []);

  const [openNote, setOpenNote] = useState<string | null>(null);
  // 전출한 학생은 빼되, 그날 기록이 이미 있으면 보인다
  const students = (cls?.students ?? []).filter((s) => isActive(s) || marks[s.sid]).sort((a, b) => a.num - b.num);
  const markedCount = students.filter((s) => marks[s.sid]).length;

  // ── 누계 ──
  const summaryRef = useRef<HTMLDivElement>(null);
  const [range, setRange] = useState<SummaryRange>('year');
  const [openStudent, setOpenStudent] = useState<string | null>(null);
  const span = summaryRangeOf(range, cls?.year ?? academicYearOf(date), date, terms);
  const inRange = Object.values(docs).filter((d) => d.classId === classId && d.date >= span.start && d.date <= span.end);
  const tally = tallyByStudent(inRange);
  const rangeLabel = { year: '학년도 전체', sem1: '1학기', sem2: '2학기', month: `${Number(date.slice(5, 7))}월` }[range];

  const chip = (on: boolean, tone: string) =>
    `px-2 py-1 rounded-lg border font-bold transition-colors cursor-pointer ${on ? tone : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'}`;

  return (
    <SidePanelFrame ariaLabel="출석부" onClose={close} onBackdropClose={() => void save().then((ok) => ok && close())} onSave={() => void save()} raise={raise}>
      <div data-attendance-panel={classId ?? ''} data-attendance-date={date} className="flex flex-col h-full min-h-0">
        <div className="flex items-start justify-between px-6 py-4 border-b border-slate-100">
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-slate-800">📋 출석부</h3>
            <p className="text-xs font-bold text-primary mt-0.5 truncate">
              {shortDateLabel(date)} 출결{cls ? ` · ${cls.grade}학년 ${cls.num}반` : ''} · 🔒 개인
            </p>
          </div>
          <button type="button" data-close title="닫기" onClick={close} className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer shrink-0">
            ✕
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-5 space-y-4 text-xs text-slate-700" data-scroll-lock>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="inline-flex bg-slate-100 p-1 rounded-xl gap-1">
              {(
                [
                  ['check', '✔️ 출석 체크'],
                  ['summary', '📊 누계'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  data-attendance-tab={id}
                  onClick={() => setTab(id)}
                  aria-pressed={tab === id}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${tab === id ? 'bg-white text-primary shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            {classes.length > 0 && (
              <select value={classId ?? ''} data-attendance-class onChange={(e) => chooseClass(e.target.value)} aria-label="학급" className="px-2 py-1.5 border border-slate-200 rounded-lg font-bold max-w-full">
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {describeClass(c)}
                  </option>
                ))}
              </select>
            )}
          </div>

          {classes.length === 0 ? (
            <p className="text-center text-slate-400 py-8" data-attendance-empty>
              {status === 'live' ? '명렬표가 없습니다. 학급 화면 → 🧑‍🤝‍🧑 명렬표에서 학급과 학생을 먼저 넣어 주세요.' : '명렬표를 불러오는 중...'}
            </p>
          ) : tab === 'check' ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <button type="button" data-attendance-prev onClick={() => moveDate(addDays(date, -1))} className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 font-black cursor-pointer" title="전날">
                    ◀
                  </button>
                  <input type="date" data-attendance-date-input value={date} onChange={(e) => moveDate(e.target.value)} aria-label="출석 날짜" className="px-2 py-1 border border-slate-200 rounded-lg font-bold" />
                  <button type="button" data-attendance-next onClick={() => moveDate(addDays(date, 1))} className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 font-black cursor-pointer" title="다음 날">
                    ▶
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500" data-attendance-count={markedCount}>
                    {students.length}명 중 <b className="text-slate-800">출석 {Math.max(0, students.length - markedCount)}</b>
                    {markedCount > 0 && <b className="text-rose-600"> · 그 밖 {markedCount}</b>}
                  </span>
                  <button
                    type="button"
                    data-attendance-all-present
                    onClick={() => edit(() => ({}))}
                    disabled={markedCount === 0}
                    className="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg font-bold disabled:opacity-40 cursor-pointer"
                  >
                    모두 출석
                  </button>
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl divide-y divide-slate-100">
                {students.map((st) => {
                  const r = marks[st.sid];
                  return (
                    <div key={st.sid} data-attendance-row={st.sid} data-attendance-num={st.num} className={`px-3 py-2 ${r ? 'bg-rose-50/40' : ''}`}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="w-24 shrink-0 font-bold text-slate-800 truncate">
                          <span className="text-slate-400 mr-1">{st.num}</span>
                          {st.name || '(이름 없음)'}
                        </span>
                        <div className="flex items-center gap-1 flex-wrap">
                          <button type="button" data-attendance-kind="present" aria-pressed={!r} onClick={() => edit((m) => withKind(m, st.sid, null))} className={chip(!r, 'bg-emerald-600 text-white border-emerald-600')}>
                            출석
                          </button>
                          {KINDS.map((k) => (
                            <button key={k} type="button" data-attendance-kind={k} aria-pressed={r?.kind === k} onClick={() => edit((m) => withKind(m, st.sid, k as AttendanceKind))} className={chip(r?.kind === k, 'bg-rose-600 text-white border-rose-600')}>
                              {KIND_LABEL[k]}
                            </button>
                          ))}
                        </div>
                        {r && (
                          <div className="flex items-center gap-1 flex-wrap">
                            <span className="text-slate-300">|</span>
                            {REASONS.map((rs) => (
                              <button
                                key={rs}
                                type="button"
                                data-attendance-reason={rs}
                                aria-pressed={r.reason === rs}
                                onClick={() => edit((m) => ({ ...m, [st.sid]: { ...m[st.sid], reason: rs } }))}
                                className={chip(r.reason === rs, 'bg-slate-800 text-white border-slate-800')}
                              >
                                {REASON_LABEL[rs]}
                              </button>
                            ))}
                            <button
                              type="button"
                              data-attendance-note-open
                              onClick={() => setOpenNote(openNote === st.sid ? null : st.sid)}
                              className="px-2 py-1 rounded-lg border border-dashed border-slate-300 text-slate-500 hover:border-slate-500 cursor-pointer"
                            >
                              {r.note ? `📝 ${r.note}` : '＋ 사유 적기'}
                            </button>
                          </div>
                        )}
                      </div>
                      {r && KIND_HAS_PERIODS[r.kind] && (
                        <div className="flex items-center gap-1 mt-1.5 pl-24 flex-wrap">
                          <span className="text-slate-400 mr-1">교시</span>
                          {Array.from({ length: periodCount }, (_, i) => i + 1).map((p) => (
                            <button
                              key={p}
                              type="button"
                              data-attendance-period={p}
                              aria-pressed={!!r.periods?.includes(p)}
                              onClick={() => edit((m) => togglePeriod(m, st.sid, p))}
                              className={`w-7 h-6 rounded-md border font-bold cursor-pointer ${r.periods?.includes(p) ? 'bg-rose-100 border-rose-300 text-rose-700' : 'bg-white border-slate-200 text-slate-400'}`}
                            >
                              {p}
                            </button>
                          ))}
                        </div>
                      )}
                      {r && openNote === st.sid && (
                        <div className="mt-1.5 pl-24">
                          <input
                            type="text"
                            data-attendance-note
                            value={r.note ?? ''}
                            onChange={(e) => edit((m) => ({ ...m, [st.sid]: { ...m[st.sid], note: e.target.value } }))}
                            placeholder="사유 (예: 감기, 가족 체험학습)"
                            aria-label={`${st.num}번 사유`}
                            className="w-full px-2 py-1 border border-slate-200 rounded-lg"
                            autoFocus
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
                {students.length === 0 && <p className="text-center text-slate-400 py-6">이 학급에 학생이 없습니다.</p>}
              </div>
              <p className="text-slate-400">
                적지 않은 학생은 출석입니다. 고친 뒤 잠시 두면 저절로 저장되고(저장 단추·Ctrl+S도 됩니다), 그날 기록 칸에 '📋 출결'로 보이고, 학생 기록(누가기록)에도 모입니다.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-slate-500">기간</span>
                <select value={range} data-attendance-range onChange={(e) => setRange(e.target.value as SummaryRange)} aria-label="누계 기간" className="px-2 py-1 border border-slate-200 rounded-lg font-bold">
                  <option value="year">학년도 전체</option>
                  <option value="sem1">1학기</option>
                  <option value="sem2">2학기</option>
                  <option value="month">{Number(date.slice(5, 7))}월</option>
                </select>
                <span className="text-slate-400">
                  {span.start} ~ {span.end} · 결석은 날 수, 지각·조퇴·결과는 횟수 · 학생을 누르면 날짜별 내역
                </span>
                <button
                  type="button"
                  data-attendance-print
                  onClick={() => {
                    if (!summaryRef.current || !cls) return;
                    printNode(summaryRef.current, {
                      title: `${describeClass(cls)} 출결 누계 (${rangeLabel})`,
                      subtitle: `${span.start} ~ ${span.end} · 결석은 날 수, 지각·조퇴·결과는 횟수`,
                      landscape: true,
                    });
                  }}
                  className="ml-auto px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 font-bold cursor-pointer"
                >
                  🖨️ 인쇄
                </button>
              </div>
              <div ref={summaryRef} className="overflow-x-auto border border-slate-200 rounded-xl" data-attendance-summary>
                <table className="w-full text-center whitespace-nowrap">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th rowSpan={2} className="px-2 py-1.5 text-left">
                        학생
                      </th>
                      {KINDS.map((k) => (
                        <th key={k} colSpan={4} className="px-2 py-1 border-l border-slate-200">
                          {KIND_LABEL[k]}
                        </th>
                      ))}
                    </tr>
                    <tr>
                      {KINDS.map((k) =>
                        REASONS.map((rs) => (
                          <th key={`${k}-${rs}`} className={`px-1.5 py-1 font-normal ${rs === 'sick' ? 'border-l border-slate-200' : ''}`}>
                            {REASON_LABEL[rs].replace('출석인정', '인정')}
                          </th>
                        )),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {[...(cls?.students ?? [])]
                      .sort((a, b) => a.num - b.num)
                      .map((st) => {
                        const t = tally[st.sid];
                        const open = openStudent === st.sid;
                        const hist: Array<{ date: string; record: AttendanceMark }> = open ? historyOf(inRange, st.sid) : [];
                        return (
                          <Fragment key={st.sid}>
                            <tr
                              data-attendance-summary-row={st.sid}
                              onClick={() => setOpenStudent(open ? null : st.sid)}
                              className={`border-t border-slate-100 cursor-pointer hover:bg-blue-50/40 ${t ? '' : 'text-slate-300'}`}
                            >
                              <td className="px-2 py-1.5 text-left font-bold text-slate-800">
                                <span className="text-slate-400 mr-1">{st.num}</span>
                                {st.name}
                                {!isActive(st) && <span className="ml-1 text-slate-400 font-normal">(전출)</span>}
                              </td>
                              {KINDS.map((k) =>
                                REASONS.map((rs) => (
                                  <td
                                    key={`${k}-${rs}`}
                                    data-tally={`${k}-${rs}`}
                                    className={`px-1.5 py-1.5 ${rs === 'sick' ? 'border-l border-slate-100' : ''} ${t?.[k][rs] ? 'font-bold text-rose-600' : ''}`}
                                  >
                                    {t?.[k][rs] || '·'}
                                  </td>
                                )),
                              )}
                            </tr>
                            {open && (
                              <tr className="bg-slate-50/60" data-attendance-history={st.sid}>
                                <td colSpan={17} className="px-3 py-2 text-left">
                                  {hist.length === 0 ? (
                                    <span className="text-slate-400">이 기간에 출결 기록이 없습니다 (모두 출석).</span>
                                  ) : (
                                    <ul className="space-y-0.5">
                                      {hist.map((h) => (
                                        <li key={h.date}>
                                          <b className="text-slate-700">{shortDateLabel(h.date)}</b> <span className="text-rose-700">{recordText(h.record)}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-2 bg-slate-50/50">
          {dirty && (
            <span className="mr-auto text-xs font-bold text-amber-600" data-attendance-dirty>
              {saving ? '저장 중...' : '잠시 뒤 저절로 저장합니다'}
            </span>
          )}
          <button type="button" onClick={close} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer">
            닫기
          </button>
          {tab === 'check' && (
            <button
              type="button"
              data-attendance-save
              onClick={() => void save()}
              disabled={saving || !classId}
              title="Ctrl + S 로도 저장합니다"
              className="px-5 py-2 text-sm font-bold text-white bg-primary hover:bg-blue-600 rounded-xl shadow-md disabled:opacity-50 cursor-pointer"
            >
              {saving ? '저장 중...' : '💾 저장'}
            </button>
          )}
        </div>
      </div>
    </SidePanelFrame>
  );
}
