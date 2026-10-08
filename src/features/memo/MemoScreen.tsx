// 메모 화면 (V4 features/memo/MemoScreen.tsx·MemoCard.tsx). 날짜 없는 메모(date: null)를 모아 둔다.
//
// - 왼쪽: '+ 새 메모'와 '📁 라벨로 보기'(⭐ 즐겨찾기 → 라벨(트리 차례) → 전체 메모). 라벨은 여러 개 고르기(LabelFilterChips - 하루 기록 칸과 같은 부품).
//   고른 것은 이 기기에 기억한다(features/notes/labelFilter). 처음은 즐겨찾기 - 즐겨찾기한 메모가 하나도 없으면 화면을 열 때 전체로(빈 화면 대신, V4).
//   옆 숫자는 진행 중 메모 수. ESC = 고른 라벨 모두 떼기(오른쪽 칸도 함께 닫힌다).
// - 오른쪽: 진행 / 완료 두 구역(제목을 누르면 접고 편다). 카드는 가장 짧은 열부터 쌓는다(ui/Masonry - 칸 폭으로 2~4열, 휴대폰도 2열).
//   즐겨찾기가 맨 위. 카드는 기록과 같은 EntryCard(완료·★·▲▼·체크 줄·접기·✏️·🗑️).
// - 완료 구역 '🗑️ 전체 비우기' = 지운 표시 여럿 한 묶음 + 안내의 되돌리기(V4는 묻고 휴지통으로).
// - 라벨이 없는 메모가 있으면 위에 안내 - '메모' 라벨 붙이기(라벨로 보기에서도 찾게, V4).
import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react';
import { addEscapeAction } from '../../app/keys';
import { openWindow } from '../../app/windows';
import { isLongEntry } from '../../domain/entryCollapse';
import { isEmptyFilter, isOtherKey, labelPath, matchLabels, otherParentOf, pruneFilter, type LabelFilter } from '../../domain/labelTree';
import { itemLabels, useLabelTree, useMemos, useMirrorStatus } from '../../data/select';
import { useCurrentSpaceId } from '../../data/session';
import Masonry from '../../ui/Masonry';
import { useIsMobile } from '../../ui/useIsMobile';
import type { ItemDoc } from '../events/eventOps';
import { deleteNote, deleteNotes, labelNotes, moveNoteInList, setNoteDone, setNoteFavorite, toggleNoteCheckLine } from '../notes/actions';
import EntryCard from '../notes/EntryCard';
import LabelFilterChips, { FILTER_HELP, FilterChip } from '../notes/LabelFilterChips';
import { setMemoFilter, useLabelFilters, type MemoFilter } from '../notes/labelFilter';
import { canMoveNote, favoriteFirst } from '../notes/noteOps';
import { openNotePanel, useEditingNoteIds } from '../notes/open';

/** 라벨 없는 메모에 붙여 주는 라벨 (V4 그대로) */
const FALLBACK_LABEL = '메모';
/** 카드 한 장이 이보다 좁아지면 열을 줄인다. 휴대폰에서도 두 열은 지킨다 */
const MIN_CARD_WIDTH = 170;
const MIN_COLUMNS = 2;
const MAX_COLUMNS = 4;

const quiet = () => {
  /* 실패 안내는 저장 도우미가 이미 했다 */
};

