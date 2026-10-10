// 드라이브 자동 백업이 오래 밀렸을 때 본문 위에 뜨는 띠 (V4 components/AutoBackupBanner.tsx, P8-3).
// 자동 백업은 구글 권한이 이미 있을 때만 조용히 돌아서, 권한 없이 며칠이 지나면 한 번 눌러 달라고 권한다.
// '지금 백업'은 누른 것이라 권한을 물어도 된다. '나중에'는 이 기기에서 하루 미룬다.
import { useState } from 'react';
import { backupNow, useAutoBackupRunner } from './auto';

export default function AutoBackupBanner() {
  const { nag, overdue, snooze } = useAutoBackupRunner();
  const [busy, setBusy] = useState(false);
  if (!nag) return null;
  const msg = Number.isFinite(overdue) ? `드라이브 자동 백업이 ${overdue}일 밀렸습니다.` : '드라이브 자동 백업이 아직 한 번도 되지 않았습니다.';
  return (
    <div role="status" data-auto-backup-banner className="mb-3 flex items-center gap-2 flex-wrap rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
      <span className="font-bold">💾 {msg}</span>
      <span className="text-amber-700">구글 권한이 있을 때만 조용히 저장해서, 한 번 눌러 주셔야 합니다.</span>
      <span className="ml-auto flex items-center gap-1.5">
        <button
          type="button"
          data-auto-backup-banner-run
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await backupNow();
            } finally {
              setBusy(false);
            }
          }}
          className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold disabled:opacity-50 cursor-pointer"
        >
          {busy ? '백업 중…' : '지금 백업'}
        </button>
        <button type="button" data-auto-backup-banner-later onClick={snooze} className="px-2 py-1 rounded-lg hover:bg-amber-100 font-bold text-amber-800 cursor-pointer">
          나중에
        </button>
      </span>
    </div>
  );
}
