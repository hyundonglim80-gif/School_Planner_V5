// 백업 (V4 lib/backupJson·BackupModal의 JSON·CSV, P8-3) - 순수 함수. 읽기·쓰기는 data/backup.
//
// V5 백업 파일 = 공간 하나의 문서들을 컬렉션마다 그대로 (`{ version: 'SP5-BACKUP', colls: { items: { id: 문서 }, … } }`).
// 시각(Timestamp)은 기기 사본과 같은 표시 모양(`{ $ts: [초, 나노초] }` - data/mirror/codec)으로 적는다. 지운 것(휴지통)은 담지 않는다.
// 담을 것은 V4 백업 창의 여섯 갈래 그대로: 일정 · 수업 · 기록(알림장 함께) · 메모 · 학급(명렬표·출석부·자리표·모둠·암기) · 조사표.
// 라벨·설정(common·pc·mobile)은 늘 담는다 - 항목이 라벨을 id로 가리킨다.
// 되살리기 = **없는 것(지운 것 포함)만 넣는다** - 지금 있는 것은 덮지 않는다(백업 뒤에 고친 것을 잃지 않게, PLAN 5장 P8-3).

export const BACKUP_VERSION = 'SP5-BACKUP';

export type BackupKind = 'events' | 'lessons' | 'records' | 'memos' | 'classes' | 'evaluations';

export const BACKUP_KINDS: ReadonlyArray<{ key: BackupKind; name: string; personalOnly?: true }> = [
  { key: 'events', name: '📅 일정' },
  { key: 'lessons', name: '⏰ 수업' },
  { key: 'records', name: '📔 기록 (알림장 함께)' },
  { key: 'memos', name: '📝 메모' },
  { key: 'classes', name: '🧑‍🤝‍🧑 학급 (명렬표·출석부·자리표·모둠·암기)', personalOnly: true },
  { key: 'evaluations', name: '📊 조사표' },
];

/** 백업에 담는 컬렉션 (차례대로) */
export const BACKUP_COLLS = [
  'labels',
  'settings',
  'items',
  'series',
  'timetables',
  'lessonDays',
  'progress',
  'notices',
  'classes',
  'attendance',
  'subjectAttendance',
  'seating',
  'classHub',
  'quiz',
  'evaluations',
] as const;
export type BackupColl = (typeof BACKUP_COLLS)[number];

/** 설정 문서 가운데 담는 것 (가져오기 기록·자동 백업 기록은 그 기기·그때의 것이라 뺀다) */
export const BACKUP_SETTINGS = ['common', 'pc', 'mobile'];

type Doc = Record<string, unknown>;

export interface BackupFile {
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  /** 백업한 공간 (되살릴 때는 지금 공간에 넣는다) */
  sid: string;
  spaceName: string;
  period: { start: string; end: string } | 'all';
  include: BackupKind[];
  colls: Partial<Record<BackupColl, Record<string, Doc>>>;
}

export interface DateRange {
  start: string;
  end: string;
}

const str = (v: unknown) => (typeof v === 'string' ? v : '');
const inRange = (date: string, r: DateRange | null) => !r || (!!date && date >= r.start && date <= r.end);

/** 그 문서가 어느 갈래인가 (null = 늘 담는 라벨·설정) */
export function kindOf(coll: BackupColl, doc: Doc): BackupKind | null {
  switch (coll) {
    case 'labels':
    case 'settings':
      return null;
    case 'items':
      return doc.kind === 'event' ? 'events' : doc.date ? 'records' : 'memos';
    case 'series':
      return 'events';
    case 'timetables':
    case 'lessonDays':
    case 'progress':
      return 'lessons';
    case 'notices':
      return 'records';
    case 'evaluations':
      return 'evaluations';
    default:
      return 'classes';
  }
}

/** 기간에 드나 (날짜가 없는 것 - 메모·시간표·명렬표·라벨 - 은 늘). 기간 일정은 걸치면 */
export function docInRange(coll: BackupColl, id: string, doc: Doc, r: DateRange | null): boolean {
  if (!r) return true;
  if (coll === 'items') {
    const date = str(doc.date);
    if (!date) return true;
    const end = str(doc.endDate) || date;
    return date <= r.end && end >= r.start;
  }
  if (coll === 'lessonDays') return inRange(id, r);
  if (coll === 'notices' || coll === 'attendance' || coll === 'subjectAttendance' || coll === 'evaluations') return inRange(str(doc.date), r);
  return true;
}

/** 담을 문서인가: 지우지 않았고 · 고른 갈래 · 기간 안 (설정은 common·pc·mobile만) */
export function keepInBackup(coll: BackupColl, id: string, doc: Doc, include: ReadonlySet<BackupKind>, r: DateRange | null): boolean {
  if (doc.deletedAt) return false;
  if (coll === 'settings') return BACKUP_SETTINGS.includes(id);
  const kind = kindOf(coll, doc);
  if (kind && !include.has(kind)) return false;
  return docInRange(coll, id, doc, r);
}

