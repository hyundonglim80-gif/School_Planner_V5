// 자료 모양 (DESIGN 4장 그대로). 이 파일과 DESIGN 4장이 다르면 같은 커밋에서 둘 다 고친다.
//
// 칸은 셋으로 나뉜다.
//   - 저장 도우미(data/repo)가 붙이는 칸: updatedAt·v (모두), createdAt·authorId·deletedAt·deletedBy (만들기·지우기)
//   - 기능이 쓰는 칸: 아래 각 모양
//   - 계산하는 것(이월·수업 칸·기간 일정의 '(2/5)' …)은 칸이 없다 - DESIGN 5장
// 기능 코드는 저장 도우미가 붙이는 칸을 직접 쓰지 않는다(`Editable<C>`가 그 칸을 뺀다).
import type { Timestamp } from 'firebase/firestore';

/** 서버 시각. 기기 사본(P2-2)이 이것으로 바뀐 것만 받는다 */
export type ServerTime = Timestamp;
/** 'YYYY-MM-DD' (이 기기 시각의 날짜 - V4 toISOString은 한국 새벽에 하루 앞날이 됐다) */
export type YMD = string;
/** 'HH:mm' */
export type HM = string;

/** 모든 문서에 저장 도우미가 붙인다 */
export interface Stamped {
  updatedAt: ServerTime;
  /** 자료 판 - 나중에 모양을 바꿀 때 판으로 가린다 */
  v: 1;
}

/** 만들기(create)로 생기는 문서에 더 붙는다. 지우기 = 지운 표시(원칙 5) */
export interface Tracked extends Stamped {
  createdAt: number;
  authorId: string;
  /** 지운 표시. 만들 때 null을 꼭 넣는다 - 없는 칸은 쿼리로 거를 수 없다 */
  deletedAt: ServerTime | null;
  deletedBy?: string;
}

// ───────────────────────── 4-1. 공간 ─────────────────────────

export type SpaceRole = 'owner' | 'member';

/** spaces/{sid} - 개인 `u_{uid}`, 그룹 `g_{id}` (data/space.ts가 만든다) */
export interface Space {
  kind: 'personal' | 'group';
  name: string;
  ownerId: string;
  members: Record<string, SpaceRole>;
  /** 있으면 초대가 열린 것 */
  inviteCode?: string;
  createdAt: ServerTime;
  updatedAt: ServerTime;
  v: 1;
}

// ───────────────────────── 4-2. 항목 (일정·메모·기록) ─────────────────────────

export type ItemKind = 'event' | 'note';

/** 이 항목만의 속성 값. 없으면 라벨 속성을 따른다 */
export interface ItemProps {
  forward?: boolean;
  calendar?: boolean;
  skip?: boolean;
  gcal?: boolean;
}

/** 붙인 표 - V4 lib/entryTable 모양 그대로 (P4-2가 domain으로 옮기며 칸 서식 타입을 채운다) */
export interface EntryTable {
  id: string;
  rows: { h?: number; cells: { v: string; cs?: number; rs?: number; x?: 1; s?: number }[] }[];
  cols?: number[];
  styles?: Record<string, unknown>[];
  createdAt: number;
}

/** 드라이브 파일 (V4 모양) */
export interface Attachment {
  id?: string;
  name: string;
  url: string;
  type: string;
  size?: number;
  driveId?: string;
}

/** 가져온 문서의 V4 자리 (DESIGN 8장) */
export interface ImportSource {
  from: 'v4';
  /** V4 문서 자리 (공간 밑 - 'settings/labels', 'events/2026-03-02') */
  path: string;
  /** 그 안의 V4 id (id가 없던 것은 import/v4 nthKey) */
  id: string;
  /** 가져올 때 적은 칸의 지문 - 다시 가져올 때 그 뒤 V5에서 고쳤는지 본다(import/v4/plan) */
  h?: string;
}

