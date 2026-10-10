// 메모·기록을 쓰는 칸 (V4 components/EntryDrawer.tsx - 메모와 기록이 같은 칸). 쓰는 칸 'note'.
//
// - 어느 화면에서든 이 칸 하나로 새로 쓰고 고친다. 칸을 연 순간의 공간에 저장한다.
// - 머리: 제목 · ☐ 완료 · ☆ 즐겨찾기(고치던 항목은 누르는 즉시 그 칸만 저장, 새 항목은 처음 저장 때 함께) · 📅 날짜 = 자리.
//   날짜를 넣으면 그날 기록, 빼면 메모 - 고치던 항목은 저장할 때 옮긴다(date만, 안내의 되돌리기 = 자리만).
// - 내용: ☑ 체크리스트(단추·단축키·Enter 이어 쓰기·☐ 누르기) · 첫·마지막 줄 '#라벨' 미리 보기 · 글 안 주소의 미리보기.
// - 붙이기(P4-2 - attach.ts): 📎 파일 첨부·캡처 Ctrl+V = 드라이브에 원본으로, 엑셀 표 Ctrl+V = 표(그림보다 먼저) - 칸 글자·행/열 고치기.
//   올리는 동안은 저장하지 않는다(올라간 것이 빠진 채 저장되지 않게).
// - 라벨(여러 개, '+ 새 라벨') - 저장할 때 새 라벨과 항목을 한 묶음으로.
// - 저장하면 칸은 닫히지 않고 그 항목의 수정 칸이 된다(V4 사용자 결정). 저장 = 바뀐 칸만, 문서 하나(+ 새 라벨).
// - 저장이 안 되면 칸을 닫지 않는다. ESC는 저장 안 한 글이 있으면 먼저 묻는다, 좁은 화면 배경 = 저장하고 닫기.
// - 이 칸이 열린 동안 다른 기기에서 고친 것은, 손대기 전이면 따라간다(손댔으면 적던 것을 덮지 않는다).
// - 쓰던 글은 2초 뒤 이 기기에 남긴다(data/drafts) - 다시 열면 '저장하지 않은 글이 있습니다 - 되살리기'.
// - 🧑‍🎓 학생(P7-1 - studentIds '{classId}/{sid}'): 글 칸에서 '@이름'(초성·번호도) → 목록 → 고르면 '@김지'가 이름으로 바뀌고 학생 칩이 붙는다.
//   '+ 학생 고르기'로도, 칩 ✕로 뺀다. 글에 적은 '#26040305'(V4 태그)는 저장할 때 명렬표의 그 학생을 더한다(글은 그대로).
import { useEffect, useLayoutEffect, useRef, useState, type ChangeEvent, type ClipboardEvent, type KeyboardEvent, type MouseEvent } from 'react';
import { registerUnsavedCheck, type WindowProps } from '../../app/windows';
import { showErrorToast, showErrorToastOnce, showToast } from '../../app/toast';
import { useShortcutTitle } from '../../app/keys';
import { fileIcon, formatFileSize, isImageAttachment } from '../../domain/attachments';
import { continueOnEnter, toggleCheckAtCaret, toggleLinesPrefix } from '../../domain/checkLines';
import { academicYearOf, shortDateLabel, todayStr } from '../../domain/dateUtils';
import { applyMention, findMention, matchMentionStudents, studentIdsToSave, type Mention, type MentionCandidate } from '../../domain/studentTag';
import { useDraft } from '../../data/drafts';
import { attachmentImageSrc } from '../../data/google/drive';
import type { Attachment } from '../../data/types';
import { useDocs, useItemsOn, useLabelTree, useMemos, useMirrorStatus } from '../../data/select';
import AutoTextarea from '../../ui/AutoTextarea';
import { listKeyOf } from '../../ui/listKeys';
import DraftOffer from '../../ui/DraftOffer';
import { openImageViewer } from '../../ui/imageViewer';
import LinkPreviewCards from '../../ui/LinkPreviewCards';
import SidePanelFrame from '../../ui/SidePanelFrame';
import LabelPicker from '../labels/LabelPicker';
import { orderAfter } from '../events/eventOps';
import { createNote, deleteNote, saveNote, setNoteDone, setNoteFavorite } from './actions';
import { extractImageFiles, pastedTable, tablePastedText, uploadAttachments } from './attach';
import EntryTableView from './EntryTableView';
import { deliverLinkPick, openLinker, openLinkViewer } from '../links/open';
import { hasContent, isKnownLabel, newNoteForm, noteFormOf, sameNoteForm, savePlanOf, type NoteForm } from './noteForm';
import { nounOf, objectOf } from './noteOps';
import { StudentMentionList, StudentTagRow } from './StudentTags';
import { useClasses, useHubClass, type ClassItem } from '../class/classes';
import type { NotePanelParams } from './open';

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
  /** 드라이브에 올리는 중 (📎 파일 / 붙여넣은 캡처) */
  const [uploading, setUploading] = useState<'files' | 'paste' | null>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const { classes } = useClasses();
  const hubClass = useHubClass((s) => s.id);
  const dayNotes = useItemsOn(form.date, 'note', sid);
  const memoList = useMemos(sid);
  // 쓰던 글 보관 (이 기기 - data/drafts). 새 칸은 공간·자리, 고치는 칸은 항목마다. 고치던 항목의 완료·즐겨찾기는 칸의 것이 아니라 빼고 둔다
  const draft = useDraft<NoteForm>(
    `note:${sid}:${params.id ?? `new:${form.date || 'memo'}`}`,
    isEditing ? { ...form, done: false, favorite: false } : form,
    !untouched,
  );
  const restoreDraft = () => {
    const kept = draft.take();
    if (!kept) return;
    setForm((f) => ({ ...f, ...kept, ...(isEditing ? { done: f.done, favorite: f.favorite } : {}) }));
    if (!isEditing && kept.date !== form.date) setParams({ ...params, date: kept.date || null });
  };

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
  // ─── '@이름' 학생 태그 (domain/studentTag) - 키보드는 글 칸이 받는다(목록으로 초점을 옮기면 한글 조합이 끊긴다) ───
  const [mention, setMention] = useState<Mention | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const schoolYear = academicYearOf(todayStr());
  const mentionList = mention ? matchMentionStudents(classes, mention.query, { preferClassId: hubClass, schoolYear }) : [];
  const updateMention = (el: HTMLTextAreaElement) => {
    const next = findMention(el.value, el.selectionStart ?? el.value.length);
    if (!next || next.query !== mention?.query || next.start !== mention?.start) setMentionIndex(0);
    setMention(next);
  };
  const pickMention = (c: MentionCandidate<ClassItem>) => {
    if (!mention) return;
    const r = applyMention(form.text, mention, c.student.name || `${c.student.num}번`);
    setMention(null);
    pendingCaret.current = [r.caret, r.caret];
    setForm((f) => ({ ...f, text: r.text, studentIds: f.studentIds.includes(c.key) ? f.studentIds : [...f.studentIds, c.key] }));
  };
  /** 목록이 떠 있을 때의 키 - 받았으면 true */
  const onMentionKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>): boolean => {
    if (!mention || e.nativeEvent.isComposing) return false;
    const key = listKeyOf(e.key);
    if (key === 'close') {
      // 목록만 닫는다 - 오른쪽 줄 전체가 닫히면(전역 ESC) 적던 것이 사라진다
      e.preventDefault();
      e.stopPropagation();
      setMention(null);
      return true;
    }
    if (mentionList.length === 0 || !key) return false;
    if (key === 'next' || key === 'prev') {
      e.preventDefault();
      const step = key === 'next' ? 1 : -1;
      setMentionIndex((i) => (i + step + mentionList.length) % mentionList.length);
      return true;
    }
    // Enter·Tab = 넣기
    if (!e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
      e.preventDefault();
      pickMention(mentionList[Math.min(mentionIndex, mentionList.length - 1)]);
      return true;
    }
    return false;
  };

  const onTextKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (onMentionKeyDown(e)) return;
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

  /** 그림 크게 보기 - 이 칸의 그림들을 넘겨 본다 */
  const viewImage = (att: Attachment) => {
    const pics = form.attachments.filter(isImageAttachment);
    openImageViewer(
      pics.map((a) => ({ url: attachmentImageSrc(a), name: a.name })),
      pics.indexOf(att),
    );
  };

  // 공유받은 파일 (P8-3 - 저장은 사용자가: 누르면 드라이브에 올려 첨부)
  const [sharedFiles, setSharedFiles] = useState<File[]>(() => (isEditing ? [] : (params.draftFiles ?? [])));
  // ─── 붙이기 (attach.ts) ───
  const attach = async (files: File[], pasted: boolean) => {
    if (files.length === 0) return;
    setUploading(pasted ? 'paste' : 'files');
    try {
      const added = await uploadAttachments(files, pasted);
      if (added.length > 0) setForm((f) => ({ ...f, attachments: [...f.attachments, ...added] }));
    } finally {
      setUploading(null);
    }
  };
  const onPickFiles = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = '';
    void attach(files, false);
  };
  /** 표가 먼저(엑셀은 그림도 함께 복사한다), 그다음 캡처 그림, 나머지(글자)는 그대로 */
  const onTextPaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const table = pastedTable(e.clipboardData);
    if (table === 'text') return;
    if (table && 'error' in table) {
      e.preventDefault();
      showErrorToast(table.error);
      return;
    }
    if (table) {
      e.preventDefault();
      setForm((f) => ({ ...f, tables: [...f.tables, table] }));
      showToast(tablePastedText(table));
      return;
    }
    const images = extractImageFiles(e.clipboardData);
    if (images.length === 0) return;
    e.preventDefault();
    void attach(images, true);
  };

  // ─── 링크 (links/) ───
  /** 처음 저장해 만든 항목 (🔗 링크 추가가 새 항목을 먼저 저장한 뒤 그 항목에 잇는다) */
  const savedId = useRef<string | null>(null);
  /** 🔗 링크 추가 - 고치던 항목은 곧바로 연결 창, 새 항목은 먼저 저장하고(그 항목의 수정 칸이 된다) 연결 창 */
  const addLink = async () => {
    if (isEditing && params.id) {
      openLinker({ sid, id: params.id });
      return;
    }
    if (await save()) {
      if (savedId.current) openLinker({ sid, id: savedId.current });
    }
  };

  // ─── 저장 ───
  /** 저장한다. 저장했거나 저장할 것이 없으면 true */
  const save = async (): Promise<boolean> => {
    if (!hasContent(form)) {
      // 지우기는 삭제 단추로만 한다. 내용을 다 지운 채 저장해도 항목은 남는다
      showToast(`${noun} 내용을 입력하세요.`);
      return false;
    }
    if (uploading) {
      showToast('파일을 올리는 중입니다. 끝난 뒤 저장해 주세요.');
      return false;
    }
    // 앞선 저장이 끝나기 전에 또 들어오면 같은 항목이 두 개 생긴다
    if (savingRef.current) return false;
    savingRef.current = true;
    setSaving(true);
    // 글에 새로 적은 '#26040305'(V4 태그)의 학생도 더한다 - 원래 있던 태그는 다시 읽지 않는다
    const toSave = { ...form, studentIds: studentIdsToSave(form.studentIds, form.text, base.text, classes) };
    try {
      if (!isEditing) {
        const order = orderAfter(form.date ? dayNotes : memoList);
        const saved = await createNote(sid, toSave, tree, order);
        draft.clear();
        // 저장한 뒤에도 적은 것이 남고 그 항목의 수정 칸이 된다 (V4 사용자 결정). '#라벨' 줄은 떼고 칩으로
        const next = { ...toSave, text: saved.text, labelIds: saved.labelIds, newLabels: [] };
        setForm(next);
        setBase(next);
        deliverLinkPick(params.pickFor, saved.id);
        savedId.current = saved.id;
        setParams({ sid, date: form.date || null, id: saved.id });
      } else {
        if (!item) {
          showToast(`${noun}를 찾지 못했습니다. 그 사이 지워졌을 수 있습니다.`);
          return false;
        }
        const saved = await saveNote(sid, item, toSave, tree);
        draft.clear();
        const next = saved ? { ...toSave, text: saved.text, labelIds: saved.labelIds, newLabels: [] } : toSave;
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
            {draft.offer && <DraftOffer savedAt={draft.offer.savedAt} onRestore={restoreDraft} onDiscard={draft.discard} />}
            {sharedFiles.length > 0 && (
              <div data-note-shared-files={sharedFiles.length} className="flex flex-wrap items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">
                <span className="font-bold">📥 공유받은 파일 {sharedFiles.length}개</span>
                <span className="text-sky-700 truncate">{sharedFiles.map((f) => f.name).join(', ')}</span>
                <button
                  type="button"
                  data-note-shared-attach
                  disabled={!!uploading}
                  onClick={() => {
                    const files = sharedFiles;
                    setSharedFiles([]);
                    void attach(files, false);
                  }}
                  className="ml-auto px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-bold disabled:opacity-50 cursor-pointer"
                >
                  드라이브에 올려 첨부
                </button>
                <button type="button" data-note-shared-drop onClick={() => setSharedFiles([])} className="px-2 py-1 rounded-lg hover:bg-sky-100 font-bold cursor-pointer">
                  버리기
                </button>
              </div>
            )}
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
              <div className="relative">
                <AutoTextarea
                  ref={textRef}
                  autoFocus
                  data-note-text-input
                  value={form.text}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, text: e.target.value }));
                    updateMention(e.target);
                  }}
                  onKeyDown={onTextKeyDown}
                  // 줄 맨 앞 ☐/☑ 바로 위를 누르면 바꾼다 (쓰는 칸 안에서도 체크)
                  onClick={onTextClick}
                  // 커서만 옮겨도(누르기·화살표) '@' 밖으로 나가면 목록을 닫는다
                  onSelect={(e) => mention && updateMention(e.currentTarget)}
                  onBlur={() => setMention(null)}
                  onPaste={onTextPaste}
                  placeholder={PLACEHOLDER[noun]}
                  className="w-full min-h-[84px] p-4 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-slate-800 leading-relaxed placeholder-slate-400 text-sm"
                />
                {mention && <StudentMentionList query={mention.query} candidates={mentionList} activeIndex={mentionIndex} hasClasses={classes.length > 0} onPick={pickMention} />}
              </div>
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
              <p className="text-2xs text-slate-400">
                첫 줄·마지막 줄의 #이름은 라벨이 됩니다. ☐ 줄 끝에서 Enter를 누르면 다음 줄도 ☐로 시작합니다. @이름으로 학생을 붙입니다. 캡처·엑셀 표는 Ctrl+V로 붙입니다.
              </p>
              {/* 글 안 주소 미리보기 (보이기만 - 글은 바꾸지 않는다) */}
              <LinkPreviewCards text={form.text} />
              {/* 붙인 표 - 칸을 눌러 글자를 고치고 행·열을 넣고 뺀다 */}
              {form.tables.map((t, i) => (
                <EntryTableView
                  key={t.id}
                  table={t}
                  title={form.tables.length > 1 ? `표 ${i + 1}` : '표'}
                  onChange={(next) => setForm((f) => ({ ...f, tables: f.tables.map((x) => (x.id === t.id ? next : x)) }))}
                  onRemove={() => setForm((f) => ({ ...f, tables: f.tables.filter((x) => x.id !== t.id) }))}
                />
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

            <StudentTagRow studentIds={form.studentIds} onChange={(studentIds) => setForm((f) => ({ ...f, studentIds }))} year={schoolYear} />

            {/* 첨부 (드라이브 School_Planner 폴더) · 링크 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="block text-xs font-semibold text-slate-600">첨부 ({form.attachments.length}개)</span>
                {uploading === 'paste' && (
                  <span data-note-uploading="paste" className="text-xs font-bold text-primary">
                    ⏳ 붙여넣은 이미지 업로드 중...
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <label
                  data-note-attach
                  aria-disabled={!!uploading}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition-colors border border-dashed border-slate-300 shadow-2xs ${
                    uploading ? 'opacity-60 cursor-wait' : 'cursor-pointer'
                  }`}
                  title="파일을 골라 구글 드라이브(School_Planner 폴더)에 올려 붙입니다. 여러 개를 한 번에 골라도 됩니다."
                >
                  <span>{uploading === 'files' ? '⏳' : '📎'}</span>
                  <span data-note-uploading={uploading === 'files' ? 'files' : undefined}>{uploading === 'files' ? '업로드 중...' : '파일 첨부'}</span>
                  <input type="file" multiple data-note-file-input onChange={onPickFiles} className="hidden" disabled={!!uploading} />
                </label>
                <button
                  type="button"
                  data-note-link-add
                  onClick={() => void addLink()}
                  disabled={saving || !!uploading}
                  title={isEditing ? `이 ${noun}에 일정·기록·메모를 잇습니다` : `먼저 저장하고 이 ${noun}에 일정·기록·메모를 잇습니다`}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-slate-50 hover:bg-yellow-50 text-slate-700 hover:text-yellow-800 rounded-xl text-xs font-bold transition-colors cursor-pointer border border-dashed border-slate-300 hover:border-yellow-300 shadow-2xs"
                >
                  <span>🔗</span>
                  <span>링크 추가</span>
                </button>
              </div>
              {(item?.linkIds?.length ?? 0) > 0 && (
                <button
                  type="button"
                  data-note-links-open={item?.linkIds?.length}
                  onClick={() => item && openLinkViewer({ sid, id: item.id })}
                  className="w-full flex items-center justify-center gap-2 py-2 bg-yellow-50 hover:bg-yellow-100 text-yellow-800 rounded-xl text-xs font-bold transition-colors cursor-pointer border border-yellow-200"
                >
                  📑 연결된 항목 {item?.linkIds?.length}개 보기
                </button>
              )}
              {form.attachments.map((att, idx) =>
                // 그림은 무엇인지 바로 알아보게 크게, 파일은 종류 그림 + 이름 (누르면 새 탭)
                isImageAttachment(att) ? (
                  <div key={`${att.url}-${idx}`} data-note-attachment={att.name} data-note-attachment-image className="relative bg-slate-50 border border-slate-200 rounded-xl overflow-hidden">
                    <button type="button" data-note-attachment-view onClick={() => viewImage(att)} className="block w-full cursor-pointer" title="눌러서 크게 보기">
                      <img src={attachmentImageSrc(att)} alt={att.name} className="w-full max-h-64 object-contain bg-white" loading="lazy" />
                    </button>
                    <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 border-t border-slate-200">
                      <span className="text-xs text-slate-500 truncate" title={att.name}>
                        🖼️ {att.name}
                        {att.size ? ` · ${formatFileSize(att.size)}` : ''}
                      </span>
                      <button
                        type="button"
                        data-note-attachment-remove
                        onClick={() => setForm((f) => ({ ...f, attachments: f.attachments.filter((_, i) => i !== idx) }))}
                        className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-bold cursor-pointer shrink-0"
                        title="그림 빼기 (저장할 때)"
                        aria-label="그림 빼기"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    key={`${att.url}-${idx}`}
                    data-note-attachment={att.name}
                    className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-xl gap-2 hover:bg-slate-100/80 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <span className="text-xl shrink-0" aria-hidden>
                        {fileIcon(att)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <a href={att.url} target="_blank" rel="noreferrer" className="text-xs font-bold text-slate-800 hover:text-primary truncate block hover:underline" title={att.name}>
                          {att.name}
                        </a>
                        {att.size ? <span className="text-xs text-slate-400 block">{formatFileSize(att.size)}</span> : null}
                      </div>
                    </div>
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
                ),
              )}
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
