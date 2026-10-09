// 🪑 자리표 (V4 components/SeatingModal.tsx) - 창 'seating' = { classId?, draw?, at? }. 학급마다 여러 장, 셈은 domain/seating, 저장은 seatingData(개인 공간).
//   - 바꾸기: PC는 끌어다 놓기. 휴대폰은 '✏️ 자리 고치기'를 켜고 두 자리를 차례로 누른다(그 모드에서 고정·비우기·책상 없음도).
//   - 섞기: 떨어뜨릴 학생(학급마다) · 지난 짝 피하기 · 남녀 짝. 고정 칸은 그대로. 안내의 되돌리기로 섞기 전으로.
//   - 고칠 때마다 곧바로 저장(저장 단추 없음 - 손으로 바꾼 것은 Ctrl+Z 더미에). 화면은 사본이라 다른 기기에서 고친 것도 곧 보인다.
//   - '자리 고치기'가 꺼진 채 학생 자리를 누르면 학생 칸(SeatStudentCard) - 오늘 출결·관찰 한 줄. 자리에 오늘 출결(결석·지각…)을 적는다.
//   - 🎯 발표자 뽑기(SeatDrawBox·DrawBigView): 이번 판에 안 뽑힌 학생 먼저, 오늘 결석은 빼고, 뽑힌 자리를 짚는다. 이번 판은 학급 허브 - 다른 기기에서 이어 뽑는다.
//   - 👥 모둠(SeatGroupsBox): 무작위·자리대로 나눠 이름 붙여 저장(학급 허브 groupSets), 이 칸이 열린 동안 자리에 모둠 색.
//   학급: 넘겨받은 학급 → 학급 화면에서 고른 학급(이 기기, 고르면 함께 바뀐다) → 올해 학년도의 학생이 있는 첫 학급.
import { useState } from 'react';
import { useCommonSettings } from '../../app/prefs';
import { showToast } from '../../app/toast';
import type { WindowProps } from '../../app/windows';
import { useDocs, useMirrorStatus } from '../../data/select';
import { KIND_LABEL, attendanceDocId, readMarks } from '../../domain/attendance';
import { academicYearOf } from '../../domain/dateUtils';
import { groupColor, groupIndexByNum, type StudentGroup } from '../../domain/groups';
import { describeClass, isActive, type RosterStudent } from '../../domain/roster';
import {
  aisleAfter,
  clearSeat,
  displayOrder,
  initialChart,
  nearApartSeats,
  placeStudent,
  seatKey,
  shuffleSeats,
  shuffleSummary,
  swapSeats,
  toggleKey,
  unseatedNums,
  type SeatStudent,
} from '../../domain/seating';
import { drawStatusLine } from '../../domain/draw';
import ModalShell, { ModalCloseButton } from '../../ui/ModalShell';
import { useToday } from '../../ui/useToday';
import { openAttendance } from '../attendance/open';
import { rememberHubClass, useClasses, useHubClass } from '../class/classes';
import DrawBigView from './DrawBigView';
import type { SeatingParams } from './open';
import SeatApartBox from './SeatApartBox';
import SeatDrawBox from './SeatDrawBox';
import SeatGroupsBox from './SeatGroupsBox';
import SeatShapeBox from './SeatShapeBox';
import SeatStudentCard from './SeatStudentCard';
import { createChart, saveShuffled, updateChart, useClassHub, useSeatingCharts } from './seatingData';
import { useStudentDraw } from './useStudentDraw';
import { openStudentRecord } from '../studentRecord/open';

/** 학급마다 마지막에 본 자리표 (이 기기) */
const CHART_KEY = 'sp5-seating-chart';
/** 섞기 조건 (이 기기) */
const SHUFFLE_KEY = 'sp5-seating-shuffle';

function readJson<T extends object>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}
function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 이 기기에서 기억하지 못할 뿐
  }
}

