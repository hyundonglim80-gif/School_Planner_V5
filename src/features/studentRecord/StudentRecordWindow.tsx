// 🧑‍🎓 학생 기록(누가기록) (V4 components/StudentRecordModal.tsx) - 창 'studentRecord' = { classId?, sid?, at? }.
//   한 학생의 한 해: 위에 학생 카드(사진·특이사항·출결 누계·기록·조사표 수), 관찰 한 줄·관찰 문구, 아래 '기록·출결'과 '조사표' 두 갈래.
//   기록·메모 = 학생 칩(studentIds '{classId}/{sid}')이 붙은 것(개인 공간 + 지금 보는 공유 그룹 - 사본에서 고른다, V4는 글의 #태그를 범위로 다시 읽었다),
//   출결 = 출석부(개인), 교과 모드면 교과 출결도. 조사표 = 그 학급의 조사표 중 이 학생이 명단에 있는 것. 누르면 그 자리(기록 → 그날 하루 화면, 메모 → 쓰는 칸, 조사표 → 그 창).
//   학생은 학급 칩에서 고르거나 V4 태그('#26040305')로 찾는다.
import { useState } from 'react';
import { setDate, setScope } from '../../app/nav';
import { showErrorToast, showToast } from '../../app/toast';
import type { WindowProps } from '../../app/windows';
import { itemLabels, useDocs, useItemsOn, useLabelTree, type LabelTree } from '../../data/select';
import { useCurrentSpaceId, usePersonalSpaceId } from '../../data/session';
import { KINDS, KIND_LABEL, REASONS, REASON_LABEL, historyOf, tallyByStudent } from '../../domain/attendance';
import { academicYearOf, shortDateLabel } from '../../domain/dateUtils';
import { EVAL_TYPE_LABEL, evalCellText, evalHasStudent, evalPlaceOf, isEmptyCell, sortEvals, studentEvalCell } from '../../domain/evaluation';
import { classLabelOf, describeClass, isActive } from '../../domain/roster';
import { attendanceTimeline, noteTimeline, recordCopyText, sortTimeline, TIMELINE_LABEL, type TimelineItem } from '../../domain/studentRecord';
import { studentKeyOf, findStudentTags } from '../../domain/studentTag';
import { studentTotals, subjectRecordText } from '../../domain/subjectAttendance';
import ModalShell, { ModalCloseButton } from '../../ui/ModalShell';
import { copyText } from '../../ui/shareText';
import { useToday } from '../../ui/useToday';
import { rememberHubClass, useClasses, useHubClass } from '../class/classes';
import { useSpacesEvals, type SpaceEval } from '../evaluations/evalData';
import { openEvaluation } from '../evaluations/open';
import { useTeaching } from '../lessons/teaching';
import { openNotePanel } from '../notes/open';
import StudentPhoto from '../photos/StudentPhoto';
import { readOn, usePhotoTools } from '../photos/usePhotoTools';
import { requestFocus } from '../search/focus';
import ObservationPhrases from '../seating/ObservationPhrases';
import { addObservation } from '../seating/observation';
import type { StudentRecordParams } from './open';

/** 명렬표 관리의 '사진 보기' (켜 두었을 때만 드라이브에서 사진을 읽는다 - V4 그대로) */
const PHOTOS_KEY = 'sp5-roster-photos';

const labelText = (tree: LabelTree, ids: readonly string[] | undefined) =>
  itemLabels(tree, ids)
    .map((l) => l.name)
    .join(', ');

