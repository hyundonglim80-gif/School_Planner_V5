// 명렬표의 '암기' 탭 (V4 components/roster/RosterMemorizeTab.tsx). 사진을 보고 이름을 떠올린 뒤 알아요/모르겠어요를 누르면 이름이 드러난다.
//   틀린 학생은 다음 판에서 더 자주·더 앞에(domain/photoQuiz), 성적은 계정(quiz/{classId}) - 내일 다시 열어도 어제 틀린 얼굴부터.
//   V4 10-07 사용자 요청 그대로: 문제·정답의 사진 자리·크기를 같게(정답은 아래에 이름만), 함께 외울 학급 여러 개, 자동 넘김(초, 0 = 끔), 출제 수(0 = 계속).
//   설정은 이 기기에만(sp5-photo-quiz). 키: ← 모르겠어요 · → 알아요 / 이름이 보이면 → · Enter · Space 다음 · Backspace 되돌리기.
import { useCallback, useEffect, useRef, useState } from 'react';
import { sanitizeQuizSettings, type QuizSettings } from '../../domain/photoQuiz';
import { classIdOf, describeClass, type RosterClass } from '../../domain/roster';
import { quizKeyOf } from '../../ui/listKeys';
import StudentPhoto from '../photos/StudentPhoto';
import { usePhotoTools } from '../photos/usePhotoTools';
import { quizStudentsOf, usePhotoQuiz, type QuizStudent } from '../quiz/usePhotoQuiz';

const SETTINGS_KEY = 'sp5-photo-quiz';
function readSettings(): QuizSettings {
  try {
    return sanitizeQuizSettings(JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'));
  } catch {
    return sanitizeQuizSettings({});
  }
}
function saveSettings(s: QuizSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    // 못 적어도 이번에는 그대로 쓴다
  }
}

/**
 * 함께 외울 다른 학급의 사진을 부른다 (화면에는 아무것도 그리지 않는다).
 * 사진 훅은 학급 하나씩이라 학급마다 이 칸을 하나씩 둔다.
 */
function ClassQuizPhotos({ cls, onReady }: { cls: RosterClass; onReady: (classId: string, list: QuizStudent[], done: boolean) => void }) {
  const panel = usePhotoTools(cls, cls.students, true);
  const st = panel.photos;
  const done = st.status !== 'checking' && st.status !== 'loading' && !st.resolving;
  const classId = classIdOf(cls);
  const list = quizStudentsOf(cls, cls.students, (s) => st.photos.get(s.num)?.url);
  // 그릴 때마다 알린다 - 받는 쪽이 같은 목록이면 그대로 둔다
  useEffect(() => onReady(classId, list, done));
  return null;
}

interface Props {
  cls: RosterClass | null;
  /** 사진이 있는 학생 (얼굴 없이 이름을 맞힐 수는 없다) */
  candidates: QuizStudent[];
  /** 사진이 아직 없는 학생 수 */
  withoutPhoto: number;
  /** 함께 외울 학급 후보 (같은 학년도만 보인다) */
  classes: readonly RosterClass[];
  /** 사진 보기가 켜져 있나 (꺼져 있으면 다른 학급 사진도 부르지 않는다) */
  photosOn: boolean;
}

function Kbd({ children }: { children: string }) {
  return <b className="bg-slate-100 border border-slate-200 rounded-xs px-1.5 py-0.5 text-slate-600 font-bold">{children}</b>;
}

