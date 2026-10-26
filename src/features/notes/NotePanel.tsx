// 메모를 쓰는 칸 (V4 components/EntryDrawer.tsx - 메모와 기록이 같은 칸, P10-3부터 '메모' 하나). 쓰는 칸 'note'.
//
// - 어느 화면에서든 이 칸 하나로 새로 쓰고 고친다. 칸을 연 순간의 공간에 저장한다.
// - 머리: 제목 · ☐ 완료 · ☆ 즐겨찾기(고치던 항목은 누르는 즉시 그 칸만 저장, 새 항목은 처음 저장 때 함께) · 📅 날짜 링크.
//   날짜 칩 여러 개(+ 날짜 = 작은 달력, 칩 × = 그 날짜 빼기) - 그 날마다 하루 '메모' 칸에 보인다. 다 빼면 메모 화면에만(domain/noteDates).
//   하루 '메모' 칸에서 + 추가 = 그 날짜 링크 하나로 새 메모.
// - 내용: ☑ 체크리스트(단추·단축키·Enter 이어 쓰기·☐ 누르기) · 첫·마지막 줄 '#라벨' 미리 보기 · 글 안 주소의 미리보기.
// - 붙이기(P4-2 - attach.ts): 📎 파일 첨부·캡처 Ctrl+V = 드라이브에 원본으로, 엑셀 표 Ctrl+V = 표(그림보다 먼저) - 칸 글자·행/열 고치기.
//   올리는 동안은 저장하지 않는다(올라간 것이 빠진 채 저장되지 않게).
//   ✏️ 손글씨 = 화면 가득 그림판(HandwritingPad) - ✓ 첨부하면 PNG로 드라이브에 올려 붙인다. 그리던 것은 이 칸이 들고 있어 닫았다 열어도 이어진다.
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
import { caretAfterCheck, checkGlyphLineAt, continueOnEnter, hasCheckLines, moveCheckLine, toggleCheckMoving, toggleLinesPrefix } from '../../domain/checkLines';
import { academicYearOf, shortDateLabel, todayStr } from '../../domain/dateUtils';
import { addNoteDate, removeNoteDate } from '../../domain/noteDates';
import { applyMention, findMention, matchMentionStudents, studentIdsToSave, type Mention, type MentionCandidate } from '../../domain/studentTag';
import { useDraft } from '../../data/drafts';
import { attachmentImageSrc } from '../../data/google/drive';
import type { Attachment } from '../../data/types';
import { useDocs, useItemsOn, useLabelTree, useMemos, useMirrorStatus } from '../../data/select';
import MiniCalendarPicker from '../../ui/MiniCalendarPicker';
import AutoTextarea from '../../ui/AutoTextarea';
import { listKeyOf } from '../../ui/listKeys';
import DraftOffer from '../../ui/DraftOffer';
import { openImageViewer } from '../../ui/imageViewerStore';
import LinkPreviewCards from '../../ui/LinkPreviewCards';
import SidePanelFrame from '../../ui/SidePanelFrame';
import ClaudeAskButton from './ClaudeAskButton';
import ClaudeRequestNote from './ClaudeRequestNote';
import LabelPicker from '../labels/LabelPicker';
import { orderAfter, orderBefore } from '../events/eventOps';
import { createNote, deleteNote, saveNote, setNoteDone, setNoteFavorite } from './actions';
import { extractImageFiles, pastedTable, tablePastedText, uploadAttachments } from './attach';
import EntryTableView from './EntryTableView';
import { deliverLinkPick, openLinker, openLinkViewer } from '../links/open';
import { hasContent, isKnownLabel, newNoteForm, noteFormOf, sameNoteForm, savePlanOf, type NoteForm } from './noteForm';
import { StudentMentionList, StudentTagRow } from './StudentTags';
import CheckLinesOverlay, { CHECK_TEXT_CLASS } from './CheckLinesOverlay';
import { useClasses, useHubClass, type ClassItem } from '../class/classes';
import { hasInk, type PenStroke } from '../../domain/handwriting';
import HandwritingPad from './HandwritingPad';
import type { NotePanelParams } from './open';

