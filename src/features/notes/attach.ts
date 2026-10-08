// 쓰는 칸의 첨부 올리기·붙여넣기 (V4 EntryDrawer uploadFiles·handleTablePaste + hooks/usePasteImageUpload).
//   - 📎 파일 첨부 / 캡처 Ctrl+V → 구글 드라이브 School_Planner 폴더에 원본 그대로 올려 붙임으로.
//   - 엑셀·한셀·구글 시트의 표는 표로 - 엑셀은 표와 함께 그 범위의 그림도 복사하므로 그림 올리기보다 먼저 본다(V4 교훈).
//   - 여러 개 중 일부만 올라갔으면 올라간 것은 붙여 둔다(버리면 드라이브에만 남고 다시 올리면 두 벌이 된다 - V4).
import { showErrorToast } from '../../app/toast';
import { makeAttachment, pastedImageName } from '../../domain/attachments';
import { isRealTable, parseClipboardTable, tableSize, type EntryTable } from '../../domain/entryTable';
import { driveUrlToStore, uploadFailReason, uploadToDrive } from '../../data/google/drive';
import type { Attachment } from '../../data/types';

/** 붙여넣은 것 중 그림 파일 */
export function extractImageFiles(data: DataTransfer | null): File[] {
  if (!data) return [];
  const files: File[] = [];
  for (let i = 0; i < data.items.length; i++) {
    const item = data.items[i];
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      const file = item.getAsFile();
      if (file) files.push(file);
    }
  }
  return files;
}

/**
 * 붙여넣은 HTML의 표. null = 표 없음(그림·글자로), 'text' = 칸 하나뿐이라 글자로 붙인다(그림으로 올리지 않는다),
 * { error } = 너무 큰 표.
 */
export function pastedTable(data: DataTransfer | null): EntryTable | 'text' | { error: string } | null {
  const parsed = parseClipboardTable(data?.getData('text/html') || '');
  if (!parsed) return null;
  if ('error' in parsed) return parsed;
  return isRealTable(parsed) ? parsed : 'text';
}

/** 표를 붙였다는 안내 */
export function tablePastedText(t: EntryTable): string {
  const { rows, cols } = tableSize(t);
  return `▦ 표를 붙였습니다 (${rows}행 × ${cols}열)`;
}

/**
 * 파일들을 드라이브에 올려 붙임으로 돌려준다. 실패하면 안내하고, 그 앞에 올라간 것만 돌려준다.
 * pasted: 캡처 붙여넣기(이름을 '붙여넣은_이미지_…'로 짓는다).
 */
export async function uploadAttachments(files: File[], pasted = false): Promise<Attachment[]> {
  const done: Attachment[] = [];
  const noun = pasted ? '그림' : '파일';
  try {
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const type = f.type || (pasted ? 'image/png' : '');
      const name = pasted ? pastedImageName(i, type) : f.name;
      const body = pasted ? new File([f], name, { type }) : f;
      const drive = await uploadToDrive(body, name);
      done.push(makeAttachment({ name, type, size: f.size }, driveUrlToStore(type, drive), drive.id, i));
    }
  } catch (e) {
    console.error(`${noun} 올리기 실패:`, e);
    const reason = uploadFailReason(e);
    const why = reason ? `\n${reason}` : '';
    if (done.length > 0) showErrorToast(`${noun} ${files.length}개 중 ${done.length}개만 올렸습니다. 나머지를 다시 ${pasted ? '붙여' : '올려'} 주세요.${why}`, e);
    else showErrorToast(`${pasted ? '이미지' : '파일'} 업로드에 실패했습니다.${why}`, e);
  }
  return done;
}
