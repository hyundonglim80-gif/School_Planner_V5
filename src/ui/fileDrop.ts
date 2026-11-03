// 윈도우 파일 끌어다 놓기 (P21-1 - PLAN 6장 P21). 놓기는 파일만 건네고, 올리기는 📎와 같은 길(notes/attach)이다.
//   - 파일 끌기('Files')만 받는다 - 일정·자리표 끌기, 글 고르기 끌기는 그대로.
//   - 앱 안에서 시작한 끌기는 받지 않는다 - 화면의 그림을 끌어도 'Files'가 들어, 첨부 그림을 살짝 끌면 한 벌 더 올라간다.
//   - 놓는 칸 밖에 떨어뜨리면 브라우저가 그 파일을 열어 앱이 바뀐다(쓰던 글을 잃는다) → guardWindowFileDrop(앱 시작에 한 번).
import { useRef, useState, type DragEvent } from 'react';
import { showToast } from '../app/toast';

/** 올리는 동안 또 놓았을 때 (칸마다 올리는 일은 한 번에 하나) */
export const DROP_BUSY_TEXT = '파일을 올리는 중입니다. 끝난 뒤 다시 놓아 주세요.';

let dragFromApp = false;

const hasFiles = (data: DataTransfer | null) => !!data && data.types.includes('Files');
const isFileDrag = (data: DataTransfer | null) => !dragFromApp && hasFiles(data);

/** 놓은 것의 파일과 폴더 수. 폴더도 files에 파일처럼 들어 있어 가른다(놓은 그 박자에만 읽힌다) */
export function droppedFiles(data: DataTransfer): { files: File[]; folders: number } {
  const files: File[] = [];
  let folders = 0;
  for (const item of Array.from(data.items)) {
    if (item.kind !== 'file') continue;
    if (item.webkitGetAsEntry()?.isDirectory) {
      folders += 1;
      continue;
    }
    const file = item.getAsFile();
    if (file) files.push(file);
  }
  return { files, folders };
}

/**
 * 칸 상자에 펼칠 dropProps와 끌고 있는지(over - 덮개 FileDropCover를 보일 때).
 * disabled면 받지 않는다(덮개도 없고 마우스는 🚫).
 */
export function useFileDrop(onFiles: (files: File[]) => void, { disabled = false }: { disabled?: boolean } = {}) {
  const [over, setOver] = useState(false);
  // 칸 안의 자식을 지날 때마다 enter·leave가 난다 - 수를 세어 정말 나갔을 때만 끈다(덮개가 깜빡이지 않게).
  // disabled여도 센다 - 끄는 도중에 disabled가 바뀌어도 수가 어긋나지 않게
  const depth = useRef(0);
  const dropProps = {
    onDragEnter: (e: DragEvent) => {
      if (!isFileDrag(e.dataTransfer)) return;
      depth.current += 1;
      setOver(true);
    },
    onDragOver: (e: DragEvent) => {
      if (disabled || !isFileDrag(e.dataTransfer)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    },
    onDragLeave: () => {
      depth.current = Math.max(0, depth.current - 1);
      if (depth.current === 0) setOver(false);
    },
    onDrop: (e: DragEvent) => {
      if (!isFileDrag(e.dataTransfer)) return;
      depth.current = 0;
      setOver(false);
      if (disabled) return;
      e.preventDefault();
      const { files, folders } = droppedFiles(e.dataTransfer);
      if (folders > 0) showToast('폴더는 첨부할 수 없습니다.');
      if (files.length > 0) onFiles(files);
    },
  };
  return { over: over && !disabled, dropProps };
}

/**
 * 앱 시작에 한 번 - 놓는 칸이 받지 않은 파일은 아무 일도 없게 한다(마우스는 🚫).
 * 보이는 파일 칸(백업 복원 등)은 브라우저가 받는 그대로 둔다. 돌려주는 함수 = 걷기.
 */
export function guardWindowFileDrop(): () => void {
  const block = (e: globalThis.DragEvent) => {
    if (e.defaultPrevented || !hasFiles(e.dataTransfer)) return;
    if (e.target instanceof HTMLInputElement && e.target.type === 'file') return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'none';
  };
  const dragStart = () => {
    dragFromApp = true;
  };
  const dragEnd = () => {
    dragFromApp = false;
  };
  // 다른 날로 옮긴 일정처럼 끌던 것이 놓자마자 사라지면 dragend가 창까지 오지 않는다 - 그대로 두면 다음 파일 끌기를 받지 못한다.
  // 놓는 칸이 먼저 보도록 한 박자 뒤에 푼다
  const dropped = () => setTimeout(dragEnd);
  window.addEventListener('dragover', block);
  window.addEventListener('drop', block);
  // 카드 끌기는 onDragStart·onDrop에서 stopPropagation을 한다 - capture로 먼저 듣는다
  window.addEventListener('dragstart', dragStart, true);
  window.addEventListener('dragend', dragEnd, true);
  window.addEventListener('drop', dropped, true);
  return () => {
    window.removeEventListener('dragover', block);
    window.removeEventListener('drop', block);
    window.removeEventListener('dragstart', dragStart, true);
    window.removeEventListener('dragend', dragEnd, true);
    window.removeEventListener('drop', dropped, true);
    dragFromApp = false;
  };
}
