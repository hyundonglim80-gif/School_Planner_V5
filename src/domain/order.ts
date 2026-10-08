// 차례 값 (분수 인덱스). 같은 날·같은 목록 안의 차례를 글자로 적어, 하나를 옮길 때 그 하나만 고쳐 쓴다
// (V4는 하루치 배열을 통째로 다시 썼다 - 원칙 1). 'a0' < 'a0V' < 'a1'처럼 글자 차례(사전 순)로 줄을 선다.
//
// 모양: 머리 글자 하나(정수부 길이) + 정수부 + 소수부. 머리 'a'~'z'는 0 이상(길이 2~27), 'A'~'Z'는 음수.
// 소수부는 0으로 끝나지 않는다(그래야 두 값 사이에 늘 값이 있다). 글자는 0-9A-Za-z(62진수) - Firestore의
// 글자 순서(UTF-8 바이트)와 JS 비교(<)가 같은 ASCII만 쓴다.
// 알고리즘은 rocicorp/fractional-indexing(CC0, David Greenspan 'Implementing Fractional Indexing')을 옮겼다.
//
// ⚠️ 두 기기가 같은 두 값 사이에 동시에 끼우면 같은 값이 나올 수 있다 - 줄 세울 때 값이 같으면 id로 가른다(compareOrder).

const DIGITS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const ZERO = DIGITS[0];
const SMALLEST_INTEGER = 'A' + ZERO.repeat(26);

/** 0과 1 사이 소수 a < b의 가운데 (a·b는 소수부 글자, b가 null이면 1) */
function midpoint(a: string, b: string | null): string {
  if (b !== null && a >= b) throw new Error(`차례 값 ${a} >= ${b}`);
  if (a.slice(-1) === ZERO || (b && b.slice(-1) === ZERO)) throw new Error('차례 값 소수부가 0으로 끝난다');
  if (b) {
    // 같은 앞부분은 그대로 두고 뒤에서 가운데를 찾는다. a가 먼저 끝나면 0으로 채워 본다
    let n = 0;
    while ((a[n] || ZERO) === b[n]) n++;
    if (n > 0) return b.slice(0, n) + midpoint(a.slice(n), b.slice(n));
  }
  // 첫 글자(또는 글자 없음)가 다르다
  const digitA = a ? DIGITS.indexOf(a[0]) : 0;
  const digitB = b !== null ? DIGITS.indexOf(b[0]) : DIGITS.length;
  if (digitB - digitA > 1) return DIGITS[Math.round(0.5 * (digitA + digitB))];
  // 첫 글자가 이웃이다
  if (b && b.length > 1) return b.slice(0, 1);
  // b가 없거나 한 글자: a의 첫 글자를 두고 그 뒤에서 (예 '49'와 '5' 사이 → '4' + ('9'와 끝 사이) = '495')
  return DIGITS[digitA] + midpoint(a.slice(1), null);
}

function integerLength(head: string): number {
  if (head >= 'a' && head <= 'z') return head.charCodeAt(0) - 'a'.charCodeAt(0) + 2;
  if (head >= 'A' && head <= 'Z') return 'Z'.charCodeAt(0) - head.charCodeAt(0) + 2;
  throw new Error(`차례 값의 머리 글자가 틀렸다: ${head}`);
}

function integerPart(key: string): string {
  const len = integerLength(key[0]);
  if (len > key.length) throw new Error(`차례 값이 틀렸다: ${key}`);
  return key.slice(0, len);
}

/** 쓸 수 있는 차례 값인가 */
export function isOrderKey(key: unknown): key is string {
  if (typeof key !== 'string' || key === '' || key === SMALLEST_INTEGER) return false;
  if ([...key].some((ch) => !DIGITS.includes(ch))) return false;
  try {
    const i = integerPart(key);
    return !key.slice(i.length).endsWith(ZERO);
  } catch {
    return false;
  }
}

function assertKey(key: string) {
  if (!isOrderKey(key)) throw new Error(`차례 값이 틀렸다: ${key}`);
}

function incrementInteger(x: string): string | null {
  const [head, ...digs] = x.split('');
  let carry = true;
  for (let i = digs.length - 1; carry && i >= 0; i--) {
    const d = DIGITS.indexOf(digs[i]) + 1;
    if (d === DIGITS.length) {
      digs[i] = ZERO;
    } else {
      digs[i] = DIGITS[d];
      carry = false;
    }
  }
  if (!carry) return head + digs.join('');
  if (head === 'Z') return 'a' + ZERO;
  if (head === 'z') return null;
  const h = String.fromCharCode(head.charCodeAt(0) + 1);
  if (h > 'a') digs.push(ZERO);
  else digs.pop();
  return h + digs.join('');
}

function decrementInteger(x: string): string | null {
  const [head, ...digs] = x.split('');
  let borrow = true;
  for (let i = digs.length - 1; borrow && i >= 0; i--) {
    const d = DIGITS.indexOf(digs[i]) - 1;
    if (d === -1) {
      digs[i] = DIGITS.slice(-1);
    } else {
      digs[i] = DIGITS[d];
      borrow = false;
    }
  }
  if (!borrow) return head + digs.join('');
  if (head === 'a') return 'Z' + DIGITS.slice(-1);
  if (head === 'A') return null;
  const h = String.fromCharCode(head.charCodeAt(0) - 1);
  if (h < 'Z') digs.push(DIGITS.slice(-1));
  else digs.pop();
  return h + digs.join('');
}

