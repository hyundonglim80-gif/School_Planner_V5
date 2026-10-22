// 메모 본문 (카드와 메모 화면 목록의 펼친 줄이 함께 쓴다 - P11-1에 EntryCard에서 나눴다).
//   그림(누르면 크게 보기·넘겨 보기) · 파일 · 글(체크 줄은 눌러서 체크 - 체크한 줄은 아래쪽에 모아 보이기만, V4 10-07) · 글 안 주소 미리보기 · 표(작게 보기만).
import { Fragment, useState, type ReactNode } from 'react';
import { checkLineState, hasCheckLines } from '../../domain/checkLines';
import { fileIcon, isImageAttachment } from '../../domain/attachments';
import { attachmentImageSrc } from '../../data/google/drive';
import FormattedText from '../../ui/FormattedText';
import { openImageViewer } from '../../ui/imageViewerStore';
import LinkPreviewCards from '../../ui/LinkPreviewCards';
import type { ItemDoc } from '../events/eventOps';
import EntryTableView from './EntryTableView';

interface Props {
  item: ItemDoc;
  /** '☐ 우유' 줄을 누르면 그 줄의 체크 글자만 바꾼다 */
  onToggleCheckLine: (lineIndex: number, line: string) => Promise<unknown>;
  /** 표를 칸 안에서 스크롤하지 않고 끝 행까지 모두 보인다 (오른쪽 칸 - 넘치면 칸 전체가 스크롤) */
  fullTables?: boolean;
}

const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

export default function EntryBody({ item, onToggleCheckLine, fullTables }: Props) {
  const body = item.text ?? '';
  const done = !!item.done;
  const attachments = (item.attachments ?? []).filter((a) => a && a.url);
  const images = attachments.filter(isImageAttachment);
  const files = attachments.filter((a) => !isImageAttachment(a));
  const tables = item.tables ?? [];
  /** 그림 크게 보기 (이 메모의 그림을 넘겨 본다) */
  const viewImages = (index: number) =>
    openImageViewer(
      images.map((a) => ({ url: attachmentImageSrc(a), name: a.name || '첨부 이미지' })),
      index,
    );

  // 체크 줄은 누르면 체크한다. 저장하는 동안은 그 줄을 다시 받지 않는다 (두 번 눌러 되돌아가지 않게)
  const [pendingLine, setPendingLine] = useState<number | null>(null);
  const toggleLine = async (idx: number, line: string) => {
    if (pendingLine !== null) return;
    setPendingLine(idx);
    try {
      await onToggleCheckLine(idx, line);
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
        <EntryTableView key={t.id} table={t} compact fullHeight={fullTables} />
      ))}
    </>
  );
}
