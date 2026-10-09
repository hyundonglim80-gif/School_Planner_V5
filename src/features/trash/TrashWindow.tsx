// 휴지통 (V4 components/TrashModal.tsx) - 맨 위 🗑️·단축키 'trash'. 창 'trash'(오른쪽 칸).
//   - 탭: 전체 / 일정 / 기록 / 메모 / 클립보드(이 기기) / 기타(라벨·D-Day …) - 옆 숫자는 그 안의 수.
//   - 항목마다 복원 · 영구 삭제(묻는다 - 되돌릴 수 없다). 고르기·전체 선택(보는 탭만 - 탭을 바꾸면 풀린다)·일괄 복원·일괄 삭제·비우기(탭이면 그 탭만).
//   - ⚙️ 자동 비우기(끄기·7·14·30·60·90일, 계정에 하나 - 기본 끄기): 휴지통의 설정은 휴지통에(MENU.md). 열 때 지난 것은 곧바로 비운다.
//   - V4에서 지워져 가져오기가 지운 표시를 한 것은 'V4에서 지움'.
import { useEffect, useMemo, useRef, useState } from 'react';
import { setCommonSetting, TRASH_DAYS, useCommonSettings } from '../../app/prefs';
import { showToast } from '../../app/toast';
import type { WindowProps } from '../../app/windows';
import { useClipboard } from '../../data/clipboard';
import { useDocs } from '../../data/select';
import { useCurrentSpaceId } from '../../data/session';
import ModalShell, { ModalCloseButton } from '../../ui/ModalShell';
import { purgeEntries, restoreEntries } from './actions';
import { expiredOf, KIND_LABEL, TRASH_TABS, tabOf, trashEntries, type TrashEntry, type TrashTab } from './trashList';

