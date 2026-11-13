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
import { UNDO_LABEL, UNDO_TOAST_MS } from '../../data/undo';
import { monthDayLabel, todayStr } from '../../domain/dateUtils';
import { classNumsLabel, defaultNewYear, newClassPlan, parseClassNums, parseRosterPaste, teachingClassesOffer } from '../../domain/newYear';
import { classIdOf, compareClasses, describeClass, type RosterClass } from '../../domain/roster';
import { presetOf, TEACHER_PRESETS } from '../../domain/teachingMode';
import ModalShell, { ModalCloseButton } from '../../ui/ModalShell';
import { rememberHubClass } from '../class/classes';
import { useRosterDraft } from '../class/rosterDraft';
import { openClassRoster } from '../class/view';
import { updateTeaching } from '../lessons/teaching';
import { clearStaleSubjects, createClasses, createCopiedTimetable, createNewClass, useNewYear, useNewYearLoaded } from './useNewYear';

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
  const { state, source, staleDays, dayDocs, sid, classSid, classDocs, mode } = useNewYear(year);
  // 받기 전의 '없음'은 모르는 것이다 - 받기 전에 '빈 시간표 만들기'를 누르면 베낄 표가 있어도 빈 표가 생겼다(P26-3, 느린 서버)
  const loaded = useNewYearLoaded();
  const preset = presetOf(mode);
  const wantsHomeroom = preset === 'subjectHomeroom';

  const lastHomeroom = state.lastClasses[0];
  // 손대기 전에는 지난 학년도 첫 학급의 학년 (창을 연 뒤에 받아도 채운다)
  const [gradeTyped, setGrade] = useState<string | null>(null);
  const grade = gradeTyped ?? (lastHomeroom ? String(lastHomeroom.grade) : '');
  const [num, setNum] = useState('');
  const [names, setNames] = useState('');
  const [asHomeroom, setAsHomeroom] = useState(true);
  const [busy, setBusy] = useState(false);
  const parsed = parseRosterPaste(names);
  // 교과 전담 새 학급 한꺼번에 (P32-3): 반 칸에 '1~6'·'1, 3, 5'면 그 학년의 빈 명렬표를 한 번에 (명단 칸 대신 안내)
  const classUnit = mode.unit === 'class';
  const { nums, bad } = parseClassNums(num);
  const multi = nums.length > 1;
  const g = Number(grade);
  const gradeOk = grade !== '' && Number.isInteger(g) && g >= 1 && g <= 12;
  const plan = multi && gradeOk && !bad.length ? newClassPlan((id) => !!classDocs[id] && !classDocs[id].deletedAt, { year, grade: g, nums }) : null;
  // 교사 유형 '가르치는 반'에 지난 학년도 반이 남았으면 ④에서 바꾸기를 권한다 (묻지 않고 바꾸면 지난 반이 사라진다)
  const offer = classUnit ? teachingClassesOffer(mode.classes, state.classes) : null;

  const makeClass = async () => {
    if (!classSid || busy || !loaded) return;
    if (!gradeOk || bad.length || !nums.length)
      return showErrorToast(classUnit ? '학년(1~12)과 반(1~30)을 숫자로 적어 주세요. 여러 반은 1~6 또는 1, 3, 5처럼 적습니다.' : '학년(1~12)과 반(1~30)을 숫자로 적어 주세요.');
    setBusy(true);
    try {
      if (multi) {
        const { made, skipped } = await createClasses(classSid, classDocs, { year, grade: g, nums });
        if (!made.length) return showErrorToast(`${year}학년도 ${classNumsLabel(g, skipped)}은 모두 이미 있습니다. 명렬표에서 고쳐 주세요.`);
        setNum('');
        return;
      }
      const c = nums[0];
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
    if (!sid || busy || !loaded) return;
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

  const clearStale = async () => {
    if (!sid || busy || !loaded) return;
    setBusy(true);
    try {
      await clearStaleSubjects(sid, dayDocs, staleDays);
    } catch {
      // 안내는 저장 도우미가 했다
    } finally {
      setBusy(false);
    }
  };

  const replaceTeachingClasses = () => {
    if (!offer) return;
    const before = mode.classes;
    updateTeaching({ classes: offer.next });
    showToast(`🏫 가르치는 반을 ${year}학년도 학급으로 바꿨습니다: ${offer.next.join(', ')} (뺀 반 ${offer.dropped.join(', ')})`, UNDO_TOAST_MS, 'info', {
      label: UNDO_LABEL,
      run: () => updateTeaching({ classes: before }),
    });
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
              onChange={(e) => setNum(e.target.value.replace(/[^0-9０-９~～〜∼\-－‐‑‒–—―−,，\s]/g, ''))}
              inputMode="numeric"
              aria-label="반"
              placeholder={classUnit ? '1~6' : '반'}
              className={`${classUnit ? 'w-24' : 'w-14'} border border-slate-200 rounded px-2 py-1 font-bold`}
            />
            <span>반</span>
            {wantsHomeroom && !multi && (
              <label className="flex items-center gap-1 ml-1">
                <input type="checkbox" data-new-year-as-homeroom checked={asHomeroom} onChange={(e) => setAsHomeroom(e.target.checked)} />
                담임반으로
              </label>
            )}
          </div>
          {classUnit && !multi && (
            <p data-new-year-classes-hint className="text-slate-500">
              여러 반은 반 칸에 <b>1~6</b> 또는 <b>1, 3, 5</b>처럼 - 빈 명렬표를 한꺼번에 만듭니다.
            </p>
          )}
          {multi ? (
            <p data-new-year-classes-note={plan ? plan.make.length : ''} className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 leading-relaxed text-slate-600">
              반이 여럿이면 <b>빈 명렬표</b>를 만듭니다 - 명단은 만든 반 단추를 눌러 명렬표에서 반마다 붙여 넣습니다.
              {plan && plan.skip.length > 0 && (
                <span data-new-year-classes-skip={plan.skip.join(',')}>
                  {' '}
                  {plan.skip.map((n) => `${g}-${n}`).join(' · ')}{plan.make.length ? ' - 이미 있어 건너뜁니다.' : ' - 모두 이미 있습니다.'}
                </span>
              )}
            </p>
          ) : (
            <textarea
              data-new-year-names
              value={names}
              onChange={(e) => setNames(e.target.value)}
              rows={4}
              placeholder={'명단을 붙여 넣으세요 - 한 줄에 한 명 (엑셀의 번호·이름·성별 칸 그대로, 또는 이름만)\n비워 두면 빈 학급을 만들고 명렬표에서 적습니다.'}
              className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs"
            />
          )}
          <div className="flex items-center gap-2 flex-wrap">
            <button type="button" data-new-year-create-class onClick={() => void makeClass()} disabled={busy || !loaded} className={`${btn} bg-primary hover:bg-primary/90 text-white`}>
              🏫 학급 {plan?.make.length ? `${plan.make.length}개 만들기 (빈 명렬표)` : `만들기${!multi && parsed.length ? ` (학생 ${parsed.length}명)` : ''}`}
            </button>
            {plan && plan.make.length > 0 && (
              <span className="text-slate-500" data-new-year-classes-preview>
                {plan.make.map((n) => `${g}-${n}`).join(' · ')}
              </span>
            )}
            {!multi && parsed.length > 0 && (
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
            <p data-new-year-source={loaded ? (source?.id ?? '') : undefined}>
              {!loaded ? (
                <>시간표를 받는 중…</>
              ) : source ? (
                <>
                  마지막에 쓰던 <b>[{source.name}]</b>
                  {source.from && <span className="text-slate-500"> ({monthDayLabel(source.from)}부터)</span>}을 베껴 {year}학년도 시간표(3/1 ~ 이듬해 2월)를 만들고, 바뀐 칸만 고칩니다.
                </>
              ) : (
                <>베낄 지난 시간표가 없습니다. 빈 시간표를 만들어 채웁니다.</>
              )}
            </p>
          )}
          <div className="flex gap-1.5 flex-wrap">
            {!state.timetable && (
              <button type="button" data-new-year-copy-timetable onClick={() => void copyTimetable()} disabled={busy || !loaded} className={`${btn} bg-primary hover:bg-primary/90 text-white`}>
                🗂️ {!loaded || source ? '지난 시간표 베껴 만들기' : '빈 시간표 만들기'}
              </button>
            )}
            <button type="button" data-new-year-open-timetable onClick={() => openWindow('timetable', { tab: 'grid' })} className={`${btn} bg-white border border-slate-200 hover:bg-slate-50`}>
              ⏰ 시간표 창
            </button>
          </div>
          {loaded && staleDays.length > 0 && (
            <div data-new-year-stale={staleDays.length} className="bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2 space-y-1.5 text-amber-900">
              <p>
                ⚠️ V4에서 가져온 <b>{year}학년도 날짜의 과목</b>이 {staleDays.length}일 남아 있습니다 (
                {staleDays
                  .slice(0, 4)
                  .map((d) => monthDayLabel(d.date))
                  .join(' · ')}
                {staleDays.length > 4 ? ' …' : ''}). V4가 1년 앞까지 적어 둔 옛 시간표라, 그날은 새 시간표 대신 옛 과목이 보입니다.
              </p>
              <button type="button" data-new-year-clear-stale onClick={() => void clearStale()} disabled={busy} className={`${btn} bg-white border border-amber-300 hover:bg-amber-100`}>
                🧹 옛 과목 지우기 (비고·첨부는 남김)
              </button>
            </div>
          )}
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
          {offer && (
            <div data-new-year-teaching-classes={offer.dropped.join(',')} className="bg-sky-50 border border-sky-200 rounded-lg px-2.5 py-2 space-y-1.5 text-sky-900">
              <p>
                교사 유형의 가르치는 반에 지난 반이 남아 있습니다: <b>{offer.dropped.join(' · ')}</b> (수업 칸 ▼에 계속 나옵니다)
              </p>
              <button type="button" data-new-year-replace-classes onClick={replaceTeachingClasses} className={`${btn} bg-white border border-sky-300 hover:bg-sky-100`}>
                🏫 가르치는 반을 {year}학년도 학급으로 바꾸기 ({offer.next.join(' · ')})
              </button>
            </div>
          )}
          {classUnit && <p className="text-slate-500">가르치는 반·과목이 바뀌었으면 교사 유형 탭에서 고칩니다.</p>}
          <button type="button" data-new-year-open-teaching onClick={() => openWindow('timetable', { tab: 'teaching' })} className={`${btn} bg-white border border-slate-200 hover:bg-slate-50`}>
            👩‍🏫 교사 유형 탭
          </button>
        </Step>
      </div>
    </ModalShell>
  );
}
