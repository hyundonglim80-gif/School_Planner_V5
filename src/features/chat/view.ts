// 대화 창이 지금 그린 것 (P19-2 ■3) - 새 글 안내(receive.ts)가 본다: null = 창 없음 · '' = 목록 · 방 키 = 그 방.
// Firebase를 부르지 않는다(Shell 쪽 안내가 창 파일을 끌어오지 않게).
import { create } from 'zustand';

export const useChatView = create<{ room: string | null }>(() => ({ room: null }));
