// 🔗 링크 연결 창 (V4 components/LinkerModal.tsx). 창 'linker' = { sid, id } - 그 항목(또는 수업 'lesson:날짜:교시', 진도 차시 'progress:진도:행')에 잇는다.
//   진도 차시에서 열면 📝 메모 탭만 - 진도 쪽 그 행에만 적는다(P10-4 ■2).
//   - 탭 📌 일정 · 📝 메모 · 🏫 수업(P6-1 - 계산한 수업 칸 가운데 과목·비고가 있는 것, 항목에서 열 때만) · 📘 진도표(P11-1 - 메모에서 열 때만,
//     조회 범위 = 그 차시를 하는 날(수업 칸에 겹친 진도를 뒤집어 계산), 라벨 칩 대신 진도 칩. 저장은 진도 쪽 그 행에만 - 진도 창에서 메모를 잇는 것과 같다).
//     옛 📔 기록 탭은 📝 메모에 합쳤다(P10-4 5g - 메모 하나: 날짜 링크 메모와 날짜 없는 메모가 한 목록).
//   - 조회 범위(±1주일·±1개월·1학기·2학기·학년도·기간 설정 - 날짜를 고치면 기간 설정), 라벨 칩·키워드로 좁히고 ‹ ›로 쪽을 넘긴다.
//   - 누르면 🛒 담기(여러 개), 이미 이은 것은 '연결됨'. '+ 새 00 만들어 연결' = 같은 쓰는 칸을 열고, 처음 저장하면 담긴다.
//   - 연결 저장(Ctrl+S) = 양쪽 linkIds를 한 묶음으로 → 창을 닫는다(V4 10-07 - 열어 두면 링크 수가 바뀐 칸이 숨은 탭에 가려진다).
// 자료는 기기 사본에서 고른다(V4는 범위마다 서버를 읽었다 - 1년 범위면 1분 넘게 기다렸다).
import { useEffect, useMemo, useRef, useState } from 'react';
import { useCommonSettings } from '../../app/prefs';
import { showErrorToast, showToast } from '../../app/toast';
import type { WindowProps } from '../../app/windows';
import { labelColor } from '../../domain/labels';
import { academicYearOf, shortDateLabel, todayStr } from '../../domain/dateUtils';
import { lessonsOn } from '../../domain/lessons';
import { semesterConfigOf } from '../../domain/semester';
import { planLabel, sanitizePlan } from '../../domain/progress';
import { isLive, useDocs, useLabelTree } from '../../data/select';
import ModalShell, { ModalCloseButton } from '../../ui/ModalShell';
import { openEventPanel } from '../events/open';
import { useLessonSource } from '../lessons/useLessons';
import { useProgressMarks } from '../progress/useProgress';
import { openNotePanel } from '../notes/open';
import { saveLessonLinks, saveLinks, saveProgressLinks } from './actions';
import { candidatesOf, lessonCandidatesOf, progressCandidatesOf, RANGE_OPTIONS, rangeOf, type RangeKey } from './linkerList';
import {
  LINK_KIND_ICON,
  LINK_KIND_NAME,
  lessonEndOf,
  linkKindOf,
  parseLessonLink,
  parseProgressLink,
  progressEndOf,
  progressLinksByNote,
  type LessonEnd,
  type LinkKind,
  type ProgressEnd,
} from './linkOps';
import { listenLinkPick, type LinkWindowParams } from './open';

type LinkerTab = LinkKind | 'lesson' | 'progress';
const ITEM_TABS: LinkerTab[] = ['event', 'note'];
const PER_PAGE = 6;

