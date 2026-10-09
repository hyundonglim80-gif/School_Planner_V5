// 수업 칸에 겹쳐 보이는 진도 한 줄 (V4 components/ProgressMarkLine). 하루 수업 칸·'N교시 수정' 칸이 쓴다.
//   📘 단원 · 5/12차시 · 비유 표현 · 📖 12~13쪽   🎒 준비물   [이 교시 밀기]
// 진도는 화면에만 겹친다 - 수업 칸(lessonDays)에는 쓰지 않는다. 밀기는 진도 문서의 bumps 한 칸만 바꾼다.
// 줄을 누르면 진도 관리 창이 그 진도로(과정이면 그 반 탭) 열린다.
import { useState, type MouseEvent } from 'react';
import { lessonPageLabel, type ProgressMark } from '../../domain/progress';
import { useDocs } from '../../data/select';
import { usePersonalSpaceId } from '../../data/session';
import { setProgressBump } from './actions';
import { openProgress } from './open';

interface Props {
  mark: ProgressMark;
  date: string;
  period: number;
  /** 밀기 단추를 늘 보인다 (수정 칸). 아니면 PC에서는 마우스를 올렸을 때만 (밀린 교시의 되돌리기는 늘) */
  alwaysShowAction?: boolean;
}

export default function ProgressMarkLine({ mark, date, period, alwaysShowAction = false }: Props) {
  const [busy, setBusy] = useState(false);
  const sid = usePersonalSpaceId();
  const docs = useDocs('progress', sid);
  const lesson = mark.lesson;
  const page = lessonPageLabel(lesson?.page);

  const openPlan = (e: MouseEvent) => {
    e.stopPropagation();
    openProgress({ planId: mark.planId, ...(mark.cls ? { cls: mark.cls } : {}) });
  };

  const toggle = async (e: MouseEvent) => {
    e.stopPropagation();
    const plan = docs[mark.planId];
    if (!sid || !plan || busy) return;
    setBusy(true);
    try {
      await setProgressBump(sid, plan, date, period, !mark.bumped, `${mark.key} `);
    } catch {
      // 안내는 저장 도우미가 띄웠다
    } finally {
      setBusy(false);
    }
  };

  const n = (mark.index ?? 0) + 1;
  const title = mark.bumped
    ? `${mark.key} 진도 - 이 교시는 밀어서 차시가 없습니다 (누르면 진도 관리)`
    : `${mark.key} 진도 ${n}/${mark.total}차시` +
      (lesson?.unit ? ` · ${lesson.unit}` : '') +
      (lesson?.content ? ` · ${lesson.content}` : '') +
      (page ? ` · 교과서 ${page}` : '') +
      (lesson?.supplies ? ` · 준비물 ${lesson.supplies}` : '') +
      ' (누르면 진도 관리)';

  return (
    <div data-progress-mark={mark.bumped ? 'bumped' : n} className="flex items-center gap-2 text-xs min-w-0">
      <button
        type="button"
        data-progress-mark-open
        onClick={openPlan}
        title={title}
        className="min-w-0 truncate text-left underline decoration-dotted decoration-slate-300 underline-offset-2 hover:decoration-solid"
      >
        {mark.bumped ? (
          <span className="text-amber-700 font-bold">⏭ 밀림 · 이 교시는 차시 없음</span>
        ) : (
          <span className="text-indigo-700">
            📘 {lesson?.unit && <span className="text-indigo-500">{lesson.unit} · </span>}
            <b className="tabular-nums">
              {n}/{mark.total}차시
            </b>
            {lesson?.content && ` · ${lesson.content}`}
            {page && <span data-progress-page> · 📖 {page}</span>}
          </span>
        )}
      </button>
      {!mark.bumped && lesson?.supplies && (
        <span data-progress-supplies className="shrink min-w-0 max-w-[40%] truncate text-amber-600 font-medium" title={`준비물: ${lesson.supplies}`}>
          🎒 {lesson.supplies}
        </span>
      )}
      <button
        type="button"
        data-progress-bump={mark.bumped ? 'undo' : 'bump'}
        onClick={toggle}
        disabled={busy}
        className={`ml-auto shrink-0 px-1.5 py-0.5 rounded border font-bold transition-opacity disabled:opacity-50 ${
          mark.bumped
            ? 'text-amber-700 border-amber-300 bg-amber-50 hover:bg-amber-100'
            : `text-slate-500 border-slate-200 bg-white hover:bg-slate-50 ${alwaysShowAction ? '' : 'sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100'}`
        }`}
        title={
          mark.bumped
            ? '밀기를 되돌립니다 - 뒤 차시가 한 칸씩 당겨집니다'
            : '이 교시에 수업을 못 했으면 밉니다 - 이 교시는 차시 없이 두고 뒤 차시가 한 칸씩 밀립니다'
        }
      >
        {mark.bumped ? '되돌리기' : '이 교시 밀기'}
      </button>
    </div>
  );
}

/** 이 교시에 진도가 없을 때 그 칸 글자로 진도 만들기 (V4 ProgressCreateButton) - 부르는 쪽이 개인 공간에서만 그린다 */
export function ProgressCreateButton({ subject }: { subject: string }) {
  const text = subject.trim();
  if (!text) return null;
  return (
    <button
      type="button"
      data-progress-create
      onClick={(e) => {
        e.stopPropagation();
        openProgress({ preset: text });
      }}
      title={`'${text}' 차시 목록을 넣어 시간표를 따라 몇 차시인지 보이게 합니다 (진도 관리)`}
      className="px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
    >
      📘 진도 만들기
    </button>
  );
}
