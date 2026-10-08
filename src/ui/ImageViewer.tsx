// 사진 크게 보기 (V4 components/ImageViewerModal.tsx). Shell에 하나 - 상태는 ui/imageViewer.
//   - 여러 장이면 ‹ › · 휴대폰은 옆으로 밀어 넘긴다, 위에 (2/5).
//   - '원본' = 새 탭에서 원래 크기. ✕·바깥 누르기·ESC로 닫는다 - ESC는 이 창만(뒤의 쓰는 칸은 그대로).
//   - 그림은 화면 가운데에 띄운다(창 위치 설정과 상관없이 - 오른쪽 칸에 넣으면 작아진다).
import { useEffect, useRef } from 'react';
import { useModalLayer } from '../app/history';
import { closeImageViewer, stepImageViewer, useImageViewer } from './imageViewer';
import { useBackdropClose } from './useBackdropClose';
import { useBodyScrollLock } from './useBodyScrollLock';
import { useVisualViewport } from './useVisualViewport';

/** 이만큼 옆으로 밀면 넘긴다 (px) */
const SWIPE_PX = 50;

export default function ImageViewer() {
  const { images, index, frame, footer } = useImageViewer();
  const isOpen = images.length > 0;
  useBodyScrollLock(isOpen);
  const vv = useVisualViewport(isOpen);
  const zIndex = useModalLayer(isOpen, closeImageViewer);
  const backdrop = useBackdropClose(closeImageViewer);
  const touchX = useRef<number | null>(null);

  // ESC는 이 창만 닫는다 - 앱 키 처리(window 거품 단계)보다 먼저 받아 멈춘다
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      e.preventDefault();
      closeImageViewer();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [isOpen]);

  if (!isOpen) return null;
  const current = images[index] ?? images[0];
  const many = images.length > 1;

  return (
    <div
      data-image-viewer
      className="fixed inset-0 flex items-center justify-center overflow-y-auto p-4 bg-black/80 backdrop-blur-sm"
      style={{ left: vv.left, top: vv.top, width: vv.width, height: vv.height, zIndex }}
      {...backdrop}
    >
      <div
        className="relative w-full max-w-3xl max-h-full flex flex-col gap-2"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => {
          touchX.current = e.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(e) => {
          const start = touchX.current;
          touchX.current = null;
          const end = e.changedTouches[0]?.clientX;
          if (!many || start === null || end === undefined || Math.abs(end - start) < SWIPE_PX) return;
          stepImageViewer(end < start ? 1 : -1);
        }}
      >
        <div className="flex items-center justify-between gap-2 text-white">
          <span className="text-xs font-bold truncate" title={current.name} data-image-viewer-title>
            🖼️ {current.name || '첨부 이미지'}
            {many ? ` (${index + 1}/${images.length})` : ''}
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href={current.url}
              target="_blank"
              rel="noopener noreferrer"
              data-image-viewer-original
              className="px-2.5 py-1 text-xs font-bold bg-white/15 hover:bg-white/25 rounded-lg transition-colors"
              title="새 탭에서 원본 보기"
            >
              원본
            </a>
            <button
              type="button"
              data-image-viewer-close
              onClick={closeImageViewer}
              className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/15 hover:bg-white/25 font-bold transition-colors cursor-pointer"
              title="닫기"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="relative flex items-center justify-center bg-black/40 rounded-2xl overflow-hidden">
          <img
            src={current.url}
            alt={current.name || '첨부 이미지'}
            data-image-viewer-img={index}
            data-viewer-frame={frame}
            draggable={false}
            className={frame === 'portrait' ? 'w-[min(80vw,24rem,52.5vh)] aspect-[3/4] object-contain' : 'max-w-full max-h-[70vh] object-contain'}
          />
          {many && (
            <>
              <button
                type="button"
                data-image-viewer-prev
                onClick={() => stepImageViewer(-1)}
                className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors cursor-pointer"
                title="이전 이미지"
              >
                ‹
              </button>
              <button
                type="button"
                data-image-viewer-next
                onClick={() => stepImageViewer(1)}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors cursor-pointer"
                title="다음 이미지"
              >
                ›
              </button>
            </>
          )}
        </div>

        {footer && <div className="flex items-center justify-center gap-2 pt-1">{footer}</div>}
      </div>
    </div>
  );
}
