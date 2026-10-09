// 발표자 뽑기 (V4 lib/draw.ts) - 순수 셈. 저장은 features/seating(학급 허브 classHub/{classId}.draw).
//
//   - 한 판 = 재학생 모두를 한 번씩. 이번 판에 안 뽑힌 학생 중에서 뽑는다.
//   - 오늘 결석한 학생은 뽑지 않는다(판에는 안 뽑힌 채 남는다).
//   - 나올 수 있는(결석 아닌) 학생이 모두 뽑혔으면 새 판을 열고 그 첫 학생을 뽑는다.
//   - 학생은 sid로 가리킨다(V4는 번호). 재학생 목록은 번호 차례로 받는다. 뽑힌 차례대로 picked에 쌓인다.

/** 학급 허브에 저장하는 이번 판 */
export interface DrawState {
  /** 이번 판에 뽑힌 학생 sid (뽑힌 차례) */
  picked: string[];
  /** 몇 번째 판 (1부터) */
  round: number;
}

export const EMPTY_DRAW: DrawState = { picked: [], round: 1 };

export function sanitizeDraw(raw: unknown): DrawState {
  const r = (raw ?? {}) as { picked?: unknown; round?: unknown };
  const picked: string[] = [];
  if (Array.isArray(r.picked)) {
    for (const v of r.picked) {
      if (typeof v === 'string' && v && !picked.includes(v)) picked.push(v);
    }
  }
  const round = Number(r.round);
  return { picked, round: Number.isInteger(round) && round >= 1 ? round : 1 };
}

export interface DrawStatus {
  /** 오늘 나올 수 있는 학생 (재학 - 결석) */
  pool: string[];
  /** 그중 이번 판에 아직 안 뽑힌 학생 */
  remaining: string[];
  /** 오늘 결석이라 빼는 재학생 */
  absent: string[];
  /** 재학생 중 이번 판에 뽑힌 수 */
  done: number;
  /** 재학생 수 */
  total: number;
}

/**
 * 이번 판의 형편.
 * @param activeNums 재학생 sid (번호 차례)
 * @param absentNums 오늘 결석한 sid
 */
export function drawStatus(activeNums: readonly string[], absentNums: Iterable<string>, state: DrawState): DrawStatus {
  const absentSet = new Set(absentNums);
  const pickedSet = new Set(state.picked);
  const nums = [...new Set(activeNums)];
  const pool = nums.filter((n) => !absentSet.has(n));
  return {
    pool,
    remaining: pool.filter((n) => !pickedSet.has(n)),
    absent: nums.filter((n) => absentSet.has(n)),
    done: nums.filter((n) => pickedSet.has(n)).length,
    total: nums.length,
  };
}

export interface DrawPick {
  num: string;
  /** 이번 판을 다 뽑아 새 판을 열고 뽑았다 */
  newRound: boolean;
}

/**
 * 다음 학생을 뽑는다. 나올 수 있는 학생이 없으면 null.
 * @param rand 0 이상 1 미만 (시험에서 정해 준다)
 */
export function pickNext(
  activeNums: readonly string[],
  absentNums: Iterable<string>,
  state: DrawState,
  rand: () => number = Math.random
): DrawPick | null {
  const { pool, remaining } = drawStatus(activeNums, absentNums, state);
  if (pool.length === 0) return null;
  const newRound = remaining.length === 0;
  const from = newRound ? pool : remaining;
  const i = Math.min(from.length - 1, Math.floor(rand() * from.length));
  return { num: from[i], newRound };
}

/** 뽑은 뒤의 판 (저장과 같은 셈 - 화면이 서버 답을 기다리지 않고 쓴다) */
export function afterPick(state: DrawState, pick: DrawPick): DrawState {
  if (pick.newRound) return { picked: [pick.num], round: state.round + 1 };
  return state.picked.includes(pick.num) ? state : { ...state, picked: [...state.picked, pick.num] };
}

/** 굴리는 동안 보여 줄 번호들 (마지막이 뽑힌 학생). 후보가 하나면 그것만 */
export function rollSequence(candidates: readonly string[], finalNum: string, steps: number, rand: () => number = Math.random): string[] {
  const others = candidates.filter((n) => n !== finalNum);
  if (others.length === 0 || steps <= 1) return [finalNum];
  const seq: string[] = [];
  let prev = '';
  for (let i = 0; i < steps - 1; i++) {
    // 같은 번호가 잇달아 나오지 않게 (멈춘 것처럼 보인다)
    let n = others[Math.min(others.length - 1, Math.floor(rand() * others.length))];
    if (n === prev && others.length > 1) n = others[(others.indexOf(n) + 1) % others.length];
    seq.push(n);
    prev = n;
  }
  seq.push(finalNum);
  return seq;
}

/** '2번째 판 · 5/25명 뽑음 · 남은 19명 · 오늘 결석 1명 빼고' */
export function drawStatusLine(draw: DrawState, status: DrawStatus): string {
  const parts = [`${draw.round}번째 판`, `${status.done}/${status.total}명 뽑음`];
  if (status.pool.length > 0 && status.remaining.length === 0) parts.push('다 뽑음 - 다음은 새 판');
  else parts.push(`남은 ${status.remaining.length}명`);
  if (status.absent.length > 0) parts.push(`오늘 결석 ${status.absent.length}명 빼고`);
  return parts.join(' · ');
}
