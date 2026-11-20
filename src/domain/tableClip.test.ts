// 메모 표와 엑셀 오가기 (P48-5 ■1 - PLAN 5장 'P48' ⓛ): 범위 → 탭 글·HTML, 탭 글·HTML → 칸 값 격자, 고른 칸부터 채우기
import { describe, expect, it } from 'vitest';
import type { EntryTable } from '../data/types';
import { parseClipboardTable } from './entryTable';
import { clipGrid, isManyCells, parseTsv, PASTE_MERGED_TEXT, pasteGrid, rangeHtml, rangeTsv } from './tableClip';
import { GROW_LIMIT_TEXT, newEmptyTable, setCellText } from './tableEdit';
import { setAlign, setFill, setNumberFormat, stepDecimals, styleOf, toggleBold } from './tableFormat';

/** 글 격자로 표 */
function grid(...rows: string[][]): EntryTable {
  let t = newEmptyTable(rows.length, Math.max(...rows.map((r) => r.length)), 1);
  rows.forEach((row, r) => row.forEach((v, c) => v && (t = setCellText(t, r, c, v))));
  return t;
}
/** 범위 'B2:C5' (한 칸 'B6') */
const R = (name: string) => {
  const [a, b = a] = name.split(':');
  const p = (s: string) => ({ r: Number(s.slice(1)) - 1, c: s.charCodeAt(0) - 65 });
  return { r1: p(a).r, c1: p(a).c, r2: p(b).r, c2: p(b).c };
};
const at = (t: EntryTable, name: string) => {
  const m = /^([A-Z])(\d+)$/.exec(name)!;
  return t.rows[Number(m[2]) - 1].cells[m[1].charCodeAt(0) - 65];
};
const values = (t: EntryTable) => t.rows.map((r) => r.cells.map((c) => c.v));
function ok(res: ReturnType<typeof pasteGrid>) {
  if ('error' in res) throw new Error(res.error);
  return res;
}

// 엑셀에서 두 줄 세 칸을 복사하면 오는 HTML (줄여 옮김 - 서식은 클래스, 수는 x:num)
const EXCEL = `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><style><!--
td {font-size:11.0pt; text-align:general;}
.xl65 {font-weight:700; background:#FFFF00;}
--></style></head><body><!--StartFragment-->
<table border=0 cellpadding=0 cellspacing=0>
 <tr height=22><td class=xl65>이름</td><td class=xl65>국어</td><td class=xl65>학급비</td></tr>
 <tr height=22><td>김하나</td><td align=right x:num>95</td><td align=right x:num="12000">12,000원</td></tr>
</table><!--EndFragment--></body></html>`;
// 엑셀이 같이 주는 탭 글 (줄마다 끝에 줄 바꿈)
const EXCEL_TEXT = '이름\t국어\t학급비\r\n김하나\t95\t12,000원\r\n';
// 구글 시트 (칸 style에 바로)
const SHEETS = `<meta charset="utf-8"><google-sheets-html-origin><table xmlns="http://www.w3.org/1999/xhtml" border="1" style="border-collapse:collapse"><colgroup><col width="100"/><col width="80"/></colgroup><tbody><tr style="height:21px;"><td style="font-weight:bold;">이름</td><td style="text-align:right;">점수</td></tr><tr style="height:21px;"><td>박둘</td><td style="text-align:right;">88</td></tr></tbody></table>`;

