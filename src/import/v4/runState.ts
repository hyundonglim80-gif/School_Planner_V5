// V4 가져오기의 상태(store)와 처음 로그인 띠 (P25-1 - run.ts에서 떼어 냄).
// 첫 화면(가져오기 띠·교사 유형 띠·다음 띠)은 이 파일만 부른다. 가져오기 셈(items·classes·lessons … 진도·자리·평가 셈까지)은
// '가져오기'를 누를 때 run.ts를 나눠 받는다 - 첫 화면 JS를 줄이려고(PLAN 5장 '첫 화면 JS'). run.ts가 이것을 다시 내보내
// 백업 창 '가져오기' 탭·그룹 창은 그대로 run.ts에서 부른다.
import { create } from 'zustand';
import { showErrorToast, ShownError } from '../../app/toast';
import { batch, writeOp } from '../../data/repo';
import { personalSpaceId } from '../../data/space';
import type { ImportCounts } from './plan';
import { hasV4Data, readSpaceDoc } from './read';
import { readRecord, recordData, recordPath, type ImportRecord } from './record';

export type ImportState = 'idle' | 'running' | 'done' | 'failed';

export interface ImportRun {
  state: ImportState;
  /** 지금 하는 일 (진행 칸 글) */
  step: string;
  /** 적은 쓰기 / 모두 */
  done: number;
  total: number;
  /** 이번 결과 (끝나면) */
  counts?: Record<string, ImportCounts>;
  /** 서버에서 읽은 기록 (지난 결과·띠) - 아직 모르면 undefined */
  record?: ImportRecord;
  /** 처음 로그인 띠를 보인다 (V4 자료가 있고, 가져온 적도 띠를 닫은 적도 없다) */
  offer: boolean;
  /** 띠를 띄울지 다 보았나 (P22-7 - 그 전에는 교사 유형·다음 띠도 띄우지 않는다: 가져오기 띠가 먼저) */
  offerChecked: boolean;
}

const IDLE: ImportRun = { state: 'idle', step: '', done: 0, total: 0, offer: false, offerChecked: false };

export const useImportRun = create<ImportRun>(() => IDLE);

const set = (p: Partial<ImportRun>) => useImportRun.setState(p);

/** 로그아웃·다른 계정 - 앞 사람 결과를 보이지 않는다 */
export function resetImportRun() {
  useImportRun.setState(IDLE, true);
}

/** 기록만 읽는다 (환경설정 '가져오기' - 지난 결과). 연결이 없으면 조용히 */
export async function loadImportRecord(uid: string): Promise<void> {
  try {
    set({ record: readRecord(await readSpaceDoc(personalSpaceId(uid), 'settings', 'import')) });
  } catch (e) {
    console.warn('[import] 가져오기 기록을 읽지 못했습니다.', e);
  }
}

/** 기록을 읽고 처음 로그인 띠를 보일지 정한다. 연결이 없으면 조용히 그만둔다(다음에 열 때 다시) */
export async function checkImportOffer(uid: string): Promise<void> {
  try {
    const record = readRecord(await readSpaceDoc(personalSpaceId(uid), 'settings', 'import'));
    set({ record });
    if (record.at || record.dismissed) return;
    if (await hasV4Data(uid)) set({ offer: useImportRun.getState().state === 'idle' });
  } catch (e) {
    console.warn('[import] 가져오기 기록을 읽지 못했습니다.', e);
  } finally {
    // 연결이 없어 못 보았어도 - 뒤 띠까지 막아 두지 않는다
    set({ offerChecked: true });
  }
}

/** 가져오기 띠가 없다고 정해졌고 가져오는 중도 아닌가 (P22-7 - 교사 유형·다음 띠가 그 뒤에 뜬다. 가져오기가 교사 유형·시간표·학급을 옮겨 온다) */
export const useImportOfferSettled = () => useImportRun((s) => s.offerChecked && !s.offer && s.state !== 'running');

/** 처음 로그인 띠 닫기 - 계정에 남겨 다른 기기에서도 다시 뜨지 않는다(환경설정 '가져오기'에서는 언제든 가져온다) */
export async function dismissImportOffer(uid: string): Promise<void> {
  const sid = personalSpaceId(uid);
  set({ offer: false });
  try {
    // 기록이 있으면 그 위에 (못 읽으면 적지 않는다 - 지난 결과를 빈 기록으로 덮지 않게)
    const recDoc = await readSpaceDoc(sid, 'settings', 'import');
    const next: ImportRecord = { ...readRecord(recDoc), dismissed: true };
    await batch([writeOp.put(recordPath(sid), recordData(next), recDoc)]);
    set({ record: next });
  } catch (e) {
    if (!(e instanceof ShownError)) showErrorToast('띠를 닫은 것을 계정에 남기지 못했습니다. 다음에 다시 보일 수 있습니다.', e);
  }
}

// ───────── 공유 그룹 (P8-4) ─────────

export interface GroupImportRun {
  state: ImportState;
  /** 가져오는(가져온) V4 그룹 id */
  gid: string | null;
  step: string;
  done: number;
  total: number;
  /** 끝난 결과 - V4 그룹 id → 결과 수·안내 수 (이번 로그인 동안) */
  results: Record<string, { at: number; counts: Record<string, ImportCounts>; notes: Record<string, number> }>;
}

const GROUP_IDLE: GroupImportRun = { state: 'idle', gid: null, step: '', done: 0, total: 0, results: {} };
export const useGroupImportRun = create<GroupImportRun>(() => GROUP_IDLE);

export function resetGroupImportRun() {
  useGroupImportRun.setState(GROUP_IDLE, true);
}
