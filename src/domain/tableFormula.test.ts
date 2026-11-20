import { describe, expect, it } from 'vitest';
import type { EntryTable } from '../data/types';
import { clearRange, deleteCol, deleteRow, deleteRows, insertCol, insertRow, newEmptyTable, setCellText } from './tableEdit';
import { editText, setNumberFormat, styleOf } from './tableFormat';
import { formulaErrorReason, normalizeFormula, recalcTable, shiftFormula } from './tableFormula';

/** 글 격자로 표 (식도 setCellText로 넣는다) */
function grid(...rows: string[][]): EntryTable {
  let t = newEmptyTable(rows.length, Math.max(...rows.map((r) => r.length)), 1);
  rows.forEach((row, r) => row.forEach((v, c) => v && (t = setCellText(t, r, c, v))));
  return t;
}
/** 칸 이름('B3')으로 보이는 글 */
const at = (t: EntryTable, name: string) => {
  const m = /^([A-Z])(\d+)$/.exec(name)!;
  return t.rows[Number(m[2]) - 1].cells[m[1].charCodeAt(0) - 65];
};
const v = (t: EntryTable, name: string) => at(t, name).v;
/** 한 칸에 식 하나를 넣고 결과 (아래 점수 표 위) */
const calc = (f: string, base: EntryTable = scores) => v(setCellText(base, 0, 5, f), 'F1');

// 점수 표: A = 이름, B·C = 점수, D = 빈 칸, E = 글
const scores = grid(
  ['이름', '국어', '수학', '', '비고'],
  ['가', '90', '80', '', '○'],
  ['나', '70', '', '', '×'],
  ['다', '85', '95', '', '○'],
  ['라', '70', '60', '', ''],
  ['', '', '', '', '', '']
);

describe('식 읽기·셈표 (P48-3 ⓖ)', () => {
  it('셈표 차례 - 엑셀과 같다 (부호가 ^보다 먼저, ^는 왼쪽부터, %)', () => {
    expect(calc('=1+2*3')).toBe('7');
    expect(calc('=(1+2)*3')).toBe('9');
    expect(calc('=-2^2')).toBe('4');
    expect(calc('=2^3^2')).toBe('64');
    expect(calc('=2^-1')).toBe('0.5');
    expect(calc('=50%')).toBe('0.5');
    expect(calc('=10-2-3')).toBe('5');
    expect(calc('=12/4/3')).toBe('1');
  });

  it('칸 주소·고정 주소·소문자·빈 칸 = 0', () => {
    expect(calc('=B2+C2')).toBe('170');
    expect(calc('=$B$2+c$2')).toBe('170');
    expect(calc('=b3+c3')).toBe('70');
    expect(calc('=D2')).toBe('0');
    expect(calc('=Z99')).toBe('0'); // 표 밖은 빈 칸 (엑셀 시트처럼)
  });

  it('글 잇기·견주기 (0.1 + 0.2 = 0.3, 글은 대소문자 없이)', () => {
    expect(calc('=A2&"님 "&B2&"점"')).toBe('가님 90점');
    expect(calc('="a""b"')).toBe('a"b');
    expect(calc('=0.1+0.2=0.3')).toBe('TRUE');
    expect(calc('="ABC"="abc"')).toBe('TRUE');
    expect(calc('=B2>=90')).toBe('TRUE');
    expect(calc('=B3<>70')).toBe('FALSE');
    expect(calc('=1<"a"')).toBe('TRUE'); // 수 < 글
    expect(calc('=D2=0')).toBe('TRUE');
    expect(calc('=D2=""')).toBe('TRUE');
    expect(calc('=TRUE+1')).toBe('2');
  });

  it('수로 읽히는 글은 셈에 쓰인다 (1,234원 · 12.5%)', () => {
    const t = grid(['1,234원', '12.5%', '₩500', '', '', '']);
    expect(calc('=A1+C1', t)).toBe('1734');
    expect(calc('=B1*100', t)).toBe('12.5');
  });

  it('함수 이름·주소는 대문자로 다듬고, 띄어쓰기·글은 친 그대로', () => {
    expect(normalizeFormula('=sum(b2:b5) + a1')).toBe('=SUM(B2:B5) + A1');
    expect(normalizeFormula('=if(a1>0,"yes",true)')).toBe('=IF(A1>0,"yes",TRUE)');
    expect(normalizeFormula('=foo(a1)')).toBe('=foo(A1)');
    expect(normalizeFormula('=1+(')).toBe('=1+(');
  });
});

