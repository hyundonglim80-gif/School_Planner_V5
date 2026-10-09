// V4 lib/studentTag.test.ts·mention.test.ts 그대로 + V5 studentIds('{classId}/{sid}')
import { describe, expect, it } from 'vitest';
import type { RosterClass } from './roster';
import {
  applyMention,
  findMention,
  findStudentTags,
  makeStudentTag,
  matchMentionStudents,
  parseStudentKey,
  studentIdsToSave,
  studentKeysOfTags,
  studentOfKey,
} from './studentTag';

const st = (sid: string, num: number, name: string, out = false) => ({ sid, num, name, status: out ? ('out' as const) : ('active' as const) });
const classes: RosterClass[] = [
  { year: 2025, grade: 4, num: 3, students: [st('a1', 1, '김지우'), st('a2', 2, '박서준')] },
  { year: 2026, grade: 4, num: 3, students: [st('b1', 1, '김지우'), st('b2', 2, '이도윤'), st('b5', 5, '김지호'), st('b6', 6, '최지아', true)] },
  { year: 2026, grade: 5, num: 1, students: [st('c3', 3, '정하은')] },
];

describe('학생 태그 #학년도학년반번호', () => {
  it('두 자리씩 이어 만든다', () => {
    expect(makeStudentTag({ year: 2026, grade: 4, classNum: 3, num: 5 })).toBe('#26040305');
  });
  it('글의 처음·끝·가운데 어디에 있어도 찾는다, 같은 것은 한 번', () => {
    expect(findStudentTags('#26040305 발표를 잘함')).toEqual([{ year: 2026, grade: 4, classNum: 3, num: 5 }]);
    expect(findStudentTags('김지우(#26040305)와 박하늘(#26040312) 다툼')).toHaveLength(2);
    expect(findStudentTags('#26040305 … #26040305')).toHaveLength(1);
  });
  it('여덟 자리가 아니면 태그가 아니다', () => {
    expect(findStudentTags('#2604030 #2604030512 #abc')).toEqual([]);
  });
});

describe('studentIds', () => {
  it('학급 id/sid 읽기·찾기', () => {
    expect(parseStudentKey('2026-4-3/b5')).toEqual({ classId: '2026-4-3', sid: 'b5' });
    expect(parseStudentKey('2026-4-3/')).toBeNull();
    expect(studentOfKey('2026-4-3/b5', classes)?.student.name).toBe('김지호');
    expect(studentOfKey('2026-4-3/zz', classes)).toBeNull();
  });
  it('글의 태그 → 명렬표 학생 (없는 학생은 건너뛴다)', () => {
    expect(studentKeysOfTags('#26040305 #25040302 #26040399', classes)).toEqual(['2026-4-3/b5', '2025-4-3/a2']);
  });
  it('저장할 것 = 고른 학생 + 새로 적은 태그 (원래 있던 태그는 다시 읽지 않는다)', () => {
    expect(studentIdsToSave(['2026-5-1/c3'], '#26040305 #26040301', '#26040301', classes)).toEqual(['2026-5-1/c3', '2026-4-3/b5']);
    expect(studentIdsToSave(['2026-4-3/b5'], '#26040305', '', classes)).toEqual(['2026-4-3/b5']);
  });
});

describe('@이름', () => {
  it('줄 처음·빈칸 뒤의 @찾는말', () => {
    expect(findMention('@김지', 3)).toEqual({ start: 0, query: '김지' });
    expect(findMention('발표 잘함 @ㄱㅈ', 9)).toEqual({ start: 6, query: 'ㄱㅈ' });
    expect(findMention('발표 @', 4)).toEqual({ start: 3, query: '' });
    expect(findMention('줄\n@5', 4)).toEqual({ start: 2, query: '5' });
  });
  it('메일 주소·빈칸 뒤·커서 뒤 글자는 아니다', () => {
    expect(findMention('teacher@school', 14)).toBeNull();
    expect(findMention('@김지 발표', 6)).toBeNull();
    expect(findMention('@김지우', 2)).toEqual({ start: 0, query: '김' });
    expect(findMention('@#26', 4)).toBeNull();
  });
  it('올해 학년도 학급 먼저, 이름 어디든·초성, 전출은 빼고', () => {
    expect(matchMentionStudents(classes, '지', { schoolYear: 2026 }).map((h) => h.key)).toEqual(['2026-4-3/b1', '2026-4-3/b5', '2025-4-3/a1']);
    expect(matchMentionStudents(classes, 'ㄱㅈㅎ', { schoolYear: 2026 }).map((h) => h.student.name)).toEqual(['김지호']);
  });
  it('앞에 둘 학급이 맨 앞, 숫자는 번호', () => {
    expect(matchMentionStudents(classes, '1', { preferClassId: '2025-4-3', schoolYear: 2026 }).map((h) => h.key)).toEqual(['2025-4-3/a1', '2026-4-3/b1']);
  });
  it('비었으면 맨 앞 학급의 학생들, 많으면 자른다', () => {
    expect(matchMentionStudents(classes, '', { schoolYear: 2026 }).map((h) => h.student.num)).toEqual([1, 2, 5]);
    expect(matchMentionStudents(classes, '', { schoolYear: 2026, limit: 2 })).toHaveLength(2);
  });
  it('@찾는말을 이름과 빈칸으로, 커서는 그 뒤', () => {
    expect(applyMention('오늘 @김지 발표', { start: 3, query: '김지' }, '김지우')).toEqual({ text: '오늘 김지우 발표', caret: '오늘 김지우 '.length });
    expect(applyMention('발표 @', { start: 3, query: '' }, '김지호')).toEqual({ text: '발표 김지호 ', caret: '발표 김지호 '.length });
  });
});
