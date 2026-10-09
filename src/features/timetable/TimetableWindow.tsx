// ⏰ 시간표 창 (V4 components/TimetableTemplateModal.tsx - MENU 2-3). 창 'timetable' = { tab? } - ⋮ 수업 · 하루 수업 칸 ⚙️ · 단축키 '시간표'·'교사 유형 바꾸기'.
//   탭 넷: 👩‍🏫 교사 유형(누르는 즉시 저장) / 🗂️ 시간표(기간별 여러 장) / 🕘 교시(이름·시각) / 🏖️ 학기·방학.
//   시간표·교시·학기는 고친 것만 들고 있다가 💾 저장(Ctrl+S) 한 번에 - 시간표는 문서마다(timetables), 교시·방학은 계정 설정(common).
//   **'적용' 단추는 없다** - 시간표를 저장하면 그 기간의 날이 저절로 따라간다(domain/lessons). V4의 '⚡ 일괄 덮어쓰기'가 필요 없다.
// 저장하지 않고 닫으면(ESC·✕) 먼저 묻는다(창 목록 registerUnsavedCheck).
import { useEffect, useMemo, useRef, useState } from 'react';
import { setCommonSetting, useCommonSettings } from '../../app/prefs';
import { showToast } from '../../app/toast';
import { registerUnsavedCheck, type WindowProps } from '../../app/windows';
import { academicYearOf, todayStr } from '../../domain/dateUtils';
import { timetableOn } from '../../domain/lessons';
import { toMinutes, type PeriodDef } from '../../domain/periodTimes';
import { schoolYearSpan, termSemesters, type SchoolTerms } from '../../domain/semester';
import type { SlotGrid } from '../../domain/teachingSlot';
import { newId } from '../../data/id';
import { batch } from '../../data/repo';
import { isLive, useDocs } from '../../data/select';
import { useCurrentSpaceId } from '../../data/session';
import { recordUndo } from '../../data/undo';
import ModalShell, { ModalCloseButton } from '../../ui/ModalShell';
import { useSlotPairOptions, useTeaching } from '../lessons/teaching';
import GridTab from './GridTab';
import PeriodsTab from './PeriodsTab';
import TeachingTab from './TeachingTab';
import TermsTab from './TermsTab';
import { draftOf, draftProblem, firstTimetable, timetableOps, type TimetableDraft } from './timetableDraft';

export type TimetableTab = 'teaching' | 'grid' | 'periods' | 'terms';

const TABS: ReadonlyArray<{ id: TimetableTab; label: string }> = [
  { id: 'teaching', label: '👩‍🏫 교사 유형' },
  { id: 'grid', label: '🗂️ 시간표' },
  { id: 'periods', label: '🕘 교시' },
  { id: 'terms', label: '🏖️ 학기·방학' },
];

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** 교시 시각이 틀린 교시 (시각을 적었으면 둘 다 알아볼 수 있고 끝이 시작보다 늦어야 한다 - V4) */
function badPeriods(periods: readonly PeriodDef[]): string[] {
  return periods
    .filter((p) => p.start || p.end)
    .filter((p) => {
      const s = toMinutes(p.start);
      const e = toMinutes(p.end);
      return s === null || e === null || e <= s;
    })
    .map((p) => p.name || `${p.n}교시`);
}

/** 방학 기간이 틀린 학년도 */
function badTerms(terms: SchoolTerms): string | null {
  for (const [year, t] of Object.entries(terms)) {
    for (const [which, name] of [
      ['summer', '여름'],
      ['winter', '겨울'],
    ] as const) {
      const s = t[which];
      if (!s || (!s.from && !s.to)) continue;
      if (!s.from || !s.to) return `${year}학년도 ${name} 방학의 시작·끝 날을 모두 적어 주세요.`;
      if (s.from > s.to) return `${year}학년도 ${name} 방학의 시작 날이 끝 날보다 늦습니다.`;
    }
  }
  return null;
}

