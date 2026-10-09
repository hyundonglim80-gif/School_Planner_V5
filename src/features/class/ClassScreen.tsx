// 학급 화면 (V4 features/class/ClassScreen.tsx) = 🏫 학급 도구 | 🧑‍🤝‍🧑 명렬표 (관리 · 검색 · 암기) - MENU 3-3.
//   학급 도구: 학급을 고르면(이 기기에 남는다 - 도구가 그 학급으로 연다) 도구 카드(CLASS_TOOLS)·학생 명단. 이름을 누르면 그 학생의 누가기록(P7-4).
//   학생 명단은 '이름 / 📷 사진'으로 본다(명렬표 관리의 사진 보기와 같은 것, 켜 둔 것은 이 기기 sp5-class-photos). 사진을 누르면 크게(아래 '사진 바꾸기').
//   교과 모드: 올해 반을 학년별 줄의 반 색 칩으로 고른다. 교과 + 담임은 담임반에서만 담임 도구.
//   📋 오늘 출결 한 줄(담임 도구 - 적힌 학생만, 누르면 출석부). 도구는 그 기능을 옮기는 세션이 창을 등록하면 열린다(그 전에는 🚧 안내).
import { useMemo, useState } from 'react';
import { KIND_LABEL, attendanceDocId, readMarks } from '../../domain/attendance';
import { useDocs } from '../../data/select';
import { openAttendance } from '../attendance/open';
import { openNotices } from '../notices/open';
import { openSubjectAttendanceSummary } from '../subjectAttendance/open';
import { runFromButton } from '../../app/keys';
import { getWindowDef, openWindow } from '../../app/windows';
import { showToast } from '../../app/toast';
import { academicYearOf, todayStr } from '../../domain/dateUtils';
import { classIdOf, classLabelOf, describeClass, isActive } from '../../domain/roster';
import { normalizeSlotText } from '../../domain/teachingSlot';
import { useMirrorStatus } from '../../data/select';
import { currentSpaceId, usePersonalSpaceId } from '../../data/session';
import { useClassColorOf, useTeaching } from '../lessons/teaching';
import StudentPhoto from '../photos/StudentPhoto';
import { readOn, usePhotoTools, writeOn } from '../photos/usePhotoTools';
import { rememberHubClass, useClasses, useHubClass, type ClassItem } from './classes';
import RosterView from './RosterView';
import { CLASS_TOOLS, type ClassTool } from './tools';
import { openClassRoster, setClassView, useClassView } from './view';
import { isDirty, useRosterDraft } from './rosterDraft';

/** 그 학생의 누가기록 (P7-4가 창을 등록한다) */
function openStudentRecord(classId: string, sid: string) {
  if (getWindowDef('studentRecord')) openWindow('studentRecord', { classId, sid });
  else showToast('🚧 학생 기록(누가기록)은 아직 V5로 옮기지 않았습니다.');
}

/** 학급 화면의 사진 보기 켬/끔 - 이 기기에만 (명렬표 관리의 sp5-roster-photos와 따로 - V4) */
const PHOTOS_KEY = 'sp5-class-photos';

