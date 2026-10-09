// 수업 수정 칸 'N교시 수정' (V4 components/DetailEditModal.tsx 수업 갈래). 쓰는 칸 'lesson' = { sid, date, n }.
//   과목(교과 모드는 학년-반 + 과목)·비고/준비물·수업 메모, 🔗 링크 추가·📑 연결된 링크, 📊 조사표(P7-4 - 그 교시), 📘 진도 줄·진도 만들기(개인 공간), 삭제 = 그 교시 비우기.
//   칸은 그 교시의 **지금 내용**을 따라간다 - 연 채로 하루 화면이나 다른 기기에서 고치면 칸도 바뀐다(고치는 중이면 적던 것을 둔다 - V4 10-04).
//   저장·Ctrl+S, 좁은 화면에서 배경을 누르면 고친 것을 저장하고 닫는다(닫기·✕·ESC는 저장하지 않는다).
import { useEffect, useMemo, useRef, useState } from 'react';
import { registerUnsavedCheck, type WindowProps } from '../../app/windows';
import { shortDateLabel, weekdayOf, DAY_NAMES } from '../../domain/dateUtils';
import { lessonsOn } from '../../domain/lessons';
import { periodLabel } from '../../domain/periodTimes';
import { normalizeSlotText } from '../../domain/teachingSlot';
import { useCommonSettings } from '../../app/prefs';
import { useDocs } from '../../data/select';
import { usePersonalSpaceId } from '../../data/session';
import { slotId } from '../../domain/progress';
import AutoTextarea from '../../ui/AutoTextarea';
import SidePanelFrame from '../../ui/SidePanelFrame';
import { lessonLinkId } from '../links/linkOps';
import { openLinker, openLinkViewer } from '../links/open';
import ProgressMarkLine, { ProgressCreateButton } from '../progress/ProgressMarkLine';
import { useProgressMarks } from '../progress/useProgress';
import { clearLesson, saveLesson } from './actions';
import { isEdited, type LessonEdit } from './lessonOps';
import type { LessonPanelParams } from './open';
import SlotPairInput from './SlotPairInput';
import { useSlotPairOptions, useTeaching } from './teaching';
import { useLessonSource } from './useLessons';
import { useEvalsOn } from '../evaluations/evalData';
import { openEvaluation } from '../evaluations/open';

