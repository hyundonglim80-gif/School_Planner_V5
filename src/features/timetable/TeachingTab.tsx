// 시간표 창 '👩‍🏫 교사 유형' 탭 (V4 components/TeachingModePanel.tsx). 셋 중 하나를 고르면 곧바로 계정에 저장한다(1초 뒤 - app/prefs).
// 전담·(중등) 전담 + 담임이면 가르치는 과목·반·반 색, (초등) 담임·(중등) 전담 + 담임이면 담임반을 고른다.
// 여기 적은 반·과목이 시간표 표와 수업 칸의 ▼ 목록에 나온다. 명렬표의 반은 학급 화면(P7-1)이 생기면 함께 나온다.
import { useState, type KeyboardEvent } from 'react';
import { showToast } from '../../app/toast';
import { academicYearOf, todayStr } from '../../domain/dateUtils';
import { presetPatch, TEACHER_PRESETS, type TeacherPreset } from '../../domain/teachingMode';
import { CLASS_COLORS, classColor, parseClassInput, type SlotGrid } from '../../domain/teachingSlot';
import { updateTeaching, useTeaching, useTeachingClasses } from '../lessons/teaching';

const chip = (on: boolean) =>
  `px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
    on ? 'bg-primary text-white border-primary shadow-xs' : 'bg-white text-slate-500 border-slate-200 hover:border-primary hover:text-primary'
  }`;

const byClassOrder = (a: string, b: string) => {
  const [ga, ca] = a.split('-').map(Number);
  const [gb, cb] = b.split('-').map(Number);
  return ga - gb || ca - cb;
};

