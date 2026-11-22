// ⏰ 시간표 창 (V4 components/TimetableTemplateModal.tsx - MENU 2-3). 창 'timetable' = { tab? } - ⋮ 수업 · 하루 수업 칸 ⚙️ · 단축키 '시간표'·'교사 유형 바꾸기'.
//   탭 넷: 👩‍🏫 교사 유형(누르는 즉시 저장) / 🗂️ 시간표(저장된 시간표 여러 장 + 날짜에 적용) / 🕘 교시(이름·시각) / 🏖️ 학기·방학.
//   시간표·교시·학기는 고친 것만 들고 있다가 💾 저장(Ctrl+S) 한 번에 - 시간표는 문서마다(timetables), 교시·방학은 계정 설정(common).
//   **저장과 적용은 따로다**(P37 11-16 사용자 요청 - 저장된 시간표를 지우니 적용된 수업 칸이 지워졌다): 💾 저장 = 저장된 시간표(이름·표만),
//   ✅ 적용 = 고른 기간의 수업 칸에 지금 표를(곧바로 쓴다, 되돌리기). 저장된 시간표를 지워도 적용한 날은 그대로다(domain/timetableApply).
//   P37 전 자료(한 장이 저장·적용을 함께 맡았다)는 창을 열면 저장된 시간표로 한 번 베낀다(savedCopyOps - 같은 id라 그 전에도 칩에 보인다).
//   적용 방식(P39 11-16 사용자 요청): 🖌️ 덮어쓰기(기본) / 🧩 빈 칸만 채우기(앞 표의 과목은 그대로 - applyOps mode 'fill', 채울 칸이 없으면 쓰지 않고 안내).
// 저장하지 않고 닫으면(ESC·✕) 먼저 묻는다(창 목록 useUnsavedCheck).
import { useEffect, useMemo, useRef, useState } from 'react';
import { setCommonSetting, useCommonSettings } from '../../app/prefs';
import { showToast } from '../../app/toast';
import { openWindow, useAskClose, useUnsavedCheck, type WindowProps } from '../../app/windows';
import { academicYearOf, monthDayLabel, todayStr } from '../../domain/dateUtils';
import { timetableOn } from '../../domain/lessons';
import { toMinutes, type PeriodDef } from '../../domain/periodTimes';
import { schoolYearSpan, termSemesters, type SchoolTerms } from '../../domain/semester';
import type { SlotGrid } from '../../domain/teachingSlot';
import { effectiveSegments, FAR_END, isAppliedTimetable, isSavedTimetable, type Piece } from '../../domain/timetableApply';
import { newId } from '../../data/id';
import { batch } from '../../data/repo';
import { isLive, useDocs, useMirrorStatus } from '../../data/select';
import { useCurrentSpaceId } from '../../data/session';
import { recordUndo } from '../../data/undo';
import ModalShell, { ModalCloseButton } from '../../ui/ModalShell';
import { openProgress } from '../progress/open';
import { useSlotPairOptions, useTeaching } from '../lessons/teaching';
import GridTab, { type AppliedRow } from './GridTab';
import PeriodsTab from './PeriodsTab';
import TeachingTab from './TeachingTab';
import TermsTab from './TermsTab';
import { applyOps, cleanGrid, draftOf, firstTimetable, gridIsEmpty, sameGrid, savedCopies, savedCopyOps, timetableOps, type ApplyMode, type TimetableDraft } from './timetableDraft';
import { shortcutTarget } from '../../ui/shortcutTarget';
import { useTabTarget } from '../../app/keys';
import { Glyph } from '../../ui/Icon';
import { glyphText } from '../../ui/glyphText';
import { BTN_MAIN } from '../../ui/buttons';

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

const md = (d: string) => (d === FAR_END ? '끝 없음' : monthDayLabel(d));