export interface Item extends Tracked {
  kind: ItemKind;
  /** 일정은 늘 있다. 메모·기록은 날짜가 있으면 그날 기록, null이면 메모 */
  date: YMD | null;
  /** 기간 일정의 끝 날 (일정만) */
  endDate?: YMD;
  /** 기간 일정: 주말·공휴일은 빼고 센다 (V4 '주말과 공휴일 제외' - domain/period) */
  workdays?: boolean;
  /** 기간 일정: '이 날만 지우기'로 뺀 날 */
  skipDates?: YMD[];
  /** 본문. 읽기·저장 길에서 바꾸지 않는다 */
  text: string;
  labelIds: string[];
  done?: boolean;
  doneAt?: number;
  /** 기간 일정의 날마다 완료 */
  doneDates?: YMD[];
  favorite?: boolean;
  /** 같은 날·같은 목록 안 차례 (domain/order - 분수 인덱스) */
  order: string;
  /** 알림 시각 (그 항목의 date 기준) */
  time?: HM;
  alarmDone?: boolean;
  due?: YMD;
  props?: ItemProps;
  /** 이월로 따라오는 중 (처음 따라올 때 한 번 쓴다) */
  carrying?: boolean;
  /** 이월을 끝낼 때 그날로 옮겨 적으며 남기는 처음 날 */
  carriedFrom?: YMD;
  seriesId?: string;
  seriesIndex?: number;
  /** 기록에서 메모로 뺄 때 그 날 ('📅 10/6에서') */
  fromDate?: YMD;
  /** 구글 Keep에서 가져온 메모의 열쇠 (V4 lib/keepImport - 다시 가져올 때 겹치지 않게) */
  keepId?: string;
  tables?: EntryTable[];
  /** 학생 태그 '{classId}/{sid}' */
  studentIds?: string[];
  attachments?: Attachment[];
  /** 이은 항목 id. 수업은 'lesson:{date}:{교시}' */
  linkIds?: string[];
  src?: ImportSource;
}

// ───────────────────────── 4-3. 라벨 ─────────────────────────

/** 일정 라벨만. 화면 이름은 달력·이월·수업X·구글 캘린더 */
export interface LabelProps {
  calendar?: boolean;
  forward?: boolean;
  skip?: boolean;
  gcal?: boolean;
  /** 새 일정 칸을 열 때 끝 날 줄을 펴 둔다 */
  period?: boolean;
  /** 새 일정 칸을 열 때 반복 줄을 펴 둔다 */
  recur?: boolean;
}

export interface Label extends Tracked {
  kind: ItemKind;
  name: string;
  color: string;
  /** 메모·기록 라벨만 (2단계) */
  parentId: string | null;
  order: string;
  props?: LabelProps;
  /** V4에서 가져온 라벨 */
  src?: ImportSource;
}

// ───────────────────────── 4-4. 반복 ─────────────────────────

/** 반복 규칙 (domain/recur - 매일·매주·격주(interval 2)·매월 n째 주 요일·매월 n일 여럿) */
export interface SeriesRule {
  freq: 'daily' | 'weekly' | 'monthly';
  interval: number;
  /** 0(일) ~ 6(토) */
  weekdays?: number[];
  /** 매월 n째 주 (1~5) */
  monthWeek?: number;
  /** 매월 n일 (여럿 - V4 '매월(특정 일)') */
  monthDays?: number[];
}

export interface Series extends Tracked {
  /** V4에서 가져온 반복은 규칙을 모른다(imported) */
  rule?: SeriesRule;
  start: YMD;
  until?: YMD;
  count?: number;
  template: { text: string; labelIds: string[]; time?: HM; props?: ItemProps };
  imported?: true;
  /** V4에서 가져온 반복 묶음 (V4 groupId) */
  src?: ImportSource;
}

// ───────────────────────── 4-5. 수업 ─────────────────────────

/** 요일 '1'~'5' → 교시 → '국어' | '5-2 과학' */
export type TimetableGrid = Record<string, Record<string, string>>;

/** 기간별 시간표. 기간이 겹치면 늦게 시작한 것이 이긴다 */
export interface Timetable extends Tracked {
  name: string;
  from: YMD;
  to: YMD;
  grid: TimetableGrid;
}

export interface LessonPeriod {
  /** 있으면 그 과목, ''이면 그 교시 수업 없음 */
  subject?: string;
  memo?: string;
  supplies?: string;
  attachments?: Attachment[];
  linkIds?: string[];
}

/** lessonDays/{date} - 그날 바꾼 칸만. 칸이 없으면 시간표를 따른다 */
export interface LessonDay extends Stamped {
  periods: Record<string, LessonPeriod>;
}

// ───────────────────────── 4-6. 학급 (개인 공간) ─────────────────────────

