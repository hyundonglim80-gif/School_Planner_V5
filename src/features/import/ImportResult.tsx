// V4 가져오기 결과 표 (백업 창 '가져오기' 탭의 V4 자료 가져오기·공유 그룹 창의 V4 그룹 가져오기 - P8-4에서 나눔).
import { IMPORT_KINDS, IMPORT_NOTES } from '../../import/v4/record';
import type { ImportCounts, Outcome } from '../../import/v4/plan';

const COLUMNS: ReadonlyArray<{ key: Outcome; label: string; title: string }> = [
  { key: 'added', label: '새로', title: 'V5에 새로 들어온 것' },
  { key: 'changed', label: '바뀜', title: 'V4에서 바뀐 칸을 고친 것' },
  { key: 'same', label: '그대로', title: '바뀐 것이 없어 다시 쓰지 않은 것' },
  { key: 'kept', label: '둠', title: 'V5에서 고쳤거나 지운 것, 이름이 같은 V5 라벨이 있어 그것에 이은 것 - V5 것을 그대로 둡니다' },
  { key: 'removed', label: '지움', title: 'V4에서 없어져 V5에서도 지운 것 (휴지통에서 되살릴 수 있습니다)' },
];

export function ResultTable({ counts }: { counts: Record<string, ImportCounts> }) {
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

/** 결과 표 아래 한 줄씩 (0인 것은 뺀다) */
export function ResultNotes({ notes }: { notes: Record<string, number> | undefined }) {
  const list = IMPORT_NOTES.filter((n) => (notes?.[n.key] ?? 0) > 0);
  if (!notes || list.length === 0) return null;
  return (
    <ul data-import-notes className="mt-2 space-y-0.5 text-[11px] text-slate-500 list-disc pl-4">
      {list.map((n) => (
        <li key={n.key} data-import-note={n.key}>
          {n.text(notes[n.key])}
        </li>
      ))}
    </ul>
  );
}