export default function LinkerWindow({ params, close, raise }: WindowProps<LinkWindowParams>) {
  const { sid, id } = params;
  const items = useDocs('items', sid);
  const days = useDocs('lessonDays', sid);
  const progressDocs = useDocs('progress', sid);
  const lessonSrc = useLessonSource(sid);
  const terms = useCommonSettings((s) => s.terms);
  // 잇는 쪽: 항목 또는 수업 (수업에서 열면 수업 탭은 없다)
  const lessonEnd: LessonEnd | null = parseLessonLink(id) ? lessonEndOf(id, days) : null;
  const fromProgress = !!parseProgressLink(id);
  const progressEnd = fromProgress ? progressEndOf(id, progressDocs) : null;
  const source = !lessonEnd && !fromProgress && items[id] && !items[id].deletedAt ? items[id] : undefined;
  const center = source?.date ?? lessonEnd?.date ?? todayStr();
  const eventTree = useLabelTree('event', sid);
  const noteTree = useLabelTree('note', sid);
  // 📘 진도표는 메모에서만 (진도 차시 링크는 메모 ↔ 진도 - P10-4)
  const fromNote = !!source && linkKindOf(source) === 'note';
  const tabs: LinkerTab[] = fromProgress ? ['note'] : lessonEnd ? ITEM_TABS : [...ITEM_TABS, 'lesson', ...(fromNote ? (['progress'] as const) : [])];

  const [tab, setTab] = useState<LinkerTab>(fromProgress ? 'note' : 'event');
  const [rangeKey, setRangeKey] = useState<RangeKey>('1week');
  const [custom, setCustom] = useState({ start: center, end: center });
  const [labelIds, setLabelIds] = useState<string[]>([]);
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  /** 🛒 담은 것 (항목 id, 담은 차례) */
  const [picked, setPicked] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // '+ 새 00 만들어 연결' - 쓰는 칸이 처음 저장하면 여기로 돌아온다 (쪽지 = pickToken)
  const pickToken = useRef<string | undefined>(undefined);
  useEffect(() => {
    const { token, off } = listenLinkPick((made) => {
      setPicked((p) => (p.includes(made) ? p : [...p, made]));
      showToast("🔗 새 항목을 연결 목록에 담았습니다. '연결 저장'을 누르면 이어집니다.");
    });
    pickToken.current = token;
    return off;
  }, []);

  const range = rangeOf(rangeKey, center, custom, semesterConfigOf(terms, academicYearOf(center)));
  const { start, end } = range;
  // 진도 차시를 하는 날 (보는 범위의 끝까지 센다 - 개인 공간을 볼 때만, 하루·주간 수업 칸과 같은 셈)
  const { marks } = useProgressMarks(end);
  // 메모에 이은 진도 차시는 진도 쪽에만 적혀 있다 - 계산해 '연결됨'에 넣는다
  const progressByNote = useMemo(() => progressLinksByNote(progressDocs), [progressDocs]);
  const linkedIds = lessonEnd ? lessonEnd.linkIds : progressEnd ? progressEnd.linkIds : source?.linkIds;
  const sourceProgress = source ? progressByNote.get(source.id) : undefined;
  const linked = useMemo(() => new Set([...(linkedIds ?? []), ...(sourceProgress ?? [])]), [linkedIds, sourceProgress]);
  const list = useMemo(
    () =>
      tab === 'lesson'
        ? lessonCandidatesOf(lessonSrc, { start, end }, keyword)
        : tab === 'progress'
          ? progressCandidatesOf(progressDocs, marks, { start, end }, { planIds: labelIds, keyword })
          : candidatesOf(items, tab, { start, end }, { labelIds, keyword, exclude: id }),
    [items, lessonSrc, progressDocs, marks, tab, start, end, labelIds, keyword, id],
  );
  const pages = Math.max(1, Math.ceil(list.length / PER_PAGE));
  const current = Math.min(page, pages);
  const shown = list.slice((current - 1) * PER_PAGE, current * PER_PAGE);
  const tabLabels = tab === 'lesson' || tab === 'progress' ? [] : (tab === 'event' ? eventTree : noteTree).list;
  // 📘 진도표 탭은 라벨 대신 진도 칩 (라벨 고르기 칸 labelIds에 진도 id를 담는다 - 탭을 바꾸면 비운다)
  const planChips = useMemo(
    () =>
      tab !== 'progress'
        ? []
        : Object.values(progressDocs)
            .filter(isLive)
            .map((d) => ({ id: d.id, name: planLabel(sanitizePlan(d.id, d)) }))
            .sort((a, b) => a.name.localeCompare(b.name, 'ko')),
    [tab, progressDocs],
  );
  /** 담은 진도 차시 한 줄 ('과학 5차시 · 비유 표현') */
  const progressText = (pid: string) => progressEndOf(pid, progressDocs)?.title ?? '불러오는 중…';
  /** 수업 칸 한 줄 ('[10/9] 3교시 국어') */
  const lessonText = (lessonId: string) => {
    const p = parseLessonLink(lessonId);
    if (!p) return '';
    const c = lessonsOn(p.date, lessonSrc).cells.find((x) => x.n === p.period);
    return `[${shortDateLabel(p.date)}] ${p.period}교시 ${c?.subject || '수업'}`;
  };

  const toggle = (itemId: string) => {
    if (linked.has(itemId)) return;
    setPicked((p) => (p.includes(itemId) ? p.filter((x) => x !== itemId) : [...p, itemId]));
  };

  // 새 메모는 날짜 없이 - 이으면 잇는 쪽(일정·수업)의 날 메모 칸에 저절로 보인다(P10-4 ■1)
  const makeNew = () => {
    const pickFor = pickToken.current;
    if (tab === 'note') openNotePanel({ sid, date: null, pickFor });
    else openEventPanel({ sid, date: center, pickFor });
  };

  const save = async () => {
    if (!source && !lessonEnd && !progressEnd) {
      showErrorToast('연결할 항목을 찾지 못했습니다. 그 사이 지워졌을 수 있습니다.');
      return;
    }
    const targets = picked.map((p) => items[p]).filter((d) => d && !d.deletedAt);
    const lessons = picked.map((p) => lessonEndOf(p, days)).filter((l): l is LessonEnd => !!l);
    const progress = source ? picked.map((p) => progressEndOf(p, progressDocs)).filter((e): e is ProgressEnd => !!e) : [];
    if (targets.length === 0 && lessons.length === 0 && progress.length === 0) {
      showToast('연결할 항목을 골라 주세요.');
      return;
    }
    if (saving) return;
    setSaving(true);
    try {
      if (progressEnd) await saveProgressLinks(sid, progressEnd, targets);
      else if (lessonEnd) await saveLessonLinks(sid, lessonEnd, targets);
      else if (source) await saveLinks(sid, source, targets, lessons, progress);
      close();
    } catch {
      // 안내는 저장 도우미가 했다 - 담은 것은 그대로
    } finally {
      setSaving(false);
    }
  };

  const chip = (on: boolean) =>
    `px-2.5 py-1 rounded-full text-xs font-bold border transition-colors cursor-pointer ${on ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'}`;

  return (
    <ModalShell
      isOpen
      onClose={close}
      raise={raise}
      width="xl"
      title="🔗 새 데이터 연결하기 (여러 개 고르기)"
      onSave={() => void save()}
      footer={
        <>
          <ModalCloseButton onClose={close} />
          <button
            type="button"
            data-linker-save
            onClick={() => void save()}
            disabled={saving}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-xl text-xs font-bold transition-colors shadow-xs cursor-pointer"
          >
            연결 저장
          </button>
        </>
      }
    >
      <div data-linker={id} className="flex flex-col gap-4">
        {source && (
          <p className="text-xs text-slate-500 truncate" data-linker-source>
            {LINK_KIND_ICON[linkKindOf(source)]} {source.text.split('\n')[0] || '(내용 없음)'} 에 잇습니다
          </p>
        )}
        {lessonEnd && (
          <p className="text-xs text-slate-500 truncate" data-linker-source>
            {LINK_KIND_ICON.lesson} {lessonText(lessonEnd.id)} 에 잇습니다
          </p>
        )}
        {progressEnd && (
          <p className="text-xs text-slate-500 truncate" data-linker-source>
            📘 {progressEnd.title} 에 잇습니다 - 이 차시를 하는 모든 수업 칸과 그날 메모 칸에 보입니다
          </p>
        )}
        <div className="flex gap-2 border-b border-slate-200 pb-2">
          {tabs.map((k) => (
            <button
              key={k}
              type="button"
              data-linker-tab={k}
              aria-pressed={tab === k}
              onClick={() => {
                setTab(k);
                setPage(1);
                // 탭마다 라벨 종류가 다르다 - 고른 라벨을 비운다 (다른 종류 라벨이 걸린 채 목록이 비어 보이지 않게)
                setLabelIds([]);
              }}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                tab === k ? 'bg-blue-50 text-blue-700 border border-blue-300 shadow-2xs' : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-transparent'
              }`}
            >
              {LINK_KIND_ICON[k]} {LINK_KIND_NAME[k]}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-slate-600 shrink-0">조회 범위:</span>
            <select
              data-linker-range
              value={rangeKey}
              onChange={(e) => {
                const key = e.target.value as RangeKey;
                // 기간 설정으로 바꾸면 지금 보이는 날짜에서 시작한다
                if (key === 'custom') setCustom(range);
                setRangeKey(key);
                setPage(1);
              }}
              className="px-1.5 py-1 border border-slate-300 rounded-lg text-xs font-bold text-slate-700 bg-white shrink-0"
            >
              {RANGE_OPTIONS.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
            {/* 고른 범위의 날짜를 보여 주고 그 자리에서 고친다 - 고치면 '기간 설정' */}
            {(['start', 'end'] as const).map((edge) => (
              <input
                key={edge}
                type="date"
                aria-label={edge === 'start' ? '시작 날짜' : '끝 날짜'}
                data-linker-date={edge}
                value={range[edge]}
                onChange={(e) => {
                  if (!e.target.value) return;
                  setCustom({ ...range, [edge]: e.target.value });
                  setRangeKey('custom');
                  setPage(1);
                }}
                className="px-1.5 py-1 border border-slate-300 rounded-lg text-xs text-slate-700 bg-white"
              />
            ))}
          </div>
          {planChips.length > 0 && (
            <div className="flex flex-wrap gap-1.5" data-linker-plans>
              <button type="button" data-linker-plan="all" onClick={() => setLabelIds([])} className={chip(labelIds.length === 0)}>
                전체
              </button>
              {planChips.map((p) => {
                const on = labelIds.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    data-linker-plan={p.id}
                    aria-pressed={on}
                    onClick={() => {
                      setLabelIds((x) => (on ? x.filter((y) => y !== p.id) : [...x, p.id]));
                      setPage(1);
                    }}
                    className={chip(on)}
                  >
                    📘 {p.name}
                  </button>
                );
              })}
            </div>
          )}
          {tabLabels.length > 0 && (
            <div className="flex flex-wrap gap-1.5" data-linker-labels>
              <button type="button" data-linker-label="all" onClick={() => setLabelIds([])} className={chip(labelIds.length === 0)}>
                전체
              </button>
              {tabLabels.map((l) => {
                const on = labelIds.includes(l.id);
                const c = labelColor(l.color);
                return (
                  <button
                    key={l.id}
                    type="button"
                    data-linker-label={l.id}
                    aria-pressed={on}
                    onClick={() => {
                      setLabelIds((p) => (on ? p.filter((x) => x !== l.id) : [...p, l.id]));
                      setPage(1);
                    }}
                    className={chip(on)}
                    style={on ? undefined : { color: c.text }}
                  >
                    {l.name}
                  </button>
                );
              })}
            </div>
          )}
          <input
            type="text"
            data-linker-keyword
            placeholder="키워드로 목록 내 검색..."
            value={keyword}
            onChange={(e) => {
              setKeyword(e.target.value);
              setPage(1);
            }}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          {tab !== 'lesson' && tab !== 'progress' && (
            <button
              type="button"
              data-linker-new={tab}
              onClick={makeNew}
              className="w-full px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors shadow-xs cursor-pointer"
            >
              + 새 {LINK_KIND_NAME[tab]} 만들어 연결
            </button>
          )}
        </div>

        <div className="border border-slate-200 rounded-xl bg-white overflow-hidden flex flex-col" data-linker-list={list.length}>
          {list.length === 0 ? (
            <div className="h-[152px] flex items-center justify-center text-xs text-slate-400 text-center px-4" data-linker-empty>
              {tab === 'progress' && planChips.length === 0
                ? '진도표가 없습니다. 하루 수업 칸의 📘 진도에서 만들 수 있습니다.'
                : tab === 'progress'
                  ? '이 범위에 하는 차시가 없습니다. 조회 범위를 넓혀 보세요.'
                  : '해당 조건에 맞는 데이터가 없습니다.'}
            </div>
          ) : (
            <>
              <div className="min-h-[152px] divide-y divide-slate-100">
                {shown.map((c) => {
                  const already = linked.has(c.id);
                  const on = already || picked.includes(c.id);
                  return (
                    <button
                      type="button"
                      key={c.id}
                      data-linker-item={c.id}
                      aria-pressed={on}
                      disabled={already}
                      onClick={() => toggle(c.id)}
                      className="w-full flex items-center px-4 py-2 hover:bg-slate-50 disabled:hover:bg-white text-left cursor-pointer disabled:cursor-default"
                    >
                      <input type="checkbox" checked={on} readOnly tabIndex={-1} className="w-4 h-4 rounded border-slate-300 pointer-events-none mr-3 shrink-0" />
                      {c.date && <span className="text-xs text-slate-400 shrink-0 whitespace-nowrap font-medium mr-2">{c.date}</span>}
                      <span className="text-xs text-slate-800 font-medium truncate flex-1" title={c.text}>
                        {c.text.split('\n')[0] || '(표·첨부만)'}
                      </span>
                      {already && <span className="text-2xs font-bold text-slate-400 shrink-0 ml-2">연결됨</span>}
                    </button>
                  );
                })}
              </div>
              {pages > 1 && (
                <div className="p-2 bg-slate-50 border-t border-slate-100 flex justify-center items-center gap-1" data-linker-pages={pages}>
                  <button
                    type="button"
                    data-linker-prev
                    onClick={() => setPage(Math.max(1, current - 1))}
                    disabled={current === 1}
                    title="앞 쪽"
                    className="px-2 py-1 rounded text-xs font-bold bg-white text-slate-600 border border-slate-200 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                  >
                    ‹
                  </button>
                  <span className="px-2 text-xs font-bold text-slate-600" data-linker-page={current}>
                    {current} / {pages}
                  </span>
                  <button
                    type="button"
                    data-linker-next
                    onClick={() => setPage(Math.min(pages, current + 1))}
                    disabled={current === pages}
                    title="다음 쪽"
                    className="px-2 py-1 rounded text-xs font-bold bg-white text-slate-600 border border-slate-200 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                  >
                    ›
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* 🛒 담은 것 */}
        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl" data-linker-tray={picked.length}>
          <div className="font-bold text-xs text-slate-700 mb-2 flex items-center gap-1.5">
            <span>🛒 선택된 연결 항목</span>
            <span className="bg-blue-100 text-blue-700 px-1.5 rounded-full text-xs">{picked.length}</span>
          </div>
          <div className="flex flex-wrap gap-1.5 min-h-[30px] items-center">
            {picked.length === 0 ? (
              <span className="text-xs text-slate-400">선택된 항목이 없습니다.</span>
            ) : (
              picked.map((p) => {
                const d = items[p];
                const isLesson = !!parseLessonLink(p);
                const isProgress = !!parseProgressLink(p);
                const kind: LinkerTab = isLesson ? 'lesson' : isProgress ? 'progress' : d ? linkKindOf(d) : 'note';
                return (
                  <span key={p} data-linker-picked={p} className="inline-flex items-center bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-lg text-xs text-blue-900 font-medium">
                    <span className="mr-1">{LINK_KIND_ICON[kind]}</span>
                    <span className="max-w-[130px] truncate font-bold">
                      {isLesson ? lessonText(p) : isProgress ? progressText(p) : d ? d.text.split('\n')[0] || '(표·첨부만)' : '불러오는 중…'}
                    </span>
                    <button
                      type="button"
                      data-linker-unpick={p}
                      onClick={() => setPicked((x) => x.filter((y) => y !== p))}
                      className="ml-1.5 text-rose-500 hover:text-rose-700 font-bold cursor-pointer"
                      title="빼기"
                      aria-label="빼기"
                    >
                      ✕
                    </button>
                  </span>
                );
              })
            )}
          </div>
        </div>
      </div>
    </ModalShell>
  );
}