/** 빈 방학 칸은 빼고 적는다 */
function cleanTerms(terms: SchoolTerms): SchoolTerms {
  const out: SchoolTerms = {};
  for (const [year, t] of Object.entries(terms)) {
    const summer = t.summer?.from && t.summer.to ? t.summer : undefined;
    const winter = t.winter?.from && t.winter.to ? t.winter : undefined;
    if (summer || winter) out[year] = { ...(summer ? { summer } : {}), ...(winter ? { winter } : {}) };
  }
  return out;
}

export default function TimetableWindow({ params, close, raise }: WindowProps<{ tab?: TimetableTab } | undefined>) {
  const [tab, setTab] = useState<TimetableTab>(params?.tab ?? 'grid');
  // 열려 있는 창을 다른 탭으로 다시 열면(단축키 '교사 유형 바꾸기') 그 탭으로
  const [askedTab, setAskedTab] = useState(params?.tab);
  if (params?.tab !== askedTab) {
    setAskedTab(params?.tab);
    if (params?.tab) setTab(params.tab);
  }

  const sid = useCurrentSpaceId();
  const docs = useDocs('timetables', sid);
  const savedPeriods = useCommonSettings((s) => s.periods);
  const savedTerms = useCommonSettings((s) => s.terms);
  const { isClassUnit } = useTeaching();
  const today = todayStr();
  const thisYear = academicYearOf(today);

  // 고친 것만 (사본 위에 얹는다)
  const [edited, setEdited] = useState<Record<string, TimetableDraft>>({});
  const [removed, setRemoved] = useState<string[]>([]);
  const [periodsDraft, setPeriodsDraft] = useState<PeriodDef[] | null>(null);
  const [termsDraft, setTermsDraft] = useState<SchoolTerms | null>(null);
  const [termsYear, setTermsYear] = useState(thisYear);
  const [firstId] = useState(() => newId());
  const [picked, setPicked] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const periods = periodsDraft ?? savedPeriods;
  const terms = termsDraft ?? savedTerms;

  // 보이는 시간표 = 사본(지운 것·지울 것 빼고)에 고친 것을 얹고 + 새것. 시작 날 차례
  const shown: TimetableDraft[] = [
    ...Object.values(docs)
      .filter((d) => isLive(d) && !removed.includes(d.id))
      .map((d) => edited[d.id] ?? draftOf(d)),
    ...Object.values(edited).filter((d) => !docs[d.id] && !removed.includes(d.id)),
  ];
  const list = (shown.length ? shown : [edited[firstId] ?? firstTimetable(firstId, thisYear)]).sort(
    (a, b) => a.from.localeCompare(b.from) || a.name.localeCompare(b.name, 'ko'),
  );

  const todayId = timetableOn(today, list)?.id ?? null;
  const current = list.find((t) => t.id === picked) ?? list.find((t) => t.id === todayId) ?? list[list.length - 1];

  const ops = sid ? timetableOps(sid, docs, edited, removed, periods.length) : [];
  const periodsDirty = periodsDraft !== null && !same(periodsDraft, savedPeriods);
  const termsDirty = termsDraft !== null && !same(cleanTerms(termsDraft), savedTerms);
  const dirty = ops.length > 0 || periodsDirty || termsDirty;

  const unsaved = useRef<() => boolean>(() => false);
  useEffect(() => {
    unsaved.current = () => dirty;
  }, [dirty]);
  useEffect(() => registerUnsavedCheck(unsaved), []);

  const grids = list.map((t) => t.grid as SlotGrid);
  const pairOptions = useSlotPairOptions(undefined, sid, grids);

  // 빠른 기간 (학년도 끝까지 - 늦게 시작한 것이 이기므로 2학기 시간표가 생기면 거기서 바뀐다)
  const quick = useMemo(() => {
    const span = schoolYearSpan(thisYear);
    const sem2From = termSemesters(terms[String(thisYear)], thisYear).sem2?.from ?? `${thisYear}-09-01`;
    return { sem1: { from: span.start, to: span.end }, sem2: { from: sem2From, to: span.end } };
  }, [terms, thisYear]);

  const change = (next: TimetableDraft) => setEdited((e) => ({ ...e, [next.id]: next }));

  const add = () => {
    const id = newId();
    const from = today < current.from ? current.from : today;
    change({ id, name: `${Number(from.slice(5, 7))}/${Number(from.slice(8, 10))}부터 시간표`, from, to: current.to || schoolYearSpan(thisYear).end, grid: structuredClone(current.grid) });
    setPicked(id);
    showToast('📅 지금 표를 베낀 새 시간표를 만들었습니다. 이름·기간을 고치고 저장하세요.');
  };

  const remove = (id: string) => {
    if (list.length <= 1 && !docs[id]) {
      showToast('지울 시간표가 없습니다.');
      return;
    }
    setRemoved((r) => [...r, id]);
    setPicked(null);
    const t = list.find((x) => x.id === id);
    showToast(`🗑️ [${t?.name || '시간표'}]를 지웠습니다. 저장하면 휴지통으로 갑니다.`);
  };

  const save = async () => {
    if (saving || !sid) return;
    if (!dirty) {
      showToast('저장할 것이 없습니다.');
      return;
    }
    const problem =
      draftProblem(Object.values(edited).filter((d) => !removed.includes(d.id))) ??
      (badPeriods(periods).length ? `${badPeriods(periods).join(', ')}의 시각이 비었거나 끝이 시작보다 이릅니다.` : null) ??
      badTerms(terms);
    if (problem) {
      showToast(problem);
      return;
    }
    setSaving(true);
    try {
      if (ops.length) {
        const undo = await batch(ops, { fail: '시간표를 저장하지 못했습니다. 고친 것은 그대로 두었으니 다시 저장해 주세요.' });
        recordUndo(sid, '✅ 시간표를 저장했습니다. 그 기간의 수업 칸이 바뀝니다.', undo, { what: '시간표 저장' });
      }
      // 교시·방학은 계정 설정 (1초 뒤 올라간다)
      if (periodsDirty) setCommonSetting('periods', periods.map((p, i) => ({ ...p, n: i + 1, name: p.name.trim() || `${i + 1}교시` })));
      if (termsDirty) setCommonSetting('terms', cleanTerms(terms));
      if (!ops.length) showToast('✅ 저장했습니다.');
      setEdited({});
      setRemoved([]);
      setPeriodsDraft(null);
      setTermsDraft(null);
    } catch {
      // 안내는 저장 도우미가 했다 - 고친 것은 그대로
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell
      isOpen
      onClose={close}
      raise={raise}
      width="4xl"
      title="⏰ 시간표"
      onSave={() => void save()}
      footer={
        <>
          {dirty && (
            <span data-timetable-dirty className="mr-auto text-xs font-bold text-amber-600">
              저장하지 않은 것이 있습니다
            </span>
          )}
          <ModalCloseButton onClose={close} />
          <button
            type="button"
            data-timetable-save
            onClick={() => void save()}
            disabled={saving}
            className="px-5 py-2 bg-primary hover:bg-primary/90 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            💾 {saving ? '저장 중...' : '저장'}
          </button>
        </>
      }
    >
      <div className="space-y-4" data-timetable-window>
        <div className="flex gap-1.5 border-b border-slate-200 pb-2 overflow-x-auto" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              data-timetable-tab={t.id}
              onClick={() => setTab(t.id)}
              className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                tab === t.id ? 'bg-blue-50 text-blue-700 border border-blue-300' : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-transparent'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        {tab === 'teaching' && <TeachingTab grids={grids} />}
        {tab === 'grid' && (
          <GridTab
            list={list}
            current={current}
            todayId={todayId}
            today={today}
            onPick={setPicked}
            onChange={change}
            onAdd={add}
            onRemove={remove}
            periods={periods}
            onPeriods={setPeriodsDraft}
            quick={quick}
            isClassUnit={isClassUnit}
            pairOptions={pairOptions}
          />
        )}
        {tab === 'periods' && <PeriodsTab periods={periods} onChange={setPeriodsDraft} />}
        {tab === 'terms' && <TermsTab terms={terms} onChange={setTermsDraft} year={termsYear} onYear={setTermsYear} />}
      </div>
    </ModalShell>
  );
}
