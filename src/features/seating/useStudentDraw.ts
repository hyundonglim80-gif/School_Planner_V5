// 발표자 뽑기 (V4 hooks/useStudentDraw.ts) - 셈은 domain/draw, 저장은 학급 허브의 draw(seatingData.saveDraw).
//   뽑기를 누르면 곧바로 저장하고(창을 닫아도 판에 남게), 화면에서는 이름을 잠깐 굴리다 멈춘다.
//   이번 판은 학급 허브(사본)가 들고 있다 - 다른 기기에서 뽑은 것도 곧 보이고, 이어 뽑는다.
import { useEffect, useMemo, useRef, useState } from 'react';
import { showErrorToast, showToast } from '../../app/toast';
import type { Stored } from '../../data/types';
import { recordUndo } from '../../data/undo';
import { afterPick, drawStatus, pickNext, rollSequence, type DrawState } from '../../domain/draw';
import { saveDraw } from './seatingData';

/** 굴리는 이름 수 (마지막이 뽑힌 학생) */
const ROLL_STEPS = 14;

/** 굴릴 때 이름마다 머무는 시간 - 점점 느려지다 멈춘다 (모두 더해 1초 남짓) */
const rollDelay = (i: number, steps: number) => 40 + Math.round(160 * (i / Math.max(1, steps - 1)) ** 2);

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

interface Options {
  sid: string | null;
  classId: string | null;
  stored: Stored<'classHub'> | undefined;
  /** 재학생 sid (번호 차례) */
  activeNums: string[];
  /** 오늘 결석한 sid */
  absentNums: string[];
  /** 학급 허브의 이번 판 */
  draw: DrawState;
  /** '15번 홍길동' */
  nameOf: (sid: string) => string;
}

export function useStudentDraw({ sid, classId, stored, activeNums, absentNums, draw, nameOf }: Options) {
  /** 지금 보이는 학생 (굴리는 중이면 지나가는 학생, 멈추면 뽑힌 학생) */
  const [shown, setShown] = useState<string | null>(null);
  const [rolling, setRolling] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  // 학급을 바꾸면 보이던 학생을 걷는다 (그리는 중에 맞춘다)
  const [seenClass, setSeenClass] = useState(classId);
  if (seenClass !== classId) {
    setSeenClass(classId);
    setShown(null);
    setRolling(false);
  }
  useEffect(() => stopTimer, [classId]);

  const status = useMemo(() => drawStatus(activeNums, absentNums, draw), [activeNums, absentNums, draw]);

  const roll = (seq: string[]) => {
    stopTimer();
    if (seq.length <= 1) {
      setShown(seq[0] ?? null);
      setRolling(false);
      return;
    }
    setRolling(true);
    let i = 0;
    const step = () => {
      setShown(seq[i]);
      if (i === seq.length - 1) {
        timer.current = null;
        setRolling(false);
        return;
      }
      timer.current = setTimeout(step, rollDelay(i, seq.length));
      i++;
    };
    step();
  };

  const pick = () => {
    if (rolling || !sid || !classId) return;
    const p = pickNext(activeNums, absentNums, draw);
    if (!p) {
      showToast(activeNums.length ? '오늘 뽑을 학생이 없습니다. 재학생이 모두 결석입니다.' : '명렬표에 재학생이 없습니다.');
      return;
    }
    // 판에 먼저 남긴다 - 굴리는 동안 창을 닫아도 뽑힌 학생은 판에 들어간다
    saveDraw(sid, classId, stored, afterPick(draw, p)).catch((e) => showErrorToast('뽑은 학생을 저장하지 못했습니다. 다른 기기에서 이어 뽑을 때 다시 나올 수 있습니다.', e));
    if (p.newRound) showToast(`🎉 ${draw.round}번째 판을 다 뽑아 새 판을 엽니다.`);
    const candidates = p.newRound ? status.pool : status.remaining;
    roll(prefersReducedMotion() ? [p.num] : rollSequence(candidates, p.num, ROLL_STEPS));
  };

  /** 방금 뽑은 학생을 판에 되돌린다 (다시 뽑힐 수 있다) */
  const undo = async () => {
    if (rolling || !sid || !classId || shown === null || !draw.picked.includes(shown)) return;
    const who = shown;
    try {
      await saveDraw(sid, classId, stored, { ...draw, picked: draw.picked.filter((n) => n !== who) });
      setShown(null);
      showToast(`↩️ ${nameOf(who)}을(를) 안 뽑힌 학생으로 되돌렸습니다.`);
    } catch {
      // 안내는 저장 도우미가 했다
    }
  };

  /** 이번 판을 접고 새 판 (안내의 되돌리기로 앞 판으로) */
  const newRound = async () => {
    if (rolling || !sid || !classId) return;
    try {
      const back = await saveDraw(sid, classId, stored, { picked: [], round: draw.round + 1 });
      setShown(null);
      recordUndo(sid, '🔄 새 판을 열었습니다. 모두 다시 뽑힐 수 있습니다.', back, { what: '뽑기 새 판' });
    } catch {
      // 안내는 저장 도우미가 했다
    }
  };

  return { shown, rolling, status, pick, undo, newRound };
}
