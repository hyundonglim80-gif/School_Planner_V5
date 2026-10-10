// '💾 백업 · 가져오기 · 보내기' 창 '가져오기' 탭의 V4 자료 가져오기 (P2-4 환경설정 '가져오기' 탭 → P8-3에서 이리로, MENU 2-3).
// V4 자료 가져오기: 단추 · 진행 칸 · 결과 표(종류마다 새로·바뀜·그대로·둠·지움, 항목은 학년도별). 일은 import/v4/run이 한다.
import { useEffect } from 'react';
import { useSession } from '../../data/session';
import { IMPORT_KINDS, IMPORT_NOTES } from '../../import/v4/record';
import { loadImportRecord, runImport, useImportRun } from '../../import/v4/run';
import type { ImportCounts, Outcome } from '../../import/v4/plan';
import { Section } from '../settings/parts';

const COLUMNS: ReadonlyArray<{ key: Outcome; label: string; title: string }> = [
  { key: 'added', label: '새로', title: 'V5에 새로 들어온 것' },
  { key: 'changed', label: '바뀜', title: 'V4에서 바뀐 칸을 고친 것' },
  { key: 'same', label: '그대로', title: '바뀐 것이 없어 다시 쓰지 않은 것' },
  { key: 'kept', label: '둠', title: 'V5에서 고쳤거나 지운 것, 이름이 같은 V5 라벨이 있어 그것에 이은 것 - V5 것을 그대로 둡니다' },
  { key: 'removed', label: '지움', title: 'V4에서 없어져 V5에서도 지운 것 (휴지통에서 되살릴 수 있습니다)' },
];

const when = (ms: number) => {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

function ResultTable({ counts }: { counts: Record<string, ImportCounts> }) {
  const rows = IMPORT_KINDS.filter((k) => counts[k.key]);
  return (
    <table data-import-result className="w-full mt-3 text-xs border-collapse">
      <thead>
        <tr className="text-slate-400">
          <th className="text-left font-bold py-1">종류</th>
          {COLUMNS.map((c) => (
            <th key={c.key} title={c.title} className="text-right font-bold py-1 px-1.5">
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((k) => {
          const c = counts[k.key];
          return (
            <tr key={k.key} data-import-row={k.key} className="border-t border-slate-100">
              <td className="py-1.5 font-bold text-slate-700">
                {k.name}
                {c.years && Object.keys(c.years).length > 0 && (
                  <span data-import-years className="block font-normal text-[11px] text-slate-400">
                    {Object.entries(c.years)
                      .sort(([a], [b]) => (a < b ? 1 : -1))
                      .map(([y, n]) => `${y}학년도 ${n}`)
                      .join(' · ')}
                  </span>
                )}
              </td>
              {COLUMNS.map((col) => (
                <td
                  key={col.key}
                  data-import-count={col.key}
                  className={`py-1.5 px-1.5 text-right tabular-nums ${c[col.key] ? 'font-bold text-slate-800' : 'text-slate-300'}`}
                >
                  {c[col.key]}
                </td>
              ))}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

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
        desc="지금까지 쓰던 V4 플래너의 자료를 V5로 옮겨 옵니다. V4는 그대로 두고 읽기만 합니다. 여러 번 가져와도 겹치지 않고, V5에서 고치거나 지운 것은 덮지 않습니다. 라벨·설정·일정·기록·메모·수업·진도·학급(명렬표·출석부·조사표·자리표·암기)을 가져옵니다(공유 그룹 자료는 그룹을 옮긴 뒤에)."
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
              지난 가져오기 {when(run.record.at)}
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
        {!running && run.record?.notes && (
          <ul data-import-notes className="mt-2 space-y-0.5 text-[11px] text-slate-500 list-disc pl-4">
            {IMPORT_NOTES.filter((n) => (run.record?.notes?.[n.key] ?? 0) > 0).map((n) => (
              <li key={n.key} data-import-note={n.key}>
                {n.text(run.record!.notes![n.key])}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
