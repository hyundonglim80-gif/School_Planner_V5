// '💾 백업 · 가져오기 · 보내기' 창 (P8-3 - MENU 2-3, V4 BackupModal·KeepImportModal·CalendarSyncModal·환경설정 가져오기를 한 창에).
// 탭: 백업(JSON·CSV·되살리기) / 가져오기(V4 자료) / 보내기(구글 캘린더). 탭을 바꿔도 적던 것이 남게 숨기기만 한다.
import { useState } from 'react';
import type { WindowProps } from '../../app/windows';
import ModalShell, { ModalCloseButton } from '../../ui/ModalShell';
import CalendarSyncSection from '../gcal/CalendarSyncSection';
import BackupTab from './BackupTab';
import type { BackupParams, BackupTabId } from './open';
import V4ImportSection from './V4ImportSection';

const TABS: ReadonlyArray<{ id: BackupTabId; label: string }> = [
  { id: 'backup', label: '💾 백업' },
  { id: 'import', label: '📥 가져오기' },
  { id: 'send', label: '📤 보내기' },
];

export default function BackupWindow({ params, close, raise }: WindowProps<BackupParams | undefined>) {
  const [tab, setTab] = useState<BackupTabId>(params?.tab ?? 'backup');
  // 열린 창을 다른 탭으로 다시 열면 그 탭으로 (단축키 '구글 캘린더로 보내기' 등)
  const [asked, setAsked] = useState(params?.tab);
  if (params?.tab !== asked) {
    setAsked(params?.tab);
    if (params?.tab) setTab(params.tab);
  }
  return (
    <ModalShell isOpen onClose={close} raise={raise} width="lg" title="💾 백업 · 가져오기 · 보내기" bare footer={<ModalCloseButton onClose={close} />}>
      <div data-backup-window={tab}>
        <div role="tablist" className="flex gap-1 px-4 pt-3 border-b border-slate-100 sticky top-0 bg-white z-10">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              data-backup-tab-btn={t.id}
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-2 -mb-px text-sm font-bold border-b-2 transition-colors cursor-pointer ${
                tab === t.id ? 'border-primary text-primary' : 'border-transparent text-slate-400 hover:text-slate-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div role="tabpanel" data-backup-panel="backup" hidden={tab !== 'backup'}>
          <BackupTab />
        </div>
        <div role="tabpanel" data-backup-panel="import" hidden={tab !== 'import'}>
          <V4ImportSection />
        </div>
        <div role="tabpanel" data-backup-panel="send" hidden={tab !== 'send'}>
          <CalendarSyncSection />
        </div>
      </div>
    </ModalShell>
  );
}
