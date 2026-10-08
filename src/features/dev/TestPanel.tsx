// 점검용 쓰는 칸 (P1-3 - 메모·기록 칸이 들어오기 전까지 오른쪽 줄·탭·ESC·Ctrl+S를 본다. 개발·에뮬레이터 빌드에만 등록한다).
import { useEffect, useRef, useState } from 'react';
import { showToast } from '../../app/toast';
import { registerUnsavedCheck, type WindowProps } from '../../app/windows';
import SidePanelFrame from '../../ui/SidePanelFrame';

export default function TestPanel({ params, close, raise }: WindowProps<{ n?: number } | undefined>) {
  const [text, setText] = useState('');
  const [saved, setSaved] = useState('');
  // ESC로 모두 닫기 전에 저장 안 한 글을 묻는다
  const unsaved = useRef<(() => boolean) | null>(null);
  useEffect(() => {
    unsaved.current = () => text !== saved;
  });
  useEffect(() => registerUnsavedCheck(unsaved), []);

  const save = () => {
    setSaved(text);
    showToast(`✅ 시험 칸 ${params?.n ?? ''} 저장`);
  };

  return (
    <SidePanelFrame
      ariaLabel={`시험 쓰는 칸${params?.n ? ` ${params.n}` : ''}`}
      onClose={close}
      onBackdropClose={() => {
        save();
        close();
      }}
      onSave={save}
      raise={raise}
    >
      <div data-test-panel={params?.n ?? ''} data-saved={saved} className="flex flex-col h-full">
        <div className="flex items-center justify-between gap-2 px-5 py-3.5 border-b border-slate-100 bg-slate-50/60 shrink-0">
          <h2 className="text-base font-black text-slate-800">시험 쓰는 칸 {params?.n ?? ''}</h2>
          <button type="button" data-close onClick={close} title="닫기" className="w-8 h-8 rounded-xl bg-slate-100 text-slate-500 font-bold">
            ✕
          </button>
        </div>
        <textarea
          data-test-text
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="flex-1 m-4 border border-slate-200 rounded-lg p-3 text-sm"
          placeholder="글을 쓰고 Ctrl+S"
        />
      </div>
    </SidePanelFrame>
  );
}
