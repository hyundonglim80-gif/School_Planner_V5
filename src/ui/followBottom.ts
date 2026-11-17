// 스크롤 칸이 맨 아래를 따라가나 (P44-1 11-17 - CI 세 바퀴에서 메모 칸 Claude 대화를 열어도 답이 2006px 아래에 남았다).
// 맨 아래로 내린(scrollTop = scrollHeight) 바로 뒤, 그 스크롤 알림이 오기 전에 위 글(글 칸·늦게 뜬 그림)이 늘어나면
// 알림이 틈을 보고 '맨 아래가 아님'으로 읽어 따라가기를 멈췄다 - ResizeObserver가 메우려 해도 이미 꺼진 뒤다.
// 그래서 벗어난 것은 **사용자가 위로 올렸을 때만**(scrollTop이 줄었다) 정한다. 위가 늘어 생긴 틈은 ResizeObserver가 메운다.
// 메모 칸 Claude 대화(notes/ClaudeThread)·대화 방(chat/ChatRoomView)이 함께 쓴다.

/** 스크롤 알림마다 - was = 지금까지, gap = 맨 아래까지 남은 px, top·lastTop = 지금·앞 알림의 scrollTop */
export function followsBottom(was: boolean, { gap, top, lastTop }: { gap: number; top: number; lastTop: number }, near: number): boolean {
  if (gap < near) return true;
  return top < lastTop ? false : was;
}
