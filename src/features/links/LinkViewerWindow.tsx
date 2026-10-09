// 📑 연결된 항목 보기 (V4 components/LinkViewerModal.tsx). 창 'links' = { sid, id } - 카드의 🔗 n.
//   - 이은 항목의 **지금 내용**(글·표·사진·파일)을 기기 사본에서 바로 보인다(V4는 서버에서 하나씩 읽었다).
//   - ✏️ 수정 = 하루·메모 화면과 같은 쓰는 칸, 📌 이동 = 그날 하루 화면(메모는 메모 화면), 🗑️ 삭제 = 연결만 끊는다(양쪽 - 안내의 되돌리기).
//   - 다른 항목의 링크를 열면 오른쪽 줄에 탭으로 쌓이고, 같은 항목이면 그 탭(창 목록 sameAs).
//   - 수업('lesson:날짜:교시')도 같다: 수업 칸에서 열면 그 교시에 이은 항목, 항목에서 열면 이은 수업의 과목·준비물·메모(계산 - P6-1),
//     ✏️ = 'N교시 수정' 칸, 📌 = 그날 하루 화면의 그 교시.
import { useMemo } from 'react';
import { setDate, setScope } from '../../app/nav';
import type { WindowProps } from '../../app/windows';
import { fileIcon, isImageAttachment } from '../../domain/attachments';
import { shortDateLabel } from '../../domain/dateUtils';
import { lessonsOn } from '../../domain/lessons';
import { attachmentImageSrc } from '../../data/google/drive';
import { useDocs, useMirrorStatus } from '../../data/select';
import FormattedText from '../../ui/FormattedText';
import { openImageViewer } from '../../ui/imageViewer';
import ModalShell, { ModalCloseButton } from '../../ui/ModalShell';
import type { ItemDoc } from '../events/eventOps';
import { openEventPanel } from '../events/open';
import EntryTableView from '../notes/EntryTableView';
import { openLessonPanel } from '../lessons/open';
import { useLessonSource } from '../lessons/useLessons';
import { openNotePanel } from '../notes/open';
import { requestFocus } from '../search/focus';
import { removeLessonLink, removeLink } from './actions';
import { LINK_KIND_ICON, LINK_KIND_NAME, lessonEndOf, linkKindOf, parseLessonLink } from './linkOps';
import type { LinkWindowParams } from './open';

const btn = 'px-2 py-1 text-xs font-bold rounded-lg border transition-colors cursor-pointer';

