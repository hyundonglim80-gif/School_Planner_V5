import { describe, expect, it } from 'vitest';
import {
  buildEvalRows,
  buildMemoRows,
  buildScheduleRows,
  mergeSheetRoster,
  parseRosterSheet,
  evalUpdatesFor,
  formatItemLine,
  formatPeriodCell,
  parseEvalRows,
  parseItemLine,
  parseMemoRows,
  parsePeriodCell,
  parseScheduleRows,
  realLabels,
  spreadsheetIdOf,
  type ScheduleDay,
  type SheetEval,
  type SheetsInclude,
} from './sheets';

// V4 lib/sheetsSync.test.ts의 칸 모양 시험 (자료 모양만 V5)
const ALL: SheetsInclude = { event: true, class: true, journal: true, evaluation: true, memo: true };

describe('한 줄', () => {
  it('완료는 [v], 라벨은 [묶음] - 적은 대로 되읽는다', () => {
    const line = formatItemLine('학년 협의회', ['회의', '공문'], true, '일정');
    expect(line).toBe('[v] [회의, 공문] 학년 협의회');
    expect(parseItemLine(line)).toEqual({ content: '학년 협의회', labels: ['회의', '공문'], completed: true });
    expect(parseItemLine('그냥 적은 줄')).toEqual({ content: '그냥 적은 줄', labels: [], completed: false });
    expect(parseItemLine('   ')).toBeNull();
  });
  it('라벨이 없을 때 넣은 자리 글자는 라벨이 아니다', () => {
    expect(realLabels(parseItemLine(formatItemLine('x', [], false, '일정'))!.labels, '일정')).toEqual([]);
    expect(realLabels(['회의'], '일정')).toEqual(['회의']);
  });
  it('교시 칸: 셋을 한 칸에 · 묶음이 하나면 과목 · 없으면 메모', () => {
    expect(formatPeriodCell({ subject: '국어', memo: '단원평가', supplies: '학습지' })).toBe('[국어] 단원평가 [학습지]');
    expect(formatPeriodCell({ subject: '국어', memo: '', supplies: '' })).toBe('[국어]');
    expect(parsePeriodCell('[국어] 단원평가 [학습지]')).toEqual({ subject: '국어', memo: '단원평가', supplies: '학습지' });
    expect(parsePeriodCell('[국어] 단원평가')).toEqual({ subject: '국어', memo: '단원평가', supplies: '' });
    expect(parsePeriodCell('메모만')).toEqual({ subject: '', memo: '메모만', supplies: '' });
    expect(parsePeriodCell('')).toEqual({ subject: '', memo: '', supplies: '' });
  });
});

describe("'일정기록' 시트", () => {
  const day: ScheduleDay = {
    date: '2027-03-02',
    events: [{ id: 'E1', text: '협의회', labels: ['회의'], done: false }],
    periods: [{ subject: '국어', memo: '', supplies: '' }, { subject: '수학', memo: '분수', supplies: '' }],
    records: [{ id: 'N1', text: '상담', labels: [], done: true }],
    evals: ['받아쓰기'],
  };
  it('머리말 차례 = 날짜 · 일정 · 교시 · 기록 · 조사표 · 메타데이터 둘 (V3·V4와 같다)', () => {
    const rows = buildScheduleRows([day], ALL, ['1교시', '2교시']);
    expect(rows[0]).toEqual(['날짜', '일정', '1교시', '2교시', '기록', '조사표', '일정 메타데이터 (수정금지)', '기록 메타데이터 (수정금지)']);
    expect(rows[1]).toEqual(['2027-03-02', '[회의] 협의회', '[국어]', '[수학] 분수', '[v] [기록] 상담', '받아쓰기', '[{"id":"E1"}]', '[{"id":"N1"}]']);
  });
  it('내보낸 것을 그대로 되읽으면 id와 값이 나오고, 조사표 칸을 교시로 세지 않는다', () => {
    const back = parseScheduleRows(buildScheduleRows([day], ALL, ['1교시', '2교시']), ALL);
    expect(back).toHaveLength(1);
    expect(back[0].events).toEqual([{ id: 'E1', content: '협의회', labels: ['회의'], completed: false }]);
    expect(back[0].records).toEqual([{ id: 'N1', content: '상담', labels: ['기록'], completed: true }]);
    expect(back[0].periods).toEqual({ 1: { subject: '국어', memo: '', supplies: '' }, 2: { subject: '수학', memo: '분수', supplies: '' } });
  });
  it('손으로 더한 줄(메타데이터 없음)은 id 없이 · 날짜가 아닌 줄은 건너뛴다', () => {
    const rows = buildScheduleRows([day], ALL, ['1교시', '2교시']);
    rows[1][1] += '\n[행사] 새로 적은 것';
    rows.push(['메모', 'x']);
    const back = parseScheduleRows(rows, ALL);
    expect(back).toHaveLength(1);
    expect(back[0].events?.[1]).toEqual({ content: '새로 적은 것', labels: ['행사'], completed: false });
  });
  it('고르지 않은 종류는 칸을 만들지도 읽지도 않는다', () => {
    const only = { ...ALL, class: false, evaluation: false, journal: false };
    const rows = buildScheduleRows([day], only, ['1교시', '2교시']);
    expect(rows[0]).toEqual(['날짜', '일정', '일정 메타데이터 (수정금지)']);
    expect(parseScheduleRows(rows, only)[0]).toEqual({ date: '2027-03-02', events: [{ id: 'E1', content: '협의회', labels: ['회의'], completed: false }] });
  });
});

