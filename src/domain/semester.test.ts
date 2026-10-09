// V4 lib/semester.test.ts 그대로 (evalSummary.semesterOf와 견주던 것은 '한 학기에만 든다'로 - 조사표는 P7)
import { describe, it, expect } from 'vitest';
import {
  getSemesterRanges,
  isVacation,
  isVacationDay,
  readTerms,
  schoolYearSpan,
  semesterConfigOf,
  semesterSpan,
  shiftDate,
  termSemesters,
  type SemesterConfig,
} from './semester';

// 2026학년도 예시: 여름 방학 7/21~8/16, 겨울 방학 1/5~2/28
const CONFIG: SemesterConfig = {
  summerStart: '2026-07-21',
  summerEnd: '2026-08-16',
  winterStart: '2027-01-05',
  winterEnd: '2027-02-28',
};

describe('shiftDate', () => {
  it('하루 앞뒤로 옮긴다', () => {
    expect(shiftDate('2026-07-21', -1)).toBe('2026-07-20');
    expect(shiftDate('2026-08-16', 1)).toBe('2026-08-17');
  });

  it('월/연 경계를 넘어간다', () => {
    expect(shiftDate('2026-03-01', -1)).toBe('2026-02-28');
    expect(shiftDate('2027-01-01', -1)).toBe('2026-12-31');
    expect(shiftDate('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('윤년 2월을 올바르게 처리한다', () => {
    expect(shiftDate('2028-03-01', -1)).toBe('2028-02-29');
  });

  it('빈 값이나 잘못된 값은 빈 문자열', () => {
    expect(shiftDate('', 1)).toBe('');
    expect(shiftDate('아무거나', 1)).toBe('');
  });
});

describe('getSemesterRanges', () => {
  it('1학기는 3월 1일부터 여름 방학 전날까지', () => {
    const { sem1 } = getSemesterRanges(CONFIG);
    expect(sem1.start).toBe('2026-03-01');
    expect(sem1.end).toBe('2026-07-20');
  });

  it('2학기는 여름 방학 다음 날부터 겨울 방학 전날까지', () => {
    const { sem2 } = getSemesterRanges(CONFIG);
    expect(sem2.start).toBe('2026-08-17');
    expect(sem2.end).toBe('2027-01-04');
  });

  it('학년도는 여름 방학 시작 연도를 따른다', () => {
    const { sem1 } = getSemesterRanges({ ...CONFIG, summerStart: '2030-07-25' });
    expect(sem1.start).toBe('2030-03-01');
    expect(sem1.end).toBe('2030-07-24');
  });

  it('방학 날짜가 비어 있으면 계산된 끝날도 비어 있다', () => {
    const ranges = getSemesterRanges({ ...CONFIG, summerStart: '', summerEnd: '' });
    expect(ranges.sem1.end).toBe('');
    expect(ranges.sem2.start).toBe('');
  });
});

describe('isVacationDay', () => {
  it('여름 방학 기간은 방학이다 (시작일·종료일 포함)', () => {
    expect(isVacationDay('2026-07-21', CONFIG)).toBe(true);
    expect(isVacationDay('2026-08-01', CONFIG)).toBe(true);
    expect(isVacationDay('2026-08-16', CONFIG)).toBe(true);
  });

  it('겨울 방학 기간도 방학이다', () => {
    expect(isVacationDay('2027-01-05', CONFIG)).toBe(true);
    expect(isVacationDay('2027-02-28', CONFIG)).toBe(true);
  });

  it('학기 중은 방학이 아니다', () => {
    expect(isVacationDay('2026-07-20', CONFIG)).toBe(false); // 여름 방학 전날
    expect(isVacationDay('2026-08-17', CONFIG)).toBe(false); // 여름 방학 다음 날
    expect(isVacationDay('2027-01-04', CONFIG)).toBe(false); // 겨울 방학 전날
    expect(isVacationDay('2026-05-10', CONFIG)).toBe(false);
  });

  it('방학 날짜가 비어 있으면 방학으로 보지 않는다', () => {
    expect(isVacationDay('2026-08-01', { ...CONFIG, summerStart: '', summerEnd: '' })).toBe(false);
  });
});

describe('schoolYearSpan · semesterSpan (검색·링크·내보내기·출석 누계의 기간)', () => {
  it('학년도는 3월 1일 ~ 이듬해 2월 끝 (윤년 2월 29일도 들어간다)', () => {
    expect(schoolYearSpan(2027)).toEqual({ start: '2027-03-01', end: '2028-02-29' });
    expect(schoolYearSpan(2026)).toEqual({ start: '2026-03-01', end: '2027-02-28' });
  });

  it('그 학년도 방학 설정이 있으면 2학기는 여름 방학 끝난 다음 날부터 2월 끝까지', () => {
    expect(semesterSpan(2026, 1, CONFIG)).toEqual({ start: '2026-03-01', end: '2026-08-16' });
    expect(semesterSpan(2026, 2, CONFIG)).toEqual({ start: '2026-08-17', end: '2027-02-28' });
  });

  it('설정이 없거나 다른 학년도 것이면 3~8월 / 9월 ~ 2월', () => {
    expect(semesterSpan(2025, 1, CONFIG)).toEqual({ start: '2025-03-01', end: '2025-08-31' });
    expect(semesterSpan(2025, 2, CONFIG)).toEqual({ start: '2025-09-01', end: '2026-02-28' });
    expect(semesterSpan(2027, 2, null)).toEqual({ start: '2027-09-01', end: '2028-02-29' });
  });

  it('두 학기가 학년도를 빈틈없이 나눈다', () => {
    for (const cfg of [CONFIG, null]) {
      const s1 = semesterSpan(2026, 1, cfg);
      const s2 = semesterSpan(2026, 2, cfg);
      expect(shiftDate(s1.end, 1)).toBe(s2.start);
      for (const day of ['2026-03-01', '2026-07-30', '2026-08-16', '2026-08-17', '2026-09-01', '2027-01-20', '2027-02-27']) {
        const inS1 = day >= s1.start && day <= s1.end;
        const inS2 = day >= s2.start && day <= s2.end;
        expect(inS1 !== inS2).toBe(true);
      }
    }
  });
});

describe('V5 학년도마다 방학 (settings/common.terms)', () => {
  const terms = readTerms({
    '2026': { summer: { from: '2026-07-21', to: '2026-08-16' }, winter: { from: '2027-01-05', to: '2027-02-28' } },
    '2027': { summer: { from: '2027-07-20', to: '2027-08-15' }, winter: { from: '2027-08-20', to: '2027-08-01' } }, // 겨울이 거꾸로 - 뺀다
    '이상한': { summer: { from: '2026-07-01', to: '2026-07-02' } },
    '2028': { summer: '여름' },
  })!;

  it('틀린 칸·해는 빼고 읽는다', () => {
    expect(Object.keys(terms)).toEqual(['2026', '2027']);
    expect(terms['2027'].winter).toBeUndefined();
    expect(readTerms([1])).toBeUndefined();
    expect(readTerms(null)).toBeUndefined();
  });

  it('방학은 그 날의 학년도 것으로 본다 (2027-02는 2026학년도 겨울)', () => {
    expect(isVacation('2026-07-21', terms)).toBe(true);
    expect(isVacation('2026-08-17', terms)).toBe(false);
    expect(isVacation('2027-02-10', terms)).toBe(true);
    expect(isVacation('2027-07-25', terms)).toBe(true);
    expect(isVacation('2028-07-25', terms)).toBe(false); // 적지 않은 학년도
    expect(isVacation('2026-07-25', {})).toBe(false);
  });

  it('학기 셈에 넘기는 옛 모양 - 여름이 없으면 null', () => {
    expect(semesterConfigOf(terms, 2026)).toEqual(CONFIG);
    expect(semesterSpan(2026, 2, semesterConfigOf(terms, 2026))).toEqual({ start: '2026-08-17', end: '2027-02-28' });
    expect(semesterConfigOf(terms, 2028)).toBeNull();
  });

  it('창에 보이는 학기', () => {
    expect(termSemesters(terms['2026'], 2026)).toEqual({
      sem1: { from: '2026-03-01', to: '2026-07-20' },
      sem2: { from: '2026-08-17', to: '2027-01-04' },
    });
    expect(termSemesters(terms['2027'], 2027).sem2).toBeNull();
    expect(termSemesters(undefined, 2027)).toEqual({ sem1: null, sem2: null });
  });
});
