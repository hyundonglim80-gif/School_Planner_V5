// 메모 틀 (P36-2 - 자주 쓰는 양식). 수정 칸 '메모 내용' 줄의 '📋 틀' 단추와 그 아래 펼치는 목록.
//   목록: 틀 이름을 누르면 그 틀로 채운다(쓰던 글·표가 있으면 묻는다 - NotePanel) · 💾 지금 글을 틀로 저장 · 줄마다 ✏️ 이름·▲▼·🗑️.
//   틀은 개인 공간 한 문서(data/noteTemplates) - 그룹 공간 메모에서도 내 틀. 셈은 domain/noteTemplate.
//   키: ↑↓ 틀 사이 · Enter 채우기 · ESC 목록 닫기(오른쪽 칸은 그대로 - 적던 것이 사라지지 않게).
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { showErrorToast } from '../../app/toast';
import { newId } from '../../data/id';
import { writeNoteTemplates } from '../../data/noteTemplates';
import type { LabelTree } from '../../data/select';
import {
  canSaveAsTemplate,
  cleanTemplateName,
  MAX_NOTE_TEMPLATES,
  nextTemplateOrder,
  templateFromForm,
  templateLimitError,
  templateMove,
  templateNameOf,
  templateRemove,
  templateRename,
  templateWrite,
  uniqueTemplateName,
  type NoteTemplate,
  type TemplateTarget,
} from '../../domain/noteTemplate';
import { listKeyOf } from '../../ui/listKeys';
import { useNoteTemplates } from './useNoteTemplates';
import { Glyph } from '../../ui/Icon';
import { PICK_ON } from '../../ui/buttons';

const FAIL = '메모 틀을 저장하지 못했습니다. 인터넷 연결을 확인하고 다시 눌러 주세요.';

/** '📋 틀' 단추 - 누르면 아래 목록을 펴고 접는다 */
export function NoteTemplateButton({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      data-note-template-open={open ? 'open' : 'closed'}
      aria-expanded={open}
      onClick={onToggle}
      title="메모 틀 - 자주 쓰는 양식으로 채우거나, 지금 글을 틀로 저장합니다"
      className={`px-2 py-0.5 text-xs font-bold border rounded-lg cursor-pointer ${
        open ? PICK_ON : 'text-slate-600 bg-white hover:bg-slate-50 border-slate-200'
      }`}
    >
      <Glyph e="📋" /> 틀
    </button>
  );
}

interface MenuProps {
  /** 지금 칸 (틀로 저장할 것) */
  form: TemplateTarget;
  tree: LabelTree;
  /** 칸을 연 공간 (라벨 id가 가리키는 곳) */
  sid: string;
  onApply: (tpl: NoteTemplate) => void;
  onClose: () => void;
}

