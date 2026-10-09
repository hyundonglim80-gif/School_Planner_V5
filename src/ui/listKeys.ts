// 글자 칸에 붙은 ▼ 목록의 키 (반·과목 목록 - features/lessons/SlotCombobox). 앱 단축키(app/keys)와 달리 바꾸지 않는 칸 안 키다.
// 키 이름 견주기는 여기 한 곳에서 (화면 코드에 키 글자를 박지 않는다 - app/keys.test).
export type ListKey = 'next' | 'prev' | 'pick' | 'close' | 'leave';

export function listKeyOf(key: string): ListKey | null {
  switch (key) {
    case 'ArrowDown':
      return 'next';
    case 'ArrowUp':
      return 'prev';
    case 'Enter':
      return 'pick';
    case 'Escape':
      return 'close';
    case 'Tab':
      return 'leave';
    default:
      return null;
  }
}
