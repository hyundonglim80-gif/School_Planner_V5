import { describe, expect, it } from 'vitest';
import { cellNumber, isNumberCell, parseNum, plainText, roundTo } from './tableNumber';

describe('표 칸 숫자 읽기 (P48-2 ⓓ)', () => {
  it('수로 읽는 것 - 쉼표·원·₩·\\·회계 음수·%', () => {
    expect(parseNum('1234')).toBe(1234);
    expect(parseNum(' -1,234.5 ')).toBe(-1234.5);
    expect(parseNum('1,234원')).toBe(1234);
    expect(parseNum('1,234 원')).toBe(1234);
    expect(parseNum('₩5,000')).toBe(5000);
    expect(parseNum('￦5,000')).toBe(5000);
    expect(parseNum('\\1,234')).toBe(1234);
    expect(parseNum('-₩1,234')).toBe(-1234);
    expect(parseNum('₩-1,234')).toBe(-1234);
    expect(parseNum('(1,234)')).toBe(-1234);
    expect(parseNum('12.5%')).toBe(0.125);
    expect(parseNum('-5%')).toBe(-0.05);
    expect(parseNum('.5')).toBe(0.5);
    expect(parseNum('0')).toBe(0);
    expect(parseNum('-0')).toBe(0);
    expect(Object.is(parseNum('-0'), -0)).toBe(false);
    expect(parseNum('0.25')).toBe(0.25);
    expect(parseNum('+7')).toBe(7);
    expect(parseNum('1,234,567')).toBe(1234567);
  });

  it('글로 두는 것 - 날짜·전화번호·앞 0·어긋난 쉼표·지수·글', () => {
    for (const s of ['', ' ', '2027-03-02', '2027.03.02', '010-1234-5678', '01012345678', '007', '1,23', '12,34,567', '1e5', '1.2.3', '원', '%', '₩', '-', '(-5)', '₩12%', '5학년', '1 234', '3/4', '12:30', 'abc', '1,234.5.6'])
      expect(parseNum(s), s).toBeNull();
  });

  it('칸의 수 = 원래 수(n) 먼저, 없으면 보이는 글', () => {
    expect(cellNumber({ v: '1,234원', n: 1234.4 })).toBe(1234.4);
    expect(cellNumber({ v: '12.5%' })).toBe(0.125);
    expect(cellNumber({ v: '홍길동' })).toBeNull();
    expect(isNumberCell({ v: '₩5,000' })).toBe(true);
    expect(isNumberCell({ v: '2027-03-02' })).toBe(false);
  });

  it('반올림은 0에서 먼 쪽 + 2진수 오차 걷기 (엑셀 ROUND와 같게)', () => {
    expect(roundTo(1.005, 2)).toBe(1.01);
    expect(roundTo(-2.5, 0)).toBe(-3);
    expect(roundTo(2.5, 0)).toBe(3);
    expect(roundTo(1234.5678, 1)).toBe(1234.6);
    expect(roundTo(1234, -2)).toBe(1200);
    expect(roundTo(1250, -2)).toBe(1300);
    expect(roundTo(-0.001, 2)).toBe(0);
    expect(Object.is(roundTo(-0.001, 2), -0)).toBe(false);
  });

  it('바탕 글 - 유효 숫자 15자리', () => {
    expect(plainText(0.1 + 0.2)).toBe('0.3');
    expect(plainText(1234)).toBe('1234');
    expect(plainText(0.125 * 100)).toBe('12.5');
    expect(plainText(0.07 * 100)).toBe('7');
    expect(plainText(-0)).toBe('0');
  });
});
