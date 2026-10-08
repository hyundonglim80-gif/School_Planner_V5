// 가져오기의 셈 도구 (DESIGN 8-2). 서버에 묻지 않고 기기에서 바로 셈해야 어느 기기에서 몇 번 가져와도 같은 값이 나온다.
//
//   sha1 → base32  : V4 자리에서 V5 id를 셈한다(ids.ts) · 가져온 칸의 지문(plan.ts)
//   stableStringify : 칸 차례가 달라도 같은 값이면 같은 글자 (지문이 칸 차례에 흔들리지 않게)
//
// crypto.subtle은 약속(async)이라 순수 함수 안에서 쓰기 번거롭다 - 짧은 SHA-1을 직접 둔다(보안용이 아니라 이름 짓기용).

/** SHA-1 (UTF-8로 읽은 글자) → 20바이트 */
export function sha1(text: string): Uint8Array {
  const msg = new TextEncoder().encode(text);
  const len = msg.length;
  // 글 + 0x80 + 길이(8바이트)가 들어가는 64바이트 묶음 수
  const total = (((len + 8) >> 6) + 1) * 64;
  const buf = new Uint8Array(total);
  buf.set(msg);
  buf[len] = 0x80;
  const view = new DataView(buf.buffer);
  view.setUint32(total - 8, Math.floor(len / 0x20000000));
  view.setUint32(total - 4, (len * 8) >>> 0);

  const h = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0];
  const w = new Uint32Array(80);
  for (let off = 0; off < total; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(off + i * 4);
    for (let i = 16; i < 80; i++) {
      const x = w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16];
      w[i] = (x << 1) | (x >>> 31);
    }
    let [a, b, c, d, e] = h;
    for (let i = 0; i < 80; i++) {
      const f = i < 20 ? (b & c) | (~b & d) : i < 40 ? b ^ c ^ d : i < 60 ? (b & c) | (b & d) | (c & d) : b ^ c ^ d;
      const k = i < 20 ? 0x5a827999 : i < 40 ? 0x6ed9eba1 : i < 60 ? 0x8f1bbcdc : 0xca62c1d6;
      const t = (((a << 5) | (a >>> 27)) + f + e + k + w[i]) >>> 0;
      e = d;
      d = c;
      c = ((b << 30) | (b >>> 2)) >>> 0;
      b = a;
      a = t;
    }
    h[0] = (h[0] + a) >>> 0;
    h[1] = (h[1] + b) >>> 0;
    h[2] = (h[2] + c) >>> 0;
    h[3] = (h[3] + d) >>> 0;
    h[4] = (h[4] + e) >>> 0;
  }
  const out = new Uint8Array(20);
  const ov = new DataView(out.buffer);
  h.forEach((v, i) => ov.setUint32(i * 4, v));
  return out;
}

/** base32 (RFC 4648 소문자 - Firestore id·주소에 그대로 쓸 수 있는 글자) */
const B32 = 'abcdefghijklmnopqrstuvwxyz234567';

export function base32(bytes: Uint8Array): string {
  let out = '';
  let bits = 0;
  let value = 0;
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
    value &= (1 << bits) - 1;
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

/** 글자 → sha1 → base32 앞 n자 */
export const hashText = (text: string, n: number) => base32(sha1(text)).slice(0, n);

/**
 * 칸 차례와 상관없는 JSON. 객체는 열쇠 차례대로, undefined 칸은 뺀다(Firestore에 적지 않는 칸 - 있으나 없으나 같다).
 * Timestamp 같은 객체도 제 칸(seconds·nanoseconds)으로 적힌다.
 */
export function stableStringify(value: unknown): string {
  if (value === undefined) return 'null';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + stableStringify(obj[k])).join(',') + '}';
}

/** 두 값이 같은가 (칸 차례·undefined 칸은 보지 않는다) */
export const sameValue = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
