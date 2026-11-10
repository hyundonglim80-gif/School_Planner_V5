// 머리줄 접기 (메모 요청 #142 - '필요시 상단 고정바를 접어서 내용만 전체화면으로').
//   접으면 머리줄(첫 줄·둘째 줄)이 사라지고 본문이 화면 맨 위부터 쓴다. 화면 위 가운데 작은 손잡이(▼ + 보는 날짜)로 다시 편다.
//   접고 펴는 단추는 app/HeaderFoldHandle, 자리는 app/Shell. 단축키 'toggleHeader'(기본 키 없음 - app/keys).
//   이 기기에만 기억한다 - PC는 접고 휴대폰은 펴 둘 수 있게, 계정에 올리지 않는다(왼쪽·오른쪽 칸 폭과 같다).
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useHeaderFold = create<{ folded: boolean }>()(persist((): { folded: boolean } => ({ folded: false }), { name: 'sp5-header-fold' }));

export const setHeaderFolded = (folded: boolean) => useHeaderFold.setState({ folded });

/** 접혀 있으면 펴고, 펴져 있으면 접는다 (손잡이·단축키) */
export const toggleHeaderFold = () => setHeaderFolded(!useHeaderFold.getState().folded);
