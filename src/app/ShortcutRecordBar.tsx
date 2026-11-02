// 단축키 설정 띠 (P18-1 - 환경설정 단축키 탭 '⌨️ 단축키 설정'으로 연다). 화면 아래 가운데에 늘 떠 있다(창이 열리고 닫혀도).
//   고르기: '단축키로 쓸 메뉴·단추를 누르세요' · 고른 것 · [완료] [취소]   (고를 수 있는 단추는 점선 테두리 - index.css)
//   키    : ''시간표'에 줄 키를 누르세요' · 누른 조합 · 안내(겹침·글 칸) · [저장] [다시 고르기] [취소]
//   창 안 탭(P18-2)도 같다 - 이름은 '환경설정 → 알림'(app/tabShortcuts).
// 새 창이 아니라 띠 하나라 창 목록에 넣지 않는다(PLAN 5장 P18). 띠 안을 누른 것은 고르기에 세지 않는다([data-shortcut-record]).
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { assignBinding, bindingOf, formatAnyBinding, recordKeyIssue, resolveBindings, worksWhileTyping } from '../domain/shortcuts';
import { useShortcutOverrides } from './keys';
import { shortcutLabel } from './tabShortcuts';
import { cancelShortcutRecord, finishPick, onRecordClick, onRecordKey, repick, saveRecordedKey, useShortcutRecord } from './shortcutRecord';

const BTN = 'px-3 py-1.5 text-xs font-bold rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0';

export default function ShortcutRecordBar() {
  const { stage, picked, miss, binding } = useShortcutRecord();
  const { overrides, tabs } = useShortcutOverrides();

  useEffect(() => {
    if (stage === 'off') return;
    document.addEventListener('click', onRecordClick, true);
    window.addEventListener('keydown', onRecordKey, true);
    document.body.dataset.shortcutRecording = stage;
    return () => {
      document.removeEventListener('click', onRecordClick, true);
      window.removeEventListener('keydown', onRecordKey, true);
      delete document.body.dataset.shortcutRecording;
    };
  }, [stage]);

  if (stage === 'off') return null;
  const label = picked ? shortcutLabel(picked) : '';
  const now = resolveBindings(overrides);

  let body;
  if (stage === 'pick' || !picked) {
    body = (
      <>
        <span className="text-xs text-slate-600 min-w-0">
          단축키로 쓸 <strong className="text-slate-800">메뉴·단추를 누르세요</strong> <span className="text-slate-400">(점선 테두리)</span>
        </span>
        {picked && (
          <span data-shortcut-record-picked={picked} className="px-2 py-1 rounded-lg bg-violet-50 border border-violet-200 text-violet-800 text-xs font-bold truncate max-w-56" title={label}>
            고른 것: {label}
          </span>
        )}
        {miss && (
          <span data-shortcut-record-miss className="text-xs font-bold text-rose-600">
            이 단추는 단축키로 만들 수 없습니다
          </span>
        )}
        <button type="button" data-shortcut-record-done disabled={!picked} onClick={finishPick} className={`${BTN} bg-primary text-white hover:bg-primary/90`}>
          완료
        </button>
      </>
    );
  } else {
    const issue = binding ? recordKeyIssue(binding) : null;
    const cleared = binding && !issue ? assignBinding(now, picked, binding, tabs).cleared : [];
    body = (
      <>
        <span className="text-xs text-slate-600 min-w-0">
          <strong className="text-slate-800">'{label}'</strong>에 줄 키를 누르세요 <span className="text-slate-400">(지금: {formatAnyBinding(picked, bindingOf(picked, now, tabs))} · Backspace = 지우기)</span>
        </span>
        <kbd data-shortcut-record-key className="min-w-20 px-2 py-1 text-center bg-white border border-slate-300 rounded-lg text-sm font-mono font-bold text-slate-800 shrink-0">
          {binding ? formatAnyBinding(picked, binding) : '…'}
        </kbd>
        {issue && (
          <span data-shortcut-record-issue className="text-xs font-bold text-rose-600">
            {issue}
          </span>
        )}
        {cleared.length > 0 && (
          <span data-shortcut-record-conflict className="text-xs font-bold text-amber-700">
            지금 {cleared.map((id) => `'${shortcutLabel(id)}'`).join(', ')}이(가) 쓰는 키 - 저장하면 거기서 뺍니다
          </span>
        )}
        {binding && !issue && !worksWhileTyping(binding) && (
          <span data-shortcut-record-typing className="text-xs text-slate-500">글 쓰는 칸 안에서는 동작하지 않습니다 (Ctrl·Alt와 함께면 어디서나)</span>
        )}
        <button type="button" data-shortcut-record-save disabled={!binding || !!issue} onClick={() => saveRecordedKey()} className={`${BTN} bg-primary text-white hover:bg-primary/90`}>
          저장
        </button>
        <button type="button" data-shortcut-record-repick onClick={repick} className={`${BTN} bg-white border border-slate-200 text-slate-600 hover:bg-slate-50`}>
          다시 고르기
        </button>
      </>
    );
  }

  return createPortal(
    <div
      data-shortcut-record={stage}
      role="status"
      className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[99500] w-max max-w-[calc(100vw-2rem)] flex flex-wrap items-center gap-2 bg-white text-slate-800 px-4 py-2.5 rounded-2xl shadow-2xl border-2 border-violet-300"
    >
      <span className="text-sm font-black text-violet-700 shrink-0">⌨️ 단축키 설정</span>
      {body}
      <button type="button" data-shortcut-record-cancel onClick={cancelShortcutRecord} className={`${BTN} bg-white border border-slate-200 text-slate-600 hover:bg-slate-50`} title="그만두기 (ESC)">
        취소
      </button>
    </div>,
    document.body,
  );
}
