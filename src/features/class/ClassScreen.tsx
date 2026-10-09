// 학급 화면 (V4 features/class/ClassScreen.tsx) = 🏫 학급 도구 | 🧑‍🤝‍🧑 명렬표 (관리 · 검색 · 암기) - MENU 3-3.
//   학급 도구: 학급을 고르면(이 기기에 남는다 - 도구가 그 학급으로 연다) 도구 카드(CLASS_TOOLS)·학생 명단. 이름을 누르면 그 학생의 누가기록(P7-4).
//   교과 모드: 올해 반을 학년별 줄의 반 색 칩으로 고른다. 교과 + 담임은 담임반에서만 담임 도구.
//   아직 없는 것: 📋 오늘 출결 줄(P7-2) · 📷 사진 보기(P7-1 ■3). 도구는 그 기능을 옮기는 세션이 창을 등록하면 열린다(그 전에는 🚧 안내).
import { useMemo } from 'react';
import { runFromButton } from '../../app/keys';
import { getWindowDef, openWindow } from '../../app/windows';
import { showToast } from '../../app/toast';
import { academicYearOf, todayStr } from '../../domain/dateUtils';
import { classIdOf, classLabelOf, describeClass, isActive } from '../../domain/roster';
import { normalizeSlotText } from '../../domain/teachingSlot';
import { useMirrorStatus } from '../../data/select';
import { usePersonalSpaceId } from '../../data/session';
import { useClassColorOf, useTeaching } from '../lessons/teaching';
import { rememberHubClass, useClasses, useHubClass, type ClassItem } from './classes';
import RosterView from './RosterView';
import { CLASS_TOOLS, type ClassTool } from './tools';
import { openClassRoster, setClassView, useClassView } from './view';
import { isDirty, useRosterDraft } from './rosterDraft';

/** 그 학생의 누가기록 (P7-4가 창을 등록한다) */
function openStudentRecord(classId: string, sid: string) {
  if (getWindowDef('studentRecord')) openWindow('studentRecord', { classId, sid });
  else showToast('🚧 학생 기록(누가기록)은 아직 V5로 옮기지 않았습니다.');
}

