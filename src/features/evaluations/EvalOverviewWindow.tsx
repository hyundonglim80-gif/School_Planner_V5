// 📊 조사표 모아 보기 (V4 components/EvalOverviewModal.tsx) - 창 'evalOverview' = { classId? } (창 id = 단축키 id). 학급 도구 카드·단축키.
//   한 학급의 한 학년도 조사표를 학생 × 조사표 표로(개인 공간 + 지금 보는 공유 그룹, 날짜 차례). 읽기만 한다 - 머리를 누르면 그 조사표 창.
//   교과·학기·유형으로 거른다(학기는 시간표 창의 방학으로, 그 학년도 설정이 없으면 3~8월이 1학기). 📋 표 복사·📥 CSV·🖨️ 인쇄.
//   교과 모드는 위에 '학급별 / 과정별' 탭(과정별 = CourseEvalOverview). 학급은 학급 화면에서 고른 학급(고르면 함께 바뀐다).
//   사본에서 계산하므로 조사표 창에서 고친 값이 곧 보인다(V4는 창을 닫으면 다시 읽었다).
import { useRef, useState } from 'react';
import { useCommonSettings } from '../../app/prefs';
import { showErrorToast, showToast } from '../../app/toast';
import type { WindowProps } from '../../app/windows';
import { academicYearOf } from '../../domain/dateUtils';
import {
  EVAL_TYPE_LABEL,
  evalCellText,
  evalColumnTitle,
  evalHasStudent,
  evalPlaceOf,
  filterEvals,
  isEmptyCell,
  overviewCsvRows,
  sortEvals,
  stepCounts,
  studentEvalCell,
  type EvalFilter,
  type EvalType,
  type OverviewStudent,
} from '../../domain/evaluation';
import { describeClass, isActive } from '../../domain/roster';
import { downloadCsv } from '../../ui/download';
import ModalShell, { ModalCloseButton } from '../../ui/ModalShell';
import { printNode } from '../../ui/print';
import { copyText } from '../../ui/shareText';
import { useToday } from '../../ui/useToday';
import { rememberHubClass, useClasses, useHubClass } from '../class/classes';
import { useTeaching } from '../lessons/teaching';
import CourseEvalOverview from './CourseEvalOverview';
import { useSpacesEvals, type SpaceEval } from './evalData';
import { openEvaluation, type EvalOverviewParams } from './open';

const NO_SUBJECT = '(없음)';
const EMPTY_FILTER: EvalFilter = { subject: '', semester: null, type: '' };
const select = 'px-2 py-1.5 border border-slate-200 rounded-lg font-bold text-xs bg-white';
const tool = 'px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 font-bold disabled:opacity-40 cursor-pointer';

