// 📊 조사표 (V4 components/EvaluationModal.tsx) - 창 'evaluation' = { sid, date, place?, slot?, evalId?, at? } (open.ts).
//   자리(교시·기록 칸) 하나로 열면: 그 자리 조사표가 하나면 곧바로 열고, 여럿이면 목록, 없으면 새로 만들기. 그날 전체로 열면(달력의 📊 n) 늘 목록부터.
//   열린 조사표: ⚙️ 기본 정보 수정(옮기면 창도 따라간다)·🖨️ 인쇄(A4 세로)·표(적은 값은 저장할 때까지 이 창에)·💾 저장(Ctrl+S)·삭제(휴지통).
//   열 때 명단을 지금 명렬표와 맞춘다(새 학생 더하기·전출 표시 - 조용히). 그룹 공간에서 남이 만든 조사표는 읽기만(V4 그대로).
import { useEffect, useRef, useState } from 'react';
import { useCommonSettings } from '../../app/prefs';
import { showToast } from '../../app/toast';
import { registerUnsavedCheck, type WindowProps } from '../../app/windows';
import { useMirrorStatus } from '../../data/select';
import { usePersonalSpaceId, useSession } from '../../data/session';
import { shortDateLabel } from '../../domain/dateUtils';
import {
  EVAL_TYPE_LABEL,
  evalPlaceLabel,
  evalPlaceOf,
  evalStudentsOf,
  evalValuesChanges,
  sortEvals,
  syncEvalStudents,
  type EvalValues,
} from '../../domain/evaluation';
import { describeClass } from '../../domain/roster';
import ModalShell from '../../ui/ModalShell';
import { printNode } from '../../ui/print';
import { useClasses } from '../class/classes';
import EvalCreateForm from './EvalCreateForm';
import EvalMetaBox, { type MetaDraft } from './EvalMetaBox';
import EvalTable from './EvalTable';
import { deleteEvaluation, saveEvalMeta, saveEvalValues, syncEvalRoster, useEvalsOn, type EvalItem, type EvalMeta } from './evalData';
import type { EvaluationParams } from './open';

type Mode = { kind: 'auto' } | { kind: 'list' } | { kind: 'create' } | { kind: 'view'; id: string };

const metaOf = (ev: EvalItem): MetaDraft => ({ title: ev.title, classId: ev.classId, date: ev.date, place: evalPlaceOf(ev), subject: ev.subject ?? '' });