type Panel = 'shape' | 'apart' | 'draw' | 'groups';
type Selection = { kind: 'seat'; key: string } | { kind: 'student'; sid: string } | null;

export default function SeatingWindow({ params, close, raise }: WindowProps<SeatingParams | undefined>) {
  const { classes, sid } = useClasses();
  const classesStatus = useMirrorStatus('classes', sid);
  const seatingStatus = useMirrorStatus('seating', sid);
  const hubClass = useHubClass((s) => s.id);
  const today = useToday();
  const periodCount = useCommonSettings((s) => s.periods.length) || 6;

  // ── 학급 ──
  const [chosen, setChosen] = useState<string | null>(params?.classId ?? null);
  const [panel, setPanel] = useState<Panel | null>(params?.draw ? 'draw' : null);
  // 다시 열면(학급 화면·수업 칸의 다른 반·🎯) 따라간다
  const [seenAt, setSeenAt] = useState(params?.at);
  if (params?.at !== seenAt) {
    setSeenAt(params?.at);
    if (params?.classId) setChosen(params.classId);
    if (params?.draw) setPanel('draw');
  }
  const year = academicYearOf(today);
  const withStudents = classes.filter((c) => c.students.length > 0);
  const cls =
    classes.find((c) => c.id === chosen) ??
    classes.find((c) => c.id === hubClass) ??
    withStudents.find((c) => c.year === year) ??
    withStudents[0] ??
    classes[0] ??
    null;
  const classId = cls?.id ?? null;

  const [editMode, setEditMode] = useState(false);
  const [selected, setSelected] = useState<Selection>(null);
  /** 학생 칸을 연 학생 ('자리 고치기'가 꺼져 있을 때) */
  const [focusSid, setFocusSid] = useState<string | null>(null);
  const [groupsShown, setGroupsShown] = useState<StudentGroup[] | null>(null);
  const [drawBig, setDrawBig] = useState(false);
  const [shuffleOpts, setShuffleOpts] = useState(() => readJson(SHUFFLE_KEY, { avoidPast: true, mixGender: false }));
  const [busy, setBusy] = useState(false);

  const chooseClass = (id: string) => {
    setChosen(id);
    setSelected(null);
    setFocusSid(null);
    rememberHubClass(id);
  };

  // ── 학생 ──
  const students: RosterStudent[] = [...(cls?.students ?? [])].sort((a, b) => a.num - b.num);
  const bySid = new Map(students.map((s) => [s.sid, s]));
  const active = students.filter(isActive);
  const seatStudents: SeatStudent[] = active.map((s) => ({ sid: s.sid, num: s.num, name: s.name, ...(s.gender ? { gender: s.gender } : {}) }));
  const activeIds = active.map((s) => s.sid);
  const nameOf = (id: string) => {
    const s = bySid.get(id);
    return s ? (s.name ? `${s.num}번 ${s.name}` : `${s.num}번`) : '(명렬표에 없는 학생)';
  };
  const shortName = (id: string) => bySid.get(id)?.name || nameOf(id);

  // ── 자리표·학급 허브·오늘 출결 ──
  const { charts, docs } = useSeatingCharts(classId);
  const { hub, stored: hubStored } = useClassHub(classId);
  const [chartPick, setChartPick] = useState<Record<string, string>>(() => readJson<Record<string, string>>(CHART_KEY, {}));
  const chart = charts.find((c) => c.id === (classId ? chartPick[classId] : '')) ?? charts[0] ?? null;
  const chartStored = chart ? docs[chart.id] : undefined;
  const attendance = useDocs('attendance', sid);
  const attStored = classId ? attendance[attendanceDocId(classId, today)] : undefined;
  const marks = readMarks(attStored?.records);
  const focusStudent = focusSid ? (bySid.get(focusSid) ?? null) : null;

  const chooseChart = (id: string) => {
    if (!classId) return;
    setSelected(null);
    const next = { ...readJson<Record<string, string>>(CHART_KEY, {}), [classId]: id };
    setChartPick(next);
    writeJson(CHART_KEY, next);
  };

  // ── 발표자 뽑기 ──
  const absentIds = Object.entries(marks)
    .filter(([, m]) => m.kind === 'absent')
    .map(([id]) => id);
  const draw = useStudentDraw({ sid, classId, stored: hubStored, activeNums: activeIds, absentNums: absentIds, draw: hub.draw, nameOf });
  const drawOn = panel === 'draw';
  const groupsOn = panel === 'groups';
  const groupOf = groupsOn && groupsShown ? groupIndexByNum(groupsShown) : new Map<string, number>();
  // 굴리는 동안은 방금 뽑힌 학생(판의 맨 끝)을 아직 짚지 않는다 - 멈추기 전에 답이 보이지 않게
  const drawnSet = new Set(draw.rolling ? hub.draw.picked.slice(0, -1) : hub.draw.picked);

  // ── 저장 ──
  const saveSeats = (seats: Record<string, string>) => {
    if (sid && chartStored) void updateChart(sid, chartStored, { seats }).catch(() => {});
  };
  const save = (fields: Parameters<typeof updateChart>[2]) => {
    if (sid && chartStored) void updateChart(sid, chartStored, fields).catch(() => {});
  };

  const makeChart = async () => {
    if (!sid || !classId || busy) return;
    const names = new Set(charts.map((c) => c.name));
    let n = charts.length + 1;
    while (names.has(`자리표 ${n}`)) n++;
    setBusy(true);
    try {
      const id = await createChart(sid, initialChart(classId, seatStudents, `자리표 ${n}`));
      chooseChart(id);
    } catch {
      // 안내는 저장 도우미가 했다
    } finally {
      setBusy(false);
    }
  };

  const shuffle = async () => {
    if (!sid || !chart || !chartStored || busy) return;
    if (active.length === 0) return showToast('명렬표에 재학생이 없습니다.');
    const opts = { apart: hub.apart, ...shuffleOpts };
    const result = shuffleSeats(chart, seatStudents, opts);
    setSelected(null);
    setBusy(true);
    try {
      await saveShuffled(sid, chartStored, chart, result.seats, shuffleSummary(result.cost, result.unseated.length, opts));
    } catch {
      // 안내는 저장 도우미가 했다
    } finally {
      setBusy(false);
    }
  };
  const setShuffleOpt = (key: 'avoidPast' | 'mixGender', on: boolean) => {
    const next = { ...shuffleOpts, [key]: on };
    setShuffleOpts(next);
    writeJson(SHUFFLE_KEY, next);
  };

  // ── 바꾸기 (끌어다 놓기 / 눌러서) ──
  const dropOnSeat = (source: string, key: string) => {
    if (!chart || chart.off.includes(key)) return;
    if (source.startsWith('seat:')) {
      const from = source.slice(5);
      if (from !== key) saveSeats(swapSeats(chart.seats, from, key));
    } else if (source.startsWith('student:')) {
      saveSeats(placeStudent(chart.seats, key, source.slice(8)));
    }
  };
  const dropOnUnseated = (source: string) => {
    if (chart && source.startsWith('seat:')) saveSeats(clearSeat(chart.seats, source.slice(5)));
  };
  /** 학생 칸 열기·닫기 (같은 학생을 다시 누르면 닫는다) */
  const toggleFocus = (id: string) => {
    if (!bySid.has(id)) return showToast('명렬표에 없는 학생입니다. 명렬표에서 학생을 넣거나 자리를 비워 주세요.');
    setFocusSid(focusSid === id ? null : id);
  };
  const tapSeat = (key: string) => {
    if (!chart) return;
    if (!editMode) {
      const id = chart.seats[key];
      if (id !== undefined) return toggleFocus(id);
      return showToast('자리를 바꾸려면 끌어다 놓거나, ✏️ 자리 고치기를 켜고 두 자리를 차례로 누릅니다.');
    }
    const isOff = chart.off.includes(key);
    if (!selected) return setSelected({ kind: 'seat', key });
    if (selected.kind === 'seat') {
      if (selected.key === key) return setSelected(null);
      if (isOff || chart.off.includes(selected.key)) return setSelected({ kind: 'seat', key });
      saveSeats(swapSeats(chart.seats, selected.key, key));
      return setSelected(null);
    }
    if (isOff) return setSelected({ kind: 'seat', key });
    saveSeats(placeStudent(chart.seats, key, selected.sid));
    setSelected(null);
  };
  const tapUnseated = (id: string) => {
    if (!editMode) return toggleFocus(id);
    setSelected(selected?.kind === 'student' && selected.sid === id ? null : { kind: 'student', sid: id });
  };

  // ── 그리기 ──
  const unseated = chart ? unseatedNums(chart, seatStudents) : [];
  const warn = chart ? nearApartSeats(chart.seats, hub.apart) : new Set<string>();
  const order = chart ? displayOrder(chart) : { rows: [], cols: [] };
  const hasAisle = (i: number) => {
    const c = order.cols[i];
    const next = order.cols[i + 1];
    return !!chart && next !== undefined && aisleAfter(Math.min(c, next), chart.cols, chart.groupCols);
  };
  const columnsTemplate = order.cols.flatMap((_, i) => (hasAisle(i) ? ['minmax(0,1fr)', '14px'] : ['minmax(0,1fr)'])).join(' ');
  const selectedSeat = selected?.kind === 'seat' ? selected.key : null;

  const renderSeat = (r: number, c: number) => {
    if (!chart) return null;
    const key = seatKey(r, c);
    const isOff = chart.off.includes(key);
    const isSelected = selectedSeat === key;
    if (isOff) {
      if (!editMode) return <div key={key} aria-hidden className="h-14" data-seat={key} data-seat-off />;
      return (
        <button
          key={key}
          type="button"
          data-seat={key}
          data-seat-off
          onClick={() => tapSeat(key)}
          title="책상 없음"
          className={`h-14 rounded-lg border-2 border-dashed text-slate-300 text-xs cursor-pointer ${isSelected ? 'border-primary bg-indigo-50' : 'border-slate-200'}`}
        >
          ✕
        </button>
      );
    }
    const id = chart.seats[key];
    const st = id !== undefined ? bySid.get(id) : undefined;
    const gone = id !== undefined && (!st || !isActive(st));
    const locked = chart.locked.includes(key);
    const att = id !== undefined ? marks[id] : undefined;
    const focused = !editMode && id !== undefined && focusSid === id;
    const drawnNow = drawOn && id !== undefined && draw.shown === id;
    const drawn = drawOn && id !== undefined && drawnSet.has(id);
    const groupIndex = id !== undefined ? groupOf.get(id) : undefined;
    return (
      <button
        key={key}
        type="button"
        data-seat={key}
        data-seat-sid={id ?? ''}
        data-seat-locked={locked ? '' : undefined}
        data-seat-warn={warn.has(key) ? '' : undefined}
        data-seat-drawn-now={drawnNow && !draw.rolling ? '' : undefined}
        data-seat-group={groupIndex}
        draggable={id !== undefined}
        onDragStart={(e) => {
          e.dataTransfer.setData('text/plain', `seat:${key}`);
          e.dataTransfer.effectAllowed = 'move';
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
        }}
        onDrop={(e) => {
          e.preventDefault();
          dropOnSeat(e.dataTransfer.getData('text/plain'), key);
        }}
        onClick={() => tapSeat(key)}
        aria-pressed={!editMode && id !== undefined ? focused : undefined}
        title={
          id === undefined
            ? '빈 자리'
            : `${nameOf(id)}${!st ? '' : !isActive(st) ? ' (전출)' : ''}${locked ? ' · 고정' : ''}${att ? ` · 오늘 ${KIND_LABEL[att.kind]}` : ''}`
        }
        className={`relative h-14 min-w-0 rounded-lg border px-1 flex flex-col items-center justify-center transition-colors cursor-pointer ${
          drawnNow
            ? 'border-amber-400 ring-4 ring-amber-300 bg-amber-100'
            : isSelected || focused
              ? 'border-primary ring-2 ring-primary/40 bg-indigo-50'
              : groupIndex !== undefined
                ? `${groupColor(groupIndex).seat} border-2`
                : warn.has(key)
                  ? 'border-amber-400 bg-amber-50'
                  : id === undefined
                    ? 'border-slate-200 bg-slate-50/60 hover:bg-slate-100'
                    : att
                      ? 'border-rose-300 bg-rose-50 hover:border-primary/50'
                      : 'border-slate-200 bg-white hover:border-primary/50'
        }`}
      >
        {id === undefined ? (
          <span className="text-2xs text-slate-300 font-bold">빈 자리</span>
        ) : (
          <>
            <span className={`text-2xs font-black leading-none ${st?.gender === 'M' ? 'text-sky-600' : st?.gender === 'F' ? 'text-rose-500' : 'text-slate-400'}`}>
              {st?.num ?? '?'}
              {att && (
                <span className="ml-1 text-rose-600" data-seat-att={att.kind}>
                  {KIND_LABEL[att.kind]}
                </span>
              )}
            </span>
            <span className={`w-full truncate text-center text-sm font-black leading-tight ${gone ? 'text-slate-300 line-through' : 'text-slate-800'}`}>{st?.name || (st ? `${st.num}번` : '?')}</span>
          </>
        )}
        {locked && (
          <span className="absolute top-0.5 right-1 text-2xs" aria-label="고정">
            🔒
          </span>
        )}
        {warn.has(key) && (
          <span className="absolute top-0.5 left-1 text-2xs" aria-label="떨어뜨릴 학생이 붙어 있음">
            ⚠️
          </span>
        )}
        {drawn && (
          <span className="absolute bottom-0.5 right-1 text-2xs font-black text-amber-600" aria-label="이번 판에 뽑힘" data-seat-drawn>
            ✓
          </span>
        )}
      </button>
    );
  };

  const seatActions = () => {
    if (!chart || !editMode) return null;
    if (selected?.kind === 'student') {
      return (
        <div className="flex items-center gap-2 text-xs" data-seat-actions="student">
          <span className="font-bold text-primary">{nameOf(selected.sid)}</span>
          <span className="text-slate-500">- 앉힐 자리를 누르세요.</span>
          <button type="button" data-seat-action="release" onClick={() => setSelected(null)} className="ml-auto px-2 py-1 rounded-lg bg-slate-100 font-bold cursor-pointer">
            선택 풀기
          </button>
        </div>
      );
    }
    if (!selectedSeat) {
      return <p className="text-xs text-slate-500">자리를 누른 뒤 다른 자리를 누르면 바꿉니다. 자리를 하나 누르면 고정·비우기·책상 없음도 고릅니다.</p>;
    }
    const key = selectedSeat;
    const isOff = chart.off.includes(key);
    const id = chart.seats[key];
    const locked = chart.locked.includes(key);
    const btn = 'px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 font-bold cursor-pointer';
    // 누른 뒤에는 고르기를 푼다 - 고른 채로 두면 다음에 누른 자리와 바뀐다
    const act = (fields: Parameters<typeof updateChart>[2]) => {
      save(fields);
      setSelected(null);
    };
    return (
      <div className="flex flex-wrap items-center gap-1.5 text-xs" data-seat-actions="seat">
        <span className="font-bold text-primary mr-1">{isOff ? '책상 없음' : id === undefined ? '빈 자리' : nameOf(id)}</span>
        {isOff ? (
          <button type="button" data-seat-action="on" className={btn} onClick={() => act({ off: toggleKey(chart.off, key, false) })}>
            책상 놓기
          </button>
        ) : (
          <>
            <button type="button" data-seat-action="lock" className={btn} onClick={() => act({ locked: toggleKey(chart.locked, key, !locked) })}>
              {locked ? '🔓 고정 풀기' : '🔒 고정'}
            </button>
            {id !== undefined && (
              <button type="button" data-seat-action="clear" className={btn} onClick={() => act({ seats: clearSeat(chart.seats, key) })}>
                자리 비우기
              </button>
            )}
            <button
              type="button"
              data-seat-action="off"
              className={btn}
              onClick={() => act({ seats: clearSeat(chart.seats, key), off: toggleKey(chart.off, key, true), locked: toggleKey(chart.locked, key, false) })}
            >
              책상 없애기
            </button>
          </>
        )}
        <button type="button" data-seat-action="release" onClick={() => setSelected(null)} className="ml-auto px-2 py-1 rounded-lg text-slate-500 font-bold cursor-pointer">
          선택 풀기
        </button>
      </div>
    );
  };

  const toolBtn = (on: boolean) =>
    `px-3 py-1.5 rounded-xl text-xs font-black transition-colors cursor-pointer disabled:opacity-40 ${on ? 'bg-primary text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`;
  const togglePanel = (p: Panel) => setPanel(panel === p ? null : p);
  const desk = <div className="mx-auto w-1/3 min-w-24 text-center text-2xs font-black bg-amber-100 text-amber-700 rounded-md py-1 select-none">교탁</div>;
  const waiting = (classes.length === 0 && classesStatus !== 'live') || (!!classId && charts.length === 0 && seatingStatus !== 'live');

  return (
    <ModalShell isOpen onClose={close} raise={raise} width="2xl" title="🪑 자리표" footer={<ModalCloseButton onClose={close} />}>
      {classes.length === 0 && !waiting ? (
        <p className="text-center text-slate-400 py-8 text-sm" data-seating-no-class>
          명렬표가 없습니다. 학급 화면 → 🧑‍🤝‍🧑 명렬표에서 학급과 학생을 먼저 넣어 주세요.
        </p>
      ) : (
        <div className="flex flex-col gap-3 text-sm" data-seating-window={classId ?? ''}>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={classId ?? ''}
              data-seating-class
              onChange={(e) => chooseClass(e.target.value)}
              aria-label="학급"
              className="px-2 py-1.5 border border-slate-200 rounded-lg font-bold max-w-full text-xs"
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {describeClass(c)}
                </option>
              ))}
            </select>
            {charts.length > 0 && (
              <div className="flex flex-wrap items-center gap-1" role="tablist" aria-label="자리표">
                {charts.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    role="tab"
                    data-seating-tab={c.id}
                    aria-selected={c.id === chart?.id}
                    onClick={() => chooseChart(c.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer ${c.id === chart?.id ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  >
                    {c.name}
                  </button>
                ))}
                <button type="button" data-seating-new onClick={() => void makeChart()} disabled={busy} className="px-2 py-1 rounded-lg text-xs font-bold text-primary hover:bg-indigo-50 cursor-pointer">
                  + 새 자리표
                </button>
              </div>
            )}
            <div className="ml-auto flex items-center gap-1.5">
              <button type="button" data-seating-tool="groups" onClick={() => togglePanel('groups')} aria-pressed={groupsOn} disabled={!classId} className={toolBtn(groupsOn)}>
                👥 모둠
              </button>
              <button type="button" data-seating-tool="draw" onClick={() => togglePanel('draw')} aria-pressed={drawOn} disabled={!classId} className={toolBtn(drawOn)}>
                🎯 발표자 뽑기
              </button>
            </div>
          </div>

          {groupsOn && sid && classId && (
            <SeatGroupsBox
              key={classId}
              sid={sid}
              classId={classId}
              stored={hubStored}
              sets={hub.groupSets}
              activeNums={activeIds}
              apart={hub.apart}
              chart={chart}
              nameOf={nameOf}
              onShown={setGroupsShown}
            />
          )}
          {drawOn && classId && (
            <SeatDrawBox
              shown={draw.shown}
              rolling={draw.rolling}
              status={draw.status}
              draw={hub.draw}
              nameFor={nameOf}
              onPick={draw.pick}
              onUndo={() => void draw.undo()}
              onNewRound={() => void draw.newRound()}
              onBig={() => setDrawBig(true)}
            />
          )}
          <DrawBigView
            isOpen={drawOn && drawBig}
            onClose={() => setDrawBig(false)}
            sid={draw.shown}
            num={draw.shown !== null ? (bySid.get(draw.shown)?.num ?? null) : null}
            name={draw.shown !== null ? shortName(draw.shown) : ''}
            rolling={draw.rolling}
            statusLine={drawStatusLine(hub.draw, draw.status)}
            onPick={draw.pick}
          />

          {waiting || !classId ? (
            <p className="text-center text-slate-400 py-8 text-xs" data-seating-waiting>
              불러오는 중…
            </p>
          ) : !chart ? (
            <div className="text-center py-8 flex flex-col items-center gap-3" data-seating-empty>
              <p className="text-slate-500 text-xs">이 학급의 자리표가 아직 없습니다. 번호 차례로 앉힌 자리표를 만들고, 끌어 바꾸거나 섞습니다.</p>
              <button type="button" data-seating-create onClick={() => void makeChart()} disabled={busy} className="px-4 py-2 rounded-xl bg-primary text-white font-black text-xs cursor-pointer">
                + 자리표 만들기
              </button>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-1.5">
                <button type="button" data-seating-tool="shuffle" onClick={() => void shuffle()} disabled={busy} className={toolBtn(false)}>
                  🎲 섞기
                </button>
                <button
                  type="button"
                  data-seating-tool="edit"
                  onClick={() => {
                    setEditMode(!editMode);
                    setSelected(null);
                    setFocusSid(null);
                  }}
                  aria-pressed={editMode}
                  className={toolBtn(editMode)}
                >
                  ✏️ 자리 고치기
                </button>
                <button type="button" data-seating-tool="shape" onClick={() => togglePanel('shape')} aria-pressed={panel === 'shape'} className={toolBtn(panel === 'shape')}>
                  ⚙️ 모양
                </button>
                <button type="button" data-seating-tool="apart" onClick={() => togglePanel('apart')} aria-pressed={panel === 'apart'} className={toolBtn(panel === 'apart')}>
                  🚫 떨어뜨릴 학생 {hub.apart.length > 0 && hub.apart.length}
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
                <span className="font-bold text-slate-400">섞을 때</span>
                <label className="flex items-center gap-1 cursor-pointer">
                  <input type="checkbox" data-shuffle-opt="avoidPast" checked={shuffleOpts.avoidPast} onChange={(e) => setShuffleOpt('avoidPast', e.target.checked)} />
                  지난 짝 피하기
                </label>
                <label className="flex items-center gap-1 cursor-pointer">
                  <input type="checkbox" data-shuffle-opt="mixGender" checked={shuffleOpts.mixGender} onChange={(e) => setShuffleOpt('mixGender', e.target.checked)} />
                  남녀 짝
                </label>
                <span className="text-slate-400">🔒 고정 칸은 그대로</span>
              </div>

              {panel === 'shape' && sid && chartStored && <SeatShapeBox sid={sid} chart={chart} stored={chartStored} active={seatStudents} onDeleted={() => setPanel(null)} />}
              {panel === 'apart' && sid && classId && <SeatApartBox sid={sid} classId={classId} stored={hubStored} apart={hub.apart} activeIds={activeIds} nameOf={nameOf} />}

              {editMode && <div className="rounded-lg bg-indigo-50/60 px-3 py-2">{seatActions()}</div>}
              {warn.size > 0 && (
                <p className="text-xs text-amber-700 font-bold" data-seating-warn={warn.size}>
                  ⚠️ 떨어뜨릴 학생이 붙어 앉아 있습니다. 섞거나 끌어서 떼어 주세요.
                </p>
              )}
              {!editMode && sid && cls && focusStudent && (
                <SeatStudentCard
                  key={`${cls.id}:${focusStudent.sid}`}
                  sid={sid}
                  cls={cls}
                  student={focusStudent}
                  date={today}
                  stored={attStored}
                  marks={marks}
                  periodCount={periodCount}
                  onClose={() => setFocusSid(null)}
                  onOpenRecord={() => openStudentRecord({ classId: cls.id, sid: focusStudent.sid })}
                  onOpenAttendance={() => openAttendance({ date: today, classId: cls.id })}
                />
              )}

              <div className="flex flex-col gap-1.5 mx-auto w-full max-w-[560px]" data-seating-grid={chart.id} data-front={chart.front}>
                {chart.front === 'top' && desk}
                {order.rows.map((r) => (
                  <div key={r} className="grid gap-1" style={{ gridTemplateColumns: columnsTemplate }}>
                    {order.cols.flatMap((c, i) => (hasAisle(i) ? [renderSeat(r, c), <div key={`aisle-${r}-${c}`} aria-hidden />] : [renderSeat(r, c)]))}
                  </div>
                ))}
                {chart.front === 'bottom' && desk}
              </div>

              <div
                className="rounded-xl border border-dashed border-slate-200 p-2 min-h-12"
                data-unseated={unseated.length}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  dropOnUnseated(e.dataTransfer.getData('text/plain'));
                }}
              >
                <div className="text-2xs font-black text-slate-400 mb-1">
                  자리 없는 학생 {unseated.length}명 <span className="font-bold">· 자리를 여기로 끌면 비웁니다</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {unseated.map((id) => (
                    <button
                      key={id}
                      type="button"
                      draggable
                      data-unseated-sid={id}
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', `student:${id}`);
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onClick={() => tapUnseated(id)}
                      data-seat-drawn-now={drawOn && !draw.rolling && draw.shown === id ? '' : undefined}
                      data-seat-group={groupOf.get(id)}
                      className={`px-2 py-1 rounded-lg text-xs font-bold border cursor-grab ${
                        drawOn && draw.shown === id
                          ? 'border-amber-400 ring-2 ring-amber-300 bg-amber-100 text-slate-800'
                          : (selected?.kind === 'student' && selected.sid === id) || (!editMode && focusSid === id)
                            ? 'border-primary bg-indigo-50 text-primary'
                            : groupOf.has(id)
                              ? `${groupColor(groupOf.get(id)!).seat} text-slate-700`
                              : 'border-slate-200 bg-white text-slate-700'
                      }`}
                    >
                      {drawOn && drawnSet.has(id) && (
                        <span className="mr-1 text-amber-600" data-seat-drawn>
                          ✓
                        </span>
                      )}
                      {nameOf(id)}
                      {marks[id] && <span className="ml-1 text-rose-600">{KIND_LABEL[marks[id].kind]}</span>}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-2xs text-slate-400">
                재학 {active.length}명 · 번호 색 <span className="text-sky-600 font-bold">남</span>/<span className="text-rose-500 font-bold">여</span> · 전출한 학생은 회색으로 남고 섞을 때 빠집니다. 학생 자리를 누르면 오늘 출결·관찰
                한 줄을 적습니다.
              </p>
            </>
          )}
        </div>
      )}
    </ModalShell>
  );
}