/** 갈래마다 몇 개 (안내 - 파일을 고르면 미리보기) */
export function countBackup(colls: BackupFile['colls']): Record<BackupKind, number> {
  const out: Record<BackupKind, number> = { events: 0, lessons: 0, records: 0, memos: 0, classes: 0, evaluations: 0 };
  for (const coll of BACKUP_COLLS) {
    for (const doc of Object.values(colls[coll] ?? {})) {
      const k = kindOf(coll, doc);
      if (k) out[k]++;
    }
  }
  return out;
}

/** 한 줄 안내 ('일정 12 · 메모 3') */
export function describeCounts(c: Record<BackupKind, number>): string {
  const names: Record<BackupKind, string> = { events: '일정', lessons: '수업', records: '기록', memos: '메모', classes: '학급', evaluations: '조사표' };
  return (Object.keys(names) as BackupKind[])
    .filter((k) => c[k] > 0)
    .map((k) => `${names[k]} ${c[k]}`)
    .join(' · ');
}

/** 파일 → 백업 (모양이 틀리면 null) */
export function readBackupFile(raw: unknown): BackupFile | null {
  if (!raw || typeof raw !== 'object') return null;
  const f = raw as Partial<BackupFile>;
  if (f.version !== BACKUP_VERSION || !f.colls || typeof f.colls !== 'object') return null;
  const colls: BackupFile['colls'] = {};
  for (const coll of BACKUP_COLLS) {
    const bag = (f.colls as Record<string, unknown>)[coll];
    if (bag && typeof bag === 'object' && !Array.isArray(bag)) colls[coll] = bag as Record<string, Doc>;
  }
  return {
    version: BACKUP_VERSION,
    exportedAt: str(f.exportedAt),
    sid: str(f.sid),
    spaceName: str(f.spaceName),
    period: f.period && typeof f.period === 'object' ? f.period : 'all',
    include: Array.isArray(f.include) ? (f.include.filter((k) => BACKUP_KINDS.some((x) => x.key === k)) as BackupKind[]) : [],
    colls,
  };
}

/** V4 백업 파일인가 (V5로는 되살리지 않는다 - V4 자료는 '가져오기' 탭에서) */
export const isV4Backup = (raw: unknown) => !!raw && typeof raw === 'object' && (raw as { version?: unknown }).version === 'SP4-UNIFIED-BACKUP';

export interface RestorePlan {
  /** 넣을 문서 (없거나 지운 것) */
  puts: Array<{ coll: BackupColl; id: string; data: Doc }>;
  /** 지금 있어 그대로 둔 수 */
  kept: number;
  /** 갈래마다 넣는 수 */
  added: Record<BackupKind, number>;
}

/**
 * 되살리기 셈: 고른 갈래의 문서 가운데 지금 없거나(영구 지움) 지운 것(휴지통)만 넣는다. 라벨은 늘(항목이 가리킨다), 설정은 없을 때만.
 * current = 지금 공간의 그 컬렉션 문서(서버 - 지운 것 포함).
 */
export function planRestore(file: BackupFile, include: ReadonlySet<BackupKind>, current: Partial<Record<BackupColl, Record<string, Doc>>>): RestorePlan {
  const plan: RestorePlan = { puts: [], kept: 0, added: { events: 0, lessons: 0, records: 0, memos: 0, classes: 0, evaluations: 0 } };
  for (const coll of BACKUP_COLLS) {
    for (const [id, data] of Object.entries(file.colls[coll] ?? {})) {
      const kind = kindOf(coll, data);
      if (kind && !include.has(kind)) continue;
      const cur = current[coll]?.[id];
      if (cur && !cur.deletedAt) {
        plan.kept++;
        continue;
      }
      plan.puts.push({ coll, id, data: { ...data, ...('deletedAt' in data || coll === 'items' || coll === 'labels' ? { deletedAt: null } : {}) } });
      if (kind) plan.added[kind]++;
    }
  }
  return plan;
}

// ── CSV (V4 그대로 - 엑셀에서 여는 한 장: 구분 · 날짜 · 시간/교시/라벨 · 내용 · 비고) ──

export const CSV_HEADER = ['#구분', '날짜/작성일', '시간/교시/라벨', '내용', '비고/상세'];

export interface CsvSource {
  events: Array<{ date: string; labels: string; text: string; done: boolean; time?: string }>;
  lessons: Array<{ date: string; n: number; subject: string; memo: string }>;
  records: Array<{ date: string; labels: string; text: string }>;
  students: Array<{ cls: string; num: number; gender: string; name: string; note: string }>;
  memos: Array<{ created: string; labels: string; text: string; done: boolean }>;
}

export function csvRowsOf(src: CsvSource): string[][] {
  const rows: string[][] = [CSV_HEADER];
  for (const e of src.events) rows.push(['일정', e.date, e.time ? `${e.time} ${e.labels || '일반'}` : e.labels || '일반', e.text, e.done ? '완료' : '']);
  for (const l of src.lessons) rows.push(['수업', l.date, `${l.n}교시`, l.subject, l.memo]);
  for (const r of src.records) rows.push(['기록', r.date, r.labels || '일반', r.text, '']);
  for (const s of src.students) rows.push(['명렬표', s.cls, `${s.num}번 (${s.gender || '미지정'})`, s.name, s.note]);
  for (const m of src.memos) rows.push(['메모', m.created, m.labels || '일반', m.text, m.done ? '완료' : '진행중']);
  return rows;
}