export default function LessonPanel({ params, close, raise }: WindowProps<LessonPanelParams>) {
  const { sid, date, n } = params;
  const evalCount = useEvalsOn(date, sid).filter((e) => e.period === n).length;
  const src = useLessonSource(sid);
  const cell = useMemo(() => lessonsOn(date, src).cells.find((c) => c.n === n), [date, n, src]);
  const dayDoc = useDocs('lessonDays', sid)[date];
  const periods = useCommonSettings((s) => s.periods);
  const { isClassUnit } = useTeaching();
  const pairOptions = useSlotPairOptions(date, sid);
  const [saving, setSaving] = useState(false);
  // 진도는 개인 공간 수업으로 센다
  const inPersonal = sid === usePersonalSpaceId();
  const mark = useProgressMarks(date).marks[slotId(date, n)];

  const live: LessonEdit = { subject: cell?.subject ?? '', memo: cell?.memo ?? '', supplies: cell?.supplies ?? '' };
  // 고치기 시작하면 적던 것을 들고, 아니면 지금 내용을 따라간다
  const [typed, setTyped] = useState<LessonEdit | null>(null);
  const form = typed ?? live;
  const set = (patch: Partial<LessonEdit>) => setTyped({ ...form, ...patch });
  const subjectToSave = (text: string) => (isClassUnit ? normalizeSlotText(text) : text.trim());
  const edit: LessonEdit = { ...form, subject: subjectToSave(form.subject) };
  const changed = !!cell && isEdited(cell, edit);

  const unsaved = useRef<(() => boolean) | null>(null);
  useEffect(() => {
    unsaved.current = () => typed !== null && changed;
  });
  useEffect(() => registerUnsavedCheck(unsaved), []);

  const save = async (): Promise<boolean> => {
    if (!cell || saving) return false;
    setSaving(true);
    try {
      await saveLesson(sid, date, dayDoc, cell, edit);
      // 저장한 모양을 칸에도 (적은 '403과학'이 아니라 '4-3 과학') - 이제 지금 내용을 따라간다
      setTyped(null);
      return true;
    } catch {
      return false;
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!cell || saving) return;
    setSaving(true);
    try {
      await clearLesson(sid, date, dayDoc, cell);
      close();
    } catch {
      // 안내는 저장 도우미가 했다
    } finally {
      setSaving(false);
    }
  };

  const id = lessonLinkId(date, n);
  const title = `${periodLabel(periods, n)} 수정`;
  const linkCount = cell?.linkIds.length ?? 0;

  return (
    <SidePanelFrame
      ariaLabel={title}
      onClose={close}
      onBackdropClose={() => void (changed ? save() : Promise.resolve(true)).then((ok) => ok && close())}
      onSave={() => void save()}
      raise={raise}
    >
      <div data-lesson-panel={id} className="flex flex-col h-full min-h-0">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-slate-800">{title}</h3>
            <p className="text-xs font-bold text-primary mt-0.5 truncate">
              {shortDateLabel(date)}({DAY_NAMES[weekdayOf(date)]}) 수업{cell?.changed ? ` · 이날만 바꾼 과목 (시간표: ${cell.base || '수업 없음'})` : ''}
            </p>
          </div>
          <button type="button" data-close title="닫기" onClick={close} className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer">
            ✕
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-6 space-y-4" data-scroll-lock>
          <div className="flex flex-wrap gap-2 pb-4 border-b border-slate-100">
            <button type="button" data-lesson-panel-link onClick={() => openLinker({ sid, id })} className="px-3 py-1.5 bg-yellow-50 text-yellow-700 hover:bg-yellow-100 rounded-xl text-xs font-bold transition-colors cursor-pointer">
              🔗 링크 추가
            </button>
            {linkCount > 0 && (
              <button
                type="button"
                data-lesson-panel-links
                onClick={() => openLinkViewer({ sid, id })}
                className="px-3 py-1.5 bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                📑 연결된 링크 ({linkCount})
              </button>
            )}
            <button
              type="button"
              data-lesson-panel-evals={evalCount}
              onClick={() => openEvaluation({ sid, date, place: String(n), slot: subjectToSave(form.subject) })}
              className="px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              📊 조사표{evalCount ? ` (${evalCount})` : ''}
            </button>
            {!mark && inPersonal && <ProgressCreateButton subject={subjectToSave(form.subject)} />}
          </div>
          {mark && <ProgressMarkLine mark={mark} date={date} period={n} alwaysShowAction />}
          <div>
            <span className="block text-xs font-bold text-slate-500 mb-1">{isClassUnit ? '학년-반 · 과목' : '과목'}</span>
            {isClassUnit ? (
              <SlotPairInput
                value={form.subject}
                onValueChange={(v) => set({ subject: v })}
                classOptions={pairOptions.classes}
                subjectOptions={pairOptions.subjects}
                inputClassName="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            ) : (
              <input
                type="text"
                data-lesson-panel-subject
                value={form.subject}
                onChange={(e) => set({ subject: e.target.value })}
                placeholder="과목"
                aria-label="과목"
                autoFocus
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            )}
          </div>
          <div>
            <span className="block text-xs font-bold text-slate-500 mb-1">비고 / 준비물</span>
            <input
              type="text"
              data-lesson-panel-supplies
              value={form.supplies}
              onChange={(e) => set({ supplies: e.target.value })}
              aria-label="비고 / 준비물"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <div>
            <span className="block text-xs font-bold text-slate-500 mb-1">수업 메모</span>
            <AutoTextarea
              data-lesson-panel-memo
              value={form.memo}
              onChange={(e) => set({ memo: e.target.value })}
              aria-label="수업 메모"
              className="w-full min-h-[68px] px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50">
          <button type="button" data-lesson-panel-clear onClick={() => void remove()} disabled={saving || !cell} className="px-4 py-2 text-xs font-bold text-red-500 hover:bg-red-50 rounded-xl transition-colors cursor-pointer">
            삭제
          </button>
          <div className="flex gap-2">
            <button type="button" data-lesson-panel-close onClick={close} disabled={saving} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer">
              닫기
            </button>
            <button
              type="button"
              data-lesson-panel-save
              onClick={() => void save()}
              disabled={saving || !cell}
              className="px-5 py-2 text-sm font-bold text-white bg-primary hover:bg-blue-600 rounded-xl shadow-md transition-all disabled:opacity-50 cursor-pointer"
            >
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      </div>
    </SidePanelFrame>
  );
}
