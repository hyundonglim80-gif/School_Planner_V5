// 🧑‍🤝‍🧑 명렬표 (V4 components/RosterModal.tsx - 학급 화면 안에 펼친다, MENU 3-3). 위: 학년도·학년·반 고르기 · 학급 편집 · 관리 / 검색 / 암기 탭.
//   관리: 학생 줄(번호·이름·성별·상태·특이사항·✕), 인원 + 학생 추가, 학급 하나 ↑↓ CSV, 전체 학급 ↑↓ CSV(파일에 없는 학급은 그대로), 💾 저장(Ctrl+S).
//   검색: 학년도·학년·반·번호·이름(초성)으로 모든 학급에서 - 누르면 관리 탭의 그 줄로.
//   고친 것은 💾 저장 전까지 이 탭에 남는다(학급 화면을 떠났다 와도). 저장 = 바뀐 학급만(features/class/classes).
//   📷 사진(켤 때만 드라이브를 부른다 - features/photos): 목록의 사진 칸·타일 보기·끌어다 놓기·여러 장 업로드·사진 폴더.
//   암기 탭(P7-5) = MemorizeTab. 아직 없는 것: 📊 시트 동기화·명렬표 시트(P8-3 백업 창과 함께).
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { showErrorToast, showToast } from '../../app/toast';
import { newId } from '../../data/id';
import { decodeTextBytes, parseCsv } from '../../domain/csv';
import { todayStr } from '../../domain/dateUtils';
import { matchesName, matchRange } from '../../domain/hangul';
import {
  classCsvRows,
  classesInScope,
  classIdOf,
  describeClass,
  gradeOptions,
  indexOfPick,
  isActive,
  numOptions,
  parseClassCsv,
  parseRosterCsv,
  pickOf,
  reconcilePick,
  rosterCsvRows,
  ROSTER_CSV_HEADER,
  withSids,
  yearOptions,
  type ClassPick,
  type RosterStudent,
} from '../../domain/roster';
import { downloadCsv } from '../../ui/download';
import { PhotoBulkGroup, PhotoBulkProgress, PhotoBulkReportBand, PhotoStateLine } from '../photos/PhotoParts';
import StudentPhoto from '../photos/StudentPhoto';
import { readOn, usePhotoTools, writeOn, type PhotoTools } from '../photos/usePhotoTools';
import { isSaveKey } from '../../ui/useSaveKey';
import { saveRoster, useClasses, type ClassDraft } from './classes';
import { draftActions, draftsOf, isDirty, useRosterDraft } from './rosterDraft';
import { useClassView, type RosterTab } from './view';
import MemorizeTab from './MemorizeTab';
import { quizStudentsOf } from '../quiz/usePhotoQuiz';

const TABS: Array<{ id: RosterTab; label: string }> = [
  { id: 'manage', label: '관리' },
  { id: 'search', label: '검색' },
  { id: 'memorize', label: '암기' },
];

const selectCls = 'appearance-none bg-white border border-blue-200 rounded-lg pl-2.5 pr-6 py-1.5 text-xs font-bold text-slate-700 shadow-2xs focus:outline-none focus:border-primary cursor-pointer';
/** 명렬표 관리의 사진 보기 켬/끔 - 이 기기에만 (V4 sp4-roster-photos) */
const PHOTOS_KEY = 'sp5-roster-photos';

type ListView = 'list' | 'tile';

const FIELD = 'w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-700 focus:outline-none focus:border-primary';

