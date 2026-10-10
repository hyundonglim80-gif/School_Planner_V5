// 백업 창 '보내기' 탭의 📊 구글 시트 칸 (V4 BackupModal의 구글 시트, P8-3). 지금 공간 - 기간 · 담을 것 → 시트로 보내기 / 시트에서 되읽기.
// V5만의 시트 파일에 쓴다(V4·V3 시트를 덮지 않는다). 되읽기는 고치고 더하기만 - 시트에서 지운 줄은 앱에서 지우지 않는다.
import { useEffect, useState } from 'react';
import { useNav } from '../../app/nav';
import { useCommonSettings } from '../../app/prefs';
import { showErrorToast, showToast, ShownError } from '../../app/toast';
import { academicYearOf, todayStr } from '../../domain/dateUtils';
import { schoolYearSpan } from '../../domain/semester';
import { sheetUrlOf, type SheetsInclude } from '../../domain/sheets';
import { useDocs } from '../../data/select';
import { useCurrentSpaceId } from '../../data/session';
import { rangeForScope } from '../gcal/manual';
import { useLessonSource } from '../lessons/useLessons';
import { Section } from '../settings/parts';
import { exportToSheets, importFromSheets, readSheetRecord, sheetsReadText, type SheetsData } from './sheets';

type Period = 'view' | 'year' | 'custom';
const PERIODS: ReadonlyArray<{ key: Period; name: string }> = [
  { key: 'view', name: '지금 화면 기간' },
  { key: 'year', name: '이번 학년도' },
  { key: 'custom', name: '직접 정하기' },
];
const KINDS: ReadonlyArray<{ key: keyof SheetsInclude; name: string }> = [
  { key: 'event', name: '📅 일정' },
  { key: 'class', name: '⏰ 수업' },
  { key: 'journal', name: '📔 기록' },
  { key: 'evaluation', name: '📊 조사표' },
  { key: 'memo', name: '📝 메모' },
];
const MAX_DAYS = 400;

