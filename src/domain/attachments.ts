// 붙임 파일 가려내기·이름·크기 (V4 lib/attachments.ts + EntryDrawer의 getFileIcon·formatFileSize + usePasteImageUpload의 이름).
// 그림인지 가리는 규칙은 여기 한 곳에만 둔다(V4: 세 화면에 같은 정규식이 복사돼 한 곳만 고치고 나머지를 잊었다).
import type { Attachment } from '../data/types';

/** 화면에 걸 그림 (크게 보기) */
export interface ViewerImage {
  url: string;
  name: string;
}

const IMAGE_EXT = /\.(jpg|jpeg|png|gif|webp|bmp|heic|avif|svg)(\?.*)?$/i;

/**
 * 붙임 하나가 그림인가.
 * V4 기록은 type에 'image', 메모는 'image/png' 같은 MIME을 적었다 - 둘 다 받는다.
 * type이 비어 있는 옛 자료는 확장자를 본다. 드라이브 주소에는 확장자가 없어 이름도 본다.
 */
export function isImageAttachment(att: Partial<Attachment> | null | undefined): boolean {
  if (!att) return false;
  const type = att.type || '';
  if (type === 'image' || type.startsWith('image/')) return true;
  return IMAGE_EXT.test(att.url || '') || IMAGE_EXT.test(att.name || '');
}

/** 파일 종류 그림 (V4 EntryDrawer getFileIcon) */
export function fileIcon(att: Partial<Attachment>): string {
  const name = att.name || '';
  const type = att.type || '';
  if (isImageAttachment(att)) return '🖼️';
  if (type.includes('pdf') || /\.pdf$/i.test(name)) return '📄';
  if (/\.(doc|docx|hwp|hwpx|txt)$/i.test(name)) return '📝';
  if (/\.(xls|xlsx|csv)$/i.test(name)) return '📊';
  if (/\.(zip|7z|tar|gz|rar)$/i.test(name)) return '🗜️';
  return '📁';
}

/** 1.5 MB처럼 (모르면 빈 글) */
export function formatFileSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const EXT_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

/**
 * 캡처를 Ctrl+V로 붙였을 때의 파일 이름 - '붙여넣은_이미지_20261008_142530.png' (여러 장이면 _2, _3).
 * 클립보드 그림은 이름이 없거나 모두 'image.png'라 그대로 두면 구분이 안 된다.
 */
export function pastedImageName(index: number, mimeType: string, now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}_${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}`;
  const suffix = index > 0 ? `_${index + 1}` : '';
  return `붙여넣은_이미지_${stamp}${suffix}.${EXT_BY_MIME[mimeType] || 'png'}`;
}

/**
 * 새 붙임의 모양. V5는 type에 MIME을 적는다(V4 메모 모양 - 기록 모양 'image'/'file'도 isImageAttachment가 읽는다).
 * 값이 없는 칸은 넣지 않는다(undefined 칸 하나로 저장이 통째로 막히던 V4).
 */
export function makeAttachment(file: { name: string; type?: string; size?: number }, url: string, driveId?: string, seq = 0, now = Date.now()): Attachment {
  return {
    id: `file_${now}_${seq}`,
    name: file.name,
    url,
    type: file.type || 'application/octet-stream',
    ...(typeof file.size === 'number' ? { size: file.size } : {}),
    ...(driveId ? { driveId } : {}),
  };
}
