// 📰 주간학습안내 (V4 components/WeeklyGuideModal.tsx). 창 'weeklyGuide' = { date? } - 주간 화면 단추(보는 주)·단축키(다음 주).
// 한 주(월~금)의 요일 × 교시 표(과목 + 수업 메모) + 날마다 준비물·알림장 → 인쇄(A4 세로)·표 복사(한글·워드는 표, 엑셀은 칸마다).
// 재료는 지금 공간의 계산한 수업 칸(features/lessons/useLessons - 읽기만), 셈은 domain/weeklyGuide, 인쇄는 ui/print.
// 제목·넣을 것·주마다 알리는 말은 이 기기에만 남긴다(학교·반마다 쓰는 말이 다르다 - V4 그대로). 알림장 줄 = 그날 적은 알림장(P7-2).
import { useMemo, useRef, useState } from 'react';
import { showErrorToast, showToast } from '../../app/toast';
import type { WindowProps } from '../../app/windows';
import { useCommonSettings } from '../../app/prefs';
import { todayStr } from '../../domain/dateUtils';
import {
  guideDaysOf,
  guideHtml,
  guideTable,
  guideTsv,
  nextWeekMonday,
  schoolWeekOf,
  shiftWeek,
  weekRangeText,
  type GuideOptions,
} from '../../domain/weeklyGuide';
import { useCurrentSpaceId } from '../../data/session';
import { useDocs } from '../../data/select';
import { readNoticeLines } from '../../domain/notices';
import ModalShell, { ModalCloseButton } from '../../ui/ModalShell';
import { printNode } from '../../ui/print';
import { useLessonsFor } from '../lessons/useLessons';

export interface WeeklyGuideParams {
  /** 처음 보일 주의 아무 날 (없으면 다음 주) */
  date?: string;
}

const OPTS_KEY = 'sp5-weekly-guide-opts';
const TITLE_KEY = 'sp5-weekly-guide-title';
const NOTES_KEY = 'sp5-weekly-guide-notes';
const DEFAULT_OPTS: GuideOptions = { memo: true, supplies: true, notices: true };

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

function writeText(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // 이 기기에서 기억하지 못할 뿐
  }
}