export default function EvalOverviewWindow({ params, close, raise }: WindowProps<EvalOverviewParams | undefined>) {
  const { classes } = useClasses();
  const hubClass = useHubClass((s) => s.id);
  const today = useToday();
  const terms = useCommonSettings((s) => s.terms);
  const { isClassUnit } = useTeaching();
  const all = useSpacesEvals();

  const [chosen, setChosen] = useState<string | null>(params?.classId ?? null);
  const year = academicYearOf(today);
  const withStudents = classes.filter((c) => c.students.length > 0);
  const cls = classes.find((c) => c.id === chosen) ?? classes.find((c) => c.id === hubClass) ?? withStudents.find((c) => c.year === year) ?? withStudents[0] ?? classes[0] ?? null;
  const [filter, setFilter] = useState<EvalFilter>(EMPTY_FILTER);
  const [view, setView] = useState<'class' | 'course'>('class');
  const showCourse = isClassUnit && view === 'course';

  const chooseClass = (id: string) => {
    setChosen(id);
    setFilter(EMPTY_FILTER);
    rememberHubClass(id);
  };

  const evals = sortEvals(all.filter((e) => e.classId === cls?.id));
  const schoolYear = cls?.year ?? year;
  const subjectSet = new Set(evals.map((e) => e.subject ?? ''));
  const subjects = [...[...subjectSet].filter(Boolean).sort((a, b) => a.localeCompare(b, 'ko')), ...(subjectSet.has('') ? [NO_SUBJECT] : [])];
  const shown = filterEvals(evals, filter, schoolYear, terms);
  const students: OverviewStudent[] = [...(cls?.students ?? [])].sort((a, b) => a.num - b.num).map((s) => ({ sid: s.sid, num: s.num, name: s.name, ...(isActive(s) ? {} : { out: true }) }));
  const sids = students.map((s) => s.sid);

  const openEval = (ev: SpaceEval) => openEvaluation({ sid: ev.space, date: ev.date, place: evalPlaceOf(ev), evalId: ev.id });

  const fileStem = () => {
    if (!cls) return '평가모아보기';
    const parts = [`${cls.year}학년도 ${cls.grade}-${cls.num}`];
    if (filter.subject) parts.push(filter.subject === NO_SUBJECT ? '교과없음' : filter.subject);
    if (filter.semester) parts.push(`${filter.semester}학기`);
    if (filter.type) parts.push(EVAL_TYPE_LABEL[filter.type]);
    return `평가모아보기_${parts.join('_')}`.replace(/[\\/:*?"<>|\s]+/g, '_');
  };
  const download = () => {
    if (shown.length === 0) return showToast('내려받을 조사표가 없습니다.');
    downloadCsv(overviewCsvRows(shown, students), `${fileStem()}.csv`);
  };
  const copy = async () => {
    if (shown.length === 0) return showToast('복사할 조사표가 없습니다.');
    // 칸 안의 탭·줄바꿈은 붙여넣을 때 칸을 흩뜨린다 - 빈칸으로
    const tsv = overviewCsvRows(shown, students)
      .map((row) => row.map((c) => String(c).replace(/[\t\r\n]+/g, ' ')).join('\t'))
      .join('\n');
    try {
      await copyText(tsv);
      showToast('📋 표를 복사했습니다. 엑셀·구글 시트에 붙여 넣으세요.');
    } catch (e) {
      showErrorToast('복사하지 못했습니다.', e);
    }
  };
  const tableRef = useRef<HTMLDivElement>(null);
  const print = () => {
    if (!tableRef.current || !cls) return;
    const parts = [filter.subject ? (filter.subject === NO_SUBJECT ? '교과 없음' : filter.subject) : '모든 교과', filter.semester ? `${filter.semester}학기` : '학년 전체', filter.type ? EVAL_TYPE_LABEL[filter.type] : ''].filter(Boolean);
    printNode(tableRef.current, {
      title: `${describeClass(cls)} 조사표 모아 보기`,
      subtitle: `${parts.join(' · ')} · 조사표 ${shown.length}개 · ✎ 사유 있음 · · 명단에 없음`,
      landscape: shown.length > 5,
    });
  };

  return (
    <ModalShell isOpen onClose={close} raise={raise} width="2xl" title="📊 조사표 모아 보기" footer={<ModalCloseButton onClose={close} />}>
      {classes.length === 0 ? (
        <p className="text-center text-slate-400 py-8 text-sm" data-eval-overview-no-class>
          명렬표가 없습니다. 학급 화면 → 🧑‍🤝‍🧑 명렬표에서 학급과 학생을 먼저 넣어 주세요.
        </p>
      ) : (
        <div className="flex flex-col gap-3 text-xs text-slate-700" data-eval-overview-window={cls?.id ?? ''}>
          {isClassUnit && (
            <div className="inline-flex self-start bg-slate-100 p-1 rounded-xl gap-1" role="tablist" aria-label="모아 보기 방식">
              {(
                [
                  ['class', '학급별'],
                  ['course', '과정별'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={view === id}
                  data-eval-overview-tab={id}
                  onClick={() => setView(id)}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${view === id ? 'bg-white text-primary shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          {showCourse ? (
            <CourseEvalOverview classes={classes} evals={all} openEval={openEval} />
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-1.5">
                <select value={cls?.id ?? ''} data-eval-overview-class onChange={(e) => chooseClass(e.target.value)} aria-label="학급" className={select}>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {describeClass(c)}
                    </option>
                  ))}
                </select>
                <select value={filter.subject ?? ''} data-eval-overview-subject onChange={(e) => setFilter({ ...filter, subject: e.target.value })} aria-label="교과" className={select}>
                  <option value="">모든 교과</option>
                  {subjects.map((s) => (
                    <option key={s} value={s}>
                      {s === NO_SUBJECT ? '교과 없음' : s}
                    </option>
                  ))}
                </select>
                <select
                  value={filter.semester ?? ''}
                  data-eval-overview-semester
                  onChange={(e) => setFilter({ ...filter, semester: e.target.value ? (Number(e.target.value) as 1 | 2) : null })}
                  aria-label="학기"
                  className={select}
                >
                  <option value="">학년 전체</option>
                  <option value="1">1학기</option>
                  <option value="2">2학기</option>
                </select>
                <select value={filter.type ?? ''} data-eval-overview-type onChange={(e) => setFilter({ ...filter, type: e.target.value as EvalType | '' })} aria-label="유형" className={select}>
                  <option value="">모든 유형</option>
                  <option value="eval">평가</option>
                  <option value="check">체크</option>
                  <option value="memo">메모</option>
                </select>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-bold text-slate-500 mr-auto" data-eval-overview-count={shown.length}>
                  조사표 {shown.length}개{shown.length !== evals.length ? ` (전체 ${evals.length})` : ''} · 학생 {students.length}명
                </span>
                <button type="button" data-eval-overview-copy onClick={() => void copy()} disabled={shown.length === 0} className={tool}>
                  📋 표 복사
                </button>
                <button type="button" data-eval-overview-csv onClick={download} disabled={shown.length === 0} className={tool}>
                  📥 CSV
                </button>
                <button type="button" data-eval-overview-print onClick={print} disabled={shown.length === 0} className={tool}>
                  🖨️ 인쇄
                </button>
              </div>
              {evals.length === 0 ? (
                <p className="text-center text-slate-400 py-8">{cls ? `${cls.year}학년도에 이 학급으로 만든 조사표가 없습니다.` : ''} 조사표는 수업 칸·기록 칸의 📊에서 만듭니다.</p>
              ) : shown.length === 0 ? (
                <p className="text-center text-slate-400 py-8">고른 교과·학기·유형에 맞는 조사표가 없습니다.</p>
              ) : (
                <div ref={tableRef} className="border border-slate-200 rounded-xl overflow-auto max-h-[65vh]" data-eval-overview>
                  <table className="text-xs border-collapse min-w-full">
                    <thead className="bg-slate-100 sticky top-0 z-20">
                      <tr>
                        <th className="sticky left-0 z-10 bg-slate-100 p-1.5 w-10 min-w-10 whitespace-nowrap border-b border-r border-slate-200">번호</th>
                        <th className="sticky left-10 z-10 bg-slate-100 p-1.5 min-w-16 text-left border-b border-r border-slate-200">이름</th>
                        {shown.map((ev) => {
                          const counts = stepCounts(ev, sids);
                          return (
                            <th key={`${ev.space}:${ev.id}`} className="p-1 border-b border-r border-slate-200 align-top min-w-24 max-w-40 font-normal">
                              <button
                                type="button"
                                onClick={() => openEval(ev)}
                                title={`${ev.date} ${ev.title} - 눌러서 열기${ev.shared ? ' (👥 공유 그룹)' : ''}`}
                                data-eval-col={ev.id}
                                className="w-full text-left rounded-md px-1 py-0.5 hover:bg-white cursor-pointer"
                              >
                                <span className="block text-2xs font-bold text-slate-400">
                                  {EVAL_TYPE_LABEL[ev.type]}
                                  {ev.shared ? ' 👥' : ''}
                                </span>
                                <span className="block font-black text-slate-700 leading-tight line-clamp-2">{evalColumnTitle(ev)}</span>
                                {counts && (
                                  <span className="block text-2xs text-slate-400 leading-tight" data-eval-steps>
                                    {counts}
                                  </span>
                                )}
                              </button>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((st) => (
                        <tr key={st.sid} className={st.out ? 'text-slate-300' : 'hover:bg-slate-50'} data-eval-overview-row={st.sid}>
                          <td className="sticky left-0 bg-white p-1.5 w-10 min-w-10 text-center font-bold text-slate-400 border-b border-r border-slate-100">{st.num}</td>
                          <td className="sticky left-10 bg-white p-1.5 font-bold border-b border-r border-slate-100 whitespace-nowrap">
                            {st.name}
                            {st.out && <span className="ml-1 text-2xs">(전출)</span>}
                          </td>
                          {shown.map((ev) => {
                            const inList = evalHasStudent(ev, st.sid);
                            const cell = studentEvalCell(ev, st.sid);
                            return (
                              <td
                                key={`${ev.space}:${ev.id}`}
                                className="p-1.5 text-center border-b border-r border-slate-100"
                                title={inList ? evalCellText(cell) || undefined : '이 조사표 명단에 없습니다'}
                                data-eval-cell={`${ev.id}:${st.sid}`}
                              >
                                {!inList ? (
                                  <span className="text-slate-200">·</span>
                                ) : isEmptyCell(cell) ? (
                                  ''
                                ) : (
                                  <span className="font-bold">
                                    {cell.main || '…'}
                                    {cell.note && (
                                      <span className="ml-0.5 text-slate-400" aria-label="사유 있음">
                                        ✎
                                      </span>
                                    )}
                                  </span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="text-2xs text-slate-400">
                {cls?.year}학년도에 이 학급으로 만든 조사표를 개인 공간과 지금 보는 공유 그룹에서 모았습니다. 읽기만 합니다 - 값은 조사표 머리를 눌러 연 조사표에서 고칩니다. ✎는 사유·근거가 있다는 표시(칸에 마우스를 올리면 보임)입니다.
              </p>
            </>
          )}
        </div>
      )}
    </ModalShell>
  );
}
