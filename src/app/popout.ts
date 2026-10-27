// 오른쪽 칸 하나를 새 창으로 옮긴다 (10-28 사용자 요청 - 머리 ↗, 설명은 ui/popout).
//   1. 누른 그때 빈 새 창부터 연다 - 저장을 기다린 뒤에 열면 브라우저가 팝업으로 보고 막는다.
//   2. 저장하지 않은 것이 있으면 그 창의 저장(Ctrl+S와 같다)을 하고 끝나기를 기다린다. 저장 단추가 없는 창이거나 저장이 안 되면 옮기지 않는다.
//   3. 새 창을 그 창의 주소(?popout=)로 보내고, 여기 오른쪽 칸의 그 탭은 닫는다.
import { POPOUT, popoutUrl } from '../ui/popout';
import { getSideColumn } from '../ui/sideColumn';
import { showToast } from './toast';
import { closeWindow, useWindows, windowSaveOf, windowUnsaved } from './windows';

/** 저장이 끝나기를 이만큼 기다린다 */
const SAVE_WAIT_MS = 8000;

const findWindow = (key: number) => useWindows.getState().windows.find((w) => w.key === key);

/** 새 창 자리 - 지금 창의 오른쪽 칸 자리에 그 폭으로 (거기서 끌어 다른 모니터로 옮긴다) */
function popupFeatures(): string {
  const colW = getSideColumn().offsetWidth || 512;
  const width = Math.max(420, Math.min(colW + 16, 900));
  const height = Math.max(480, window.outerHeight - 80);
  const left = Math.max(0, window.screenX + window.outerWidth - width - 8);
  const top = Math.max(0, window.screenY + 40);
  return `popup=yes,width=${width},height=${height},left=${left},top=${top}`;
}

function until(ok: () => boolean, ms: number): Promise<boolean> {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const tick = () => {
      if (ok()) resolve(true);
      else if (Date.now() - t0 > ms) resolve(false);
      else setTimeout(tick, 100);
    };
    tick();
  });
}

/** 창(창 목록의 key)을 새 창으로 옮긴다. 누른 일(click) 안에서 부른다 */
export async function popOutWindow(key: number): Promise<void> {
  if (POPOUT || !findWindow(key)) return;
  const popup = window.open('', `sp5-popout-${key}`, popupFeatures());
  if (!popup) {
    showToast('브라우저가 새 창을 막았습니다. 주소창 오른쪽의 팝업 차단 표시를 눌러 이 사이트를 허용해 주세요.');
    return;
  }
  try {
    popup.document.title = '옮기는 중…';
    popup.document.body.style.cssText = 'margin:0;font:14px sans-serif;color:#64748b;display:flex;align-items:center;justify-content:center;height:100vh';
    popup.document.body.textContent = '옮기는 중…';
  } catch {
    // 빈 창에 글을 못 써도 옮기는 데는 지장이 없다
  }
  if (windowUnsaved(key)) {
    const save = windowSaveOf(key);
    if (!save) {
      popup.close();
      showToast('저장하지 않은 내용이 있습니다. 저장한 뒤 새 창으로 옮겨 주세요.');
      return;
    }
    save();
    const saved = await until(() => !findWindow(key) || !windowUnsaved(key), SAVE_WAIT_MS);
    // 저장하며 닫히는 창이면 옮길 것이 없다
    if (!findWindow(key)) {
      popup.close();
      return;
    }
    if (!saved) {
      popup.close();
      showToast('저장하지 못해 새 창으로 옮기지 않았습니다. 적은 내용은 칸에 그대로 있습니다.');
      return;
    }
  }
  const win = findWindow(key);
  if (!win || popup.closed) {
    if (!popup.closed) popup.close();
    return;
  }
  // 새 메모를 저장했으면 그 사이 수정 칸이 됐다(params에 id) - 지금 것을 옮긴다
  popup.location.replace(popoutUrl(win.id, win.params, window.location.href));
  closeWindow(key);
  popup.focus();
}
