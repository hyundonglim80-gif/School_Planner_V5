// 처음 쓰는 사람의 '다음 할 일' 띠 (P22-7) - 교사 유형을 고른 뒤 하루 화면 맨 위에: '다음: ⏰ 시간표 넣기 → 🏫 학급 만들기'.
//   띠 차례 = 📥 V4 가져오기 → 👩‍🏫 교사 유형(TeachingBanner) → 이 띠 (한 번에 하나 - 가져오기가 셋을 함께 옮겨 온다).
//   시간표·학급이 다 있으면 저절로 사라진다(학년도는 보지 않는다 - 지난 학년 것은 3월 🌱 띠). '닫기'는 계정 common.firstStepsDone(다른 기기에서도).
//   개인 공간 시간표·학급을 서버에서 받기 전에는 띄우지 않는다(받기 전의 '없음'은 모르는 것이다).
import { setCommonSetting, useCommonLoaded, useCommonSettings } from '../../app/prefs';
import { setScope } from '../../app/nav';
import { showToast } from '../../app/toast';
import { openWindow } from '../../app/windows';
import { useHasLive } from '../../data/select';
import { usePersonalSpaceId } from '../../data/session';
import { useImportOfferSettled } from '../../import/v4/run';
import { setClassView } from '../class/view';
import { useTeaching } from './teaching';

export default function FirstStepsBanner() {
  const loaded = useCommonLoaded((s) => s.loaded);
  const done = useCommonSettings((s) => s.firstStepsDone);
  const { chosen } = useTeaching();
  const importSettled = useImportOfferSettled();
  const sid = usePersonalSpaceId();
  const hasTimetable = useHasLive(['timetables'], sid);
  const hasClass = useHasLive(['classes'], sid);
  if (!loaded || !chosen || done || !importSettled || hasTimetable === null || hasClass === null) return null;
  if (hasTimetable && hasClass) return null;

  const steps = [
    { id: 'timetable', label: '⏰ 시간표 넣기', done: hasTimetable, run: () => openWindow('timetable') },
    {
      id: 'class',
      label: '🏫 학급 만들기',
      done: hasClass,
      run: () => {
        setClassView('hub');
        setScope('class');
      },
    },
  ];
  const next = steps.find((s) => !s.done)?.id;

  const dismiss = () => {
    setCommonSetting('firstStepsDone', true);
    showToast('띠를 닫았습니다. 시간표는 ⋮ › ⏰ 시간표, 학급은 맨 위 학급 탭에서 만듭니다.');
  };

  return (
    <div role="status" data-first-steps-banner className="flex items-center gap-2 flex-wrap rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">
      <span className="font-bold">👣 다음:</span>
      <span className="flex items-center gap-1.5 flex-wrap">
        {steps.map((s, i) => (
          <span key={s.id} className="flex items-center gap-1.5">
            {i > 0 && (
              <span aria-hidden className="text-sky-400">
                →
              </span>
            )}
            <button
              type="button"
              data-first-step={s.id}
              data-done={s.done ? 'true' : 'false'}
              onClick={s.run}
              title={s.done ? '다 했습니다 - 눌러서 고칠 수 있습니다' : undefined}
              className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer ${
                s.id === next ? 'bg-sky-600 hover:bg-sky-700 text-white' : s.done ? 'text-sky-600 hover:bg-sky-100 line-through decoration-sky-400' : 'bg-white border border-sky-300 hover:bg-sky-100 text-sky-800'
              }`}
            >
              {s.done ? '✓ ' : ''}
              {s.label}
            </button>
          </span>
        ))}
      </span>
      <span className="hidden sm:inline text-sky-700">하루 화면 수업 칸과 학급 도구가 채워집니다.</span>
      <button type="button" data-first-steps-close onClick={dismiss} className="ml-auto px-2 py-1 rounded-lg hover:bg-sky-100 font-bold text-sky-700 cursor-pointer">
        닫기
      </button>
    </div>
  );
}