/** pick = 처음 고를 시간표 id(저장된 시간표, 또는 적용된 문서 - 그 문서가 온 저장된 시간표로), termsYear = '학기·방학' 탭의 학년도 (새 학년도 준비 창 P9-2) */
export type TimetableParams = { tab?: TimetableTab; pick?: string; termsYear?: number };

export default function TimetableWindow({ params, close, raise }: WindowProps<TimetableParams | undefined>) {
  // 창 안 탭 단축키(P18-2) - 단축키 설정이 고르는 표시 + 키가 있으면 툴팁
  const tabTarget = useTabTarget();
  const [tab, setTab] = useState<TimetableTab>(params?.tab ?? 'grid');
  const [picked, setPicked] = useState<string | null>(params?.pick ?? null);

  const sid = useCurrentSpaceId();
  const docs = useDocs('timetables', sid);
  const ttStatus = useMirrorStatus('timetables', sid);
  const savedPeriods = useCommonSettings((s) => s.periods);
  const savedTerms = useCommonSettings((s) => s.terms);
  const { isClassUnit } = useTeaching();
  const today = todayStr();
  const thisYear = academicYearOf(today);
  const yearEnd = schoolYearSpan(thisYear).end;

  // 고친 것만 (사본 위에 얹는다)
  const [edited, setEdited] = useState<Record<string, TimetableDraft>>({});
  const [removed, setRemoved] = useState<string[]>([]);
  const [periodsDraft, setPeriodsDraft] = useState<PeriodDef[] | null>(null);
  const [termsDraft, setTermsDraft] = useState<SchoolTerms | null>(null);
  const [termsYear, setTermsYear] = useState(params?.termsYear ?? thisYear);
  // 적용할 기간 - 저장된 시간표마다 (고르지 않았으면 아래 기본값)
  const [ranges, setRanges] = useState<Record<string, Piece>>({});
  const [firstId] = useState(() => newId());
  // 열려 있는 창을 다시 열면(단축키 '교사 유형 바꾸기'·새 학년도 준비) 그 탭·시간표·학년도로
  const [asked, setAsked] = useState(params);
  if (params !== asked) {
    setAsked(params);
    if (params?.tab) setTab(params.tab);
    if (params?.pick) setPicked(params.pick);
    if (params?.termsYear) setTermsYear(params.termsYear);
  }
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);
  // 적용 방식 (P39) - 창을 다시 열면 덮어쓰기
  const [mode, setMode] = useState<ApplyMode>('replace');

  const periods = periodsDraft ?? savedPeriods;
  const terms = termsDraft ?? savedTerms;

  // P37 전 자료 → 저장된 시간표 (서버에서 받은 뒤 창마다 한 번, 조용히 - 같은 id라 그 전에도 칩에는 보인다)
  const copies = useMemo(() => savedCopies(docs), [docs]);
  const copiedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!sid || ttStatus !== 'live' || copiedFor.current === sid) return;
    copiedFor.current = sid;
    const ops = savedCopyOps(sid, docs);
    if (ops.length) batch(ops, { fail: '저장된 시간표를 만들지 못했습니다. 창을 다시 열어 주세요.' }).catch(() => {});
  }, [sid, ttStatus, docs]);

  // 적용된 시간표 = 수업 칸이 따르는 것. saveId가 없는 옛 문서는 베낄 저장된 시간표로 잇는다
  const applied = useMemo(() => Object.values(docs).filter((d) => isLive(d) && isAppliedTimetable(d)), [docs]);
  const appliedById = useMemo(() => new Map(applied.map((a) => [a.id, a])), [applied]);
  const linkOf = useMemo(() => {
    const pending = new Map<string, string>();
    for (const c of copies) for (const id of c.of) pending.set(id, c.id);
    return (id: string) => appliedById.get(id)?.saveId ?? pending.get(id) ?? null;
  }, [copies, appliedById]);
  const segments = useMemo(() => effectiveSegments(applied), [applied]);

  // 보이는 저장된 시간표 = 사본(지운 것·지울 것 빼고) + 아직 베끼지 않은 옛 표에 고친 것을 얹고 + 새것. 만든 차례
  const base: Array<TimetableDraft & { createdAt?: number }> = [
    ...Object.values(docs)
      .filter((d) => isLive(d) && isSavedTimetable(d))
      .map((d) => ({ ...draftOf(d), createdAt: d.createdAt })),
    ...copies.filter((c) => !c.exists).map((c) => ({ id: c.id, name: c.name, grid: c.grid })),
  ];
  const shown = [
    ...base.filter((d) => !removed.includes(d.id)).map((d) => ({ ...(edited[d.id] ?? d), createdAt: d.createdAt })),
    ...Object.values(edited).filter((d) => !base.some((b) => b.id === d.id) && !removed.includes(d.id) && !docs[d.id]),
  ] as Array<TimetableDraft & { createdAt?: number }>;
  const list: TimetableDraft[] = (shown.length ? shown : [edited[firstId] ?? firstTimetable(firstId)]).sort(
    (a, b) =>
      ((a as { createdAt?: number }).createdAt ?? Infinity) - ((b as { createdAt?: number }).createdAt ?? Infinity) ||
      a.name.localeCompare(b.name, 'ko', { numeric: true }),
  );

  const todayApplied = timetableOn(today, applied);
  const todayId = todayApplied ? linkOf(todayApplied.id) : null;
  const pickedId = picked && appliedById.has(picked) ? linkOf(picked) : picked;
  const current = list.find((t) => t.id === pickedId) ?? list.find((t) => t.id === todayId) ?? list[list.length - 1];

  const ops = sid ? timetableOps(sid, docs, edited, removed, periods.length) : [];
  const periodsDirty = periodsDraft !== null && !same(periodsDraft, savedPeriods);
  const termsDirty = termsDraft !== null && !same(cleanTerms(termsDraft), savedTerms);
  const dirty = ops.length > 0 || periodsDirty || termsDirty;

  const unsaved = useRef<() => boolean>(() => false);
  useEffect(() => {
    unsaved.current = () => dirty;
  }, [dirty]);
  useUnsavedCheck(unsaved);
  const askClose = useAskClose(close);

  const grids = list.map((t) => t.grid as SlotGrid);
  const pairOptions = useSlotPairOptions(undefined, sid, grids);

  // 빠른 기간 (학년도 끝까지 - 2학기 시간표를 적용하면 그날부터 바뀐다)
  const span = schoolYearSpan(thisYear);
  const sem2From = termSemesters(terms[String(thisYear)], thisYear).sem2?.from ?? `${thisYear}-09-01`;
  const quick = { sem1: { from: span.start, to: span.end }, sem2: { from: sem2From, to: span.end } };

  // 적용할 기간의 기본값: 이 시간표가 오늘 쓰이면 오늘 ~ 그 끝, 앞으로 쓰일 날이 있으면 그 기간(새 학년도 시간표), 아니면 오늘 ~ 학년도 끝.
  //   지난 날은 기본으로 고르지 않는다 - 학기 중에 고친 표가 지난 수업 칸(진도 세기)을 바꾸지 않게.
  const mine = segments.filter((s) => linkOf(s.id) === current.id);
  const now = mine.find((s) => s.from <= today && s.to >= today);
  const next = mine.find((s) => s.from > today);
  const endOrYear = (to: string) => (to === FAR_END ? yearEnd : to);
  const range: Piece = ranges[current.id] ??
    (now ? { from: today, to: endOrYear(now.to) } : next ? { from: next.from, to: endOrYear(next.to) } : { from: today, to: yearEnd });
  const setRange = (r: Piece) => setRanges((m) => ({ ...m, [current.id]: r }));

  // 적용된 시간표 줄 - 이 학년도부터 (지난 학년도는 줄이지 않고 숨긴다)
  const yearStart = schoolYearSpan(thisYear).start;
  const appliedRows: AppliedRow[] = segments
    .filter((s) => s.to >= yearStart)
    .map((s) => ({ ...s, name: appliedById.get(s.id)?.name ?? '', today: s.from <= today && s.to >= today }));

  const change = (next: TimetableDraft) => setEdited((e) => ({ ...e, [next.id]: next }));

  const add = () => {
    const id = newId();
    change({ id, name: '새 시간표', grid: structuredClone(current.grid) });
    setPicked(id);
    showToast('📅 지금 표를 베낀 새 시간표를 만들었습니다. 이름·칸을 고치고 💾 저장, 날짜에 쓰려면 ✅ 적용하세요.');
  };

  const remove = (id: string) => {
    if (list.length <= 1 && !docs[id]) {
      showToast('지울 시간표가 없습니다.');
      return;
    }
    setRemoved((r) => [...r, id]);
    setPicked(null);
    const t = list.find((x) => x.id === id);
    showToast(`🗑️ [${t?.name || '시간표'}]를 지웠습니다. 저장하면 휴지통으로 갑니다(이미 적용한 날의 수업 칸은 그대로).`);
  };

  const save = async () => {
    if (saving || !sid) return;
    if (!dirty) {
      showToast('저장할 것이 없습니다.');
      return;
    }
    const problem = (badPeriods(periods).length ? `${badPeriods(periods).join(', ')}의 시각이 비었거나 끝이 시작보다 이릅니다.` : null) ?? badTerms(terms);
    if (problem) {
      showToast(problem);
      return;
    }
    setSaving(true);
    try {
      if (ops.length) {
        const undo = await batch(ops, { fail: '시간표를 저장하지 못했습니다. 고친 것은 그대로 두었으니 다시 저장해 주세요.' });
        recordUndo(sid, '✅ 시간표를 저장했습니다. 수업 칸은 ✅ 적용한 날만 바뀝니다.', undo, { what: '시간표 저장' });
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

  /** ✅ 적용 - 지금 표(저장하지 않은 고친 것도)를 그 기간에. 곧바로 쓰고 되돌리기 */
  const apply = async () => {
    if (applying || !sid) return;
    const { from, to } = range;
    if (!from || !to) return showToast('적용할 기간(시작·끝 날)을 정해 주세요.');
    if (from > to) return showToast('적용할 기간의 시작 날이 끝 날보다 늦습니다.');
    const grid = cleanGrid(current.grid, periods.length);
    if (gridIsEmpty(grid)) return showToast('표가 비어 있습니다. 과목을 적은 뒤 적용해 주세요.');
    const name = current.name.trim() || '시간표';
    const unsavedNote = ops.some((op) => op.at.id === current.id) ? ' 고친 표는 아직 저장하지 않았습니다(💾 저장).' : '';
    const writes = applyOps(sid, docs, { from, to }, { name, grid, saveId: current.id }, periods.length, undefined, mode);
    // 빈 칸만 채우기인데 그 기간의 앞 표마다 이 표의 과목이 든 칸이 이미 차 있다
    if (!writes.length) return showToast(`🧩 ${md(from)} ~ ${md(to)}에는 채울 빈 칸이 없습니다 - 이 표의 과목이 든 칸에 이미 과목이 있습니다.`);
    setApplying(true);
    try {
      const undo = await batch(writes, { fail: '시간표를 적용하지 못했습니다. 다시 눌러 주세요.' });
      const done =
        mode === 'fill'
          ? `🧩 [${name}]로 ${md(from)} ~ ${md(to)}의 빈 칸을 채웠습니다. 전에 적용한 표의 과목은 그대로입니다.`
          : `✅ [${name}]를 ${md(from)} ~ ${md(to)}에 적용했습니다. 그 날들의 수업 칸이 이 표를 따릅니다.`;
      recordUndo(sid, `${done}${unsavedNote}`, undo, { what: mode === 'fill' ? '시간표 빈 칸 채우기' : '시간표 적용' });
    } catch {
      // 안내는 저장 도우미가 했다
    } finally {
      setApplying(false);
    }
  };

  /** ✕ 빼기 - 그 기간의 적용을 뺀다(그 날들은 시간표 수업이 빈다). 곧바로 쓰고 되돌리기 */
  const unapply = async (row: AppliedRow) => {
    if (applying || !sid) return;
    setApplying(true);
    try {
      const undo = await batch(applyOps(sid, docs, { from: row.from, to: row.to }, null, periods.length), { fail: '적용을 빼지 못했습니다. 다시 눌러 주세요.' });
      recordUndo(sid, `🗑️ ${md(row.from)} ~ ${md(row.to)}의 적용을 뺐습니다. 그 날들은 시간표 수업이 비어 있습니다.`, undo, { what: '시간표 적용 빼기' });
    } catch {
      // 안내는 저장 도우미가 했다
    } finally {
      setApplying(false);
    }
  };

  /** 📥 불러오기 - 그 기간에 적용된 표를 위 표로 (같은 저장된 시간표가 그대로 있으면 그것을 고른다) */
  const load = (row: AppliedRow) => {
    const a = appliedById.get(row.id);
    if (!a) return;
    const link = linkOf(a.id);
    const kept = list.find((t) => t.id === link && sameGrid(t.grid, a.grid ?? {}));
    if (kept) {
      setPicked(kept.id);
      showToast(`📥 이 기간은 [${kept.name || '시간표'}] 그대로입니다 - 그 시간표를 골랐습니다.`);
      return;
    }
    const id = newId();
    change({ id, name: `${a.name || '시간표'} (적용된 표)`, grid: structuredClone(a.grid ?? {}) });
    setPicked(id);
    showToast('📥 적용된 표를 새 시간표로 불러왔습니다. 남기려면 💾 저장하세요.');
  };

  return (
    <ModalShell
      isOpen
      onClose={askClose}
      raise={raise}
      width="4xl"
      title="⏰ 시간표"
      onSave={() => void save()}
      headerExtra={
        <>
          {/* 새 학년도 준비 (P9-2) - 3월 띠를 닫은 뒤에도 여기서 */}
          <button
            type="button"
            data-timetable-new-year
            onClick={() => openWindow('newYear')}
            title="새 학급·시간표·방학·담임반을 새 학년도에 맞춥니다"
            className="px-2.5 py-1.5 bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold transition-colors cursor-pointer"
          >
            <Glyph e="🌱" /> 새 학년도
          </button>
          {/* 진도는 시간표 칸 글자마다 센다 - 시간표를 만지다 바로 갈 수 있게 (V4 그대로) */}
          <button
            type="button"
            data-timetable-progress
            {...shortcutTarget('progress')}
            onClick={() => openProgress()}
            title="과목마다 차시 목록을 붙여 넣고 시간표를 따라 몇 차시인지 봅니다"
            className="px-2.5 py-1.5 bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold transition-colors cursor-pointer"
          >
            <Glyph e="📘" /> 진도 관리
          </button>
        </>
      }
      footer={
        <>
          {dirty && (
            <span data-timetable-dirty className="mr-auto text-xs font-bold text-amber-600">
              저장하지 않은 것이 있습니다
            </span>
          )}
          <ModalCloseButton onClose={askClose} />
          <button
            type="button"
            data-timetable-save
            onClick={() => void save()}
            disabled={saving}
            className={`px-5 py-2 ${BTN_MAIN} disabled:opacity-50 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer`}
          >
            <Glyph e="💾" /> {saving ? '저장 중...' : '저장'}
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
              {...tabTarget('timetable', t.id)}
              onClick={() => setTab(t.id)}
              className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                tab === t.id ? 'bg-blue-50 text-blue-700 border border-blue-300' : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-transparent'
              }`}
            >
              {glyphText(t.label)}
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
            range={range}
            onRange={setRange}
            quick={quick}
            mode={mode}
            onMode={setMode}
            onApply={() => void apply()}
            applying={applying}
            applied={appliedRows}
            onUnapply={(row) => void unapply(row)}
            onLoad={load}
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
