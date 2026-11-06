import { describe, expect, it } from 'vitest';
import { BACKUP_VERSION, countBackup, csvRowsOf, describeCounts, isV4Backup, keepInBackup, kindOf, otherSpaceQuestion, planRestore, readBackupFile, restorableFile, type BackupFile, type BackupKind } from './backup';

const ALL = new Set<BackupKind>(['events', 'lessons', 'records', 'memos', 'classes', 'evaluations']);
const R = { start: '2026-03-01', end: '2027-02-28' };

describe('백업에 담기', () => {
  it('갈래: 일정·기록(날짜)·메모(날짜 없음), 수업·학급·조사표, 라벨·설정은 늘', () => {
    expect(kindOf('items', { kind: 'event', date: '2026-10-05' })).toBe('events');
    expect(kindOf('items', { kind: 'note', date: '2026-10-05' })).toBe('records');
    expect(kindOf('items', { kind: 'note', date: null })).toBe('memos');
    expect(kindOf('notices', {})).toBe('records');
    expect(kindOf('lessonDays', {})).toBe('lessons');
    expect(kindOf('quiz', {})).toBe('classes');
    expect(kindOf('labels', {})).toBeNull();
  });
  it('지운 것은 빼고, 고른 갈래만, 기간 안(기간 일정은 걸치면) - 메모·명렬표는 기간과 상관없이', () => {
    const only = new Set<BackupKind>(['events', 'memos']);
    expect(keepInBackup('items', 'a', { kind: 'event', date: '2026-10-05' }, only, R)).toBe(true);
    expect(keepInBackup('items', 'a', { kind: 'event', date: '2026-10-05', deletedAt: 1 }, only, R)).toBe(false);
    expect(keepInBackup('items', 'a', { kind: 'note', date: '2026-10-05' }, only, R)).toBe(false);
    expect(keepInBackup('items', 'a', { kind: 'event', date: '2026-02-27', endDate: '2026-03-02' }, only, R)).toBe(true);
    expect(keepInBackup('items', 'a', { kind: 'event', date: '2025-10-05' }, only, R)).toBe(false);
    expect(keepInBackup('items', 'm', { kind: 'note', date: null }, only, R)).toBe(true);
    expect(keepInBackup('lessonDays', '2025-10-05', {}, ALL, R)).toBe(false);
    expect(keepInBackup('classes', '2025-5-2', {}, ALL, R)).toBe(true);
    expect(keepInBackup('settings', 'common', {}, only, R)).toBe(true);
    expect(keepInBackup('settings', 'import', {}, only, R)).toBe(false);
    expect(keepInBackup('labels', 'L', {}, new Set(), R)).toBe(true);
    // 날짜 링크 여럿인 메모는 하나라도 기간 안이면 (P10-3)
    expect(keepInBackup('items', 'n', { kind: 'note', date: '2025-10-05', dates: ['2025-10-05', '2026-10-05'] }, ALL, R)).toBe(true);
    expect(keepInBackup('items', 'n', { kind: 'note', date: '2025-10-05', dates: ['2025-10-05', '2025-11-05'] }, ALL, R)).toBe(false);
  });
});

const file = (colls: BackupFile['colls']): BackupFile => ({ version: BACKUP_VERSION, exportedAt: 'x', sid: 'u_a', spaceName: '개인', period: 'all', include: [...ALL], colls });

describe('되살리기', () => {
  const f = file({
    labels: { L1: { kind: 'event', name: '회의', deletedAt: null } },
    items: {
      e1: { kind: 'event', date: '2026-10-05', text: '있음', deletedAt: null },
      e2: { kind: 'event', date: '2026-10-06', text: '지움', deletedAt: null },
      e3: { kind: 'event', date: '2026-10-07', text: '없음', deletedAt: null },
      m1: { kind: 'note', date: null, text: '메모', deletedAt: null },
    },
    settings: { common: { forwardDays: 7 } },
    attendance: { a1: { classId: 'c', date: '2026-10-05', records: {} } },
  });
  it('파일 읽기: 버전이 다르면 null, V4 백업은 알아본다', () => {
    expect(readBackupFile(JSON.parse(JSON.stringify(f)))?.colls.items?.e1).toBeTruthy();
    expect(readBackupFile({ version: 'x' })).toBeNull();
    expect(isV4Backup({ version: 'SP4-UNIFIED-BACKUP' })).toBe(true);
    expect(describeCounts(countBackup(f.colls))).toBe('일정 3 · 날짜 없는 메모 1 · 학급 1');
  });
  it('없는 것·지운 것만 넣고 지금 있는 것은 둔다, 고른 갈래만 (설정은 없을 때만)', () => {
    const plan = planRestore(f, new Set(['events']), {
      items: { e1: { kind: 'event', deletedAt: null }, e2: { kind: 'event', deletedAt: { seconds: 1 } } },
      settings: { common: {} },
      labels: {},
    });
    expect(plan.puts.map((p) => `${p.coll}/${p.id}`)).toEqual(['labels/L1', 'items/e2', 'items/e3']);
    expect(plan.kept).toBe(2);
    expect(plan.added.events).toBe(2);
    expect(plan.puts.find((p) => p.id === 'e2')?.data.deletedAt).toBeNull();
  });
});

