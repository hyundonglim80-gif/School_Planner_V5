// 📋 클립보드 목록 칸 ClipboardPanel (P47-1 ClipboardColumn에서 나눔 - P49-3: 창 칸의 클립보드 탭(ClipboardWindow)·클립보드 팝업창(ClipboardPopout)이 함께 쓴다.
//   둘 다 나눠 받으므로 목록 칸은 탭을 열 때만 받는다 - 늘 있는 것은 화면 가장자리 📋 단추(ClipboardColumn)뿐).
//   - 복사한 것(글자·캡처 그림)을 최신 것이 위로. 모으는 규칙은 data/clipboard, 붙여넣기는 ./paste.
//   - 항목을 누르면 마지막으로 글을 쓰던 칸에 붙여넣는다 - 누르는 순간 그 칸의 커서를 빼앗지 않게(mousedown 기본 동작을 막는다).
import { useEffect, useMemo, useState } from 'react';
import { showErrorToast, showToast } from '../../app/toast';
import { clearClips, clipboardReadGranted, readSystemClipboard, removeClip, useClipboard, type ClipItem } from '../../data/clipboard';
import { containScroll } from '../../ui/containScroll';
import { type PasteResult } from './paste';

function timeLabel(ms: number) {
  const d = new Date(ms);
  const now = new Date();
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  if (d.toDateString() === now.toDateString()) return hm;
  return `${d.getMonth() + 1}/${d.getDate()} ${hm}`;
}

/** 항목 누르기 = 붙여넣기 (왼쪽 칸은 이 창의 글 칸에, 클립보드 팝업창은 마지막으로 글을 쓰던 창에 - popupClip) */
type Paste = (item: ClipItem) => Promise<PasteResult>;

function ClipRow({ item, pasteWith }: { item: ClipItem; pasteWith: Paste }) {
  const url = useMemo(() => (item.blob && typeof URL.createObjectURL === 'function' ? URL.createObjectURL(item.blob) : null), [item.blob]);
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );

  const paste = async () => {
    const r = await pasteWith(item);
    if (r === 'copied') showToast('📋 붙여넣을 칸이 없어 클립보드에 담았습니다. 원하는 곳에서 Ctrl+V 하세요.');
    if (r === 'failed') showErrorToast('붙여넣지 못했습니다. 글을 쓸 칸을 먼저 눌러 주세요.');
  };

  return (
    <li className="group relative" data-clip-item={item.kind}>
      <button
        type="button"
        data-clip-paste={item.id}
        // 누르는 순간 글을 쓰던 칸의 커서를 빼앗지 않는다 (그래야 그 자리에 넣는다)
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => void paste()}
        title="눌러서 붙여넣기"
        className="w-full text-left px-3 py-2.5 rounded-xl border border-slate-200 bg-white hover:border-primary hover:bg-primary/5 transition-colors cursor-pointer"
      >
        <span className="block text-2xs font-bold text-slate-400 mb-1">
          {item.kind === 'image' ? '🖼️ 그림' : '📝 글자'} · {timeLabel(item.createdAt)}
        </span>
        {item.kind === 'image' && url ? (
          <img src={url} alt="복사한 그림" className="max-h-40 max-w-full rounded-lg border border-slate-100 object-contain" />
        ) : (
          <span className="block text-xs text-slate-700 whitespace-pre-wrap break-words line-clamp-6">{item.text}</span>
        )}
      </button>
      <button
        type="button"
        data-clip-remove={item.id}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => void removeClip(item.id)}
        title="휴지통으로 (휴지통에서 되살릴 수 있다)"
        aria-label="이 항목 휴지통으로"
        className="absolute top-1.5 right-1.5 w-6 h-6 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity cursor-pointer"
      >
        ✕
      </button>
    </li>
  );
}

/** 칸 위의 휠은 칸 안에서만 (P10-5 - 목록이 짧거나 끝에 닿아도 뒤 화면을 움직이지 않게) */
const containRef = (el: HTMLElement | null) => (el ? containScroll(el) : undefined);

/**
 * 클립보드 목록 칸 (창 칸의 탭과 클립보드 팝업창이 함께 쓴다 - #140). onClose = ✕·ESC, pasteWith = 항목 누르기, hint = 머리 아래 안내.
 * titled = 제목·✕를 이 칸이 그린다(팝업창). 창 칸 탭은 창 틀(ModalShell)이 제목·✕를 그려 false.
 */
export function ClipboardPanel({ onClose, pasteWith, hint, titled = true }: { onClose: () => void; pasteWith: Paste; hint: string; titled?: boolean }) {
  const items = useClipboard((s) => s.items);
  const [granted, setGranted] = useState(true);

  useEffect(() => {
    void clipboardReadGranted().then(setGranted);
  }, []);

  const fetchNow = async () => {
    const r = await readSystemClipboard(true);
    setGranted(await clipboardReadGranted());
    if (r === 'denied') showErrorToast('클립보드를 읽지 못했습니다. 주소창 왼쪽의 사이트 설정에서 클립보드를 허용해 주세요.');
    if (r === 'unsupported') showErrorToast('이 브라우저는 클립보드 읽기를 지원하지 않습니다.');
  };

  return (
    <aside
      ref={containRef}
      data-clipboard-panel
      aria-label="클립보드"
      className="bg-white h-full flex flex-col overflow-y-auto overscroll-contain"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-slate-100 px-4 py-3">
        {titled && (
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-black text-slate-800">📋 클립보드</h2>
          <button
            type="button"
            data-clipboard-close
            onClick={onClose}
            title="닫기"
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>
        )}
        <p className={`text-2xs text-slate-400 ${titled ? 'mt-1' : ''}`}>{hint}</p>
        <div className="flex items-center gap-1.5 mt-2">
          <button
            type="button"
            data-clipboard-fetch
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => void fetchNow()}
            title="다른 프로그램에서 복사·캡처한 것을 지금 가져옵니다"
            className="px-2.5 py-1.5 rounded-lg bg-primary text-white text-2xs font-bold hover:bg-primary/90 cursor-pointer"
          >
            ⤓ 가져오기
          </button>
          {items.length > 0 && (
            <button
              type="button"
              data-clipboard-clear
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                if (window.confirm(`클립보드 목록 ${items.length}개를 모두 휴지통으로 옮길까요?`)) void clearClips();
              }}
              className="px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-500 text-2xs font-bold hover:bg-slate-200 cursor-pointer"
            >
              모두 지우기
            </button>
          )}
        </div>
        {!granted && (
          <p className="text-2xs text-amber-600 mt-1.5">다른 프로그램에서 복사한 것과 캡처 그림은 '가져오기'를 눌러 한 번 허락하면 자동으로 모입니다.</p>
        )}
      </div>
      {items.length === 0 ? (
        <p className="px-4 py-10 text-center text-xs text-slate-400" data-clipboard-empty>
          아직 복사한 것이 없습니다.
          <br />
          글자를 Ctrl+C 하거나 '가져오기'를 눌러 보세요.
        </p>
      ) : (
        <ul className="p-3 space-y-2">
          {items.map((it) => (
            <ClipRow key={it.id} item={it} pasteWith={pasteWith} />
          ))}
        </ul>
      )}
    </aside>
  );
}
