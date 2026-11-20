// 표 칸의 숫자 읽기 (P48-2 - PLAN 5장 'P48' ⓓ). 셈(P48-3)·정렬(P48-4)·숫자 서식·숫자 칸 오른쪽 맞춤이 모두 이것 하나를 쓴다.
//   카드가 부르는 표 그리기(domain/tableCss - 숫자 칸 오른쪽 맞춤)가 불러 첫 화면에 든다 → 읽기만 가볍게 둔다.
//   서식 입히기(1,234원·12.5%)는 쓰는 칸만 받는 domain/tableFormat.
//
// 수로 읽는 것: '1234' · '-1,234.5' · '1,234원' · '₩1,234' · '\1,234'(한글 글꼴의 원 기호) · '(1,234)'(회계 음수) · '12.5%'(= 0.125) · '.5'
// 글로 두는 것: 날짜('2027-03-02') · 전화번호('010-1234-5678') · 앞에 0이 붙은 수('007' - 번호·학번) · 세 자리마다가 아닌 쉼표('1,23') · 지수('1e5')
import type { TableCell } from '../data/types';

/** 수 몸통: 세 자리마다 쉼표(없어도 됨) + 소수 */
const BODY = /^(?:\d{1,3}(?:,\d{3})+|\d+)?(?:\.\d+)?$/;

/** 칸 글을 수로 읽는다. 수가 아니면 null */
export function parseNum(text: string): number | null {
  let s = text.trim();
  if (!s || s.length > 40) return null;
  let neg = false;
  const paren = /^\((.+)\)$/.exec(s);
  if (paren) {
    neg = true;
    s = paren[1].trim();
  }
  // 앞: 부호와 원 기호 (어느 차례든 - '-₩1,234'·'₩-1,234')
  let signed = false;
  let won = false;
  for (let i = 0; i < 2; i++) {
    const ch = s[0];
    if (!signed && (ch === '-' || ch === '+' || ch === '−')) {
      if (paren) return null;
      signed = true;
      if (ch !== '+') neg = true;
      s = s.slice(1).trimStart();
    } else if (!won && (ch === '₩' || ch === '￦' || ch === '\\')) {
      won = true;
      s = s.slice(1).trimStart();
    }
  }
  // 뒤: % 또는 원
  let pct = false;
  if (s.endsWith('%')) {
    if (won) return null;
    pct = true;
    s = s.slice(0, -1).trimEnd();
  } else if (s.endsWith('원')) {
    s = s.slice(0, -1).trimEnd();
  }
  if (!/\d/.test(s) || !BODY.test(s)) return null;
  // 앞에 0이 붙은 수는 번호로 본다 ('0'·'0.5'는 수)
  if (/^0\d/.test(s)) return null;
  const n = Number(s.replace(/,/g, ''));
  if (!Number.isFinite(n)) return null;
  const v = (neg ? -n : n) / (pct ? 100 : 1);
  return v === 0 ? 0 : v;
}

/** 칸의 수 - 서식을 입힌 칸은 원래 수(n), 아니면 보이는 글을 읽는다. 수가 아니면 null */
export function cellNumber(cell: Pick<TableCell, 'v' | 'n'>): number | null {
  return typeof cell.n === 'number' && Number.isFinite(cell.n) ? cell.n : parseNum(cell.v);
}

/** 수 칸인가 (맞춤을 정하지 않은 칸은 오른쪽 - 엑셀 '일반' 맞춤) */
export const isNumberCell = (cell: Pick<TableCell, 'v' | 'n'>) => cellNumber(cell) !== null;

/**
 * 반올림 - 0에서 먼 쪽 (엑셀 ROUND와 같게: 1.005 → 1.01, -2.5 → -3).
 * 2진수 오차(1.005 × 100 = 100.4999…)는 유효 숫자 15자리로 걷고 반올림한다. dp가 음수면 십의 자리 위로 (1234, -2 → 1200).
 */
export function roundTo(n: number, dp: number): number {
  if (!Number.isFinite(n)) return n;
  const f = 10 ** Math.abs(dp);
  const x = Number((dp >= 0 ? Math.abs(n) * f : Math.abs(n) / f).toPrecision(15));
  const r = dp >= 0 ? Math.round(x) / f : Math.round(x) * f;
  return n < 0 && r !== 0 ? -r : r;
}

/** 수의 바탕 글 - 유효 숫자 15자리(엑셀이 두는 만큼)로 2진수 오차를 걷는다 (0.1 + 0.2 → '0.3'). 칸을 고칠 때 보이는 글 */
export function plainText(n: number): string {
  if (n === 0) return '0';
  return String(Number(n.toPrecision(15)));
}
