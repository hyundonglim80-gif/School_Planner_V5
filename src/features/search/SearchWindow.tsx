// 검색 (V4 components/SearchModal.tsx) - 맨 위 🔍·단축키 'search'. 창 'search'(오른쪽 칸).
//   - 기기 사본에서 **치는 대로** 찾는다(V4는 '데이터 찾기'를 눌러 기간마다 서버를 읽었다). 검색어를 비우면 고른 기간의 모든 것.
//   - 갈래(여러 개)·기간(보고 있는 날 기준)·라벨로 거른다. 결과는 50개씩(더 보기).
//   - 결과를 누르면 그 자리(그날 하루 화면·메모 화면)로 가서 찾은 카드를 짚는다(features/search/focus). 오른쪽 칸이라 검색 창은 그대로 -
//     휴대폰은 화면을 덮으므로 닫는다. ✏️는 그 항목의 쓰는 칸, 📎는 그 파일을 연다.
//   - 수업·수업 메모·비고는 P6-1, 조사표명은 P7-4가 갈래를 더한다.
import { useDeferredValue, useMemo, useState } from 'react';
import { setDate, setScope, useNav } from '../../app/nav';
import type { WindowProps } from '../../app/windows';
import { isEmptyFilter, matchLabels } from '../../domain/labelTree';
import { labelColor } from '../../domain/labels';
import { scopeRange, SEARCH_KINDS, SEARCH_SCOPES, searchItems, type SearchHit, type SearchKind, type SearchScope } from '../../domain/search';
import { itemLabels, useDocs, useLabelTree, type LabelTree } from '../../data/select';
import { useCurrentSpaceId } from '../../data/session';
import ModalShell, { ModalCloseButton } from '../../ui/ModalShell';
import { useIsMobile } from '../../ui/useIsMobile';
import type { ItemDoc } from '../events/eventOps';
import { openEventPanel } from '../events/open';
import { setJournalFilter, setMemoFilter, useLabelFilters } from '../notes/labelFilter';
import { openNotePanel } from '../notes/open';
import { requestFocus } from './focus';

const PAGE_SIZE = 50;

