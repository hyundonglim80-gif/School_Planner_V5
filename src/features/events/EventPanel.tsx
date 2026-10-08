// 일정을 쓰는 칸 (V4 components/EventDrawer.tsx). 메모·기록 칸과 같은 자리(오른쪽 줄)에 같은 방식으로 뜬다 - 쓰는 칸 'event'.
//
// - 어느 화면에서든 이 칸 하나로 새로 쓰고 고친다(V4 그대로). 칸을 연 순간의 공간에 저장한다.
// - 내용 칸이 맨 위(열면 곧바로 적는다) → 빠른 입력 칩(새 일정만) → 날짜·기한 → ⏰ 알림·🔗 링크 → 라벨 → 속성.
// - 날짜: 새 일정은 저장할 날짜가 곧바로 바뀐다. 고치던 일정은 저장할 때 그 날짜로 옮긴다 = date만(되돌리기는 날짜만).
// - 속성: 라벨이 정한 값 먼저, 이 일정만 다른 것만 적는다(eventForm). 기간·반복은 '끝 날'·'🔁 반복' 줄(P3-3).
// - 저장하면 칸은 닫히지 않고 그 일정의 수정 칸이 된다(V4 사용자 결정 - 기록·메모와 같다). 저장 = 바뀐 칸만, 문서 하나.
// - 저장이 안 되면 칸을 닫지 않는다(적은 것은 그대로). ESC는 저장 안 한 글이 있으면 먼저 묻는다, 좁은 화면 배경 = 저장하고 닫기.
// - 이 칸이 열린 동안 다른 기기에서 고친 것은, 손대기 전이면 따라간다(손댔으면 적던 것을 덮지 않는다).
import { useEffect, useMemo, useRef, useState } from 'react';
import { registerUnsavedCheck, type WindowProps } from '../../app/windows';
import { showToast } from '../../app/toast';
import { addDays, shortDateLabel, todayStr } from '../../domain/dateUtils';
import { parseQuickInput, stripMatch, type QuickMatch } from '../../domain/quickInput';
import { useDocs, useItemsOn, useLabelTree, useMirrorStatus } from '../../data/select';
import AutoTextarea from '../../ui/AutoTextarea';
import SidePanelFrame from '../../ui/SidePanelFrame';
import LabelPicker from '../labels/LabelPicker';
import { createEvent, deleteEvent, saveEvent } from './actions';
import DueBadge from './DueBadge';
import EventAlarmWindow from './EventAlarmWindow';
import { effectiveAttrs, formOf, newForm, sameForm, withAttr, withLabels, type AttrKey, type EventForm } from './eventForm';
import { orderAfter } from './eventOps';
import type { EventPanelParams } from './open';
import QuickInputChips, { type QuickChip } from './QuickInputChips';

/** 빠른 입력 칩 글자 */
const quickLabels = {
  date: (date: string) => `${shortDateLabel(date)}에 넣기`,
  due: (date: string) => `기한 ${shortDateLabel(date)}`,
  time: (hhmm: string) => `${hhmm} 알림`,
};

const ATTR_ROW: ReadonlyArray<{ key: AttrKey; name: string; title: string; color: string }> = [
  { key: 'calendar', name: '달력', title: '월간/년간 달력에 표시', color: 'accent-blue-600' },
  { key: 'forward', name: '이월', title: '끝내지 못하면 다음 날로 따라온다', color: 'accent-emerald-600' },
  { key: 'skip', name: '수업X', title: '그날은 수업이 없는 날로 본다', color: 'accent-amber-600' },
  {
    key: 'gcal',
    name: '구글 캘린더',
    title: '저장·완료·옮기기·지우기를 구글 캘린더에도 반영 - 라벨 관리에서 라벨마다 기본값을 정합니다',
    color: 'accent-sky-600',
  },
];

