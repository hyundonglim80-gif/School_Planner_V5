// 개발자 탭 '공휴일' (P14-3 ■2 - V4 환경설정 '개발자 설정 - 공휴일'을 옮김). 공공데이터포털 특일정보에서 받아 `holidays/{연도}`에 쓴다(data/govHolidays).
//   - 키는 admin/config(V4와 같은 칸 - V4에서 넣은 키가 그대로 보인다). 줄은 올해·내년·내후년.
//   - 받은 것이 지금보다 적거나 받지 못한 달이 있으면 덮어쓰기 전에 묻는다(V4는 묻지 않았다). 저장하면 이 기기 표도 다시 읽는다.
import { useCallback, useEffect, useState } from 'react';
import { showErrorToast, showToast } from '../../app/toast';
import { refreshHolidayYear } from '../../data/holidays';
import { fetchGovHolidays, loadGovApiKey, loadHolidayYearStatus, saveGovApiKey, saveSharedHolidays, type HolidayYearStatus } from '../../data/govHolidays';
import { todayStr } from '../../domain/dateUtils';
import { Section } from './parts';

const errText = (e: unknown) => String((e as { code?: string })?.code || (e as Error)?.message || e);
const dayLabel = (ms: number) => {
  const d = new Date(ms);
  return `${d.getMonth() + 1}/${d.getDate()}`;
};

export default function DevHolidaysSection() {
  const [key, setKey] = useState('');
  const [savedKey, setSavedKey] = useState('');
  const [years, setYears] = useState<HolidayYearStatus[] | null>(null);
  const [failed, setFailed] = useState('');
  const [busy, setBusy] = useState<number | 'key' | null>(null);

  const loadYears = useCallback(() => {
    const y = Number(todayStr().slice(0, 4));
    return Promise.all([y, y + 1, y + 2].map(loadHolidayYearStatus))
      .then(setYears)
      .catch((e) => setFailed(errText(e)));
  }, []);

  useEffect(() => {
    void loadYears();
    loadGovApiKey()
      .then((k) => {
        setKey(k);
        setSavedKey(k);
      })
      .catch((e) => setFailed(errText(e)));
  }, [loadYears]);

  const saveKey = async () => {
    setBusy('key');
    try {
      await saveGovApiKey(key);
      setSavedKey(key.trim());
      showToast('🔑 공공데이터포털 키를 저장했습니다.');
    } catch (e) {
      showErrorToast(`키를 저장하지 못했습니다 (${errText(e)}).`, e);
    } finally {
      setBusy(null);
    }
  };

  const download = async (st: HolidayYearStatus) => {
    const k = savedKey.trim();
    if (!k) return showToast('먼저 공공데이터포털 키를 넣고 저장해 주세요.');
    setBusy(st.year);
    try {
      const r = await fetchGovHolidays(st.year, k);
      const n = Object.keys(r.days).length;
      if (n === 0) return showErrorToast(`${st.year}년 공휴일을 한 건도 받지 못했습니다. 키와 사용 승인을 확인해 주세요.`);
      const warn: string[] = [];
      if (r.failedMonths.length > 0) warn.push(`${r.failedMonths.map(Number).join('·')}월을 받지 못했습니다 (${r.reason}).`);
      if (n < st.count) warn.push(`지금 ${st.count}건 → 받은 것 ${n}건.`);
      if (warn.length > 0 && !window.confirm(`${st.year}년 공휴일\n${warn.join('\n')}\n그래도 덮어쓸까요?`)) return;
      await saveSharedHolidays(st.year, r.days);
      refreshHolidayYear(st.year);
      showToast(`📅 ${st.year}년 공휴일 ${n}건을 저장했습니다 - 모든 사용자가 읽습니다.`);
      await loadYears();
    } catch (e) {
      showErrorToast(`${st.year}년 공휴일을 받지 못했습니다 (${errText(e)}).`, e);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Section id="dev-holidays" title="공휴일" desc="설·추석·대체 공휴일 표는 해마다 한 번 받아 둡니다(모든 사용자가 같이 읽습니다). 공공데이터포털 특일정보를 여기서만 부릅니다.">
      <label className="block text-xs font-bold text-slate-700 mb-1" htmlFor="dev-gov-key">
        공공데이터포털 키 (특일정보)
      </label>
      <div className="flex gap-2">
        <input
          id="dev-gov-key"
          data-dev-holidays-key
          type="password"
          autoComplete="off"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="인코딩된 서비스 키"
          className="flex-1 min-w-0 px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-primary"
        />
        <button
          type="button"
          data-dev-holidays-key-save
          disabled={busy !== null || key.trim() === savedKey}
          onClick={() => void saveKey()}
          className="px-3 py-1.5 shrink-0 bg-white border border-slate-200 hover:border-slate-300 text-slate-600 rounded-lg text-xs font-bold cursor-pointer disabled:opacity-40"
        >
          💾 저장
        </button>
      </div>
      <p className="text-[11px] text-slate-400 mt-1">admin/config에 들어갑니다(개발자만 읽음 - 소스·빌드에는 남지 않습니다).</p>
      {failed && (
        <p data-dev-holidays-failed className="text-xs text-red-500 mt-2">
          읽지 못했습니다 ({failed})
        </p>
      )}
      <ul className="mt-3 space-y-1.5">
        {years === null && !failed && <li className="text-xs text-slate-400">읽는 중…</li>}
        {years?.map((st) => (
          <li key={st.year} data-dev-holiday-year={st.year} data-count={st.count} className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
            <span className="text-sm font-black text-slate-700 w-14 shrink-0">{st.year}년</span>
            <span className="text-xs text-slate-500 flex-1 min-w-0">
              {st.count > 0 ? (
                <>
                  {st.count}건{st.updatedAt > 0 && <span className="text-slate-400"> · {dayLabel(st.updatedAt)} 받음</span>}
                </>
              ) : (
                <span className="text-amber-600 font-bold">⚠️ 없음</span>
              )}
            </span>
            <button
              type="button"
              data-dev-holiday-fetch={st.year}
              disabled={busy !== null}
              onClick={() => void download(st)}
              className={`px-3 py-1.5 shrink-0 rounded-lg text-xs font-bold cursor-pointer disabled:opacity-50 ${
                st.count > 0 ? 'bg-white border border-slate-200 hover:border-slate-300 text-slate-600' : 'bg-primary hover:bg-primary/90 text-white'
              }`}
            >
              {busy === st.year ? '받는 중…' : st.count > 0 ? '다시 받기' : '받기'}
            </button>
          </li>
        ))}
      </ul>
    </Section>
  );
}