describe('탭 글 읽기 (parseTsv)', () => {
  it('칸 = 탭, 행 = 줄 바꿈 · 끝 줄 바꿈 하나는 버림 · \\r\\n도', () => {
    expect(parseTsv(EXCEL_TEXT)).toEqual([
      ['이름', '국어', '학급비'],
      ['김하나', '95', '12,000원'],
    ]);
    expect(parseTsv('a\tb')).toEqual([['a', 'b']]);
    expect(parseTsv('a\nb\n')).toEqual([['a'], ['b']]);
    // 빈 칸·빈 줄도 칸으로 (엑셀이 빈 마지막 줄을 복사하면 '\r\n\r\n')
    expect(parseTsv('a\t\tc\n\n')).toEqual([['a', '', 'c'], ['']]);
  });

  it('따옴표로 묶은 칸 = 안의 줄 바꿈·탭·"" 그대로 (엑셀 칸 안 줄 바꿈) · 닫는 따옴표 뒤에 글이 있으면 따옴표째 글', () => {
    expect(parseTsv('"1반\n담임"\t25\n"말 ""인용"""\tx')).toEqual([
      ['1반\n담임', '25'],
      ['말 "인용"', 'x'],
    ]);
    expect(parseTsv('"인용" 글\tb')).toEqual([['"인용" 글', 'b']]);
  });

  it('탭·줄 바꿈이 없는 한 줄은 그대로 한 칸 (따옴표도 그대로)', () => {
    expect(parseTsv('"인용"')).toEqual([['"인용"']]);
    expect(parseTsv('  앞 빈칸')).toEqual([['  앞 빈칸']]);
  });
});

describe('붙여넣은 것 → 칸 값 격자 (clipGrid)', () => {
  it('엑셀 HTML이 먼저 (탭 글보다) - 보이는 값 그대로', () => {
    const got = clipGrid(EXCEL, EXCEL_TEXT);
    expect(got).toEqual({ table: true, grid: [['이름', '국어', '학급비'], ['김하나', '95', '12,000원']] });
  });

  it('구글 시트 HTML · 병합으로 가려진 칸은 빈 칸 · HTML에 표가 없으면 글', () => {
    expect(clipGrid(SHEETS, '이름\t점수\n박둘\t88')).toEqual({ table: true, grid: [['이름', '점수'], ['박둘', '88']] });
    const merged = '<table><tr><td colspan="2">제목</td></tr><tr><td>a</td><td>b</td></tr></table>';
    expect(clipGrid(merged, '')).toEqual({ table: true, grid: [['제목', ''], ['a', 'b']] });
    expect(clipGrid('<b>굵은 글</b>', '굵은 글')).toEqual({ table: false, grid: [['굵은 글']] });
    expect(clipGrid('', '')).toBeNull();
  });

  it('너무 큰 표는 안내 · 칸 수 세기', () => {
    const big = `<table>${Array.from({ length: 61 }, () => `<tr>${'<td>1</td>'.repeat(50)}</tr>`).join('')}</table>`;
    expect(clipGrid(big, '')).toEqual({ error: expect.stringContaining('너무 큽니다') });
    expect(isManyCells([['a']])).toBe(false);
    expect(isManyCells([['a', 'b']])).toBe(true);
    expect(isManyCells([['a'], ['b']])).toBe(true);
  });
});

