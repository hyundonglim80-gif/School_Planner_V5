// 🙋 교과 출결 누계 (V4 components/SubjectAttendanceSummaryModal.tsx) - 창 'subjectAttendance' = { classId? }.
//   학급 도구 카드(교과 모드)·교과 출결 칸의 📊 누계·단축키 '교과 출결 누계'로 연다. 반을 고르고 기간(1학기·2학기·학년도)을 고르면
//   학생마다 결과·지각·조퇴 교시 수, 학생을 누르면 날짜·교시 내역. ⬇️ CSV·🖨️ 인쇄. 읽기만 한다 - 적는 것은 수업 칸의 🙋.
import { Fragment, useRef, useState } from 'react';
import { useCommonSettings } from '../../app/prefs';
import type { WindowProps } from '../../app/windows';
import { useDocs } from '../../data/select';
import { REASON_LABEL, summaryRangeOf } from '../../domain/attendance';
import { academicYearOf, shortDateLabel } from '../../domain/dateUtils';
import { classLabelOf, isActive } from '../../domain/roster';
import { studentTotals, subjectRecordText, summaryCsvRows } from '../../domain/subjectAttendance';
import { downloadCsv } from '../../ui/download';
import ModalShell, { ModalCloseButton } from '../../ui/ModalShell';
import { printNode } from '../../ui/print';
import { useToday } from '../../ui/useToday';
import { useClasses } from '../class/classes';
import { useClassColorOf } from '../lessons/teaching';
import type { SubjectAttendanceSummaryParams } from './open';

type Range = 'sem1' | 'sem2' | 'year';
const RANGE_LABEL: Record<Range, string> = { sem1: '1학기', sem2: '2학기', year: '학년도 전체' };

