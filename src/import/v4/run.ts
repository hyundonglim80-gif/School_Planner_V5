// V4 가져오기 실행 (DESIGN 8장). 읽기(read.ts) → 맞춰 보기(labels·settings - 순수) → 적기(저장 도우미) → 기록(settings/import).
// 화면(환경설정 '가져오기'·처음 로그인 띠)은 이 store(useImportRun)를 보고 runImport를 부른다.
//
// - 한 번에 하나만 돈다. 적기는 500개씩 묶어(Firestore 한도) 진행 칸을 채운다 - 끊기면 다시 누르면 된다(결정적 id·지문이라 겹치지 않는다).
// - 되돌리기(Ctrl+Z)에 넣지 않는다: 수백 개를 한꺼번에 지운 표시로 되돌리면 더 위험하다. 다시 가져오기가 바뀐 것만 고친다.
// - 라벨이 먼저(항목이 라벨을 id로 가리킨다 - P3-4가 이 뒤에 더한다), 기록은 맨 끝(다 적은 뒤).
import { create } from 'zustand';
import { showErrorToast, showToast, ShownError } from '../../app/toast';
import { batch, BATCH_LIMIT, writeOp } from '../../data/repo';
import { personalSpaceId } from '../../data/space';
import { planLabels } from './labels';
import { changedTotal, addCounts, emptyCounts, type ImportCounts } from './plan';
import { hasV4Data, readSpaceDoc, readSpaceDocs, readV4SettingsDocs } from './read';
import { readRecord, recordData, recordPath, type ImportRecord } from './record';
import { planSettings } from './settings';

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
}

const IDLE: ImportRun = { state: 'idle', step: '', done: 0, total: 0, offer: false };

export const useImportRun = create<ImportRun>(() => IDLE);

const set = (p: Partial<ImportRun>) => useImportRun.setState(p);

/** 로그아웃·다른 계정 - 앞 사람 결과를 보이지 않는다 */
export function resetImportRun() {
  useImportRun.setState(IDLE, true);
}

/** 결과 수 모두 더하기 */
export const totalCounts = (counts: Record<string, ImportCounts> | undefined) =>
  Object.values(counts ?? {}).reduce(addCounts, emptyCounts());

/** V4 → V5 가져오기 (개인 공간). 끝까지 하면 true. 실패는 안내하고 false */
export async function runImport(uid: string): Promise<boolean> {
  if (useImportRun.getState().state === 'running') return false;
  const sid = personalSpaceId(uid);
  set({ state: 'running', step: 'V4 자료를 읽는 중…', done: 0, total: 0, counts: undefined, offer: false });
  try {
    const [v4, labels, pc, mobile, common, recDoc] = await Promise.all([
      readV4SettingsDocs(uid),
      readSpaceDocs(sid, 'labels'),
      readSpaceDoc(sid, 'settings', 'pc'),
      readSpaceDoc(sid, 'settings', 'mobile'),
      readSpaceDoc(sid, 'settings', 'common'),
      readSpaceDoc(sid, 'settings', 'import'),
    ]);
    const record = readRecord(recDoc);

    set({ step: 'V5에 있는 것과 맞춰 보는 중…' });
    const lp = planLabels(sid, v4.labels, labels);
    const sp = planSettings(sid, v4.prefs, { pc, mobile, common }, record.settings);
    const ops = [...lp.ops, ...sp.ops];
    const counts: Record<string, ImportCounts> = { 'labels.event': lp.counts.event, 'labels.note': lp.counts.note, settings: sp.counts };

    set({ step: '적는 중…', total: ops.length + 1 });
    const fail = 'V4 자료를 다 가져오지 못했습니다. 네트워크를 확인하고 다시 가져와 주세요(가져온 것은 겹치지 않습니다).';
    for (let i = 0; i < ops.length; i += BATCH_LIMIT) {
      const chunk = ops.slice(i, i + BATCH_LIMIT);
      await batch(chunk, { fail });
      set({ done: i + chunk.length });
    }
    const next: ImportRecord = { ...record, at: Date.now(), counts, labelMap: lp.labelMap, settings: sp.written };
    await batch([writeOp.put(recordPath(sid), recordData(next), recDoc)], { fail });

    const changed = changedTotal(totalCounts(counts));
    set({ state: 'done', step: '', done: ops.length + 1, counts, record: next });
    showToast(changed > 0 ? `📥 V4 자료를 가져왔습니다 (바뀐 것 ${changed}개).` : '📥 V4 자료를 다시 보았습니다 - 바뀐 것이 없습니다.');
    return true;
  } catch (e) {
    if (!(e instanceof ShownError)) showErrorToast('V4 자료를 읽지 못했습니다. 네트워크를 확인하고 다시 가져와 주세요.', e);
    set({ state: 'failed', step: '' });
    return false;
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
  }
}

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
