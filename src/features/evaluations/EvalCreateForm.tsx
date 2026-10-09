// 조사표 창의 '+ 새 조사표' 칸 (V4 EvaluationModal 생성 모드). 학급(명렬표)·제목·유형·교과·날짜·자리, 평가면 개인/조별·단계, 조별이면 조 나누기
//   (번호 차례로 n조 / 자리표 👥 모둠에서 저장한 모둠). 교과 모드에서 수업 칸('5-2 과학')으로 열면 그 반·과목을 골라 두고,
//   그 교시가 과정의 차시면 '같은 과정의 다른 반에도 만들기'(반마다 같은 차시를 하는 교시에 같은 조사표 - 조는 반마다 번호 차례로).
//   명단 = 그 학급의 재학생(sid). 만든 조사표는 그 창이 곧바로 연다.
import { useState } from 'react';
import { useCommonSettings } from '../../app/prefs';
import { showErrorToast, showToast } from '../../app/toast';
import { academicYearOf, shortDateLabel } from '../../domain/dateUtils';
import {
  DEFAULT_STEPS,
  EVAL_SUBJECTS,
  EVAL_TYPES,
  EVAL_TYPE_CHOICE,
  evalStudentsOf,
  groupsByNumber,
  type EvalType,
} from '../../domain/evaluation';
import { evalGroupsFrom, groupSetSummary } from '../../domain/groups';
import { classLabelOf, describeClass } from '../../domain/roster';
import { parseSlot } from '../../domain/teachingSlot';
import { useClasses, useHubClass } from '../class/classes';
import { useTeaching } from '../lessons/teaching';
import { useClassHub } from '../seating/seatingData';
import { createEvaluations, type NewEval } from './evalData';
import { useCourseEvalTargets } from './useCourseTargets';

interface Props {
  /** 저장할 공간 (창을 연 공간) */
  sid: string;
  date: string;
  /** 처음 고를 자리 ('3' / 'journal' / 없으면 1교시) */
  place?: string;
  /** 그 교시 칸 글자 - 학급·교과 기본값 */
  slot?: string;
  onCreated: (id: string) => void;
}

const field = 'w-full px-2 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none bg-white';
const label = 'text-xs font-bold text-slate-600 block mb-1';

