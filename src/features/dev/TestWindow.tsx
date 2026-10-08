// 점검용 창 (P1-3 - 진짜 창이 들어오기 전까지 껍데기의 창 동작을 본다. 개발·에뮬레이터 빌드에만 등록한다).
import { useState } from 'react';
import { showToast } from '../../app/toast';
import type { WindowProps } from '../../app/windows';
import ModalShell, { ModalCloseButton } from '../../ui/ModalShell';

export default function TestWindow({ params, close, raise }: WindowProps<{ n?: number } | undefined>) {
  const [text, setText] = useState('');
  const [saved, setSaved] = useState('');
  const save = () => {
    setSaved(text);
    showToast(`✅ 시험 창 저장: ${text}`);
  };
  return (
    <ModalShell
      isOpen
      onClose={close}
      raise={raise}
      title={`시험 창${params?.n ? ` ${params.n}` : ''}`}
      onSave={save}
      footer={
        <>
          <ModalCloseButton onClose={close} />
          <button type="button" onClick={save} className="px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold">
            저장
          </button>
        </>
      }
    >
      <div data-test-window data-saved={saved} className="space-y-2">
        <input
          data-test-input
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
          placeholder="아무 글이나"
        />
      </div>
    </ModalShell>
  );
}