export default function WeeklyGuideWindow({ params, close, raise }: WindowProps<WeeklyGuideParams | undefined>) {
  const sid = useCurrentSpaceId();
  const periods = useCommonSettings((s) => s.periods);
  const periodNames = useMemo(() => periods.map((p) => p.name), [periods]);
  const today = todayStr();

  const [monday, setMonday] = useState(() => schoolWeekOf(params?.date || nextWeekMonday(today))[0]);
  // 열린 채로 주간 단추를 다시 누르면 그 주로
  const [askedDate, setAskedDate] = useState(params?.date);
  if (params?.date !== askedDate) {
    setAskedDate(params?.date);
    if (params?.date) setMonday(schoolWeekOf(params.date)[0]);
  }
  const dates = useMemo(() => schoolWeekOf(monday), [monday]);
  const lessons = useLessonsFor(dates, sid);
  const [opts, setOpts] = useState<GuideOptions>(() => readJson(OPTS_KEY, DEFAULT_OPTS));
  const [title, setTitle] = useState(() => {
    try {
      return localStorage.getItem(TITLE_KEY) || '주간학습안내';
    } catch {
      return '주간학습안내';
    }
  });
  const [notes, setNotes] = useState<Record<string, string>>(() => readJson<Record<string, string>>(NOTES_KEY, {}));
  const note = notes[monday] || '';
  const previewRef = useRef<HTMLDivElement>(null);

  const saveNote = (text: string) => {
    const next = { ...notes };
    if (text.trim()) next[monday] = text;
    else delete next[monday];
    setNotes(next);
    writeText(NOTES_KEY, JSON.stringify(next));
  };

  const setOpt = (key: keyof GuideOptions, on: boolean) => {
    const next = { ...opts, [key]: on };
    setOpts(next);
    writeText(OPTS_KEY, JSON.stringify(next));
  };

  const shown: GuideOptions = opts;
  // 알림장 줄 = 그날 적은 알림장 (보는 공간 - P7-2)
  const noticeDocs = useDocs('notices', sid);
  const days = useMemo(() => guideDaysOf(dates, (d) => lessons[d] ?? { cells: [] }, (d) => readNoticeLines(noticeDocs[d]?.lines)), [dates, lessons, noticeDocs]);
  const table = guideTable(days, periodNames, shown);
  const fullTitle = `${title.trim() || '주간학습안내'} (${weekRangeText(dates)})`;
  const emptyWeek = days.every((d) => Object.keys(d.periods).length === 0 && d.notices.length === 0);
  const periodRows = table.rows.length - (shown.supplies ? 1 : 0) - (shown.notices ? 1 : 0);

  const print = () => {
    if (previewRef.current) printNode(previewRef.current, { landscape: false, marginMm: 10 });
  };

  const copy = async () => {
    const html = guideHtml(fullTitle, note, table);
    const tsv = guideTsv(table);
    try {
      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html': new Blob([html], { type: 'text/html' }),
            'text/plain': new Blob([tsv], { type: 'text/plain' }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(tsv);
      }
      showToast('📋 표를 복사했습니다. 한글·워드·엑셀·구글 시트에 붙여 넣으세요.');
    } catch (e) {
      showErrorToast('복사하지 못했습니다.', e);
    }
  };

  const btn = 'px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 font-bold cursor-pointer';
  const thisMonday = schoolWeekOf(today)[0];
  const nextMonday = shiftWeek(thisMonday, 1);
  const optionList: Array<readonly [keyof GuideOptions, string]> = [
    ['memo', '수업 메모'],
    ['supplies', '준비물'],
    ['notices', '알림장'],
  ];

  return (
    <ModalShell isOpen onClose={close} raise={raise} width="2xl" title="📰 주간학습안내" footer={<ModalCloseButton onClose={close} />}>
      <div className="flex flex-col gap-3 text-xs text-slate-700" data-weekly-guide-window>
        <div className="flex flex-wrap items-center gap-1.5">
          <button type="button" data-guide-prev onClick={() => setMonday(shiftWeek(monday, -1))} className={btn} title="앞 주">
            ◀
          </button>
          <span className="px-2 font-black text-sm text-slate-800" data-guide-range={monday}>
            {weekRangeText(dates)}
          </span>
          <button type="button" data-guide-next onClick={() => setMonday(shiftWeek(monday, 1))} className={btn} title="다음 주">
            ▶
          </button>
          <button type="button" data-guide-this onClick={() => setMonday(thisMonday)} aria-pressed={monday === thisMonday} className={btn}>
            이번 주
          </button>
          <button type="button" data-guide-coming onClick={() => setMonday(nextMonday)} aria-pressed={monday === nextMonday} className={btn}>
            다음 주
          </button>
          <div className="ml-auto flex items-center gap-1.5">
            <button type="button" data-guide-copy onClick={() => void copy()} className={btn}>
              📋 표 복사
            </button>
            <button type="button" data-guide-print onClick={print} className={btn}>
              🖨️ 인쇄
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <label className="flex items-center gap-1.5">
            <span className="font-bold text-slate-500">제목</span>
            <input
              value={title}
              data-guide-title
              onChange={(e) => {
                setTitle(e.target.value);
                writeText(TITLE_KEY, e.target.value);
              }}
              aria-label="제목"
              placeholder="주간학습안내"
              className="w-48 px-2 py-1 border border-slate-200 rounded-lg font-bold"
            />
          </label>
          {optionList.map(([key, label]) => (
            <label key={key} className="flex items-center gap-1 cursor-pointer">
              <input type="checkbox" data-guide-opt={key} checked={opts[key]} onChange={(e) => setOpt(key, e.target.checked)} />
              {label}
            </label>
          ))}
        </div>
        <textarea
          value={note}
          data-guide-note-input
          onChange={(e) => saveNote(e.target.value)}
          aria-label="알리는 말"
          placeholder="이번 주 알리는 말 (예: 10월 7일은 현장체험학습입니다. 도시락을 챙겨 주세요.) - 이 주에만, 이 기기에 남습니다"
          rows={2}
          className="w-full px-2.5 py-2 border border-slate-200 rounded-xl"
        />

        {/* 인쇄·미리 보기 - 이 칸이 그대로 찍힌다 */}
        <div ref={previewRef} className="border border-slate-200 rounded-xl p-3 bg-white" data-weekly-guide>
          <h2 className="text-base font-black text-slate-900 mb-1" data-guide-heading>
            {fullTitle}
          </h2>
          {note.trim() && (
            <p className="whitespace-pre-wrap text-slate-700 mb-2" data-guide-note>
              {note.trim()}
            </p>
          )}
          <table className="w-full table-fixed border-collapse text-xs" data-guide-table>
            <thead>
              <tr>
                {table.head.map((h, i) => (
                  <th key={i} className={`border border-slate-400 bg-slate-100 px-1.5 py-1 ${i === 0 ? 'w-14' : ''}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row, r) => (
                <tr key={r} data-guide-row={row[0]}>
                  {row.map((cell, c) => {
                    if (c === 0) {
                      return (
                        <th key={c} className="border border-slate-400 bg-slate-50 px-1 py-1 font-bold text-slate-600">
                          {cell}
                        </th>
                      );
                    }
                    const [first, ...rest] = cell.split('\n');
                    return (
                      <td key={c} className="border border-slate-400 px-1.5 py-1 align-top" data-guide-cell={`${row[0]}:${c}`}>
                        {r < periodRows ? (
                          <>
                            <span className="font-black text-slate-900">{first}</span>
                            {rest.length > 0 && <span className="block text-2xs text-slate-500 whitespace-pre-line">{rest.join('\n')}</span>}
                          </>
                        ) : (
                          <span className="whitespace-pre-line">{cell}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {emptyWeek && <p className="text-2xs text-amber-700 font-bold" data-guide-empty>이 주에 수업 칸이 비어 있습니다. ⏰ 시간표 창에서 시간표를 만들거나 다른 주를 고릅니다.</p>}
        <p className="text-2xs text-slate-400">
          지금 보는 공간의 수업 칸(과목·수업 메모·준비물)을 읽기만 합니다. 고치려면 그날 하루 화면에서 고칩니다 - 열어 둔 채로 고쳐도 표가 따라옵니다. 인쇄 창에서 'PDF로 저장'을 고르면 PDF가 됩니다.
        </p>
      </div>
    </ModalShell>
  );
}