export default function EventPanel({ params, close, raise, setParams }: WindowProps<EventPanelParams>) {
  const { sid } = params;
  const isEditing = !!params.id;
  const items = useDocs('items', sid);
  const stored = params.id ? items[params.id] : undefined;
  const item = stored && !stored.deletedAt ? stored : undefined;
  const status = useMirrorStatus('items', sid);
  const tree = useLabelTree('event', sid);
  // 개인 공간 일정만 구글 캘린더로 보낸다 (V4 1차 - 그룹은 P8-4)
  const personal = sid.startsWith('u_');

  const [form, setForm] = useState<EventForm>(() => (item ? formOf(item) : newForm(params.date, tree, params.draftText)));
  /** 열었을 때(또는 마지막으로 저장했을 때)의 모습 - 이것과 다르면 '손댄 것' */
  const [base, setBase] = useState<EventForm>(form);
  const untouched = sameForm(form, base, tree);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [alarmOpen, setAlarmOpen] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const dayEvents = useItemsOn(form.date, 'event', sid);
  const today = todayStr();

  // 라벨·일정은 사본에서 오므로 칸을 여는 순간에는 아직 없을 수 있다. 도착하면 채운다.
  // 다른 기기에서 고친 것도 따라간다 - 단, 손대기 시작했으면 적던 것을 덮지 않는다. (바뀐 때 그리는 중에 맞춘다 - effect로 미루지 않는다)
  const itemKey = item ? JSON.stringify(formOf(item)) : '';
  const [seenItem, setSeenItem] = useState(itemKey);
  if (itemKey !== seenItem) {
    setSeenItem(itemKey);
    if (untouched && itemKey) {
      const f = JSON.parse(itemKey) as EventForm;
      setForm(f);
      setBase(f);
    }
  }
  // 새 일정 칸을 연 뒤에 라벨이 도착했으면 맨 위 라벨을 골라 둔다
  const [seenDefault, setSeenDefault] = useState(tree.defaultId);
  if (tree.defaultId !== seenDefault) {
    setSeenDefault(tree.defaultId);
    if (!isEditing && untouched && tree.defaultId && form.labelIds.length === 0 && !form.text) {
      const f = { ...form, labelIds: [tree.defaultId] };
      setForm(f);
      setBase(f);
    }
  }

  const dateChanged = isEditing && !!item && form.date !== item.date;
  const attrs = effectiveAttrs(form, tree);

  /** 날짜 칸: 새 일정은 저장할 날짜가 곧바로 바뀐다(같은 날 새 일정 칸 찾기도 그날로), 고치던 일정은 저장할 때 옮긴다 */
  const pickDate = (next: string) => {
    if (!next) return;
    setForm((f) => ({ ...f, date: next }));
    if (!isEditing) {
      setBase((b) => ({ ...b, date: next }));
      setParams({ ...params, date: next });
    }
  };

  // ─── 빠른 입력 (새 일정만) ───
  const quick = !isEditing && form.text.trim() ? parseQuickInput(form.text, form.date, tree.list.map((l) => l.name)) : null;
  const labelIdOf = (name: string) => tree.list.find((l) => l.name === name)?.id;

  /** 고른 칩을 칸에 넣는다. 날짜·기한·라벨은 그 말을 글에서 빼고, 시각은 알림으로 넣고 글에는 둔다 (V4 그대로) */
  const applyQuick = (keys: string[]) => {
    if (!quick) return;
    const strips: QuickMatch[] = [];
    let next = form;
    if (keys.includes('date') && quick.date) {
      next = { ...next, date: quick.date.date };
      strips.push(quick.date.match);
    }
    if (keys.includes('due') && quick.due) {
      next = { ...next, due: quick.due.date };
      strips.push(quick.due.match);
    }
    if (keys.includes('time') && quick.time) next = { ...next, time: quick.time.hhmm };
    const add = quick.labels.filter((l) => keys.includes(`label:${l.name}`));
    if (add.length > 0) {
      strips.push(...add.map((l) => l.match));
      const ids = add.map((l) => labelIdOf(l.name)).filter((id): id is string => !!id && !next.labelIds.includes(id));
      // 라벨을 고르면 그 라벨 속성을 따른다 (라벨 고르기와 같다)
      if (ids.length > 0) next = withLabels(next, [...next.labelIds, ...ids]);
    }
    let text = next.text;
    for (const m of [...strips].sort((a, b) => b.start - a.start)) text = stripMatch(text, m);
    next = { ...next, text };
    setForm(next);
    if (next.date !== form.date) {
      setBase((b) => ({ ...b, date: next.date }));
      setParams({ ...params, date: next.date });
    }
    textRef.current?.focus();
  };

  const quickChips: QuickChip[] = [];
  if (quick?.date && quick.date.date !== form.date) {
    quickChips.push({
      key: 'date',
      icon: '📅',
      label: quickLabels.date(quick.date.date),
      title: `저장할 날짜를 ${quick.date.date}로 바꾸고 글에서 '${quick.date.match.text}'를 뺍니다`,
    });
  }
  if (quick?.due && quick.due.date !== form.due) {
    quickChips.push({
      key: 'due',
      icon: '⏳',
      label: quickLabels.due(quick.due.date),
      title: `기한을 ${quick.due.date}로 정하고 글에서 '${quick.due.match.text}'를 뺍니다`,
    });
  }
  if (quick?.time && form.time !== quick.time.hhmm) {
    quickChips.push({
      key: 'time',
      icon: '⏰',
      label: quickLabels.time(quick.time.hhmm),
      title: `그날 ${quick.time.hhmm}에 알림을 맞춥니다 (글은 그대로)`,
    });
  }
  for (const l of quick?.labels ?? []) {
    quickChips.push({
      key: `label:${l.name}`,
      icon: '🏷️',
      label: l.name,
      title: `라벨 '${l.name}'을(를) 고르고 글에서 '${l.match.text}'를 뺍니다`,
    });
  }
  // 반복('매주 화') 칩은 일정 칸에 '🔁 반복' 줄이 생길 때(P3-3) 더한다

  // ─── 저장 ───
  /** 저장한다. 저장했거나 저장할 것이 없으면 true */
  const save = async (): Promise<boolean> => {
    if (!form.text.trim()) {
      // 지우기는 삭제 단추로만 한다. 내용을 다 지운 채 저장해도 일정은 남는다
      showToast('일정 내용을 입력하세요.');
      return false;
    }
    // 앞선 저장이 끝나기 전에 또 들어오면 같은 일정이 두 개 생긴다
    if (savingRef.current) return false;
    savingRef.current = true;
    setSaving(true);
    try {
      if (!isEditing) {
        const id = await createEvent(sid, form, tree, orderAfter(dayEvents));
        // 저장한 뒤에도 적은 것이 남고 그 일정의 수정 칸이 된다 (V4 사용자 결정)
        setBase(form);
        setParams({ sid, date: form.date, id });
      } else {
        if (!item) {
          showToast('일정을 찾지 못했습니다. 그 사이 지워졌을 수 있습니다.');
          return false;
        }
        const wrote = await saveEvent(sid, item, form, tree);
        setBase(form);
        if (!wrote) showToast('바뀐 것이 없습니다.');
      }
      return true;
    } catch {
      // 저장이 안 됐다 (안내는 저장 도우미가 했다). 적은 것은 칸에 그대로 두고 '저장된 것'으로 여기지 않는다
      return false;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  /** 지우기 = 지운 표시 (칸은 deleteEvent가 닫는다). 못 지웠으면 칸을 닫지 않는다 */
  const remove = async () => {
    if (!item || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      await deleteEvent(sid, item);
    } catch {
      // 안내는 저장 도우미가 했다
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const saveIfChanged = async (): Promise<boolean> => {
    // 내용을 다 지운 것은 '지우기'로 보지 않는다 - 저장하지 않고 넘어간다
    if (untouched || !form.text.trim()) return true;
    return save();
  };

  // ESC로 모두 닫기 전에 저장 안 한 글을 묻는다
  const unsaved = useRef<(() => boolean) | null>(null);
  useEffect(() => {
    unsaved.current = () => !untouched && !!form.text.trim();
  });
  useEffect(() => registerUnsavedCheck(unsaved), []);

  const title = isEditing ? '일정 수정' : '새 일정';
  const subtitle = useMemo(() => `${shortDateLabel(form.date)} 일정 · ${personal ? '개인' : '공유'}`, [form.date, personal]);

  return (
    <SidePanelFrame
      ariaLabel={title}
      onClose={close}
      onBackdropClose={() => void saveIfChanged().then((ok) => ok && close())}
      onSave={() => void save()}
      raise={raise}
    >
      <div data-event-panel={isEditing ? 'edit' : 'new'} data-event-id={params.id ?? ''} className="flex flex-col h-full min-h-0">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-slate-800">{title}</h3>
            <p className="text-xs font-bold text-primary mt-0.5 truncate">{subtitle}</p>
          </div>
          <button
            type="button"
            data-close
            title="닫기"
            onClick={close}
            className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {isEditing && !item ? (
          <div data-event-missing className="flex-1 flex items-center justify-center px-6 text-center text-xs text-slate-400">
            {stored?.deletedAt
              ? '지운 일정입니다. 휴지통에서 되살릴 수 있습니다.'
              : status === 'live'
                ? '일정을 찾지 못했습니다. 그 사이 지워졌을 수 있습니다.'
                : '일정을 불러오는 중...'}
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-6 space-y-5" data-scroll-lock>
            {/* 일정 내용: 칸을 열면 곧바로 적게 맨 위에 둔다 */}
            <div>
              <span className="block text-xs font-bold text-slate-500 mb-1">일정 내용</span>
              <AutoTextarea
                ref={textRef}
                autoFocus
                data-event-text-input
                value={form.text}
                onChange={(e) => setForm((f) => ({ ...f, text: e.target.value }))}
                placeholder="새로운 일정을 입력하세요..."
                className="w-full min-h-[84px] px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary placeholder-slate-400"
              />
              {!isEditing &&
                (quickChips.length > 0 ? (
                  <QuickInputChips chips={quickChips} onApply={(key) => applyQuick([key])} onApplyAll={() => applyQuick(quickChips.map((c) => c.key))} />
                ) : (
                  <p className="mt-1 text-2xs text-slate-400">날짜(내일·다음 주 화·10/15)·시각(15:00)·#라벨을 적으면 칩으로 넣을 수 있습니다.</p>
                ))}
            </div>

            {/* 날짜: 새 일정은 저장할 날짜가 곧바로 바뀌고, 고치던 일정은 저장할 때 그 날짜로 옮긴다 */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-bold text-slate-500 mr-1">날짜</span>
                <button
                  type="button"
                  data-event-date-prev
                  onClick={() => pickDate(addDays(form.date, -1))}
                  title="전날로"
                  className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-black cursor-pointer"
                >
                  ◀
                </button>
                <input
                  type="date"
                  data-event-date
                  value={form.date}
                  onChange={(e) => pickDate(e.target.value)}
                  aria-label="일정 날짜"
                  className="px-2 py-1 text-sm border border-slate-200 rounded-lg font-bold text-slate-700 bg-white"
                />
                <button
                  type="button"
                  data-event-date-next
                  onClick={() => pickDate(addDays(form.date, 1))}
                  title="다음 날로"
                  className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-black cursor-pointer"
                >
                  ▶
                </button>
              </div>
              {dateChanged && item?.date && (
                <p data-event-move-note className="text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                  저장하면 {shortDateLabel(item.date)} → <b>{shortDateLabel(form.date)}</b>로 옮깁니다.{' '}
                  <button type="button" data-event-move-keep onClick={() => pickDate(item.date!)} className="underline cursor-pointer">
                    그대로 두기
                  </button>
                </p>
              )}
              <div className="flex items-center gap-1.5 flex-wrap" data-event-due>
                <span className="text-xs font-bold text-slate-500 mr-1">기한</span>
                <input
                  type="date"
                  data-event-due-input
                  value={form.due}
                  onChange={(e) => setForm((f) => ({ ...f, due: e.target.value }))}
                  aria-label="기한"
                  className="px-2 py-1 text-sm border border-slate-200 rounded-lg font-bold text-slate-700 bg-white"
                />
                {form.due && (
                  <>
                    <DueBadge due={form.due} today={today} />
                    <button
                      type="button"
                      data-event-due-clear
                      onClick={() => setForm((f) => ({ ...f, due: '' }))}
                      title="기한 빼기"
                      aria-label="기한 빼기"
                      className="w-6 h-6 rounded-full text-slate-400 hover:text-red-500 hover:bg-slate-100 text-xs cursor-pointer"
                    >
                      ✕
                    </button>
                  </>
                )}
              </div>
              {form.due && !attrs.forward && <p className="text-2xs text-slate-400">이월을 켜면 끝낼 때까지 날마다 따라오며 D-day가 줄어듭니다.</p>}
            </div>

            {/* 단추 줄: 알림 · 링크 */}
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                data-event-alarm-open
                onClick={() => setAlarmOpen(true)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  form.time
                    ? form.time === item?.time && item?.alarmDone
                      ? 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      : 'text-primary bg-blue-50 hover:bg-blue-100'
                    : 'text-slate-600 bg-slate-100 hover:bg-slate-200'
                }`}
              >
                ⏰ {form.time ? `${shortDateLabel(form.date)} ${form.time}` : '알림 추가'}
              </button>
              {/* 링크 연결은 P4-3 */}
              <button
                type="button"
                data-event-link-add
                onClick={() => showToast('🚧 아직 V5로 옮기지 않은 기능입니다.')}
                className="px-3 py-1.5 bg-yellow-50 text-yellow-600 hover:bg-yellow-100 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer opacity-60"
              >
                🔗 링크 추가
              </button>
            </div>

            <LabelPicker kind="event" tree={tree} selected={form.labelIds} onChange={(ids) => setForm((f) => withLabels(f, ids))} />

            {/* 이 일정만의 속성 (라벨을 고르면 라벨 속성이 먼저 채워진다) */}
            <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl space-y-1.5">
              <span className="block text-xs font-bold text-slate-600">
                속성 설정 <span className="text-xs font-normal text-slate-400">(개별 일정 맞춤 조정)</span>
              </span>
              <div className="flex items-center gap-3.5 pt-0.5 text-xs font-medium text-slate-700 flex-wrap">
                {ATTR_ROW.filter((a) => personal || a.key !== 'gcal').map((a) => (
                  <label key={a.key} className="flex items-center gap-1.5 cursor-pointer select-none hover:text-slate-900" title={a.title}>
                    <input
                      type="checkbox"
                      data-event-attr={a.key}
                      checked={attrs[a.key]}
                      onChange={(e) => setForm((f) => withAttr(f, a.key, e.target.checked))}
                      className={`rounded ${a.color} focus:ring-0 w-3.5 h-3.5 cursor-pointer`}
                    />
                    <span className="font-semibold text-xs">{a.name}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between gap-3 bg-slate-50/50">
          {isEditing && item ? (
            <button
              type="button"
              data-event-delete
              onClick={() => void remove()}
              disabled={saving}
              className="px-4 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-100 rounded-xl transition-colors cursor-pointer"
            >
              삭제
            </button>
          ) : (
            <div />
          )}
          <div className="flex gap-2">
            <button
              type="button"
              data-event-close
              onClick={close}
              disabled={saving}
              className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
            >
              닫기
            </button>
            <button
              type="button"
              data-event-save
              onClick={() => void save()}
              disabled={saving || !form.text.trim() || (isEditing && !item)}
              className="px-5 py-2 text-sm font-bold text-white bg-primary hover:bg-blue-600 rounded-xl shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {saving ? '저장 중...' : dateChanged ? '옮기고 저장' : '저장'}
            </button>
          </div>
        </div>
      </div>

      {alarmOpen && (
        <EventAlarmWindow
          onClose={() => setAlarmOpen(false)}
          date={form.date}
          initialTime={form.time}
          // 여기서는 칸에만 담는다 - 알림은 일정을 저장할 때 걸린다
          savedMessage="⏰ 알림 시각을 정했습니다. 일정을 저장하면 알림이 걸립니다."
          onSave={(time) => setForm((f) => ({ ...f, time }))}
          onTurnOff={() => setForm((f) => ({ ...f, time: '' }))}
        />
      )}
    </SidePanelFrame>
  );
}