export default function SheetsSection() {
  const sid = useCurrentSpaceId();
  const scope = useNav((s) => s.scope);
  const date = useNav((s) => s.date);
  const periods = useCommonSettings((s) => s.periods);
  const items = useDocs('items', sid);
  const labels = useDocs('labels', sid);
  const evaluations = useDocs('evaluations', sid);
  const classes = useDocs('classes', sid);
  const lessonDays = useDocs('lessonDays', sid);
  const lessons = useLessonSource(sid);
  const [period, setPeriod] = useState<Period>('view');
  const [custom, setCustom] = useState(() => rangeForScope(scope, date));
  const [include, setInclude] = useState<SheetsInclude>({ event: true, class: true, journal: true, evaluation: true, memo: true });
  const [busy, setBusy] = useState('');
  const [result, setResult] = useState('');
  const [sheetId, setSheetId] = useState<string | null>(null);

  useEffect(() => {
    if (!sid) return;
    let alive = true;
    readSheetRecord(sid)
      .then((id) => alive && setSheetId(id))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [sid]);

  const range = () => (period === 'view' ? rangeForScope(scope, date) : period === 'year' ? schoolYearSpan(academicYearOf(todayStr())) : custom);
  const data = (): SheetsData | null =>
    sid ? { sid, items, labels, evaluations, classes, lessonDays, lessons, periodNames: periods.map((p) => p.name) } : null;
  const chosen = KINDS.some((k) => include[k.key]);

  const send = async () => {
    const d = data();
    if (!d || busy) return;
    if (!chosen) return showToast('담을 것을 하나 이상 골라 주세요.');
    const r = range();
    if (r.start > r.end) return showToast('시작일이 종료일보다 늦습니다.');
    const days = Math.round((Date.parse(r.end) - Date.parse(r.start)) / 86400000) + 1;
    if (days > MAX_DAYS) return showToast(`시트로 보낼 기간은 ${MAX_DAYS}일까지입니다. 기간을 줄여 주세요.`);
    setResult('');
    setBusy('보내는 중…');
    try {
      const res = await exportToSheets(d, r, include, setBusy);
      setSheetId(res.spreadsheetId);
      const text = `${res.days}일치${include.memo ? `와 메모 ${res.memos}건` : ''}${include.evaluation ? `, 조사표 ${res.evaluations}장` : ''}을 구글 시트에 썼습니다.`;
      setResult(text);
      showToast(`✅ ${text}`);
    } catch (e) {
      if (!(e instanceof ShownError)) showErrorToast('구글 시트로 보내지 못했습니다.', e);
    } finally {
      setBusy('');
    }
  };

  const read = async () => {
    const d = data();
    if (!d || busy) return;
    if (!chosen) return showToast('되읽을 것을 하나 이상 골라 주세요.');
    if (
      !window.confirm(
        '구글 시트의 내용을 앱으로 되읽습니다.\n\n시트에서 고친 일정·기록·메모·수업·조사표 점수는 앱에서도 바뀌고, 시트에 새로 적은 줄은 새로 만들어집니다.\n시트에서 지운 줄은 앱에서 지우지 않습니다. 계속할까요?',
      )
    )
      return;
    setResult('');
    setBusy('되읽는 중…');
    try {
      const res = await importFromSheets(d, include, setBusy);
      const text = `시트에서 되읽었습니다: ${sheetsReadText(res)}`;
      setResult(text);
      showToast(`✅ ${text}`);
    } catch (e) {
      if (!(e instanceof ShownError)) showErrorToast('구글 시트에서 되읽지 못했습니다.', e);
    } finally {
      setBusy('');
    }
  };

  const chip = (on: boolean) =>
    `px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${on ? 'bg-primary text-white border-primary' : 'bg-white text-slate-500 border-slate-200 hover:border-primary hover:text-primary'}`;

  return (
    <Section
      id="sheets"
      title="📊 구글 시트"
      desc="일정·수업·기록·조사표·메모를 내 드라이브의 V5 시트 파일에 표로 씁니다. 시트에서 고친 것은 '시트에서 되읽기'로 앱에 돌려놓습니다(V4 시트와는 다른 파일입니다)."
    >
      <div data-sheets className="space-y-2.5">
        <div className="flex flex-wrap gap-1.5">
          {PERIODS.map((p) => (
            <button key={p.key} type="button" data-sheets-period={p.key} aria-pressed={period === p.key} onClick={() => setPeriod(p.key)} className={chip(period === p.key)}>
              {p.name}
            </button>
          ))}
        </div>
        {period === 'custom' && (
          <div className="flex items-center gap-2 text-xs">
            <input type="date" aria-label="시작일" data-sheets-start value={custom.start} onChange={(e) => setCustom((c) => ({ ...c, start: e.target.value }))} className="px-2 py-1.5 border border-slate-200 rounded-lg" />
            <span className="text-slate-400">~</span>
            <input type="date" aria-label="종료일" data-sheets-end value={custom.end} onChange={(e) => setCustom((c) => ({ ...c, end: e.target.value }))} className="px-2 py-1.5 border border-slate-200 rounded-lg" />
          </div>
        )}
        <div className="flex flex-wrap gap-x-3 gap-y-1.5">
          {KINDS.map((k) => (
            <label key={k.key} className="flex items-center gap-1.5 text-xs font-bold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                data-sheets-include={k.key}
                checked={include[k.key]}
                onChange={(e) => setInclude((p) => ({ ...p, [k.key]: e.target.checked }))}
                className="w-3.5 h-3.5 accent-primary cursor-pointer"
              />
              {k.name}
            </label>
          ))}
        </div>
        <p className="text-2xs text-slate-400">메모는 기간과 상관없이 모두 담습니다. 시트로 보낼 때 그 탭은 비우고 다시 씁니다.</p>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" data-sheets-export disabled={!!busy || !sid} onClick={() => void send()} className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl text-xs font-bold disabled:opacity-50 cursor-pointer">
            📊 시트로 보내기
          </button>
          <button
            type="button"
            data-sheets-import
            disabled={!!busy || !sid}
            onClick={() => void read()}
            className="px-4 py-2 bg-white border border-slate-200 hover:border-primary hover:text-primary text-slate-600 rounded-xl text-xs font-bold disabled:opacity-50 cursor-pointer"
          >
            📥 시트에서 되읽기
          </button>
          {sheetId && (
            <a data-sheets-open href={sheetUrlOf(sheetId)} target="_blank" rel="noreferrer" className="text-xs font-bold text-primary hover:underline">
              🔗 구글 시트 열기
            </a>
          )}
        </div>
        {busy && (
          <p data-sheets-busy className="text-xs text-slate-500">
            {busy}
          </p>
        )}
        {result && (
          <p data-sheets-result className="text-xs font-bold text-emerald-700">
            ✅ {result}
          </p>
        )}
      </div>
    </Section>
  );
}
