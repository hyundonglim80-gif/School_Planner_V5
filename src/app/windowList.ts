// 창 등록 한 곳 (DESIGN 7-2). 창을 만드는 세션이 여기에 한 줄씩 더한다 - ⋮ 구역·학급 도구·수업 머리줄은 MENU.md대로.
import { closeAllWindows, openWindow, registerWindow } from './windows';

// ⋮ 일정
registerWindow({
  id: 'labels',
  title: '라벨 관리',
  icon: '🏷️',
  menu: '일정',
  kind: 'side',
  help: 'labels',
  load: () => import('../features/labels/LabelsWindow'),
});

// ⋮ 설정
registerWindow({
  id: 'settings',
  title: '환경설정',
  icon: '⚙️',
  menu: '설정',
  kind: 'side',
  help: 'settings',
  load: () => import('../features/settings/SettingsWindow'),
});

// 점검용 창 둘 (개발·에뮬레이터 빌드에만 - 운영 빌드에서는 통째로 빠진다)
if (import.meta.env.DEV || __USE_EMULATOR__) {
  registerWindow({ id: 'devWindow', title: '시험 창', icon: '🧪', kind: 'side', dev: true, load: () => import('../features/dev/TestWindow') });
  registerWindow({
    id: 'devPanel',
    title: '시험 쓰는 칸',
    icon: '🧪',
    kind: 'panel',
    dev: true,
    load: () => import('../features/dev/TestPanel'),
  });
  // 점검 스크립트(tools/inspect-*.mjs)가 창을 연다
  (window as unknown as { sp5: unknown }).sp5 = { openWindow, closeAllWindows };
}