export default function EvaluationWindow({ params, close, raise, setParams }: WindowProps<EvaluationParams>) {
  const { sid, date, place } = params;
  const uid = useSession((s) => s.user?.uid);
  const personal = usePersonalSpaceId();
  const evals = useEvalsOn(date, sid);
  const status = useMirrorStatus('evaluations', sid);
  const periods = useCommonSettings((s) => s.periods);
  const periodNames = periods.length ? periods.map((p) => p.name || `${p.n}교시`) : ['1교시', '2교시', '3교시', '4교시', '5교시', '6교시'];
  const { classes } = useClasses();
  const wholeDay = !place;
  const here = sortEvals(wholeDay ? evals : evals.filter((e) => evalPlaceOf(e) === place));

  // 다시 열면(다른 교시 칸의 📊·모아 보기의 머리) 고르기를 처음부터
  const [mode, setMode] = useState<Mode>({ kind: 'auto' });
  const [seenAt, setSeenAt] = useState(params.at);
  if (params.at !== seenAt) {
    setSeenAt(params.at);
    setMode({ kind: 'auto' });
  }
  const waiting = evals.length === 0 && status !== 'live';
  const viewing = (id: string | undefined) => (id ? evals.find((e) => e.id === id) : undefined);
  const shown: Mode =
    mode.kind === 'view' && viewing(mode.id)
      ? mode
      : mode.kind === 'list' || mode.kind === 'create'
        ? mode
        : viewing(params.evalId)
          ? { kind: 'view', id: params.evalId! }
          : !wholeDay && here.length === 1
            ? { kind: 'view', id: here[0].id }
            : here.length > 0
              ? { kind: 'list' }
              : { kind: 'create' };
  const ev = shown.kind === 'view' ? viewing(shown.id) : undefined;
  const canEdit = !!ev && (sid === personal || !ev.authorId || ev.authorId === uid);
  const shared = sid !== personal;

  // 적던 값 (그 조사표의 것만 - 다른 조사표로 가면 묻는다)
  const [draft, setDraft] = useState<{ id: string; values: EvalValues } | null>(null);
  const values = ev && draft?.id === ev.id ? draft.values : (ev?.values ?? {});
  const valuesDirty = !!ev && draft?.id === ev.id && Object.keys(evalValuesChanges(ev.values, draft.values)).length > 0;
  // 기본 정보 칸 (조사표가 바뀌면 그 값으로)
  const [metaOpen, setMetaOpen] = useState(false);
  const [meta, setMeta] = useState<MetaDraft | null>(null);
  const [seenEval, setSeenEval] = useState(ev?.id);
  if (ev?.id !== seenEval) {
    setSeenEval(ev?.id);
    setMeta(null);
    setMetaOpen(false);
  }
  const metaShown = meta ?? (ev ? metaOf(ev) : null);
  const metaDirty = !!ev && !!meta && JSON.stringify(meta) !== JSON.stringify(metaOf(ev));

  const unsaved = useRef<() => boolean>(() => false);
  useEffect(() => {
    unsaved.current = () => valuesDirty || metaDirty;
  }, [valuesDirty, metaDirty]);
  useEffect(() => registerUnsavedCheck(unsaved), []);

  // 열 때 명단을 지금 명렬표와 맞춘다 (내 학급 명렬표가 있을 때만 - 조용히)
  const rosterOf = ev ? classes.find((c) => c.id === ev.classId) : undefined;
  useEffect(() => {
    if (!ev || !canEdit || !rosterOf) return;
    const next = syncEvalStudents(ev.students, rosterOf.students);
    if (next) void syncEvalRoster(sid, ev, next);
  }, [ev, canEdit, rosterOf, sid]);

  const go = (next: Mode) => {
    if ((valuesDirty || metaDirty) && !window.confirm('저장하지 않은 값이 있습니다. 버리고 옮길까요?')) return;
    setDraft(null);
    setMeta(null);
    setMode(next);
  };

  const [busy, setBusy] = useState(false);
  const saveValues = async () => {
    if (!ev || !canEdit || busy) return;
    if (!valuesDirty) return showToast('바뀐 값이 없습니다.');
    setBusy(true);
    try {
      await saveEvalValues(sid, ev, values);
      setDraft(null);
    } catch {
      // 안내는 저장 도우미가 했다 - 적은 값은 그대로
    } finally {
      setBusy(false);
    }
  };

  const saveMeta = async () => {
    if (!ev || !metaShown || !canEdit || busy) return;
    if (!metaShown.title.trim()) return showToast('제목을 입력하세요.');
    const next: EvalMeta = {
      title: metaShown.title.trim(),
      subject: metaShown.subject,
      date: metaShown.date,
      period: metaShown.place === 'journal' ? null : Number(metaShown.place),
    };
    if (metaShown.classId !== ev.classId) {
      const c = classes.find((k) => k.id === metaShown.classId);
      if (!c) return showToast('대상 학급을 선택해 주세요.');
      if (!window.confirm('대상 학급을 바꾸면 새 학급의 학생 명단으로 갈아 끼웁니다.\n지금까지 적은 결과는 남지만 학생이 달라집니다.\n정말 바꾸시겠습니까?')) return;
      next.classId = c.id;
      next.students = evalStudentsOf(c.students);
    }
    const moved = metaShown.date !== ev.date || metaShown.place !== evalPlaceOf(ev);
    setBusy(true);
    try {
      // 적다 만 값도 함께 담는다 (기본 정보만 저장하고 표를 흘려보내면 적은 값이 사라진다 - V4)
      await saveEvalMeta(sid, ev, next, valuesDirty ? values : undefined);
      setDraft(null);
      setMeta(null);
      setMetaOpen(false);
      // 옮겼으면 창도 그 날·자리로 따라간다
      if (moved) setParams({ ...params, date: metaShown.date, ...(place ? { place: metaShown.place } : {}), evalId: ev.id });
    } catch {
      // 안내는 저장 도우미가 했다
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!ev || !canEdit || busy) return;
    setBusy(true);
    try {
      await deleteEvaluation(sid, ev);
      setDraft(null);
      setMode({ kind: 'auto' });
    } catch {
      // 안내는 저장 도우미가 했다
    } finally {
      setBusy(false);
    }
  };

  const tableRef = useRef<HTMLDivElement>(null);
  const print = () => {
    if (!ev || !tableRef.current) return;
    const c = classes.find((k) => k.id === ev.classId);
    printNode(tableRef.current, {
      title: `${ev.title}${ev.subject ? ` (${ev.subject})` : ''}`,
      subtitle: [c ? describeClass(c) : ev.classId, ev.date, EVAL_TYPE_LABEL[ev.type], `${ev.students.length}명`].join(' · '),
      landscape: false,
    });
  };

  const placeLabel = wholeDay ? '하루 전체' : evalPlaceLabel(place, periodNames);
  const showListButton = shown.kind !== 'list' && (wholeDay ? here.length > 0 : here.length > 1);
  const classLabelOfEval = (e: EvalItem) => {
    const c = classes.find((k) => k.id === e.classId);
    return c ? `${c.grade}학년 ${c.num}반` : e.classId;
  };

  return (
    <ModalShell
      isOpen
      onClose={close}
      raise={raise}
      width="2xl"
      title="📊 조사표"
      onSave={shown.kind === 'view' ? () => void (metaOpen && metaDirty ? saveMeta() : saveValues()) : undefined}
      headerExtra={
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400" data-eval-where>
            {shortDateLabel(date)} · {placeLabel}
          </span>
          {shown.kind !== 'create' && (
            <button type="button" data-eval-new onClick={() => go({ kind: 'create' })} className="px-3 py-1 bg-primary text-white rounded-lg text-xs font-bold cursor-pointer">
              + 새 조사표
            </button>
          )}
          {showListButton && (
            <button type="button" data-eval-list-open onClick={() => go({ kind: 'list' })} className="px-3 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold cursor-pointer">
              목록
            </button>
          )}
        </div>
      }
      footer={
        shown.kind === 'view' && ev ? (
          <div className="flex items-center justify-between w-full">
            {canEdit ? (
              <button type="button" data-eval-delete onClick={() => void remove()} disabled={busy} className="px-3 py-2 text-red-500 hover:bg-red-50 border border-red-200 rounded-xl text-xs font-bold transition-all cursor-pointer">
                삭제
              </button>
            ) : (
              <span className="text-xs text-slate-400 font-bold">다른 사람이 만든 조사표입니다</span>
            )}
            <div className="flex items-center gap-2">
              {valuesDirty && <span className="text-xs font-bold text-amber-600" data-eval-dirty>저장 전</span>}
              <button type="button" onClick={close} className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold cursor-pointer">
                닫기
              </button>
              {canEdit && (
                <button type="button" data-eval-save onClick={() => void saveValues()} disabled={busy} title="Ctrl + S 로도 저장합니다" className="px-5 py-2 bg-primary text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer">
                  💾 저장 <span className="font-normal opacity-70">(Ctrl+S)</span>
                </button>
              )}
            </div>
          </div>
        ) : undefined
      }
    >
      <div data-eval-window={`${date}|${place ?? ''}`} data-eval-mode={waiting ? 'waiting' : shown.kind}>
        {waiting ? (
          <p className="text-center text-slate-400 text-xs py-8">불러오는 중…</p>
        ) : shown.kind === 'list' ? (
          <div className="space-y-2">
            <p className="text-xs text-slate-500 font-bold mb-2.5">
              {wholeDay ? `이 날 조사표 ${here.length}건입니다. 볼 것을 고르세요.` : `${placeLabel}에 조사표가 ${here.length}건 있습니다. 볼 것을 고르세요.`}
            </p>
            {here.map((e) => (
              <button
                key={e.id}
                type="button"
                data-eval-item={e.id}
                onClick={() => go({ kind: 'view', id: e.id })}
                className="w-full text-left p-3 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-primary/30 rounded-xl transition-all cursor-pointer"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="font-bold text-sm text-slate-800">{e.title}</span>
                    <span className="block mt-0.5 text-xs text-slate-400">
                      {classLabelOfEval(e)} · {EVAL_TYPE_LABEL[e.type]}
                      {e.subject ? ` · ${e.subject}` : ''}
                      {wholeDay ? ` · ${evalPlaceLabel(evalPlaceOf(e), periodNames)}` : ''}
                    </span>
                  </div>
                  <span className="text-xs text-slate-400 shrink-0">{e.students.length}명</span>
                </div>
              </button>
            ))}
          </div>
        ) : shown.kind === 'create' ? (
          <EvalCreateForm sid={sid} date={date} place={place} slot={params.slot} onCreated={(id) => setMode({ kind: 'view', id })} />
        ) : ev && metaShown ? (
          <div data-eval-view={ev.id}>
            <div className="mb-3 min-w-0">
              <h4 className="font-black text-slate-800" data-eval-heading>
                {ev.title}
                {shared && <span className="ml-1.5 text-xs font-bold text-slate-400">{canEdit ? '(공유됨)' : '(공유됨 - 읽기전용)'}</span>}
              </h4>
              <p className="text-xs text-slate-400" data-eval-info>
                {rosterOf ? describeClass(rosterOf) : ev.classId} · {EVAL_TYPE_LABEL[ev.type]}
                {ev.subject ? ` · ${ev.subject}` : ''} · {evalPlaceLabel(evalPlaceOf(ev), periodNames)} · {ev.students.length}명
              </p>
            </div>
            {canEdit && (
              <EvalMetaBox open={metaOpen} onToggle={() => setMetaOpen((v) => !v)} meta={metaShown} onChange={setMeta} onSave={() => void saveMeta()} classes={classes} periodNames={periodNames} />
            )}
            <div className="flex justify-end -mt-1 mb-1.5">
              <button
                type="button"
                data-eval-print
                onClick={print}
                title="이 조사표를 A4 세로로 인쇄합니다 (적은 값 그대로)"
                className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-xs font-bold cursor-pointer"
              >
                🖨️ 인쇄
              </button>
            </div>
            <EvalTable ref={tableRef} ev={ev} values={values} canEdit={canEdit} onChange={(v) => setDraft({ id: ev.id, values: v })} />
          </div>
        ) : null}
      </div>
    </ModalShell>
  );
}