export default function StudentRecordWindow({ params, close, raise }: WindowProps<StudentRecordParams | undefined>) {
  const { classes } = useClasses();
  const hubClass = useHubClass((s) => s.id);
  const today = useToday();
  const { isClassUnit } = useTeaching();
  const personal = usePersonalSpaceId();
  const current = useCurrentSpaceId();
  const groupSpace = current && current !== personal ? current : '';

  // 학급·학생 (다시 열면 그 학급·학생으로)
  const [chosen, setChosen] = useState<string | null>(params?.classId ?? null);
  const [studentSid, setStudentSid] = useState<string | null>(params?.sid ?? null);
  const [seenAt, setSeenAt] = useState(params?.at);
  if (params?.at !== seenAt) {
    setSeenAt(params?.at);
    if (params?.classId) setChosen(params.classId);
    setStudentSid(params?.sid ?? null);
  }
  const year = academicYearOf(today);
  const withStudents = classes.filter((c) => c.students.length > 0);
  const cls = classes.find((c) => c.id === chosen) ?? classes.find((c) => c.id === hubClass) ?? withStudents.find((c) => c.year === year) ?? withStudents[0] ?? classes[0] ?? null;
  const students = [...(cls?.students ?? [])].sort((a, b) => a.num - b.num);
  const student = students.find((s) => s.sid === studentSid) ?? null;
  const key = cls && student ? studentKeyOf(cls, student.sid) : '';
  const chooseClass = (id: string) => {
    setChosen(id);
    setStudentSid(null);
    rememberHubClass(id);
  };

  // 태그로 찾기 '#26040305' (V4) - 그 학년도·학년·반의 그 번호
  const [tagInput, setTagInput] = useState('');
  const applyTag = () => {
    const t = findStudentTags(tagInput.startsWith('#') ? tagInput : `#${tagInput}`)[0];
    if (!t) return showToast('#26040305 처럼 여덟 자리로 적어 주세요.');
    const c = classes.find((k) => k.year === t.year && k.grade === t.grade && k.num === t.classNum);
    if (!c) return showToast(`명렬표에 ${t.year}학년도 ${t.grade}학년 ${t.classNum}반이 없습니다.`);
    const s = c.students.find((x) => x.num === t.num);
    if (!s) return showToast(`${describeClass(c)}에 ${t.num}번이 없습니다.`);
    chooseClass(c.id);
    setStudentSid(s.sid);
  };

  // ── 모으기 (사본에서) ──
  const myItems = useDocs('items', personal);
  const groupItems = useDocs('items', groupSpace);
  const myTree = useLabelTree('note', personal);
  const groupTree = useLabelTree('note', groupSpace);
  const attendance = useDocs('attendance', personal);
  const subjectDocs = useDocs('subjectAttendance', personal);
  const allEvals = useSpacesEvals();

  const attDays = cls ? Object.values(attendance).filter((d) => d.classId === cls.id) : [];
  const tally = student ? (tallyByStudent(attDays)[student.sid] ?? null) : null;
  const items: TimelineItem[] =
    student && cls
      ? sortTimeline([
          ...noteTimeline(Object.values(myItems).filter((d) => d.kind === 'note'), key, personal ?? '', false, (n) => labelText(myTree, (n as { labelIds?: string[] }).labelIds)),
          ...(groupSpace ? noteTimeline(Object.values(groupItems).filter((d) => d.kind === 'note'), key, groupSpace, true, (n) => labelText(groupTree, (n as { labelIds?: string[] }).labelIds)) : []),
          ...attendanceTimeline(historyOf(attDays, student.sid)),
          ...(isClassUnit
            ? (studentTotals(Object.values(subjectDocs).filter((d) => d.classId === cls.id))[student.sid]?.items ?? []).map((h) => ({
                key: `subj:${h.date}#${h.period}`,
                date: h.date,
                kind: 'subjectAttendance' as const,
                text: `${h.period}교시 ${subjectRecordText(h.record, REASON_LABEL)}`,
              }))
            : []),
        ])
      : [];
  const studentEvals = student && cls ? sortEvals(allEvals.filter((e) => e.classId === cls.id && evalHasStudent(e, student.sid))).map((ev) => ({ ev, cell: studentEvalCell(ev, student.sid) })) : [];
  const filledEvals = studentEvals.filter((e) => !isEmptyCell(e.cell)).length;
  const noteCount = items.filter((i) => i.kind === 'journal' || i.kind === 'memo').length;
  const [tab, setTab] = useState<'timeline' | 'evals'>('timeline');

  // 사진 (명렬표의 사진 보기를 켰을 때만)
  const [photosOn] = useState(() => readOn(PHOTOS_KEY));
  const panel = usePhotoTools(cls, students, photosOn);
  const photo = student ? panel.photos.photos.get(student.num) : undefined;

  // ── 관찰 한 줄 (개인 공간 오늘 기록) ──
  const todayNotes = useItemsOn(today, 'note', personal);
  const [obs, setObs] = useState('');
  const [obsBusy, setObsBusy] = useState(false);
  const observe = async (text: string = obs) => {
    if (!personal || !key || obsBusy || !text.trim()) return;
    setObsBusy(true);
    try {
      await addObservation(personal, today, text, key, myTree, todayNotes);
      if (text === obs) setObs('');
    } catch {
      // 안내는 저장 도우미가 했다
    } finally {
      setObsBusy(false);
    }
  };

  // ── 가기 ──
  const goTo = (it: TimelineItem) => {
    if (!it.itemId || !it.space) return;
    if (it.kind === 'memo') return openNotePanel({ sid: it.space, date: null, id: it.itemId });
    if (it.kind !== 'journal') return;
    setDate(it.date);
    setScope('day');
    requestFocus({ id: it.itemId, kind: 'note', date: it.date });
  };
  const openEval = (ev: SpaceEval) => openEvaluation({ sid: ev.space, date: ev.date, place: evalPlaceOf(ev), evalId: ev.id });

  const copyAll = async () => {
    if (!student || !cls) return;
    const text = recordCopyText(
      `${student.name} (${classLabelOf(cls)} ${student.num}번) 누가기록`,
      items,
      studentEvals.map(({ ev, cell }) => ({ date: ev.date, type: ev.type, subject: ev.subject, title: ev.title, cell })),
    );
    try {
      await copyText(text);
      showToast('📋 복사했습니다.');
    } catch (e) {
      showErrorToast('복사하지 못했습니다.', e);
    }
  };

  const tone = (k: TimelineItem['kind']) =>
    k === 'attendance' ? 'bg-rose-50 text-rose-700 border-rose-200' : k === 'subjectAttendance' ? 'bg-orange-50 text-orange-700 border-orange-200' : k === 'memo' ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-blue-50 text-blue-700 border-blue-200';

  return (
    <ModalShell isOpen onClose={close} raise={raise} width="2xl" title="🧑‍🎓 학생 기록(누가기록)" footer={<ModalCloseButton onClose={close} />}>
      <div className="space-y-4 text-xs text-slate-700" data-student-record={cls?.id ?? ''}>
        {classes.length === 0 ? (
          <p className="text-center text-slate-400 py-8">명렬표가 없습니다. 학급 화면 → 🧑‍🤝‍🧑 명렬표에서 학급과 학생을 먼저 넣어 주세요.</p>
        ) : (
          <>
            <div className="flex items-center gap-2 flex-wrap">
              <select value={cls?.id ?? ''} data-student-record-class onChange={(e) => chooseClass(e.target.value)} aria-label="학급" className="px-2 py-1.5 border border-slate-200 rounded-lg font-bold bg-white">
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {describeClass(c)}
                  </option>
                ))}
              </select>
              <span className="text-slate-300">또는</span>
              <input
                type="text"
                data-student-record-tag
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) applyTag();
                }}
                placeholder="#26040305"
                aria-label="학생 번호로 찾기"
                className="w-28 px-2 py-1.5 border border-slate-200 rounded-lg font-mono"
              />
              <button type="button" data-student-record-tag-find onClick={applyTag} className="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg font-bold cursor-pointer">
                찾기
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {students.map((s) => (
                <button
                  key={s.sid}
                  type="button"
                  data-student-record-pick={s.sid}
                  onClick={() => setStudentSid(s.sid)}
                  aria-pressed={studentSid === s.sid}
                  className={`px-2 py-1 rounded-lg border font-bold cursor-pointer ${
                    studentSid === s.sid ? 'bg-primary text-white border-primary' : `bg-white border-slate-200 hover:border-primary ${isActive(s) ? 'text-slate-600' : 'text-slate-300'}`
                  }`}
                >
                  {s.num} {s.name}
                </button>
              ))}
            </div>

            {!student || !cls ? (
              <p className="text-center text-slate-400 py-6">학생을 고르세요. 기록·메모를 쓸 때 '@이름'이나 🧑‍🎓 학생 고르기로 학생을 붙여 두면 여기에 모입니다.</p>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap p-3 bg-slate-50 border border-slate-200 rounded-xl" data-student-card={student.sid}>
                  <div className="flex items-start gap-3 min-w-0">
                    {photosOn && <StudentPhoto url={photo?.url} name={student.name || `${student.num}번`} size={56} loose={photo?.exact === false} />}
                    <div className="min-w-0">
                      <div className="text-sm font-black text-slate-800">
                        {student.num}번 {student.name}
                        {student.gender && <span className="ml-1 text-xs font-bold text-slate-400">{student.gender === 'M' ? '남' : '여'}</span>}
                        {!isActive(student) && <span className="ml-1 text-xs font-bold text-slate-400">(전출)</span>}
                      </div>
                      {student.note?.trim() && (
                        <div className="mt-0.5 text-slate-600" data-student-note>
                          <b className="text-slate-400">특이사항</b> {student.note}
                        </div>
                      )}
                      <div className="text-slate-500 mt-0.5" data-student-counts={`${noteCount}|${filledEvals}`}>
                        기록 {noteCount}건 · 조사표 {filledEvals}건
                        {tally &&
                          KINDS.map((k) => {
                            const n = REASONS.reduce((s, rs) => s + tally[k][rs], 0);
                            if (!n) return null;
                            const detail = REASONS.filter((rs) => tally[k][rs])
                              .map((rs) => `${REASON_LABEL[rs]} ${tally[k][rs]}`)
                              .join(', ');
                            return (
                              <span key={k}>
                                {' '}
                                · {KIND_LABEL[k]} {n} <span className="text-slate-400">({detail})</span>
                              </span>
                            );
                          })}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    data-student-record-copy
                    onClick={() => void copyAll()}
                    disabled={items.length === 0 && filledEvals === 0}
                    className="px-2 py-1 bg-white border border-slate-200 rounded-lg font-bold hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                  >
                    📋 전체 복사
                  </button>
                </div>

                <div className="p-3 border border-amber-200 bg-amber-50/40 rounded-xl" data-student-observe>
                  <div className="text-2xs font-black text-slate-400 mb-1">관찰 한 줄 → 오늘 기록 (개인)</div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      data-student-observe-input
                      value={obs}
                      onChange={(e) => setObs(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                          e.preventDefault();
                          void observe();
                        }
                      }}
                      placeholder="예: 모둠 활동에서 친구를 잘 도움"
                      aria-label="관찰 한 줄"
                      className="flex-1 min-w-0 px-2 py-1 border border-slate-200 rounded-lg bg-white"
                    />
                    <button type="button" data-student-observe-save onClick={() => void observe()} disabled={!obs.trim() || obsBusy} className="px-2.5 py-1 rounded-lg bg-slate-800 text-white font-bold disabled:opacity-40 cursor-pointer">
                      기록에 남기기
                    </button>
                  </div>
                  <ObservationPhrases onPick={(p) => void observe(p)} disabled={obsBusy} />
                </div>

                <div className="flex items-center gap-1" role="tablist" aria-label="누가기록 갈래">
                  {(
                    [
                      ['timeline', `🗓️ 기록·출결 ${items.length}`],
                      ['evals', `📊 조사표 ${studentEvals.length}`],
                    ] as const
                  ).map(([k, label]) => (
                    <button
                      key={k}
                      type="button"
                      role="tab"
                      data-student-record-tab={k}
                      aria-selected={tab === k}
                      onClick={() => setTab(k)}
                      className={`px-3 py-1.5 rounded-lg font-black cursor-pointer ${tab === k ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {tab === 'evals' ? (
                  studentEvals.length === 0 ? (
                    <p className="text-center text-slate-400 py-6">{cls.year}학년도에 이 학급으로 만든 조사표 중 이 학생이 든 것이 없습니다.</p>
                  ) : (
                    <ul className="space-y-1.5" data-student-evals>
                      {studentEvals.map(({ ev, cell }) => (
                        <li key={`${ev.space}:${ev.id}`}>
                          <button
                            type="button"
                            onClick={() => openEval(ev)}
                            title="그 조사표를 엽니다"
                            data-student-eval={ev.id}
                            className="w-full text-left p-2.5 bg-white border border-slate-200 rounded-xl hover:border-primary/40 flex items-start gap-2 cursor-pointer"
                          >
                            <div className="shrink-0 w-28 whitespace-nowrap">
                              <b className="text-slate-800">{ev.date}</b>
                              <span className="text-slate-400">{shortDateLabel(ev.date).replace(/^\d+\/\d+/, '')}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="px-1.5 py-px rounded-md font-bold border bg-violet-50 text-violet-700 border-violet-200">{EVAL_TYPE_LABEL[ev.type]}</span>
                                {ev.subject && <span className="font-bold text-slate-500">{ev.subject}</span>}
                                <span className="font-bold text-slate-800 truncate">{ev.title}</span>
                                {ev.shared && <span className="text-slate-400">👥</span>}
                              </div>
                              <p className={`mt-0.5 text-sm ${isEmptyCell(cell) ? 'text-slate-300' : 'text-slate-700 font-bold'}`} data-student-eval-value>
                                {isEmptyCell(cell) ? '안 적음' : evalCellText(cell)}
                              </p>
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )
                ) : items.length === 0 ? (
                  <p className="text-center text-slate-400 py-6">{cls.year}학년도에 이 학생이 붙은 기록과 출결 기록이 없습니다.</p>
                ) : (
                  <ol className="relative border-l-2 border-slate-200 ml-2 space-y-2" data-student-timeline={items.length}>
                    {items.map((it) => (
                      <li key={it.key} className="pl-3 relative">
                        <span className={`absolute -left-[7px] top-2 w-3 h-3 rounded-full border-2 border-white ${it.kind === 'attendance' ? 'bg-rose-500' : it.kind === 'subjectAttendance' ? 'bg-orange-400' : 'bg-primary'}`} />
                        <button
                          type="button"
                          data-student-timeline-item={it.key}
                          onClick={() => goTo(it)}
                          disabled={it.kind !== 'journal' && it.kind !== 'memo'}
                          title={it.kind === 'journal' ? '그 날 하루 화면으로 가서 짚어 줍니다' : it.kind === 'memo' ? '메모를 엽니다' : undefined}
                          className="w-full text-left p-2.5 bg-white border border-slate-200 rounded-xl hover:border-primary/40 disabled:hover:border-slate-200 disabled:cursor-default cursor-pointer"
                        >
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <b className="text-slate-800">{it.date}</b>
                            <span className="text-slate-400">{shortDateLabel(it.date).replace(/^\d+\/\d+/, '')}</span>
                            <span data-timeline-kind={it.kind} className={`px-1.5 py-px rounded-md font-bold border ${tone(it.kind)}`}>
                              {it.kind === 'memo' ? `📝 메모${it.labels ? ` · ${it.labels}` : ''}` : it.kind === 'journal' ? it.labels || '기록' : TIMELINE_LABEL[it.kind]}
                            </span>
                            {it.shared && <span className="text-slate-400">👥</span>}
                          </div>
                          <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{it.text}</p>
                        </button>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </ModalShell>
  );
}