/** 목록 칸의 실제 폭으로 열 수 (왼쪽 라벨 칸이 있어 화면 폭이 아니라 칸 폭을 잰다 - V4) */
function useColumnCount(ref: React.RefObject<HTMLElement | null>) {
  const [count, setCount] = useState(MIN_COLUMNS);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([entry]) => {
      const fit = Math.floor((entry.contentRect.width + 16) / (MIN_CARD_WIDTH + 16));
      setCount(Math.min(MAX_COLUMNS, Math.max(MIN_COLUMNS, fit)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return count;
}

/** 'n월 n일 오후 3:20' (V4 MemoCard) */
const createdText = (ms: number | undefined) =>
  ms ? new Date(ms).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

/** 기록에서 날짜를 빼 메모가 되었으면 '📅 10/6에서' */
const fromNote = (d: string | undefined) => {
  if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return undefined;
  const [, m, day] = d.split('-').map(Number);
  return `📅 ${m}/${day}에서`;
};

export default function MemoScreen() {
  const sid = useCurrentSpaceId();
  const memos = useMemos();
  const tree = useLabelTree('note');
  const status = useMirrorStatus('items');
  const labelStatus = useMirrorStatus('labels');
  const editing = useEditingNoteIds(sid);
  const remembered = useLabelFilters((s) => s.memo);
  const loaded = status !== 'idle' && status !== 'loading';
  const isMobile = useIsMobile();
  const listRef = useRef<HTMLElement>(null);
  const columns = useColumnCount(listRef);
  const [activeOpen, setActiveOpen] = useState(true);
  const [doneOpen, setDoneOpen] = useState(true);
  const [cardCollapsed, setCardCollapsed] = useState<Record<string, boolean>>({});

  // 즐겨찾기가 하나도 없으면 즐겨찾기 대신 전체로 연다 - 메모를 받은 뒤 화면을 열 때 한 번만 정한다
  // (보던 중에 마지막 ☆를 떼도 화면이 바뀌지 않고, 기억한 것도 그대로라 ☆를 붙이면 다음에는 즐겨찾기로 - V4)
  const [noFavOnOpen, setNoFavOnOpen] = useState<boolean | null>(null);
  if (noFavOnOpen === null && loaded) setNoFavOnOpen(!memos.some((m) => m.favorite));

  const favOrAll: 'fav' | 'all' = noFavOnOpen ? 'all' : 'fav';
  const current: MemoFilter = (() => {
    const f = remembered ?? 'fav';
    if (f === 'all') return f;
    if (f === 'fav') return favOrAll;
    // 라벨을 아직 못 받았으면 판단을 미룬다(없는 라벨로 단정하지 않는다)
    if (labelStatus === 'idle' || labelStatus === 'loading') return f;
    const pruned = pruneFilter(f, tree.list.map((l) => l.id));
    return isEmptyFilter(pruned) ? favOrAll : pruned;
  })();
  const labelFilter: LabelFilter | null = typeof current === 'string' ? null : current;
  const choose = (f: MemoFilter) => {
    // 손으로 고른 것은 그대로 보인다(즐겨찾기가 없어도 ⭐를 누르면 빈 즐겨찾기와 안내)
    setNoFavOnOpen(false);
    setMemoFilter(typeof f !== 'string' && isEmptyFilter(f) ? 'all' : f);
  };

  // ESC: 고른 라벨을 모두 뗀다 (오른쪽 칸·창은 키 처리 한 곳이 함께 닫는다)
  useEffect(
    () =>
      addEscapeAction(() => {
        const f = useLabelFilters.getState().memo;
        if (f && typeof f !== 'string') setMemoFilter('all');
      }),
    [],
  );

  const matches = (m: ItemDoc, f: MemoFilter) => (f === 'all' ? true : f === 'fav' ? !!m.favorite : matchLabels(m.labelIds, f, tree.parents));
  const shown = favoriteFirst(memos.filter((m) => matches(m, current)));
  const active = shown.filter((m) => !m.done);
  const done = shown.filter((m) => m.done);
  const allActive = memos.filter((m) => !m.done);
  const countOf = (key: string) =>
    allActive.filter((m) => matchLabels(m.labelIds, isOtherKey(key) ? { labels: [], others: [otherParentOf(key)] } : { labels: [key], others: [] }, tree.parents)).length;

  const unlabeled = memos.filter((m) => itemLabels(tree, m.labelIds).length === 0);
  const [busy, setBusy] = useState(false);
  const run = async (job: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try {
      await job();
    } catch {
      quiet();
    } finally {
      setBusy(false);
    }
  };

  const openCreate = () => sid && openNotePanel({ sid, date: null, ...(labelFilter?.labels[0] ? { labelIds: [labelFilter.labels[0]] } : {}) });
  const pathOf = (id: string) => labelPath(id, tree.parents, (x) => tree.byId.get(x)?.name);

  const grid = (list: ItemDoc[]) => (
    <Masonry
      items={list}
      getKey={(m) => m.id}
      columns={columns}
      gap={isMobile ? 8 : 16}
      renderItem={(m) => {
        const i = list.indexOf(m);
        const isCollapsed = cardCollapsed[m.id] ?? isLongEntry(m.text);
        return (
          <EntryCard
            item={m}
            labels={itemLabels(tree, m.labelIds)}
            pathOf={pathOf}
            dateText={createdText(m.createdAt)}
            note={fromNote(m.fromDate)}
            editing={editing.has(m.id)}
            collapsed={isCollapsed}
            onToggleCollapse={() => setCardCollapsed((prev) => ({ ...prev, [m.id]: !isCollapsed }))}
            onMoveUp={sid && canMoveNote(list, i, -1) ? () => void moveNoteInList(sid, list, i, -1).catch(quiet) : undefined}
            onMoveDown={sid && canMoveNote(list, i, 1) ? () => void moveNoteInList(sid, list, i, 1).catch(quiet) : undefined}
            onOpen={() => sid && openNotePanel({ sid, date: null, id: m.id })}
            onToggleDone={() => sid && void setNoteDone(sid, m, !m.done).catch(quiet)}
            onToggleFavorite={() => sid && void setNoteFavorite(sid, m, !m.favorite).catch(quiet)}
            onDelete={() => sid && void deleteNote(sid, m).catch(quiet)}
            onToggleCheckLine={(idx, line) => (sid ? toggleNoteCheckLine(sid, m, idx, line) : Promise.resolve(false))}
          />
        );
      }}
    />
  );

  const sectionTitle = (key: 'active' | 'done', text: ReactNode, open: boolean, toggle: () => void) => (
    <button
      type="button"
      data-memo-section-toggle={key}
      onClick={toggle}
      aria-expanded={open}
      className="flex items-center gap-1.5 px-1 text-sm sm:text-base font-extrabold text-slate-900 cursor-pointer select-none"
    >
      <span>{text}</span>
      <span className="text-xs text-slate-400">{open ? '▲' : '▼'}</span>
    </button>
  );

  const specialChip = (key: 'fav' | 'all', text: string, cls: string, title: string) => (
    <FilterChip
      chipKey={key}
      text={text}
      title={title}
      count={key === 'fav' ? allActive.filter((m) => m.favorite).length : allActive.length}
      selected={current === key}
      selectedClass={cls}
      onClick={(_e: ReactMouseEvent) => choose(key)}
    />
  );

  return (
    <div data-screen="memo" data-memo-screen className="animate-fade-in pb-12 flex flex-col gap-3 sm:gap-5">
      <div className="flex items-start gap-2 sm:gap-4">
        {/* 왼쪽 칸: 목록이 길어도 머리줄 바로 아래 멈춰 서고, 라벨이 많으면 그 안에서만 스크롤 (V4) */}
        <div className="w-29 sm:w-44 shrink-0 flex flex-col gap-2 sm:gap-3 sticky top-[calc(var(--app-header-h,64px)+12px)] max-h-[calc(100dvh-var(--app-header-h,64px)-96px)] sm:max-h-[calc(100dvh-var(--app-header-h,64px)-32px)]">
          <button
            type="button"
            data-memo-new
            onClick={openCreate}
            className="w-full flex items-center justify-center gap-1 sm:gap-1.5 px-2 py-2 sm:py-2.5 bg-primary hover:bg-blue-600 active:scale-98 text-white rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold shadow-sm hover:shadow-md transition-all cursor-pointer shrink-0"
            title="새 메모 쓰기 (오른쪽 칸)"
          >
            <span className="font-extrabold leading-none">+</span>
            <span>새 메모</span>
          </button>
          <nav
            data-memo-filter-nav
            aria-label="메모 라벨로 보기"
            className="min-h-0 flex flex-col gap-2 sm:gap-1.5 bg-white rounded-2xl border border-slate-200/80 shadow-xs p-1.5 sm:p-3 overflow-y-auto overscroll-contain"
          >
            <div className="sticky -top-1.5 sm:-top-3 z-10 -mt-1.5 sm:-mt-3 pt-1.5 sm:pt-3 bg-white flex items-center justify-between gap-1 text-xs font-extrabold text-blue-800 border-b-2 border-slate-100 pb-1.5 mb-0.5 px-0.5">
              <span>
                📁 라벨<span className="hidden sm:inline">로 보기</span>
                <span data-filter-help title={FILTER_HELP} className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-slate-100 text-slate-500 text-2xs cursor-help align-middle">
                  ?
                </span>
              </span>
              <button
                type="button"
                data-memo-labels-settings
                onClick={() => openWindow('labels', { tab: 'note' })}
                className="w-6 h-6 flex items-center justify-center rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-100 cursor-pointer shrink-0"
                title="메모·기록 라벨 설정"
                aria-label="메모·기록 라벨 설정"
              >
                ⚙️
              </button>
            </div>
            {specialChip('fav', '⭐ 즐겨찾기', 'bg-amber-100 text-amber-900 border-amber-300', '즐겨찾기한 메모만 보기')}
            <LabelFilterChips tree={tree} filter={labelFilter ?? { labels: [], others: [] }} onChange={(f) => choose(f)} countOf={countOf} />
            {specialChip('all', '전체 메모', 'bg-slate-800 text-white border-slate-800', '모든 메모 보기')}
          </nav>
        </div>

        <section ref={listRef} className="flex-1 min-w-0 bg-white rounded-2xl border border-slate-200/80 shadow-xs p-2 sm:p-5">
          {!loaded && memos.length === 0 ? (
            <p data-memo-waiting className="py-24 text-center text-xs text-slate-400">
              메모를 받는 중…
            </p>
          ) : (
            <>
              {unlabeled.length > 0 && (
                <div data-memo-unlabeled={unlabeled.length} className="flex items-center justify-between gap-2 flex-wrap mb-3 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
                  <span className="font-bold">🏷️ 라벨이 없는 메모 {unlabeled.length}개</span>
                  <button
                    type="button"
                    data-memo-label-unlabeled
                    disabled={busy}
                    onClick={() => sid && void run(() => labelNotes(sid, unlabeled, FALLBACK_LABEL, tree))}
                    title={`라벨이 없는 메모(완료된 것 포함)에 '${FALLBACK_LABEL}' 라벨을 붙여 라벨로 보기에서도 찾게 합니다`}
                    className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold cursor-pointer disabled:opacity-50"
                  >
                    &apos;{FALLBACK_LABEL}&apos; 라벨 붙이기
                  </button>
                </div>
              )}

              <div className="mb-2 sm:mb-3" data-memo-active={active.length}>
                {sectionTitle('active', `진행 (${active.length})`, activeOpen, () => setActiveOpen(!activeOpen))}
              </div>
              {activeOpen &&
                (active.length > 0 ? (
                  grid(active)
                ) : (
                  <p data-memo-empty className="text-center text-slate-400 text-sm py-6">
                    {current === 'fav' ? '즐겨찾기한 메모가 없습니다. 메모의 ☆를 눌러 놓으면 여기 모입니다.' : '조건에 맞는 메모가 없습니다.'}
                  </p>
                ))}

              <div data-memo-done={done.length} className="flex items-center justify-between gap-2 mt-6 sm:mt-8 mb-2 sm:mb-3 pb-1.5 border-b-2 border-slate-100">
                {sectionTitle('done', `완료 (${done.length})`, doneOpen, () => setDoneOpen(!doneOpen))}
                {done.length > 0 && (
                  <button
                    type="button"
                    data-memo-clear-done
                    disabled={busy}
                    onClick={() => sid && void run(() => deleteNotes(sid, done))}
                    className="px-2 sm:px-2.5 py-1 bg-rose-500 hover:bg-rose-600 text-white rounded-lg text-xs font-bold cursor-pointer shrink-0 disabled:opacity-50"
                    title="완료된 메모 모두 삭제 (안내의 되돌리기로 되살립니다)"
                  >
                    🗑️<span className="hidden sm:inline"> 전체 비우기</span>
                  </button>
                )}
              </div>
              {doneOpen &&
                (done.length > 0 ? grid(done) : <p className="text-center text-slate-400 text-sm py-4">아직 완료된 항목이 없습니다.</p>)}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