describe('함수 열둘 - 엑셀과 같은 답', () => {
  it('SUM은 빈 칸·글을 건너뛰고, 직접 넣은 글은 수로 읽는다', () => {
    expect(calc('=SUM(B2:B5)')).toBe('315');
    expect(calc('=SUM(A1:E5)')).toBe('550'); // 이름·비고 글은 건너뜀
    expect(calc('=SUM(B2,C2,10)')).toBe('180');
    expect(calc('=SUM("5",1)')).toBe('6');
    expect(calc('=SUM("가",1)')).toBe('#VALUE!');
    expect(calc('=SUM(D2:D5)')).toBe('0');
  });

  it('AVERAGE는 빈 칸을 빼고, 셀 것이 없으면 #DIV/0!', () => {
    expect(calc('=AVERAGE(C2:C5)')).toBe('78.33333333');
    expect(calc('=AVERAGE(B2:B5)')).toBe('78.75');
    expect(calc('=AVERAGE(D2:D5)')).toBe('#DIV/0!');
  });

  it('COUNT = 수 칸 · COUNTA = 빈 칸 아닌 칸', () => {
    expect(calc('=COUNT(B2:C5)')).toBe('7');
    expect(calc('=COUNT(A1:A5)')).toBe('0');
    expect(calc('=COUNTA(A1:A5)')).toBe('5');
    expect(calc('=COUNTA(E2:E5)')).toBe('3');
  });

  it('COUNTIF - "○" · ">=80" · "<>" · "" · 별표', () => {
    expect(calc('=COUNTIF(E2:E5,"○")')).toBe('2');
    expect(calc('=COUNTIF(B2:B5,">=80")')).toBe('2');
    expect(calc('=COUNTIF(B2:B5,70)')).toBe('2');
    expect(calc('=COUNTIF(B2:B5,"70")')).toBe('2');
    expect(calc('=COUNTIF(C2:C5,"")')).toBe('1');
    expect(calc('=COUNTIF(E2:E5,"<>○")')).toBe('2'); // × 하나 + 빈 칸 하나
    expect(calc('=COUNTIF(A2:A5,"?")')).toBe('4');
    expect(calc('=COUNTIF(A1:A5,"이*")')).toBe('1');
    expect(calc('=COUNTIF(B2:B5,">"&B5)')).toBe('2');
  });

  it('MAX·MIN (수가 없으면 0)', () => {
    expect(calc('=MAX(B2:C5)')).toBe('95');
    expect(calc('=MIN(B2:C5)')).toBe('60');
    expect(calc('=MAX(D2:D5)')).toBe('0');
  });

  it('RANK - 큰 것이 1등, 같은 점수는 같은 등수, 셋째 인자 1 = 작은 것이 1등, 없으면 #N/A', () => {
    expect(calc('=RANK(B2,$B$2:$B$5)')).toBe('1');
    expect(calc('=RANK(B3,$B$2:$B$5)')).toBe('3');
    expect(calc('=RANK(B5,$B$2:$B$5)')).toBe('3');
    expect(calc('=RANK(B4,B2:B5)')).toBe('2');
    expect(calc('=RANK(B3,B2:B5,1)')).toBe('1');
    expect(calc('=RANK(B2,B2:B5,1)')).toBe('4');
    expect(calc('=RANK(55,B2:B5)')).toBe('#N/A');
    expect(calc('=RANK(55,55)')).toBe('#VALUE!');
  });

  it('ROUND·ROUNDUP·ROUNDDOWN - 0에서 먼 쪽, 2진수 오차 없이', () => {
    expect(calc('=ROUND(1.005,2)')).toBe('1.01');
    expect(calc('=ROUND(-2.5,0)')).toBe('-3');
    expect(calc('=ROUND(2.5,0)')).toBe('3');
    expect(calc('=ROUND(1234,-2)')).toBe('1200');
    expect(calc('=ROUNDUP(1.21,1)')).toBe('1.3');
    expect(calc('=ROUNDUP(-1.21,1)')).toBe('-1.3');
    expect(calc('=ROUNDDOWN(1.29,1)')).toBe('1.2');
    expect(calc('=ROUNDDOWN(-1.29,1)')).toBe('-1.2');
    expect(calc('=ROUNDUP(0.1*3,1)')).toBe('0.3');
    expect(calc('=ROUND(AVERAGE(C2:C5),1)')).toBe('78.3');
  });

  it('IF - 글 결과, 고르지 않은 쪽의 오류는 나오지 않는다', () => {
    expect(calc('=IF(B2>=80,"통과","다시")')).toBe('통과');
    expect(calc('=IF(B3>=80,"통과","다시")')).toBe('다시');
    expect(calc('=IF(B3>=80,"통과")')).toBe('FALSE');
    expect(calc('=IF(TRUE,,1)')).toBe('0');
    expect(calc('=IF(B2>0,1,1/0)')).toBe('1');
    expect(calc('=IF("가",1,2)')).toBe('#VALUE!');
    expect(calc('=IF(D2,1,2)')).toBe('2');
  });
});