function ClassHub() {
  const { classes } = useClasses();
  const status = useMirrorStatus('classes', usePersonalSpaceId());
  const remembered = useHubClass((s) => s.id);
  const { showHomeroomTools: modeHomeroom, isClassUnit, preset, mode } = useTeaching();
  const colorOf = useClassColorOf();
  const year = academicYearOf(todayStr());

  // 처음 학급: 마지막에 고른 것 → 올해의, 학생이 있는 첫 학급 → 첫 학급
  const cls: ClassItem | null =
    classes.find((c) => c.id === remembered) ?? classes.find((c) => c.year === year && c.students.length > 0) ?? classes.find((c) => c.students.length > 0) ?? classes[0] ?? null;
  // 교과 + 담임: 담임반이 아닌 반에서는 담임 도구를 숨긴다 (그 반은 교과 출결로)
  const showHomeroomTools = modeHomeroom && !(preset === 'subjectHomeroom' && cls && normalizeSlotText(mode.homeroomClass) !== classLabelOf(cls));
  const gradeRows = useMemo(() => {
    if (!isClassUnit) return [];
    const rows: Array<{ grade: number; classes: ClassItem[] }> = [];
    for (const c of classes.filter((x) => x.year === year).sort((a, b) => a.grade - b.grade || a.num - b.num)) {
      let row = rows.find((r) => r.grade === c.grade);
      if (!row) rows.push((row = { grade: c.grade, classes: [] }));
      row.classes.push(c);
    }
    return rows;
  }, [isClassUnit, classes, year]);
  const students = useMemo(() => (cls?.students ?? []).filter(isActive).sort((a, b) => a.num - b.num), [cls]);

  const choose = (id: string) => rememberHubClass(id);
  const openTool = (id: ClassTool['id']) => {
    if (cls) rememberHubClass(cls.id);
    if (id === 'roster') openClassRoster();
    else runFromButton(id);
  };

  if (classes.length === 0) {
    if (status !== 'live') {
      return (
        <div className="flex flex-col items-center justify-center py-20 gap-3" data-class-waiting>
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-slate-200 border-t-primary" />
          <p className="text-xs text-slate-400 font-medium">명렬표를 불러오는 중...</p>
        </div>
      );
    }
    return (
      <div className="max-w-xl mx-auto text-center py-16 flex flex-col items-center gap-3" data-class-empty>
        <p className="text-4xl">🏫</p>
        <p className="font-bold text-slate-700">아직 학급(명렬표)이 없습니다.</p>
        <p className="text-sm text-slate-500">명렬표를 만들면 이 화면에서 출석부·자리표·누가기록·조사표를 학급별로 엽니다.</p>
        <button type="button" data-class-make-roster onClick={() => openClassRoster('manage')} className="px-4 py-2 rounded-xl bg-primary text-white font-bold text-sm cursor-pointer">
          🧑‍🤝‍🧑 명렬표 만들기
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4" data-class-hub={cls?.id}>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-black text-slate-800">🏫 학급</h2>
        <select aria-label="학급 고르기" data-class-pick value={cls?.id ?? ''} onChange={(e) => choose(e.target.value)} className="px-3 py-1.5 border border-slate-200 rounded-xl font-bold text-sm bg-white">
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {describeClass(c)} ({c.students.filter(isActive).length}명)
            </option>
          ))}
        </select>
        <span className="text-xs text-slate-400">고른 학급으로 아래 도구가 열립니다.</span>
      </div>

      {/* 교과 모드: 올해 반을 학년별 줄의 반 색 칩으로 */}
      {gradeRows.length > 0 && (
        <div className="flex flex-col gap-1.5" data-class-grade-rows>
          {gradeRows.map((row) => (
            <div key={row.grade} className="flex flex-wrap items-center gap-1.5" data-class-grade={row.grade}>
              <span className="w-12 shrink-0 text-xs font-black text-slate-500">{row.grade}학년</span>
              {row.classes.map((c) => {
                const label = classLabelOf(c);
                return (
                  <button
                    key={c.id}
                    type="button"
                    data-class-chip={label}
                    aria-pressed={c.id === cls?.id}
                    onClick={() => choose(c.id)}
                    className={`px-3 py-1 rounded-lg text-sm font-black border border-transparent cursor-pointer ${colorOf(label).chip} ${c.id === cls?.id ? 'ring-2 ring-offset-1 ring-slate-500' : 'opacity-70 hover:opacity-100'}`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* 도구 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
        {CLASS_TOOLS.filter((t) => (showHomeroomTools || !t.homeroom) && (isClassUnit || !t.classUnit)).map((t) => (
          <button
            key={t.id}
            type="button"
            data-class-tool={t.id}
            onClick={() => openTool(t.id)}
            className="text-left bg-white border border-slate-200 rounded-2xl p-3 sm:p-4 hover:border-primary/50 hover:shadow-sm transition-all flex flex-col gap-1 cursor-pointer"
          >
            <span className="text-2xl leading-none">{t.icon}</span>
            <span className="font-black text-sm text-slate-800">{t.label}</span>
            <span className="text-xs text-slate-500">{t.desc}</span>
          </button>
        ))}
      </div>

      {/* 학생 명단 - 이름을 누르면 그 학생의 누가기록 */}
      <section className="bg-white border border-slate-200 rounded-2xl p-3 sm:p-4" data-class-students={students.length}>
        <h3 className="font-black text-sm text-slate-700 mb-2">
          🧑‍🎓 학생 {students.length}명 <span className="text-xs font-semibold text-slate-400">- 누르면 그 학생의 누가기록</span>
        </h3>
        {students.length === 0 ? (
          <p className="text-sm text-slate-400">이 학급에 학생이 없습니다. 위의 🧑‍🤝‍🧑 명렬표에서 더합니다.</p>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-8 gap-1.5">
            {students.map((s) => (
              <button
                key={s.sid}
                type="button"
                data-class-student={s.num}
                onClick={() => cls && openStudentRecord(classIdOf(cls), s.sid)}
                className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg border border-slate-200 hover:bg-primary/5 hover:border-primary/40 text-sm text-left min-w-0 cursor-pointer"
              >
                <span className="text-xs font-bold text-slate-400 tabular-nums shrink-0">{s.num}</span>
                <span className="font-bold text-slate-800 truncate">{s.name || '이름 없음'}</span>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default function ClassScreen() {
  const view = useClassView((s) => s.view);
  const drafts = useRosterDraft((s) => s.drafts);
  const { classes } = useClasses();
  const dirty = isDirty(drafts, classes);
  const item = (on: boolean) => `px-3 py-1.5 rounded-lg text-sm font-black transition-colors cursor-pointer ${on ? 'bg-white text-primary shadow-2xs' : 'text-slate-500 hover:text-slate-700'}`;
  return (
    <div data-screen="class" className="animate-fade-in pb-12 flex flex-col gap-3">
      <div role="tablist" aria-label="학급 화면" data-class-mode-switch className="self-start flex gap-1 bg-slate-100 rounded-xl p-1">
        <button type="button" role="tab" aria-selected={view === 'hub'} data-class-mode="hub" onClick={() => setClassView('hub')} className={item(view === 'hub')}>
          🏫 학급 도구
        </button>
        <button type="button" role="tab" aria-selected={view === 'roster'} data-class-mode="roster" onClick={() => openClassRoster()} className={item(view === 'roster')}>
          🧑‍🤝‍🧑 명렬표 (관리 · 검색 · 암기){dirty && <span className="ml-1 text-amber-600" title="저장하지 않은 것이 있습니다">●</span>}
        </button>
      </div>
      {view === 'roster' ? <RosterView /> : <ClassHub />}
    </div>
  );
}