/**
 * a와 b 사이의 차례 값. a가 null이면 맨 앞, b가 null이면 맨 뒤, 둘 다 null이면 첫 값('a0').
 * 맨 뒤에 잇달아 더하면 'a1', 'a2' …처럼 짧게 늘어난다.
 */
export function orderBetween(a: string | null, b: string | null): string {
  if (a !== null) assertKey(a);
  if (b !== null) assertKey(b);
  if (a !== null && b !== null && a >= b) throw new Error(`차례 값 ${a} >= ${b}`);
  if (a === null) {
    if (b === null) return 'a' + ZERO;
    const ib = integerPart(b);
    const fb = b.slice(ib.length);
    if (ib === SMALLEST_INTEGER) return ib + midpoint('', fb);
    if (ib < b) return ib;
    const res = decrementInteger(ib);
    if (res === null) throw new Error('차례 값을 더 앞으로 뺄 수 없다');
    return res;
  }
  if (b === null) {
    const ia = integerPart(a);
    const fa = a.slice(ia.length);
    const i = incrementInteger(ia);
    return i === null ? ia + midpoint(fa, null) : i;
  }
  const ia = integerPart(a);
  const fa = a.slice(ia.length);
  const ib = integerPart(b);
  const fb = b.slice(ib.length);
  if (ia === ib) return ia + midpoint(fa, fb);
  const i = incrementInteger(ia);
  if (i === null) throw new Error('차례 값을 더 뒤로 늘릴 수 없다');
  if (i < b) return i;
  return ia + midpoint(fa, null);
}

/** a와 b 사이에 n개 (차례대로). 가져오기·여러 개 옮기기에서 한 번에 */
export function ordersBetween(a: string | null, b: string | null, n: number): string[] {
  if (n <= 0) return [];
  if (n === 1) return [orderBetween(a, b)];
  if (b === null) {
    let c = orderBetween(a, b);
    const out = [c];
    for (let i = 0; i < n - 1; i++) out.push((c = orderBetween(c, b)));
    return out;
  }
  if (a === null) {
    let c = orderBetween(a, b);
    const out = [c];
    for (let i = 0; i < n - 1; i++) out.push((c = orderBetween(a, c)));
    return out.reverse();
  }
  const mid = Math.floor(n / 2);
  const c = orderBetween(a, b);
  return [...ordersBetween(a, c, mid), c, ...ordersBetween(c, b, n - mid - 1)];
}

/** 차례대로 줄 세우기. 값이 같으면(두 기기가 동시에 끼움) id로 가른다 - 어느 기기에서나 같은 줄 */
export function compareOrder(x: { order: string; id: string }, y: { order: string; id: string }): number {
  if (x.order !== y.order) return x.order < y.order ? -1 : 1;
  return x.id < y.id ? -1 : x.id > y.id ? 1 : 0;
}

/**
 * 줄을 다시 세운 뒤의 차례 값 - 되도록 적게 고친다(옮긴 것만 새 값). 라벨 관리 창의 ▲▼처럼 목록을 통째로 다시 세울 때.
 * keys = 새 줄 차례대로 지금 값(null = 아직 없음). 돌려주는 것 = 같은 자리의 값(그대로 둘 것은 원래 값).
 * 가장 긴 오름차순(그대로 둘 수 있는 것)을 남기고, 나머지만 앞뒤에 남긴 값 사이로 넣는다.
 */
export function rekeyOrders(keys: ReadonlyArray<string | null>): string[] {
  const n = keys.length;
  const ok = keys.map((k) => k !== null && isOrderKey(k));
  // 가장 긴 오름차순 (n이 작다 - 라벨·한 날의 항목)
  const len = new Array<number>(n).fill(0);
  const prev = new Array<number>(n).fill(-1);
  let best = -1;
  for (let i = 0; i < n; i++) {
    if (!ok[i]) continue;
    len[i] = 1;
    for (let j = 0; j < i; j++) {
      if (ok[j] && keys[j]! < keys[i]! && len[j] + 1 > len[i]) {
        len[i] = len[j] + 1;
        prev[i] = j;
      }
    }
    if (best < 0 || len[i] > len[best]) best = i;
  }
  const keep = new Array<boolean>(n).fill(false);
  for (let i = best; i >= 0; i = prev[i]) keep[i] = true;

  const out = new Array<string>(n);
  let i = 0;
  while (i < n) {
    if (keep[i]) {
      out[i] = keys[i]!;
      i++;
      continue;
    }
    let j = i;
    while (j < n && !keep[j]) j++;
    const lower = i > 0 ? out[i - 1] : null;
    const upper = j < n ? keys[j]! : null;
    ordersBetween(lower, upper, j - i).forEach((k, x) => (out[i + x] = k));
    i = j;
  }
  return out;
}