describe('오류 (엑셀 글 + #순환!·#식오류!)', () => {
  it('엑셀 오류 글', () => {
    expect(calc('=B2/D2')).toBe('#DIV/0!');
    expect(calc('=A2+1')).toBe('#VALUE!');
    expect(calc('=합계(B2:B5)')).toBe('#NAME?');
    expect(calc('=abc+1')).toBe('#NAME?');
    expect(calc('=B2:B5')).toBe('#VALUE!');
    expect(calc('=(-8)^0.5')).toBe('#NUM!');
    expect(calc('=0^-1')).toBe('#DIV/0!');
    expect(calc('=#REF!+1')).toBe('#REF!');
  });

  it('오류는 그 칸을 부르는 칸으로 번진다', () => {
    let t = setCellText(scores, 5, 1, '=B2/D2');
    t = setCellText(t, 5, 2, '=B6+1');
    expect(v(t, 'C6')).toBe('#DIV/0!');
    expect(calc('=SUM(B6,1)', t)).toBe('#DIV/0!');
    expect(calc('=COUNT(B6:C6)', t)).toBe('0');
    expect(calc('=COUNTA(B6:C6)', t)).toBe('2');
  });

  it('읽지 못하는 식 = #식오류! (괄호·따옴표·넣은 값의 수)', () => {
    for (const f of ['=1+', '=(1+2', '="abc', '=SUM()', '=ROUND(1)', '=IF(1,2,3,4)', '=A1:', '=1;2', '=B:B'])
      expect([f, calc(f)]).toEqual([f, '#식오류!']);
  });

  it('서로 부르는 칸 = #순환! (자기 칸도)', () => {
    let t = setCellText(scores, 5, 0, '=B6+1');
    t = setCellText(t, 5, 1, '=A6+1');
    expect([v(t, 'A6'), v(t, 'B6')]).toEqual(['#순환!', '#순환!']);
    expect(v(setCellText(scores, 5, 0, '=A6*2'), 'A6')).toBe('#순환!');
    expect(v(setCellText(scores, 5, 0, '=SUM(A1:A6)'), 'A6')).toBe('#순환!');
    // 고리를 풀면 다시 셈한다
    const u = setCellText(t, 5, 1, '5');
    expect([v(u, 'A6'), v(u, 'B6')]).toEqual(['6', '5']);
  });

  it('쉬운 까닭은 식 칸 오류에만', () => {
    expect(formulaErrorReason({ f: '=1/0', v: '#DIV/0!' })).toContain('0으로 나눴습니다');
    expect(formulaErrorReason({ v: '#DIV/0!' })).toBeUndefined();
    expect(formulaErrorReason({ f: '=1', v: '1' })).toBeUndefined();
  });
});