export default function LinkViewerWindow({ params, close, raise }: WindowProps<LinkWindowParams>) {
  const { sid, id } = params;
  const items = useDocs('items', sid);
  const days = useDocs('lessonDays', sid);
  const lessonSrc = useLessonSource(sid);
  const status = useMirrorStatus('items', sid);
  const lessonEnd = useMemo(() => (parseLessonLink(id) ? lessonEndOf(id, days) : null), [id, days]);
  const source = lessonEnd ? undefined : items[id];
  const links = (lessonEnd ? lessonEnd.linkIds : source?.linkIds) ?? [];
  /** 그 교시 (계산한 수업 칸) */
  const lessonCell = (date: string, n: number) => lessonsOn(date, lessonSrc).cells.find((c) => c.n === n);

  const goTo = (date: string | null) => {
    if (date) {
      setDate(date);
      setScope('day');
    } else setScope('memo');
  };

  const edit = (t: ItemDoc) => {
    if (t.kind === 'event') openEventPanel({ sid, date: t.date ?? '', id: t.id });
    else openNotePanel({ sid, date: t.date ?? null, id: t.id });
  };

  const unlink = (targetId: string) => {
    const target = items[targetId];
    const quiet = () => {
      // 안내는 저장 도우미가 했다
    };
    if (lessonEnd) void removeLessonLink(sid, lessonEnd, targetId, target).catch(quiet);
    else if (source) void removeLink(sid, source, targetId, target, lessonEndOf(targetId, days)).catch(quiet);
  };

  const header = (icon: string, title: string, linkId: string, actions: { move?: () => void; edit?: () => void }) => (
    <div className="flex justify-between items-center gap-2 mb-2 pb-2 border-b border-slate-100">
      <span className="font-bold text-blue-700 text-xs flex items-center gap-1 min-w-0 truncate">
        <span>{icon}</span> {title}
      </span>
      <div className="flex items-center gap-1 shrink-0">
        <button type="button" data-link-unlink={linkId} onClick={() => unlink(linkId)} className={`${btn} bg-rose-50 text-rose-600 hover:bg-rose-100 border-rose-200`} title="연결만 끊습니다 (양쪽 모두, 항목은 그대로)">
          🗑️ 삭제
        </button>
        {actions.move && (
          <button type="button" data-link-move={linkId} onClick={actions.move} className={`${btn} bg-amber-50 text-amber-800 hover:bg-amber-100 border-amber-300`} title="그 항목이 있는 화면으로">
            📌 이동
          </button>
        )}
        {actions.edit && (
          <button type="button" data-link-edit={linkId} onClick={actions.edit} className={`${btn} bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-indigo-200`} title="하루·메모 화면과 같은 쓰는 칸을 엽니다">
            ✏️ 수정
          </button>
        )}
      </div>
    </div>
  );

  const card = (linkId: string) => {
    const lesson = parseLessonLink(linkId);
    if (lesson) {
      const c = lessonCell(lesson.date, lesson.period);
      return (
        <div key={linkId} data-link-row={linkId} data-link-kind="lesson" className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm">
          {header(LINK_KIND_ICON.lesson, `[${shortDateLabel(lesson.date)}] ${lesson.period}교시 ${c?.subject || '수업'}`, linkId, {
            move: () => {
              goTo(lesson.date);
              requestFocus({ kind: 'lesson', id: linkId, date: lesson.date });
            },
            edit: () => openLessonPanel({ sid, date: lesson.date, n: lesson.period }),
          })}
          {c?.supplies && <p className="text-xs text-amber-600 font-medium mb-1">📌 {c.supplies}</p>}
          <div data-link-text className="p-2.5 bg-slate-50/70 border border-slate-100 rounded-lg text-xs font-medium whitespace-pre-wrap break-words leading-relaxed min-h-[36px] text-slate-800">
            {c?.memo ? <FormattedText text={c.memo} /> : <span className="text-slate-400">(수업 메모 없음)</span>}
          </div>
        </div>
      );
    }
    const t = items[linkId];
    if (!t || t.deletedAt) {
      return (
        <div key={linkId} data-link-row={linkId} data-link-kind="missing" className="bg-white border border-dashed border-slate-300 rounded-xl p-3.5">
          {header('❔', t ? '휴지통에 있는 항목' : status === 'live' ? '찾을 수 없는 항목' : '불러오는 중…', linkId, {})}
          <p className="text-xs text-slate-400">{t ? '휴지통에서 되살리면 다시 보입니다.' : '지워졌거나 다른 공간의 항목입니다. 연결을 끊어도 됩니다.'}</p>
        </div>
      );
    }
    const kind = linkKindOf(t);
    const pics = (t.attachments ?? []).filter((a) => a?.url && isImageAttachment(a));
    const files = (t.attachments ?? []).filter((a) => a?.url && !isImageAttachment(a));
    const tables = t.tables ?? [];
    const title = `[${t.date ? shortDateLabel(t.date) : '메모'}] ${LINK_KIND_NAME[kind]}`;
    return (
      <div key={linkId} data-link-row={linkId} data-link-kind={kind} className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm hover:border-slate-300 transition-colors">
        {header(LINK_KIND_ICON[kind], title, linkId, { move: () => goTo(t.date ?? null), edit: () => edit(t) })}
        {/* 글 없이 표만 있으면 글 칸은 비운다 */}
        {(t.text || tables.length === 0) && (
          <div data-link-text className={`p-2.5 bg-slate-50/70 border border-slate-100 rounded-lg text-xs font-medium whitespace-pre-wrap break-words leading-relaxed min-h-[36px] ${t.done ? 'line-through text-slate-400' : 'text-slate-800'}`}>
            {t.text ? <FormattedText text={t.text} /> : <span className="text-slate-400">(내용 없음)</span>}
          </div>
        )}
        {/* 표는 보기만, 다 펼친다 (스크롤은 창 하나) */}
        {tables.map((tb) => (
          <div key={tb.id} className="mt-1.5">
            <EntryTableView table={tb} compact fullHeight />
          </div>
        ))}
        {(pics.length > 0 || files.length > 0) && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {pics.map((a, i) => (
              <button
                key={`${a.url}-${i}`}
                type="button"
                data-link-image={i}
                onClick={() =>
                  openImageViewer(
                    pics.map((p) => ({ url: attachmentImageSrc(p), name: p.name })),
                    i,
                  )
                }
                title={a.name}
                className="w-14 h-14 rounded-lg overflow-hidden border border-slate-200 hover:border-primary transition-colors shrink-0 cursor-pointer"
              >
                <img src={attachmentImageSrc(a, 200)} alt={a.name} loading="lazy" className="w-full h-full object-cover" />
              </button>
            ))}
            {files.map((a, i) => (
              <a
                key={`${a.url}-${i}`}
                href={a.url}
                target="_blank"
                rel="noreferrer"
                title={a.name}
                className="max-w-[150px] truncate px-2 py-1 rounded-lg border border-slate-200 bg-white text-2xs font-bold text-slate-600 hover:border-primary hover:text-primary transition-colors"
              >
                {fileIcon(a)} {a.name || '첨부 파일'}
              </a>
            ))}
          </div>
        )}
      </div>
    );
  };

  const lessonTitle = lessonEnd ? `[${shortDateLabel(lessonEnd.date)}] ${lessonEnd.period}교시 ${lessonCell(lessonEnd.date, lessonEnd.period)?.subject || '수업'}` : '';

  return (
    <ModalShell isOpen onClose={close} raise={raise} width="lg" title={`📑 연결된 데이터 (${links.length})`} footer={<ModalCloseButton onClose={close} />}>
      <div data-link-viewer={id} className="space-y-3">
        {source && (
          <p className="text-xs text-slate-500 truncate" data-link-viewer-source>
            {LINK_KIND_ICON[linkKindOf(source)]} {source.text.split('\n')[0] || '(내용 없음)'} 에 이은 것
          </p>
        )}
        {lessonEnd && (
          <p className="text-xs text-slate-500 truncate" data-link-viewer-source>
            {LINK_KIND_ICON.lesson} {lessonTitle} 에 이은 것
          </p>
        )}
        {links.length === 0 ? (
          <div className="text-center py-12 text-slate-400 flex flex-col items-center gap-2" data-link-viewer-empty>
            <span className="text-3xl opacity-50">📂</span>
            <p className="text-xs font-medium">{source || lessonEnd ? '연결된 항목이 없습니다.' : status === 'live' ? '항목을 찾지 못했습니다.' : '불러오는 중…'}</p>
          </div>
        ) : (
          links.map(card)
        )}
      </div>
    </ModalShell>
  );
}
