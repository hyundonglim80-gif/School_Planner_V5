// 조사표 창의 '⚙️ 기본 정보 수정' (V4 그대로 접어 두었다가 편다) - 제목·대상 학급·날짜·위치·교과. 저장은 창이 한다(Ctrl+S도).
import { badCutIndex, EVAL_SUBJECTS, parseScore } from '../../domain/evaluation';
import { describeClass } from '../../domain/roster';
import type { ClassItem } from '../class/classes';

export interface MetaDraft {
  title: string;
  classId: string;
  date: string;
  /** '3' / 'journal' */
  place: string;
  subject: string;
  /** 점수 기준 글자 (P46-2 - 기준이 있는 조사표만, 단계 수 − 1개). 단계 수·이름은 바꾸지 않는다 */
  cuts: string[];
}

interface Props {
  open: boolean;
  onToggle: () => void;
  meta: MetaDraft;
  onChange: (meta: MetaDraft) => void;
  onSave: () => void;
  classes: readonly ClassItem[];
  periodNames: readonly string[];
  /** 단계 이름 (점수 기준 줄의 이름표) */
  steps?: readonly string[];
}

const field = 'w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-blue-500';
const label = 'block text-xs font-bold text-slate-600 mb-1';

export default function EvalMetaBox({ open, onToggle, meta, onChange, onSave, classes, periodNames, steps = [] }: Props) {
  const set = (p: Partial<MetaDraft>) => onChange({ ...meta, ...p });
  const badCut = meta.cuts.length ? badCutIndex(meta.cuts.map((c) => parseScore(c))) : -1;
  const subjects = [...EVAL_SUBJECTS, ...(meta.subject && !EVAL_SUBJECTS.includes(meta.subject) ? [meta.subject] : [])];
  return (
    <div className="mb-3 border border-slate-300 rounded-xl bg-slate-50 p-3" data-eval-meta={open ? 'open' : 'closed'}>
      <button type="button" data-eval-meta-toggle onClick={onToggle} className="w-full flex items-center justify-between cursor-pointer">
        <span className="font-bold text-blue-800 text-xs">⚙️ 기본 정보 수정</span>
        <span className="text-slate-500 text-xs">{open ? '▲ 접기' : '▼ 펼치기'}</span>
      </button>
      {open && (
        <div className="flex flex-col gap-2.5 mt-3 pt-3 border-t border-dashed border-slate-300">
          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="flex-1">
              <label className={label}>조사표 제목</label>
              <input type="text" data-eval-meta-title value={meta.title} onChange={(e) => set({ title: e.target.value })} aria-label="조사표 제목" className={field} />
            </div>
            <div className="flex-1">
              <label className={label}>대상 학급(명렬표)</label>
              <select value={meta.classId} data-eval-meta-class onChange={(e) => set({ classId: e.target.value })} aria-label="대상 학급" className={field}>
                {!classes.some((c) => c.id === meta.classId) && <option value={meta.classId}>{meta.classId} (명렬표에 없음)</option>}
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {describeClass(c)} ({c.students.filter((s) => s.status !== 'out').length}명)
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="flex-1">
              <label className={label}>날짜</label>
              <input type="date" data-eval-meta-date value={meta.date} onChange={(e) => e.target.value && set({ date: e.target.value })} aria-label="날짜" className={field} />
            </div>
            <div className="flex-1">
              <label className={label}>위치</label>
              <select value={meta.place} data-eval-meta-place onChange={(e) => set({ place: e.target.value })} aria-label="위치" className={field}>
                {periodNames.map((name, i) => (
                  <option key={i} value={String(i + 1)}>
                    {name}
                  </option>
                ))}
                {/^\d+$/.test(meta.place) && Number(meta.place) > periodNames.length && <option value={meta.place}>{meta.place}교시</option>}
                <option value="journal">메모 칸 (그날 하루 화면)</option>
              </select>
            </div>
            <div className="flex-1">
              <label className={label}>교과</label>
              <select value={meta.subject} data-eval-meta-subject onChange={(e) => set({ subject: e.target.value })} aria-label="교과" className={field}>
                <option value="">선택 안함</option>
                {subjects.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {meta.cuts.length > 0 && (
            <div data-eval-meta-cuts>
              <label className={label}>점수 기준 (이상) - 저장하면 점수가 있는 학생을 새 기준으로 다시 매깁니다</label>
              <div className="flex gap-2">
                {steps.map((s, i) => (
                  <div key={i} className="flex-1 min-w-0">
                    <div className="text-2xs text-slate-500 truncate mb-0.5">{s}</div>
                    {i < meta.cuts.length ? (
                      <input
                        value={meta.cuts[i]}
                        data-eval-meta-cut={i}
                        inputMode="decimal"
                        aria-label={`${s} 기준 점수 (이상)`}
                        aria-invalid={badCut === i || undefined}
                        onChange={(e) => set({ cuts: meta.cuts.map((c, j) => (j === i ? e.target.value : c)) })}
                        className={`${field} text-right ${badCut === i ? 'border-rose-500 ring-1 ring-rose-300' : ''}`}
                      />
                    ) : (
                      <div className="py-1.5 text-xs text-slate-500">나머지</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="text-right">
            <button type="button" data-eval-meta-save onClick={onSave} className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer">
              정보 업데이트
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
