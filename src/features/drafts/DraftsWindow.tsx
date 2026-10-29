// 저장하지 않은 글 (P14-6 ■1b - 10-30 사용자 휴대폰 (a) ②) - 창 'drafts'(오른쪽 칸). 앱을 열 때 띠 '📝 저장하지 않은 글 n개 - 보기'가 연다.
//   이 기기의 쓰던 글 보관(data/drafts)에 남은 메모·일정 글: 끊긴 채 저장하고 앱을 닫았거나, 저장하지 않고 칸을 닫은 것.
//   열기 = 그 칸을 다시 열어 맨 위 '되살리기'(보관은 저장하면 지워진다) · 버리기 = 그 글을 지운다 · 모두 버리기는 묻는다.
import { useState } from 'react';
import type { WindowProps } from '../../app/windows';
import { deleteDraft } from '../../data/drafts';
import { useSession } from '../../data/session';
import ModalShell, { ModalCloseButton } from '../../ui/ModalShell';
import { draftPlaceLabel } from './draftList';
import { openDraftRow } from './open';
import { useDraftRows } from './useDraftRows';

const when = (ms: number) => new Date(ms).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export default function DraftsWindow({ close, raise }: WindowProps) {
  const uid = useSession((s) => s.user?.uid ?? null);
  const rows = useDraftRows(uid);
  const [busy, setBusy] = useState(false);

  const discardAll = async () => {
    if (!uid || !rows?.length) return;
    if (!window.confirm(`저장하지 않은 글 ${rows.length}개를 모두 버릴까요? 되돌릴 수 없습니다.`)) return;
    setBusy(true);
    try {
      for (const r of rows) await deleteDraft(uid, r.key);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalShell isOpen onClose={close} raise={raise} width="lg" title="📝 저장하지 않은 글" footer={<ModalCloseButton onClose={close} />}>
      <div data-drafts-window className="flex flex-col gap-3 p-4 text-sm">
        <p className="text-xs text-slate-500">
          이 기기에만 남아 있는 글입니다(계정에는 올라가지 않았습니다). <b>열기</b>를 누르면 그 칸이 열리고 맨 위 <b>되살리기</b>로 이어 씁니다 - 저장하면 이 목록에서 빠집니다.
        </p>
        {rows === null ? (
          <p className="text-xs text-slate-400">불러오는 중…</p>
        ) : rows.length === 0 ? (
          <p data-drafts-empty className="py-6 text-center text-xs text-slate-400">
            남은 글이 없습니다.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {rows.map((r) => (
              <li key={r.key} data-drafts-row={r.key} className="flex items-center gap-2 rounded-xl border border-border bg-white px-3 py-2">
                <span className="shrink-0 text-base" aria-hidden>
                  {r.place.kind === 'note' ? '📝' : '📅'}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-slate-800">{r.summary}</span>
                  <span className="block text-xs text-slate-500">
                    {draftPlaceLabel(r.place)} · {when(r.savedAt)}
                  </span>
                </span>
                <button
                  type="button"
                  data-drafts-row-open
                  onClick={() => openDraftRow(r)}
                  className="shrink-0 rounded-lg bg-primary px-2.5 py-1 text-xs font-bold text-white hover:bg-blue-600 cursor-pointer"
                >
                  열기
                </button>
                <button
                  type="button"
                  data-drafts-row-discard
                  disabled={busy}
                  onClick={() => uid && void deleteDraft(uid, r.key)}
                  className="shrink-0 rounded-lg px-2 py-1 text-xs font-bold text-slate-500 hover:bg-slate-100 disabled:opacity-50 cursor-pointer"
                >
                  버리기
                </button>
              </li>
            ))}
          </ul>
        )}
        {!!rows?.length && (
          <button
            type="button"
            data-drafts-discard-all
            disabled={busy}
            onClick={() => void discardAll()}
            className="self-end rounded-lg px-2 py-1 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-50 cursor-pointer"
          >
            모두 버리기
          </button>
        )}
      </div>
    </ModalShell>
  );
}