export default function SubjectAttendanceWindow({ params, close, raise }: WindowProps<SubjectAttendanceSummaryParams | undefined>) {
  const today = useToday();
  const schoolYear = academicYearOf(today);
  const terms = useCommonSettings((s) => s.terms);
  const colorOf = useClassColorOf(today);
  const { classes: all, sid } = useClasses();
  const docs = useDocs('subjectAttendance', sid);
  // 올해 학년도 반 (학년·반 차례), 넘겨받은 반이 다른 학년도면 그것도 앞에
  const extra = params?.classId ? all.find((c) => c.id === params.classId && c.year !== schoolYear) : undefined;
  const classes = [...(extra ? [extra] : []), ...all.filter((c) => c.year === schoolYear).sort((a, b) => a.grade - b.grade || a.num - b.num)];
  const [chosen, setChosen] = useState<string | null>(params?.classId ?? null);
  const cls = classes.find((c) => c.id === chosen) ?? classes[0] ?? null;
  const year = cls?.year ?? schoolYear;
  const sem1 = summaryRangeOf('sem1', schoolYear, today, terms);
  const [range, setRange] = useState<Range>(() => (today <= sem1.end ? 'sem1' : 'sem2'));
  const [openSid, setOpenSid] = useState<string | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  const span = summaryRangeOf(range, year, today, terms);
  const days = Object.values(docs).filter((d) => d.classId === cls?.id);
  const totals = studentTotals(days, span.start, span.end);
  const students = [...(cls?.students ?? [])].filter((s) => isActive(s) || totals[s.sid]).sort((a, b) => a.num - b.num);
  const rows = summaryCsvRows(students, totals);
  const label = cls ? classLabelOf(cls) : '';
  const fileStem = `교과출결_${year}학년도_${label}_${RANGE_LABEL[range].replace(/\s+/g, '')}`;

  return (
    <ModalShell isOpen onClose={close} raise={raise} width="2xl" title="🙋 교과 출결 누계" footer={<ModalCloseButton onClose={close} />}>
      {classes.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-500" data-subject-summary-empty>
          {schoolYear}학년도 명렬표가 없습니다. 학급 화면 → 🧑‍🤝‍🧑 명렬표에서 반을 먼저 만드세요.
        </p>
      ) : (
        <div className="space-y-3 text-xs text-slate-700" data-subject-summary={cls?.id ?? ''}>
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="반 고르기">
            {classes.map((c) => {
              const l = classLabelOf(c);
              const on = c.id === cls?.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  data-summary-class={c.id}
                  aria-pressed={on}
                  onClick={() => {
                    setChosen(c.id);
                    setOpenSid(null);
                  }}
                  className={`px-2.5 py-1 rounded-lg font-black border border-transparent cursor-pointer ${colorOf(l).chip} ${on ? 'ring-2 ring-offset-1 ring-slate-500' : 'opacity-70 hover:opacity-100'}`}
                >
                  {c.year !== schoolYear ? `${c.year} ` : ''}
                  {l}
                </button>
              );
            })}
            <span className="mx-1 text-slate-300">|</span>
            {(Object.keys(RANGE_LABEL) as Range[]).map((r) => (
              <button
                key={r}
                type="button"
                data-summary-range={r}
                aria-pressed={range === r}
                onClick={() => setRange(r)}
                className={`px-2 py-1 rounded-lg border font-bold cursor-pointer ${range === r ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'}`}
              >
                {RANGE_LABEL[r]}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-1.5">
              <button type="button" data-summary-csv onClick={() => downloadCsv(rows, `${fileStem}.csv`)} className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 font-bold cursor-pointer">
                ⬇️ CSV
              </button>
              <button
                type="button"
                data-summary-print
                onClick={() => tableRef.current && printNode(tableRef.current, { title: `${year}학년도 ${label} 교과 출결 누계 (${RANGE_LABEL[range]})`, subtitle: '결과·지각·조퇴는 교시 수' })}
                className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 font-bold cursor-pointer"
              >
                🖨️ 인쇄
              </button>
            </div>
          </div>
          <p className="text-slate-400">
            {span.start} ~ {span.end} · 결과·지각·조퇴는 교시 수 · 학생을 누르면 날짜·교시 내역
          </p>
          <div ref={tableRef} className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-center whitespace-nowrap">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-2 py-1.5 text-left">학생</th>
                  <th className="px-2 py-1.5">결과</th>
                  <th className="px-2 py-1.5">지각</th>
                  <th className="px-2 py-1.5">조퇴</th>
                  <th className="px-2 py-1.5">합계</th>
                </tr>
              </thead>
              <tbody>
                {students.map((st) => {
                  const t = totals[st.sid];
                  const sum = (t?.absent ?? 0) + (t?.late ?? 0) + (t?.early ?? 0);
                  const open = openSid === st.sid;
                  return (
                    <Fragment key={st.sid}>
                      <tr data-summary-row={st.sid} onClick={() => setOpenSid(open ? null : st.sid)} className={`border-t border-slate-100 cursor-pointer hover:bg-blue-50/40 ${sum ? '' : 'text-slate-300'}`}>
                        <td className="px-2 py-1.5 text-left font-bold text-slate-800">
                          <span className="text-slate-400 mr-1">{st.num}</span>
                          {st.name}
                          {!isActive(st) && <span className="ml-1 text-slate-400 font-normal">(전출)</span>}
                        </td>
                        <td data-summary-absent className={t?.absent ? 'font-bold text-rose-600' : ''}>{t?.absent || '·'}</td>
                        <td data-summary-late className={t?.late ? 'font-bold text-rose-600' : ''}>{t?.late || '·'}</td>
                        <td data-summary-early className={t?.early ? 'font-bold text-rose-600' : ''}>{t?.early || '·'}</td>
                        <td data-summary-sum className={sum ? 'font-bold text-slate-800' : ''}>{sum || '·'}</td>
                      </tr>
                      {open && (
                        <tr className="bg-slate-50/60" data-summary-history={st.sid}>
                          <td colSpan={5} className="px-3 py-2 text-left">
                            {!t?.items.length ? (
                              <span className="text-slate-400">이 기간에 교과 출결이 없습니다 (모두 출석).</span>
                            ) : (
                              <ul className="space-y-0.5">
                                {t.items.map((it) => (
                                  <li key={`${it.date}#${it.period}`}>
                                    <b className="text-slate-700">{shortDateLabel(it.date)}</b> {it.period}교시 <span className="text-rose-700">{subjectRecordText(it.record, REASON_LABEL)}</span>
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
    </ModalShell>
  );
}
