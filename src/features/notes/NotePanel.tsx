// 메모·기록을 쓰는 칸 (V4 components/EntryDrawer.tsx - 메모와 기록이 같은 칸). 쓰는 칸 'note'.
//
// - 어느 화면에서든 이 칸 하나로 새로 쓰고 고친다. 칸을 연 순간의 공간에 저장한다.
// - 머리: 제목 · ☐ 완료 · ☆ 즐겨찾기(고치던 항목은 누르는 즉시 그 칸만 저장, 새 항목은 처음 저장 때 함께) · 📅 날짜 = 자리.
//   날짜를 넣으면 그날 기록, 빼면 메모 - 고치던 항목은 저장할 때 옮긴다(date만, 안내의 되돌리기 = 자리만).
// - 내용: ☑ 체크리스트(단추·단축키·Enter 이어 쓰기·☐ 누르기) · 첫·마지막 줄 '#라벨' 미리 보기 · 붙인 표·첨부(빼기만 - 붙이기는 P4-2).
// - 라벨(여러 개, '+ 새 라벨') - 저장할 때 새 라벨과 항목을 한 묶음으로.
// - 저장하면 칸은 닫히지 않고 그 항목의 수정 칸이 된다(V4 사용자 결정). 저장 = 바뀐 칸만, 문서 하나(+ 새 라벨).
// - 저장이 안 되면 칸을 닫지 않는다. ESC는 저장 안 한 글이 있으면 먼저 묻는다, 좁은 화면 배경 = 저장하고 닫기.
// - 이 칸이 열린 동안 다른 기기에서 고친 것은, 손대기 전이면 따라간다(손댔으면 적던 것을 덮지 않는다).
// @이름 학생 태그는 학급(명렬표)이 들어오는 P7-1에서 - 지금은 #26040305를 글에 적으면 그대로 남는다.
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { registerUnsavedCheck, type WindowProps } from '../../app/windows';
import { showErrorToastOnce, showToast } from '../../app/toast';
import { useShortcutTitle } from '../../app/keys';
import { continueOnEnter, toggleCheckAtCaret, toggleLinesPrefix } from '../../domain/checkLines';
import { shortDateLabel } from '../../domain/dateUtils';
import { useDocs, useItemsOn, useLabelTree, useMemos, useMirrorStatus } from '../../data/select';
import AutoTextarea from '../../ui/AutoTextarea';
import SidePanelFrame from '../../ui/SidePanelFrame';
import LabelPicker from '../labels/LabelPicker';
import { orderAfter } from '../events/eventOps';
import { createNote, deleteNote, saveNote, setNoteDone, setNoteFavorite } from './actions';
import { hasContent, isKnownLabel, newNoteForm, noteFormOf, sameNoteForm, savePlanOf, type NoteForm } from './noteForm';
import { nounOf, objectOf } from './noteOps';
import type { NotePanelParams } from './open';
import TablePreview from './TablePreview';

const PLACEHOLDER = {
  기록: '오늘 있었던 일을 기록해 보세요...',
  메모: '자유롭게 생각을 적어 보세요...',
} as const;

