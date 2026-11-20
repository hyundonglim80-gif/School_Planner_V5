// 메모·기록에 붙인 표를 작게 그린다 - 카드·보기 칸·연결 창 (V4 components/EntryTableView.tsx의 보기 부분).
//   쓰는 칸에서 고치는 표는 TableEditor(P48-1 - 쓰는 칸만 받는다). 이 파일은 카드가 불러 첫 화면에 들므로 그리기만 둔다.
// 테두리가 없는 칸은 엑셀의 눈금선처럼 옅은 선을 긋는다 (엑셀은 눈금선을 복사하지 않는다 - domain/tableCss GRID_LINE).
import type { CSSProperties } from 'react';
import { baseCellCss, TABLE_STYLE } from '../../domain/tableCss';
import type { EntryTable } from '../../data/types';

/** 열 너비 (붙여넣은 표에만 있다). lead = 앞에 둔 행 번호 칸 폭(고치는 표) */
export function TableColGroup({ table, lead }: { table: EntryTable; lead?: number }) {
  if (!table.cols?.some((w) => w > 0)) return null;
  return (
    <colgroup>
      {lead !== undefined && <col style={{ width: lead }} />}
      {table.cols.map((w, i) => (
        <col key={i} style={w > 0 ? { width: w, minWidth: w } : undefined} />
      ))}
    </colgroup>
  );
}

interface Props {
  table: EntryTable;
  /**
   * 높이를 자르지 않고 표 전체를 펼친다 (세로 스크롤은 바깥 칸 하나만).
   * 링크 배너처럼 칸 전체가 스크롤되는 곳에서 쓴다. 넓은 표는 가로로만 스크롤한다.
   */
  fullHeight?: boolean;
}

export default function EntryTableView({ table, fullHeight }: Props) {
  return (
    // 작게 보기만. 넘치는 것은 칸 안에서만 스크롤.
    <div
      className={`${fullHeight ? 'overflow-x-auto overflow-y-hidden' : 'max-h-48 overflow-auto overscroll-contain'} rounded-md border border-slate-200 bg-white`}
      style={{ zoom: 0.8 }}
      data-entry-table={table.id}
    >
      <table className="border-collapse" style={TABLE_STYLE as CSSProperties}>
        <TableColGroup table={table} />
        <tbody>
          {table.rows.map((row, r) => (
            <tr key={r} style={row.h ? { height: row.h } : undefined}>
              {row.cells.map((cell, c) =>
                cell.x ? null : (
                  <td key={c} colSpan={cell.cs} rowSpan={cell.rs} style={baseCellCss(table.styles?.[cell.s ?? -1], cell) as CSSProperties} data-cell={`${r}-${c}`}>
                    {cell.v}
                  </td>
                )
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
