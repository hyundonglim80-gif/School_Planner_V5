// 메모 화면 보기 - 카드(쌓기) / 목록(한 줄에 하나) (P10-5 사용자 의견 5e). 머리줄 🔍 왼쪽 그림 단추(메모 화면에서만)로 바꾸고, 이 기기에 기억한다.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type MemoView = 'card' | 'list';

export const useMemoView = create<{ view: MemoView }>()(persist((): { view: MemoView } => ({ view: 'card' }), { name: 'sp5-memo-view' }));
export const toggleMemoView = () => useMemoView.setState((s) => ({ view: s.view === 'card' ? 'list' : 'card' }));
