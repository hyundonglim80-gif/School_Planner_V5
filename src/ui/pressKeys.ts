// 누르면 무엇이 열리는 카드·달력 칸을 키보드로도 (P22-7): Tab으로 와서 Enter·Space = 누르기.
//   카드에 role="button" tabIndex={0} onKeyDown={pressKeys}. 누르기(onClick)를 그대로 부른다 - 끌기·Ctrl+누르기는 마우스 그대로.
//   안쪽 칸(체크 상자·글 칸·안쪽 단추)에서 친 키는 그 칸 것이다 - 카드 자신에 초점이 있을 때만.
import type { KeyboardEvent } from 'react';

export function pressKeys(e: KeyboardEvent<HTMLElement>) {
  if (e.target !== e.currentTarget || e.altKey || e.ctrlKey || e.metaKey || e.nativeEvent.isComposing) return;
  if (e.key !== 'Enter' && e.key !== ' ') return;
  e.preventDefault(); // Space가 화면을 내리지 않게
  e.currentTarget.click();
}
