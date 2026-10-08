// 🏷️ 라벨 관리 창 (V4 components/LabelModal.tsx, 설명서 'labels'). 탭 둘: 📅 일정 라벨 · 📝 메모·기록 라벨(한 목록 - 상위/하위 2단계).
//
// - 새 라벨 **추가**는 누르는 즉시 저장한다. 이름·색·순서·속성·상위 바꾸기와 지우기는 💾 저장(또는 Ctrl+S)에서 한꺼번에 (V4 그대로).
// - 창은 고친 것만 들고(덧칠) 나머지는 기기 사본을 그대로 보인다 - 열어 둔 동안 다른 기기에서 고친 것도 들어온다.
//   저장하면 **바뀐 라벨 문서의 바뀐 칸만** 고친다(data/labels labelSaveOps) - 이름을 바꾸면 그 라벨 문서 하나만. 항목은 라벨을 id로 가리킨다.
// - 지우기 = 지운 표시(휴지통에서 되살린다). 되돌리기는 안내 단추·Ctrl+Z.
// - 빈 라벨 정리·항목 수는 기기 사본에서 바로 센다(V4는 '항목 수 세기'로 서버를 훑었다). 다 받기 전(구독 중이 아니면)에는 세지 않는다 - 덜 센 채로 '비었다'고 보이면 쓰는 라벨을 지운다.
// - 칸을 연 순간의 공간에 저장한다.
import { useEffect, useMemo, useRef, useState } from 'react';
import { registerUnsavedCheck, type WindowProps } from '../../app/windows';
import { showErrorToast, showToast } from '../../app/toast';
import { orderByTree, parentMapOf, type ParentMap } from '../../domain/labelTree';
import { cleanLabelName, EVENT_LABEL_PROPS, labelProps } from '../../domain/labels';
import {
  addDefaultLabels,
  addLabel,
  labelNameProblem,
  labelSaveOps,
  restoreLabels,
  saveLabels,
  type LabelDraft,
} from '../../data/labels';
import {
  emptyLabelsOf,
  labelUsageOf,
  missingLabelsOf,
  useDocs,
  useLabelTree,
  useMirrorStatus,
  usageTotal,
  type LabelTree,
} from '../../data/select';
import { currentSpaceId } from '../../data/session';
import type { ItemKind, LabelProps } from '../../data/types';
import ModalShell, { ModalCloseButton } from '../../ui/ModalShell';
import ColorPicker from './ColorPicker';

export interface LabelsWindowParams {
  /** 처음 볼 탭 (각 칸의 ⚙️에서 그 탭으로) */
  tab?: ItemKind;
}

/** 창이 들고 있는 고친 것 (사본 위에 얹는다) */
interface Overlay {
  edits: Record<string, Partial<LabelDraft>>;
  removed: string[];
  /** ▲▼로 다시 세운 줄 (그 종류의 id 차례) */
  order: Partial<Record<ItemKind, string[]>>;
}
const NO_CHANGES: Overlay = { edits: {}, removed: [], order: {} };

/** 사본의 라벨 + 고친 것 = 창에 보이는 줄 (평평하게 - 상위/하위는 트리로 그린다) */
function draftOf(tree: LabelTree, ov: Overlay, kind: ItemKind): LabelDraft[] {
  const removed = new Set(ov.removed);
  const liveIds = tree.list.map((l) => l.id).filter((id) => !removed.has(id));
  const want = ov.order[kind];
  const ids = want ? [...want.filter((id) => liveIds.includes(id)), ...liveIds.filter((id) => !want.includes(id))] : liveIds;
  return ids.map((id) => {
    const l = tree.byId.get(id)!;
    return { id, name: l.name, color: l.color, parentId: l.parentId ?? null, props: l.props, ...ov.edits[id] };
  });
}

