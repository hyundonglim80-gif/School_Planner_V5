// 이 기기 저장 열쇠를 계정마다 - 사람이 친 글이 든 값은 공용 PC에서 다음 사람에게 보이지 않게 (P22-4).

/** 그 계정의 열쇠. 계정 구분 없던 옛 값은 처음 읽은 계정이 받는다 */
export function accountKey(base: string, uid: string): string {
  const key = `${base}-${uid}`;
  try {
    const old = localStorage.getItem(base);
    if (old !== null) {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, old);
      localStorage.removeItem(base);
    }
  } catch {
    // 이 기기에 남기지 못할 뿐
  }
  return key;
}
