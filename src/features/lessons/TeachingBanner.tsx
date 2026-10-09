// '교사 유형을 골라 주세요' 띠 (V4 components/TeachingModeBanner.tsx) - 한 번도 고르지 않은 계정의 하루 화면 맨 위.
// 고르면 계정에 저장되어 다른 기기에도 다시 뜨지 않는다. '나중에'도 (초등) 담임을 저장한다. ⏰ 시간표 창 '교사 유형' 탭에서 바꾼다.
// 계정 설정을 서버에서 받기 전에는 띄우지 않는다(받기 전의 '없음'은 모르는 것이다).
import { useCommonLoaded } from '../../app/prefs';
import { showToast } from '../../app/toast';
import { presetPatch, TEACHER_PRESETS, type TeacherPreset } from '../../domain/teachingMode';
import { updateTeaching, useTeaching } from './teaching';

export default function TeachingBanner() {
  const loaded = useCommonLoaded((s) => s.loaded);
  const { chosen } = useTeaching();
  if (!loaded || chosen) return null;

  const choose = (p: TeacherPreset, later = false) => {
    updateTeaching(presetPatch(p));
    showToast(
      later
        ? '👩‍🏫 (초등) 담임으로 둡니다. ⏰ 시간표 창에서 바꿀 수 있습니다.'
        : `👩‍🏫 교사 유형을 '${TEACHER_PRESETS.find((x) => x.value === p)?.label}'(으)로 저장했습니다.`,
    );
  };

  return (
    <div role="status" data-teacher-mode-banner className="flex items-center gap-2 flex-wrap rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">
      <span className="font-bold">👩‍🏫 교사 유형을 골라 주세요</span>
      <span className="hidden sm:inline text-sky-700">수업 칸과 학급 도구를 그에 맞춰 보여 줍니다.</span>
      <span className="ml-auto flex items-center gap-1.5 flex-wrap">
        {TEACHER_PRESETS.map((p) => (
          <button
            key={p.value}
            type="button"
            data-banner-preset={p.value}
            title={p.desc}
            onClick={() => choose(p.value)}
            className="px-2.5 py-1 rounded-lg bg-white border border-sky-300 hover:bg-sky-100 font-bold text-sky-800 cursor-pointer"
          >
            {p.label}
          </button>
        ))}
        <button type="button" data-banner-later onClick={() => choose('homeroom', true)} className="px-2 py-1 rounded-lg hover:bg-sky-100 font-bold text-sky-700 cursor-pointer">
          나중에
        </button>
      </span>
    </div>
  );
}
