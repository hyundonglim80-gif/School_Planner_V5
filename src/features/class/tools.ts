// 학급 화면 도구 카드 여덟 (MENU 3-3 - V4 ClassScreen TOOLS 그대로). 카드를 누르면 그 단축키 일(창)을 연다 - 아직 없는 도구는 🚧 안내.
//   homeroom = 담임 도구(교과 전담·교과 + 담임의 다른 반에서는 숨긴다), classUnit = 교과 모드 도구(초등 담임은 숨긴다).
import type { ShortcutId } from '../../domain/shortcuts';

export interface ClassTool {
  id: ShortcutId;
  icon: string;
  label: string;
  desc: string;
  homeroom?: true;
  classUnit?: true;
}

export const CLASS_TOOLS: readonly ClassTool[] = [
  { id: 'attendance', icon: '📋', label: '출석부', desc: '오늘 출결 체크 · 누계', homeroom: true },
  { id: 'notices', icon: '📢', label: '알림장', desc: '모아 보기 · 쓰기', homeroom: true },
  { id: 'subjectAttendance', icon: '🙋', label: '교과 출결', desc: '반별 결과 · 지각 · 조퇴 누계', classUnit: true },
  { id: 'seating', icon: '🪑', label: '자리표', desc: '자리 · 학생 칸 · 모둠' },
  { id: 'drawStudent', icon: '🎯', label: '발표자 뽑기', desc: '겹치지 않게 차례로' },
  { id: 'studentRecord', icon: '🧑‍🎓', label: '학생 기록(누가기록)', desc: '학생마다 기록 · 출결 · 조사표' },
  { id: 'evalOverview', icon: '📊', label: '조사표 모아 보기', desc: '조사표를 학생 × 조사표 표로' },
  { id: 'roster', icon: '🧑‍🤝‍🧑', label: '명렬표', desc: '관리 · 검색 · 암기' },
];
