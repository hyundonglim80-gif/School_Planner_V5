// '💾 백업 · 가져오기 · 보내기' 창 '가져오기' 탭의 V4 자료 가져오기 (P2-4 환경설정 '가져오기' 탭 → P8-3에서 이리로, MENU 2-3).
// V4 자료 가져오기: 단추 · 진행 칸 · 결과 표(종류마다 새로·바뀜·그대로·둠·지움, 항목은 학년도별). 일은 import/v4/run이 한다.
import { useEffect } from 'react';
import { useSession } from '../../data/session';
import { openWindow } from '../../app/windows';
import { loadImportRecord, runImport, useImportRun } from '../../import/v4/run';
import { importTimeText } from '../../import/v4/record';
import { ResultNotes, ResultTable } from '../import/ImportResult';
import { Section } from '../settings/parts';

export default function V4ImportSection() {
  const uid = useSession((s) => s.user?.uid);
  const run = useImportRun();
  useEffect(() => {
    if (uid && run.record === undefined) void loadImportRecord(uid);
  }, [uid, run.record]);

  const running = run.state === 'running';
  const counts = run.counts ?? run.record?.counts;
  const pct = run.total > 0 ? Math.round((run.done / run.total) * 100) : 0;

  return (
    <div data-import-tab>
      <Section
        id="import-v4"
        title="V4 자료 가져오기"
        desc="지금까지 쓰던 V4 플래너의 자료를 V5로 옮겨 옵니다. V4는 그대로 두고 읽기만 합니다. 여러 번 가져와도 겹치지 않고, V5에서 고치거나 지운 것은 덮지 않습니다. 라벨·설정·일정·메모(V4 기록·메모)·수업·진도·학급(명렬표·출석부·조사표·자리표·암기)을 가져옵니다(공유 그룹 자료는 아래 공유 그룹 창에서)."
      >
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            data-import-run
            disabled={running || !uid}
            onClick={() => uid && void runImport(uid)}
            className="px-3 py-1.5 bg-primary hover:bg-primary/90 text-white rounded-lg text-xs font-bold cursor-pointer disabled:opacity-50"
          >
            {running ? '가져오는 중…' : run.record?.at ? '📥 다시 가져오기' : '📥 V4 자료 가져오기'}
          </button>
          {run.record?.at && !running && (
            <span data-import-last className="text-xs text-slate-400">
              지난 가져오기 {importTimeText(run.record.at)}
            </span>
          )}
        </div>
        {running && (
          <div data-import-progress={pct} className="mt-3">
            <p className="text-xs text-slate-500 mb-1">
              {run.step} {run.total > 0 && `(${run.done}/${run.total})`}
            </p>
            <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full bg-primary transition-[width]" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}
        {run.state === 'failed' && (
          <p data-import-failed className="mt-2 text-xs font-bold text-red-500">
            다 가져오지 못했습니다. 다시 누르면 남은 것을 가져옵니다(가져온 것은 겹치지 않습니다).
          </p>
        )}
        {!running && counts && <ResultTable counts={counts} />}
        {!running && <ResultNotes notes={run.record?.notes} />}
        <p className="mt-3 text-xs text-slate-500">
          V4 공유 그룹의 자료는{' '}
          <button type="button" data-import-groups-open onClick={() => openWindow('group', {})} className="font-bold text-primary underline underline-offset-2 cursor-pointer">
            👥 공유 그룹
          </button>{' '}
          창에서 그룹마다 가져옵니다.
        </p>
      </Section>
    </div>
  );
}
