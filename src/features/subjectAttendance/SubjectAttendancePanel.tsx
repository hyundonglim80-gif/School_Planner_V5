// 🙋 교과 출결 칸 (V4 components/SubjectAttendancePanel.tsx) - 쓰는 칸 'subjectAttendanceCell' = { classId, date, n, subject? }.
//   교과 모드 하루 수업 칸의 🙋로 연다. 그 반 그 교시에 결과·지각·조퇴를 적는다. 담임 출석부와 따로, 기록 칸에도 들어가지 않는다.
//   저장 단추가 없다 - 누를 때마다 그 학생 한 칸만 바로 저장(features/subjectAttendance/actions). 같은 날 다른 교시 칸을 함께 열어도 서로 덮지 않는다.
//   사유 글은 칸을 떠날 때(또는 Enter) 저장한다. 교과 + 담임이고 이 반이 담임반이면 그날 담임 출석부의 결석 학생을 흐리게 알려 준다(읽기만).
import { useState } from 'react';
import type { WindowProps } from '../../app/windows';
import { useDocs } from '../../data/select';
import { REASONS, REASON_LABEL, attendanceDocId, readMarks } from '../../domain/attendance';
import { shortDateLabel } from '../../domain/dateUtils';
import { classLabelOf, isActive } from '../../domain/roster';
import { SUBJECT_KINDS, SUBJECT_KIND_LABEL, periodSummary, readSubjectPeriods, subjectAttendanceDocId, type SubjectAttendanceKind, type SubjectMark } from '../../domain/subjectAttendance';
import { normalizeSlotText, parseSlot } from '../../domain/teachingSlot';
import SidePanelFrame from '../../ui/SidePanelFrame';
import { useClasses } from '../class/classes';
import { useLessonsOn } from '../lessons/useLessons';
import { useTeaching } from '../lessons/teaching';
import { saveSubjectCell } from './actions';
import { openSubjectAttendanceSummary, type SubjectAttendanceCellParams } from './open';

