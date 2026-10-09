// 자리표 학생 칸 (V4 components/SeatStudentCard.tsx) - '✏️ 자리 고치기'가 꺼진 채 학생 자리를 누르면 자리표 위에 뜬다.
//   - 오늘 출결: 출석부와 같은 문서(attendance/{classId}_{오늘}) - 누를 때마다 그 학생 칸만 저장(안내 없이 Ctrl+Z 더미에).
//     기록 칸의 출결 카드는 계산해 보이므로(P7-2 ■3) 따로 맞출 것이 없다.
//   - 관찰 한 줄: 개인 공간 오늘 기록에 학생을 붙여 한 줄(observation.ts) - 관찰 문구 단추를 누르면 그 문구로 곧바로.
//   - 오늘 조사표(P7-4): 지금 보는 공간의 오늘 조사표 중 이 학급 것 - 이 학생 값만 곧바로 저장(조사표 창에서 다른 학생을 적던 것을 덮지 않는다).
//     공유 그룹에서 남이 만든 조사표는 읽기만.
//   저장 순서: 사본이 쓰기를 먼저 보이므로 빨리 여러 번 눌러도 다음 누름이 앞의 것을 본다(V4의 '하나씩 차례로'가 필요 없다).
import { useState } from 'react';
import { useItemsOn, useLabelTree } from '../../data/select';
import type { Stored } from '../../data/types';
import { KINDS, KIND_HAS_PERIODS, KIND_LABEL, REASONS, REASON_LABEL, togglePeriod, withKind, type AttendanceMarks } from '../../domain/attendance';
import { shortDateLabel } from '../../domain/dateUtils';
import { isActive, type RosterStudent } from '../../domain/roster';
import { studentKeyOf } from '../../domain/studentTag';
import { saveAttendance } from '../attendance/actions';
import type { ClassItem } from '../class/classes';
import ObservationPhrases from './ObservationPhrases';
import { addObservation } from './observation';
import { useCurrentSpaceId, useSession } from '../../data/session';
import { EVAL_TYPE_LABEL, evalHasStudent, evalTextField, sortEvals, type EvalValue } from '../../domain/evaluation';
import { saveEvalStudentValue, useEvalsOn, type EvalItem } from '../evaluations/evalData';

interface Props {
  /** 개인 공간 */
  sid: string;
  cls: ClassItem;
  student: RosterStudent;
  /** 오늘 */
  date: string;
  /** 오늘 출석부 문서와 그 출결 */
  stored: Stored<'attendance'> | undefined;
  marks: AttendanceMarks;
  periodCount: number;
  onClose: () => void;
  onOpenRecord: () => void;
  onOpenAttendance: () => void;
}