describe('범위 복사 (rangeTsv · rangeHtml)', () => {
  const money = () => {
    let t = grid(['항목', '금액', '비율'], ['간식', '12000', '0.25'], ['합계', '=SUM(B2:B2)', '']);
    t = setNumberFormat(t, R('B2:B3'), 'won');
    t = setNumberFormat(t, R('C2'), 'pct');
    t = toggleBold(t, R('A1:C1'));
    t = setFill(t, R('A1:C1'), '#fef9c3');
    t = setAlign(t, R('A3'), 'center');
    return t;
  };

  it('탭 글 = 보이는 값 (서식·식 결과) · 고른 범위만 · 칸 안 줄 바꿈은 따옴표로', () => {
    const t = money();
    expect(rangeTsv(t, R('A1:C3'))).toBe('항목\t금액\t비율\n간식\t12,000원\t25%\n합계\t12,000원\t');
    expect(rangeTsv(t, R('B2'))).toBe('12,000원');
    const multi = grid(['1반\n담임', '말 "인용"'], ['"따옴표', 'x\ty']);
    const text = rangeTsv(multi, R('A1:B2'));
    expect(text).toBe('"1반\n담임"\t말 "인용"\n"""따옴표"\t"x\ty"');
    // 되읽으면 같은 값
    expect(parseTsv(text)).toEqual([
      ['1반\n담임', '말 "인용"'],
      ['"따옴표', 'x\ty'],
    ]);
  });

  it('HTML = 서식째 (굵게·칸 색·맞춤) + 수 칸은 x:num·엑셀 표시 형식 → V5 다른 메모에 붙이면 같은 값·서식의 표', () => {
    const t = stepDecimals(money(), R('C2'), { r: 1, c: 2 }, 1);
    expect(at(t, 'C2').v).toBe('25.0%');
    const html = rangeHtml(t, R('A1:C3'));
    expect(html).toContain('x:num="12000"');
    expect(html).toContain('x:num="0.25"');
    // 원 = #,##0"원" (따옴표는 엑셀 HTML처럼 \0022), % = 보이는 소수 자리만큼
    expect(html).toContain('mso-number-format:&quot;#,##0\\0022원\\0022&quot;');
    expect(html).toContain('mso-number-format:&quot;0.0%&quot;');
    // 글 칸('항목')에는 x:num 없음
    expect(html).not.toMatch(/x:num="[^"]*">항목/);
    const back = parseClipboardTable(html) as EntryTable;
    expect(values(back)).toEqual([
      ['항목', '금액', '비율'],
      ['간식', '12,000원', '25.0%'],
      ['합계', '12,000원', ''],
    ]);
    const s = styleOf(back, at(back, 'A1'))!;
    expect(s.b).toBe(1);
    expect(s.bg).toBe('#fef9c3');
    expect(styleOf(back, at(back, 'A3'))?.ha).toBe('center');
    // 수 칸은 오른쪽 (x:num - 엑셀 '일반' 맞춤)
    expect(styleOf(back, at(back, 'B2'))?.ha).toBe('right');
  });

  it('병합·줄 바꿈·앞 빈칸·열 너비·줄 높이째 · 범위 밖 칸은 빼고', () => {
    const src = parseClipboardTable(
      '<table><col width="80"><col width="60"><col width="40"><tr height="30"><td colspan="2">제목</td><td>c</td></tr><tr><td>&nbsp;&nbsp;둘 빈칸</td><td>줄<br>바꿈</td><td>z</td></tr></table>'
    ) as EntryTable;
    const html = rangeHtml(src, R('A1:B2'));
    expect(html).toContain('colspan="2"');
    const back = parseClipboardTable(html) as EntryTable;
    expect(values(back)).toEqual([
      ['제목', ''],
      ['  둘 빈칸', '줄\n바꿈'],
    ]);
    expect(at(back, 'A1').cs).toBe(2);
    expect(back.cols).toEqual([80, 60]);
    expect(back.rows[0].h).toBe(30);
    expect(rangeTsv(src, R('A1:B2'))).toBe('제목\t\n  둘 빈칸\t"줄\n바꿈"');
  });
});