describe('다른 공간 파일 되살리기 (P22-4)', () => {
  const fileOf = (sid: string, spaceName: string, colls: Record<string, unknown> = {}) => readBackupFile({ version: BACKUP_VERSION, exportedAt: '2026-11-06T00:00:00Z', sid, spaceName, colls })!;
  const mine = { name: '내백업.json', file: fileOf('u_me', '개인') };

  it('지금 공간 파일이면 묻지 않는다', () => {
    expect(otherSpaceQuestion([mine], 'u_me', '개인 공간')).toBeNull();
  });

  it('다른 공간이면 파일 이름·백업한 공간·지금 공간을 적어 묻는다', () => {
    const q = otherSpaceQuestion([mine], 'g_x', '3학년 모임');
    expect(q).toContain('내백업.json');
    expect(q).toContain('개인 공간');
    expect(q).toContain('3학년 모임');
  });

  it('그룹 공간에 넣을 때는 구성원에게 보인다고 알린다, 개인 공간이면 그 말이 없다', () => {
    expect(otherSpaceQuestion([mine], 'g_x', '3학년 모임')).toContain('구성원');
    expect(otherSpaceQuestion([{ name: 'a.json', file: fileOf('g_x', '3학년 모임') }], 'u_me', '개인 공간')).not.toContain('구성원');
  });

  it('여러 파일이면 다른 공간 것만 적는다', () => {
    const q = otherSpaceQuestion([mine, { name: '남.json', file: fileOf('u_other', '개인') }], 'u_me', '개인 공간');
    expect(q).toContain('남.json');
    expect(q).not.toContain('내백업.json');
  });

  it('공간을 모르는 옛 파일도 묻는다', () => {
    expect(otherSpaceQuestion([{ name: 'a.json', file: fileOf('', '') }], 'u_me', '개인 공간')).toContain('a.json');
  });

  it('둘 수 있는 컬렉션만 남기고 빠진 수를 안다 - 그룹에 학급·출결·설정이 들어가지 않는다', () => {
    const file = fileOf('u_me', '개인', { items: { a: { kind: 'note', date: null } }, classes: { '2026-5-2': {} }, attendance: { x: {}, y: {} }, settings: { common: {} } });
    const { file: narrowed, left } = restorableFile(file, ['items', 'labels']);
    expect(left).toBe(4);
    const plan = planRestore(narrowed, ALL, {});
    expect(plan.puts.map((p) => p.coll)).toEqual(['items']);
    expect(file.colls.classes).toBeDefined();
  });
});

describe('CSV', () => {
  it('V4 모양 한 장 (구분·날짜·시간/교시/라벨·내용·비고)', () => {
    const rows = csvRowsOf({
      events: [{ date: '2026-10-05', labels: '회의', text: '협의회', done: true, time: '09:30' }],
      lessons: [{ date: '2026-10-05', n: 1, subject: '국어', memo: '받아쓰기' }],
      records: [{ date: '2026-10-05', labels: '', text: '모둠 활동' }],
      students: [{ cls: '2026학년도 5학년 2반', num: 1, gender: '여', name: '김하나', note: '' }],
      memos: [{ created: '2026-10-01', labels: '학교', text: '준비물', done: false }],
    });
    expect(rows.slice(1)).toEqual([
      ['일정', '2026-10-05', '09:30 회의', '협의회', '완료'],
      ['수업', '2026-10-05', '1교시', '국어', '받아쓰기'],
      ['기록', '2026-10-05', '일반', '모둠 활동', ''],
      ['명렬표', '2026학년도 5학년 2반', '1번 (여)', '김하나', ''],
      ['메모', '2026-10-01', '학교', '준비물', '진행중'],
    ]);
  });
});
