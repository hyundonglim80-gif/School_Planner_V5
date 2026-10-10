// 가져오기가 서버에서 읽는 곳 (DESIGN 8-1). **V4 자리(users/{uid})를 읽는 곳은 V5에서 여기뿐이다**(boundary.test가 지킨다) - 읽기만, 쓰지 않는다.
// 견줄 V5 문서도 서버에서 읽는다(기기 사본이 아직 다 받지 않았어도 맞게 - 지운 것까지). 늘 …FromServer: 연결 없이 캐시의 일부를 믿지 않는다.
import { collection, doc, getDocFromServer, getDocsFromServer, limit, query } from 'firebase/firestore';
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