export default function NotePanel({ params, close, raise, setParams }: WindowProps<NotePanelParams>) {
  const { sid } = params;
  const isEditing = !!params.id;
  const items = useDocs('items', sid);
  const stored = params.id ? items[params.id] : undefined;
  const item = stored && !stored.deletedAt ? stored : undefined;
  const status = useMirrorStatus('items', sid);
  const tree = useLabelTree('note', sid);
  const personal = sid.startsWith('u_');

  const [form, setForm] = useState<NoteForm>(() => (item ? noteFormOf(item) : newNoteForm(params.date, tree, params.labelIds, params.draftText)));
  /** 열었을 때(또는 마지막으로 저장했을 때)의 모습 - 이것과 다르면 '손댄 것' */
  const [base, setBase] = useState<NoteForm>(form);
  const untouched = sameNoteForm(form, base, !isEditing);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [flagBusy, setFlagBusy] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const dayNotes = useItemsOn(form.date, 'note', sid);
  const memoList = useMemos(sid);

  // 항목·라벨은 사본에서 오므로 칸을 여는 순간에는 아직 없을 수 있다. 도착하면 채운다.
  // 다른 기기에서 고친 것도 따라간다 - 단, 손대기 시작했으면 적던 것을 덮지 않는다. (바뀐 때 그리는 중에 맞춘다 - effect로 미루지 않는다)
  const itemKey = item ? JSON.stringify(noteFormOf(item)) : '';
  const [seenItem, setSeenItem] = useState(itemKey);
  if (itemKey !== seenItem) {
    setSeenItem(itemKey);
    if (untouched && itemKey) {
      const f = JSON.parse(itemKey) as NoteForm;
      setForm(f);
      setBase(f);
    }
  }
  // 새 칸을 연 뒤에 라벨이 도착했으면 맨 위 라벨을 골라 둔다
  const [seenDefault, setSeenDefault] = useState(tree.defaultId);
  if (tree.defaultId !== seenDefault) {
    setSeenDefault(tree.defaultId);
    if (!isEditing && untouched && tree.defaultId && form.labelIds.length === 0 && !form.text) {
      const f = newNoteForm(params.date, tree, params.labelIds, params.draftText);
      setForm(f);
      setBase(f);
    }
  }

  /** 지금 칸이 가리키는 자리의 이름 - 고치던 항목은 저장된 자리, 새 항목은 날짜 칸 */
  const noun = isEditing && item ? nounOf(item) : form.date ? '기록' : '메모';
  const placeChanged = isEditing && !!item && (form.date || null) !== (item.date ?? null);
  const done = isEditing ? !!item?.done : form.done;
  const favorite = isEditing ? !!item?.favorite : form.favorite;
  const hashPreview = savePlanOf({ ...form, newLabels: [] }).names;

  /** 날짜 칸: 새 항목은 저장할 자리가 곧바로 바뀐다(같은 자리 새 칸 찾기도 그리로), 고치던 항목은 저장할 때 옮긴다 */
  const pickDate = (next: string) => {
    setForm((f) => ({ ...f, date: next }));
    if (!isEditing) {
      setBase((b) => ({ ...b, date: next }));
      setParams({ ...params, date: next || null });
    }
  };

  // ─── 완료·즐겨찾기 ───
  const toggleFlag = async (flag: 'done' | 'favorite') => {
    if (!isEditing) {
      // 새 항목: 들고 있다가 처음 저장할 때
      setForm((f) => ({ ...f, [flag]: !f[flag] }));
      return;
    }
    if (!item || flagBusy) return;
    setFlagBusy(true);
    try {
      if (flag === 'done') await setNoteDone(sid, item, !item.done);
      else await setNoteFavorite(sid, item, !item.favorite);
    } catch {
      // 안내는 저장 도우미가 했다
    } finally {
      setFlagBusy(false);
    }
  };

  // ─── 체크 목록 (domain/checkLines) ───
  /**
   * 글을 바꾸고 커서를 그 자리에 둔다. React가 값을 다시 그린 바로 뒤(useLayoutEffect)에 둔다 -
   * requestAnimationFrame으로 미루면 그새 친 글자 뒤에서 커서를 앞으로 되돌려 '달걀'이 '걀달'이 된다(V4 교훈).
   */
  const pendingCaret = useRef<[number, number] | null>(null);
  const setTextAndCaret = (text: string, selStart: number, selEnd = selStart) => {
    pendingCaret.current = [selStart, selEnd];
    setForm((f) => ({ ...f, text }));
  };
  useLayoutEffect(() => {
    const sel = pendingCaret.current;
    const el = textRef.current;
    if (!sel || !el) return;
    pendingCaret.current = null;
    el.focus();
    el.setSelectionRange(sel[0], sel[1]);
  }, [form.text]);
  const toggleChecklist = () => {
    const el = textRef.current;
    const start = el?.selectionStart ?? form.text.length;
    const end = el?.selectionEnd ?? start;
    const r = toggleLinesPrefix(form.text, start, end);
    setTextAndCaret(r.text, r.selStart, r.selEnd);
  };
  const onTextKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // 한글 조합 중 Enter는 건드리지 않는다
    if (e.key !== 'Enter' || e.nativeEvent.isComposing || e.shiftKey || e.ctrlKey || e.altKey || e.metaKey) return;
    const el = e.currentTarget;
    if (el.selectionStart !== el.selectionEnd) return;
    const r = continueOnEnter(el.value, el.selectionStart);
    if (!r) return;
    e.preventDefault();
    setTextAndCaret(r.text, r.caret);
  };
  const onTextClick = (e: MouseEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    if (el.selectionStart !== el.selectionEnd) return;
    const next = toggleCheckAtCaret(el.value, el.selectionStart);
    if (next !== null) setTextAndCaret(next, el.selectionStart);
  };
  // 단축키 '체크리스트'(app/keys가 sp5-checklist로 알린다) - 커서가 이 칸의 글 칸에 있을 때만
  const checklistRef = useRef(toggleChecklist);
  useEffect(() => {
    checklistRef.current = toggleChecklist;
  });
  useEffect(() => {
    const on = () => {
      if (document.activeElement === textRef.current) checklistRef.current();
    };
    window.addEventListener('sp5-checklist', on);
    return () => window.removeEventListener('sp5-checklist', on);
  }, []);
  const withShortcut = useShortcutTitle();

  // ─── 저장 ───
  /** 저장한다. 저장했거나 저장할 것이 없으면 true */
  const save = async (): Promise<boolean> => {
    if (!hasContent(form)) {
      // 지우기는 삭제 단추로만 한다. 내용을 다 지운 채 저장해도 항목은 남는다
      showToast(`${noun} 내용을 입력하세요.`);
      return false;
    }
    // 앞선 저장이 끝나기 전에 또 들어오면 같은 항목이 두 개 생긴다
    if (savingRef.current) return false;
    savingRef.current = true;
    setSaving(true);
    try {
      if (!isEditing) {
        const order = orderAfter(form.date ? dayNotes : memoList);
        const saved = await createNote(sid, form, tree, order);
        // 저장한 뒤에도 적은 것이 남고 그 항목의 수정 칸이 된다 (V4 사용자 결정). '#라벨' 줄은 떼고 칩으로
        const next = { ...form, text: saved.text, labelIds: saved.labelIds, newLabels: [] };
        setForm(next);
        setBase(next);
        setParams({ sid, date: form.date || null, id: saved.id });
      } else {
        if (!item) {
          showToast(`${noun}를 찾지 못했습니다. 그 사이 지워졌을 수 있습니다.`);
          return false;
        }
        const saved = await saveNote(sid, item, form, tree);
        const next = saved ? { ...form, text: saved.text, labelIds: saved.labelIds, newLabels: [] } : form;
        setForm(next);
        setBase(next);
        if (!saved) showToast('바뀐 것이 없습니다.');
      }
      return true;
    } catch (e) {
      // 저장이 안 됐다 - 적은 것은 칸에 그대로 두고 '저장된 것'으로 여기지 않는다. 안내는 저장 도우미가 했다(아니면 여기서 한 번)
      showErrorToastOnce(`${objectOf(noun)} 저장하지 못했습니다. 적은 내용은 칸에 남아 있습니다.`, e);
      return false;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  /** 지우기 = 지운 표시 (칸은 deleteNote가 닫는다). 못 지웠으면 칸을 닫지 않는다 */
  const remove = async () => {
    if (!item || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      await deleteNote(sid, item);
    } catch {
      // 안내는 저장 도우미가 했다
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const saveIfChanged = async (): Promise<boolean> => {
    // 내용을 다 지운 것은 '지우기'로 보지 않는다 - 저장하지 않고 넘어간다
    if (untouched || !hasContent(form)) return true;
    return save();
  };

  // ESC로 모두 닫기 전에 저장 안 한 글을 묻는다
  const unsaved = useRef<(() => boolean) | null>(null);
  useEffect(() => {
    unsaved.current = () => !untouched && hasContent(form);
  });
  useEffect(() => registerUnsavedCheck(unsaved), []);

  const title = isEditing ? `${noun} 수정` : `새 ${noun}`;
  const shownDate = isEditing ? (item?.date ?? null) : form.date || null;
  const subtitle = `${shownDate ? `${shortDateLabel(shownDate)} 기록` : '메모'} · ${personal ? '개인' : '공유'}`;

  return (
    <SidePanelFrame
      ariaLabel={title}
      onClose={close}
      onBackdropClose={() => void saveIfChanged().then((ok) => ok && close())}
      onSave={() => void save()}
      raise={raise}
    >
      <div data-note-panel={isEditing ? 'edit' : 'new'} data-note-id={params.id ?? ''} data-note-noun={noun} className="flex flex-col h-full min-h-0">
        <div className="flex items-start justify-between px-6 py-4 border-b border-slate-100">
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-slate-800">{title}</h3>
            <p className="text-xs font-bold text-primary mt-0.5 truncate">{subtitle}</p>
            {(!isEditing || item) && (
              <>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <button
                    type="button"
                    data-note-flag="done"
                    aria-pressed={done}
                    disabled={flagBusy}
                    onClick={() => void toggleFlag('done')}
                    title={isEditing ? '완료 표시 (누르면 바로 저장)' : '완료 표시 (처음 저장할 때 함께)'}
                    className={`px-2 py-0.5 rounded-md text-xs font-bold border transition-colors cursor-pointer ${
                      done ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
                    }`}
                  >
                    {done ? '☑' : '☐'} 완료
                  </button>
                  <button
                    type="button"
                    data-note-flag="favorite"
                    aria-pressed={favorite}
                    disabled={flagBusy}
                    onClick={() => void toggleFlag('favorite')}
                    title={isEditing ? '즐겨찾기 (누르면 바로 저장)' : '즐겨찾기 (처음 저장할 때 함께)'}
                    className={`px-2 py-0.5 rounded-md text-xs font-bold border transition-colors cursor-pointer ${
                      favorite ? 'bg-amber-50 text-amber-600 border-amber-300' : 'bg-white text-slate-500 border-slate-200 hover:border-amber-300'
                    }`}
                  >
                    {favorite ? '★' : '☆'} 즐겨찾기
                  </button>
                </div>
                {/* 📅 날짜 = 자리 (V4 U7): 날짜가 있으면 그날 기록, 비우면 메모 */}
                <div className="flex flex-wrap items-center gap-1.5 mt-1.5" data-note-place>
                  <span className="text-xs font-bold text-slate-500">📅 날짜</span>
                  <input
                    type="date"
                    aria-label="날짜"
                    data-note-date
                    value={form.date}
                    disabled={saving}
                    title="날짜가 있으면 그날의 기록, 비우면 메모입니다. 바꾸고 저장하면 옮겨 갑니다."
                    onChange={(e) => pickDate(e.target.value)}
                    className="px-2 py-0.5 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60"
                  />
                  {!form.date && <span className="text-xs text-slate-400">날짜 없음 (메모)</span>}
                  {form.date && (
                    <button
                      type="button"
                      data-note-date-clear
                      onClick={() => pickDate('')}
                      disabled={saving}
                      title="날짜를 빼면 메모가 됩니다 (저장할 때 옮깁니다)"
                      className="px-1.5 py-0.5 text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded cursor-pointer"
                    >
                      날짜 빼기
                    </button>
                  )}
                  {placeChanged && (
                    <span className="text-xs font-bold text-amber-700" data-note-place-hint>
                      {form.date ? `저장하면 ${shortDateLabel(form.date)} 기록으로 옮깁니다` : '저장하면 메모로 옮깁니다'}{' '}
                      <button type="button" data-note-place-keep onClick={() => pickDate(item?.date ?? '')} className="underline cursor-pointer">
                        그대로 두기
                      </button>
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
          <button
            type="button"
            data-close
            title="닫기"
            onClick={close}
            className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
          >
            ✕
          </button>
        </div>

        {isEditing && !item ? (
          <div data-note-missing className="flex-1 flex items-center justify-center px-6 text-center text-xs text-slate-400">
            {stored?.deletedAt
              ? '지운 항목입니다. 휴지통에서 되살릴 수 있습니다.'
              : status === 'live'
                ? '항목을 찾지 못했습니다. 그 사이 지워졌을 수 있습니다.'
                : '불러오는 중...'}
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-6 space-y-6" data-scroll-lock>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="block text-xs font-semibold text-slate-600">
                  {noun} 내용 <span className="text-red-500">*</span>
                </span>
                {/* 커서가 있는 줄(골랐으면 고른 줄들) 앞에 ☐ - 모두 붙어 있으면 뗀다 */}
                <button
                  type="button"
                  data-checklist-toggle
                  // 누르는 동안 글 칸의 커서·고른 범위를 잃지 않게
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={toggleChecklist}
                  title={withShortcut('체크리스트 - 커서가 있는 줄 앞에 ☐', 'checklist')}
                  className="px-2 py-0.5 text-xs font-bold text-slate-600 bg-white hover:bg-slate-50 border border-slate-200 rounded-md cursor-pointer"
                >
                  ☑ 체크리스트
                </button>
              </div>
              <AutoTextarea
                ref={textRef}
                autoFocus
                data-note-text-input
                value={form.text}
                onChange={(e) => setForm((f) => ({ ...f, text: e.target.value }))}
                onKeyDown={onTextKeyDown}
                // 줄 맨 앞 ☐/☑ 바로 위를 누르면 바꾼다 (쓰는 칸 안에서도 체크)
                onClick={onTextClick}
                placeholder={PLACEHOLDER[noun]}
                className="w-full min-h-[84px] p-4 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-slate-800 leading-relaxed placeholder-slate-400 text-sm"
              />
              {/* 첫·마지막 줄 '#라벨' 미리 보기 - 저장하면 무엇이 일어날지 */}
              {hashPreview.length > 0 && (
                <div data-hash-preview className="flex flex-wrap items-center gap-1 text-2xs font-bold text-slate-500">
                  <span>저장하면 #줄을 라벨로:</span>
                  {hashPreview.map((n) => {
                    const isNew = !isKnownLabel(tree, n);
                    return (
                      <span
                        key={n}
                        data-hash-label={n}
                        data-new={isNew || undefined}
                        className={`px-1.5 py-0.5 rounded border ${isNew ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}
                      >
                        #{n}
                        {isNew ? ' (새로 만듦)' : ''}
                      </span>
                    );
                  })}
                </div>
              )}
              <p className="text-2xs text-slate-400">첫 줄·마지막 줄의 #이름은 라벨이 됩니다. ☐ 줄 끝에서 Enter를 누르면 다음 줄도 ☐로 시작합니다.</p>
              {/* 붙인 표 - 작게 보기·빼기 (칸 글자·행/열 고치기와 붙여넣기는 P4-2) */}
              {form.tables.map((t, i) => (
                <div key={t.id} data-note-table={t.id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-600">
                    <span>▦ {form.tables.length > 1 ? `표 ${i + 1}` : '표'}</span>
                    <button
                      type="button"
                      data-note-table-remove={t.id}
                      onClick={() => setForm((f) => ({ ...f, tables: f.tables.filter((x) => x.id !== t.id) }))}
                      className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-bold cursor-pointer"
                      title="표 삭제"
                      aria-label="표 삭제"
                    >
                      ✕
                    </button>
                  </div>
                  <TablePreview table={t} />
                </div>
              ))}
            </div>

            <LabelPicker
              kind="note"
              tree={tree}
              selected={form.labelIds}
              onChange={(labelIds) => setForm((f) => ({ ...f, labelIds }))}
              newNames={form.newLabels}
              onNewNamesChange={(newLabels) => setForm((f) => ({ ...f, newLabels }))}
            />

            {/* 첨부 (빼기만 - 파일 올리기·캡처 붙여넣기는 P4-2), 링크 (P4-3) */}
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  data-note-attach
                  onClick={() => showToast('🚧 아직 V5로 옮기지 않은 기능입니다.')}
                  className="px-3 py-1.5 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer opacity-60"
                >
                  📎 파일 첨부
                </button>
                <button
                  type="button"
                  data-note-link-add
                  onClick={() => showToast('🚧 아직 V5로 옮기지 않은 기능입니다.')}
                  className="px-3 py-1.5 bg-yellow-50 text-yellow-600 hover:bg-yellow-100 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer opacity-60"
                >
                  🔗 링크 추가
                </button>
              </div>
              {form.attachments.map((att, idx) => (
                <div
                  key={`${att.url}-${idx}`}
                  data-note-attachment={att.name}
                  className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-xl gap-2"
                >
                  <a href={att.url} target="_blank" rel="noreferrer" className="text-xs font-semibold text-slate-700 hover:text-primary truncate" title={att.name}>
                    📎 {att.name}
                  </a>
                  <button
                    type="button"
                    data-note-attachment-remove
                    onClick={() => setForm((f) => ({ ...f, attachments: f.attachments.filter((_, i) => i !== idx) }))}
                    className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-bold cursor-pointer shrink-0"
                    title="첨부 빼기 (저장할 때)"
                    aria-label="첨부 빼기"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between gap-3 bg-slate-50/50">
          {isEditing && item ? (
            <button
              type="button"
              data-note-delete
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
              data-note-close
              onClick={close}
              disabled={saving}
              className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
            >
              닫기
            </button>
            <button
              type="button"
              data-note-save
              onClick={() => void save()}
              disabled={saving || !hasContent(form) || (isEditing && !item)}
              className="px-5 py-2 text-sm font-bold text-white bg-primary hover:bg-blue-600 rounded-xl shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {saving ? '저장 중...' : placeChanged ? '옮기고 저장' : '저장'}
            </button>
          </div>
        </div>
      </div>
    </SidePanelFrame>
  );
}
