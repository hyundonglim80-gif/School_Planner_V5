// 시간표 창 '🏖️ 학기·방학' 탭 (V4 '학사일정(학기) 기간 설정'). 계정에 하나 settings/common.terms - 학년도마다.
// 방학을 적으면 학기는 저절로 셈한다(1학기 = 3/1 ~ 여름 방학 전날, 2학기 = 여름 방학 다음 날 ~ 겨울 방학 전날).
// 방학에는 시간표 수업이 없다(domain/lessons). 검색·링크 연결의 '1학기 / 2학기'도 이 값을 쓴다. 학사일정으로 채우기는 우리 학교(P6-3)에서.
import { academicYearOf, todayStr } from '../../domain/dateUtils';
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
      </div>
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
