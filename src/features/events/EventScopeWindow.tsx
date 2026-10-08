// 묶인 일정을 어디까지 (V4 components/GroupDeleteModal.tsx·GroupMoveModal.tsx - 세 갈래를 한 창으로). 창 목록에 등록하지 않는 작은 창.
//
// 기간 일정(한 문서 - 이 날만 = 그날 빼기, 이 날부터 = 끝 날 당기기, 전부 = 지우기)과 반복 일정(문서 여럿 - P3-3 ■4)이 함께 쓴다.
// 이 창 자체가 확인 단계다 - 고를 때 몇 건(며칠)인지 보여 주고, 확인 창을 한 번 더 띄우지 않는다(V4 그대로). 지운 것은 안내의 되돌리기·Ctrl+Z.
import { useState } from 'react';
import ModalShell, { ModalCloseButton } from '../../ui/ModalShell';

export type GroupScope = 'only' | 'after' | 'all';

export interface ScopeChoice {
  key: GroupScope;
  title: string;
  desc: string;
  disabled?: boolean;
}

const TONE: Record<GroupScope, string> = {
  only: 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800',
  after: 'border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700',
  all: 'border-red-300 bg-red-100 hover:bg-red-200 text-red-800',
};

export interface EventScopeWindowProps {
  title: string;
  intro: string;
  choices: readonly ScopeChoice[];
  /** 고른 것 하기 - 실패하면 던진다(창은 닫지 않는다) */
  onPick: (scope: GroupScope) => Promise<void>;
  onClose: () => void;
  footnote?: string;
}

export default function EventScopeWindow({ title, intro, choices, onPick, onClose, footnote }: EventScopeWindowProps) {
  const [busy, setBusy] = useState<GroupScope | null>(null);
  const pick = async (scope: GroupScope) => {
    if (busy) return;
    setBusy(scope);
    try {
      await onPick(scope);
      onClose();
    } catch {
      // 안내는 저장 도우미가 했다 - 창은 그대로
    } finally {
      setBusy(null);
    }
  };

  return (
    <ModalShell isOpen onClose={onClose} width="sm" title={title} footer={<ModalCloseButton onClose={onClose} />}>
      <div data-scope-window className="space-y-3">
        <p className="text-xs text-slate-600 leading-relaxed">{intro}</p>
        {choices.map((c) => (
          <button
            key={c.key}
            type="button"
            data-scope-choice={c.key}
            onClick={() => void pick(c.key)}
            disabled={busy !== null || c.disabled}
            className={`w-full text-left px-3.5 py-3 rounded-xl border disabled:opacity-40 transition-colors cursor-pointer ${TONE[c.key]}`}
          >
            <span className="block text-xs font-bold">{c.title}</span>
            <span className="block mt-0.5 text-xs opacity-80">{c.desc}</span>
          </button>
        ))}
        {footnote && <p className="text-xs text-slate-400">{footnote}</p>}
      </div>
    </ModalShell>
  );
}
