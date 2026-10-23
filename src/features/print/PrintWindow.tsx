// 🖨️ 인쇄 창 (⋮ '이 화면 인쇄'·Ctrl+P - app/printScreen이 보는 화면·날짜로 연다). 10-23 사용자 요청:
//   - 화면: 하루 / 주간 / 월간 / 년간 (처음은 보던 화면 - 메모·학급은 하루)
//   - 구간: 시작 ~ 끝을 달력에서 (하루 = 날, 주간 = 고른 날이 든 주, 월간 = 달, 년간 = 학년도) - 쪽 셈은 domain/printPages
//   - 용지: 세로 / 가로 (화면마다 따로 기억 - 처음은 하루 세로, 나머지 가로)
//   - 미리보기: 쪽마다 진짜 화면(printAt)을 A4 찍히는 폭으로 그려 줄여 보인다. '한 장에 맞추기'(처음 켬)면 긴 쪽을 줄여 한 장에, 끄면 넘치는 곳은 점선(다음 장).
//     🖨️ 인쇄는 미리보기의 쪽(data-print-paper)을 그대로 복제해 쪽마다 새 용지로 찍는다(ui/print) - 보이는 것 = 찍히는 것.
//   어두운 화면에서도 쪽은 종이처럼 밝게(dark.css가 [data-print-paper] 안을 밝은 색으로 되돌린다).
import { useEffect, useRef, useState, type ComponentType } from 'react';
import { useNav } from '../../app/nav';
import type { WindowProps } from '../../app/windows';
import {
  DEFAULT_LANDSCAPE,
  mmToPx,
  pageStart,
  paperSizeMm,
  PRINT_PAGES,
  printPageStarts,
  printPageTitle,
  printRangeLabel,
  type PrintPage,
} from '../../domain/printPages';
import { addDays, todayStr } from '../../domain/dateUtils';
import MiniCalendarPicker from '../../ui/MiniCalendarPicker';
import ModalShell, { ModalCloseButton } from '../../ui/ModalShell';
import { printNode } from '../../ui/print';
import DayScreen from '../day/DayScreen';
import MonthScreen from '../month/MonthScreen';
import WeekScreen from '../week/WeekScreen';
import YearScreen from '../year/YearScreen';
import type { PrintParams } from './types';

const MARGIN_MM = 8;
/** 한 장에 맞출 때 쓰는 높이 (찍히는 칸의 97%) */
const FIT_SLACK = 0.97;

const SCREENS: Record<PrintPage, ComponentType<{ printAt?: string }>> = { day: DayScreen, week: WeekScreen, month: MonthScreen, year: YearScreen };

const PICK_HINT: Record<PrintPage, string> = { day: '날짜를 누르면 그 날', week: '날짜를 누르면 그 날이 든 주', month: '날짜를 누르면 그 달', year: '날짜를 누르면 그 학년도' };

interface Setup {
  page: PrintPage;
  from: string;
  to: string;
}

const setupOf = (params: PrintParams | undefined): Setup => {
  const date = params?.date ?? todayStr();
  return { page: params?.page ?? 'day', from: date, to: date };
};

/** 고른 단위의 날들 (달력에 칠한다 - 하루·주간만) */
function unitDays(page: PrintPage, date: string): string[] | undefined {
  if (page === 'day') return [date];
  if (page !== 'week') return undefined;
  const s = pageStart('week', date);
  return Array.from({ length: 7 }, (_, i) => addDays(s, i));
}

const seg = (on: boolean) =>
  `px-3 py-1.5 text-xs font-bold border transition-all cursor-pointer first:rounded-l-lg last:rounded-r-lg -ml-px first:ml-0 ${
    on ? 'bg-primary text-white border-primary relative z-[1]' : 'bg-white text-slate-500 border-slate-200 hover:text-primary'
  }`;

