// 🔗 링크 연결 창 (V4 components/LinkerModal.tsx). 창 'linker' = { sid, id } - 그 항목에 일정·기록·메모를 잇는다.
//   - 탭 📌 일정 · 📔 기록 · 📝 메모. 🏫 수업 탭은 수업 칸이 생기는 P6-1에서(그 전에는 가져온 수업 링크를 보기만).
//   - 조회 범위(±1주일·±1개월·1학기·2학기·학년도·기간 설정 - 날짜를 고치면 기간 설정), 라벨 칩·키워드로 좁히고 ‹ ›로 쪽을 넘긴다.
//   - 누르면 🛒 담기(여러 개), 이미 이은 것은 '연결됨'. '+ 새 00 만들어 연결' = 같은 쓰는 칸을 열고, 처음 저장하면 담긴다.
//   - 연결 저장(Ctrl+S) = 양쪽 linkIds를 한 묶음으로 → 창을 닫는다(V4 10-07 - 열어 두면 링크 수가 바뀐 칸이 숨은 탭에 가려진다).
// 자료는 기기 사본에서 고른다(V4는 범위마다 서버를 읽었다 - 1년 범위면 1분 넘게 기다렸다).
import { useEffect, useMemo, useRef, useState } from 'react';
import { showErrorToast, showToast } from '../../app/toast';
import type { WindowProps } from '../../app/windows';
import { labelColor } from '../../domain/labels';
import { todayStr } from '../../domain/dateUtils';
import { useDocs, useLabelTree } from '../../data/select';
import ModalShell, { ModalCloseButton } from '../../ui/ModalShell';
import { openEventPanel } from '../events/open';
import { openNotePanel } from '../notes/open';
import { saveLinks } from './actions';
import { candidatesOf, RANGE_OPTIONS, rangeOf, type RangeKey } from './linkerList';
import { LINK_KIND_ICON, LINK_KIND_NAME, type LinkKind } from './linkOps';
import { listenLinkPick, type LinkWindowParams } from './open';

const TABS: LinkKind[] = ['event', 'journal', 'memo'];
const PER_PAGE = 6;

export default function LinkerWindow({ params, close, raise }: WindowProps<LinkWindowParams>) {
  const { sid, id } = params;
  const items = useDocs('items', sid);
  const source = items[id] && !items[id].deletedAt ? items[id] : undefined;
  const center = source?.date ?? todayStr();
  const eventTree = useLabelTree('event', sid);
  const noteTree = useLabelTree('note', sid);

  const [tab, setTab] = useState<LinkKind>('event');
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

  const range = rangeOf(rangeKey, center, custom);
  const { start, end } = range;
  const linked = useMemo(() => new Set(source?.linkIds ?? []), [source?.linkIds]);
  const list = useMemo(() => candidatesOf(items, tab, { start, end }, { labelIds, keyword, exclude: id }), [items, tab, start, end, labelIds, keyword, id]);
  const pages = Math.max(1, Math.ceil(list.length / PER_PAGE));
  const current = Math.min(page, pages);
  const shown = list.slice((current - 1) * PER_PAGE, current * PER_PAGE);
  const tabLabels = (tab === 'event' ? eventTree : noteTree).list;

  const toggle = (itemId: string) => {
    if (linked.has(itemId)) return;
    setPicked((p) => (p.includes(itemId) ? p.filter((x) => x !== itemId) : [...p, itemId]));
  };

  const makeNew = () => {
    const pickFor = pickToken.current;
    if (tab === 'memo') openNotePanel({ sid, date: null, pickFor });
    else if (tab === 'journal') openNotePanel({ sid, date: center, pickFor });
    else openEventPanel({ sid, date: center, pickFor });
  };

  const save = async () => {
    if (!source) {
      showErrorToast('연결할 항목을 찾지 못했습니다. 그 사이 지워졌을 수 있습니다.');
      return;
    }
    const targets = picked.map((p) => items[p]).filter((d) => d && !d.deletedAt);
    if (targets.length === 0) {
      showToast('연결할 항목을 골라 주세요.');
      return;
    }
    if (saving) return;
    setSaving(true);
    try {
      await saveLinks(sid, source, targets);
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
            {LINK_KIND_ICON[source.kind === 'event' ? 'event' : source.date ? 'journal' : 'memo']} {source.text.split('\n')[0] || '(내용 없음)'} 에 잇습니다
          </p>
        )}
        <div className="flex gap-2 border-b border-slate-200 pb-2">
          {TABS.map((k) => (
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
          <button
            type="button"
            data-linker-new={tab}
            onClick={makeNew}
            className="w-full px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors shadow-xs cursor-pointer"
          >
            + 새 {LINK_KIND_NAME[tab]} 만들어 연결
          </button>
        </div>

        <div className="border border-slate-200 rounded-xl bg-white overflow-hidden flex flex-col" data-linker-list={list.length}>
          {list.length === 0 ? (
            <div className="h-[152px] flex items-center justify-center text-xs text-slate-400" data-linker-empty>
              해당 조건에 맞는 데이터가 없습니다.
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
                const kind: LinkKind = d?.kind === 'event' ? 'event' : d?.date ? 'journal' : 'memo';
                return (
                  <span key={p} data-linker-picked={p} className="inline-flex items-center bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-lg text-xs text-blue-900 font-medium">
                    <span className="mr-1">{LINK_KIND_ICON[kind]}</span>
                    <span className="max-w-[130px] truncate font-bold">{d ? d.text.split('\n')[0] || '(표·첨부만)' : '불러오는 중…'}</span>
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
