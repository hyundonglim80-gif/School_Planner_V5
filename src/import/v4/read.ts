// 가져오기가 서버에서 읽는 곳 (DESIGN 8-1). **V4 자리(users/{uid}·groups/{gid})를 읽는 곳은 V5에서 여기뿐이다**(boundary.test가 지킨다) - 읽기만, 쓰지 않는다.
// 견줄 V5 문서도 서버에서 읽는다(기기 사본이 아직 다 받지 않았어도 맞게 - 지운 것까지). 늘 …FromServer: 연결 없이 캐시의 일부를 믿지 않는다.
import { collection, doc, getDocFromServer, getDocsFromServer, limit, query, where } from 'firebase/firestore';
import { db } from '../../data/firebase';
import type { SpaceCollection, Stored } from '../../data/types';
import type { V4ClassDocs } from './classes';
import type { V4ItemDocs } from './items';
import type { V4LabelDocs } from './labels';
import type { V4LessonDocs } from './lessons';
import type { V4PrefDocs } from './settings';

const v4Settings = (uid: string, id: string) => doc(db, 'users', uid, 'settings', id);

async function readV4Doc(uid: string, id: string): Promise<unknown> {
  const snap = await getDocFromServer(v4Settings(uid, id));
  return snap.exists() ? snap.data() : undefined;
}

/** 라벨·설정 가져오기에 쓰는 V4 설정 문서들 */
export async function readV4SettingsDocs(uid: string): Promise<{ labels: V4LabelDocs; prefs: V4PrefDocs }> {
  // preferences = V3·V4가 함께 쓰는 문서(D-Day), holidays = V3 개인 공휴일 표 (P5-3), v4_trash = 휴지통 자동 비우기 (P5-4)
  // v4_teaching·v4_classBell·v4_school·timetable_v5·v4_periodTimes = 수업 설정 (P6-4)
  const ids = [
    'labels', 'v4_labelTree', 'v4_gcal', 'v4_preferences_pc', 'v4_preferences_mobile', 'v4_preferences', 'preferences', 'holidays', 'v4_trash',
    'v4_teaching', 'v4_classBell', 'v4_school', 'timetable_v5', 'v4_periodTimes', 'v4_observationPhrases', 'v4_autoBackup',
  ] as const;
  const [labels, labelTree, gcal, pc, mobile, legacy, shared, holidays, trash, teaching, classBell, school, timetable, periodTimes, phrases, autoBackup] = await Promise.all(
    ids.map((id) => readV4Doc(uid, id)),
  );
  return {
    labels: { labels, labelTree, gcal },
    prefs: { pc, mobile, legacy, shared, holidays, trash, teaching, classBell, school, timetable, periodTimes, phrases, autoBackup },
  };
}

/** 라벨 문서만 (그룹 가져오기 - 그룹 일정의 라벨은 가져오는 사람의 V4 라벨 목록으로 푼다) */
export async function readV4LabelDocs(uid: string): Promise<V4LabelDocs> {
  const [labels, labelTree, gcal] = await Promise.all(['labels', 'v4_labelTree', 'v4_gcal'].map((id) => readV4Doc(uid, id)));
  return { labels, labelTree, gcal };
}

/** 수업 가져오기에 쓰는 V4 문서들 (P6-4 - 시간표 문서는 설정과 함께 읽은 것을 넘긴다) */
export async function readV4LessonDocs(uid: string, timetable: unknown): Promise<V4LessonDocs> {
  const all = async (coll: string) => {
    const snap = await getDocsFromServer(collection(db, 'users', uid, coll));
    return Object.fromEntries(snap.docs.map((d) => [d.id, d.data()]));
  };
  const [schedules, progress] = await Promise.all([all('schedules'), all('v4_progress')]);
  return { timetable, schedules, progress };
}

/** 일정·기록·메모 가져오기에 쓰는 V4 문서들 (개인 공간 - 그룹은 P8-4) */
export async function readV4ItemDocs(uid: string): Promise<V4ItemDocs> {
  const all = async (coll: string) => {
    const snap = await getDocsFromServer(collection(db, 'users', uid, coll));
    return Object.fromEntries(snap.docs.map((d) => [d.id, d.data()]));
  };
  const [events, journals, tasks, dues] = await Promise.all([all('events'), all('journals'), all('tasks'), readV4Doc(uid, 'v4_eventDue')]);
  return { events, journals, tasks, dues };
}