export default function PrintWindow({ params, close, raise }: WindowProps<PrintParams | undefined>) {
  // 다시 열면(⋮·Ctrl+P) 그때 보던 화면·날짜로 (용지 방향은 화면마다 남는다)
  const [setup, setSetup] = useState<Setup>(() => setupOf(params));
  const [seenRaise, setSeenRaise] = useState(raise);
  if (seenRaise !== raise) {
    setSeenRaise(raise);
    setSetup(setupOf(params));
  }
  const [landscape, setLandscape] = useState<Record<PrintPage, boolean>>(DEFAULT_LANDSCAPE);
  const [fit, setFit] = useState(true);
  const { page, from, to } = setup;
  const isLandscape = landscape[page];
  const showWeekend = useNav((s) => s.showWeekend);
  const semester = useNav((s) => s.semesterFilter);

  const { starts, total } = printPageStarts(page, from, to);
  const titleOf = (start: string) => printPageTitle(page, start, showWeekend) + (page === 'year' && semester !== 'all' ? ` (${semester}학기)` : '');

  // 시작이 끝보다 늦어지면 끝도 따라간다 (거꾸로도)
  const setFrom = (d: string) => setSetup((s) => ({ ...s, from: d, to: pageStart(s.page, d) > pageStart(s.page, s.to) ? d : s.to }));
  const setTo = (d: string) => setSetup((s) => ({ ...s, to: d, from: pageStart(s.page, d) < pageStart(s.page, s.from) ? d : s.from }));

  const previewRef = useRef<HTMLDivElement>(null);
  const [avail, setAvail] = useState(0);
  useEffect(() => {
    const el = previewRef.current;
    if (!el) return;
    const measure = () => setAvail(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const paper = paperSizeMm(isLandscape, MARGIN_MM);
  const fullW = mmToPx(paper.width + MARGIN_MM * 2);
  // 미리보기 칸 안쪽 여백(p-3) 둘을 빼고 맞춘다
  const scale = avail > 24 ? Math.min(1, (avail - 24) / fullW) : 0.4;

  const print = () => {
    const nodes = [...(previewRef.current?.querySelectorAll<HTMLElement>('[data-print-paper]') ?? [])];
    if (nodes.length) printNode(nodes, { landscape: isLandscape, marginMm: MARGIN_MM });
  };
  // 메모·학급 화면은 그 화면 그대로 브라우저 인쇄도 (#117 - 이 창이 생기기 전 모양)
  const asIs = params?.scope === 'memo' || params?.scope === 'class';
  const printAsIs = () => {
    close();
    requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
  };

  const unit = PRINT_PAGES.find((p) => p.id === page)!.unit;
  const rangeBtn = 'px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 font-bold text-slate-700 cursor-pointer whitespace-nowrap';

  return (
    <ModalShell
      isOpen
      onClose={close}
      raise={raise}
      width="4xl"
      title="🖨️ 인쇄"
      footer={
        <>
          {asIs && (
            <button type="button" data-print-as-is onClick={printAsIs} className="mr-auto px-3 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 cursor-pointer">
              이 화면 그대로 인쇄
            </button>
          )}
          <ModalCloseButton onClose={close} />
          <button
            type="button"
            data-print-go
            onClick={print}
            disabled={starts.length === 0}
            className="px-4 py-2 rounded-xl text-sm font-black bg-primary text-white hover:opacity-90 disabled:opacity-50 shadow-xs cursor-pointer"
          >
            🖨️ 인쇄 ({starts.length}쪽)
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-3 text-xs text-slate-700" data-print-window={page}>
        <div className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2.5">
          <span className="font-bold text-slate-500">화면</span>
          <div className="flex" role="group" aria-label="찍을 화면">
            {PRINT_PAGES.map((p) => (
              <button key={p.id} type="button" data-print-page={p.id} aria-pressed={page === p.id} onClick={() => setSetup((s) => ({ ...s, page: p.id }))} className={seg(page === p.id)}>
                {p.label}
              </button>
            ))}
          </div>

          <span className="font-bold text-slate-500">구간</span>
          <div className="flex flex-wrap items-center gap-1.5" data-print-range={`${starts[0] ?? ''}~${starts[starts.length - 1] ?? ''}`}>
            <MiniCalendarPicker
              date={from}
              onSelectDate={setFrom}
              marked={unitDays(page, from)}
              hint={PICK_HINT[page]}
              trigger={{ label: `📅 ${printRangeLabel(page, from)}`, title: `시작 ${unit} - 달력에서 고르기`, data: 'print-from', className: rangeBtn }}
            />
            <span className="text-slate-400">~</span>
            <MiniCalendarPicker
              date={to}
              onSelectDate={setTo}
              marked={unitDays(page, to)}
              hint={PICK_HINT[page]}
              trigger={{ label: `📅 ${printRangeLabel(page, to)}`, title: `끝 ${unit} - 달력에서 고르기`, data: 'print-to', className: rangeBtn }}
            />
            <span className="text-slate-500" data-print-count={total}>
              {total > starts.length ? `모두 ${total}쪽 - 앞 ${starts.length}쪽만 찍습니다` : `${total}쪽`}
            </span>
          </div>

          <span className="font-bold text-slate-500">용지</span>
          <div className="flex items-center gap-2">
            <div className="flex" role="group" aria-label="용지 방향">
              {(
                [
                  ['portrait', false, '세로'],
                  ['landscape', true, '가로'],
                ] as const
              ).map(([id, on, label]) => (
                <button key={id} type="button" data-print-orient={id} aria-pressed={isLandscape === on} onClick={() => setLandscape((m) => ({ ...m, [page]: on }))} className={seg(isLandscape === on)}>
                  {label}
                </button>
              ))}
            </div>
            <span className="text-slate-400">A4</span>
            <label className="ml-2 flex items-center gap-1.5 cursor-pointer" title="한 장을 넘는 쪽은 글자·칸을 줄여 한 장에 찍습니다 (끄면 넘는 만큼 다음 장으로)">
              <input type="checkbox" data-print-fit checked={fit} onChange={(e) => setFit(e.target.checked)} className="accent-primary" />
              <span className="font-bold text-slate-600">한 장에 맞추기</span>
            </label>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <span className="font-black text-slate-600">미리보기</span>
          <span className="text-slate-400">둘째 줄 토글(일정·수업·주말)대로{fit ? '' : ' · 점선 = 다음 장'}</span>
        </div>
        <div ref={previewRef} data-print-preview className="flex flex-col items-center gap-4 rounded-xl bg-slate-100 p-3">
          {starts.map((start) => (
            <PaperSheet key={`${page}:${start}`} page={page} start={start} title={titleOf(start)} landscape={isLandscape} scale={scale} fit={fit} />
          ))}
        </div>
      </div>
    </ModalShell>
  );
}

/**
 * 쪽 하나 - A4 찍히는 폭으로 그려 줄인다. fit이면 한 장 높이를 넘는 쪽을 CSS zoom으로 줄여 한 장에(zoom은 찍을 때도 자리를 줄인다 -
 * transform은 찍을 때 장 나눔에 들지 않는다), 아니면 넘는 만큼 장을 늘려 점선으로 나눈다. offsetHeight는 zoom 앞의 높이다.
 */
function PaperSheet({ page, start, title, landscape, scale, fit }: { page: PrintPage; start: string; title: string; landscape: boolean; scale: number; fit: boolean }) {
  const paper = paperSizeMm(landscape, MARGIN_MM);
  const w = mmToPx(paper.width);
  const h = mmToPx(paper.height);
  const margin = mmToPx(MARGIN_MM);
  const paperRef = useRef<HTMLDivElement>(null);
  const [contentH, setContentH] = useState(h);
  useEffect(() => {
    const el = paperRef.current;
    if (!el) return;
    const measure = () => setContentH(el.offsetHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // 찍을 때는 미리보기보다 몇 px 길게 나온다(글꼴·mm 반올림) - 3% 남겨 둔다. 못 넘기면 끝 칸(달·카드)이 통째로 다음 장으로 간다
  const zoom = fit && contentH > h * FIT_SLACK ? Math.floor(((h * FIT_SLACK) / contentH) * 1000) / 1000 : 1;
  const sheets = Math.max(1, Math.ceil((contentH * zoom - 1) / h));
  const Screen = SCREENS[page];

  return (
    <div
      data-print-sheet={start}
      data-print-sheets={sheets}
      data-print-zoom={zoom}
      className="relative shadow-md ring-1 ring-slate-300 overflow-hidden shrink-0"
      style={{ width: (w + margin * 2) * scale, height: (sheets * h + margin * 2) * scale, background: '#fff' }}
    >
      <div inert className="absolute top-0 left-0 origin-top-left pointer-events-none select-none" style={{ width: w + margin * 2, padding: margin, transform: `scale(${scale})` }}>
        <div ref={paperRef} data-print-paper className="@container" style={{ width: w, zoom }}>
          <h1 className="sp5-print-title">{title}</h1>
          <Screen printAt={start} />
        </div>
      </div>
      {Array.from({ length: sheets - 1 }, (_, i) => (
        <div key={i} className="absolute left-0 right-0 border-t-2 border-dashed border-slate-400" style={{ top: (margin + (i + 1) * h) * scale }}>
          <span className="absolute right-1 -top-4 text-2xs font-bold text-slate-400">{i + 2}장</span>
        </div>
      ))}
    </div>
  );
}