export default function SeatStudentCard({ sid, cls, student, date, stored, marks, periodCount, onClose, onOpenRecord, onOpenAttendance }: Props) {
  const key = studentKeyOf(cls, student.sid);
  const record = marks[student.sid];
  const active = isActive(student);
  const [pending, setPending] = useState(0);
  const track = (p: Promise<unknown>) => {
    setPending((n) => n + 1);
    // 실패 안내는 저장 도우미가 했다
    void p.catch(() => {}).finally(() => setPending((n) => n - 1));
  };

  // ── 오늘 출결 ──
  const saveMarks = (next: AttendanceMarks) => track(saveAttendance(sid, cls.id, date, stored, marks, next, { quiet: true }));
  const [noteDraft, setNoteDraft] = useState<string | null>(null);
  const saveNote = () => {
    if (noteDraft === null) return;
    if (record && noteDraft.trim() !== (record.note || '')) saveMarks({ ...marks, [student.sid]: { ...record, note: noteDraft.trim() } });
    setNoteDraft(null);
  };

  // ── 오늘 조사표 (지금 보는 공간 - 이 학급 것) ──
  const space = useCurrentSpaceId();
  const uid = useSession((st) => st.user?.uid);
  const classEvals = sortEvals(useEvalsOn(date, space).filter((e) => e.classId === cls.id));
  const canEditEval = (e: EvalItem) => space === sid || !e.authorId || e.authorId === uid;
  const patchEval = (e: EvalItem, p: EvalValue) => {
    if (space) track(saveEvalStudentValue(space, e, student.sid, p));
  };
  /** 글 칸은 적는 동안 들고 있다가 칸을 떠날 때(Enter) 저장한다 */
  const [evalDrafts, setEvalDrafts] = useState<Record<string, string>>({});
  const saveEvalText = (e: EvalItem) => {
    const field = evalTextField(e.type);
    const d = evalDrafts[e.id];
    if (d === undefined) return;
    if (d.trim() !== (e.values[student.sid]?.[field] ?? '')) patchEval(e, { [field]: d });
    setEvalDrafts(({ [e.id]: _done, ...rest }) => rest);
  };

  // ── 관찰 한 줄 (개인 공간 오늘 기록) ──
  const tree = useLabelTree('note', sid);
  const dayNotes = useItemsOn(date, 'note', sid);
  const todayLines = dayNotes.filter((n) => !n.deletedAt && n.studentIds?.includes(key));
  const [obs, setObs] = useState('');
  const observe = (text: string = obs) => {
    if (!text.trim()) return;
    if (text === obs) setObs('');
    track(addObservation(sid, date, text, key, tree, dayNotes));
  };

  const chip = (on: boolean, tone: string) =>
    `px-2 py-1 rounded-lg border font-bold transition-colors cursor-pointer ${on ? tone : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'}`;
  const sectionTitle = 'text-2xs font-black text-slate-400 mb-1';
  const btn = 'px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 font-bold cursor-pointer';

  return (
    <div className="rounded-xl border border-primary/30 bg-white shadow-sm p-3 flex flex-col gap-3 text-xs" data-seat-student={student.sid}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className={`font-black ${student.gender === 'M' ? 'text-sky-600' : student.gender === 'F' ? 'text-rose-500' : 'text-slate-400'}`}>{student.num}번</span>
        <span className="text-base font-black text-slate-800">{student.name || '(이름 없음)'}</span>
        {pending > 0 && <span className="text-slate-400">저장 중…</span>}
        <div className="ml-auto flex items-center gap-1">
          <button type="button" data-seat-student-record onClick={onOpenRecord} className={btn}>
            🧑‍🎓 누가기록
          </button>
          <button type="button" data-seat-student-attendance onClick={onOpenAttendance} className={btn}>
            📋 출석부
          </button>
          <button
            type="button"
            data-seat-student-close
            onClick={onClose}
            aria-label="학생 칸 닫기"
            title="학생 칸 닫기"
            className="w-7 h-7 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            ✕
          </button>
        </div>
      </div>
      {student.note?.trim() && <p className="text-slate-500 -mt-2">📌 {student.note.trim()}</p>}

      {!active ? (
        <p className="text-slate-400">전출한 학생입니다. 지난 기록은 누가기록에서 봅니다.</p>
      ) : (
        <>
          <section data-seat-student-section="attendance">
            <div className={sectionTitle}>오늘 {shortDateLabel(date)} 출결</div>
            <div className="flex flex-wrap items-center gap-1">
              <button
                type="button"
                data-seat-att-kind="present"
                onClick={() => record && saveMarks(withKind(marks, student.sid, null))}
                aria-pressed={!record}
                className={chip(!record, 'bg-emerald-600 text-white border-emerald-600')}
              >
                출석
              </button>
              {KINDS.map((k) => (
                <button
                  key={k}
                  type="button"
                  data-seat-att-kind={k}
                  onClick={() => record?.kind !== k && saveMarks(withKind(marks, student.sid, k))}
                  aria-pressed={record?.kind === k}
                  className={chip(record?.kind === k, 'bg-rose-600 text-white border-rose-600')}
                >
                  {KIND_LABEL[k]}
                </button>
              ))}
            </div>
            {record && (
              <div className="flex flex-col gap-1.5 mt-1.5">
                <div className="flex flex-wrap items-center gap-1">
                  <span className="text-slate-400 mr-1">사유</span>
                  {REASONS.map((rs) => (
                    <button
                      key={rs}
                      type="button"
                      data-seat-att-reason={rs}
                      onClick={() => record.reason !== rs && saveMarks({ ...marks, [student.sid]: { ...record, reason: rs } })}
                      aria-pressed={record.reason === rs}
                      className={chip(record.reason === rs, 'bg-slate-800 text-white border-slate-800')}
                    >
                      {REASON_LABEL[rs]}
                    </button>
                  ))}
                </div>
                {KIND_HAS_PERIODS[record.kind] && (
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="text-slate-400 mr-1">교시</span>
                    {Array.from({ length: periodCount }, (_, i) => i + 1).map((p) => (
                      <button
                        key={p}
                        type="button"
                        data-seat-att-period={p}
                        onClick={() => saveMarks(togglePeriod(marks, student.sid, p))}
                        aria-pressed={!!record.periods?.includes(p)}
                        aria-label={`${p}교시`}
                        className={`w-7 h-6 rounded-md border font-bold cursor-pointer ${
                          record.periods?.includes(p) ? 'bg-rose-100 border-rose-300 text-rose-700' : 'bg-white border-slate-200 text-slate-400'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                )}
                <input
                  type="text"
                  data-seat-att-note
                  value={noteDraft ?? record.note ?? ''}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  onBlur={saveNote}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      saveNote();
                    }
                  }}
                  placeholder="사유 (예: 감기, 가족 체험학습)"
                  aria-label="출결 사유"
                  className="w-full px-2 py-1 border border-slate-200 rounded-lg"
                />
              </div>
            )}
          </section>

          <section data-seat-student-section="eval">
            <div className={sectionTitle}>오늘 조사표{space !== sid ? ' (지금 보는 그룹)' : ''}</div>
            {classEvals.length === 0 ? (
              <p className="text-slate-400">오늘 이 학급의 조사표가 없습니다.</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {classEvals.map((e) => {
                  const val = e.values[student.sid] ?? {};
                  const editable = canEditEval(e);
                  const field = evalTextField(e.type);
                  const steps = (e.steps ?? []).map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ));
                  return (
                    <div key={e.id} className="flex flex-wrap items-center gap-1.5" data-seat-eval={e.id}>
                      <span className="font-bold text-slate-700 truncate max-w-[45%]" title={e.title}>
                        {e.subject ? `${e.subject} · ` : ''}
                        {e.title || '(제목 없음)'}
                      </span>
                      <span className="text-2xs text-slate-400">{EVAL_TYPE_LABEL[e.type]}</span>
                      {!evalHasStudent(e, student.sid) ? (
                        <span className="text-slate-400">명단에 없는 학생</span>
                      ) : (
                        <>
                          {e.type === 'eval' && e.indiv && (
                            <select value={val.indiv ?? ''} data-seat-eval-indiv onChange={(ev) => patchEval(e, { indiv: ev.target.value })} disabled={!editable} aria-label={`${e.title} 개인 평가`} className="border border-slate-200 rounded-lg py-0.5 px-1">
                              <option value="">-</option>
                              {steps}
                            </select>
                          )}
                          {e.type === 'eval' && e.group && (
                            <select value={val.group ?? ''} data-seat-eval-group onChange={(ev) => patchEval(e, { group: ev.target.value })} disabled={!editable} aria-label={`${e.title} 모둠 평가`} className="border border-slate-200 rounded-lg py-0.5 px-1">
                              <option value="">모둠 -</option>
                              {(e.steps ?? []).map((st) => (
                                <option key={st} value={st}>
                                  모둠 {st}
                                </option>
                              ))}
                            </select>
                          )}
                          {e.type === 'check' && (
                            <input type="checkbox" data-seat-eval-check checked={!!val.checked} onChange={(ev) => patchEval(e, { checked: ev.target.checked })} disabled={!editable} aria-label={`${e.title} 체크`} className="w-5 h-5 accent-slate-600" />
                          )}
                          <input
                            type="text"
                            data-seat-eval-text
                            value={evalDrafts[e.id] ?? val[field] ?? ''}
                            onChange={(ev) => setEvalDrafts((d) => ({ ...d, [e.id]: ev.target.value }))}
                            onBlur={() => saveEvalText(e)}
                            onKeyDown={(ev) => {
                              if (ev.key === 'Enter' && !ev.nativeEvent.isComposing) {
                                ev.preventDefault();
                                saveEvalText(e);
                              }
                            }}
                            readOnly={!editable}
                            placeholder={e.type === 'memo' ? '메모' : '근거'}
                            aria-label={`${e.title} ${e.type === 'memo' ? '메모' : '근거'}`}
                            className="flex-1 min-w-24 px-2 py-0.5 border border-slate-200 rounded-lg"
                          />
                          {!editable && <span className="text-2xs text-slate-400">다른 사람이 만든 조사표</span>}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section data-seat-student-section="observe">
            <div className={sectionTitle}>관찰 한 줄 → 오늘 기록 (개인)</div>
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                data-seat-observe-input
                value={obs}
                onChange={(e) => setObs(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    observe();
                  }
                }}
                placeholder="예: 모둠 활동에서 친구를 잘 도움"
                aria-label="관찰 한 줄"
                className="flex-1 min-w-0 px-2 py-1 border border-slate-200 rounded-lg"
              />
              <button
                type="button"
                data-seat-observe-save
                onClick={() => observe()}
                disabled={!obs.trim()}
                className="px-2.5 py-1 rounded-lg bg-slate-800 text-white font-bold disabled:opacity-40 cursor-pointer"
              >
                기록에 남기기
              </button>
            </div>
            <ObservationPhrases onPick={(p) => observe(p)} />
            {todayLines.length > 0 && (
              <ul className="mt-1.5 flex flex-col gap-0.5 text-slate-600" data-seat-student-lines={todayLines.length}>
                {todayLines.map((n) => (
                  <li key={n.id} className="truncate" data-seat-student-line={n.id}>
                    · {(n.text ?? '').split('\n')[0]}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