describe('식 칸 넣기 (P48-3 ■2)', () => {
  it('식 칸 = f + 결과 v, 고칠 때는 식, 위 칸을 고치면 곧바로 다시 셈', () => {
    let t = setCellText(scores, 5, 1, '=sum(b2:b5)');
    expect(at(t, 'B6')).toEqual({ v: '315', f: '=SUM(B2:B5)' });
    expect(editText(at(t, 'B6'))).toBe('=SUM(B2:B5)');
    t = setCellText(t, 1, 1, '100');
    expect(v(t, 'B6')).toBe('325');
    // 식을 글로 덮으면 f가 빠진다
    t = setCellText(t, 5, 1, '7');
    expect(at(t, 'B6')).toEqual({ v: '7' });
  });

  it("'로 시작하면 글 (앞 '는 빠지고, 고칠 때 다시 붙는다)", () => {
    const t = setCellText(scores, 5, 1, "'=1+1");
    expect(at(t, 'B6')).toEqual({ v: '=1+1' });
    expect(editText(at(t, 'B6'))).toBe("'=1+1");
    expect(at(setCellText(scores, 5, 1, "'abc"), 'B6')).toEqual({ v: 'abc' });
    expect(at(setCellText(scores, 5, 1, '='), 'B6')).toEqual({ v: '=' });
  });

  it('숫자 서식 칸의 식 결과는 서식대로 (n = 원래 수)', () => {
    let t = setNumberFormat(scores, { r1: 5, c1: 1, r2: 5, c2: 1 }, 'won');
    t = setCellText(t, 5, 1, '=B2*1000');
    expect(at(t, 'B6')).toMatchObject({ v: '90,000원', n: 90000, f: '=B2*1000' });
    // 결과가 바탕 글과 다르면(1/3) n에 원래 수
    t = setCellText(scores, 5, 1, '=1/3');
    expect(at(t, 'B6')).toMatchObject({ v: '0.3333333333', n: 1 / 3 });
  });

  it('처음 넣는 식은 처음 가리킨 수 칸의 1,000·원·%를 따른다 (세는 함수는 아님)', () => {
    let t = setNumberFormat(scores, { r1: 1, c1: 1, r2: 4, c2: 1 }, 'won');
    t = setCellText(t, 5, 1, '=SUM(B2:B5)');
    expect(v(t, 'B6')).toBe('315원');
    expect(styleOf(t, at(t, 'B6'))?.nf).toBe('won');
    // 세는 함수는 따르지 않는다
    expect(v(setCellText(t, 5, 2, '=COUNT(B2:B5)'), 'C6')).toBe('4');
    // 이미 서식이 있는 칸은 그대로
    const pct = setNumberFormat(t, { r1: 5, c1: 3, r2: 5, c2: 3 }, 'comma');
    expect(v(setCellText(pct, 5, 3, '=B2*1000'), 'D6')).toBe('90,000');
    // 다시 고친 식은 서식을 새로 따르지 않는다 (지금 서식 그대로)
    const plain = setNumberFormat(t, { r1: 5, c1: 1, r2: 5, c2: 1 }, 'won');
    expect(v(setCellText(plain, 5, 1, '=SUM(B2:B3)'), 'B6')).toBe('160');
  });

  it('비우기(Delete)는 식도 지운다', () => {
    const t = clearRange(setCellText(scores, 5, 1, '=1+1'), { r1: 5, c1: 1, r2: 5, c2: 1 });
    expect(at(t, 'B6')).toEqual({ v: '' });
  });

  it('식이 식을 부른다 (차례와 상관없이)', () => {
    let t = setCellText(scores, 5, 0, '=B6*2');
    t = setCellText(t, 5, 1, '=C6+1');
    t = setCellText(t, 5, 2, '=SUM(C2:C5)');
    expect([v(t, 'A6'), v(t, 'B6'), v(t, 'C6')]).toEqual(['472', '236', '235']);
    t = setCellText(t, 1, 2, '0');
    expect([v(t, 'A6'), v(t, 'B6'), v(t, 'C6')]).toEqual(['312', '156', '155']);
  });

  it('바뀐 것이 없으면 같은 표 (다시 셈해도)', () => {
    const t = setCellText(scores, 5, 1, '=SUM(B2:B5)');
    expect(recalcTable(t)).toBe(t);
    expect(recalcTable(scores)).toBe(scores);
  });

  it('긴 사슬도 (아래로 채운 누적 합 500줄)', () => {
    let t = newEmptyTable(500, 1, 1);
    t = setCellText(t, 0, 0, '1');
    const rows = t.rows.map((row, r) => (r === 0 ? row : { cells: [{ v: '', f: `=A${r}+1` }] }));
    t = recalcTable({ ...t, rows: rows.reverse().reverse() });
    expect(t.rows[499].cells[0].v).toBe('500');
  });
});

