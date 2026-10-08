// 처음 로그인 띠 'V4 자료 가져오기' (P2-4). V4로 쓴 자료가 있는데 가져온 적도 띠를 닫은 적도 없으면 본문 맨 위에 뜬다(V4 자동 백업 띠 모양).
// '가져오기'는 환경설정 '가져오기' 탭을 열고 곧바로 가져온다(진행·결과는 그 탭에). '닫기'는 계정에 남겨 다른 기기에서도 다시 뜨지 않는다 -
// 환경설정 '가져오기'에서 언제든 가져온다.
import { useEffect } from 'react';
import { openWindow } from '../../app/windows';
import { useSession } from '../../data/session';
import { checkImportOffer, dismissImportOffer, resetImportRun, runImport, useImportRun } from '../../import/v4/run';

export default function ImportBanner() {
  const uid = useSession((s) => s.user?.uid);
  const offer = useImportRun((s) => s.offer);

  useEffect(() => {
    if (!uid) return;
    void checkImportOffer(uid);
    return () => resetImportRun();
  }, [uid]);

  if (!offer || !uid) return null;
  return (
    <div
      role="status"
      data-import-banner
      className="mb-3 flex items-center gap-2 flex-wrap rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900"
    >
      <span className="font-bold">📥 V4에서 쓰던 자료가 있습니다.</span>
      <span className="text-sky-700">V5로 옮겨 올까요? V4는 그대로 두고 읽기만 합니다(지금은 라벨·설정).</span>
      <span className="ml-auto flex items-center gap-1.5">
        <button
          type="button"
          data-import-banner-run
          onClick={() => {
            openWindow('settings', { tab: 'import' });
            void runImport(uid);
          }}
          className="px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-bold cursor-pointer"
        >
          가져오기
        </button>
        <button
          type="button"
          data-import-banner-close
          title="환경설정 › 가져오기에서 언제든 가져올 수 있습니다"
          onClick={() => void dismissImportOffer(uid)}
          className="px-2 py-1 rounded-lg hover:bg-sky-100 font-bold text-sky-800 cursor-pointer"
        >
          닫기
        </button>
      </span>
    </div>
  );
}
