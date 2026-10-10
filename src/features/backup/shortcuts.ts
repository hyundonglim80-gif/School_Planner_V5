// 백업 창 단축키 (P8-3): 'calendar'(구글 캘린더로 보내기) = 백업 창 '보내기' 탭. 'backup'은 창 목록 id라 저절로 열린다.
import { useEffect } from 'react';
import { setShortcutAction } from '../../app/keys';
import { openBackup } from './open';

export function useBackupShortcuts() {
  useEffect(() => setShortcutAction('calendar', () => openBackup('send')), []);
}
