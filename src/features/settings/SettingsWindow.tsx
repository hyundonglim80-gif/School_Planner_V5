// ⚙️ 환경설정 창 (MENU 3-6, V4 components/SettingsModal.tsx). 탭: 보기 · 알림 · 학교 · 단축키 · 앱 · 가져오기 · 개발자.
// 그 기능이 V5로 옮겨 오기 전에는 탭·칸을 숨긴다(빈 탭을 보이지 않는다) - 기능을 옮기는 세션이 아래 표의 ready를 켜고 칸을 더한다.
// 계정에 PC·휴대폰 따로 올라가는 값이 대부분이다(app/prefs). 휴지통 자동 비우기·드라이브 백업·교시 이름은 그 기능 창 안으로 옮겼다(MENU 3-7).
import { useCallback, useRef, useState } from 'react';
import type { WindowProps } from '../../app/windows';
import ModalShell, { ModalCloseButton } from '../../ui/ModalShell';
import AppTab from './AppTab';
import ImportTab from './ImportTab';
import SchoolTab from './SchoolTab';
import ShortcutsTab, { type ShortcutsTabHandle } from './ShortcutsTab';
import ViewTab from './ViewTab';

export type SettingsTabId = 'view' | 'notify' | 'school' | 'shortcuts' | 'app' | 'import' | 'dev';

const TABS: ReadonlyArray<{ id: SettingsTabId; label: string; ready: boolean }> = [
  { id: 'view', label: '보기', ready: true },
  // 일정 알림(앱을 닫아도) - P8-2 서버 푸시
  { id: 'notify', label: '알림', ready: false },
  // 이월 기간(P3-3) · 교사 유형 → 시간표 창 P6-1 · 우리 학교 P6-3
  { id: 'school', label: '학교', ready: true },
  { id: 'shortcuts', label: '단축키', ready: true },
  { id: 'app', label: '앱', ready: true },
  // V4 자료 가져오기 (P2-4) - P8-3에서 '백업 · 가져오기 · 보내기' 창의 '가져오기' 탭으로 옮긴다
  { id: 'import', label: '가져오기', ready: true },
  // 개발자 계정만 - 공휴일 P5-3 · 나이스 키 P6-3 · 공유 그룹 점검 P8-4 (라벨 상태는 '앱' 탭 '이 기기 사본'이 맡는다 - P2-3,
  // V4 labelDiagnostics는 라벨 문서를 못 읽어 기본값으로 때웠는지를 가리던 것 - V5는 라벨이 문서마다라 그런 때우기가 없다)
  { id: 'dev', label: '개발자', ready: false },
];

const SETTINGS_TABS = TABS.filter((t) => t.ready);

export default function SettingsWindow({ params, close, raise }: WindowProps<{ tab?: SettingsTabId } | undefined>) {
  const first = SETTINGS_TABS.find((t) => t.id === params?.tab)?.id ?? 'view';
  const [tab, setTab] = useState<SettingsTabId>(first);
  // 열려 있는 창을 다른 탭으로 다시 열면(처음 로그인 띠의 '가져오기' 등) 그 탭으로
  const [askedTab, setAskedTab] = useState(params?.tab);
  if (params?.tab !== askedTab) {
    setAskedTab(params?.tab);
    if (SETTINGS_TABS.some((t) => t.id === params?.tab)) setTab(params!.tab!);
  }
  const shortcuts = useRef<ShortcutsTabHandle | null>(null);
  const [status, setStatus] = useState({ dirty: false, conflict: null as string | null, saved: false });
  const onStatus = useCallback((s: typeof status) => setStatus(s), []);

  return (
    <ModalShell
      isOpen
      onClose={close}
      raise={raise}
      width="lg"
      title="⚙️ 환경설정"
      bare
      // Ctrl+S = 단축키 '저장' (다른 탭은 누르는 즉시 바뀌어 저장할 것이 없다)
      onSave={() => {
        if (status.dirty) shortcuts.current?.save();
      }}
      footer={
        <>
          {tab === 'shortcuts' && status.saved && <span className="text-emerald-500 text-xs font-bold mr-auto">✅ 저장되었습니다</span>}
          {tab === 'shortcuts' && !status.saved && status.conflict && (
            <span data-shortcut-conflict className="text-red-500 text-xs font-bold mr-auto">
              겹치는 단축키가 있습니다 ({status.conflict})
            </span>
          )}
          {tab === 'shortcuts' && (
            <button
              type="button"
              data-shortcut-reset
              onClick={() => shortcuts.current?.reset()}
              className="px-4 py-2 bg-white border border-slate-200 hover:border-slate-300 text-slate-600 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              기본값으로
            </button>
          )}
          <ModalCloseButton onClose={close} />
          {tab === 'shortcuts' && (
            <button
              type="button"
              data-shortcut-save
              onClick={() => shortcuts.current?.save()}
              className="px-5 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              저장
            </button>
          )}
        </>
      }
    >
      <div data-settings-window>
        <div role="tablist" className="flex gap-1 px-4 pt-3 border-b border-slate-100 sticky top-0 bg-white z-10">
          {SETTINGS_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              data-settings-tab={t.id}
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-2 -mb-px text-sm font-bold border-b-2 transition-colors cursor-pointer ${
                tab === t.id ? 'border-primary text-primary' : 'border-transparent text-slate-400 hover:text-slate-700'
              }`}
            >
              {t.label}
              {t.id === 'shortcuts' && status.dirty && <span className="ml-1 text-amber-500">●</span>}
            </button>
          ))}
        </div>
        {/* 탭을 바꿔도 단축키를 고치던 것이 남게 숨기기만 한다 */}
        <div role="tabpanel" data-settings-panel="view" hidden={tab !== 'view'}>
          <ViewTab />
        </div>
        <div role="tabpanel" data-settings-panel="school" hidden={tab !== 'school'}>
          <SchoolTab />
        </div>
        <div role="tabpanel" data-settings-panel="shortcuts" hidden={tab !== 'shortcuts'}>
          <ShortcutsTab ref={shortcuts} onStatus={onStatus} />
        </div>
        <div role="tabpanel" data-settings-panel="app" hidden={tab !== 'app'}>
          <AppTab />
        </div>
        <div role="tabpanel" data-settings-panel="import" hidden={tab !== 'import'}>
          <ImportTab />
        </div>
      </div>
    </ModalShell>
  );
}