describe('고른 칸부터 채우기 (pasteGrid)', () => {
  it('고른 칸부터 값만 - 붙이는 칸 서식은 그대로(원 칸에 12000 → 12,000원), 식·글은 칸에 친 것처럼', () => {
    let t = grid(['', '', ''], ['', '', ''], ['', '', '']);
    t = setNumberFormat(t, R('C2:C3'), 'won');
    const res = ok(pasteGrid(t, R('B2'), [['간식', '12000'], ['합계', '=SUM(C2:C2)']]));
    expect(res.sel).toEqual(R('B2:C3'));
    expect(res.grown).toBe(false);
    expect(values(res.table)).toEqual([
      ['', '', ''],
      ['', '간식', '12,000원'],
      ['', '합계', '12,000원'],
    ]);
    expect(at(res.table, 'C2').n).toBe(12000);
    expect(at(res.table, 'C3').f).toBe('=SUM(C2:C2)');
  });

  it('모자라면 아래·오른쪽으로 늘린다 (새 칸은 마지막 행·열의 서식) - 식 주소는 그대로', () => {
    let t = grid(['a', 'b'], ['1', '=SUM(A2:A9)']);
    t = toggleBold(t, R('B2'));
    const res = ok(pasteGrid(t, R('B2'), parseTsv('x\ty\tz\n1\t2\t3\n')));
    expect(res.grown).toBe(true);
    expect(res.sel).toEqual(R('B2:D3'));
    expect(values(res.table)).toEqual([
      ['a', 'b', '', ''],
      ['1', 'x', 'y', 'z'],
      ['', '1', '2', '3'],
    ]);
    // 새 행·열 칸은 마지막 행·열 서식 (B2 굵게 → C2·D2·B3 굵게)
    expect(styleOf(res.table, at(res.table, 'D2'))?.b).toBe(1);
    expect(styleOf(res.table, at(res.table, 'B3'))?.b).toBe(1);
    expect(styleOf(res.table, at(res.table, 'A3'))?.b).toBeUndefined();
  });

  it('식을 덮어 쓰면 식은 빠지고, 남은 식은 다시 셈', () => {
    const t = grid(['10', '=A1*2'], ['20', '=A2*2']);
    const res = ok(pasteGrid(t, R('A1'), [['5'], ['7']]));
    expect(values(res.table)).toEqual([
      ['5', '10'],
      ['7', '14'],
    ]);
    const over = ok(pasteGrid(t, R('B1'), [['직접'], ['값']]));
    expect(at(over.table, 'B1').f).toBeUndefined();
    expect(values(over.table)[1]).toEqual(['20', '값']);
  });

  it('한 칸 값 + 여러 칸 고름 = 고른 칸 모두에 · 한 칸 고름 = 병합 칸이어도 그 칸에', () => {
    const t = grid(['', ''], ['', '']);
    const res = ok(pasteGrid(t, R('A1:B2'), [['○']]));
    expect(values(res.table)).toEqual([
      ['○', '○'],
      ['○', '○'],
    ]);
    expect(res.sel).toEqual(R('A1:B2'));
    const merged = parseClipboardTable('<table><tr><td colspan="2">제목</td></tr><tr><td>a</td><td>b</td></tr></table>') as EntryTable;
    const one = ok(pasteGrid(merged, R('A1'), [['새 제목']]));
    expect(values(one.table)[0]).toEqual(['새 제목', '']);
    expect(at(one.table, 'A1').cs).toBe(2);
  });

  it('병합 칸과 겹치면 안내하고 붙이지 않는다 · 3,000칸을 넘으면 안내', () => {
    const merged = parseClipboardTable('<table><tr><td>a</td><td colspan="2">제목</td></tr><tr><td>a</td><td>b</td><td>c</td></tr></table>') as EntryTable;
    expect(pasteGrid(merged, R('A1'), [['1', '2']])).toEqual({ error: PASTE_MERGED_TEXT });
    expect(pasteGrid(merged, R('A2'), [['1', '2', '3']])).not.toHaveProperty('error');
    const t = newEmptyTable(3, 3, 1);
    const tall = Array.from({ length: 1001 }, () => ['1', '2', '3']);
    expect(pasteGrid(t, R('A1'), tall)).toEqual({ error: GROW_LIMIT_TEXT });
  });

  it('엑셀 범위를 그대로 → 엑셀에 있던 값 (V5에서 복사한 범위를 다른 표에 붙여도 같은 값)', () => {
    const got = clipGrid(EXCEL, EXCEL_TEXT);
    if (!got || 'error' in got) throw new Error('읽지 못함');
    const res = ok(pasteGrid(newEmptyTable(3, 3, 1), R('A1'), got.grid));
    expect(values(res.table)).toEqual([
      ['이름', '국어', '학급비'],
      ['김하나', '95', '12,000원'],
      ['', '', ''],
    ]);
    const again = clipGrid(rangeHtml(res.table, R('A1:C2')), rangeTsv(res.table, R('A1:C2')));
    expect(again).toEqual({ table: true, grid: got.grid });
  });
});