describe("'메모' 시트", () => {
  it('머리말 · O/X · 되읽기 · 링크(LINK) 줄과 빈 줄은 건너뛴다', () => {
    const rows = buildMemoRows([{ id: 'M1', text: '준비물', done: true, labels: ['업무', '긴급'], url: '', createdAt: 5 }]);
    expect(rows[0]).toEqual(['데이터분류', 'ID', '내용/이름', '완료여부(O/X)', '라벨', '주소/URL', '생성일자(타임스탬프)']);
    expect(rows[1]).toEqual(['MEMO', 'M1', '준비물', 'O', '업무,긴급', '', '5']);
    rows.push(['LINK', 'L1', '주소', '', '', 'https://x', '']);
    rows.push(['MEMO', 'M2', '', 'X', '', '', '']);
    rows.push(['MEMO', '', '새 메모', 'X', '', '', '']);
    expect(parseMemoRows(rows)).toEqual([
      { id: 'M1', text: '준비물', done: true, labels: ['업무', '긴급'] },
      { id: '', text: '새 메모', done: false, labels: [] },
    ]);
  });
});

describe("'조사표_학급' 시트", () => {
  const ev = (over: Partial<SheetEval> = {}): SheetEval => ({
    id: 'EV1',
    date: '2027-03-02',
    period: 2,
    classId: '2027-5-2',
    title: '받아쓰기',
    type: 'eval',
    indiv: true,
    students: [
      { sid: 's1', num: 1, name: '가' },
      { sid: 's2', num: 2, name: '나' },
    ],
    values: { s1: { indiv: '상', reason: '' } },
    ...over,
  });
  it('머리말 여덟 줄 + 학생 줄, 제목·id는 첫 칸에만', () => {
    const rows = buildEvalRows([ev({ group: true })]);
    expect(rows).toHaveLength(10);
    expect(rows[0]).toEqual(['상위 항목(조사표 제목)', '', '', '받아쓰기', '', '', '']);
    expect(rows[1].slice(3)).toEqual(['EV1', '', '', '']);
    expect(rows[3][3]).toBe('2교시');
    expect(rows[7].slice(3)).toEqual(['조이름', '조별결과', '개별결과', '미평가사유(메모)']);
    expect(rows[8].slice(0, 2)).toEqual(['1', '가']);
  });
  it('체크는 O/X, 메모는 한 칸', () => {
    const rows = buildEvalRows([ev({ id: 'C', type: 'check', values: { s1: { checked: true }, s2: { checked: false } } }), ev({ id: 'M', type: 'memo', values: { s2: { memo: '잘함' } } })]);
    expect(rows[7].slice(3)).toEqual(['체크결과', '미평가사유(메모)', '메모내용']);
    expect(rows[8].slice(3)).toEqual(['O', '', '']);
    expect(rows[9].slice(3)).toEqual(['X', '', '잘함']);
  });
  it('내보낸 표를 그대로 되읽으면 바뀐 것이 없고, 시트에서 고친 점수는 들어온다', () => {
    const e = ev();
    const rows = buildEvalRows([e]);
    expect(evalUpdatesFor(e, parseEvalRows(rows))).toEqual({});
    rows[9][3] = '중';
    expect(evalUpdatesFor(e, parseEvalRows(rows))).toEqual({ s2: { indiv: '중' } });
    rows[8][3] = '';
    expect(evalUpdatesFor(e, parseEvalRows(rows))).toEqual({ s1: {}, s2: { indiv: '중' } });
  });
  it('시트에만 있는 조사표는 버리고, 머리말을 모르면 읽지 않는다', () => {
    const rows = buildEvalRows([ev()]);
    expect(evalUpdatesFor(ev({ id: 'OTHER' }), parseEvalRows(rows))).toEqual({});
    expect(parseEvalRows([['아무'], ['거나']])).toEqual([]);
  });
  it('같은 번호의 두 학생(전출·전입)은 따로 - 이름까지 맞는 줄로, 그 번호 줄이 하나면 이름을 고쳐도 받는다', () => {
    const a = ev({ students: [{ sid: 'old', num: 3, name: '전출' }], values: { old: { indiv: '상' } } });
    const b = ev({ id: 'EV2', students: [{ sid: 'new', num: 3, name: '전입' }], values: {} });
    const rows = buildEvalRows([a, b]);
    expect(rows.slice(8).map((r) => r[1])).toEqual(['전입', '전출']);
    const ups = parseEvalRows(rows);
    expect(evalUpdatesFor(a, ups)).toEqual({});
    expect(evalUpdatesFor(b, ups)).toEqual({});
    const one = buildEvalRows([ev()]);
    one[9][1] = '나나';
    one[9][3] = '하';
    expect(evalUpdatesFor(ev(), parseEvalRows(one))).toEqual({ s2: { indiv: '하' } });
  });
});