const BADGES: Record<SearchKind, { text: string; className: string }> = {
  memo: { text: '메모', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  event: { text: '일정', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  journal: { text: '기록', className: 'bg-purple-50 text-purple-700 border-purple-200' },
  attachment: { text: '첨부파일', className: 'bg-rose-50 text-rose-700 border-rose-200' },
};
const WHERE: Record<Exclude<SearchKind, 'attachment'>, string> = { memo: '메모', event: '일정', journal: '기록' };

const md = (d: string) => `${Number(d.slice(5, 7))}.${Number(d.slice(8, 10))}`;

function titleOf(hit: SearchHit<ItemDoc>): string {
  const it = hit.item;
  const when = hit.kind === 'memo' || hit.where === 'memo' ? (hit.date ? `${hit.date} 만듦` : '만든 날 모름') : it.endDate ? `${it.date} ~ ${md(it.endDate)}` : (hit.date ?? '');
  if (hit.kind === 'attachment') return `첨부 · ${WHERE[hit.where!]} (${when})`;
  return when;
}

/** 이 라벨이 붙었나 (메모·기록 라벨은 상위를 고르면 하위도) */
function hasLabel(item: ItemDoc, labelId: string, eventTree: LabelTree, noteTree: LabelTree): boolean {
  if (eventTree.byId.has(labelId)) return !!item.labelIds?.includes(labelId);
  return matchLabels(item.labelIds, { labels: [labelId], others: [] }, noteTree.parents);
}

export default function SearchWindow({ close, raise }: WindowProps) {
  const sid = useCurrentSpaceId();
  const date = useNav((s) => s.date);
  const items = useDocs('items', sid);
  const eventTree = useLabelTree('event', sid);
  const noteTree = useLabelTree('note', sid);
  const isMobile = useIsMobile();
  const [keyword, setKeyword] = useState('');
  const term = useDeferredValue(keyword);
  const [kinds, setKinds] = useState<ReadonlySet<SearchKind>>(new Set());
  const [scope, setScopeState] = useState<SearchScope>('all');
  const [custom, setCustom] = useState({ start: '', end: '' });
  const [labelId, setLabelId] = useState('');
  const [visible, setVisible] = useState(PAGE_SIZE);

  const range = scopeRange(scope, date, custom);
  const rangeKey = range ? `${range.start}~${range.end}` : '';
  const hits = useMemo(() => {
    const live = Object.values(items).filter((d) => !d.deletedAt);
    const found = searchItems(live, { term, kinds, range: rangeKey ? { start: rangeKey.split('~')[0], end: rangeKey.split('~')[1] } : null });
    return labelId ? found.filter((h) => hasLabel(h.item, labelId, eventTree, noteTree)) : found;
  }, [items, term, kinds, rangeKey, labelId, eventTree, noteTree]);

  const toggleKind = (k: SearchKind | 'all') => {
    setVisible(PAGE_SIZE);
    if (k === 'all') return setKinds(new Set());
    const next = new Set(kinds);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    setKinds(next.size === SEARCH_KINDS.length ? new Set() : next);
  };

  /** 그 자리로 가서 짚는다 (거르개에 가려 있으면 푼다) */
  const go = (hit: SearchHit<ItemDoc>) => {
    const it = hit.item;
    if (it.kind === 'event' && it.date) {
      setDate(hit.date ?? it.date);
      setScope('day');
      requestFocus({ id: it.id, kind: 'event', date: hit.date ?? it.date });
    } else if (it.kind === 'note' && it.date) {
      const f = useLabelFilters.getState().journal;
      if (!isEmptyFilter(f) && !matchLabels(it.labelIds, f, noteTree.parents)) setJournalFilter({ labels: [], others: [] });
      setDate(it.date);
      setScope('day');
      requestFocus({ id: it.id, kind: 'note', date: it.date });
    } else if (it.kind === 'note') {
      const f = useLabelFilters.getState().memo;
      const shown = f === 'all' || (f !== null && f !== 'fav' ? matchLabels(it.labelIds, f, noteTree.parents) : !!it.favorite);
      if (!shown) setMemoFilter('all');
      setScope('memo');
      requestFocus({ id: it.id, kind: 'note', date: null });
    }
    if (isMobile) close();
  };
  const edit = (hit: SearchHit<ItemDoc>) => {
    if (!sid) return;
    const it = hit.item;
    if (it.kind === 'event') openEventPanel({ sid, date: hit.date ?? it.date ?? date, id: it.id });
    else openNotePanel({ sid, date: it.date ?? null, id: it.id });
  };

  const labelOptions = [...eventTree.rows.map((r) => ({ id: r.id, name: `📅 ${eventTree.byId.get(r.id)?.name ?? ''}` })), ...noteTree.rows.map((r) => ({ id: r.id, name: `📝 ${r.depth ? '└ ' : ''}${noteTree.byId.get(r.id)?.name ?? ''}` }))];

  return (
    <ModalShell isOpen onClose={close} raise={raise} width="2xl" title="🔍 검색" footer={<ModalCloseButton onClose={close} />}>
      <div className="space-y-3" data-search-window>
        <input
          type="search"
          data-search-input
          value={keyword}
          onChange={(e) => {
            setKeyword(e.target.value);
            setVisible(PAGE_SIZE);
          }}
          placeholder="치는 대로 찾습니다 (비우면 고른 기간의 모든 것)"
          autoFocus
          className="w-full px-3 py-2.5 text-sm font-bold bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/40"
        />

        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-col gap-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-bold text-slate-700 mr-1">검색 항목</span>
            {[{ id: 'all' as const, label: '전체' }, ...SEARCH_KINDS].map((opt) => {
              const on = opt.id === 'all' ? kinds.size === 0 : kinds.size === 0 || kinds.has(opt.id);
              return (
                <button
                  key={opt.id}
                  type="button"
                  data-search-kind={opt.id}
                  aria-pressed={on}
                  onClick={() => toggleKind(opt.id)}
                  className={`px-3 py-1 text-xs font-bold rounded-lg border transition-all cursor-pointer ${on ? 'bg-primary text-white border-primary shadow-xs' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'}`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <span className="text-xs font-bold text-slate-700">기간</span>
            <select
              data-search-scope
              value={scope}
              onChange={(e) => {
                setScopeState(e.target.value as SearchScope);
                setVisible(PAGE_SIZE);
              }}
              title="메모는 만든 날로 거릅니다"
              className="text-xs px-1.5 py-1 border border-slate-200 rounded-lg bg-white font-semibold cursor-pointer"
            >
              {SEARCH_SCOPES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
            {scope === 'all' ? (
              <span className="text-2xs font-semibold text-slate-400">날짜 제한 없음</span>
            ) : (
              // 고른 기간의 날짜를 늘 보이고, 그 자리에서 고치면 직접 지정으로 (V4)
              <span className="flex items-center gap-1">
                {(['start', 'end'] as const).map((k, i) => (
                  <span key={k} className="flex items-center gap-1">
                    {i > 0 && <span className="text-xs text-slate-400">~</span>}
                    <input
                      type="date"
                      data-search-range={k}
                      value={range?.[k] ?? ''}
                      onChange={(e) => {
                        setCustom({ ...(range ?? { start: '', end: '' }), [k]: e.target.value });
                        setScopeState('custom');
                      }}
                      className="text-xs px-1.5 py-0.5 border border-slate-200 rounded-lg bg-white"
                    />
                  </span>
                ))}
              </span>
            )}
            <span className="text-xs font-bold text-slate-700 ml-2">라벨</span>
            <select data-search-label value={labelId} onChange={(e) => setLabelId(e.target.value)} className="text-xs px-1.5 py-1 border border-slate-200 rounded-lg bg-white font-semibold cursor-pointer max-w-[12rem]">
              <option value="">모든 라벨</option>
              {labelOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div data-search-results={hits.length} className="space-y-2">
          {hits.length > 0 ? (
            <>
              <div className="text-xs font-bold text-slate-700 pl-1">
                {hits.length}건{hits.length > visible && <span className="font-semibold text-slate-500"> (앞에서 {visible}건)</span>}
              </div>
              {hits.slice(0, visible).map((hit) => {
                const badge = BADGES[hit.kind];
                const labels = itemLabels(hit.item.kind === 'event' ? eventTree : noteTree, hit.item.labelIds);
                return (
                  <div
                    key={hit.key}
                    data-search-hit={hit.key}
                    data-search-hit-kind={hit.kind}
                    onClick={() => go(hit)}
                    title={hit.kind === 'memo' || hit.where === 'memo' ? '메모 화면으로 가서 짚기' : '그날 하루 화면으로 가서 짚기'}
                    className="p-3 bg-white hover:bg-blue-50/40 border border-slate-200 hover:border-primary/50 rounded-xl cursor-pointer transition-all flex items-start gap-3 shadow-xs group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 mb-1">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold border ${badge.className}`}>{badge.text}</span>
                        <span className="text-xs font-bold text-slate-600">{titleOf(hit)}</span>
                        {labels.map((l) => {
                          const c = labelColor(l.color);
                          return (
                            <span key={l.id} className="px-1.5 py-0.5 rounded text-2xs font-bold" style={{ backgroundColor: c.bg, color: c.text, border: `1px solid ${c.border}` }}>
                              {l.name}
                            </span>
                          );
                        })}
                      </div>
                      {hit.file && (
                        <div className="text-xs font-bold text-rose-700 mb-0.5 break-all">
                          📎{' '}
                          {hit.file.url ? (
                            <a href={hit.file.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} data-search-file className="hover:underline">
                              {hit.file.name}
                            </a>
                          ) : (
                            hit.file.name
                          )}
                        </div>
                      )}
                      <p className="text-xs text-slate-800 whitespace-pre-wrap leading-relaxed line-clamp-3 break-words">{hit.item.text || '(글 없음)'}</p>
                    </div>
                    <button
                      type="button"
                      data-search-open={hit.key}
                      onClick={(e) => {
                        e.stopPropagation();
                        edit(hit);
                      }}
                      title="이 항목의 쓰는 칸 열기"
                      aria-label="쓰는 칸 열기"
                      className="shrink-0 w-7 h-7 rounded-lg hover:bg-slate-100 text-sm cursor-pointer"
                    >
                      ✏️
                    </button>
                  </div>
                );
              })}
              {hits.length > visible && (
                <button
                  type="button"
                  data-search-more
                  onClick={() => setVisible((v) => v + PAGE_SIZE)}
                  className="w-full py-2.5 bg-white hover:bg-blue-50/40 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 cursor-pointer"
                >
                  더 보기 (남은 {hits.length - visible}건)
                </button>
              )}
            </>
          ) : (
            <div data-search-empty className="py-12 text-center text-slate-400 text-xs font-semibold">
              {keyword.trim() ? '찾는 글이 없습니다.' : '고른 기간에 항목이 없습니다.'}
            </div>
          )}
        </div>
      </div>
    </ModalShell>
  );
}
