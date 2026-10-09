// 조사표 한 장의 표 (V4 EvaluationModal 뷰어의 표) - 칸 차례·이름은 V3·V4 그대로(구글 시트로 낸 표의 머리와 짝).
//   맨 위 '전체 일괄 적용' 줄(인쇄에서 빠진다)·학생마다 조 이름(나눈 조가 미리 채워진다)·조별 결과·개별 결과·체크·사유/메모.
//   전출(명렬표에서 사라진) 학생은 흐리게 - 값은 남는다. 고칠 수 없는 조사표(그룹 공간의 남의 것)는 잠근다.
import { forwardRef } from 'react';
import { applyEvalToAll, evalTextField, withEvalValue, type EvalValues } from '../../domain/evaluation';
import type { EvalItem } from './evalData';

interface Props {
  ev: EvalItem;
  values: EvalValues;
  canEdit: boolean;
  onChange: (values: EvalValues) => void;
}

const head = 'p-2 text-center border-b-2 border-slate-300 font-normal text-slate-700';

const EvalTable = forwardRef<HTMLDivElement, Props>(function EvalTable({ ev, values, canEdit, onChange }, ref) {
  const textField = evalTextField(ev.type);
  const steps = ev.steps ?? [];
  const withGroup = ev.type === 'eval' && !!ev.group;
  const withIndiv = ev.type === 'eval' && !!ev.indiv;
  const lock = canEdit ? '' : 'bg-slate-100 text-slate-400 cursor-not-allowed';
  const set = (sid: string, p: Parameters<typeof withEvalValue>[2]) => onChange(withEvalValue(values, sid, p));
  const all = (p: Parameters<typeof applyEvalToAll>[2]) => onChange(applyEvalToAll(values, ev.students, p));
  const stepOptions = steps.map((s) => (
    <option key={s} value={s}>
      {s}
    </option>
  ));

  return (
    <div ref={ref} className="border border-slate-200 rounded-xl overflow-hidden" data-eval-table={ev.id}>
      <div className="max-h-[60vh] overflow-x-auto overflow-y-auto">
        <table className="w-full text-xs border-collapse text-center">
          <thead className="bg-slate-100 sticky top-0 z-10">
            <tr>
              <th className={`${head} w-11 whitespace-nowrap`}>번호</th>
              <th className={`${head} w-20`}>이름</th>
              {withGroup && (
                <>
                  <th className={head}>조이름</th>
                  <th className={head}>조별 결과</th>
                </>
              )}
              {withIndiv && <th className={head}>개별 결과</th>}
              {ev.type === 'check' && <th className={head}>체크(O/X)</th>}
              <th className={head}>{ev.type === 'memo' ? '개별 메모내용' : '사유 / 메모'}</th>
            </tr>
            {canEdit && (
              <tr data-print-hide data-eval-all className="bg-slate-50 border-b-2 border-slate-300">
                <td colSpan={2} className="p-1.5 text-center text-slate-500 font-bold">
                  전체 일괄 적용
                </td>
                {withGroup && (
                  <>
                    <td className="p-1">
                      <input className="w-full px-1 py-0.5 border rounded text-center text-xs" placeholder="조" aria-label="조 이름 일괄" onChange={(e) => all({ groupName: e.target.value })} />
                    </td>
                    <td className="p-1">
                      <select className="w-full border rounded text-xs py-0.5" aria-label="조별 결과 일괄" data-eval-all-group onChange={(e) => all({ group: e.target.value })}>
                        <option value="">선택</option>
                        {stepOptions}
                      </select>
                    </td>
                  </>
                )}
                {withIndiv && (
                  <td className="p-1">
                    <select className="w-full border rounded text-xs py-0.5" aria-label="개별 결과 일괄" data-eval-all-indiv onChange={(e) => all({ indiv: e.target.value })}>
                      <option value="">선택</option>
                      {stepOptions}
                    </select>
                  </td>
                )}
                {ev.type === 'check' && (
                  <td className="p-1 text-center">
                    <button type="button" data-eval-all-check="o" onClick={() => all({ checked: true })} className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded text-xs font-bold mr-1 cursor-pointer">
                      전체 O
                    </button>
                    <button type="button" data-eval-all-check="x" onClick={() => all({ checked: false })} className="px-1.5 py-0.5 bg-slate-200 text-slate-600 rounded text-xs font-bold cursor-pointer">
                      전체 X
                    </button>
                  </td>
                )}
                <td className="p-1">
                  <input className="w-full px-1 py-0.5 border rounded text-xs" placeholder="일괄입력" aria-label="사유 일괄" onChange={(e) => all({ [textField]: e.target.value })} />
                </td>
              </tr>
            )}
          </thead>
          <tbody className="divide-y divide-slate-100">
            {ev.students.map((st) => {
              const rec = values[st.sid] ?? {};
              const assigned = ev.groups?.find((g) => g.members.includes(st.sid));
              return (
                <tr key={st.sid} data-eval-row={st.sid} className={st.out ? 'bg-slate-50 opacity-50' : 'hover:bg-slate-50'}>
                  <td className="p-1.5 text-center font-bold text-slate-500 bg-slate-50/70">{st.num}</td>
                  <td className={`p-1.5 font-bold ${st.out ? 'text-slate-400' : 'text-slate-800'}`}>
                    {st.name}
                    {st.out && <span className="ml-0.5 font-normal">(전출/삭제됨)</span>}
                  </td>
                  {withGroup && (
                    <>
                      <td className="p-1">
                        <input
                          value={rec.groupName ?? assigned?.name ?? ''}
                          data-eval-group-name
                          aria-label={`${st.num}번 조 이름`}
                          onChange={(e) => set(st.sid, { groupName: e.target.value })}
                          readOnly={!canEdit}
                          className={`w-full px-1 py-0.5 border rounded text-center text-xs ${lock}`}
                        />
                      </td>
                      <td className="p-1">
                        <select value={rec.group ?? ''} data-eval-group-score aria-label={`${st.num}번 조별 결과`} onChange={(e) => set(st.sid, { group: e.target.value })} disabled={!canEdit} className={`w-full border rounded text-xs py-0.5 ${lock}`}>
                          <option value=""></option>
                          {stepOptions}
                        </select>
                      </td>
                    </>
                  )}
                  {withIndiv && (
                    <td className="p-1">
                      <select value={rec.indiv ?? ''} data-eval-indiv-score aria-label={`${st.num}번 개별 결과`} onChange={(e) => set(st.sid, { indiv: e.target.value })} disabled={!canEdit} className={`w-full border rounded text-xs py-0.5 ${lock}`}>
                        <option value=""></option>
                        {stepOptions}
                      </select>
                    </td>
                  )}
                  {ev.type === 'check' && (
                    <td className="p-1 text-center">
                      <input
                        type="checkbox"
                        data-eval-check
                        aria-label={`${st.num}번 체크`}
                        checked={!!rec.checked}
                        onChange={(e) => set(st.sid, { checked: e.target.checked })}
                        disabled={!canEdit}
                        className="w-5 h-5 accent-slate-600"
                      />
                    </td>
                  )}
                  <td className="p-1">
                    <input
                      value={rec[textField] ?? ''}
                      data-eval-text
                      aria-label={`${st.num}번 ${ev.type === 'memo' ? '메모' : '사유'}`}
                      onChange={(e) => set(st.sid, { [textField]: e.target.value })}
                      readOnly={!canEdit}
                      className={`w-full px-1 py-0.5 border rounded text-xs ${lock}`}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
});

export default EvalTable;
