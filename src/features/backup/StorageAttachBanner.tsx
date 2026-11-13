// '📎 예전 저장소에 첨부 n개' 띠 (P32-1) - V4에서 가져온 첨부가 아직 예전 Firebase Storage에 있으면 본문 맨 위에서 드라이브로 모으기를 권한다.
// 전에는 백업 창 '정리' 탭을 열어야만 수가 보였다. 같은 일(collectRun)을 띠에서 곧바로 - 다 옮겨 0개가 되면 띠가 사라진다.
// PC에서 개인 공간을 볼 때만(드라이브에 많이 올리는 일 - 자동 백업 띠처럼 PC, 그룹은 누가 모으든 그 사람 드라이브로 가서 정리 탭에서만).
// 메모·수업 칸을 서버에서 다 받은 뒤에만 센다(사본만 그린 동안의 수·'없음'은 모르는 것). '나중에' = 이 기기에서 7일.
import { useMemo, useState } from 'react';
import { detectDeviceKind } from '../../app/prefs';
import { countStorageFiles } from '../../domain/attachCollect';
import { useDocs, useMirrorStatus } from '../../data/select';
import { useCurrentSpaceId, usePersonalSpaceId } from '../../data/session';

const SNOOZE_KEY = 'sp5-storage-attach-snooze';
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

function snoozedNow(): boolean {
  try {
    return Number(localStorage.getItem(SNOOZE_KEY) || 0) > Date.now();
  } catch {
    return false;
  }
}

export default function StorageAttachBanner() {
  const sid = usePersonalSpaceId();
  const current = useCurrentSpaceId();
  if (detectDeviceKind() !== 'pc' || !sid || current !== sid) return null;
  return <Banner sid={sid} />;
}

function Banner({ sid }: { sid: string }) {
  const items = useDocs('items', sid);
  const lessonDays = useDocs('lessonDays', sid);
  const itemsStatus = useMirrorStatus('items', sid);
  const daysStatus = useMirrorStatus('lessonDays', sid);
  const loaded = itemsStatus === 'live' && daysStatus === 'live';
  const count = useMemo(() => countStorageFiles(items, lessonDays), [items, lessonDays]);
  const [snoozed, setSnoozed] = useState(snoozedNow);
  const [busy, setBusy] = useState('');
  if (!loaded || count === 0 || snoozed) return null;

  const run = async () => {
    if (busy) return;
    setBusy('옮기는 중…');
    try {
      const { runCollect } = await import('./collectRun');
      await runCollect(sid, setBusy);
    } finally {
      setBusy('');
    }
  };
  const later = () => {
    try {
      localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_MS));
    } catch {
      /* 시크릿 모드 등 - 이번 화면에서만 */
    }
    setSnoozed(true);
  };

  return (
    <div role="status" data-storage-attach-banner={count} className="mb-3 flex items-center gap-2 flex-wrap rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">
      <span className="font-bold">📎 예전 저장소에 첨부 {count}개가 남아 있습니다.</span>
      <span className="text-sky-700">V4에서 가져온 첨부입니다 - 다른 첨부처럼 내 구글 드라이브(School_Planner 폴더)로 모아 둡니다.</span>
      <span className="ml-auto flex items-center gap-1.5">
        <button
          type="button"
          data-storage-attach-run
          disabled={!!busy}
          onClick={() => void run()}
          className="px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-bold disabled:opacity-50 cursor-pointer"
        >
          {busy || '드라이브로 모으기'}
        </button>
        <button type="button" data-storage-attach-later disabled={!!busy} onClick={later} className="px-2 py-1 rounded-lg hover:bg-sky-100 font-bold text-sky-800 cursor-pointer disabled:opacity-50">
          나중에
        </button>
      </span>
    </div>
  );
}
