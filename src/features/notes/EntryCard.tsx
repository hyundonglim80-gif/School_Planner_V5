// 메모·기록 카드 하나 (V4 components/EntryCard.tsx - 메모 화면과 하루 화면 기록 칸이 같은 카드를 쓴다).
//
//   머리줄: ▶ ▲▼ ☐완료 ☆ 라벨칩…  시각·'📅 10/6에서'  ☑ 2/5  🔗 (접혔을 때 🖼️)·📎·▦  ……  ✏️ 🗑️(마우스를 올리면)
//   - 단추·라벨 칩은 한 줄에(V4 10-07 사용자 요청), 시각·표시는 넘치면 다음 줄로. 라벨 칩은 위(머리줄)에 - 메모·기록 라벨 한 목록의 색.
//   - 지운 라벨·모르는 라벨은 그리지 않는다(부르는 쪽이 itemLabels로 고른다).
//   - 완료는 줄 긋기, ★ 즐겨찾기. 체크 줄(☐/☑)은 눌러서 체크 - 체크한 줄은 카드 아래쪽에 모아 보이기만 한다(V4 10-07, 구글 Keep처럼).
//   - 접기: 긴 글은 접힌 채 시작(부르는 쪽이 domain/entryCollapse로), 접힌 카드에는 첫 줄만.
// 그림은 누르면 크게 보기(넘겨 보기 - 접혔을 때는 🖼️ n을 눌러), 글 안 주소는 미리보기 카드, 표는 작게 보기만(고치기는 쓰는 칸에서).
import { Fragment, useState, type ReactNode } from 'react';
import { checkCount, checkLineState, hasCheckLines } from '../../domain/checkLines';
import { previewLine } from '../../domain/entryCollapse';
import { fileIcon, isImageAttachment } from '../../domain/attachments';
import { labelColor } from '../../domain/labels';
import { attachmentImageSrc } from '../../data/google/drive';
import FormattedText from '../../ui/FormattedText';
import { openImageViewer } from '../../ui/imageViewer';
import LinkPreviewCards from '../../ui/LinkPreviewCards';
import type { ItemDoc } from '../events/eventOps';
import { nounOf } from './noteOps';
import EntryTableView from './EntryTableView';
import { EntryStudents } from './StudentTags';

export interface EntryCardProps {
  item: ItemDoc;
  /** 붙은 라벨 (붙인 차례대로 - data/select itemLabels) */
  labels: ReadonlyArray<{ id: string; name: string; color: string }>;
  /** 칩에 마우스를 올리면 '상위 › 하위' */
  pathOf?: (id: string) => string;
  /** 머리줄의 날짜·시각 글 */
  dateText: string;
  /** 시각 옆에 작게 (메모: 기록에서 왔으면 '📅 10/6에서') */
  note?: string;
  /** 지금 쓰는 칸에서 고치는 항목 (파란 테두리) */
  editing?: boolean;
  collapsed: boolean;
  onToggleCollapse: () => void;
  /** 앞(▲)·뒤(▼)로. 옮길 수 없으면 주지 않는다 */
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onOpen: () => void;
  /** 🔗 n - 이은 항목 보기 (links/LinkViewerWindow) */
  onOpenLinks?: () => void;
  onToggleDone: () => void;
  onToggleFavorite: () => void;
  onDelete: () => void;
  /** '☐ 우유' 줄을 누르면 그 줄의 체크 글자만 바꾼다 */
  onToggleCheckLine: (lineIndex: number, line: string) => Promise<unknown>;
}


