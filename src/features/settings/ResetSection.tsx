// 환경설정 '앱' 탭 맨 위 '초기화' 절 (P33-2 - 11-12 사용자 '각 유저는 초기화 설정 단추로 각자의 설정 값을 각자의 초기화로').
//   💾 초기화 설정 = 지금 설정을 내 초기화 값으로(누르는 즉시 저장 - 이 기기 종류 몫 + 계정 몫, 다른 기기 종류 몫은 그대로).
//   ↩️ 초기화     = 묻고 초기화 값으로(내 것 → 관리자가 정한 처음 설정 → 앱 처음 값) + 안내의 되돌리기 하나.
//   묶음에 드는 것·빠지는 것은 domain/settingsSnapshot. 글자 크기 초기화·단축키 기본값으로·경계선 두 번 누르기도 같은 값으로 간다.
import { useState } from 'react';
import { showErrorToastOnce, showToast } from '../../app/toast';
import { detectDeviceKind } from '../../app/prefs';
import { useResetSnapshots } from '../../app/settingsReset';
import { useResetTargets } from '../../app/resetTargets';
import { resetToInitial, saveMyResetSnapshot } from '../../app/settingsSnapshot';
import { useSession } from '../../data/session';
import { Section } from './parts';

const BTN = 'px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-700 cursor-pointer disabled:opacity-50';

const KIND_LABEL = { pc: 'PC', mobile: '휴대폰' } as const;

/** 11-12 14:03 */
function whenText(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function ResetSection() {
  const uid = useSession((s) => s.user?.uid);
  const [kind] = useState(detectDeviceKind);
  const mine = useResetSnapshots((s) => s.mine);
  const from = useResetTargets((s) => s.values?.deviceFrom ?? 'app');
  const [busy, setBusy] = useState(false);
  const part = mine?.[kind];

  const save = async () => {
    if (!uid) return;
    setBusy(true);
    try {
      await saveMyResetSnapshot(uid);
      showToast(`💾 지금 설정을 초기화 값으로 저장했습니다 (${KIND_LABEL[kind]})`, 4000);
    } catch (e) {
      showErrorToastOnce('초기화 설정을 저장하지 못했습니다.', e);
    } finally {
      setBusy(false);
    }
  };

  const apply = () => {
    const where = from === 'mine' ? "내 '초기화 설정'" : from === 'admin' ? '처음 설정' : '앱 처음 값';
    if (!window.confirm(`설정을 ${where}으로 되돌릴까요?\n글자 크기·단축키·화면 비율·창 위치·밝기 같은 보기 설정이 바뀝니다. 일정·메모·학교·교시 같은 자료는 그대로입니다.`)) return;
    const undo = resetToInitial();
    showToast(`↩️ 설정을 ${where}으로 되돌렸습니다`, 6000, 'info', { label: '되돌리기', run: undo });
  };

  return (
    <Section
      id="reset"
      title="초기화"
      desc="지금 보기 설정(글자 크기·화면 비율·단축키·창 위치·밝기·색 테마 …)을 내 초기화 값으로 저장해 두고, 언제든 그 값으로 되돌립니다. 일정·메모·학교·교시 같은 자료는 바뀌지 않습니다."
    >
      <div data-reset-section={from}>
        <p data-reset-saved-at={part ? part.at : ''} className="text-xs text-slate-500 mb-2">
          {part
            ? `${KIND_LABEL[kind]} 초기화 값: ${part.at ? `${whenText(part.at)}에 저장` : '저장됨'}`
            : from === 'admin'
              ? `${KIND_LABEL[kind]} 초기화 값이 없습니다 - 초기화하면 처음 설정(관리자가 정한 값)으로 갑니다.`
              : `${KIND_LABEL[kind]} 초기화 값이 없습니다 - 초기화하면 앱 처음 값으로 갑니다.`}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            data-reset-save
            disabled={!uid || busy}
            onClick={() => void save()}
            title={`지금 설정을 내 초기화 값으로 저장합니다 (${KIND_LABEL[kind]} 몫 - 다른 기기 종류는 그대로)`}
            className={BTN}
          >
            💾 초기화 설정
          </button>
          <button type="button" data-reset-apply onClick={apply} title="묻고 나서 초기화 값으로 되돌립니다" className={BTN}>
            ↩️ 초기화
          </button>
        </div>
      </div>
    </Section>
  );
}
