import { describe, expect, it } from 'vitest';
import { attendanceTimeline, noteTimeline, recordCopyText, sortTimeline } from './studentRecord';

const KEY = '2026-5-2/a1';

describe('학생 기록 줄', () => {
  it('그 학생이 붙은 기록·메모만 (지운 것 빼고), 메모의 날 = 옮겨 온 날 → 만든 날', () => {
    const created = new Date(2026, 3, 9, 10).getTime();
    const items = noteTimeline(
      [
        { id: 'j1', date: '2026-04-10', text: '발표를 잘함', studentIds: [KEY] },
        { id: 'j2', date: '2026-04-11', text: '다른 학생', studentIds: ['2026-5-2/a2'] },
        { id: 'm1', date: null, fromDate: '2026-04-08', text: '상담', studentIds: [KEY] },
        { id: 'm2', date: null, createdAt: created, text: '메모', studentIds: [KEY] },
        { id: 'x', date: '2026-04-12', text: '지움', studentIds: [KEY], deletedAt: 1 },
      ],
      KEY,
      'u_me',
      false,
      (n) => (n.id === 'j1' ? '관찰' : ''),
    );
    expect(items.map((i) => [i.itemId, i.kind, i.date, i.labels])).toEqual([
      ['j1', 'journal', '2026-04-10', '관찰'],
      ['m1', 'memo', '2026-04-08', ''],
      ['m2', 'memo', '2026-04-09', ''],
    ]);
  });

  it('날짜 차례 - 같은 날은 출결 먼저', () => {
    const att = attendanceTimeline([{ date: '2026-04-10', record: { kind: 'late', reason: 'sick', periods: [1] } }]);
    expect(att[0].text).toBe('지각(질병) 1교시');
    const all = sortTimeline([{ key: 'j', date: '2026-04-10', kind: 'journal', text: '기록' }, ...att, { key: 'm', date: '2026-04-01', kind: 'memo', text: '메모' }]);
    expect(all.map((i) => i.kind)).toEqual(['memo', 'attendance', 'journal']);
  });

  it('전체 복사 - 조사표는 적은 값만 날짜 차례로 섞는다', () => {
    const text = recordCopyText(
      '김하나 누가기록',
      [{ key: 'j', date: '2026-04-10', kind: 'journal', text: '발표를\n잘함' }],
      [
        { date: '2026-04-09', type: 'eval', subject: '수학', title: '단원평가', cell: { main: '잘함', note: '식' } },
        { date: '2026-04-11', type: 'check', title: '준비물', cell: { main: '', note: '' } },
      ],
    );
    expect(text).toBe('김하나 누가기록\n2026-04-09 [평가] 수학 단원평가: 잘함 - 식\n2026-04-10 [기록] 발표를 / 잘함');
  });
});