const PLACEHOLDER = '자유롭게 생각을 적어 보세요...';
const noun = '메모';

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
  /** 드라이브에 올리는 중 (📎 파일 / 붙여넣은 캡처 / ✏️ 손글씨) */
  const [uploading, setUploading] = useState<'files' | 'paste' | 'pen' | null>(null);
  /** ✏️ 손글씨 그림판을 열었나 · 그리던 것 (첨부하면 비운다) */
  const [penOpen, setPenOpen] = useState(false);
  const [penStrokes, setPenStrokes] = useState<PenStroke[]>([]);
  const penDirty = hasInk(penStrokes);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const { classes } = useClasses();
  const hubClass = useHubClass((s) => s.id);
  // 새 메모의 차례 = 연 날(그 날짜 링크가 남아 있으면 - 아니면 첫 날짜) 목록의 맨 뒤, 날짜가 없으면 메모 목록의 맨 뒤
  const anchorDate = params.date && form.dates.includes(params.date) ? params.date : (form.dates[0] ?? '');
  const dayNotes = useItemsOn(anchorDate, 'note', sid);
  const memoList = useMemos(sid);
  // 쓰던 글 보관 (이 기기 - data/drafts). 새 칸은 공간·자리, 고치는 칸은 항목마다. 고치던 항목의 완료·즐겨찾기는 칸의 것이 아니라 빼고 둔다
  const draft = useDraft<NoteForm>(
    `note:${sid}:${params.id ?? `new:${params.date || 'memo'}`}`,
    isEditing ? { ...form, done: false, favorite: false } : form,
    !untouched,
  );
  const restoreDraft = () => {
    const kept = draft.take() as (NoteForm & { date?: string }) | null;
    if (!kept) return;
    // P10-3 전에 남긴 글은 날짜 칸 하나(date)였다
    const dates = kept.dates ?? (kept.date ? [kept.date] : []);
    setForm((f) => ({ ...f, ...kept, dates, ...(isEditing ? { done: f.done, favorite: f.favorite } : {}) }));
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

  const done = isEditing ? !!item?.done : form.done;
  const favorite = isEditing ? !!item?.favorite : form.favorite;
  const hashPreview = savePlanOf({ ...form, newLabels: [] }).names;

  /** 날짜 링크 더하기·빼기 - 저장할 때 적는다 */
  const addDate = (d: string) => setForm((f) => ({ ...f, dates: addNoteDate(f.dates, d) }));
  const removeDate = (d: string) => setForm((f) => ({ ...f, dates: removeNoteDate(f.dates, d) }));

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
  // 줄 맨 앞 ☐/☑를 누르면 체크하기·풀기 - 그 줄을 무리 맨 아래로 옮긴다(P10-5 5b). 커서는 누른 자리 그대로(다음 줄을 이어 누를 수 있게)
  const onTextClick = (e: MouseEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    if (el.selectionStart !== el.selectionEnd) return;
    const line = checkGlyphLineAt(el.value, el.selectionStart);
    const r = line === null ? null : toggleCheckMoving(el.value, line);
    if (r) setTextAndCaret(r.text, el.selectionStart);
  };
  // 체크 줄 ▲▼ (5c) - 커서는 옮긴 줄로
  const moveCheck = (line: number, step: -1 | 1) => {
    const r = moveCheckLine(form.text, line, step);
    if (r) setTextAndCaret(r.text, caretAfterCheck(r.text, r.line));
  };
  const checkMode = hasCheckLines(form.text);
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
  /** 올려 붙인 개수를 돌려준다 */
  const attach = async (files: File[], pasted: boolean, from: 'files' | 'paste' | 'pen' = pasted ? 'paste' : 'files'): Promise<number> => {
    if (files.length === 0) return 0;
    setUploading(from);
    try {
      const added = await uploadAttachments(files, pasted);
      if (added.length > 0) setForm((f) => ({ ...f, attachments: [...f.attachments, ...added] }));
      return added.length;
    } finally {
      setUploading(null);
    }
  };
  /** ✏️ 손글씨 ✓ 첨부 - 올라가면 그리던 것을 비운다(실패하면 남겨 다시 첨부할 수 있게) */
  const attachHandwriting = async (file: File) => {
    setPenOpen(false);
    if ((await attach([file], false, 'pen')) > 0) setPenStrokes([]);
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
      // 제목·글·첨부·표를 다 지우고 저장 = 그 메모 지우기(휴지통 + 되돌리기, 칸은 deleteNote가 닫는다 - P10-5 사용자 의견 5d).
      // 새 칸이면 만들 것이 없다 - 닫는다
      if (!isEditing) {
        close();
        return false;
      }
      if (!item) return false;
      await remove('🗑️ 내용을 모두 지워 메모를 휴지통으로 옮겼습니다.');
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
        // 하루 메모 칸은 그날 목록 맨 뒤, 메모 화면(날짜 없이 연 칸)은 맨 앞 - 최근 메모가 맨 위(P11-1 사용자 의견, V4 그대로)
        const order = anchorDate ? orderAfter(dayNotes) : orderBefore(memoList);
        const saved = await createNote(sid, toSave, tree, order);
        draft.clear();
        // 저장한 뒤에도 적은 것이 남고 그 항목의 수정 칸이 된다 (V4 사용자 결정). '#라벨' 줄은 떼고 칩으로
        const next = { ...toSave, text: saved.text, labelIds: saved.labelIds, newLabels: [] };
        setForm(next);
        setBase(next);
        deliverLinkPick(params.pickFor, saved.id);
        savedId.current = saved.id;
        setParams({ sid, date: params.date, id: saved.id });
      } else {
        if (!item) {
          showToast('메모를 찾지 못했습니다. 그 사이 지워졌을 수 있습니다.');
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
      showErrorToastOnce('메모를 저장하지 못했습니다. 적은 내용은 칸에 남아 있습니다.', e);
      return false;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  /** 지우기 = 지운 표시 (칸은 deleteNote가 닫는다). 못 지웠으면 칸을 닫지 않는다 */
  const remove = async (message?: string) => {
    if (!item || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      await deleteNote(sid, item, message);
    } catch {
      // 안내는 저장 도우미가 했다
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const saveIfChanged = async (): Promise<boolean> => {
    if (untouched) return true;
    // 내용을 다 지운 채면 save가 지우고(고치던 메모) 칸을 닫는다 - 여기서 또 닫지 않는다
    return save();
  };

  // ESC로 모두 닫기 전에 저장 안 한 글을 묻는다
  const unsaved = useRef<(() => boolean) | null>(null);
  useEffect(() => {
    // 고치던 메모를 다 지운 것도 저장하면 지워지니 묻는다
    unsaved.current = () => (!untouched && (hasContent(form) || isEditing)) || penDirty;
  });
  useEffect(() => registerUnsavedCheck(unsaved), []);

  const title = isEditing ? `${noun} 수정` : `새 ${noun}`;
  const subtitle = personal ? '개인' : '공유';

  return (
    <SidePanelFrame
      ariaLabel={title}
      onClose={close}
      onBackdropClose={() => void saveIfChanged().then((ok) => ok && close())}
      onSave={() => void save()}
      raise={raise}
    >
      <div data-note-panel={isEditing ? 'edit' : 'new'} data-note-id={params.id ?? ''} data-note-dates={form.dates.join(',')} className="flex flex-col h-full min-h-0">
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
                {/* 📅 날짜 링크 (P10-3): 칩마다 그날 하루 '메모' 칸에 보인다. 다 빼면 메모 화면에만 */}
                <div className="flex flex-wrap items-center gap-1.5 mt-1.5" data-note-dates-row>
                  <span className="text-xs font-bold text-slate-500">📅 날짜</span>
                  {form.dates.map((d) => (
                    <span
                      key={d}
                      data-note-date-chip={d}
                      className="inline-flex items-center gap-0.5 pl-2 pr-0.5 py-0.5 rounded-md bg-sky-50 border border-sky-200 text-xs font-bold text-sky-800"
                    >
                      {shortDateLabel(d)}
                      <button
                        type="button"
                        data-note-date-remove={d}
                        disabled={saving}
                        onClick={() => removeDate(d)}
                        title={`${shortDateLabel(d)} 빼기 - 그날 '메모' 칸에서 빠집니다 (저장할 때)`}
                        aria-label={`${shortDateLabel(d)} 빼기`}
                        className="w-4 h-4 flex items-center justify-center rounded text-sky-500 hover:text-sky-900 hover:bg-sky-100 cursor-pointer"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  <MiniCalendarPicker
                    date={form.dates[form.dates.length - 1] ?? params.date ?? todayStr()}
                    marked={form.dates}
                    hint="누르면 날짜 더하기"
                    onSelectDate={(d) => (form.dates.includes(d) ? removeDate(d) : addDate(d))}
                    trigger={{
                      data: 'note-date-add',
                      label: '+ 날짜',
                      title: "날짜를 더하면 그날 하루 '메모' 칸에도 보입니다 (여러 날 가능)",
                      disabled: saving,
                      className:
                        'px-1.5 py-0.5 text-xs font-bold text-slate-500 border border-dashed border-slate-300 rounded-md hover:text-primary hover:border-primary disabled:opacity-60 cursor-pointer',
                    }}
                  />
                  {form.dates.length === 0 && <span className="text-xs text-slate-400" data-note-dates-empty>날짜 없음 (메모 화면에만)</span>}
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
              <span className="block text-xs font-semibold text-slate-600">제목</span>
              <input
                type="text"
                data-note-title-input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="제목 (비워 두어도 됩니다)"
                maxLength={100}
                className="block w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-slate-800 text-sm font-bold placeholder-slate-400 placeholder:font-normal"
              />
            </div>
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
                {checkMode && <CheckLinesOverlay text={form.text} onMove={moveCheck} />}
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
                  placeholder={PLACEHOLDER}
                  data-check-mode={checkMode || undefined}
                  className={`block w-full min-h-[84px] p-4 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-slate-800 leading-relaxed placeholder-slate-400 text-sm ${checkMode ? CHECK_TEXT_CLASS : ''}`}
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
                {uploading === 'pen' && (
                  <span data-note-uploading="pen" className="text-xs font-bold text-primary">
                    ⏳ 손글씨 업로드 중...
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
                  data-note-handwriting
                  data-pen-dirty={penDirty ? '' : undefined}
                  onClick={() => setPenOpen(true)}
                  disabled={!!uploading}
                  title={penDirty ? '그리던 손글씨를 이어 그립니다. ✓ 첨부를 누르면 그림으로 붙습니다.' : '펜·손가락으로 쓴 것을 그림으로 바꿔 붙입니다 (구글 드라이브 School_Planner 폴더)'}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer border border-dashed shadow-2xs disabled:opacity-60 disabled:cursor-wait ${
                    penDirty ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-300' : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-300'
                  }`}
                >
                  <span>✏️</span>
                  <span>{penDirty ? '손글씨 (그리던 것)' : '손글씨'}</span>
                </button>
                <button
                  type="button"
                  data-note-link-add
                  onClick={() => void addLink()}
                  disabled={saving || !!uploading}
                  title={isEditing ? '이 메모에 일정·메모·수업을 잇습니다' : '먼저 저장하고 이 메모에 일정·메모·수업을 잇습니다'}
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

        {/* Claude 요청 결과 - 바꾼 것·바꾸지 않은 까닭을 다 (10-19) */}
        {personal && isEditing && item && (
          <div className="px-6 pb-3 empty:hidden">
            <ClaudeRequestNote itemId={item.id} />
          </div>
        )}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between gap-3 bg-slate-50/50">
          {isEditing && item ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                data-note-delete
                onClick={() => void remove()}
                disabled={saving}
                className="px-4 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-100 rounded-xl transition-colors cursor-pointer"
              >
                삭제
              </button>
              {personal && <ClaudeAskButton sid={sid} item={item} dirty={!untouched || saving} />}
            </div>
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
              disabled={saving || (!isEditing && !hasContent(form)) || (isEditing && !item)}
              title={isEditing && !hasContent(form) ? '내용을 모두 지웠습니다 - 저장하면 이 메모를 휴지통으로 옮깁니다' : undefined}
              className="px-5 py-2 text-sm font-bold text-white bg-primary hover:bg-blue-600 rounded-xl shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      </div>
      {penOpen && <HandwritingPad strokes={penStrokes} onChange={setPenStrokes} onClose={() => setPenOpen(false)} onDone={(file) => void attachHandwriting(file)} />}
    </SidePanelFrame>
  );
}
