// 년간 셈 (V4 yearSheet.test 옮김 - 기간은 V5 한 문서로)
import { describe, expect, it } from 'vitest';
import { periodsInDates } from './periodBars';
import { academicMonths, dayTooltip, monthSheetItems, monthWeeks } from './yearSheet';

describe('academicMonths', () => {
  it('3월~이듬해 2월, 1학기 3~8월·2학기 9~2월', () => {
    const m = academicMonths(2026);
    expect(m).toHaveLength(12);
    expect(m[0]).toEqual({ year: 2026, month: 3, key: '2026-03', label: '3월', semester: 1 });
    expect(m[5]).toMatchObject({ key: '2026-08', semester: 1 });
    expect(m[6]).toMatchObject({ key: '2026-09', semester: 2 });
    expect(m[10]).toEqual({ year: 2027, month: 1, key: '2027-01', label: '1월', semester: 2 });
    expect(m[11].key).toBe('2027-02');
  });
});

describe('monthWeeks', () => {
  it('2026년 10월: 1일이 목요일, 다섯 주', () => {
    const w = monthWeeks(2026, 10, true);
    expect(w).toHaveLength(5);
    expect(w[0]).toEqual([null, null, null, null, '2026-10-01', '2026-10-02', '2026-10-03']);
    expect(w[4][6]).toBe('2026-10-31');
  });
  it('주말을 숨기면 월~금, 빈 첫 주는 뺀다 (2026년 8월 1일은 토요일)', () => {
    const w = monthWeeks(2026, 8, false);
    expect(w[0]).toEqual(['2026-08-03', '2026-08-04', '2026-08-05', '2026-08-06', '2026-08-07']);
    expect(w.every((wk) => wk.length === 5)).toBe(true);
  });
});

interface Ev {
  id: string;
  date: string;
  endDate?: string;
  workdays?: boolean;
  text: string;
  done?: boolean;
  doneDates?: string[];
}

describe('periodsInDates', () => {
  it('보이는 날에 걸친 기간 하나씩 - 앞 달에서 이어지면 startsPeriod 아님, 주말 빼기는 그 날을 뺀다', () => {
    const dates = ['2026-10-01', '2026-10-02', '2026-10-05', '2026-10-06'];
    const periods: Ev[] = [
      { id: 'a', date: '2026-09-29', endDate: '2026-10-02', workdays: true, text: '앞 달에서' },
      { id: 'b', date: '2026-10-05', endDate: '2026-10-06', text: '안에서' },
      { id: 'c', date: '2026-11-01', endDate: '2026-11-03', text: '밖' },
    ];
    const out = periodsInDates(dates, periods);
    expect(out.map((p) => [p.item.id, p.cells.map((c) => `${c.date.slice(8)}:${c.index}`).join(','), p.total, p.startsPeriod, p.endsPeriod])).toEqual([
      ['a', '01:3,02:4', 4, false, true],
      ['b', '05:1,06:2', 2, true, true],
    ]);
  });
});

describe('monthSheetItems', () => {
  it('날짜 차례, 같은 날은 공휴일 → D-Day → 학사일정 → 기간 → 일정, 기간은 처음 날 한 번', () => {
    const dates = ['2026-10-02', '2026-10-03', '2026-10-05', '2026-10-06'];
    const single: Record<string, Ev[]> = {
      '2026-10-02': [{ id: 'e1', date: '2026-10-02', text: '학부모 상담' }],
      '2026-10-05': [{ id: 'e2', date: '2026-10-05', text: '회의', done: true }],
    };
    const period: Ev = { id: 'p1', date: '2026-10-05', endDate: '2026-10-06', text: '시험', doneDates: ['2026-10-05'] };
    const items = monthSheetItems<Ev>({
      dates,
      eventsOn: (d) => single[d] ?? [],
      periods: periodsInDates(dates, [period]),
      textOf: (e) => e.text,
      doneOn: (e, d) => !!e.done || !!e.doneDates?.includes(d),
      holidayOf: (d) => (d === '2026-10-03' ? '개천절' : undefined),
      ddays: [
        { id: 'd1', title: '수능', date: '2026-10-05' },
        { id: 'd2', title: '다른 달', date: '2026-11-19' },
      ],
      schoolOf: (d) => (d === '2026-10-05' ? ['중간고사'] : undefined),
    });
    expect(items.map((i) => [i.date.slice(8), i.kind, i.text])).toEqual([
      ['02', 'event', '학부모 상담'],
      ['03', 'holiday', '개천절'],
      ['05', 'dday', '수능'],
      ['05', 'school', '중간고사'],
      ['05', 'period', '시험'],
      ['05', 'event', '회의'],
    ]);
    expect(items.find((i) => i.kind === 'period')).toMatchObject({ endDate: '2026-10-06', done: false, continuesBefore: false, continuesAfter: false });
    expect(items.find((i) => i.text === '회의')!.done).toBe(true);
    // 기간 가운데 날의 풍선에도 기간이 보인다
    expect(dayTooltip('2026-10-06', items)).toBe('10월 6일\n📆 시험');
    expect(dayTooltip('2026-10-04', items)).toBe('10월 4일');
  });
});