export default function NoteTemplateMenu({ form, tree, sid, onApply, onClose }: MenuProps) {
  const { uid, raw, list, loaded } = useNoteTemplates();
  /** 틀로 저장을 막 눌렀나 (두 번 누르기로 같은 틀이 둘 생기지 않게 - 끊긴 동안 쓰기가 끝나지 않아도 막히지 않게 때로 본다) */
  const lastSave = useRef(0);
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const canSave = canSaveAsTemplate(form);

  // 펴면 첫 틀(없으면 저장 단추)에 초점 - 키보드로 곧바로 고른다
  const focused = useRef(false);
  useEffect(() => {
    if (focused.current || !loaded) return;
    focused.current = true;
    boxRef.current?.querySelector<HTMLButtonElement>('[data-note-template-use], [data-note-template-save]:not(:disabled)')?.focus();
  }, [loaded]);

  const write = async (changes: Record<string, unknown>, opts: { message?: string; what: string }) => {
    if (!uid) return;
    // 틀마다 칸만 적으니 쓰기끼리 기다리지 않는다 (끊긴 동안에도 이어 고칠 수 있게)
    try {
      await writeNoteTemplates(uid, changes, raw, { fail: FAIL, ...opts });
    } catch {
      // 안내는 저장 도우미가 했다
    }
  };

  const saveAs = () => {
    if (!canSave || Date.now() - lastSave.current < 800) return;
    lastSave.current = Date.now();
    const name = templateNameOf(form.text, list);
    const same = list.find((t) => t.name === name);
    const replace = !!same && window.confirm(`'${name}' 틀이 이미 있습니다.\n\n확인 = 그 틀을 지금 글로 바꿉니다\n취소 = 새 틀로 더합니다`);
    const target = replace ? same : null;
    const tpl = templateFromForm(form, tree, {
      id: target?.id ?? newId(),
      sid,
      name: target ? target.name : uniqueTemplateName(name, list),
      order: target ? target.order : nextTemplateOrder(list),
      now: Date.now(),
    });
    const err = templateLimitError(list, tpl);
    if (err) {
      showErrorToast(err);
      return;
    }
    void write(templateWrite(tpl, !!target), {
      message: target ? `📋 '${tpl.name}' 틀을 지금 글로 바꿨습니다.` : `📋 '${tpl.name}' 틀로 저장했습니다.`,
      what: target ? '메모 틀 바꾸기' : '메모 틀 저장',
    });
  };

  const commitRename = () => {
    if (!renaming) return;
    const t = list.find((x) => x.id === renaming.id);
    const name = cleanTemplateName(renaming.name);
    setRenaming(null);
    if (!t || !name || name === t.name) return;
    void write(templateRename(t.id, name), { what: '메모 틀 이름 바꾸기' });
  };

  const move = (t: NoteTemplate, step: -1 | 1) => {
    const changes = templateMove(list, t.id, step);
    if (changes && Object.keys(changes).length > 0) void write(changes, { what: '메모 틀 차례' });
  };

  /** ↑↓ = 틀 이름 사이 · ESC = 목록만 닫기 */
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.nativeEvent.isComposing || renaming) return;
    const key = listKeyOf(e.key);
    if (key === 'close') {
      e.preventDefault();
      e.stopPropagation();
      onClose();
      return;
    }
    if (key !== 'next' && key !== 'prev') return;
    const names = Array.from(boxRef.current?.querySelectorAll<HTMLButtonElement>('[data-note-template-use]') ?? []);
    if (names.length === 0) return;
    e.preventDefault();
    e.stopPropagation();
    const at = names.indexOf(document.activeElement as HTMLButtonElement);
    const next = at < 0 ? 0 : (at + (key === 'next' ? 1 : -1) + names.length) % names.length;
    names[next].focus();
  };

  return (
    <div
      ref={boxRef}
      data-note-template-menu={loaded ? list.length : 'loading'}
      onKeyDown={onKeyDown}
      className="rounded-xl border border-slate-200 bg-slate-50/80 p-2.5 space-y-2"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-slate-600"><Glyph e="📋" /> 메모 틀 {loaded && list.length > 0 ? `${list.length}개` : ''}</span>
        <button
          type="button"
          data-note-template-close
          onClick={onClose}
          title="틀 목록 닫기"
          aria-label="틀 목록 닫기"
          className="w-6 h-6 flex items-center justify-center rounded-full text-slate-500 hover:text-slate-700 hover:bg-slate-200/70 cursor-pointer"
        >
          ✕
        </button>
      </div>
      {!loaded ? (
        <p data-note-template-loading className="text-xs text-slate-500">
          틀을 받는 중...
        </p>
      ) : list.length === 0 ? (
        <p data-note-template-empty className="text-xs text-slate-500">
          저장한 틀이 없습니다. 자주 쓰는 양식을 적고 &apos;<Glyph e="💾" /> 지금 글을 틀로 저장&apos;을 누르세요.
        </p>
      ) : (
        <ul className="space-y-1">
          {list.map((t, i) => (
            <li key={t.id} data-note-template={t.id} className="flex items-center gap-1 rounded-lg bg-white border border-slate-200 pl-1 pr-0.5 py-0.5">
              {renaming?.id === t.id ? (
                <input
                  data-note-template-name-input
                  autoFocus
                  value={renaming.name}
                  maxLength={40}
                  onChange={(e) => setRenaming({ id: t.id, name: e.target.value })}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.nativeEvent.isComposing) return;
                    const key = listKeyOf(e.key);
                    if (key === 'pick') {
                      e.preventDefault();
                      commitRename();
                    } else if (key === 'close') {
                      // 이름 고치기만 그만 - 목록·칸은 그대로
                      e.preventDefault();
                      e.stopPropagation();
                      setRenaming(null);
                    }
                  }}
                  className="flex-1 min-w-0 px-1.5 py-1 text-xs border border-primary rounded-lg focus:outline-none"
                />
              ) : (
                <button
                  type="button"
                  data-note-template-use={t.id}
                  onClick={() => onApply(t)}
                  title={`'${t.name}' 틀로 채우기${t.labels.length > 0 ? ` (라벨 ${t.labels.map((l) => l.name).join(', ')})` : ''}`}
                  className="flex-1 min-w-0 text-left px-1.5 py-1 text-xs font-bold text-slate-700 hover:text-primary rounded-lg hover:bg-slate-50 focus:bg-slate-50 cursor-pointer truncate"
                >
                  {t.name}
                  {t.tables.length > 0 && <span className="ml-1 font-normal text-slate-500">· 표 {t.tables.length}</span>}
                </button>
              )}
              <button
                type="button"
                data-note-template-rename={t.id}
                onClick={() => setRenaming({ id: t.id, name: t.name })}
                title="이름 바꾸기"
                aria-label={`${t.name} 이름 바꾸기`}
                className="w-6 h-6 flex items-center justify-center rounded text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100 cursor-pointer shrink-0"
              >
                <Glyph e="✏" />
              </button>
              <button
                type="button"
                data-note-template-move="up"
                disabled={i === 0}
                onClick={() => move(t, -1)}
                title="위로"
                aria-label={`${t.name} 위로`}
                className="w-6 h-6 flex items-center justify-center rounded text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 cursor-pointer shrink-0"
              >
                <Glyph e="▲" />
              </button>
              <button
                type="button"
                data-note-template-move="down"
                disabled={i === list.length - 1}
                onClick={() => move(t, 1)}
                title="아래로"
                aria-label={`${t.name} 아래로`}
                className="w-6 h-6 flex items-center justify-center rounded text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 cursor-pointer shrink-0"
              >
                <Glyph e="▼" />
              </button>
              <button
                type="button"
                data-note-template-remove={t.id}
                onClick={() => void write(templateRemove(t.id), { message: `🗑️ '${t.name}' 틀을 지웠습니다.`, what: '메모 틀 지우기' })}
                title="틀 지우기 (안내의 '되돌리기'로 되살립니다)"
                aria-label={`${t.name} 지우기`}
                className="w-6 h-6 flex items-center justify-center rounded text-xs text-slate-500 hover:text-rose-600 hover:bg-rose-50 cursor-pointer shrink-0"
              >
                <Glyph e="🗑" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        data-note-template-save
        disabled={!canSave || !loaded}
        onClick={saveAs}
        title={canSave ? '지금 글·라벨·표를 틀로 저장합니다 (첫 줄이 틀 이름)' : '글이나 표를 먼저 적어 주세요'}
        className="w-full py-1.5 text-xs font-bold text-primary bg-white hover:bg-blue-50 border border-dashed border-blue-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      >
        <Glyph e="💾" /> 지금 글을 틀로 저장
      </button>
      <p className="text-2xs text-slate-500">
        첨부·날짜·완료는 담지 않습니다 · 틀은 {MAX_NOTE_TEMPLATES}개까지
      </p>
    </div>
  );
}