export default function RosterView() {
  const { classes, sid, docs } = useClasses();
  const stored = useRosterDraft((s) => s.drafts);
  const index = useRosterDraft((s) => s.index);
  const tab = useClassView((s) => s.tab);
  const drafts = useMemo(() => stored ?? draftsOf(classes), [stored, classes]);
  const act = draftActions(classes);
  const dirty = isDirty(stored, classes);
  const cur: ClassDraft = drafts[Math.min(index, drafts.length - 1)] ?? drafts[0];
  const students = cur?.students ?? [];
  const pick = pickOf(cur);
  const [editing, setEditing] = useState(false);
  const [addCount, setAddCount] = useState('');
  const [saving, setSaving] = useState(false);
  const [highlight, setHighlight] = useState<string | null>(null);
  const classInput = useRef<HTMLInputElement>(null);
  const allInput = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [showPhotos, setShowPhotos] = useState(() => readOn(PHOTOS_KEY));
  const [view, setView] = useState<ListView>('list');
  const [dragging, setDragging] = useState(false);
  const panel = usePhotoTools(cur ?? null, students, showPhotos);
  const photos = panel.photos;
  // 암기 판 후보 = 사진이 있는 재학생 (사진을 껐으면 없다)
  const quizCandidates = cur && showPhotos ? quizStudentsOf(cur, students, (st) => photos.photos.get(st.num)?.url) : [];

  // 사진을 켜는 그 자리에서 로그인까지 (누른 때가 아니면 브라우저가 로그인 창을 막는다)
  const togglePhotos = () => {
    const next = !showPhotos;
    writeOn(PHOTOS_KEY, next);
    // 사진을 끄면 타일 보기는 뜻이 없다 (빈 칸만 늘어선다)
    if (!next) setView('list');
    setShowPhotos(next);
    if (next) void panel.authorize();
  };

  // 다른 학급을 고르면 짚은 학생은 풀린다
  const [lastIndex, setLastIndex] = useState(index);
  if (lastIndex !== index) {
    setLastIndex(index);
    setHighlight(null);
  }

  const applyPick = (want: ClassPick) => {
    const at = indexOfPick(drafts, reconcilePick(drafts, want));
    if (at >= 0) act.select(at);
  };

  // 같은 학년도·학년·반이 둘이면 저장하면 하나가 사라진다 - 막는다
  const dupId = useMemo(() => {
    const seen = new Set<string>();
    for (const d of drafts) {
      const id = classIdOf(d);
      if (seen.has(id)) return id;
      seen.add(id);
    }
    return null;
  }, [drafts]);

  const save = async () => {
    if (!sid || saving) return;
    if (dupId) return showErrorToast(`같은 학급(${dupId})이 둘입니다. 학급 편집에서 학년도·학년·반을 고쳐 주세요.`);
    if (drafts.some((d) => !(d.year > 2000) || !(d.grade > 0) || !(d.num > 0))) return showErrorToast('학년도·학년·반을 숫자로 적어 주세요.');
    setSaving(true);
    try {
      const changed = await saveRoster(sid, drafts, docs);
      if (!changed) showToast('바뀐 것이 없습니다.');
      act.reset();
    } catch {
      // 안내는 저장 도우미가 했다 - 고친 것은 그대로
    } finally {
      setSaving(false);
    }
  };
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  });
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!isSaveKey(e.nativeEvent)) return;
    e.preventDefault();
    e.stopPropagation();
    void saveRef.current();
  };

  // ── CSV ──
  const downloadClass = () => {
    if (students.length === 0) return showErrorToast('내려받을 명단이 없습니다.');
    downloadCsv(classCsvRows(students), `${cur.year}년_${cur.grade}학년_${cur.num}반_명렬표.csv`);
  };
  const uploadClass = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const parsed = parseClassCsv(parseCsv(decodeTextBytes(await file.arrayBuffer())));
      if (parsed.length === 0) return showErrorToast('CSV 파일에서 학생을 찾지 못했습니다. 번호·이름 칸이 있는지 봐 주세요.');
      if (!window.confirm(`CSV에서 ${parsed.length}명을 찾았습니다. ${describeClass(cur)} 명단을 이것으로 바꿀까요?`)) return;
      act.setStudents(withSids(parsed, students, newId));
      showToast('✅ 명단을 바꿨습니다. 💾 저장을 눌러야 반영됩니다.');
    } catch (err) {
      showErrorToast('CSV를 읽지 못했습니다.', err);
    }
  };
  const downloadAll = () => {
    // 고치는 중인 것이 아니라 저장된 것을 담는다(파일과 계정이 같은 것을 담게 - V4)
    const rows = rosterCsvRows(classes);
    if (rows.length <= 1) return showErrorToast('내보낼 명단이 없습니다.');
    downloadCsv(rows, `School_Planner_명렬표_전체_${todayStr()}.csv`);
    showToast(`✅ 학급 ${classes.length}개, 학생 ${rows.length - 1}명을 CSV로 내보냈습니다.`);
  };
  const uploadAll = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const table = parseCsv(decodeTextBytes(await file.arrayBuffer()));
      const header = (table[0] ?? []).map((h) => String(h ?? '').trim());
      if (!['학년도', '학년', '반', '번호', '이름'].every((k) => header.includes(k))) {
        return showErrorToast(`전체 학급 CSV가 아닙니다. 머리말에 ${ROSTER_CSV_HEADER.join(', ')}가 있어야 합니다. 한 학급짜리 파일은 옆의 [↑ CSV]로 넣어 주세요.`);
      }
      const { classes: incoming, skipped } = parseRosterCsv(table);
      if (incoming.length === 0) return showErrorToast('CSV에서 학생을 찾지 못했습니다. 번호·이름·학년·반이 채워져 있는지 확인해 주세요.');
      const summary = incoming.map((c) => `${describeClass(c)} (${c.students.length}명)`).join('\n');
      if (!window.confirm(`다음 학급의 명단을 파일 내용으로 바꿉니다.\n\n${summary}\n\n파일에 없는 학급은 그대로 둡니다. 계속할까요?`)) return;
      act.mergeClasses(
        incoming.map((c) => {
          const same = drafts.find((d) => classIdOf(d) === classIdOf(c));
          return { year: c.year, grade: c.grade, num: c.num, students: withSids(c.students, same?.students ?? [], newId) };
        }),
      );
      const n = incoming.reduce((sum, c) => sum + c.students.length, 0);
      showToast(`✅ 학급 ${incoming.length}개, 학생 ${n}명을 넣었습니다.${skipped > 0 ? ` (읽지 못한 줄 ${skipped}개는 건너뛰었습니다)` : ''} 💾 저장을 눌러야 반영됩니다.`);
    } catch (err) {
      showErrorToast('CSV를 읽는 중 오류가 났습니다.', err);
    }
  };

  const removeClass = () => {
    const ok = drafts.length <= 1 ? window.confirm('모든 학급 정보를 비울까요? (💾 저장을 눌러야 반영됩니다)') : window.confirm(`[${describeClass(cur)}] 학급을 지울까요? (💾 저장하면 휴지통으로 갑니다)`);
    if (!ok) return;
    act.removeClass();
    setEditing(drafts.length <= 1);
  };

  const openFromSearch = (classIndex: number, student: RosterStudent) => {
    act.select(classIndex);
    useClassView.setState({ tab: 'manage' });
    setHighlight(student.sid);
    setLastIndex(classIndex);
  };

  const activeCount = students.filter(isActive).length;

  return (
    <div ref={rootRef} onKeyDown={onKeyDown} className="bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col" data-roster={classIdOf(cur)}>
      {/* 왼쪽 학년도·학년·반, 오른쪽 세 탭 */}
      <div className="flex items-center justify-between gap-2.5 px-4 py-2.5 bg-blue-50 border-b border-blue-100 flex-wrap">
        <div className="flex items-center gap-1.5">
          {(
            [
              ['year', yearOptions(drafts), '학년도', (v: string) => `${v}학년도`],
              ['grade', gradeOptions(drafts, pick.year), '학년', (v: string) => `${v}학년`],
              ['num', numOptions(drafts, pick.year, pick.grade), '반', (v: string) => `${v}반`],
            ] as const
          ).map(([key, options, title, label]) => (
            <div key={key} className="relative">
              <select value={pick[key]} data-roster-pick={key} onChange={(e) => applyPick({ ...pick, [key]: e.target.value })} className={selectCls} title={title} aria-label={title}>
                {options.map((v) => (
                  <option key={v} value={v}>
                    {label(v)}
                  </option>
                ))}
              </select>
              <span className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">▾</span>
            </div>
          ))}
          <button
            type="button"
            data-roster-edit
            aria-pressed={editing}
            onClick={() => setEditing((v) => !v)}
            title="학급을 더하거나 지우고, 학년·반 숫자를 고칩니다"
            className={`border rounded-lg px-2.5 py-1.5 text-xs font-bold transition-colors cursor-pointer ${editing ? 'bg-primary text-white border-primary' : 'bg-transparent text-primary border-blue-200 hover:bg-blue-100'}`}
          >
            학급 편집
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            data-roster-photos
            aria-pressed={showPhotos}
            onClick={togglePhotos}
            title={showPhotos ? '사진 칸을 감추고 구글 드라이브를 부르지 않습니다' : '사진 칸을 내고 구글 드라이브에서 사진을 불러옵니다'}
            className={`rounded-lg px-2.5 py-1.5 text-xs font-bold border transition-colors cursor-pointer ${showPhotos ? 'bg-primary text-white border-primary' : 'bg-white text-slate-600 border-blue-200 hover:bg-blue-100'}`}
          >
            📷 사진
          </button>
        <div className="flex gap-1 bg-blue-100 rounded-xl p-1" role="tablist" aria-label="명렬표">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              data-roster-tab={t.id}
              onClick={() => useClassView.setState({ tab: t.id })}
              className={`rounded-lg px-6 py-1.5 text-xs font-extrabold transition-colors cursor-pointer ${tab === t.id ? 'bg-white text-primary shadow-2xs' : 'bg-transparent text-slate-500 hover:text-slate-700'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        </div>
      </div>

      {/* 학급 편집 - 누를 때만 펼친다 */}
      {editing && (
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-col gap-2" data-roster-class-editor>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-2xs font-extrabold text-slate-500 tracking-wide">지금 고른 학급의 학년도·학년·반을 고칩니다</span>
            <div className="flex items-center gap-1.5">
              <button type="button" data-roster-add-class onClick={act.addClass} className="px-2.5 py-1.5 bg-primary hover:bg-primary/90 text-white rounded-lg text-xs font-bold shadow-2xs cursor-pointer">
                + 새 학급 추가
              </button>
              <button type="button" data-roster-delete-class onClick={removeClass} className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-lg text-xs font-bold cursor-pointer">
                학급 삭제
              </button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {(
              [
                ['year', '학년도'],
                ['grade', '학년'],
                ['num', '반'],
              ] as const
            ).map(([field, label]) => (
              <label key={field} className="block">
                <span className="block text-2xs font-bold text-slate-500 mb-1">{label}</span>
                <input
                  type="number"
                  data-roster-meta={field}
                  value={cur[field] || ''}
                  onChange={(e) => act.setMeta(field, parseInt(e.target.value, 10) || 0)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-700 focus:outline-none focus:border-primary"
                />
              </label>
            ))}
          </div>
          {dupId && <p className="text-2xs font-bold text-red-600">같은 학급({dupId})이 둘입니다 - 저장하기 전에 고쳐 주세요.</p>}
          <p className="text-2xs text-slate-400 font-semibold">
            학년도·학년·반을 고치면 새 학급으로 옮겨 저장합니다(학생은 그대로). 사진 폴더 이름(2026-3-2)도 달라지니 드라이브의 폴더 이름도 함께 바꿔 주세요.
          </p>
        </div>
      )}

      <div className="px-4 py-3.5 flex flex-col gap-2.5">
        {tab === 'manage' && (
          <>
            <div className="flex items-center justify-between gap-1.5 flex-wrap">
              <div className="text-xs text-slate-600 font-bold" data-roster-count={students.length}>
                총 <span className="text-primary font-extrabold">{students.length}</span>명 (재학 <span className="text-emerald-600">{activeCount}</span>명
                {students.length - activeCount > 0 && <span className="text-slate-400">, 전출 {students.length - activeCount}명</span>})
                {showPhotos && photos.status === 'ready' && students.length > 0 && (
                  <span className="text-slate-400 font-semibold" data-roster-photo-count={students.length - photos.missing.length}>
                    {' '}
                    · 사진 {students.length - photos.missing.length}/{students.length}명
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {showPhotos && (
                  <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
                    {(['list', 'tile'] as const).map((v) => (
                      <button
                        key={v}
                        type="button"
                        data-roster-view={v}
                        aria-pressed={view === v}
                        onClick={() => setView(v)}
                        className={`rounded-md px-2.5 py-1 text-xs font-bold transition-colors cursor-pointer ${view === v ? 'bg-white text-slate-800 shadow-2xs' : 'text-slate-500'}`}
                      >
                        {v === 'list' ? '목록' : '타일'}
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-1 bg-slate-100 rounded-lg px-1.5 py-1">
                  <input type="file" accept=".csv,text/csv" ref={classInput} onChange={(e) => void uploadClass(e)} className="hidden" data-roster-csv-input />
                  <button type="button" data-roster-csv-up onClick={() => classInput.current?.click()} title="이 학급 명단을 CSV에서 올립니다" className="px-2 py-0.5 bg-white text-slate-700 border border-slate-300 rounded text-xs font-bold hover:bg-slate-50 cursor-pointer">
                    ↑ CSV
                  </button>
                  <button type="button" data-roster-csv-down onClick={downloadClass} title="지금 고른 학급만 CSV로 내려받기" className="px-2 py-0.5 bg-white text-slate-700 border border-slate-300 rounded text-xs font-bold hover:bg-slate-50 cursor-pointer">
                    ↓ CSV
                  </button>
                </div>
                <div className="flex items-center gap-1 bg-amber-50 border border-amber-200 rounded-lg px-1.5 py-1">
                  <span className="text-2xs font-bold text-amber-700 px-0.5">전체 학급</span>
                  <input type="file" accept=".csv,text/csv" ref={allInput} onChange={(e) => void uploadAll(e)} className="hidden" data-roster-all-csv-input />
                  <button type="button" data-roster-all-csv-up onClick={() => allInput.current?.click()} title="모든 학급이 담긴 CSV를 올립니다. 파일에 없는 학급은 그대로 둡니다." className="px-2 py-0.5 bg-white text-amber-800 border border-amber-300 rounded text-xs font-bold hover:bg-amber-100 cursor-pointer">
                    ↑ CSV
                  </button>
                  <button type="button" data-roster-all-csv-down onClick={downloadAll} title="모든 학급의 명단을 한 파일로 (학년도, 학년, 반, 번호, 이름, 성별, 상태, 특이사항)" className="px-2 py-0.5 bg-white text-amber-800 border border-amber-300 rounded text-xs font-bold hover:bg-amber-100 cursor-pointer">
                    ↓ CSV
                  </button>
                </div>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min="1"
                    max="50"
                    data-roster-add-count
                    value={addCount}
                    onChange={(e) => setAddCount(e.target.value)}
                    placeholder="인원"
                    aria-label="더할 인원"
                    className="w-14 px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-center focus:outline-none"
                  />
                  <button
                    type="button"
                    data-roster-add-students
                    onClick={() => {
                      act.addStudents(parseInt(addCount, 10) || 1);
                      setAddCount('');
                    }}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold border border-slate-200 cursor-pointer"
                  >
                    + 학생 추가
                  </button>
                </div>
                <button
                  type="button"
                  data-roster-clear
                  onClick={() => {
                    if (students.length === 0) return showErrorToast('지울 학생이 없습니다.');
                    if (window.confirm('이 학급의 학생을 모두 지울까요? (💾 저장을 눌러야 반영됩니다)')) act.setStudents([]);
                  }}
                  className="px-2.5 py-1 bg-white hover:bg-red-50 text-red-500 rounded-lg text-xs font-bold border border-red-200 cursor-pointer"
                >
                  전체 삭제
                </button>
                {showPhotos && <PhotoBulkGroup panel={panel} />}
              </div>
            </div>
            {/* 목록·타일 위로 사진을 끌어다 놓아도 올라간다 (폴더에서 끌어 오는 쪽이 자연스럽다 - V4) */}
            <div
              data-roster-drop={dragging ? 'over' : ''}
              onDragOver={(e) => {
                if (!showPhotos || !e.dataTransfer.types.includes('Files')) return;
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={(e) => {
                // 자식 위로 옮겨 갈 때도 leave가 난다 - 실제로 벗어났을 때만 끈다
                if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                setDragging(false);
              }}
              onDrop={(e) => {
                if (!showPhotos || !e.dataTransfer.types.includes('Files')) return;
                e.preventDefault();
                setDragging(false);
                void panel.bulkUpload(Array.from(e.dataTransfer.files));
              }}
              className={`relative rounded-xl transition-colors ${dragging ? 'ring-2 ring-primary ring-offset-2 bg-blue-50/40' : ''}`}
            >
              {dragging && (
                <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-blue-50/80 pointer-events-none">
                  <span className="text-sm font-extrabold text-primary">여기에 놓으면 파일 이름으로 학생을 찾아 올립니다</span>
                </div>
              )}
              <StudentTable
                students={students}
                highlight={highlight}
                view={view}
                panel={showPhotos ? panel : null}
                onChange={act.setStudent}
                onRemove={(row) => {
                  const st = students[row];
                  act.removeStudent(row);
                  showToast(`🗑️ '${st.name || `${st.num}번`}' 학생을 지웠습니다. 💾 저장해야 반영됩니다.`);
                }}
              />
            </div>
            {showPhotos && (
              <>
                <PhotoBulkProgress panel={panel} />
                <PhotoBulkReportBand panel={panel} />
                <PhotoStateLine panel={panel} count={students.length} />
              </>
            )}
          </>
        )}
        {tab === 'search' && <RosterSearch drafts={drafts} pick={pick} onOpen={openFromSearch} photos={showPhotos && photos.status === 'ready' ? photos.photos : null} />}
        {tab === 'memorize' && (
          <div className="flex flex-col gap-2.5" data-roster-memorize>
            {/* 사진 없이는 얼굴을 보고 이름을 맞힐 수가 없다 - 꺼져 있으면 켜는 단추부터 (V4 그대로) */}
            {!showPhotos && (
              <div className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 border border-slate-200 bg-slate-50 flex-wrap" data-memorize-photos-off>
                <span className="text-2xs font-bold text-slate-600">사진 보기가 꺼져 있습니다. 얼굴이 있어야 이름을 맞힐 수 있습니다.</span>
                <button type="button" data-memorize-photos-on onClick={togglePhotos} className="px-2.5 py-1 bg-primary hover:bg-primary/90 rounded text-2xs font-bold text-white transition-colors cursor-pointer">
                  사진 켜기
                </button>
              </div>
            )}
            {showPhotos && quizCandidates.length === 0 && <PhotoStateLine panel={panel} count={students.length} />}
            <MemorizeTab
              cls={cur ?? null}
              classes={drafts}
              photosOn={showPhotos}
              candidates={quizCandidates}
              withoutPhoto={students.filter((s) => isActive(s) && !photos.photos.has(s.num)).length}
            />
          </div>
        )}
      </div>

      <div className="px-4 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-2">
        <button
          type="button"
          data-roster-photo-folder
          onClick={() => void panel.openPhotoFolder()}
          title={photos.folder ? `드라이브에서 ${photos.folder.name || '사진 폴더'}를 엽니다` : '구글 드라이브에서 이 학급의 사진 폴더를 엽니다'}
          className="mr-auto bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
        >
          📁 사진 폴더
        </button>
        {dirty && (
          <span className="text-xs font-bold text-amber-600" data-roster-dirty>
            저장하지 않은 것이 있습니다
          </span>
        )}
        {dirty && (
          <button
            type="button"
            data-roster-discard
            onClick={() => window.confirm('고친 것을 버리고 저장된 명렬표로 돌아갈까요?') && act.reset()}
            className="px-3 py-2 text-xs font-bold text-slate-500 hover:bg-slate-200/60 rounded-xl cursor-pointer"
          >
            되돌리기
          </button>
        )}
        <button
          type="button"
          data-roster-save
          onClick={() => void save()}
          disabled={saving}
          title="저장 (Ctrl+S)"
          className="px-5 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
        >
          💾 {saving ? '저장 중...' : '저장'}
        </button>
      </div>
    </div>
  );
}

/** 관리 탭의 학생 줄 (V4 RosterManageTab - 목록 / 타일, 사진은 켰을 때만) */
function StudentTable({
  students,
  highlight,
  view,
  panel,
  onChange,
  onRemove,
}: {
  students: RosterStudent[];
  highlight: string | null;
  view: ListView;
  /** 사진 보기를 켰을 때만 - 꺼져 있으면 사진 칸 자체가 없다 */
  panel: PhotoTools | null;
  onChange: (row: number, patch: Partial<RosterStudent>) => void;
  onRemove: (row: number) => void;
}) {
  if (students.length === 0) {
    return <div className="border border-slate-200 rounded-xl py-10 text-center text-xs text-slate-400 font-semibold">등록된 학생이 없습니다. 위의 '+ 학생 추가'나 CSV로 넣으세요.</div>;
  }
  const photoOf = (st: RosterStudent) => panel?.photos.photos.get(st.num);
  const photoProps = (st: RosterStudent) => {
    const photo = photoOf(st);
    return {
      url: photo?.url,
      name: st.name,
      canUpload: true,
      uploading: panel?.photos.uploading === st.num,
      onUpload: (file: File) => void panel?.upload(st, file),
      loose: photo?.exact === false,
      onOpen: photo?.url && panel ? () => panel.openViewer(st, photo.url) : undefined,
    };
  };

  if (view === 'tile' && panel) {
    // 휴대폰에서 여섯 칸이면 한 칸이 55px이라 얼굴도 이름도 못 읽는다 - 세 칸 (V4)
    return (
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2" data-roster-tiles>
        {students.map((st, row) => (
          <div
            key={st.sid}
            data-roster-tile={row}
            data-sid={st.sid}
            className={`border rounded-xl overflow-hidden bg-white shadow-2xs transition-all ${highlight === st.sid ? 'border-primary ring-2 ring-primary/20' : 'border-slate-200'} ${!isActive(st) ? 'opacity-45' : ''}`}
          >
            <div className="relative">
              <StudentPhoto {...photoProps(st)} shape="card" onPickDrive={() => void panel.pickDrive(st)} />
              {!isActive(st) && <span className="absolute top-1.5 left-1.5 bg-slate-600/90 text-white text-2xs font-bold rounded px-1.5 py-0.5">전출</span>}
            </div>
            <div className="flex items-center gap-1 px-1.5 py-1.5 sm:gap-1.5 sm:px-2">
              <span className="bg-blue-50 text-primary rounded text-2xs font-extrabold px-1 sm:px-1.5 py-0.5 shrink-0">{st.num}</span>
              <input
                type="text"
                data-student-field="name"
                value={st.name}
                onChange={(e) => onChange(row, { name: e.target.value })}
                aria-label="이름"
                className="min-w-0 flex-1 bg-transparent text-xs font-extrabold text-slate-800 focus:outline-none focus:bg-slate-50 rounded px-0.5"
              />
              <button type="button" data-roster-remove={row} onClick={() => onRemove(row)} title="삭제" aria-label="삭제" className="text-slate-300 hover:text-red-500 font-black text-xs cursor-pointer shrink-0">
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  }

  const input = 'bg-white border border-slate-200 rounded px-2 py-1 focus:outline-none focus:border-primary';
  return (
    <div className="border border-slate-200 rounded-xl overflow-x-auto shadow-2xs">
      <table className="w-full text-xs text-left border-collapse" data-roster-table>
        <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
          <tr>
            {panel && <th className="p-2.5 text-center w-13">사진</th>}
            <th className="p-2.5 text-center w-16">번호</th>
            <th className="p-2.5 w-28">이름</th>
            <th className="p-2.5 text-center w-17">성별</th>
            <th className="p-2.5 text-center w-19">상태</th>
            <th className="p-2.5">특이사항</th>
            <th className="p-2.5 text-center w-9" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {students.map((st, row) => (
            <tr key={st.sid} data-roster-row={row} data-sid={st.sid} className={`${highlight === st.sid ? 'bg-blue-50' : 'hover:bg-slate-50/80'} ${!isActive(st) ? 'opacity-50 bg-slate-100' : ''}`}>
              {panel && (
                <td className="p-1.5">
                  <div className="flex items-center justify-center">
                    <StudentPhoto {...photoProps(st)} shape="circle" size={32} />
                  </div>
                </td>
              )}
              <td className="p-1.5 text-center">
                <input type="number" data-student-field="num" value={st.num || ''} onChange={(e) => onChange(row, { num: parseInt(e.target.value, 10) || 0 })} aria-label="번호" className={`${input} no-spinner w-12 text-center font-bold text-slate-700`} />
              </td>
              <td className="p-1.5">
                <input type="text" data-student-field="name" value={st.name} placeholder="이름" onChange={(e) => onChange(row, { name: e.target.value })} aria-label="이름" className={`${input} w-full font-bold text-slate-800`} />
              </td>
              <td className="p-1.5 text-center">
                <select data-student-field="gender" value={st.gender || ''} onChange={(e) => onChange(row, { gender: e.target.value })} aria-label="성별" className={`${input} text-slate-700`}>
                  <option value="">-</option>
                  <option value="M">남</option>
                  <option value="F">여</option>
                </select>
              </td>
              <td className="p-1.5 text-center">
                <select
                  data-student-field="status"
                  value={st.status}
                  onChange={(e) => onChange(row, e.target.value === 'out' ? { status: 'out', outDate: st.outDate || todayStr() } : { status: 'active', outDate: undefined })}
                  aria-label="상태"
                  className={`border rounded px-1.5 py-1 font-bold focus:outline-none ${isActive(st) ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-200 text-slate-600 border-slate-300'}`}
                >
                  <option value="active">재학</option>
                  <option value="out">전출</option>
                </select>
              </td>
              <td className="p-1.5">
                <input type="text" data-student-field="note" value={st.note ?? ''} onChange={(e) => onChange(row, { note: e.target.value })} placeholder="특이사항, 조사표 내용, 상담 기록..." aria-label="특이사항" className={`${input} w-full text-slate-600`} />
              </td>
              <td className="p-1.5 text-center">
                <button type="button" data-roster-remove={row} onClick={() => onRemove(row)} title="삭제" aria-label="삭제" className="text-slate-300 hover:text-red-500 font-black p-1 cursor-pointer">
                  ✕
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** 이름에서 맞은 자리만 노랗게 */
function HighlightedName({ name, query }: { name: string; query: string }) {
  const range = matchRange(name, query);
  if (!range) return <>{name}</>;
  return (
    <>
      {name.slice(0, range.start)}
      <mark className="bg-amber-200 text-amber-900 rounded-xs px-px">{name.slice(range.start, range.end)}</mark>
      {name.slice(range.end)}
    </>
  );
}

/** 검색 탭 (V4 RosterSearchTab) - 학년도·학년·반·번호·이름(초성) */
function RosterSearch({
  drafts,
  pick,
  onOpen,
  photos,
}: {
  drafts: ClassDraft[];
  pick: ClassPick;
  onOpen: (classIndex: number, student: RosterStudent) => void;
  /** 위에서 고른 학급의 사진 (사진 보기를 켜고 다 받았을 때만) - 다른 학급은 사진 없이 */
  photos: ReadonlyMap<number, { url: string; exact: boolean }> | null;
}) {
  const [scope, setScope] = useState<ClassPick>(pick);
  const [num, setNum] = useState('');
  const [name, setName] = useState('');
  const [activeOnly, setActiveOnly] = useState(true);
  const [hideNames, setHideNames] = useState(false);
  // 위에서 학급을 바꾸면 검색 칸도 따라간다
  const pickKey = `${pick.year}|${pick.grade}|${pick.num}`;
  const pickKeyId = `${pick.year}-${pick.grade}-${pick.num}`;
  const [lastPickKey, setLastPickKey] = useState(pickKey);
  if (lastPickKey !== pickKey) {
    setLastPickKey(pickKey);
    setScope(pick);
  }
  const filtering = num.trim() !== '' || name.trim() !== '';
  const groups = classesInScope(drafts, scope)
    .map((cls) => ({
      cls,
      hits: cls.students.filter((st) => (!activeOnly || isActive(st)) && (!num.trim() || String(st.num) === num.trim()) && (!name.trim() || matchesName(st.name, name))).sort((a, b) => a.num - b.num),
    }))
    .filter((g) => g.hits.length > 0)
    .sort((a, b) => b.cls.year - a.cls.year || a.cls.grade - b.cls.grade || a.cls.num - b.cls.num);
  const total = groups.reduce((n, g) => n + g.hits.length, 0);
  const sel = (key: keyof ClassPick, options: string[], label: string, reset: Partial<ClassPick>) => (
    <label className="flex flex-col gap-1 w-20">
      <span className="text-2xs font-bold text-slate-500 pl-0.5">{label}</span>
      <select value={scope[key]} data-search-pick={key} onChange={(e) => setScope({ ...scope, ...reset, [key]: e.target.value })} className={FIELD}>
        <option value="">전체</option>
        {options.map((v) => (
          <option key={v} value={v}>
            {v}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <div className="flex flex-col gap-2.5" data-roster-search>
      <div className="flex items-end gap-2 flex-wrap">
        {sel('year', yearOptions(drafts), '학년도', { grade: '', num: '' })}
        {sel('grade', gradeOptions(drafts, scope.year), '학년', { num: '' })}
        {sel('num', numOptions(drafts, scope.year, scope.grade), '반', {})}
        <label className="flex flex-col gap-1 w-17">
          <span className="text-2xs font-bold text-slate-500 pl-0.5">번호</span>
          <input type="text" inputMode="numeric" data-search-num value={num} onChange={(e) => setNum(e.target.value.replace(/[^0-9]/g, ''))} placeholder="전체" className={FIELD} />
        </label>
        <label className="flex flex-col gap-1 flex-1 min-w-38">
          <span className="text-2xs font-bold text-slate-500 pl-0.5">이름 (초성도 가능)</span>
          <input type="text" data-search-name value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 김지우 · ㄱㅈㅇ" className={FIELD} />
        </label>
        <button
          type="button"
          data-search-clear
          onClick={() => {
            setScope(pick);
            setNum('');
            setName('');
          }}
          className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-50 cursor-pointer"
        >
          조건 지우기
        </button>
        <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 pb-2 cursor-pointer">
          <input type="checkbox" data-search-active checked={activeOnly} onChange={(e) => setActiveOnly(e.target.checked)} className="w-3.5 h-3.5 accent-primary" />
          재학생만
        </label>
        <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 pb-2 cursor-pointer">
          <input type="checkbox" data-search-hide checked={hideNames} onChange={(e) => setHideNames(e.target.checked)} className="w-3.5 h-3.5 accent-primary" />
          이름 가리기
        </label>
      </div>
      {filtering && (
        <div className="flex items-center gap-2 text-2xs font-bold text-slate-600 flex-wrap" data-search-total={total}>
          {name.trim() && /^[ㄱ-ㅎ\s]+$/.test(name) && <span className="bg-blue-50 border border-blue-200 text-primary rounded px-1.5 py-0.5">초성으로 찾는 중</span>}
          <span>
            {scope.num ? `${scope.num}반` : scope.grade ? `${scope.grade}학년 전체` : '전체 학급'}에서 <b className="text-primary">{total}명</b>
          </span>
        </div>
      )}
      {groups.length === 0 && <div className="text-center py-10 text-xs text-slate-400 font-semibold">조건에 맞는 학생이 없습니다.</div>}
      <div className="flex flex-col gap-4">
        {groups.map(({ cls, hits }) => {
          const own = photos && classIdOf(cls) === pickKeyId ? photos : null;
          return (
            <div key={classIdOf(cls)} className="flex flex-col gap-2" data-search-class={classIdOf(cls)}>
              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold text-slate-700">{describeClass(cls)}</span>
                <span className="text-2xs font-bold text-slate-500 bg-slate-100 rounded px-1.5 py-0.5">{hits.length}명</span>
                <span className="flex-1 h-px bg-slate-200" />
                {photos && !own && <span className="text-2xs font-semibold text-slate-400">사진은 위에서 이 학급을 골라야 보입니다</span>}
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-8 gap-2">
                {hits.map((st) => {
                  const photo = own?.get(st.num);
                  return (
                    <button
                      key={st.sid}
                      type="button"
                      data-search-hit={st.sid}
                      onClick={() => onOpen(drafts.indexOf(cls), st)}
                      title={`${st.num}번 ${st.name}`}
                      className={`text-left border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs hover:border-primary cursor-pointer ${!isActive(st) ? 'opacity-45' : ''}`}
                    >
                      {photos && <StudentPhoto url={photo?.url} name={st.name} shape="card" loose={photo?.exact === false} />}
                      <span className="flex items-center gap-1 px-1.5 py-1.5">
                        <span className="bg-blue-50 text-primary rounded text-2xs font-extrabold px-1 shrink-0">{st.num}</span>
                        <span className="text-xs font-extrabold text-slate-800 truncate">{hideNames ? '?' : <HighlightedName name={st.name} query={name} />}</span>
                        {st.gender && <span className="ml-auto text-2xs font-bold text-slate-400 shrink-0">{st.gender === 'M' ? '남' : '여'}</span>}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
