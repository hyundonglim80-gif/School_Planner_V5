// 🌱 새 학년도 준비 창 (P9-2 - V5 새 기능, MENU 2-3). 창 'newYear' = { year? } - 3월 안내 띠 · ⏰ 시간표 창 머리줄 🌱.
//   넘기는 것은 없다: 라벨·설정·교시·교사 유형은 그대로, 지난 학년도 자료는 그 자리에(보기만 - 옮기거나 지우지 않는다).
//   새로 정할 넷만 차례로 - 할 것이 끝난 단계는 ✓:
//     ① 새 학급 = 학년·반 + 명단 붙여넣기 → 곧바로 만든다(고치기는 명렬표)  ② 시간표 = 지난 표를 베껴 3/1 ~ 이듬해 2월로 만들고 시간표 창에서 고친다
//     ③ 방학 = 시간표 창 '학기·방학' 탭을 그 학년도로(📚 학사일정으로 채우기)  ④ 담임반 = (중등) 전담 + 담임만 - 그 학년도 학급에서 고른다
//   '준비 끝'은 그 학년도 띠를 닫는다(common.newYearDone).
import { useState, type ReactNode } from 'react';
import { setCommonSetting } from '../../app/prefs';
import { showErrorToast, showToast } from '../../app/toast';
import { openWindow, type WindowProps } from '../../app/windows';
import { todayStr } from '../../domain/dateUtils';
import { defaultNewYear, parseRosterPaste } from '../../domain/newYear';
import { classIdOf, compareClasses, describeClass, type RosterClass } from '../../domain/roster';
import { presetOf, TEACHER_PRESETS } from '../../domain/teachingMode';
import ModalShell, { ModalCloseButton } from '../../ui/ModalShell';
import { rememberHubClass } from '../class/classes';
import { useRosterDraft } from '../class/rosterDraft';
import { openClassRoster } from '../class/view';
import { updateTeaching } from '../lessons/teaching';
import { createCopiedTimetable, createNewClass, useNewYear } from './useNewYear';

export type NewYearParams = { year?: number };

function Step({ id, n, title, done, children }: { id: string; n: number; title: string; done: boolean; children: ReactNode }) {
  return (
    <section data-new-year-step={id} data-done={done ? 'true' : 'false'} className={`rounded-xl border p-3 space-y-2 ${done ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-200 bg-white'}`}>
      <h3 className="flex items-center gap-2 text-sm font-black text-slate-800">
        <span className={`w-5 h-5 rounded-full text-2xs flex items-center justify-center ${done ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-600'}`}>{done ? '✓' : n}</span>
        {title}
      </h3>
      {children}
    </section>
  );
}

const btn = 'px-2.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer disabled:opacity-50';

/** 명렬표를 그 학급으로 연다 (학급 화면 · 고친 것이 없을 때만 고른 학급을 옮긴다) */
function openRosterAt(id: string, classes: readonly (RosterClass & { id?: string })[]) {
  rememberHubClass(id);
  if (!useRosterDraft.getState().drafts) {
    const at = [...classes].sort(compareClasses).findIndex((c) => classIdOf(c) === id);
    if (at >= 0) useRosterDraft.setState({ index: at });
  }
  openClassRoster('manage');
}