export default function MemorizeTab({ cls, candidates, withoutPhoto, classes, photosOn }: Props) {
  const [settings, setSettingsState] = useState<QuizSettings>(readSettings);
  const setSettings = (patch: Partial<QuizSettings>) =>
    setSettingsState((prev) => {
      const next = sanitizeQuizSettings({ ...prev, ...patch });
      saveSettings(next);
      return next;
    });

  const curId = cls ? classIdOf(cls) : '';
  const sameYear = classes
    .filter((c) => cls && c.year === cls.year && c.students.length > 0)
    .sort((a, b) => a.grade - b.grade || a.num - b.num);
  const extraClasses = photosOn ? sameYear.filter((c) => classIdOf(c) !== curId && settings.classes.includes(classIdOf(c))) : [];
  const [extra, setExtra] = useState<Record<string, { list: QuizStudent[]; done: boolean }>>({});
  const onExtraReady = useCallback((classId: string, list: QuizStudent[], done: boolean) => {
    setExtra((prev) => (prev[classId]?.done === done && JSON.stringify(prev[classId]?.list) === JSON.stringify(list) ? prev : { ...prev, [classId]: { list, done } }));
  }, []);
  const extraLoading = extraClasses.some((c) => !extra[classIdOf(c)]?.done);
  // 다른 학급 사진을 다 받은 뒤에 판을 짠다 (받는 중에 판이 다시 짜여 처음으로 돌아가지 않게)
  const allCandidates = extraLoading ? [] : [...candidates, ...extraClasses.flatMap((c) => extra[classIdOf(c)]?.list ?? [])];
  const multi = extraClasses.length > 0;
  const classIds = [curId, ...extraClasses.map(classIdOf)].filter(Boolean);

  const quiz = usePhotoQuiz(classIds, allCandidates, { count: settings.count });
  const { current, revealed, answer, undo, next, reveal, shuffle, finished, canUndo } = quiz;

  // 자동 넘김: 문제를 정한 초만큼 보인 뒤 이름, 다시 그만큼 뒤 다음 (0이면 끔)
  const autoRef = useRef({ next, reveal });
  useEffect(() => {
    autoRef.current = { next, reveal };
  });
  useEffect(() => {
    if (!settings.auto || !current || finished) return;
    const t = window.setTimeout(() => (revealed ? autoRef.current.next() : autoRef.current.reveal()), settings.auto * 1000);
    return () => window.clearTimeout(t);
  }, [settings.auto, current, revealed, finished, quiz.index]);

  // 자판으로 넘기기 (글자를 치는 중에는 듣지 않는다)
  const keyRef = useRef<(e: KeyboardEvent) => void>(() => {});
  useEffect(() => {
    keyRef.current = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = quizKeyOf(e.key);
      if (!k || !current) return;
      if (!revealed) {
        if (k === 'no' || k === 'yes') {
          e.preventDefault();
          answer(k === 'yes');
        }
        return;
      }
      if (k === 'next' || k === 'yes') {
        e.preventDefault();
        next();
      } else if (k === 'undo') {
        e.preventDefault();
        undo();
      }
    };
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => keyRef.current(e);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!cls) return <div className="text-center py-12 text-xs text-slate-400 font-semibold">학급을 먼저 골라 주세요.</div>;

  const loaders = extraClasses.map((c) => <ClassQuizPhotos key={classIdOf(c)} cls={c} onReady={onExtraReady} />);
  const numInput = 'w-14 px-1.5 py-1 border border-slate-300 rounded-md bg-white text-xs font-bold text-slate-700 text-center';
  const settingsBar = (
    <div data-quiz-settings className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600">
      <label className="flex items-center gap-1.5">
        자동 넘김
        <input type="number" min={0} max={60} aria-label="자동 넘김 (초)" data-quiz-auto value={settings.auto} onChange={(e) => setSettings({ auto: Number(e.target.value) })} className={numInput} />
        초 <span className="text-2xs font-semibold text-slate-400">(0 = 끔)</span>
      </label>
      <label className="flex items-center gap-1.5">
        출제 수
        <input type="number" min={0} max={999} aria-label="출제 수" data-quiz-count value={settings.count} onChange={(e) => setSettings({ count: Number(e.target.value) })} className={numInput} />
        번 <span className="text-2xs font-semibold text-slate-400">(0 = 계속)</span>
      </label>
      {sameYear.length > 1 && (
        <div className="flex flex-wrap items-center gap-1" data-quiz-classes>
          <span className="mr-0.5">함께 외울 학급</span>
          {sameYear.map((c) => {
            const id = classIdOf(c);
            const isCur = id === curId;
            const on = isCur || settings.classes.includes(id);
            return (
              <button
                key={id}
                type="button"
                data-quiz-class={`${c.grade}-${c.num}`}
                aria-pressed={on}
                disabled={isCur}
                title={isCur ? '지금 고른 학급 (늘 들어갑니다)' : on ? '빼기' : '함께 외우기'}
                onClick={() => setSettings({ classes: on ? settings.classes.filter((x) => x !== id) : [...settings.classes, id] })}
                className={`px-2 py-0.5 rounded-md border text-2xs font-extrabold transition-colors ${on ? 'bg-primary text-white border-primary' : 'bg-white text-slate-500 border-slate-300 hover:bg-slate-100 cursor-pointer'} ${isCur ? 'opacity-80' : ''}`}
              >
                {c.grade}-{c.num}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  if (allCandidates.length === 0) {
    return (
      <div className="flex flex-col gap-2.5" data-quiz-empty>
        {loaders}
        {settingsBar}
        {extraLoading ? (
          <div className="text-center py-12 text-xs text-slate-400 font-semibold">함께 외울 학급의 사진을 불러오는 중...</div>
        ) : (
          <div className="text-center py-12 flex flex-col items-center gap-2">
            <div className="text-sm font-extrabold text-slate-700">외울 얼굴이 아직 없습니다</div>
            <div className="text-xs text-slate-500 leading-relaxed max-w-125">
              {withoutPhoto > 0 ? (
                <>
                  이 학급 학생 {withoutPhoto}명의 사진이 아직 없습니다. <b>관리</b> 탭의 타일 보기에서 빈 칸을 눌러 사진을 올리시면 여기에 나옵니다.
                </>
              ) : (
                <>이 학급에 학생이 없습니다. 먼저 관리 탭에서 명단을 넣어 주세요.</>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  const shown = Math.min(quiz.index + (revealed ? 1 : 0), quiz.total);
  const progress = quiz.total > 0 ? Math.round((shown / quiz.total) * 100) : 0;
  const btn = 'w-45 h-12 flex items-center justify-center gap-2 rounded-xl border text-sm font-extrabold transition-colors cursor-pointer';

  return (
    <div className="flex flex-col gap-2.5" data-quiz>
      {loaders}
      {settingsBar}
      <div className="flex items-center gap-2.5 flex-wrap">
        <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 cursor-pointer">
          <input type="checkbox" data-quiz-weighted checked={quiz.weighted} onChange={(e) => quiz.setWeighted(e.target.checked)} className="w-3.5 h-3.5 accent-primary cursor-pointer" />
          틀린 학생 더 자주
        </label>
        <span className="text-2xs font-semibold text-slate-400" data-quiz-class-label>
          {multi ? `${extraClasses.length + 1}개 학급` : describeClass(cls)}
        </span>
        <span className="flex-1" />
        <span className="flex items-center gap-1.5 text-xs font-extrabold" data-quiz-tally={`${quiz.tally.o}|${quiz.tally.x}`}>
          <span className="text-emerald-700">○ {quiz.tally.o}</span>
          <span className="text-slate-300 font-normal">|</span>
          <span className="text-red-700">✕ {quiz.tally.x}</span>
        </span>
        <button
          type="button"
          data-quiz-restart
          onClick={shuffle}
          className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
        >
          ↻ 처음부터
        </button>
      </div>

      <div className="flex items-center gap-2" data-quiz-progress={`${shown}/${quiz.total}`}>
        {quiz.count > 0 ? (
          <>
            <span className="text-2xs font-bold text-slate-500 whitespace-nowrap">
              {shown} / {quiz.total}
            </span>
            <span className="flex-1 h-1.5 rounded-full bg-slate-200 overflow-hidden">
              <span className="block h-full bg-primary rounded-full transition-all duration-200" style={{ width: `${progress}%` }} />
            </span>
            <span className="text-2xs font-bold text-slate-500 whitespace-nowrap">{quiz.round}회차</span>
          </>
        ) : (
          <span className="text-2xs font-bold text-slate-500 whitespace-nowrap">
            {quiz.index + (revealed ? 1 : 0)}장째 · 계속 ({quiz.round}바퀴째)
          </span>
        )}
        {settings.auto > 0 && <span className="text-2xs font-bold text-primary whitespace-nowrap">⏱ {settings.auto}초마다 넘김</span>}
      </div>

      {finished || !current ? (
        <div className="flex flex-col items-center gap-2.5 py-10 text-center" data-quiz-finished>
          <div className="text-lg font-black text-slate-800">{quiz.round}회차를 마쳤습니다</div>
          <div className="text-xs text-slate-500">
            맞힘 <b className="text-emerald-700">{quiz.tally.o}</b> · 틀림 <b className="text-red-700">{quiz.tally.x}</b>
            {quiz.tally.x > 0 && ' — 다음 판에서는 틀린 얼굴이 먼저 나옵니다'}
          </div>
          <button type="button" data-quiz-again onClick={shuffle} className="mt-1 px-6 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-xl text-xs font-extrabold transition-colors cursor-pointer">
            한 판 더
          </button>
        </div>
      ) : (
        // 문제와 정답이 같은 자리·같은 크기의 사진 (V4 10-07 - 사진이 옮겨 다녀 어지러웠다). 정답에서는 사진 아래 같은 칸에 이름만
        <div className="flex flex-col items-center gap-3 pt-1" data-quiz-stage={revealed ? 'answer' : 'question'} data-quiz-key={current.key}>
          <div className="w-60 relative shrink-0" data-quiz-photo>
            <StudentPhoto url={current.url} name={current.name} shape="card" />
            {quiz.currentRecord && quiz.currentRecord.x > 0 && (
              <span className="absolute top-2.5 right-2.5 bg-red-50 border border-red-200 text-red-700 text-2xs font-extrabold rounded-md px-1.5 py-0.5">{quiz.currentRecord.x}번 틀림</span>
            )}
          </div>
          <div className="h-14 flex items-center justify-center text-center" data-quiz-answer>
            {revealed ? (
              <div className="text-4xl font-black text-slate-800 tracking-tight leading-none" data-quiz-name>
                {current.name}
              </div>
            ) : (
              <div className="text-sm font-extrabold text-slate-500">이 학생의 이름은?</div>
            )}
          </div>
          <div className="flex gap-2.5">
            {!revealed ? (
              <>
                <button type="button" data-quiz-no onClick={() => answer(false)} className={`${btn} border-red-200 bg-red-50 text-red-700 hover:bg-red-100`}>
                  ✕ 모르겠어요
                </button>
                <button type="button" data-quiz-yes onClick={() => answer(true)} className={`${btn} border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100`}>
                  ○ 알아요
                </button>
              </>
            ) : (
              <>
                <button type="button" data-quiz-undo onClick={undo} disabled={!canUndo} className={`${btn} border-slate-300 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40`}>
                  되돌리기
                </button>
                <button type="button" data-quiz-next onClick={next} className={`${btn} border-primary bg-primary text-white hover:bg-primary/90`}>
                  다음 →
                </button>
              </>
            )}
          </div>
          <div className="h-5 flex justify-center gap-2.5 text-2xs text-slate-400 font-semibold">
            {!revealed ? (
              <>
                <span>
                  <Kbd>←</Kbd> 모르겠어요
                </span>
                <span>
                  <Kbd>→</Kbd> 알아요
                </span>
              </>
            ) : (
              <>
                <span>
                  <Kbd>→</Kbd> · <Kbd>Enter</Kbd> 다음
                </span>
                <span>
                  <Kbd>Backspace</Kbd> 되돌리기
                </span>
              </>
            )}
          </div>
        </div>
      )}

      <div className="flex justify-center items-center gap-1.5 text-2xs text-slate-400 font-semibold pt-1">
        ✓ 기록은 계정에 저장됩니다 · 다음에 열면 틀린 학생부터 이어서
        {withoutPhoto > 0 && ` · 이 학급의 사진 없는 ${withoutPhoto}명은 빠져 있습니다`}
      </div>
    </div>
  );
}
