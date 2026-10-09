// 📢 알림장 (V4 components/NoticeDrawer.tsx) - 오른쪽 쓰는 칸 'notices' = { sid?, date, tab? }. 칸을 연 공간의 notices/{date}.
//   '✏️ 쓰기': 한 줄에 한 항목(번호는 저절로) · 📥 다음 수업일 불러오기(그날 수업 칸 준비물 + 진도 차시 준비물 + 일정 - 주말·공휴일·방학·수업X는 건너뜀) ·
//   🍚 급식(우리 학교) · 미리 보기 📤 공유·📋 복사 · 💾 저장(Ctrl+S). '📚 모아 보기': 달·지난 한 달·학년도, 날짜를 누르면 그날 쓰기.
//   V4의 '그날 기록 칸에 알림장 항목 만들기'는 없다 - 기록 칸이 계산해 보인다(P7-2 ■3).
//   연 채로 다른 기기에서 고친 것도 따라온다(적던 것이 있으면 덮지 않는다). 다른 날로 옮기면 적던 것은 그 날에 저장한다.
import { useEffect, useRef, useState } from 'react';
import { showErrorToast, showErrorToastOnce, showToast } from '../../app/toast';
import { registerUnsavedCheck, type WindowProps } from '../../app/windows';
import { loadMonthMeals } from '../../data/neis';
import { itemsOn, useDocs } from '../../data/select';
import { currentSpaceId, usePersonalSpaceId } from '../../data/session';
import { academicYearOf, addDays, shortDateLabel } from '../../domain/dateUtils';
import { useToday } from '../../ui/useToday';
import { lessonsOn } from '../../domain/lessons';
import { appendFresh, draftLinesFrom, mealNoticeLines, nextClassDay, noticeMessage, readNoticeLines, splitNoticeLines } from '../../domain/notices';
import { suppliesByPeriod } from '../../domain/progress';
import { schoolYearSpan } from '../../domain/semester';
import AutoTextarea from '../../ui/AutoTextarea';
import { canShare, copyText, shareText } from '../../ui/shareText';
import SidePanelFrame from '../../ui/SidePanelFrame';
import { doneOnDay } from '../events/eventOps';
import { offDayOf, useLessonSource } from '../lessons/useLessons';
import { useProgressMarks } from '../progress/useProgress';
import { useSchool } from '../school/school';
import { saveNotice } from './actions';
import type { NoticePanelParams, NoticeTab } from './open';

type ListRange = 'month' | '30days' | 'year';

interface Draft {
  date: string;
  text: string;
}

const shareNotice = (date: string, lines: string[]) => void shareText(`${shortDateLabel(date)} 알림장`, noticeMessage(date, lines));