export default function NewYearWindow({ params, close, raise }: WindowProps<NewYearParams | undefined>) {
  const [year, setYear] = useState(() => params?.year ?? defaultNewYear(todayStr()));
  const [asked, setAsked] = useState(params);
  if (params !== asked) {
    setAsked(params);
    if (params?.year) setYear(params.year);
  }
  const { state, source, sid, classSid, classDocs, mode } = useNewYear(year);
  const preset = presetOf(mode);
  const wantsHomeroom = preset === 'subjectHomeroom';

  const lastHomeroom = state.lastClasses[0];
  const [grade, setGrade] = useState(() => (lastHomeroom ? String(lastHomeroom.grade) : ''));
  const [num, setNum] = useState('');
  const [names, setNames] = useState('');
  const [asHomeroom, setAsHomeroom] = useState(true);
  const [busy, setBusy] = useState(false);
  const parsed = parseRosterPaste(names);

  const makeClass = async () => {
    const g = Number(grade);
    const c = Number(num);
    if (!classSid || busy) return;
    if (!Number.isInteger(g) || g < 1 || g > 12 || !Number.isInteger(c) || c < 1 || c > 30) return showErrorToast('학년(1~12)과 반(1~30)을 숫자로 적어 주세요.');
    setBusy(true);
    try {
      const id = await createNewClass(classSid, classDocs, { year, grade: g, num: c }, parsed);
      if (!id) return showErrorToast(`${describeClass({ year, grade: g, num: c })}은 이미 있습니다. 명렬표에서 고쳐 주세요.`);
      if (wantsHomeroom && asHomeroom) updateTeaching({ homeroomClass: `${g}-${c}` });
      setNum('');
      setNames('');
    } catch {
      // 안내는 저장 도우미가 했다 - 적은 것은 그대로
    } finally {
      setBusy(false);
    }
  };

  const copyTimetable = async () => {
    if (!sid || busy) return;
    setBusy(true);
    try {
      const id = await createCopiedTimetable(sid, source, year);
      openWindow('timetable', { tab: 'grid', pick: id });
    } catch {
      // 안내는 저장 도우미가 했다
    } finally {
      setBusy(false);
    }
  };

  const finish = () => {
    setCommonSetting('newYearDone', year);
    showToast(`🌱 ${year}학년도 준비를 마쳤습니다. 다시 열려면 ⏰ 시간표 창 위 🌱 새 학년도.`);
    close();
  };

  const allClasses = [...state.classes, ...state.lastClasses];

  return (
    <ModalShell
      isOpen
      onClose={close}
      raise={raise}
      width="lg"
      title="🌱 새 학년도 준비"
      footer={
        <>
          <ModalCloseButton onClose={close} />
          <button type="button" data-new-year-done onClick={finish} className="px-5 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer">
            ✅ 준비 끝
          </button>
        </>
      }
    >
      <div className="space-y-3 text-xs text-slate-700" data-new-year-window={year}>
        <div className="flex items-center gap-2">
          <button
            type="button"
            data-new-year-prev
            onClick={() => setYear(year - 1)}
            aria-label="앞 학년도"
            className="w-7 h-7 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 font-bold cursor-pointer"
          >
            ◀
          </button>
          <span className="text-sm font-black text-slate-800">{year}학년도</span>
          <button
            type="button"
            data-new-year-next
            onClick={() => setYear(year + 1)}
            aria-label="다음 학년도"
            className="w-7 h-7 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 font-bold cursor-pointer"
          >
            ▶
          </button>
        </div>
        <p className="leading-relaxed text-slate-600">
          라벨·설정·교시·교사 유형은 <b>그대로</b> 씁니다. 지난 학년도 자료(일정·메모·학급·출석·조사표)도 그 자리에 남아 날짜를 옮기거나 명렬표에서 학년도를 골라 언제든 봅니다 - 옮기거나 지우지
          않습니다. 아래 넷만 새로 정하세요.
        </p>

        <Step id="classes" n={1} title="새 학급 (명렬표)" done={state.classes.length > 0}>
          {state.classes.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {state.classes.map((c) => (
                <button
                  key={classIdOf(c)}
                  type="button"
                  data-new-year-class={classIdOf(c)}
                  onClick={() => openRosterAt(classIdOf(c), allClasses)}
                  className={`${btn} bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-50`}
                >
                  🏫 {c.grade}-{c.num} ({c.students.length}명)
                </button>
              ))}
            </div>
          )}
          <div className="flex items-center gap-1.5 flex-wrap">
            <input
              data-new-year-grade
              value={grade}
              onChange={(e) => setGrade(e.target.value.replace(/\D/g, ''))}
              inputMode="numeric"
              aria-label="학년"
              placeholder="학년"
              className="w-14 border border-slate-200 rounded px-2 py-1 font-bold"
            />
            <span>학년</span>
            <input
              data-new-year-num
              value={num}
              onChange={(e) => setNum(e.target.value.replace(/\D/g, ''))}
              inputMode="numeric"
              aria-label="반"
              placeholder="반"
              className="w-14 border border-slate-200 rounded px-2 py-1 font-bold"
            />
            <span>반</span>
            {wantsHomeroom && (
              <label className="flex items-center gap-1 ml-1">
                <input type="checkbox" data-new-year-as-homeroom checked={asHomeroom} onChange={(e) => setAsHomeroom(e.target.checked)} />
                담임반으로
              </label>
            )}
          </div>
          <textarea
            data-new-year-names
            value={names}
            onChange={(e) => setNames(e.target.value)}
            rows={4}
            placeholder={'명단을 붙여 넣으세요 - 한 줄에 한 명 (엑셀의 번호·이름·성별 칸 그대로, 또는 이름만)\n비워 두면 빈 학급을 만들고 명렬표에서 적습니다.'}
            className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs"
          />
          <div className="flex items-center gap-2 flex-wrap">
            <button type="button" data-new-year-create-class onClick={() => void makeClass()} disabled={busy} className={`${btn} bg-primary hover:bg-primary/90 text-white`}>
              🏫 학급 만들기{parsed.length ? ` (학생 ${parsed.length}명)` : ''}
            </button>
            {parsed.length > 0 && (
              <span className="text-slate-500" data-new-year-preview>
                {parsed
                  .slice(0, 4)
                  .map((s) => `${s.num}. ${s.name}`)
                  .join(' · ')}
                {parsed.length > 4 ? ' …' : ''}
              </span>
            )}
          </div>
          {state.lastClasses.length > 0 && (
            <p className="text-slate-500">
              지난 학년도 학급:{' '}
              {state.lastClasses.map((c, i) => (
                <span key={classIdOf(c)}>
                  {i > 0 && ', '}
                  <button type="button" data-new-year-last-class={classIdOf(c)} onClick={() => openRosterAt(classIdOf(c), allClasses)} className="underline hover:text-slate-800 cursor-pointer">
                    {c.grade}-{c.num}
                  </button>
                </span>
              ))}{' '}
              (보기만 - 그대로 남습니다)
            </p>
          )}
        </Step>

        <Step id="timetable" n={2} title="시간표" done={state.timetable}>
          {state.timetable ? (
            <p>{year}학년도 시간표가 있습니다. 2학기에 바뀌면 시간표 창에서 '+ 새 시간표'로 더합니다.</p>
          ) : (
            <p>
              {source ? (
                <>
                  마지막에 쓰던 <b>[{source.name}]</b>을 베껴 {year}학년도 시간표(3/1 ~ 이듬해 2월)를 만들고, 바뀐 칸만 고칩니다.
                </>
              ) : (
                <>베낄 지난 시간표가 없습니다. 빈 시간표를 만들어 채웁니다.</>
              )}
            </p>
          )}
          <div className="flex gap-1.5 flex-wrap">
            {!state.timetable && (
              <button type="button" data-new-year-copy-timetable onClick={() => void copyTimetable()} disabled={busy} className={`${btn} bg-primary hover:bg-primary/90 text-white`}>
                🗂️ {source ? '지난 시간표 베껴 만들기' : '빈 시간표 만들기'}
              </button>
            )}
            <button type="button" data-new-year-open-timetable onClick={() => openWindow('timetable', { tab: 'grid' })} className={`${btn} bg-white border border-slate-200 hover:bg-slate-50`}>
              ⏰ 시간표 창
            </button>
          </div>
        </Step>

        <Step id="terms" n={3} title="학기·방학" done={state.terms}>
          <p>{year}학년도 여름·겨울 방학을 적으면 학기는 저절로 셉니다. 우리 학교를 골랐으면 📚 학사일정으로 채웁니다.</p>
          <button
            type="button"
            data-new-year-open-terms
            onClick={() => openWindow('timetable', { tab: 'terms', termsYear: year })}
            className={`${btn} bg-white border border-slate-200 hover:bg-slate-50`}
          >
            🏖️ {year}학년도 방학 적기
          </button>
        </Step>

        <Step id="teaching" n={4} title="교사 유형·담임반" done={state.homeroom}>
          <p>
            교사 유형: <b>{TEACHER_PRESETS.find((p) => p.value === preset)?.label}</b>
            {wantsHomeroom && (
              <>
                {' '}
                · 담임반: <b data-new-year-homeroom>{mode.homeroomClass || '없음'}</b>
              </>
            )}
          </p>
          {wantsHomeroom && !state.homeroom && state.classes.length > 0 && (
            <div className="flex gap-1.5 flex-wrap">
              {state.classes.map((c) => (
                <button
                  key={classIdOf(c)}
                  type="button"
                  data-new-year-set-homeroom={`${c.grade}-${c.num}`}
                  onClick={() => updateTeaching({ homeroomClass: `${c.grade}-${c.num}` })}
                  className={`${btn} bg-white border border-sky-300 text-sky-800 hover:bg-sky-50`}
                >
                  {c.grade}-{c.num}을 담임반으로
                </button>
              ))}
            </div>
          )}
          {mode.unit === 'class' && <p className="text-slate-500">가르치는 반·과목이 바뀌었으면 교사 유형 탭에서 고칩니다.</p>}
          <button type="button" data-new-year-open-teaching onClick={() => openWindow('timetable', { tab: 'teaching' })} className={`${btn} bg-white border border-slate-200 hover:bg-slate-50`}>
            👩‍🏫 교사 유형 탭
          </button>
        </Step>
      </div>
    </ModalShell>
  );
}