export default function EntryCard(props: EntryCardProps) {
  const { item, labels, pathOf, dateText, editing, collapsed, onToggleCollapse, onMoveUp, onMoveDown } = props;
  const noun = nounOf(item);
  const body = item.text ?? '';
  const done = !!item.done;
  const favorite = !!item.favorite;
  const attachments = (item.attachments ?? []).filter((a) => a && a.url);
  const images = attachments.filter(isImageAttachment);
  const files = attachments.filter((a) => !isImageAttachment(a));
  /** 그림 크게 보기 (이 카드의 그림을 넘겨 본다) */
  const viewImages = (index: number) =>
    openImageViewer(
      images.map((a) => ({ url: attachmentImageSrc(a), name: a.name || '첨부 이미지' })),
      index,
    );
  const tables = item.tables ?? [];
  const links = item.linkIds?.length ?? 0;
  const checks = checkCount(body);
  const preview = previewLine(body);
  const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

  // 체크 줄은 누르면 체크한다. 저장하는 동안은 그 줄을 다시 받지 않는다 (두 번 눌러 되돌아가지 않게)
  const [pendingLine, setPendingLine] = useState<number | null>(null);
  const toggleLine = async (idx: number, line: string) => {
    if (pendingLine !== null) return;
    setPendingLine(idx);
    try {
      await props.onToggleCheckLine(idx, line);
    } catch {
      // 안내는 저장 도우미가 했다
    } finally {
      setPendingLine(null);
    }
  };

  /** 본문. 체크한 줄(☑)은 아래쪽에 모아 줄을 긋는다 - 보이는 차례만, 누를 때는 원래 줄 번호로 고친다 */
  const renderBody = (): ReactNode => {
    if (!hasCheckLines(body)) return <FormattedText text={body} />;
    const lines = body.split('\n').map((line, idx) => ({ line, idx, state: checkLineState(line) }));
    const open = lines.filter((l) => l.state !== 'done');
    const closed = lines.filter((l) => l.state === 'done');
    // 위쪽의 끝 빈 줄은 뺀다 (체크한 줄이 빠진 자리)
    while (open.length > 0 && !open[open.length - 1].line.trim()) open.pop();
    const checkSpan = (line: string, idx: number, state: 'open' | 'done', extra: string) => {
      // 들여쓰기는 누르는 칸 밖에 둔다 (체크한 줄의 줄긋기가 빈칸까지 긋지 않게)
      const indent = line.length - line.trimStart().length;
      return (
        <>
          {state === 'open' && indent > 0 && line.slice(0, indent)}
          <span
            role="checkbox"
            aria-checked={state === 'done'}
            tabIndex={0}
            title={state === 'done' ? '눌러서 체크 풀기' : '눌러서 체크'}
            data-check-line={idx}
            onClick={(e) => {
              stop(e);
              void toggleLine(idx, line);
            }}
            onKeyDown={(e) => {
              if (e.key !== 'Enter' && e.key !== ' ') return;
              e.preventDefault();
              stop(e);
              void toggleLine(idx, line);
            }}
            className={`rounded px-0.5 -mx-0.5 cursor-pointer hover:bg-slate-100 ${extra} ${pendingLine === idx ? 'opacity-50' : ''}`}
          >
            <FormattedText text={line.slice(indent)} />
          </span>
        </>
      );
    };
    return (
      <>
        {open.map(({ line, idx, state }, i) => (
          <Fragment key={idx}>
            {i > 0 && '\n'}
            {state ? checkSpan(line, idx, state, '') : <FormattedText text={line} />}
          </Fragment>
        ))}
        {closed.length > 0 && (
          <span data-check-done-section className={`block space-y-0.5 ${open.length > 0 ? 'mt-1.5 pt-1.5 border-t border-dashed border-slate-200' : ''}`}>
            {closed.map(({ line, idx }) => (
              <span key={idx} className="block" data-check-done={idx}>
                {checkSpan(line, idx, 'done', 'block !mx-0 px-1.5 py-0.5 bg-slate-100 text-slate-400 line-through')}
              </span>
            ))}
          </span>
        )}
      </>
    );
  };

  return (
    <div
      data-entry-card={item.id}
      data-entry-kind={noun === '기록' ? 'journal' : 'memo'}
      data-entry-done={done ? '1' : '0'}
      data-entry-favorite={favorite ? '1' : '0'}
      data-entry-collapsed={collapsed ? '1' : '0'}
      onClick={(e) => {
        stop(e);
        props.onOpen();
      }}
      title="클릭하여 수정"
      className={`relative w-full rounded-2xl p-3 sm:p-4 min-w-0 transition-all duration-200 border flex flex-col gap-2 group shadow-sm hover:shadow-md cursor-pointer ${
        editing
          ? 'border-primary ring-1 ring-primary bg-primary/5'
          : done
            ? 'bg-slate-50 border-slate-200 opacity-70 hover:border-slate-300'
            : 'bg-white border-slate-200/80 hover:border-slate-300'
      }`}
    >
      {/* 머리줄 */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-x-1.5 gap-y-1 flex-wrap min-w-0">
          <span className="flex items-center gap-1.5 flex-nowrap min-w-0 max-w-full">
            <button
              type="button"
              data-entry-collapse
              onClick={(e) => {
                stop(e);
                onToggleCollapse();
              }}
              className="text-slate-400 hover:text-primary transition-colors p-0.5 text-xs cursor-pointer shrink-0"
              title={collapsed ? '펼치기' : '접기'}
            >
              {collapsed ? '▶' : '▼'}
            </button>
            <div className="flex flex-col items-center gap-0.5 shrink-0 px-0.5">
              <button
                type="button"
                data-entry-up
                onClick={(e) => {
                  stop(e);
                  onMoveUp?.();
                }}
                disabled={!onMoveUp}
                title="앞으로"
                aria-label="앞으로"
                className="text-slate-300 hover:text-primary disabled:opacity-30 disabled:hover:text-slate-300 p-0.5 leading-none text-xs cursor-pointer"
              >
                ▲
              </button>
              <button
                type="button"
                data-entry-down
                onClick={(e) => {
                  stop(e);
                  onMoveDown?.();
                }}
                disabled={!onMoveDown}
                title="뒤로"
                aria-label="뒤로"
                className="text-slate-300 hover:text-primary disabled:opacity-30 disabled:hover:text-slate-300 p-0.5 leading-none text-xs cursor-pointer"
              >
                ▼
              </button>
            </div>
            <input
              type="checkbox"
              checked={done}
              aria-label={`${noun} 완료`}
              title={done ? '완료 풀기' : '완료'}
              data-entry-complete
              onClick={stop}
              onChange={props.onToggleDone}
              className="w-4 h-4 rounded text-primary focus:ring-primary border-slate-300 accent-primary cursor-pointer shrink-0"
            />
            {/* 즐겨찾기. 휴대폰에는 마우스 올리기가 없어 늘 보인다 */}
            <button
              type="button"
              data-entry-favorite-toggle
              onClick={(e) => {
                stop(e);
                props.onToggleFavorite();
              }}
              aria-pressed={favorite}
              className={`p-0.5 text-sm leading-none transition-colors cursor-pointer shrink-0 ${
                favorite ? 'text-amber-500' : 'text-slate-300 hover:text-amber-400'
              }`}
              title={favorite ? '즐겨찾기 풀기' : '즐겨찾기'}
            >
              {favorite ? '★' : '☆'}
            </button>
            {labels.map((l) => {
              const c = labelColor(l.color);
              return (
                <span
                  key={l.id}
                  data-entry-chip={l.id}
                  title={pathOf?.(l.id) ?? l.name}
                  className="px-2 py-0.5 rounded-md text-xs font-bold border whitespace-nowrap truncate min-w-0 max-w-[10rem]"
                  style={{ backgroundColor: c.bg, color: c.text, borderColor: c.border }}
                >
                  {l.name}
                </span>
              );
            })}
          </span>
          <span className="text-xs text-slate-400" data-entry-date>
            {dateText}
          </span>
          {props.note && (
            <span className="text-2xs font-bold text-slate-400" data-entry-note>
              {props.note}
            </span>
          )}
          {checks.total > 0 && (
            <span
              data-entry-checks={`${checks.done}/${checks.total}`}
              title={`체크 목록 ${checks.total}개 가운데 ${checks.done}개 체크`}
              className={`text-xs font-bold px-1.5 py-0.5 rounded border ${
                checks.done === checks.total ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-600 border-slate-200'
              }`}
            >
              ☑ {checks.done}/{checks.total}
            </span>
          )}
          {(item.studentIds?.length ?? 0) > 0 && <EntryStudents studentIds={item.studentIds ?? []} />}
          {/* 이은 항목 - 누르면 📑 연결된 데이터 */}
          {links > 0 && (
            <button
              type="button"
              data-entry-links={links}
              onClick={(e) => {
                stop(e);
                props.onOpenLinks?.();
              }}
              className="bg-yellow-100 text-yellow-800 text-xs px-1.5 py-0.5 rounded font-bold border border-yellow-300 hover:bg-yellow-200 transition-colors cursor-pointer flex items-center gap-1"
              title={`링크된 항목 ${links}개`}
            >
              🔗 {links}
            </button>
          )}
          {/* 접혀 있을 때는 그림이 있다는 표시만 */}
          {collapsed && images.length > 0 && (
            <button
              type="button"
              data-entry-images={images.length}
              onClick={(e) => {
                stop(e);
                viewImages(0);
              }}
              className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs px-1.5 py-0.5 rounded font-bold border border-indigo-200 cursor-pointer"
              title="첨부 이미지 크게 보기"
            >
              🖼️ {images.length}
            </button>
          )}
          {/* 파일·표 표시는 늘, 그림은 접혔을 때만 (펼치면 그림이 보인다) */}
          {files.length > 0 && (
            <span data-entry-files={files.length} className="bg-slate-100 text-slate-600 text-xs px-1.5 py-0.5 rounded font-bold border border-slate-200">
              📎 {files.length}
            </span>
          )}
          {tables.length > 0 && (
            <span data-entry-tables={tables.length} className="bg-emerald-50 text-emerald-700 text-xs px-1.5 py-0.5 rounded font-bold border border-emerald-200" title="붙인 표">
              ▦ {tables.length}
            </span>
          )}
        </div>
        {/* 마우스를 올렸을 때만 - 자리를 차지하지 않게 위에 띄운다 (칩이 밀려 줄바꿈되지 않게) */}
        <div className="hidden sm:flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 absolute top-2 right-2 bg-white/95 rounded-lg shadow-xs">
          <button
            type="button"
            data-entry-edit
            onClick={(e) => {
              stop(e);
              props.onOpen();
            }}
            className="p-1 text-slate-400 hover:text-primary hover:bg-slate-100 rounded-lg text-xs font-semibold transition-all cursor-pointer"
            title={`${noun} 수정`}
            aria-label={`${noun} 수정`}
          >
            ✏️
          </button>
          <button
            type="button"
            data-entry-delete
            onClick={(e) => {
              stop(e);
              props.onDelete();
            }}
            className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-bold transition-all cursor-pointer"
            title={`${noun} 삭제`}
            aria-label={`${noun} 삭제`}
          >
            🗑️
          </button>
        </div>
      </div>

      {collapsed && preview && (
        <p data-entry-preview className={`text-sm truncate leading-relaxed ${done ? 'line-through text-slate-400' : 'text-slate-500'}`}>
          {preview}
        </p>
      )}

      {!collapsed && (
        <>
          {images.length > 0 && (
            <div className="space-y-2">
              {images.map((img, idx) => (
                <button
                  type="button"
                  key={`${img.url}-${idx}`}
                  data-entry-image={idx}
                  onClick={(e) => {
                    stop(e);
                    viewImages(idx);
                  }}
                  className="block w-full rounded-xl overflow-hidden border border-slate-100 bg-slate-50 cursor-pointer"
                  title="눌러서 크게 보기"
                >
                  <img src={attachmentImageSrc(img, 600)} alt={img.name || '첨부 이미지'} className="w-full max-h-48 object-cover" loading="lazy" />
                </button>
              ))}
            </div>
          )}
          {files.length > 0 && (
            <div className="space-y-2">
              {files.map((f, idx) => (
                <a
                  key={`${f.url}-${idx}`}
                  href={f.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                  onClick={stop}
                  className="flex items-center gap-2 p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 rounded-xl transition-all group/file text-xs"
                >
                  <span className="text-base shrink-0" aria-hidden>
                    {fileIcon(f)}
                  </span>
                  <span className="font-semibold text-slate-700 group-hover/file:text-primary truncate flex-1" title={f.name}>
                    📎 {f.name}
                  </span>
                  <span className="text-xs text-slate-400 shrink-0 font-medium group-hover/file:text-primary">다운로드</span>
                </a>
              ))}
            </div>
          )}
          {body && (
            <p data-entry-text className={`text-sm whitespace-pre-wrap break-words leading-relaxed ${done ? 'line-through text-slate-400' : 'text-slate-800'}`}>
              {renderBody()}
            </p>
          )}
          {/* 글 안 주소 미리보기 */}
          {body && <LinkPreviewCards text={body} />}
          {/* 붙인 표 - 작게 보기만 (고치기는 쓰는 칸에서) */}
          {tables.map((t) => (
            <EntryTableView key={t.id} table={t} compact />
          ))}
        </>
      )}
    </div>
  );
}