const quiet = () => {
  /* 안내는 저장 도우미가 했다 */
};
const when = (ms: number) => new Date(ms).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export default function TrashWindow({ close, raise }: WindowProps) {
  const sid = useCurrentSpaceId();
  const items = useDocs('items', sid);
  const labels = useDocs('labels', sid);
  const timetables = useDocs('timetables', sid);
  const progress = useDocs('progress', sid);
  const classes = useDocs('classes', sid);
  const ddays = useCommonSettings((s) => s.ddays);
  const trashDays = useCommonSettings((s) => s.trashDays);
  const clips = useClipboard((s) => s.trash);
  const entries = useMemo(() => trashEntries({ items, labels, ddays, clips, timetables, progress, classes }), [items, labels, ddays, clips, timetables, progress, classes]);
  const [tab, setTab] = useState<TrashTab>('all');
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const visible = tab === 'all' ? entries : entries.filter((e) => tabOf(e.kind) === tab);
  const count = (key: TrashTab) => (key === 'all' ? entries.length : entries.filter((e) => tabOf(e.kind) === key).length);
  const tabLabel = TRASH_TABS.find((t) => t.key === tab)!.label;
  const allPicked = visible.length > 0 && visible.every((e) => picked.has(e.key));

  // 열 때 기간이 지난 것은 곧바로 비운다 (V4 - 앱을 열 때 하루 한 번도 돈다, TrashAutoEmpty)
  const swept = useRef(false);
  useEffect(() => {
    if (swept.current || !sid || trashDays <= 0) return;
    const old = expiredOf(entries, trashDays);
    swept.current = true;
    if (old.length) void purgeEntries(sid, old, items, labels, false, timetables, progress, classes).catch(quiet);
  }, [sid, trashDays, entries, items, labels, timetables, progress, classes]);

  const run = async (job: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    try {
      await job();
      setPicked(new Set());
    } catch {
      quiet();
    } finally {
      setBusy(false);
    }
  };
  const restore = (list: readonly TrashEntry[]) => sid && run(() => restoreEntries(sid, list));
  const purge = (list: readonly TrashEntry[], ask: string) => {
    if (!sid || list.length === 0 || !window.confirm(ask)) return;
    void run(async () => {
      const n = await purgeEntries(sid, list, items, labels, true, timetables, progress, classes);
      showToast(`🗑️ ${n}개를 영구 삭제했습니다.`);
    });
  };
  const togglePick = (key: string) => {
    const next = new Set(picked);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setPicked(next);
  };
  const pickedEntries = visible.filter((e) => picked.has(e.key));

  return (
    <ModalShell
      isOpen
      onClose={close}
      raise={raise}
      width="2xl"
      title="🗑️ 휴지통"
      headerExtra={
        <button
          type="button"
          data-trash-settings
          aria-pressed={settingsOpen}
          onClick={() => setSettingsOpen((v) => !v)}
          title="자동 비우기"
          aria-label="자동 비우기 설정"
          className={`w-8 h-8 rounded-xl text-sm cursor-pointer ${settingsOpen ? 'bg-primary/10' : 'bg-slate-100 hover:bg-slate-200'}`}
        >
          ⚙️
        </button>
      }
      footer={<ModalCloseButton onClose={close} />}
    >
      <div data-trash-window className="space-y-3">
        {settingsOpen && (
          <div data-trash-settings-panel className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
            <div className="text-xs font-bold text-slate-700">휴지통 자동 비우기 (계정에 하나)</div>
            <div className="flex flex-wrap gap-1.5">
              {TRASH_DAYS.map((d) => (
                <button
                  key={d}
                  type="button"
                  data-trash-days={d}
                  aria-pressed={trashDays === d}
                  onClick={() => setCommonSetting('trashDays', d)}
                  className={`px-3 py-1 text-xs font-bold rounded-lg border cursor-pointer ${trashDays === d ? 'bg-primary text-white border-primary' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'}`}
                >
                  {d === 0 ? '끄기' : `${d}일`}
                </button>
              ))}
            </div>
            <p className="text-2xs text-slate-500">지운 지 그만큼 지난 항목을 앱을 열 때 영구 삭제합니다(첨부 파일도 정리). 처음에는 꺼져 있습니다.</p>
          </div>
        )}

        <div role="tablist" aria-label="휴지통 종류" className="flex sm:gap-1 overflow-x-auto border-b border-slate-200">
          {TRASH_TABS.map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                data-trash-tab={t.key}
                aria-selected={active}
                onClick={() => {
                  setTab(t.key);
                  // 안 보이는 것을 고른 채로 일괄 처리하지 않게
                  setPicked(new Set());
                }}
                className={`px-2 sm:px-3 py-2 -mb-px border-b-2 text-xs font-bold whitespace-nowrap cursor-pointer ${active ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
              >
                {t.label}
                <span data-trash-count={count(t.key)} className={`ml-1 px-1.5 rounded-full text-2xs ${active ? 'bg-primary/10' : 'bg-slate-100 text-slate-400'}`}>
                  {count(t.key)}
                </span>
              </button>
            );
          })}
        </div>

        <div className="px-3 py-2 rounded-xl bg-amber-50/60 border border-amber-100 flex items-center justify-between gap-2 flex-wrap text-xs">
          <span className="text-slate-600" data-trash-auto={trashDays}>
            {trashDays > 0 ? (
              <>
                🕒 지운 지 <b>{trashDays}일</b>이 지난 항목은 자동으로 영구 삭제됩니다.
              </>
            ) : (
              <>🕒 자동 비우기 꺼짐 - 직접 지우기 전까지 남아 있습니다.</>
            )}
          </span>
          {visible.length > 0 && (
            <button
              type="button"
              data-trash-empty
              disabled={busy}
              onClick={() => purge(visible, `${tab === 'all' ? '휴지통의' : `'${tabLabel}' 탭의`} ${visible.length}개를 모두 영구 삭제할까요? 되돌릴 수 없습니다.`)}
              className="px-3 py-1.5 bg-red-600 text-white hover:bg-red-700 font-bold text-xs rounded-lg disabled:opacity-40 cursor-pointer"
            >
              {tab === 'all' ? '휴지통 비우기' : `${tabLabel} 비우기`}
            </button>
          )}
        </div>

        {visible.length > 0 && (
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <label className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer select-none">
              <input type="checkbox" data-trash-pick-all checked={allPicked} onChange={() => setPicked(allPicked ? new Set() : new Set(visible.map((e) => e.key)))} className="w-4 h-4 rounded" />
              전체 선택{picked.size > 0 && <span className="text-primary">({picked.size}개 선택됨)</span>}
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                data-trash-restore-picked
                disabled={pickedEntries.length === 0 || busy}
                onClick={() => restore(pickedEntries)}
                className="px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 font-bold text-xs rounded-lg disabled:opacity-40 cursor-pointer"
              >
                일괄 복원
              </button>
              <button
                type="button"
                data-trash-purge-picked
                disabled={pickedEntries.length === 0 || busy}
                onClick={() => purge(pickedEntries, `고른 ${pickedEntries.length}개를 영구 삭제할까요? 되돌릴 수 없습니다.`)}
                className="px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 font-bold text-xs rounded-lg disabled:opacity-40 cursor-pointer"
              >
                일괄 삭제
              </button>
            </div>
          </div>
        )}

        {visible.length === 0 ? (
          <div data-trash-empty-note className="text-center py-12 text-slate-400 flex flex-col items-center gap-2">
            <span className="text-4xl opacity-50">🍃</span>
            <p className="text-xs">{tab === 'all' ? '휴지통이 비어 있습니다.' : `지운 ${tabLabel} 항목이 없습니다.`}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {visible.map((e) => (
              <div key={e.key} data-trash-row={e.key} className="bg-white border border-slate-200 rounded-xl p-3 flex items-center gap-3 shadow-xs">
                <input type="checkbox" data-trash-pick={e.key} checked={picked.has(e.key)} onChange={() => togglePick(e.key)} className="w-4 h-4 rounded shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mb-1 text-xs text-slate-500">
                    <span className="font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 whitespace-nowrap">{KIND_LABEL[e.kind]}</span>
                    <span className="whitespace-nowrap">{e.kind === 'clip' ? '이 기기' : (e.when ?? (e.kind === 'memo' ? '메모' : ''))}</span>
                    <span>•</span>
                    <span className="whitespace-nowrap">{when(e.deletedAt)} 삭제</span>
                    {e.byV4 && <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 font-bold" data-trash-v4>V4에서 지움</span>}
                  </div>
                  <p className="text-sm text-slate-700 truncate font-medium">{e.text || '(내용 없음)'}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    data-trash-restore={e.key}
                    disabled={busy}
                    onClick={() => restore([e])}
                    className="px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 font-bold text-xs rounded-lg disabled:opacity-50 cursor-pointer"
                  >
                    복원
                  </button>
                  <button
                    type="button"
                    data-trash-purge={e.key}
                    disabled={busy}
                    onClick={() => purge([e], '이 항목을 영구 삭제할까요? 되돌릴 수 없습니다.')}
                    className="px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 font-bold text-xs rounded-lg disabled:opacity-50 cursor-pointer"
                  >
                    영구 삭제
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </ModalShell>
  );
}
