// 개발자 탭 '오류 기록' (P14-2 ■5). 사용자 화면에서 난 오류(v5Errors - data/errorReport)를 최근 50건 읽어 같은 문장끼리 묶어 보인다.
// 묶음을 누르면 가장 나중 것의 스택·컴포넌트·화면·브라우저. [모두 지우기]는 읽어 온 것을 지운다(30일이 지나면 TTL이 저절로 지운다).
import { useCallback, useEffect, useState } from 'react';
import { showErrorToast, showToast } from '../../app/toast';
import { deleteErrorReports, loadErrorReports } from '../../data/errorReport';
import { groupErrors, type ErrorGroup } from '../../domain/errorReport';
import { Section } from './parts';

const KIND_LABEL: Record<ErrorGroup['kind'], string> = { error: '오류', rejection: '약속 거절', react: '그리기', toast: '안내' };

const p2 = (n: number) => String(n).padStart(2, '0');
const timeLabel = (ms: number) => {
  if (!ms) return '';
  const d = new Date(ms);
  return `${d.getMonth() + 1}/${d.getDate()} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
};

export default function DevErrorsSection() {
  const [groups, setGroups] = useState<ErrorGroup[] | null>(null);
  const [failed, setFailed] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    setFailed('');
    try {
      setGroups(groupErrors(await loadErrorReports()));
    } catch (e) {
      setFailed(String((e as { code?: string })?.code || (e as Error)?.message || e));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const clearAll = async () => {
    const ids = (groups ?? []).flatMap((g) => g.ids);
    if (ids.length === 0 || !window.confirm(`오류 기록 ${ids.length}건을 지울까요?`)) return;
    setBusy(true);
    try {
      await deleteErrorReports(ids);
      showToast(`🗑️ 오류 기록 ${ids.length}건을 지웠습니다.`);
      await load();
    } catch (e) {
      showErrorToast('오류 기록을 지우지 못했습니다.', e);
    } finally {
      setBusy(false);
    }
  };

  const total = (groups ?? []).reduce((n, g) => n + g.count, 0);
  return (
    <Section id="dev-errors" title="오류 기록" desc="사용자 화면에서 난 오류가 글 내용 없이 모입니다(최근 50건, 같은 문장끼리 묶음 - 30일 뒤 저절로 지워짐).">
      <div className="flex items-center gap-2 mb-2">
        <span data-errors-total={total} className="text-xs text-slate-500 mr-auto">
          {groups === null ? (failed ? '' : '읽는 중…') : `${groups.length}가지 · ${total}건`}
        </span>
        <button
          type="button"
          data-errors-reload
          disabled={busy}
          onClick={() => void load()}
          className="px-3 py-1.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-600 rounded-lg text-xs font-bold cursor-pointer disabled:opacity-50"
        >
          🔄 새로 읽기
        </button>
        <button
          type="button"
          data-errors-clear
          disabled={busy || total === 0}
          onClick={() => void clearAll()}
          className="px-3 py-1.5 bg-white border border-red-200 hover:border-red-300 text-red-500 rounded-lg text-xs font-bold cursor-pointer disabled:opacity-40"
        >
          🗑️ 모두 지우기
        </button>
      </div>
      {failed && (
        <p data-errors-failed className="text-xs text-red-500">
          읽지 못했습니다 ({failed})
        </p>
      )}
      {groups?.length === 0 && <p data-errors-empty className="text-xs text-slate-400">오류 기록이 없습니다.</p>}
      <ul className="space-y-1.5">
        {groups?.map((g) => {
          const key = g.latest.id;
          const shown = open === key;
          return (
            <li key={key} data-error-group={g.message} className="border border-slate-100 rounded-lg">
              <button
                type="button"
                data-error-toggle
                aria-expanded={shown}
                onClick={() => setOpen(shown ? null : key)}
                className="w-full text-left px-3 py-2 cursor-pointer hover:bg-slate-50 rounded-lg"
              >
                <div className="flex items-start gap-2">
                  <span data-error-count={g.count} className="shrink-0 min-w-6 text-center text-[11px] font-black text-white bg-red-400 rounded-full px-1.5">
                    {g.count}
                  </span>
                  <span className="text-xs font-bold text-slate-700 break-all">{g.message}</span>
                </div>
                <div className="text-[11px] text-slate-400 mt-1 pl-8">
                  {KIND_LABEL[g.kind] ?? g.kind} · {timeLabel(g.lastAt)} · 판 {g.builds.join(', ')} · {g.devices.join(', ')}
                </div>
              </button>
              {shown && (
                <div data-error-detail className="px-3 pb-2 pl-11 text-[11px] text-slate-500 space-y-1">
                  <div>
                    화면 {g.latest.scope || '-'} · {g.latest.ua}
                  </div>
                  {g.latest.note && <pre className="whitespace-pre-wrap break-all bg-slate-50 rounded p-2">{g.latest.note}</pre>}
                  <pre data-error-stack className="whitespace-pre-wrap break-all bg-slate-50 rounded p-2">
                    {g.latest.stack || '(스택 없음)'}
                  </pre>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
