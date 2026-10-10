// 백업 탭의 '☁️ 드라이브 자동 백업' 칸 (V4 환경설정 > 드라이브 자동 백업 - MENU 3-7에서 백업 창으로).
// 켜기·주기·남길 개수는 누르는 즉시 계정에(common.autoBackup), 지금 백업은 권한을 물어도 된다.
import { setCommonSetting, useCommonSettings } from '../../app/prefs';
import { INTERVAL_CHOICES, KEEP_CHOICES } from '../../domain/autoBackup';
import { Choices, Section, ToggleRow } from '../settings/parts';
import { backupNow, useBackupLog, useBackupLogWatch } from './auto';

const stamp = (ms: number) => {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

export default function AutoBackupSection() {
  useBackupLogWatch();
  const s = useCommonSettings((st) => st.autoBackup);
  const { log, busy } = useBackupLog();
  const set = (patch: Partial<typeof s>) => setCommonSetting('autoBackup', { ...s, ...patch });
  return (
    <Section
      id="auto-backup"
      title="☁️ 드라이브 자동 백업"
      desc="PC에서 앱을 열 때 정한 날이 지났으면 개인 공간 전체를 구글 드라이브 School_Planner/백업 폴더에 올립니다(공개하지 않습니다). 구글 권한이 이미 있을 때만 조용히 하고, 휴대폰에서는 하지 않습니다."
    >
      <div data-auto-backup>
        <ToggleRow id="auto-backup" label="자동 백업" hint="3일 넘게 밀리면 화면 위에 '지금 백업' 띠가 뜹니다." checked={s.enabled} onChange={(enabled) => set({ enabled })} />
        <div className="flex items-center gap-2 py-1.5 text-xs font-bold text-slate-600">
          <span className="w-16 shrink-0">주기</span>
          <Choices name="auto-backup-interval" value={s.intervalDays} onChange={(intervalDays) => set({ intervalDays })} options={INTERVAL_CHOICES.map((d) => ({ value: d, label: `${d}일마다` }))} />
        </div>
        <div className="flex items-center gap-2 py-1.5 text-xs font-bold text-slate-600">
          <span className="w-16 shrink-0">남길 개수</span>
          <Choices name="auto-backup-keep" value={s.keep} onChange={(keep) => set({ keep })} options={KEEP_CHOICES.map((n) => ({ value: n, label: `최근 ${n}개` }))} />
        </div>
        <p data-auto-backup-last className="mt-2 text-xs text-slate-500">
          {log.lastAt ? (
            <>
              마지막 백업: <b className="text-slate-700">{stamp(log.lastAt)}</b>
              {log.lastName && ` · ${log.lastName}`}
              {log.lastSummary && ` (${log.lastSummary})`}
            </>
          ) : (
            '아직 백업한 적이 없습니다.'
          )}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            data-auto-backup-now
            disabled={!!busy}
            onClick={() => void backupNow()}
            className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl text-xs font-bold disabled:opacity-50 cursor-pointer"
          >
            {busy || '💾 지금 백업'}
          </button>
          {log.folderLink && (
            <a data-auto-backup-folder href={log.folderLink} target="_blank" rel="noreferrer" className="text-xs font-bold text-primary hover:underline">
              드라이브에서 열기 ↗
            </a>
          )}
        </div>
        <p className="mt-2 text-2xs text-slate-400">되살릴 때는 드라이브에서 파일을 내려받아 아래 '백업 파일로 되살리기'로 고릅니다. 공유 그룹 자료는 담지 않습니다.</p>
      </div>
    </Section>
  );
}
