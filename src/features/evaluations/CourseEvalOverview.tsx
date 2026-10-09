// 조사표 모아 보기의 '과정별' 탭 (V4 components/CourseEvalOverview.tsx, 교과 모드만). 과정(여러 반 진도) 하나를 고르면 반마다 그 학년도 조사표를
//   제목+종류로 묶은 반 × 평가 표(domain/evaluation groupCourseEvals). 칸은 '완료 n/m'(값이 있는 학생 / 재학생), 누르면 그 반 조사표. 읽기만 한다.
//   사본에서 계산하므로 조사표 창에서 고친 값이 곧 보인다(V4는 창을 닫으면 다시 읽었다).
import { useState } from 'react';
import { showToast } from '../../app/toast';
import { academicYearOf } from '../../domain/dateUtils';
import { useToday } from '../../ui/useToday';
import { EVAL_TYPE_LABEL, courseEvalCompletion, courseOverviewCsvRows, evalColumnTitle, groupCourseEvals } from '../../domain/evaluation';
import { courseTitle, isCourse } from '../../domain/progress';
import { classLabelOf, isActive } from '../../domain/roster';
import { downloadCsv } from '../../ui/download';
import type { ClassItem } from '../class/classes';
import { useProgressPlans } from '../progress/useProgress';
import type { SpaceEval } from './evalData';

interface Props {
  classes: readonly ClassItem[];
  evals: readonly SpaceEval[];
  openEval: (ev: SpaceEval) => void;
}

const COURSE_KEY = 'sp5-eval-overview-course';

export default function CourseEvalOverview({ classes, evals, openEval }: Props) {
  const { plans, loaded } = useProgressPlans();
  const today = useToday();
  const courses = plans.filter(isCourse);
  const [courseId, setCourseId] = useState<string>(() => {
    try {
      return localStorage.getItem(COURSE_KEY) || '';
    } catch {
      return '';
    }
  });
  const course = courses.find((c) => c.id === courseId) ?? courses[0] ?? null;
  const choose = (id: string) => {
    setCourseId(id);
    try {
      localStorage.setItem(COURSE_KEY, id);
    } catch {
      // 이 기기에서 기억하지 못할 뿐
    }
  };

  // 반마다: 그 학년도 명렬표와 재학생
  const year = academicYearOf(course?.startDate || today);
  const rows = (course?.classes ?? []).map((cls) => {
    const roster = classes.find((c) => c.year === year && classLabelOf(c) === cls) ?? null;
    const sids = (roster?.students ?? []).filter(isActive).sort((a, b) => a.num - b.num).map((s) => s.sid);
    return { cls, roster, sids };
  });
  const byClass = Object.fromEntries(rows.map((r) => [r.cls, r.roster ? evals.filter((e) => e.classId === r.roster!.id) : []]));
  const columns = course ? groupCourseEvals(byClass, course.subject) : [];

  const download = () => {
    if (!course || columns.length === 0) return showToast('내려받을 조사표가 없습니다.');
    downloadCsv(courseOverviewCsvRows(columns, rows), `${`과정평가_${courseTitle(course)}`.replace(/[\\/:*?"<>|\s]+/g, '_')}.csv`);
  };

  if (!loaded) return <p className="text-center text-slate-400 py-8">과정을 불러오는 중…</p>;
  if (courses.length === 0) {
    return (
      <p className="text-center text-slate-400 py-8" data-course-overview-empty>
        과정이 없습니다. ⋮ → 📘 진도 관리 → <b>+ 새 진도</b>에서 과목과 반을 골라 차시 목록 하나를 여러 반에 두면 여기서 반 × 평가로 봅니다.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3" data-course-overview={course?.id ?? ''}>
      <div className="flex flex-wrap items-center gap-1.5">
        <select value={course?.id ?? ''} data-course-overview-pick onChange={(e) => choose(e.target.value)} aria-label="과정" className="px-2 py-1.5 border border-slate-200 rounded-lg font-bold text-xs bg-white">
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {courseTitle(c)} · {(c.classes ?? []).join(', ')}
            </option>
          ))}
        </select>
        <span className="font-bold text-slate-500 mr-auto">
          평가 {columns.length}개 · 반 {rows.length}개
        </span>
        <button type="button" data-course-overview-csv onClick={download} disabled={columns.length === 0} className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 font-bold disabled:opacity-40 cursor-pointer">
          📥 CSV
        </button>
      </div>
      {columns.length === 0 ? (
        <p className="text-center text-slate-400 py-8">
          이 과정의 반에 {course?.subject ? `'${course.subject}' ` : ''}조사표가 없습니다. 수업 칸의 📊 조사표에서 '같은 과정의 다른 반에도'로 만들면 반마다 생깁니다.
        </p>
      ) : (
        <div className="border border-slate-200 rounded-xl overflow-auto max-h-[65vh]">
          <table className="text-xs border-collapse min-w-full" data-course-overview-table>
            <thead className="bg-slate-100 sticky top-0 z-20">
              <tr>
                <th className="sticky left-0 z-10 bg-slate-100 p-1.5 min-w-14 text-left border-b border-r border-slate-200">반</th>
                {columns.map((col) => (
                  <th key={col.id} className="p-1.5 border-b border-r border-slate-200 align-top min-w-24 max-w-40 font-normal text-left">
                    <span className="block text-2xs font-bold text-slate-400">
                      {EVAL_TYPE_LABEL[col.type]} · {evalColumnTitle({ date: col.firstDate, subject: '', title: '' })}~
                    </span>
                    <span className="block font-black text-slate-700 leading-tight line-clamp-2">{col.title}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ cls, roster, sids }) => (
                <tr key={cls} data-course-overview-row={cls} className="hover:bg-slate-50">
                  <td className="sticky left-0 bg-white p-1.5 font-black text-slate-800 border-b border-r border-slate-100 whitespace-nowrap">
                    {cls}
                    {!roster && <span className="block text-2xs font-normal text-slate-400">명렬표 없음</span>}
                  </td>
                  {columns.map((col) => {
                    const ev = col.byClass[cls];
                    if (!ev) {
                      return (
                        <td key={col.id} className="p-1.5 text-center text-slate-300 border-b border-r border-slate-100" data-course-cell={`${cls}|${col.title}`}>
                          -
                        </td>
                      );
                    }
                    const { done, total } = courseEvalCompletion(ev, sids);
                    const full = total > 0 && done >= total;
                    return (
                      <td key={col.id} className="p-1 text-center border-b border-r border-slate-100">
                        <button
                          type="button"
                          data-course-cell={`${cls}|${col.title}`}
                          onClick={() => openEval(ev)}
                          title={`${cls} ${ev.date} ${ev.title} - 눌러서 열기`}
                          className={`w-full rounded-md px-1.5 py-1 font-bold hover:bg-white border cursor-pointer ${full ? 'text-emerald-700 border-emerald-200 bg-emerald-50' : 'text-slate-700 border-transparent'}`}
                        >
                          완료 {done}/{total}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-2xs text-slate-400">반마다 같은 제목·종류의 조사표를 한 칸으로 묶었습니다(날짜는 반마다 다릅니다). '완료'는 값이 있는 학생 수 / 그 반 재학생 수. 칸을 누르면 그 반 조사표가 열립니다.</p>
    </div>
  );
}
