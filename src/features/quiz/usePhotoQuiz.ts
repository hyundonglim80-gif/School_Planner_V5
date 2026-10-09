// 이름 암기 판의 진행과 성적 (V4 hooks/usePhotoQuiz.ts). 셈은 domain/photoQuiz, 성적은 개인 공간 quiz/{classId}(quizData).
//   성적은 처음 판을 짤 때 사본에서 읽고, 그 뒤로는 이 판이 들고 있다가 O/X를 모았다 1.5초 뒤 한 번에 쓴다(스물다섯 번씩 쓰지 않게 - V4 그대로).
//   판은 시작할 때 한 번만 짜고, 누른 답은 다음 판에 반영한다(답을 누를 때마다 판이 다시 짜이지 않게).
import { useCallback, useEffect, useRef, useState } from 'react';
import { useDocs } from '../../data/select';
import { usePersonalSpaceId } from '../../data/session';
import { classIdOf, isActive, type RosterClass, type RosterStudent } from '../../domain/roster';
import { applyAnswer, buildRound, extendDeck, recordOf, undoAnswer, type QuizRecords } from '../../domain/photoQuiz';
import { saveQuizRecords, useQuizRecords } from './quizData';

/** 쓰기를 모아 두는 시간 (ms) */
const FLUSH_DELAY = 1500;

export interface QuizStudent {
  /** 성적 열쇠 '{classId}/{sid}' */
  key: string;
  classId: string;
  sid: string;
  num: number;
  name: string;
  /** 사진 주소. 없으면 판에 올리지 않는다 */
  url: string;
}

/** 그 학급의 사진 있는 재학생 → 판 후보 */
export function quizStudentsOf(cls: Pick<RosterClass, 'year' | 'grade' | 'num'>, students: readonly RosterStudent[], urlOf: (s: RosterStudent) => string | undefined): QuizStudent[] {
  const classId = classIdOf(cls);
  return students
    .filter((s) => isActive(s) && s.name && s.name !== '000')
    .map((s) => ({ key: `${classId}/${s.sid}`, classId, sid: s.sid, num: s.num, name: s.name, url: urlOf(s) ?? '' }))
    .filter((s) => s.url);
}

interface LastAnswer {
  key: string;
  known: boolean;
  prevStreak: number;
}

/** count = 한 판의 출제 수 (0 = 계속 - 판 끝에서 한 바퀴씩 이어 붙인다) */
export function usePhotoQuiz(classIds: readonly string[], students: readonly QuizStudent[], opts: { count?: number } = {}) {
  const count = Math.max(0, opts.count || 0);
  const sid = usePersonalSpaceId();
  const docs = useDocs('quiz', sid);
  const server = useQuizRecords(classIds);
  // 이 판의 성적 (처음 판을 짤 때 사본에서 - 그 뒤로는 누른 답으로)
  const [records, setRecords] = useState<QuizRecords | null>(null);
  const [deck, setDeck] = useState<QuizStudent[]>([]);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [last, setLast] = useState<LastAnswer | null>(null);
  const [round, setRound] = useState(1);
  const [weighted, setWeighted] = useState(true);
  const [tally, setTally] = useState({ o: 0, x: 0 });

  // ── 서버에 쓰기를 모았다가 한 번에 ──
  const pendingRef = useRef<QuizRecords>({});
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const docsRef = useRef(docs);
  useEffect(() => {
    docsRef.current = docs;
  });
  const flush = useCallback(async () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    const pending = pendingRef.current;
    pendingRef.current = {};
    if (!sid || Object.keys(pending).length === 0) return;
    try {
      await saveQuizRecords(sid, pending, (c) => docsRef.current[c] ?? null);
    } catch (e) {
      // 못 써도 이번 판은 그대로 돌아간다 (다음 답에서 다시 쓴다)
      console.warn('암기 성적을 저장하지 못했습니다.', e);
      pendingRef.current = { ...pending, ...pendingRef.current };
    }
  }, [sid]);
  const remember = useCallback(
    (key: string, rec: QuizRecords[string]) => {
      pendingRef.current = { ...pendingRef.current, [key]: rec };
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => void flush(), FLUSH_DELAY);
    },
    [flush],
  );
  // 칸을 닫거나 탭을 떠날 때 아직 안 쓴 것을 흘려 보낸다
  useEffect(() => () => void flush(), [flush]);

  const candidates = students.filter((s) => s.url && s.name);
  const rosterKey = candidates.map((s) => s.key).join('|');

  /** 판 짜기 (성적 base로) */
  const deal = (base: QuizRecords, keepRound: boolean) => {
    setDeck(buildRound([...candidates], base, { weighted, count }));
    setIndex(0);
    setRevealed(false);
    setLast(null);
    setTally({ o: 0, x: 0 });
    if (!keepRound) setRound((r) => r + 1);
  };

  // 성적을 받고 명단이 갖춰지면 첫 판 (명단·출제 수·가중치가 바뀌면 다시) - 그리는 중에 맞춘다
  const dealKey = `${server.loaded ? 1 : 0}|${rosterKey}|${weighted ? 1 : 0}|${count}`;
  const [seenDeal, setSeenDeal] = useState('');
  if (server.loaded && dealKey !== seenDeal) {
    setSeenDeal(dealKey);
    const base = records ?? server.records;
    if (!records) setRecords(server.records);
    setDeck(buildRound([...candidates], base, { weighted, count }));
    setIndex(0);
    setRevealed(false);
    setLast(null);
    setTally({ o: 0, x: 0 });
    setRound(1);
  }

  const rec = records ?? server.records;
  const current = deck[index] ?? null;
  const total = deck.length;

  const answer = (known: boolean) => {
    if (!current || revealed) return;
    const before = recordOf(rec, current.key);
    const after = applyAnswer(before, known);
    setRecords({ ...rec, [current.key]: after });
    setLast({ key: current.key, known, prevStreak: before.streak });
    setRevealed(true);
    setTally((t) => (known ? { ...t, o: t.o + 1 } : { ...t, x: t.x + 1 }));
    remember(current.key, after);
  };

  const undo = () => {
    if (!last) return;
    const back = undoAnswer(recordOf(rec, last.key), last.known, last.prevStreak);
    setRecords({ ...rec, [last.key]: back });
    setTally((t) => (last.known ? { ...t, o: Math.max(0, t.o - 1) } : { ...t, x: Math.max(0, t.x - 1) }));
    setLast(null);
    setRevealed(false);
    remember(last.key, back);
  };

  /** 답하지 않고 이름만 보인다 (자동 넘김 - 성적에는 넣지 않는다) */
  const reveal = () => {
    if (!current || revealed) return;
    setLast(null);
    setRevealed(true);
  };

  const next = () => {
    setRevealed(false);
    setLast(null);
    // '계속'(출제 수 0): 판 끝에 닿으면 한 바퀴를 더 붙여 이어 간다
    if (count === 0 && index + 1 >= deck.length && deck.length > 0) {
      setDeck((d) => extendDeck(d, [...candidates], rec, { weighted }));
      setRound((r) => r + 1);
    }
    setIndex((i) => i + 1);
  };

  return {
    loaded: server.loaded,
    deck,
    current,
    total,
    index,
    revealed,
    round,
    weighted,
    setWeighted,
    currentRecord: current ? recordOf(rec, current.key) : null,
    answer,
    undo,
    next,
    reveal,
    /** 처음부터 (한 판 더) */
    shuffle: () => deal(rec, false),
    count,
    canUndo: !!last,
    finished: server.loaded && total > 0 && index >= total && count > 0,
    tally,
  };
}