export interface Student {
  /** 학생 id - 번호가 바뀌어도 기록이 따라간다 */
  sid: string;
  num: number;
  name: string;
  gender?: string;
  status: 'active' | 'out';
  outDate?: YMD;
}

/** classes/{classId} - classId = '{학년도}-{학년}-{반}' */
export interface ClassDoc extends Stamped {
  year: number;
  grade: number;
  num: number;
  name?: string;
  students: Student[];
}

export interface AttendanceRecord {
  kind: string;
  reason: string;
  periods?: string[];
  note?: string;
}

/** attendance/{classId}_{date} - 바뀐 학생 칸만 */
export interface Attendance extends Stamped {
  classId: string;
  date: YMD;
  records: Record<string, AttendanceRecord>;
}

/** subjectAttendance/{classId}_{date} */
export interface SubjectAttendance extends Stamped {
  classId: string;
  date: YMD;
  periods: Record<string, Record<string, { kind: string; reason: string; note?: string }>>;
}

/** seating·classHub·quiz - V4 모양(학생은 sid). 그 기능을 옮기는 세션(P7-3·P7-5)이 칸을 채운다 */
export interface Seating extends Stamped {
  [field: string]: unknown;
}
export interface ClassHub extends Stamped {
  apart?: string[];
  draw?: { picked: string[]; round: number };
  groupSets?: Record<string, unknown>;
}
export interface Quiz extends Stamped {
  [field: string]: unknown;
}

// ───────────────────────── 4-7. 조사표·알림장·진도 ─────────────────────────

/** 조사표 한 장 = 문서 하나 */
export interface Evaluation extends Tracked {
  date: YMD;
  period?: string;
  classId?: string;
  title: string;
  type: string;
  columns?: unknown[];
  values: Record<string, unknown>;
  groups?: unknown;
  subject?: string;
  courseId?: string;
}

/** notices/{date} */
export interface Notice extends Stamped {
  date: YMD;
  lines: string[];
}

/** progress/{planId} - V4 v4_progress 모양 그대로 (P6-2가 칸을 채운다) */
export interface Progress extends Tracked {
  key: string;
  subject?: string;
  classes?: string[];
  startDate: YMD;
  lessons: unknown[];
  bumps: unknown[];
}

// ───────────────────────── 4-8·4-9. 설정·그 밖 ─────────────────────────

/** settings/{common|pc|mobile} - 기본값과 다른 칸만 (칸 표는 domain/settings.ts) */
export interface SettingsDoc extends Stamped {
  [field: string]: unknown;
}

export interface PushToken extends Stamped {
  [field: string]: unknown;
}

/** gcalQueue/{itemId} - 항목 큐 */
export interface GcalQueue extends Stamped {
  at: number;
  fails: number;
}

// ───────────────────────── 컬렉션 표 ─────────────────────────

/** 공간 아래 컬렉션 → 문서 모양. 저장 도우미가 이 표로 칸을 맞춘다 */
export interface SpaceCollections {
  items: Item;
  labels: Label;
  series: Series;
  lessonDays: LessonDay;
  timetables: Timetable;
  evaluations: Evaluation;
  notices: Notice;
  classes: ClassDoc;
  attendance: Attendance;
  subjectAttendance: SubjectAttendance;
  seating: Seating;
  classHub: ClassHub;
  quiz: Quiz;
  progress: Progress;
  settings: SettingsDoc;
  pushTokens: PushToken;
  gcalQueue: GcalQueue;
}

export type SpaceCollection = keyof SpaceCollections;
export type DocOf<C extends SpaceCollection> = SpaceCollections[C];

/** 저장 도우미가 붙이는 칸 */
export type ManagedField = keyof Tracked;

/** 기능이 쓰는 칸만 (저장 도우미가 붙이는 칸을 뺀다) */
export type Editable<C extends SpaceCollection> = Omit<DocOf<C>, ManagedField>;

/** 화면이 보는 문서 = 문서 칸 + 자리(id). 기기 사본에서 고른다(data/select) - id는 칸이 아니라 저장 도우미가 적지 않는다 */
export type Stored<C extends SpaceCollection> = DocOf<C> & { id: string };

/** 문서 자리: spaces/{sid}/{coll}/{id} */
export interface DocPath<C extends SpaceCollection = SpaceCollection> {
  sid: string;
  coll: C;
  id: string;
}