/** 창에 보이는 두 목록과 저장할 쓰기 묶음 (data/labels labelSaveOps - 바뀐 칸만) */
function planOf(sid: string | null, eventTree: LabelTree, noteTree: LabelTree, o: Overlay) {
  const event = draftOf(eventTree, o, 'event');
  const note = draftOf(noteTree, o, 'note');
  const ops = sid
    ? [...labelSaveOps(sid, 'event', eventTree.list, event, o.removed), ...labelSaveOps(sid, 'note', noteTree.list, note, o.removed)]
    : [];
  return { event, note, ops };
}

/** 같은 상위 아래(또는 맨 위 단계)에서 한 칸 위/아래로. 하위는 제 상위 밑을 벗어나지 않는다 (V4 그대로) */
function moveSibling<T extends { id: string }>(list: T[], id: string, dir: 'up' | 'down', parents: ParentMap): T[] {
  const parentOf = (x: string) => parents[x] || '';
  const siblings = list.filter((l) => parentOf(l.id) === parentOf(id));
  const i = siblings.findIndex((l) => l.id === id);
  const j = dir === 'up' ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= siblings.length) return list;
  const a = list.findIndex((l) => l.id === id);
  const b = list.findIndex((l) => l.id === siblings[j].id);
  const next = [...list];
  [next[a], next[b]] = [next[b], next[a]];
  return next;
}

const KIND_NOUN: Record<ItemKind, string> = { event: '일정', note: '메모·기록' };