describe('명렬표 시트', () => {
  it('머리말 아래 번호·이름이 있는 줄만, 성별 글자 · 넷째 칸부터 특이사항', () => {
    const rows = [['상위 항목(조사표 제목)', '', ''], ['번호', '이름', '성별', '메모'], ['1', '가', '남'], ['2', ' 나 ', 'F', '알레르기', '안경'], ['x', '다'], ['3', '']];
    expect(parseRosterSheet(rows)).toEqual([
      { num: 1, name: '가', gender: 'M', status: 'active' },
      { num: 2, name: '나', gender: 'F', status: 'active', note: '알레르기 안경' },
    ]);
    expect(parseRosterSheet([['1', '가']])).toEqual([{ num: 1, name: '가', gender: '', status: 'active' }]);
  });
  it('전출 표시·특이사항·학생 id는 잇고, 시트에서 빠진 전출 학생은 남긴다', () => {
    const current = [
      { sid: 'a', num: 1, name: '가', status: 'active' as const, note: '앱 메모' },
      { sid: 'b', num: 2, name: '나', status: 'out' as const, outDate: '2027-04-01' },
      { sid: 'c', num: 3, name: '다', status: 'out' as const },
    ];
    let n = 0;
    const { students, keptLeavers } = mergeSheetRoster(
      [
        { num: 1, name: '가', gender: 'M', status: 'active' },
        { num: 2, name: '나', gender: '', status: 'active' },
        { num: 4, name: '라', gender: '', status: 'active' },
      ],
      current,
      () => `new${++n}`,
    );
    expect(keptLeavers).toBe(1);
    expect(students.map((s) => [s.sid, s.num, s.status, s.note ?? ''])).toEqual([
      ['a', 1, 'active', '앱 메모'],
      ['b', 2, 'out', ''],
      ['c', 3, 'out', ''],
      ['new1', 4, 'active', ''],
    ]);
    expect(students[1].outDate).toBe('2027-04-01');
  });
});

describe('시트 주소', () => {
  it('주소나 id에서 id를 뽑는다', () => {
    expect(spreadsheetIdOf('https://docs.google.com/spreadsheets/d/1AbC_defGHIjklMNOpqrSTUvwxYZ012345/edit#gid=0')).toBe('1AbC_defGHIjklMNOpqrSTUvwxYZ012345');
    expect(spreadsheetIdOf('1AbC_defGHIjklMNOpqrSTUvwxYZ012345')).toBe('1AbC_defGHIjklMNOpqrSTUvwxYZ012345');
    expect(spreadsheetIdOf('아무 글')).toBeNull();
  });
});
