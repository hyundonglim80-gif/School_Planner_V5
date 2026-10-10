// '💾 백업 · 가져오기 · 보내기' 창 (P8-3 - MENU 2-3) = 창 목록 id 'backup' = ⋮ 자료 · 단축키 'backup'. 탭: 백업 / 가져오기 / 보내기 / 정리.
// 단축키 '구글 캘린더로 보내기'(calendar)는 '보내기' 탭을 연다(MENU 3-8). 처음 로그인 띠의 '자세히'는 '가져오기' 탭.
// (창 목록이 이 파일을 읽으므로 Firebase를 끌어오는 data/session·select는 여기서 부르지 않는다)
import { openWindow } from '../../app/windows';

export const BACKUP_WINDOW = 'backup';

export type BackupTabId = 'backup' | 'import' | 'send' | 'tidy';

export interface BackupParams {
  tab?: BackupTabId;
}

export const openBackup = (tab?: BackupTabId) => openWindow(BACKUP_WINDOW, tab ? { tab } : {});