export default function SubjectAttendancePanel({ params, close, raise }: WindowProps<SubjectAttendanceCellParams>) {
  const { classId, date, n } = params;
  const { classes, sid } = useClasses();
  const cls = classes.find((c) => c.id === classId) ?? null;
  const label = cls ? classLabelOf(cls) : '';
  const docs = useDocs('subjectAttendance', sid);
  const stored = docs[subjectAttendanceDocId(classId, date)];
  const records = readSubjectPeriods(stored?.periods)[String(n)] ?? {};
  const { mode, preset } = useTeaching();

  // 머리줄의 과목은 그 교시 수업 칸의 지금 글자로 (연 뒤 과목을 고쳐도 따라간다 - V4 10-04). 칸의 반이 바뀌었으면 연 때의 과목
  const view = useLessonsOn(date, sid);
  const live = parseSlot(view.cells.find((c) => c.n === n)?.subject ?? '');
  const shownSubject = live.cls && live.cls === label ? live.subject : params.subject;

  // 교과 + 담임의 담임반이면 그날 담임 출석부 결석 (읽기만)
  const isHomeroom = preset === 'subjectHomeroom' && !!label && normalizeSlotText(mode.homeroomClass) === label;
  const attendance = useDocs('attendance', sid);
  const homeroomMarks = isHomeroom ? readMarks(attendance[attendanceDocId(classId, date)]?.records) : {};
  const homeroomAbsent = (cls?.students ?? []).filter((s) => homeroomMarks[s.sid]?.kind === 'absent');

  const [openNote, setOpenNote] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const save = async (student: string, rec: SubjectMark | null) => {
    if (!sid) return;
    setBusy(student);
    try {
      await saveSubjectCell(sid, classId, date, n, student, stored, records[student], rec);
    } catch {
      // 안내는 저장 도우미가 했다
    } finally {
      setBusy(null);
    }
  };
  const setKind = (student: string, kind: SubjectAttendanceKind | null) => {
    const old = records[student];
    if (!kind) return void save(student, null);
    // 사유·메모는 고른 적이 있으면 이어받는다. 처음이면 질병 (담임 출석부와 같다)
    void save(student, { kind, reason: old?.reason || 'sick', ...(old?.note ? { note: old.note } : {}) });
  };
  const patch = (student: string, p: Partial<SubjectMark>) => {
    const old = records[student];
    if (old) void save(student, { ...old, ...p });
  };
  const commitNote = (student: string) => {
    const old = records[student];
    if (old && (old.note || '') !== noteDraft.trim()) patch(student, { note: noteDraft.trim() });
  };

  const students = (cls?.students ?? []).filter((s) => isActive(s) || records[s.sid]).sort((a, b) => a.num - b.num);
  const summary = periodSummary(records);
  const chip = (on: boolean, tone: string) =>
    `px-2 py-1 rounded-lg border font-bold transition-colors cursor-pointer ${on ? tone : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'}`;

  return (
    <SidePanelFrame ariaLabel="교과 출결" onClose={close} onBackdropClose={close} raise={raise}>
      <div data-subject-att-panel={`${classId}_${date}#${n}`} className="flex flex-col h-full min-h-0">
        <div className="flex items-start justify-between gap-2 px-6 py-4 border-b border-slate-100">
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-slate-800">🙋 교과 출결</h3>
            <p className="text-xs font-bold text-primary mt-0.5 truncate" data-subject-att-title>
              {label || '반'} · {shortDateLabel(date)} {n}교시{shownSubject ? ` · ${shownSubject}` : ''} · 🔒 개인
            </p>
            <p className="text-xs text-slate-400 mt-0.5">누르는 대로 바로 저장됩니다 · 담임 출석부와 따로 둡니다</p>
          </div>
          <button
            type="button"
            data-subject-att-open-summary
            onClick={() => openSubjectAttendanceSummary({ classId })}
            title="이 반의 교과 출결 누계 (학생마다 결과·지각·조퇴)"
            className="ml-auto shrink-0 px-2.5 py-1 text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg cursor-pointer"
          >
            📊 누계
          </button>
          <button type="button" data-close title="닫기" onClick={close} className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer shrink-0">
            ✕
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-5 space-y-3 text-xs text-slate-700" data-scroll-lock>
          {!cls ? (
            <p className="text-center text-slate-400 py-8">이 반의 명렬표가 없습니다. 학급 화면 → 🧑‍🤝‍🧑 명렬표에서 학급과 학생을 먼저 넣어 주세요.</p>
          ) : (
            <>
              <span className="text-slate-500" data-subject-att-summary={summary}>
                {students.length}명 · {summary ? <b className="text-rose-600">{summary}</b> : <b className="text-emerald-700">모두 출석</b>}
              </span>
              {homeroomAbsent.length > 0 && (
                <p className="text-slate-400" data-homeroom-absent>
                  담임 출석부: 결석 {homeroomAbsent.map((s) => `${s.num}번 ${s.name}`).join(', ')}
                </p>
              )}
              <div className="border border-slate-200 rounded-xl divide-y divide-slate-100">
                {students.map((st) => {
                  const r = records[st.sid];
                  return (
                    <div key={st.sid} data-subject-att-row={st.sid} className={`px-3 py-2 ${r ? 'bg-rose-50/40' : ''}`}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="w-24 shrink-0 font-bold text-slate-800 truncate">
                          <span className="text-slate-400 mr-1">{st.num}</span>
                          {st.name || '(이름 없음)'}
                        </span>
                        <div className={`flex items-center gap-1 flex-wrap ${busy === st.sid ? 'opacity-60' : ''}`}>
                          <button type="button" data-subject-att-kind="present" onClick={() => setKind(st.sid, null)} aria-pressed={!r} className={chip(!r, 'bg-emerald-600 text-white border-emerald-600')}>
                            출석
                          </button>
                          {SUBJECT_KINDS.map((k) => (
                            <button key={k} type="button" data-subject-att-kind={k} onClick={() => setKind(st.sid, k)} aria-pressed={r?.kind === k} className={chip(r?.kind === k, 'bg-rose-600 text-white border-rose-600')}>
                              {SUBJECT_KIND_LABEL[k]}
                            </button>
                          ))}
                        </div>
                        {r && (
                          <div className="flex items-center gap-1 flex-wrap">
                            <span className="text-slate-300">|</span>
                            {REASONS.map((rs) => (
                              <button
                                key={rs}
                                type="button"
                                data-subject-att-reason={rs}
                                onClick={() => patch(st.sid, { reason: rs })}
                                aria-pressed={r.reason === rs}
                                className={chip(r.reason === rs, 'bg-slate-800 text-white border-slate-800')}
                              >
                                {REASON_LABEL[rs]}
                              </button>
                            ))}
                            <button
                              type="button"
                              data-subject-att-note-open
                              onClick={() => {
                                setOpenNote(openNote === st.sid ? null : st.sid);
                                setNoteDraft(r.note || '');
                              }}
                              className="px-2 py-1 rounded-lg border border-dashed border-slate-300 text-slate-500 hover:border-slate-500 cursor-pointer"
                            >
                              {r.note ? `📝 ${r.note}` : '＋ 사유 적기'}
                            </button>
                          </div>
                        )}
                      </div>
                      {r && openNote === st.sid && (
                        <div className="mt-1.5 pl-24">
                          <input
                            type="text"
                            data-subject-att-note
                            value={noteDraft}
                            onChange={(e) => setNoteDraft(e.target.value)}
                            onBlur={() => commitNote(st.sid)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                                commitNote(st.sid);
                                setOpenNote(null);
                              }
                            }}
                            placeholder="사유 (예: 보건실, 상담) - Enter로 저장"
                            aria-label={`${st.num}번 사유`}
                            className="w-full px-2 py-1 border border-slate-200 rounded-lg"
                            autoFocus
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
                {students.length === 0 && <p className="text-center text-slate-400 py-6">이 반에 학생이 없습니다.</p>}
              </div>
              <p className="text-slate-400">적지 않은 학생은 출석입니다. 교과 출결은 담임 출석부·기록 칸에 들어가지 않습니다 - 이 반 이 교시에만 남습니다.</p>
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-2 bg-slate-50/50">
          <button type="button" onClick={close} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer">
            닫기
          </button>
        </div>
      </div>
    </SidePanelFrame>
  );
}