export default function TeachingTab({ grids }: { grids: readonly SlotGrid[] }) {
  const { mode, preset } = useTeaching();
  const [subjectInput, setSubjectInput] = useState('');
  const [classInput, setClassInput] = useState('');
  const [homeroomInput, setHomeroomInput] = useState('');
  const schoolYear = academicYearOf(todayStr());
  // 고치는 중인 시간표의 반까지 (아직 저장 전이어도 반 색·담임반에 나온다)
  const classLabels = useTeachingClasses(undefined, undefined, grids);

  const choosePreset = (p: TeacherPreset) => {
    updateTeaching(presetPatch(p));
    showToast(`👩‍🏫 교사 유형을 '${TEACHER_PRESETS.find((x) => x.value === p)?.label}'(으)로 저장했습니다.`);
  };

  const addSubjects = () => {
    const names = [...new Set(subjectInput.split(',').map((s) => s.trim()))].filter((s) => s && !mode.subjects.includes(s));
    setSubjectInput('');
    if (!names.length) return;
    updateTeaching({ subjects: [...mode.subjects, ...names] });
    showToast(`📚 가르치는 과목을 저장했습니다: ${names.join(', ')}`);
  };

  const removeSubject = (name: string) => {
    updateTeaching({ subjects: mode.subjects.filter((s) => s !== name) });
    showToast(`📚 '${name}'을(를) 가르치는 과목에서 뺐습니다.`);
  };

  // 가르치는 반: 시간표·명렬표에 없어도 수업 칸 ▼·진도의 반 칩에 나온다. '5-1, 5-2'·'5-1~5-6'
  const addClasses = () => {
    const { classes, bad } = parseClassInput(classInput);
    const fresh = classes.filter((c) => !mode.classes.includes(c));
    setClassInput(bad.join(' '));
    if (bad.length) showToast(`'${bad.join(', ')}'은(는) 반으로 읽지 못했습니다. 5-2처럼 적어 주세요.`);
    if (!fresh.length) return;
    updateTeaching({ classes: [...mode.classes, ...fresh] });
    showToast(`🏫 가르치는 반을 저장했습니다: ${fresh.join(', ')}`);
  };

  const removeClass = (cls: string) => {
    updateTeaching({ classes: mode.classes.filter((c) => c !== cls) });
    showToast(`🏫 '${cls}'을(를) 가르치는 반에서 뺐습니다.`);
  };

  const chooseHomeroom = (cls: string) => {
    updateTeaching({ homeroomClass: cls });
    showToast(cls ? `🏠 담임반을 ${cls}(으)로 저장했습니다.` : '🏠 담임반을 비웠습니다.');
  };

  const typedHomeroom = () => {
    const { classes } = parseClassInput(homeroomInput);
    setHomeroomInput('');
    if (classes.length === 1) chooseHomeroom(classes[0]);
    else if (homeroomInput.trim()) showToast('담임반은 5-2처럼 하나만 적어 주세요.');
  };

  const enterOrComma = (e: KeyboardEvent<HTMLInputElement>, run: () => void) => {
    if ((e.key === 'Enter' || e.key === ',') && !e.nativeEvent.isComposing) {
      e.preventDefault();
      run();
    }
  };

  const homeroomOptions = [...new Set([...classLabels, ...(mode.homeroomClass ? [mode.homeroomClass] : [])])].sort(byClassOrder);

  return (
    <div className="space-y-4" data-teaching-tab>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2" role="radiogroup" aria-label="교사 유형">
        {TEACHER_PRESETS.map((p) => {
          const on = preset === p.value;
          return (
            <button
              key={p.value}
              type="button"
              role="radio"
              aria-checked={on}
              data-teacher-preset={p.value}
              onClick={() => choosePreset(p.value)}
              className={`text-left px-3 py-2 rounded-xl border transition-all cursor-pointer ${
                on ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-slate-200 bg-white hover:border-primary'
              }`}
            >
              <span className={`block text-sm font-bold ${on ? 'text-primary' : 'text-slate-700'}`}>
                {on ? '● ' : '○ '}
                {p.label}
              </span>
              <span className="block text-xs text-slate-500 mt-0.5">{p.desc}</span>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-slate-400">유형을 바꿔도 적어 둔 자료는 그대로입니다. 보이는 모양만 달라집니다. PC·휴대폰이 같은 유형을 씁니다.</p>

      {preset !== 'homeroom' && (
        <div className="space-y-1.5" data-teaching-subjects>
          <span className="text-xs font-bold text-slate-600">가르치는 과목</span>
          <div className="flex flex-wrap items-center gap-1.5">
            {mode.subjects.map((s) => (
              <span key={s} data-teaching-subject={s} className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-lg bg-primary/10 text-primary text-xs font-bold">
                {s}
                <button type="button" onClick={() => removeSubject(s)} aria-label={`${s} 빼기`} title={`${s} 빼기`} className="w-5 h-5 rounded hover:bg-primary/20 leading-none cursor-pointer">
                  ✕
                </button>
              </span>
            ))}
            <input
              type="text"
              value={subjectInput}
              data-teaching-subject-input
              onChange={(e) => setSubjectInput(e.target.value)}
              onKeyDown={(e) => enterOrComma(e, addSubjects)}
              onBlur={() => subjectInput.trim() && addSubjects()}
              placeholder={mode.subjects.length ? '더하기' : '예: 과학, 영어'}
              aria-label="가르치는 과목 더하기"
              className="w-28 px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:border-primary"
            />
          </div>
          <p className="text-xs text-slate-400">쉼표나 Enter로 더합니다. 시간표 칸을 채울 때 ▼ 목록에 먼저 보여 줍니다.</p>
        </div>
      )}

      {preset !== 'homeroom' && (
        <div className="space-y-1.5" data-teaching-classes>
          <span className="text-xs font-bold text-slate-600">가르치는 반</span>
          <div className="flex flex-wrap items-center gap-1.5">
            {[...mode.classes].sort(byClassOrder).map((c) => (
              <span key={c} data-teaching-class={c} className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-bold">
                {c}
                <button type="button" onClick={() => removeClass(c)} aria-label={`${c} 빼기`} title={`${c} 빼기`} className="w-5 h-5 rounded hover:bg-emerald-100 leading-none cursor-pointer">
                  ✕
                </button>
              </span>
            ))}
            <input
              type="text"
              value={classInput}
              data-teaching-class-input
              onChange={(e) => setClassInput(e.target.value)}
              onKeyDown={(e) => enterOrComma(e, addClasses)}
              onBlur={() => classInput.trim() && addClasses()}
              placeholder={mode.classes.length ? '더하기' : '예: 5-1~5-6, 6-2'}
              aria-label="가르치는 반 더하기"
              className="w-36 px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:border-primary"
            />
          </div>
          <p className="text-xs text-slate-400">
            시간표·수업 칸에 적힌 반은 저절로 들어갑니다. 학년 초처럼 시간표가 없을 때 적어 두면 수업 칸 ▼에 나옵니다. <code>5-1~5-6</code>처럼 범위도 됩니다.
          </p>
        </div>
      )}

      {preset !== 'homeroom' && classLabels.length > 0 && (
        <div className="space-y-1.5" data-teaching-colors>
          <span className="text-xs font-bold text-slate-600">반 색 (하루·주간 수업 칸)</span>
          <div className="flex flex-col gap-1">
            {classLabels.map((cls) => {
              const current = classColor(cls, mode.classColors, classLabels).name;
              return (
                <div key={cls} className="flex items-center gap-2" data-class-color-row={cls}>
                  <span className="w-10 text-xs font-black text-slate-700 tabular-nums">{cls}</span>
                  <div className="flex items-center gap-1">
                    {CLASS_COLORS.map((c) => (
                      <button
                        key={c.name}
                        type="button"
                        data-class-color={c.name}
                        aria-pressed={current === c.name}
                        aria-label={`${cls} ${c.name}`}
                        title={`${cls} ${c.name}`}
                        onClick={() => updateTeaching({ classColors: { ...mode.classColors, [cls]: c.name } })}
                        className={`w-4 h-4 rounded-full cursor-pointer ${c.dot} ${current === c.name ? 'ring-2 ring-offset-1 ring-slate-500' : 'opacity-60 hover:opacity-100'}`}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-slate-400">고르지 않은 반은 반 차례대로 색이 정해집니다.</p>
        </div>
      )}

      {preset !== 'subject' && (
        <div className="space-y-1.5" data-teaching-homeroom>
          <span className="text-xs font-bold text-slate-600">담임반 ({schoolYear}학년도)</span>
          <div className="flex flex-wrap items-center gap-1.5">
            {homeroomOptions.map((cls) => (
              <button key={cls} type="button" data-homeroom-class={cls} aria-pressed={mode.homeroomClass === cls} onClick={() => chooseHomeroom(cls)} className={chip(mode.homeroomClass === cls)}>
                {cls}
              </button>
            ))}
            <button type="button" data-homeroom-class="" aria-pressed={!mode.homeroomClass} onClick={() => chooseHomeroom('')} className={chip(!mode.homeroomClass)}>
              고르지 않음
            </button>
            <input
              type="text"
              value={homeroomInput}
              data-homeroom-input
              onChange={(e) => setHomeroomInput(e.target.value)}
              onKeyDown={(e) => enterOrComma(e, typedHomeroom)}
              onBlur={() => homeroomInput.trim() && typedHomeroom()}
              placeholder="직접 적기 (5-2)"
              aria-label="담임반 직접 적기"
              className="w-28 px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:border-primary"
            />
          </div>
          <p className="text-xs text-slate-400">출석부·알림장이 담임반으로 열립니다. 명렬표(학급 화면)의 반도 곧 여기에 나옵니다.</p>
        </div>
      )}
    </div>
  );
}