export default function LabelsWindow({ params, close, raise }: WindowProps<LabelsWindowParams | undefined>) {
  // 칸을 연 순간의 공간 (V4 규칙)
  const [sid] = useState(() => currentSpaceId());
  const [tab, setTab] = useState<ItemKind>(params?.tab ?? 'event');
  // 이미 열린 창을 ⚙️로 다시 열면 그 탭으로 (다시 연 때가 바뀌면 그리는 중에 맞춘다)
  const [seenRaise, setSeenRaise] = useState(raise);
  if (raise !== seenRaise) {
    setSeenRaise(raise);
    if (params?.tab) setTab(params.tab);
  }

  const eventTree = useLabelTree('event', sid);
  const noteTree = useLabelTree('note', sid);
  const labelStatus = useMirrorStatus('labels', sid);
  const itemStatus = useMirrorStatus('items', sid);
  const items = useDocs('items', sid);
  const labelDocs = useDocs('labels', sid);

  const [ov, setOv] = useState<Overlay>(NO_CHANGES);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const plan = (o: Overlay) => planOf(sid, eventTree, noteTree, o);
  const { event: eventDraft, note: noteDraft, ops } = useMemo(() => planOf(sid, eventTree, noteTree, ov), [sid, eventTree, noteTree, ov]);
  const noteParents = useMemo(() => parentMapOf(noteDraft), [noteDraft]);
  const noteRows = useMemo(
    () =>
      orderByTree(
        noteDraft.map((d) => d.id),
        noteParents,
      ),
    [noteDraft, noteParents],
  );

  // 저장 안 한 것이 있으면 ESC로 모두 닫기 전에 묻는다
  const dirty = ops.length > 0;
  const unsaved = useRef<(() => boolean) | null>(null);
  useEffect(() => {
    unsaved.current = () => dirty;
  });
  useEffect(() => registerUnsavedCheck(unsaved), []);

  const edit = (id: string, change: Partial<LabelDraft>) =>
    setOv((o) => ({ ...o, edits: { ...o.edits, [id]: { ...o.edits[id], ...change } } }));
  const removeRow = (id: string) => setOv((o) => ({ ...o, removed: [...o.removed, id] }));
  const move = (kind: ItemKind, id: string, dir: 'up' | 'down') => {
    const list = kind === 'event' ? eventDraft : noteDraft;
    const next = moveSibling(list, id, dir, kind === 'note' ? noteParents : {});
    setOv((o) => ({ ...o, order: { ...o.order, [kind]: next.map((d) => d.id) } }));
  };

  /** 저장 (o = 저장할 고친 것 - 빈 라벨 정리는 지울 것을 더해 부른다) */
  const save = async (o: Overlay = ov, message?: string) => {
    if (!sid || saving) return;
    const p = plan(o);
    for (const kind of ['event', 'note'] as const) {
      const problem = labelNameProblem(p[kind]);
      if (problem) {
        setTab(kind);
        showErrorToast(`${KIND_NOUN[kind]} 라벨: ${problem}`);
        return;
      }
    }
    if (p.ops.length === 0) {
      showToast('바뀐 것이 없습니다.');
      return;
    }
    setSaving(true);
    try {
      await saveLabels(sid, p.ops, message);
      setOv(NO_CHANGES);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      // 저장 도우미가 안내했다 - 고친 것은 그대로 둔다(다시 저장할 수 있게)
    } finally {
      setSaving(false);
    }
  };

  // ── 새 라벨 (누르는 즉시 저장) ──
  const [newEvent, setNewEvent] = useState<{ name: string; color: string; props: Required<LabelProps> }>({
    name: '',
    color: 'blue',
    props: labelProps({}),
  });
  const [newNote, setNewNote] = useState({ name: '', color: 'green', parent: '' });
  const [adding, setAdding] = useState(false);

  const add = async (kind: ItemKind) => {
    const form = kind === 'event' ? newEvent : newNote;
    const name = cleanLabelName(form.name);
    if (!name || !sid || adding) return;
    const list = kind === 'event' ? eventDraft : noteDraft;
    if (list.some((d) => cleanLabelName(d.name) === name)) {
      showErrorToast(`'${name}' 라벨이 이미 있습니다.`);
      return;
    }
    setAdding(true);
    try {
      if (kind === 'event') {
        await addLabel(sid, 'event', { name, color: newEvent.color, props: newEvent.props }, eventTree.list);
        // 기간·반복은 라벨마다 드물어 다음 라벨에는 끈다 (V4 그대로)
        setNewEvent((f) => ({ ...f, name: '', props: { ...f.props, period: false, recur: false } }));
      } else {
        // 고른 상위가 지워졌거나 하위가 되었으면 맨 위 단계로. 고른 상위는 다음에 더할 때도 남는다
        const parent = noteDraft.some((d) => d.id === newNote.parent) && !noteParents[newNote.parent] ? newNote.parent : null;
        await addLabel(sid, 'note', { name, color: newNote.color, parentId: parent }, noteTree.list);
        setNewNote((f) => ({ ...f, name: '' }));
      }
    } catch {
      // 안내했다 - 적던 이름은 남긴다
    } finally {
      setAdding(false);
    }
  };

  // ── 항목 수·빈 라벨 정리 (사본에서 바로 센다) ──
  const counted = itemStatus === 'live';
  const usage = useMemo(() => labelUsageOf(items, noteParents), [items, noteParents]);
  const emptyCount = counted ? noteRows.filter((r) => usageTotal(usage[r.id]) === 0).length : 0;
  const [pruneList, setPruneList] = useState<{ id: string; checked: boolean }[] | null>(null);
  const nameOf = (id: string) => noteDraft.find((d) => d.id === id)?.name ?? '';
  const prune = async () => {
    const drop = (pruneList ?? []).filter((x) => x.checked).map((x) => x.id);
    if (drop.length === 0) return;
    setPruneList(null);
    await save({ ...ov, removed: [...ov.removed, ...drop] }, `🧹 빈 라벨 ${drop.length}개를 지웠습니다. 휴지통에서 되살릴 수 있습니다.`);
  };

  // ── 삭제된 라벨 복구: 지웠지만 아직 항목에 붙어 있는 라벨을 되살린다 ──
  const canScan = counted && labelStatus === 'live';
  const recover = async () => {
    if (!sid) return;
    const missing = missingLabelsOf(labelDocs, items);
    if (missing.length === 0) {
      showToast('✅ 검사 완료: 지웠지만 항목에 붙어 있는 라벨이 없습니다.');
      return;
    }
    const lines = (['event', 'note'] as const)
      .map((k) => [k, missing.filter((l) => l.kind === k).map((l) => l.name)] as const)
      .filter(([, names]) => names.length > 0)
      .map(([k, names]) => `${KIND_NOUN[k]}: ${names.join(', ')}`);
    if (!window.confirm(`다음 라벨은 지웠지만 아직 항목에 붙어 있습니다. 되살릴까요?\n\n${lines.join('\n')}`)) return;
    try {
      await restoreLabels(
        sid,
        missing.map((l) => l.id),
      );
    } catch {
      // 안내했다
    }
  };

  const status = labelStatus === 'idle' || labelStatus === 'loading' ? '라벨을 받는 중…' : null;
  const tree = tab === 'event' ? eventTree : noteTree;

  return (
    <ModalShell
      isOpen
      onClose={close}
      raise={raise}
      width="2xl"
      title="🏷️ 라벨 관리"
      bare
      onSave={() => void save()}
      footer={
        <>
          <button
            type="button"
            data-label-recover
            onClick={() => void recover()}
            disabled={!canScan}
            title="지웠지만 아직 일정·기록·메모에 붙어 있는 라벨을 찾아 되살립니다"
            className="mr-auto px-3 py-2 bg-white hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed text-slate-600 border border-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            🔍 삭제된 라벨 복구
          </button>
          {saved && <span className="text-emerald-500 text-xs font-bold">✅ 저장되었습니다</span>}
          <ModalCloseButton onClose={close} />
          <button
            type="button"
            data-label-save
            data-dirty={dirty || undefined}
            onClick={() => void save()}
            disabled={saving || !sid}
            className="px-5 py-2 bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            💾 {saving ? '저장 중...' : '저장'}
          </button>
        </>
      }
    >
      <div data-labels-window>
        {/* 탭 (일정, 메모·기록) */}
        <div className="flex border-b border-slate-200 bg-slate-100/70 p-1.5 gap-1 sticky top-0 z-10">
          {(['event', 'note'] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              data-label-tab={k}
              aria-selected={tab === k}
              onClick={() => setTab(k)}
              className={`flex-1 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                tab === k
                  ? `bg-white shadow-xs border ${k === 'event' ? 'text-blue-700 border-blue-200' : 'text-emerald-700 border-emerald-200'}`
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>{k === 'event' ? '📅' : '📝'}</span> {KIND_NOUN[k]} 라벨 ({(k === 'event' ? eventDraft : noteDraft).length})
            </button>
          ))}
        </div>

        <div className="p-5 space-y-4" data-label-panel={tab}>
          {tab === 'event' ? (
            <div className="bg-blue-50 border-l-4 border-blue-500 p-3 rounded-r-xl text-xs text-blue-900 leading-relaxed">
              <strong>💡 일정 라벨 속성</strong>
              <ul className="list-disc list-inside mt-1 space-y-0.5 text-blue-800">
                {EVENT_LABEL_PROPS.map((p) => (
                  <li key={p.key}>
                    <strong>{p.name}</strong>: {p.title}
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-blue-800">라벨을 고르면 그 속성이 일정에 먼저 채워지고, 일정마다 따로 켜고 끌 수 있습니다. 맨 위 라벨이 새 일정의 기본 라벨입니다.</p>
            </div>
          ) : (
            <div className="bg-emerald-50 border-l-4 border-emerald-500 p-3 rounded-r-xl text-xs text-emerald-900 leading-relaxed">
              <strong>💡 메모·기록 라벨</strong>
              <p className="mt-0.5 text-emerald-800">
                메모와 기록에 함께 쓰는 라벨입니다. 쓰는 칸과 메모 화면·하루 화면의 라벨로 보기가 이 목록을 봅니다. 순서를 위/아래로, 상위 라벨 밑에 둘 수 있습니다(2단계까지).
                맨 위 라벨이 새 메모·기록의 기본 라벨입니다.
              </p>
            </div>
          )}

          {status && <p className="text-xs text-slate-400 font-bold">{status}</p>}
          {!status && tree.list.length === 0 && (
            <div data-label-empty={tab} className="flex items-center justify-between gap-2 flex-wrap px-3 py-2.5 rounded-xl bg-slate-50 border border-dashed border-slate-300 text-xs text-slate-600">
              <span className="font-bold">{KIND_NOUN[tab]} 라벨이 없습니다. 아래에서 더하거나 기본 라벨을 넣으세요.</span>
              <button
                type="button"
                data-label-defaults={tab}
                disabled={labelStatus !== 'live' || !sid}
                onClick={() => sid && void addDefaultLabels(sid, tab).catch(() => {})}
                title={labelStatus !== 'live' ? '서버에서 라벨을 다 받은 뒤에 넣을 수 있습니다' : undefined}
                className="px-3 py-1.5 bg-white hover:bg-slate-100 disabled:opacity-50 border border-slate-300 rounded-lg font-bold text-slate-700 cursor-pointer"
              >
                기본 라벨 넣기
              </button>
            </div>
          )}

          {tab === 'event' ? (
            <>
              <div className="space-y-2">
                {eventDraft.map((d, idx) => (
                  <div
                    key={d.id}
                    data-label-row={d.id}
                    className="flex items-center justify-between gap-2 p-2 bg-slate-50 border border-slate-200 rounded-xl hover:border-slate-300 transition-all text-xs"
                  >
                    <div className="flex items-center gap-1.5 shrink-0">
                      <UpDown first={idx === 0} last={idx === eventDraft.length - 1} onMove={(dir) => move('event', d.id, dir)} />
                      <input
                        type="text"
                        data-label-name
                        value={d.name}
                        aria-label="일정 라벨 이름"
                        onChange={(e) => edit(d.id, { name: e.target.value })}
                        className="px-2 py-1 bg-white border border-slate-200 rounded text-xs font-bold text-slate-800 w-24 focus:outline-none focus:border-blue-500"
                      />
                      <ColorPicker name={d.id} color={d.color} onChange={(color) => edit(d.id, { color })} />
                    </div>
                    <PropChecks props={labelProps(d.props)} onChange={(props) => edit(d.id, { props })} />
                    <DeleteButton noun="일정" name={d.name} onDelete={() => removeRow(d.id)} />
                  </div>
                ))}
              </div>

              <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl space-y-2.5">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    data-label-new-name="event"
                    value={newEvent.name}
                    onChange={(e) => setNewEvent((f) => ({ ...f, name: e.target.value }))}
                    onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && void add('event')}
                    placeholder="새 일정 라벨 이름..."
                    aria-label="새 일정 라벨 이름"
                    className="flex-1 min-w-0 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-500"
                  />
                  <ColorPicker name="new-event" color={newEvent.color} onChange={(color) => setNewEvent((f) => ({ ...f, color }))} />
                  <button
                    type="button"
                    data-label-add="event"
                    disabled={adding || !sid}
                    onClick={() => void add('event')}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
                  >
                    추가
                  </button>
                </div>
                <PropChecks props={newEvent.props} onChange={(props) => setNewEvent((f) => ({ ...f, props }))} />
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                {noteRows.map((row) => {
                  const d = noteDraft.find((x) => x.id === row.id)!;
                  const parentOf = (x: string) => noteParents[x] || '';
                  const siblings = noteDraft.filter((x) => parentOf(x.id) === parentOf(d.id));
                  const sib = siblings.findIndex((x) => x.id === d.id);
                  const candidates = row.hasChildren ? [] : noteRows.filter((r) => r.depth === 0 && r.id !== d.id);
                  const u = usage[d.id];
                  return (
                    <div
                      key={d.id}
                      data-label-row={d.id}
                      data-depth={row.depth}
                      className={`flex items-center justify-between gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl hover:border-slate-300 transition-all text-xs ${
                        row.depth === 1 ? 'ml-6 border-l-4 border-l-slate-300' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <UpDown first={sib <= 0} last={sib === siblings.length - 1} onMove={(dir) => move('note', d.id, dir)} sameParent />
                        {row.depth === 1 && (
                          <span className="text-slate-400" aria-hidden>
                            └
                          </span>
                        )}
                        <input
                          type="text"
                          data-label-name
                          value={d.name}
                          aria-label="메모·기록 라벨 이름"
                          onChange={(e) => edit(d.id, { name: e.target.value })}
                          className="px-2 py-1 bg-white border border-slate-200 rounded text-xs font-bold text-slate-800 w-28 focus:outline-none focus:border-emerald-500"
                        />
                        <ColorPicker name={d.id} color={d.color} onChange={(color) => edit(d.id, { color })} />
                        <label className="flex items-center gap-1 text-2xs font-bold text-slate-500">
                          상위
                          <select
                            data-label-parent
                            aria-label={`${d.name} 상위 라벨`}
                            value={noteParents[d.id] ?? ''}
                            disabled={row.hasChildren}
                            title={row.hasChildren ? '하위 라벨이 있어 상위를 둘 수 없습니다 (2단계까지)' : '이 라벨을 어느 라벨 밑에 둘지'}
                            onChange={(e) => edit(d.id, { parentId: e.target.value || null })}
                            className="px-1.5 py-1 border border-slate-200 rounded-lg text-2xs font-bold text-slate-700 bg-white disabled:opacity-50"
                          >
                            <option value="">없음</option>
                            {candidates.map((r) => (
                              <option key={r.id} value={r.id}>
                                {nameOf(r.id)}
                              </option>
                            ))}
                          </select>
                        </label>
                        {counted && (
                          <span
                            data-label-usage={d.id}
                            data-total={usageTotal(u)}
                            title={row.hasChildren ? '하위 라벨이 붙은 항목도 셉니다' : undefined}
                            className={`text-2xs font-bold ${usageTotal(u) === 0 ? 'text-rose-500' : 'text-slate-500'}`}
                          >
                            메모 {u?.memo ?? 0} · 기록 {u?.record ?? 0} · 휴지통 {u?.trash ?? 0}
                          </span>
                        )}
                      </div>
                      <DeleteButton noun="메모·기록" name={d.name} onDelete={() => removeRow(d.id)} />
                    </div>
                  );
                })}
              </div>

              {/* 빈 라벨 정리 (V4 U10) - 빈 라벨은 저절로 지우지 않는다 */}
              <div className="flex items-center gap-2 flex-wrap text-xs">
                <button
                  type="button"
                  data-label-prune
                  disabled={emptyCount === 0}
                  onClick={() => setPruneList(emptyLabelsOf(noteRows, usage))}
                  title={counted ? '메모·기록·휴지통 어디에도 붙지 않은 라벨' : '항목을 다 받은 뒤에 셉니다'}
                  className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 disabled:opacity-50 border border-rose-200 rounded-lg font-bold text-rose-700 cursor-pointer"
                >
                  🧹 빈 라벨 정리 ({emptyCount}개)
                </button>
                {!counted && <span className="text-slate-400 font-bold">항목을 받는 중이라 아직 세지 않았습니다.</span>}
              </div>
              {pruneList && (
                <div data-label-prune-list className="border border-rose-200 bg-rose-50/50 rounded-xl p-3 space-y-2 text-xs">
                  <p className="text-slate-600">
                    메모·기록·휴지통 어디에도 붙지 않은 라벨입니다. 남길 것은 체크를 빼세요. 하위가 있는 상위·맨 위(기본) 라벨은 처음부터 빼 두었습니다. 지운 라벨은
                    휴지통으로 가고, 저장하지 않은 고침도 함께 저장합니다.
                  </p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    {pruneList.map((x) => (
                      <label key={x.id} className="flex items-center gap-1.5 font-bold text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          data-label-prune-item={x.id}
                          checked={x.checked}
                          onChange={(e) => setPruneList((list) => list && list.map((y) => (y.id === x.id ? { ...y, checked: e.target.checked } : y)))}
                        />
                        {nameOf(x.id)}
                      </label>
                    ))}
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button
                      type="button"
                      onClick={() => setPruneList(null)}
                      className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-bold text-slate-600 cursor-pointer"
                    >
                      그만두기
                    </button>
                    <button
                      type="button"
                      data-label-prune-confirm
                      disabled={saving || !pruneList.some((x) => x.checked)}
                      onClick={() => void prune()}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-lg font-bold cursor-pointer"
                    >
                      고른 {pruneList.filter((x) => x.checked).length}개 지우기
                    </button>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 p-3 rounded-xl">
                <input
                  type="text"
                  data-label-new-name="note"
                  value={newNote.name}
                  onChange={(e) => setNewNote((f) => ({ ...f, name: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && void add('note')}
                  placeholder="새 메모·기록 라벨 이름..."
                  aria-label="새 메모·기록 라벨 이름"
                  className="flex-1 min-w-0 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:border-emerald-500"
                />
                <ColorPicker name="new-note" color={newNote.color} onChange={(color) => setNewNote((f) => ({ ...f, color }))} />
                <label className="flex items-center gap-1 text-2xs font-bold text-slate-500 shrink-0">
                  상위
                  <select
                    data-label-new-parent
                    aria-label="새 메모·기록 라벨의 상위 라벨"
                    title="새 라벨을 어느 라벨 밑에 둘지 (없음이면 맨 위 단계)"
                    value={noteRows.some((r) => r.depth === 0 && r.id === newNote.parent) ? newNote.parent : ''}
                    onChange={(e) => setNewNote((f) => ({ ...f, parent: e.target.value }))}
                    className="px-1.5 py-2 border border-slate-200 rounded-lg text-2xs font-bold text-slate-700 bg-white max-w-28"
                  >
                    <option value="">없음</option>
                    {noteRows
                      .filter((r) => r.depth === 0)
                      .map((r) => (
                        <option key={r.id} value={r.id}>
                          {nameOf(r.id)}
                        </option>
                      ))}
                  </select>
                </label>
                <button
                  type="button"
                  data-label-add="note"
                  disabled={adding || !sid}
                  onClick={() => void add('note')}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
                >
                  추가
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </ModalShell>
  );
}

function UpDown({ first, last, onMove, sameParent }: { first: boolean; last: boolean; onMove: (dir: 'up' | 'down') => void; sameParent?: boolean }) {
  const where = sameParent ? ' (같은 상위 안에서)' : '';
  const cls = (off: boolean) => `text-xs px-1 rounded leading-none ${off ? 'text-slate-200' : 'text-slate-400 hover:text-slate-700 cursor-pointer'}`;
  return (
    <div className="flex flex-col gap-0.5">
      <button type="button" data-label-up disabled={first} onClick={() => onMove('up')} title={`위로${where}`} className={cls(first)}>
        ▲
      </button>
      <button type="button" data-label-down disabled={last} onClick={() => onMove('down')} title={`아래로${where}`} className={cls(last)}>
        ▼
      </button>
    </div>
  );
}

/** 일정 라벨 속성 다섯 + 구글 캘린더 (달력 → 이월 → 기간 → 반복 → 수업X → 구글 캘린더) */
function PropChecks({ props, onChange }: { props: Required<LabelProps>; onChange: (props: Required<LabelProps>) => void }) {
  return (
    <div className="flex items-center gap-x-2.5 gap-y-1 text-xs text-slate-600 flex-wrap min-w-0 flex-1">
      {EVENT_LABEL_PROPS.map((p) => (
        <label key={p.key} className="flex items-center gap-1 cursor-pointer select-none hover:text-slate-900" title={p.title}>
          <input
            type="checkbox"
            data-label-prop={p.key}
            checked={props[p.key]}
            onChange={(e) => onChange({ ...props, [p.key]: e.target.checked })}
            className={`rounded w-3.5 h-3.5 cursor-pointer ${p.color}`}
          />
          <span className="font-semibold text-xs whitespace-nowrap">{p.name}</span>
        </label>
      ))}
    </div>
  );
}

function DeleteButton({ noun, name, onDelete }: { noun: string; name: string; onDelete: () => void }) {
  return (
    <button
      type="button"
      data-label-delete
      onClick={onDelete}
      title={`${noun} 라벨 '${name}' 지우기 (저장할 때 휴지통으로)`}
      className="text-slate-400 hover:text-red-500 font-black px-1.5 py-0.5 rounded transition-colors cursor-pointer shrink-0"
    >
      ✕
    </button>
  );
}