/** 학급 가져오기에 쓰는 V4 문서들 (P7-5 - 개인 공간, 그룹의 알림장·조사표는 P8-4) */
export async function readV4ClassDocs(uid: string): Promise<V4ClassDocs> {
  const all = async (coll: string) => {
    const snap = await getDocsFromServer(collection(db, 'users', uid, coll));
    return Object.fromEntries(snap.docs.map((d) => [d.id, d.data()]));
  };
  // roster = V3 옛 한 학급 문서 (rosters가 없을 때만 V4가 읽었다)
  const [rosters, legacyRoster, attendance, subjectAttendance, notices, evaluations, seating, classHub, photoQuiz] = await Promise.all([
    readV4Doc(uid, 'rosters'),
    readV4Doc(uid, 'roster'),
    all('attendance'),
    all('v4_subjectAttendance'),
    all('notices'),
    all('evaluations'),
    all('v4_seating'),
    all('v4_classHub'),
    readV4Doc(uid, 'photoQuiz'),
  ]);
  return { rosters, legacyRoster, attendance, subjectAttendance, notices, evaluations, seating, classHub, photoQuiz };
}

/** 내가 든 V4 공유 그룹 하나 (groups/{gid} - members는 uid 배열) */
export interface V4Group {
  id: string;
  name: string;
  ownerId: string;
  ownerName: string;
  members: string[];
  /** uid → 이름 (V4가 참여할 때 남긴 memberDetails) */
  memberNames: Record<string, string>;
  inviteCode?: string;
}

const text = (v: unknown) => (typeof v === 'string' ? v : '');

/** 내가 든 V4 그룹 (V4 규칙이 허락하는 길 - where members array-contains 나) */
export async function readV4Groups(uid: string): Promise<V4Group[]> {
  const snap = await getDocsFromServer(query(collection(db, 'groups'), where('members', 'array-contains', uid)));
  return snap.docs
    .map((d) => {
      const g = d.data();
      const details = g.memberDetails && typeof g.memberDetails === 'object' ? (g.memberDetails as Record<string, unknown>) : {};
      const memberNames: Record<string, string> = {};
      for (const [id, v] of Object.entries(details)) if (v && typeof v === 'object' && text((v as Record<string, unknown>).name)) memberNames[id] = text((v as Record<string, unknown>).name);
      return {
        id: d.id,
        name: text(g.name).trim() || '공유 그룹',
        ownerId: text(g.ownerId),
        ownerName: text(g.ownerName),
        members: Array.isArray(g.members) ? [...new Set(g.members.filter((m): m is string => typeof m === 'string' && !!m))] : [],
        memberNames,
        ...(text(g.inviteCode) ? { inviteCode: text(g.inviteCode) } : {}),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
}

/** V4 그룹 자료 (groups/{gid} 밑 - 일정·기록·메모·이월 기한, 수업 칸, 알림장, 조사표) */
export async function readV4GroupDocs(gid: string): Promise<{ items: V4ItemDocs; schedules: Record<string, unknown>; notices: Record<string, unknown>; evaluations: Record<string, unknown> }> {
  const all = async (coll: string) => {
    const snap = await getDocsFromServer(collection(db, 'groups', gid, coll));
    return Object.fromEntries(snap.docs.map((d) => [d.id, d.data()]));
  };
  const dueSnap = getDocFromServer(doc(db, 'groups', gid, 'settings', 'v4_eventDue')).then((s) => (s.exists() ? s.data() : undefined));
  const [events, journals, tasks, dues, schedules, notices, evaluations] = await Promise.all([
    all('events'), all('journals'), all('tasks'), dueSnap, all('schedules'), all('notices'), all('evaluations'),
  ]);
  return { items: { events, journals, tasks, dues }, schedules, notices, evaluations };
}

/** V4로 쓴 자료가 있나 (처음 로그인 띠) - 라벨·설정 문서, 일정·기록·메모 중 하나라도 */
export async function hasV4Data(uid: string): Promise<boolean> {
  const docs = await Promise.all(['labels', 'v4_preferences_pc', 'v4_preferences_mobile'].map((id) => readV4Doc(uid, id)));
  if (docs.some((d) => d !== undefined)) return true;
  for (const coll of ['events', 'journals', 'tasks']) {
    const snap = await getDocsFromServer(query(collection(db, 'users', uid, coll), limit(1)));
    if (!snap.empty) return true;
  }
  return false;
}

/** 그 공간의 V5 문서 전부 (지운 것 포함) */
export async function readSpaceDocs<C extends SpaceCollection>(sid: string, coll: C): Promise<Record<string, Stored<C>>> {
  const snap = await getDocsFromServer(collection(db, 'spaces', sid, coll));
  const out: Record<string, Stored<C>> = {};
  for (const d of snap.docs) out[d.id] = { ...(d.data() as Stored<C>), id: d.id };
  return out;
}

/** 그 공간의 V5 문서 하나 (없으면 null) */
export async function readSpaceDoc(sid: string, coll: SpaceCollection, id: string): Promise<Record<string, unknown> | null> {
  const snap = await getDocFromServer(doc(db, 'spaces', sid, coll, id));
  return snap.exists() ? (snap.data() as Record<string, unknown>) : null;
}