function ClassHub() {
  const { classes } = useClasses();
  const status = useMirrorStatus('classes', usePersonalSpaceId());
  const remembered = useHubClass((s) => s.id);
  const { showHomeroomTools: modeHomeroom, isClassUnit, preset, mode } = useTeaching();
  const colorOf = useClassColorOf();
  const year = academicYearOf(todayStr());

  // 처음 학급: 마지막에 고른 것 → 올해의, 학생이 있는 첫 학급 → 첫 학급
  const cls: ClassItem | null =
    classes.find((c) => c.id === remembered) ?? classes.find((c) => c.year === year && c.students.length > 0) ?? classes.find((c) => c.students.length > 0) ?? classes[0] ?? null;
  // 교과 + 담임: 담임반이 아닌 반에서는 담임 도구를 숨긴다 (그 반은 교과 출결로)
  const showHomeroomTools = modeHomeroom && !(preset === 'subjectHomeroom' && cls && normalizeSlotText(mode.homeroomClass) !== classLabelOf(cls));
  const gradeRows = useMemo(() => {
    if (!isClassUnit) return [];
    const rows: Array<{ grade: number; classes: ClassItem[] }> = [];
    for (const c of classes.filter((x) => x.year === year).sort((a, b) => a.grade - b.grade || a.num - b.num)) {
      let row = rows.find((r) => r.grade === c.grade);
      if (!row) rows.push((row = { grade: c.grade, classes: [] }));
      row.classes.push(c);
    }
    return rows;
  }, [isClassUnit, classes, year]);
  const students = useMemo(() => (cls?.students ?? []).filter(isActive).sort((a, b) => a.num - b.num), [cls]);
  const [showPhotos, setShowPhotos] = useState(() => readOn(PHOTOS_KEY));
  const panel = usePhotoTools(cls, students, showPhotos);
  const photos = panel.photos;
  const setPhotoMode = (next: boolean) => {
    if (next === showPhotos) return;
    writeOn(PHOTOS_KEY, next);
    setShowPhotos(next);
    // 로그인 창은 누른 그 자리에서만 열린다 - 상태가 바뀌기를 기다리지 않고 바로 부른다
    if (next) void panel.authorize();
  };

  const choose = (id: string) => rememberHubClass(id);
  const openTool = (id: ClassTool['id']) => {
    if (cls) rememberHubClass(cls.id);
    if (id === 'roster') openClassRoster();
    // 출석부는 오늘로 (단축키는 보는 날)
    else if (id === 'attendance') openAttendance({ date: todayStr(), classId: cls?.id });
    else if (id === 'notices') {
      const space = currentSpaceId();
      if (space) openNotices({ sid: space, date: todayStr() });
    }
    else if (id === 'subjectAttendance') openSubjectAttendanceSummary({ classId: cls?.id });
    else runFromButton(id);
  };
  // 오늘 출결 (출석한 학생은 적지 않는다 - 적힌 학생만)
  const personal = usePersonalSpaceId();
  const attendance = useDocs('attendance', personal);
  const today = todayStr();
  const todayMarks = cls ? readMarks(attendance[attendanceDocId(cls.id, today)]?.records) : {};
  const todayRows = (cls?.students ?? []).filter((s) => todayMarks[s.sid]).sort((a, b) => a.num - b.num);

  if (classes.length === 0) {
    if (status !== 'live') {
      return (
        <div className="flex flex-col items-center justify-center py-20 gap-3" data-class-waiting>
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-slate-200 border-t-primary" />
          <p className="text-xs text-slate-400 font-medium">명렬표를 불러오는 중...</p>
        </div>
      );
    }
    return (
      <div className="max-w-xl mx-auto text-center py-16 flex flex-col items-center gap-3" data-class-empty>
        <p className="text-4xl">🏫</p>
        <p className="font-bold text-slate-700">아직 학급(명렬표)이 없습니다.</p>
        <p className="text-sm text-slate-500">명렬표를 만들면 이 화면에서 출석부·자리표·누가기록·조사표를 학급별로 엽니다.</p>
        <button type="button" data-class-make-roster onClick={() => openClassRoster('manage')} className="px-4 py-2 rounded-xl bg-primary text-white font-bold text-sm cursor-pointer">
          🧑‍🤝‍🧑 명렬표 만들기
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4" data-class-hub={cls?.id}>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-black text-slate-800">🏫 학급</h2>
        <select aria-label="학급 고르기" data-class-pick value={cls?.id ?? ''} onChange={(e) => choose(e.target.value)} className="px-3 py-1.5 border border-slate-200 rounded-xl font-bold text-sm bg-white">
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {describeClass(c)} ({c.students.filter(isActive).length}명)
            </option>
          ))}
        </select>
        <span className="text-xs text-slate-400">고른 학급으로 아래 도구가 열립니다.</span>
      </div>

      {/* 교과 모드: 올해 반을 학년별 줄의 반 색 칩으로 */}
      {gradeRows.length > 0 && (
        <div className="flex flex-col gap-1.5" data-class-grade-rows>
          {gradeRows.map((row) => (
            <div key={row.grade} className="flex flex-wrap items-center gap-1.5" data-class-grade={row.grade}>
              <span className="w-12 shrink-0 text-xs font-black text-slate-500">{row.grade}학년</span>
              {row.classes.map((c) => {
                const label = classLabelOf(c);
                return (
                  <button
                    key={c.id}
                    type="button"
                    data-class-chip={label}
                    aria-pressed={c.id === cls?.id}
                    onClick={() => choose(c.id)}
                    className={`px-3 py-1 rounded-lg text-sm font-black border border-transparent cursor-pointer ${colorOf(label).chip} ${c.id === cls?.id ? 'ring-2 ring-offset-1 ring-slate-500' : 'opacity-70 hover:opacity-100'}`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* 오늘 출결 한 줄 (교과 전담은 출석부를 숨긴다) */}
      {showHomeroomTools && cls && (
        <button
          type="button"
          data-class-today={todayRows.length}
          onClick={() => openTool('attendance')}
          className="text-left bg-white border border-slate-200 rounded-2xl px-4 py-3 hover:bg-slate-50 flex flex-wrap items-center gap-x-3 gap-y-1 cursor-pointer"
        >
          <span className="font-black text-sm text-slate-700">📋 오늘 출결</span>
          {todayRows.length === 0 ? (
            <span className="text-sm text-emerald-700 font-bold">적힌 결석·지각·조퇴·결과가 없습니다</span>
          ) : (
            todayRows.map((s) => (
              <span key={s.sid} className="text-sm text-slate-700">
                <span className="font-bold">
                  {s.num} {s.name}
                </span>{' '}
                <span className="text-rose-600 font-bold">{KIND_LABEL[todayMarks[s.sid].kind]}</span>
              </span>
            ))
          )}
          <span className="ml-auto text-xs font-bold text-primary">출석부 열기 →</span>
        </button>
      )}

      {/* 도구 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
        {CLASS_TOOLS.filter((t) => (showHomeroomTools || !t.homeroom) && (isClassUnit || !t.classUnit)).map((t) => (
          <button
            key={t.id}
            type="button"
            data-class-tool={t.id}
            onClick={() => openTool(t.id)}
            className="text-left bg-white border border-slate-200 rounded-2xl p-3 sm:p-4 hover:border-primary/50 hover:shadow-sm transition-all flex flex-col gap-1 cursor-pointer"
          >
            <span className="text-2xl leading-none">{t.icon}</span>
            <span className="font-black text-sm text-slate-800">{t.label}</span>
            <span className="text-xs text-slate-500">{t.desc}</span>
          </button>
        ))}
      </div>

      {/* 학생 명단 - 이름 / 사진. 이름을 누르면 그 학생의 누가기록 */}
      <section className="bg-white border border-slate-200 rounded-2xl p-3 sm:p-4" data-class-students={students.length}>
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <h3 className="font-black text-sm text-slate-700">
            🧑‍🎓 학생 {students.length}명 <span className="text-xs font-semibold text-slate-400">- {showPhotos ? '사진을 누르면 크게, 이름을 누르면 누가기록' : '누르면 그 학생의 누가기록'}</span>
          </h3>
          {showPhotos && photos.status === 'ready' && students.length > 0 && (
            <span className="text-xs font-semibold text-slate-400" data-class-photo-count={students.length - photos.missing.length}>
              사진 {students.length - photos.missing.length}/{students.length}명
            </span>
          )}
          <div className="ml-auto flex gap-1 bg-slate-100 rounded-lg p-1" role="group" aria-label="명단 보기">
            {([false, true] as const).map((on) => (
              <button
                key={String(on)}
                type="button"
                data-class-view={on ? 'photo' : 'name'}
                aria-pressed={showPhotos === on}
                onClick={() => setPhotoMode(on)}
                title={on ? '구글 드라이브의 학생 사진으로 봅니다 (명렬표 관리의 사진과 같습니다)' : '번호와 이름으로 봅니다'}
                className={`rounded-md px-2.5 py-1 text-xs font-bold transition-colors cursor-pointer ${showPhotos === on ? 'bg-white text-slate-800 shadow-2xs' : 'text-slate-500'}`}
              >
                {on ? '📷 사진' : '이름'}
              </button>
            ))}
          </div>
        </div>

        {/* 사진을 불러오지 못한 까닭 (명단은 그대로 보인다) */}
        {showPhotos &&
          students.length > 0 &&
          (photos.status === 'needs-auth' ? (
            <div className="mb-2 flex items-center justify-between gap-2 text-xs font-semibold text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 flex-wrap" data-photo-needs-auth>
              <span>구글 연결이 끊겨 사진을 불러오지 못했습니다.</span>
              <button type="button" data-photo-auth onClick={panel.authorize} className="px-2.5 py-1 bg-primary hover:bg-primary/90 rounded text-xs font-bold text-white cursor-pointer shrink-0">
                구글 연결하고 사진 불러오기
              </button>
            </div>
          ) : photos.status === 'error' ? (
            <div className="mb-2 flex items-center justify-between gap-2 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg px-2.5 py-2 flex-wrap" data-photo-error>
              <span>{photos.error || '사진 폴더를 읽지 못했습니다.'}</span>
              <button type="button" onClick={() => openTool('roster')} className="px-2.5 py-1 bg-white border border-red-300 rounded text-xs font-bold text-red-700 hover:bg-red-100 cursor-pointer shrink-0">
                명렬표에서 사진 폴더 보기
              </button>
            </div>
          ) : photos.status === 'checking' || photos.status === 'loading' || photos.resolving ? (
            <p className="mb-2 text-xs text-slate-400 font-semibold" data-photo-loading>
              사진을 불러오는 중... ({students.length - photos.missing.length}/{students.length})
            </p>
          ) : null)}

        {students.length === 0 ? (
          <p className="text-sm text-slate-400">이 학급에 학생이 없습니다. 위의 🧑‍🤝‍🧑 명렬표에서 더합니다.</p>
        ) : showPhotos ? (
          /* 명렬표 관리의 타일 보기와 같은 카드 - 휴대폰 세 칸(한 칸이 너무 좁으면 얼굴·이름을 못 읽는다) */
          <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-8 gap-2" data-class-photo-grid>
            {students.map((s) => {
              const photo = photos.photos.get(s.num);
              return (
                <div key={s.sid} className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs" data-class-photo-card={s.num}>
                  <StudentPhoto
                    url={photo?.url}
                    name={s.name}
                    shape="card"
                    canUpload
                    uploading={photos.uploading === s.num}
                    onUpload={(file) => void panel.upload(s, file)}
                    loose={photo?.exact === false}
                    onOpen={photo?.url ? () => panel.openViewer(s, photo.url) : undefined}
                    onPickDrive={() => void panel.pickDrive(s)}
                  />
                  <button
                    type="button"
                    data-class-student={s.num}
                    onClick={() => cls && openStudentRecord(classIdOf(cls), s.sid)}
                    title="이 학생의 누가기록"
                    className="w-full flex items-center gap-1 px-1.5 py-1.5 sm:gap-1.5 sm:px-2 hover:bg-primary/5 text-left min-w-0 cursor-pointer"
                  >
                    <span className="bg-blue-50 text-primary rounded text-2xs font-extrabold px-1 sm:px-1.5 py-0.5 shrink-0">{s.num}</span>
                    <span className="text-xs font-extrabold text-slate-800 truncate">{s.name || '이름 없음'}</span>
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-8 gap-1.5">
            {students.map((s) => (
              <button
                key={s.sid}
                type="button"
                data-class-student={s.num}
                onClick={() => cls && openStudentRecord(classIdOf(cls), s.sid)}
                className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg border border-slate-200 hover:bg-primary/5 hover:border-primary/40 text-sm text-left min-w-0 cursor-pointer"
              >
                <span className="text-xs font-bold text-slate-400 tabular-nums shrink-0">{s.num}</span>
                <span className="font-bold text-slate-800 truncate">{s.name || '이름 없음'}</span>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default function ClassScreen() {
  const view = useClassView((s) => s.view);
  const drafts = useRosterDraft((s) => s.drafts);
  const { classes } = useClasses();
  const dirty = isDirty(drafts, classes);
  const item = (on: boolean) => `px-3 py-1.5 rounded-lg text-sm font-black transition-colors cursor-pointer ${on ? 'bg-white text-primary shadow-2xs' : 'text-slate-500 hover:text-slate-700'}`;
  return (
    <div data-screen="class" className="animate-fade-in pb-12 flex flex-col gap-3">
      <div role="tablist" aria-label="학급 화면" data-class-mode-switch className="self-start flex gap-1 bg-slate-100 rounded-xl p-1">
        <button type="button" role="tab" aria-selected={view === 'hub'} data-class-mode="hub" onClick={() => setClassView('hub')} className={item(view === 'hub')}>
          🏫 학급 도구
        </button>
        <button type="button" role="tab" aria-selected={view === 'roster'} data-class-mode="roster" onClick={() => openClassRoster()} className={item(view === 'roster')}>
          🧑‍🤝‍🧑 명렬표 (관리 · 검색 · 암기){dirty && <span className="ml-1 text-amber-600" title="저장하지 않은 것이 있습니다">●</span>}
        </button>
      </div>
      {view === 'roster' ? <RosterView /> : <ClassHub />}
    </div>
  );
}
