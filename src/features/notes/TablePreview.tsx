// 메모·기록에 붙인 표를 카드에서 작게 보기만 (V4 components/EntryTableView의 compact).
// 칸 글자·합친 칸(cs·rs)·가려진 칸(x)만 그린다 - 칸 서식(styles)·쓰는 칸의 고치기·붙여넣기는 P4-2가 V4 lib/entryTable과 함께 옮긴다.
// 테두리가 없는 칸은 엑셀 눈금선처럼 옅은 선을 긋는다(엑셀은 눈금선을 복사하지 않는다).
import type { EntryTable } from '../../data/types';

const GRID_LINE = '1px solid #e2e8f0';

export default function TablePreview({ table }: { table: EntryTable }) {
  return (
    // 넘치는 것은 칸 안에서만 스크롤
    <div className="max-h-48 overflow-auto overscroll-contain rounded-md border border-slate-200 bg-white" style={{ zoom: 0.8 }} data-entry-table={table.id}>
      <table className="border-collapse text-xs text-slate-800">
        <tbody>
          {(table.rows ?? []).map((row, r) => (
            <tr key={r} style={row.h ? { height: row.h } : undefined}>
              {(row.cells ?? []).map((cell, c) =>
                cell.x ? null : (
                  <td key={c} colSpan={cell.cs} rowSpan={cell.rs} style={{ border: GRID_LINE, padding: '2px 6px', verticalAlign: 'bottom', whiteSpace: 'pre' }}>
                    {cell.v}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
