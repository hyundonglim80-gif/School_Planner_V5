// 사진 크게 보기의 상태 (V4 ImageViewerModal을 화면마다 들던 것을 한 곳으로 - ui/ImageViewer가 Shell에 하나).
//   openImageViewer(images, 2)              // 메모·기록 카드·쓰는 칸의 그림
//   openImageViewer([photo], 0, { frame: 'portrait', footer })   // 학생 사진 (P7)
import type { ReactNode } from 'react';
import { create } from 'zustand';
import type { ViewerImage } from '../domain/attachments';

export interface ImageViewerState {
  images: ViewerImage[];
  index: number;
  /** 'portrait' = 학생 사진: 그림 크기와 상관없이 늘 같은 세로 틀(3:4) (V4 2026-10-07 사용자 요청) */
  frame?: 'portrait';
  /** 그림 아래에 붙일 것 (이 그림으로 할 수 있는 일 - 휴대폰은 위쪽이 손가락에서 멀다) */
  footer?: ReactNode;
}

export const useImageViewer = create<ImageViewerState>(() => ({ images: [], index: 0 }));

export function openImageViewer(images: ViewerImage[], index = 0, more: Pick<ImageViewerState, 'frame' | 'footer'> = {}) {
  if (images.length === 0) return;
  useImageViewer.setState({ images, index: Math.min(Math.max(index, 0), images.length - 1), frame: more.frame, footer: more.footer });
}

export function closeImageViewer() {
  useImageViewer.setState({ images: [], index: 0, frame: undefined, footer: undefined });
}

/** 넘기기 (끝에서 처음으로 돈다) */
export function stepImageViewer(delta: number) {
  useImageViewer.setState((s) => (s.images.length ? { index: (s.index + delta + s.images.length) % s.images.length } : s));
}
