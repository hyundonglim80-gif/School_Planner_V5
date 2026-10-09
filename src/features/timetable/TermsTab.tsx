// 시간표 창 '🏖️ 학기·방학' 탭 (V4 '학사일정(학기) 기간 설정'). 계정에 하나 settings/common.terms - 학년도마다.
// 방학을 적으면 학기는 저절로 셈한다(1학기 = 3/1 ~ 여름 방학 전날, 2학기 = 여름 방학 다음 날 ~ 겨울 방학 전날).
// 방학에는 시간표 수업이 없다(domain/lessons). 검색·링크 연결의 '1학기 / 2학기'도 이 값을 쓴다.
// '📚 학사일정으로 채우기'(P6-3): 우리 학교를 골랐으면 그 학년도 학사일정의 방학식·개학식으로 칸을 채운다(저장은 💾로).
import { useState } from 'react';
import { showErrorToast } from '../../app/toast';
import { loadMonthSchedule } from '../../data/neis';
import { installNeisKey } from '../../data/neisKey';
import { academicYearOf, todayStr } from '../../domain/dateUtils';
import { filterScheduleByGrade, findVacations, vacationMonths } from '../../domain/schoolSetting';
import { useSchool } from '../school/school';
import { termSemesters, type DateSpan, type SchoolTerms, type YearTerms } from '../../domain/semester';

interface Props {
  terms: SchoolTerms;
  onChange: (next: SchoolTerms) => void;
  year: number;
  onYear: (year: number) => void;
}

const span = (s: DateSpan | null) => (s ? `${s.from} ~ ${s.to}` : '');

export default function TermsTab({ terms, onChange, year, onYear }: Props) {
  const t: YearTerms = terms[String(year)] ?? {};
  const sems = termSemesters(t, year);
  const thisYear = academicYearOf(todayStr());
  const school = useSchool();
  const [filling, setFilling] = useState(false);
  const [note, setNote] = useState<{ year: number; text: string } | null>(null);

  const fill = async () => {
    if (!school || filling) return;
    setFilling(true);
    try {
      installNeisKey();
      const lists = await Promise.all(vacationMonths(year).map((m) => loadMonthSchedule(school, m)));
      const { summer, winter } = findVacations(filterScheduleByGrade(lists.flat(), school.grade), year);
      const md = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;
      if (!summer && !winter) {
        setNote({ year, text: `${year}학년도 학사일정에서 방학식·개학식을 찾지 못했습니다. 방학 기간을 직접 적어 주세요.` });
        return;
      }
      onChange({
        ...terms,
        [String(year)]: { ...t, ...(summer ? { summer: { from: summer.start, to: summer.end } } : {}), ...(winter ? { winter: { from: winter.start, to: winter.end } } : {}) },
      });
      const found = [summer && `여름 ${md(summer.start)}~${md(summer.end)}`, winter && `겨울 ${md(winter.start)}~${md(winter.end)}`].filter(Boolean).join(' · ');
      const missing = [!summer && '여름', !winter && '겨울'].filter(Boolean).join('·');
      setNote({ year, text: `📚 ${year}학년도 학사일정으로 채웠습니다: ${found}.` + (missing ? ` ${missing} 방학은 찾지 못해 그대로 두었습니다.` : '') + ' 맞으면 💾 저장을 누르세요.' });
    } catch (e) {
      showErrorToast('학사일정을 불러오지 못했습니다. 잠시 뒤 다시 눌러 보세요.', e);
    } finally {
      setFilling(false);
    }
  };

  const set = (which: 'summer' | 'winter', edge: keyof DateSpan, value: string) => {
    const cur = t[which] ?? { from: '', to: '' };
    const next = { ...t, [which]: { ...cur, [edge]: value } };
    onChange({ ...terms, [String(year)]: next });
  };

  const box = (which: 'summer' | 'winter', title: string, tone: string) => (
    <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-1.5">
      <span className={`font-bold ${tone}`}>{title}</span>
      <div className="flex items-center gap-1.5">
        {(['from', 'to'] as const).map((edge, i) => (
          <span key={edge} className="contents">
            {i === 1 && <span>~</span>}
            <input
              type="date"
              value={t[which]?.[edge] ?? ''}
              data-terms={`${which}-${edge}`}
              onChange={(e) => set(which, edge, e.target.value)}
              aria-label={`${title} ${edge === 'from' ? '시작' : '끝'}`}
              className="flex-1 min-w-0 border border-slate-200 rounded px-2 py-1 text-slate-700 font-bold"
            />
          </span>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-3 text-xs" data-terms-tab>
      <div className="flex items-center gap-2">
        <button type="button" data-terms-prev onClick={() => onYear(year - 1)} title="앞 학년도" aria-label="앞 학년도" className="w-7 h-7 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 font-bold cursor-pointer">
          ◀
        </button>
        <span className="text-sm font-black text-slate-800" data-terms-year={year}>
          {year}학년도
        </span>
        <button type="button" data-terms-next onClick={() => onYear(year + 1)} title="다음 학년도" aria-label="다음 학년도" className="w-7 h-7 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 font-bold cursor-pointer">
          ▶
        </button>
        {year !== thisYear && (
          <button type="button" data-terms-this onClick={() => onYear(thisYear)} className="px-2 py-1 rounded-lg text-slate-500 hover:bg-slate-100 font-bold cursor-pointer">
            올해로
          </button>
        )}
        {school && (
          <button
            type="button"
            data-terms-fill
            onClick={() => void fill()}
            disabled={filling}
            title={`${school.name} ${year}학년도 학사일정의 방학식·개학식으로 방학 기간을 채웁니다 (저장은 💾로)`}
            className="ml-auto px-3 py-1 bg-teal-50 hover:bg-teal-100 border border-teal-200 disabled:opacity-50 text-teal-700 font-bold rounded-lg transition-colors cursor-pointer"
          >
            {filling ? '불러오는 중…' : '📚 학사일정으로 채우기'}
          </button>
        )}
      </div>
      {note?.year === year && (
        <p className="text-teal-700 font-bold" data-terms-fill-note>
          {note.text}
        </p>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {box('summer', '☀️ 여름 방학', 'text-orange-700')}
        {box('winter', '❄️ 겨울 방학', 'text-sky-700')}
      </div>
      <div className="bg-white/70 border border-slate-200 rounded-lg px-3 py-2 text-slate-600 space-y-0.5">
        <div data-terms-sem1>
          <span className="font-bold text-blue-700">1학기</span> {span(sems.sem1) || '여름 방학 시작일을 적으면 셈합니다'}
          <span className="text-slate-400"> (3월 1일 ~ 여름 방학 전날)</span>
        </div>
        <div data-terms-sem2>
          <span className="font-bold text-indigo-700">2학기</span> {span(sems.sem2) || '여름 방학 끝 날과 겨울 방학 시작일을 적으면 셈합니다'}
          <span className="text-slate-400"> (여름 방학 다음 날 ~ 겨울 방학 전날)</span>
        </div>
        <div className="text-slate-500 pt-0.5">방학에는 시간표 수업이 보이지 않습니다(그날 따로 적은 과목은 보입니다). 학년도마다 따로 적습니다.</div>
      </div>
    </div>
  );
}