export default function EvalCreateForm({ sid, date, place, slot, onCreated }: Props) {
  const { classes } = useClasses();
  const hubClass = useHubClass((s) => s.id);
  const { isClassUnit } = useTeaching();
  const periods = useCommonSettings((s) => s.periods);

  // 기본값: 교과 모드 칸의 반 → 학급 화면에서 고른 학급 → 그 학년도의 학생이 있는 첫 학급
  const year = academicYearOf(date);
  const slotParts = slot ? parseSlot(slot) : null;
  const slotClass = isClassUnit && slotParts?.cls ? classes.find((c) => c.year === year && classLabelOf(c) === slotParts.cls) : undefined;
  const [classId, setClassId] = useState<string | null>(null);
  const cls =
    classes.find((c) => c.id === classId) ??
    slotClass ??
    classes.find((c) => c.id === hubClass) ??
    classes.find((c) => c.year === year && c.students.length > 0) ??
    classes[0] ??
    null;

  const [title, setTitle] = useState('');
  const [type, setType] = useState<EvalType>('eval');
  const [subject, setSubject] = useState(() => (slotClass ? (slotParts?.subject ?? '') : isClassUnit ? (slotParts?.subject ?? '') : (slot ?? '').trim()));
  const [evalDate, setEvalDate] = useState(date);
  const [where, setWhere] = useState(place === 'journal' ? 'journal' : place && /^\d+$/.test(place) ? place : '1');
  const [indiv, setIndiv] = useState(true);
  const [group, setGroup] = useState(false);
  const [groupCount, setGroupCount] = useState(4);
  const [groupSetId, setGroupSetId] = useState('');
  const [steps, setSteps] = useState<string[]>(DEFAULT_STEPS.slice(0, 3));
  const [alsoOthers, setAlsoOthers] = useState(false);
  const [busy, setBusy] = useState(false);

  // 조 나누기: 고른 학급의 저장한 모둠 (자리표 👥 - 개인 공간)
  const { hub } = useClassHub(type === 'eval' && group ? (cls?.id ?? null) : null);
  const chosenSet = hub.groupSets.find((g) => g.id === groupSetId) ?? null;

  const period = where === 'journal' ? null : Number(where);
  const course = useCourseEvalTargets(evalDate, period, isClassUnit && sid.startsWith('u_'));
  const subjectOptions = [...EVAL_SUBJECTS, ...(subject && !EVAL_SUBJECTS.includes(subject) ? [subject] : [])];
  const periodNames = periods.length ? periods.map((p) => p.name || `${p.n}교시`) : ['1교시', '2교시', '3교시', '4교시', '5교시', '6교시'];

  const create = async () => {
    if (busy) return;
    if (!title.trim()) return showToast('제목을 입력하세요.');
    if (!cls) return showErrorToast('명렬표를 먼저 등록해 주세요. 학급 화면 → 🧑‍🤝‍🧑 명렬표에서 학급과 학생을 넣습니다.');
    const students = evalStudentsOf(cls.students);
    const sids = students.map((s) => s.sid);
    const base: NewEval = {
      date: evalDate,
      period,
      classId: cls.id,
      title: title.trim(),
      type,
      ...(subject ? { subject } : {}),
      ...(type === 'eval'
        ? {
            indiv,
            group,
            steps: steps.map((s) => s.trim()).filter(Boolean),
            ...(group ? { groups: chosenSet ? evalGroupsFrom(chosenSet, sids) : groupsByNumber(sids, groupCount) } : {}),
          }
        : {}),
      students,
    };
    // 같은 과정의 다른 반 (반마다 같은 차시를 하는 교시)
    const more: NewEval[] = [];
    const made: string[] = [];
    const later: string[] = [];
    const missing: string[] = [];
    if (alsoOthers) {
      for (const t of course.targets) {
        if (!t.slot) {
          later.push(t.cls);
          continue;
        }
        const c = classes.find((k) => k.year === academicYearOf(t.slot!.date) && classLabelOf(k) === t.cls);
        if (!c) {
          missing.push(`${t.cls}(명렬표 없음)`);
          continue;
        }
        const st = evalStudentsOf(c.students);
        more.push({
          ...base,
          date: t.slot.date,
          period: Number(t.slot.period),
          classId: c.id,
          students: st,
          ...(base.group ? { groups: groupsByNumber(st.map((s) => s.sid), Math.max(1, base.groups?.length || groupCount)) } : {}),
        });
        made.push(`${t.cls}(${shortDateLabel(t.slot.date)} ${t.slot.period}교시)`);
      }
    }
    setBusy(true);
    try {
      const ids = await createEvaluations(sid, [base, ...more]);
      setTitle('');
      onCreated(ids[0]);
      if (alsoOthers) {
        const parts = [made.length ? `${made.join('·')}에도 만들었습니다` : '', later.length ? `${later.join('·')}는 아직 시간표에 그 차시가 없습니다` : '', missing.length ? `${missing.join('·')}에는 만들지 못했습니다` : ''].filter(Boolean);
        if (parts.length) showToast(`${missing.length ? '' : '✅ '}${parts.join(' · ')}`);
      }
    } catch {
      // 안내는 저장 도우미가 했다 - 적은 것은 그대로
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="space-y-4"
      data-eval-create
      onSubmit={(e) => {
        e.preventDefault();
        void create();
      }}
    >
      <div>
        <label className={label}>적용할 명렬표</label>
        <select value={cls?.id ?? ''} data-eval-class onChange={(e) => setClassId(e.target.value)} aria-label="적용할 명렬표" className={field}>
          {classes.length === 0 && <option value="">등록된 명렬표 없음</option>}
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {describeClass(c)} ({c.students.filter((s) => s.status !== 'out').length}명)
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={label}>조사표 제목</label>
        <input type="text" data-eval-title value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 1단원 평가, 준비물 체크" className={field} />
      </div>
      <div>
        <label className={label}>유형 선택</label>
        <div className="flex gap-4 bg-slate-50 p-3 rounded-lg">
          {EVAL_TYPES.map((t) => (
            <label key={t} className="flex items-center gap-1.5 text-xs font-bold cursor-pointer">
              <input type="radio" name="eval-type" data-eval-type={t} checked={type === t} onChange={() => setType(t)} className="accent-primary" />
              {EVAL_TYPE_CHOICE[t]}
            </label>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={label}>교과</label>
          <select value={subject} data-eval-subject onChange={(e) => setSubject(e.target.value)} aria-label="교과" className={field}>
            <option value="">선택 안함</option>
            {subjectOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={label}>날짜</label>
          <input type="date" data-eval-date value={evalDate} onChange={(e) => e.target.value && setEvalDate(e.target.value)} aria-label="날짜" className={field} />
        </div>
        <div>
          <label className={label}>위치</label>
          <select value={where} data-eval-place onChange={(e) => setWhere(e.target.value)} aria-label="위치" className={field}>
            {periodNames.map((name, i) => (
              <option key={i} value={String(i + 1)}>
                {name}
              </option>
            ))}
            <option value="journal">기록 (그날 기록 칸)</option>
          </select>
        </div>
      </div>

      {type === 'eval' && (
        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-3">
          <div className="flex gap-4">
            <label className="flex items-center gap-1.5 text-xs font-bold cursor-pointer">
              <input type="checkbox" data-eval-indiv checked={indiv} onChange={(e) => setIndiv(e.target.checked)} className="accent-primary" /> 개인 평가
            </label>
            <label className="flex items-center gap-1.5 text-xs font-bold cursor-pointer">
              <input type="checkbox" data-eval-group checked={group} onChange={(e) => setGroup(e.target.checked)} className="accent-primary" /> 조별 평가
            </label>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 block mb-1">평가 단계 수: {steps.length}단계</label>
            <select
              value={steps.length}
              data-eval-step-count
              aria-label="평가 단계 수"
              onChange={(e) => setSteps(DEFAULT_STEPS.slice(0, Number(e.target.value)))}
              className="px-2 py-1 border border-slate-200 rounded text-xs bg-white"
            >
              {[2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}단계
                </option>
              ))}
            </select>
            <div className="flex gap-2 mt-2">
              {steps.map((s, i) => (
                <input
                  key={i}
                  value={s}
                  data-eval-step={i}
                  aria-label={`${i + 1}단계 이름`}
                  onChange={(e) => setSteps((list) => list.map((x, j) => (j === i ? e.target.value : x)))}
                  className="px-2 py-1 border border-slate-200 rounded text-xs flex-1 min-w-0 bg-white"
                />
              ))}
            </div>
          </div>
          {group && (
            <div className="space-y-2">
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">조 나누기</label>
                <select value={groupSetId} data-eval-group-set onChange={(e) => setGroupSetId(e.target.value)} aria-label="조 나누기" className="px-2 py-1 border border-slate-200 rounded text-xs max-w-full bg-white">
                  <option value="">번호 차례로 나누기</option>
                  {hub.groupSets.map((g) => (
                    <option key={g.id} value={g.id}>
                      🪑 저장한 모둠: {g.name} ({groupSetSummary(g.groups)})
                    </option>
                  ))}
                </select>
                {hub.groupSets.length === 0 && <p className="text-2xs text-slate-400 mt-1">학급 화면 → 🪑 자리표 → 👥 모둠에서 나눠 저장한 모둠을 여기서 불러 씁니다.</p>}
              </div>
              {chosenSet ? (
                <p className="text-2xs text-slate-500 leading-relaxed" data-eval-group-preview>
                  {chosenSet.groups
                    .filter((g) => g.members.length > 0)
                    .map((g) => `${g.name}: ${g.members.map((m) => cls?.students.find((s) => s.sid === m)?.num ?? '?').join(', ')}`)
                    .join(' / ')}
                </p>
              ) : (
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1">조 갯수: {groupCount}조</label>
                  <input
                    type="number"
                    data-eval-group-count
                    aria-label="조 갯수"
                    value={groupCount}
                    min={1}
                    max={20}
                    onChange={(e) => setGroupCount(Math.max(1, Math.min(20, Number(e.target.value) || 4)))}
                    className="px-2 py-1 border border-slate-200 rounded text-xs w-16 bg-white"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {course.targets.length > 0 && (
        <label className="flex items-start gap-2 bg-emerald-50/60 border border-emerald-200 rounded-xl p-3 text-xs cursor-pointer" data-course-evals>
          <input type="checkbox" data-course-evals-toggle checked={alsoOthers} onChange={(e) => setAlsoOthers(e.target.checked)} className="accent-emerald-600 mt-0.5" />
          <span>
            <b className="text-emerald-800">같은 과정의 다른 반에도 만들기</b>
            <span className="block text-slate-500 mt-0.5">
              {course.index != null && `${course.index + 1}차시를 하는 교시: `}
              {course.targets.map((t) => (t.slot ? `${t.cls} ${shortDateLabel(t.slot.date)} ${t.slot.period}교시` : `${t.cls} 아직 시간표에 없음`)).join(' · ')}
            </span>
          </span>
        </label>
      )}

      <button type="submit" data-eval-create-submit disabled={busy} className="w-full py-2.5 bg-primary text-white rounded-xl font-bold text-sm shadow-xs hover:bg-primary/90 transition-all cursor-pointer disabled:opacity-60">
        생성
      </button>
    </form>
  );
}
