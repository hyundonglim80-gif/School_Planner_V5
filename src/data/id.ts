// 새 문서 id. Firestore 자동 id와 같은 꼴(영문 대소문자·숫자 20자) - 서버에 묻지 않고 기기에서 만든다.
// id는 바뀌지 않는다(원칙 2): 이월·메모↔기록 옮기기·공간 옮기기에도 그대로 간다.
// 62^20 ≈ 7×10^35 - 겹칠 걱정은 하지 않는다. V4에서 가져온 것은 V4 자리에서 셈한 id(DESIGN 8-2)라 이것을 쓰지 않는다.

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
export const ID_LENGTH = 20;

export function newId(): string {
  let id = '';
  // 248 = 62 × 4 - 그 위 값은 버려 글자마다 고르게 나오게 한다
  const buf = new Uint8Array(40);
  while (id.length < ID_LENGTH) {
    crypto.getRandomValues(buf);
    for (const b of buf) {
      if (b >= 248) continue;
      id += ALPHABET[b % 62];
      if (id.length === ID_LENGTH) break;
    }
  }
  return id;
}