export default function NoticePanel({ params, close, raise }: WindowProps<NoticePanelParams>) {
  // 칸을 연 순간의 공간에 저장한다 (지금 보는 공간이 아니라)
  const [sid] = useState(() => params.sid ?? currentSpaceId() ?? '');
  const personal = usePersonalSpaceId();
  const docs = useDocs('notices', sid);
  const items = useDocs('items', sid);
  const src = useLessonSource(sid);
  const school = useSchool();

  const [tab, setTab] = useState<NoticeTab>(params.tab ?? 'write');
  const [date, setDate] = useState(params.date);
  const stored = docs[date];
  const storedLines = readNoticeLines(stored?.lines);
  // 진도 - 다음 수업일 차시의 준비물 (개인 공간 알림장만, V4 ROADMAP 5-4)
  const { marks } = useProgressMarks(date);

  const [draft, setDraft] = useState<Draft | null>(null);
  const text = draft && draft.date === date ? draft.text : storedLines.join('\n');
  const draftDirty = (d: Draft | null) => !!d && splitNoticeLines(d.text).join('\n') !== readNoticeLines(docs[d.date]?.lines).join('\n');
  const dirty = draftDirty(draft);
  const lines = splitNoticeLines(text);
  const setText = (t: string) => setDraft({ date, text: t });

  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  /** 저장한다. 저장했거나 저장할 것이 없으면 true */
  const save = async (d: Draft | null = draft): Promise<boolean> => {
    if (!sid || !d || !draftDirty(d)) {
      if (d) setDraft((cur) => (cur === d ? null : cur));
      return true;
    }
    if (savingRef.current) return false;
    savingRef.current = true;
    setSaving(true);
    try {
      await saveNotice(sid, d.date, docs[d.date], splitNoticeLines(d.text));
      setDraft((cur) => (cur === d ? null : cur));
      return true;
    } catch (e) {
      showErrorToastOnce('알림장을 저장하지 못했습니다. 적던 것은 그대로 두었으니 다시 저장해 주세요.', e);
      return false;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  });
  // 다른 날로 옮겼는데 적던 것이 남았으면 곧바로 그 날에 저장한다
  useEffect(() => {
    if (draft && draft.date !== date) void saveRef.current(draft);
  }, [draft, date]);

  // 다시 열면(다른 날·탭으로) 따라간다
  const paramKey = `${params.date}|${params.tab ?? ''}`;
  const [seenParams, setSeenParams] = useState(paramKey);
  if (paramKey !== seenParams) {
    setSeenParams(paramKey);
    setDate(params.date);
    if (params.tab) setTab(params.tab);
  }

  // ESC로 모두 닫기 전에 저장 안 한 것을 묻는다
  const unsaved = useRef<(() => boolean) | null>(null);
  useEffect(() => {
    unsaved.current = () => dirty;
  });
  useEffect(() => registerUnsavedCheck(unsaved), []);

  /** 다음 수업일 (주말·공휴일·방학·수업X 일정은 건너뜀) */
  const target = nextClassDay(date, offDayOf(src));
  const [drafting, setDrafting] = useState(false);
  const loadDraft = () => {
    if (!target) return showToast('2주 안에 수업일이 없습니다.');
    const cells = lessonsOn(target, src).cells;
    const events = itemsOn(items, target, 'event').map((it) => ({ text: it.text, done: doneOnDay(it, target) }));
    const extra = sid === personal ? suppliesByPeriod(marks, target) : {};
    const more = draftLinesFrom(cells, events, extra);
    if (more.length === 0) return showToast(`${shortDateLabel(target)}에 적힌 준비물·일정이 없습니다.`);
    const { lines: next, added } = appendFresh(lines, more);
    if (added === 0) return showToast('불러올 새 항목이 없습니다. 이미 모두 적혀 있습니다.');
    setText(next.join('\n'));
    showToast(`📥 ${shortDateLabel(target)}의 준비물·일정 ${added}줄을 불러왔습니다.`);
  };
  const loadMeal = async () => {
    if (!school) return;
    if (!target) return showToast('2주 안에 수업일이 없습니다.');
    setDrafting(true);
    try {
      const meal = mealNoticeLines(await loadMonthMeals(school, target.slice(0, 7)), target);
      if (meal.length === 0) return showToast(`${shortDateLabel(target)} 급식이 나이스에 아직 없습니다.`);
      const { lines: next, added } = appendFresh(lines, meal);
      if (added === 0) return showToast('이미 적혀 있습니다.');
      setText(next.join('\n'));
      showToast(`🍚 ${shortDateLabel(target)} 급식을 넣었습니다.`);
    } catch (err) {
      showErrorToast('급식을 불러오지 못했습니다.', err);
    } finally {
      setDrafting(false);
    }
  };

  // ── 모아 보기 ──
  const [range, setRange] = useState<ListRange>('month');
  const today = useToday();
  const span =
    range === 'month'
      ? { start: `${date.slice(0, 7)}-01`, end: `${date.slice(0, 7)}-31` }
      : range === '30days'
        ? { start: addDays(today, -30), end: today }
        : schoolYearSpan(academicYearOf(date));
  const list = Object.values(docs)
    .map((d) => ({ date: d.id, lines: readNoticeLines(d.lines) }))
    .filter((n) => n.lines.length > 0 && n.date >= span.start && n.date <= span.end)
    .sort((a, b) => b.date.localeCompare(a.date));

  const btn = 'px-2 py-0.5 bg-white border border-yellow-300 rounded-lg font-bold text-yellow-900 hover:bg-yellow-100 cursor-pointer';
  const personalSpace = sid.startsWith('u_');

  return (
    <SidePanelFrame ariaLabel="알림장" onClose={close} onBackdropClose={() => void save().then((ok) => ok && close())} onSave={() => void save()} raise={raise}>
      <div data-notice-panel={sid} data-notice-date={date} className="flex flex-col h-full min-h-0">
        <div className="flex items-start justify-between px-6 py-4 border-b border-slate-100">
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-slate-800">📢 알림장</h3>
            <p className="text-xs font-bold text-primary mt-0.5 truncate">
              {shortDateLabel(date)} 알림장 · {personalSpace ? '🔒 개인' : '👥 공유'}
            </p>
          </div>
          <button type="button" data-close title="닫기" onClick={close} className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer shrink-0">
            ✕
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-5 space-y-4 text-xs text-slate-700" data-scroll-lock>
          <div className="inline-flex bg-slate-100 p-1 rounded-xl gap-1">
            {(
              [
                ['write', '✏️ 쓰기'],
                ['list', '📚 모아 보기'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                data-notice-tab={id}
                onClick={() => setTab(id)}
                aria-pressed={tab === id}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${tab === id ? 'bg-white text-primary shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === 'write' ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <button type="button" data-notice-prev onClick={() => setDate(addDays(date, -1))} className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 font-black cursor-pointer" title="전날">
                    ◀
                  </button>
                  <input type="date" data-notice-date-input value={date} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="알림장 날짜" className="px-2 py-1 border border-slate-200 rounded-lg font-bold" />
                  <button type="button" data-notice-next onClick={() => setDate(addDays(date, 1))} className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 font-black cursor-pointer" title="다음 날">
                    ▶
                  </button>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    data-notice-draft={target ?? ''}
                    onClick={loadDraft}
                    title="다음 수업일의 준비물과 일정을 줄로 더합니다 (주말·공휴일·방학은 건너뜁니다)"
                    className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl font-bold cursor-pointer"
                  >
                    📥 다음 수업일 불러오기
                  </button>
                  {school && (
                    <button
                      type="button"
                      data-notice-meal
                      onClick={() => void loadMeal()}
                      disabled={drafting}
                      title="다음 수업일 급식을 한 줄로 더합니다 (나이스 - 환경설정 '학교')"
                      className="px-3 py-1.5 bg-orange-50 hover:bg-orange-100 text-orange-800 border border-orange-200 rounded-xl font-bold disabled:opacity-50 cursor-pointer"
                    >
                      🍚 급식
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-500 mb-1">한 줄에 한 항목 (번호는 저절로 붙습니다)</label>
                <AutoTextarea
                  data-notice-text
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={'예:\n국어 준비물: 색연필\n현장체험학습 동의서 제출'}
                  aria-label="알림장 내용"
                  className="w-full min-h-[120px] p-3 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary leading-relaxed"
                  autoFocus
                />
              </div>

              {lines.length > 0 && (
                <div className="p-3 bg-yellow-50/70 border border-yellow-200 rounded-xl" data-notice-preview={lines.length}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-yellow-900">미리 보기</span>
                    <div className="flex gap-1">
                      {canShare() && (
                        <button type="button" data-notice-share onClick={() => shareNotice(date, lines)} className={btn} title="카카오톡·문자 등으로 보내기">
                          📤 공유
                        </button>
                      )}
                      <button type="button" data-notice-copy onClick={() => void copyText(noticeMessage(date, lines))} className={btn}>
                        📋 복사
                      </button>
                    </div>
                  </div>
                  <ol className="space-y-0.5 text-sm text-slate-800">
                    {lines.map((l, i) => (
                      <li key={i}>
                        {i + 1}. {l}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
              <p className="text-slate-400">저장하면 그날 기록 칸에 '📢 알림장'으로 보입니다. 다른 날로 옮기면 적던 것은 그 날에 저장합니다.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-500">기간</span>
                <select value={range} data-notice-range onChange={(e) => setRange(e.target.value as ListRange)} aria-label="알림장 모아 보기 기간" className="px-2 py-1 border border-slate-200 rounded-lg font-bold">
                  <option value="month">{Number(date.slice(5, 7))}월</option>
                  <option value="30days">지난 한 달</option>
                  <option value="year">학년도 전체</option>
                </select>
                <span className="text-slate-400" data-notice-count={list.length}>
                  {list.length}일
                </span>
              </div>
              {list.length === 0 ? (
                <p className="text-center text-slate-400 py-6">이 기간에 적은 알림장이 없습니다.</p>
              ) : (
                <div className="space-y-2">
                  {list.map((n) => (
                    <div key={n.date} className="p-3 bg-white border border-slate-200 rounded-xl" data-notice-day={n.date}>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <button
                          type="button"
                          data-notice-open={n.date}
                          onClick={() => {
                            setDate(n.date);
                            setTab('write');
                          }}
                          className="font-black text-slate-800 hover:text-primary cursor-pointer"
                          title="이 날 알림장 고치기"
                        >
                          {shortDateLabel(n.date)} <span className="font-normal text-slate-400">{n.date.slice(0, 4)}</span>
                        </button>
                        <div className="flex gap-1 shrink-0">
                          {canShare() && (
                            <button
                              type="button"
                              onClick={() => shareNotice(n.date, n.lines)}
                              className="px-2 py-0.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                              title="카카오톡·문자 등으로 보내기"
                            >
                              📤 공유
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => void copyText(noticeMessage(n.date, n.lines))}
                            className="px-2 py-0.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                          >
                            📋 복사
                          </button>
                        </div>
                      </div>
                      <ol className="space-y-0.5 text-sm text-slate-700">
                        {n.lines.map((l, i) => (
                          <li key={i}>
                            {i + 1}. {l}
                          </li>
                        ))}
                      </ol>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-2 bg-slate-50/50">
          {dirty && (
            <span className="mr-auto text-xs font-bold text-amber-600" data-notice-dirty>
              저장하지 않은 것이 있습니다
            </span>
          )}
          <button type="button" onClick={close} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer">
            닫기
          </button>
          {tab === 'write' && (
            <button
              type="button"
              data-notice-save
              onClick={() => void save()}
              disabled={saving || !sid}
              title="Ctrl + S 로도 저장합니다"
              className="px-5 py-2 text-sm font-bold text-white bg-primary hover:bg-blue-600 rounded-xl shadow-md disabled:opacity-50 cursor-pointer"
            >
              {saving ? '저장 중...' : '💾 저장'}
            </button>
          )}
        </div>
      </div>
    </SidePanelFrame>
  );
}