describe('행·열을 넣고 빼면 식 주소가 따라간다 (ⓗ)', () => {
  it('주소 옮기기 - 넣기: 그 자리부터 밀림, 범위 안이면 범위가 늘어남', () => {
    expect(shiftFormula('=SUM(B2:B5)+A1', 'r', 2, 1)).toBe('=SUM(B2:B6)+A1');
    expect(shiftFormula('=SUM(B2:B5)', 'r', 1, 1)).toBe('=SUM(B3:B6)'); // 범위 첫 줄 위 = 통째로
    expect(shiftFormula('=SUM(B2:B5)', 'r', 5, 1)).toBe('=SUM(B2:B5)'); // 범위 바로 아래 = 그대로
    expect(shiftFormula('=$B$2*C3', 'c', 1, 1)).toBe('=$C$2*D3'); // 고정 주소도 (엑셀처럼)
    expect(shiftFormula('=sum(b2:b5) + "B2"', 'r', 0, 1)).toBe('=sum(B3:B6) + "B2"'); // 글은 그대로 (옮긴 주소만 대문자)
  });

  it('주소 옮기기 - 빼기: 범위가 줄고, 가리키던 칸이 빠지면 #REF!', () => {
    expect(shiftFormula('=SUM(B2:B5)', 'r', 2, -1)).toBe('=SUM(B2:B4)');
    expect(shiftFormula('=SUM(B2:B5)', 'r', 1, -1)).toBe('=SUM(B2:B4)');
    expect(shiftFormula('=SUM(B2:B5)', 'r', 0, -1)).toBe('=SUM(B1:B4)');
    expect(shiftFormula('=B3+C4', 'r', 2, -1)).toBe('=#REF!+C3');
    expect(shiftFormula('=SUM(B3:B3)', 'r', 2, -1)).toBe('=SUM(#REF!)');
    expect(shiftFormula('=B5:B2', 'r', 0, -1)).toBe('=B1:B4');
  });

  it('표에서: 범위 안에 행을 넣으면 합계 범위가 늘고 값은 그대로', () => {
    let t = setCellText(scores, 5, 1, '=SUM(B2:B5)');
    t = insertRow(t, 3);
    expect(at(t, 'B7')).toMatchObject({ f: '=SUM(B2:B6)', v: '315' });
    t = setCellText(t, 3, 1, '10');
    expect(v(t, 'B7')).toBe('325');
  });

  it('표에서: 행·열을 빼면 범위가 줄고 다시 셈, 가리키던 칸이 빠지면 #REF!', () => {
    let t = setCellText(scores, 5, 1, '=SUM(B2:B5)');
    t = setCellText(t, 5, 2, '=C2*2');
    t = deleteRow(t, 1); // 가 빠짐
    expect(at(t, 'B5')).toMatchObject({ f: '=SUM(B2:B4)', v: '225' });
    expect(at(t, 'C5')).toMatchObject({ f: '=#REF!*2', v: '#REF!' });
    // 열 넣고 빼기
    let u = setCellText(scores, 5, 4, '=B2+C2');
    u = insertCol(u, 2);
    expect(at(u, 'F6')).toMatchObject({ f: '=B2+D2', v: '170' });
    u = deleteCol(u, 1);
    expect(at(u, 'E6')).toMatchObject({ f: '=#REF!+C2', v: '#REF!' });
  });

  it('범위의 행을 모두 빼면 #REF!', () => {
    let t = setCellText(scores, 5, 2, '=SUM(B2:B5)');
    t = deleteRows(t, 1, 4);
    expect(at(t, 'C2')).toMatchObject({ f: '=SUM(#REF!)', v: '#REF!' });
  });
});
