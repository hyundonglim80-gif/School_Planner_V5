// 환경설정 '학교' 탭의 '우리 학교' 칸 (V4 components/SchoolSettingPanel.tsx). 이름으로 찾아 고르면 곧바로 계정 설정에(1초 뒤 올라간다).
// 고른 학교의 급식·학사일정을 나이스에서 부른다 (data/neis). 학년을 고르면 학사일정을 그 학년 것만.
import { useState } from 'react';
import { useCommonLoaded } from '../../app/prefs';
import { showErrorToast, showToast } from '../../app/toast';
import { searchSchools, type NeisSchool } from '../../data/neis';
import { installNeisKey } from '../../data/neisKey';
import { maxGrade } from '../../domain/schoolSetting';
import { saveSchool, saveSchoolGrade, useSchool } from './school';

const chip = (on: boolean) =>
  `px-3 py-1.5 rounded-lg text-xs font-bold border transition-all disabled:opacity-50 cursor-pointer ${
    on ? 'bg-primary text-white border-primary shadow-xs' : 'bg-white text-slate-500 border-slate-200 hover:border-primary hover:text-primary'
  }`;

export default function SchoolPicker() {
  const school = useSchool();
  const loaded = useCommonLoaded((s) => s.loaded);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [found, setFound] = useState<{ schools: NeisSchool[]; more: boolean } | null>(null);
  // 학교가 있을 때 바꾸기를 눌렀나 (학교가 없으면 찾기 칸은 늘 보인다)
  const [searching, setSearching] = useState(false);

  const search = async () => {
    if (!query.trim()) return;
    setBusy(true);
    try {
      installNeisKey();
      setFound(await searchSchools(query));
    } catch (e) {
      showErrorToast('나이스에서 학교를 찾지 못했습니다. 잠시 뒤 다시 해 주세요.', e);
    } finally {
      setBusy(false);
    }
  };

  const choose = (s: NeisSchool | null) => {
    saveSchool(s);
    showToast(s ? `🏫 ${s.name}의 급식·학사일정을 봅니다.` : '🏫 우리 학교를 지웠습니다.');
    setFound(null);
    setQuery('');
    setSearching(!s);
  };

  const chooseGrade = (g: number) => {
    saveSchoolGrade(g);
    showToast(g ? `🏫 학사일정을 ${g}학년 것만 봅니다.` : '🏫 학사일정을 전 학년 다 봅니다.');
  };

  return (
    <div className="space-y-2" data-school-setting>
      {school && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-bold text-slate-700" data-school-name={school.schoolCode}>
            🏫 {school.name}
          </span>
          <span className="text-slate-400">{school.officeName}</span>
          <button type="button" data-school-change onClick={() => setSearching((v) => !v)} className={chip(false)}>
            {searching ? '그대로 두기' : '바꾸기'}
          </button>
          <button type="button" data-school-clear onClick={() => choose(null)} className={chip(false)}>
            지우기
          </button>
        </div>
      )}

      {school && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-slate-500 mr-1">학사일정 학년</span>
          {Array.from({ length: maxGrade(school.kind) + 1 }, (_, g) => (
            <button key={g} type="button" data-school-grade={g} onClick={() => chooseGrade(g)} aria-pressed={school.grade === g} className={chip(school.grade === g)}>
              {g ? `${g}학년` : '전 학년'}
            </button>
          ))}
        </div>
      )}

      {(searching || (loaded && !school)) && (
        <div className="space-y-1.5">
          <div className="flex gap-2">
            <input
              type="text"
              data-school-query
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  void search();
                }
              }}
              placeholder="학교 이름 (예: 대도초)"
              aria-label="학교 이름"
              className="flex-1 min-w-0 px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:border-primary"
            />
            <button
              type="button"
              data-school-search
              onClick={() => void search()}
              disabled={busy || !query.trim()}
              className="px-3 py-1.5 shrink-0 bg-primary hover:bg-primary/90 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
            >
              {busy ? '찾는 중...' : '찾기'}
            </button>
          </div>
          {found && (
            <ul className="space-y-1" data-school-results>
              {found.schools.map((s) => (
                <li key={`${s.officeCode}-${s.schoolCode}`}>
                  <button
                    type="button"
                    data-school-result={s.schoolCode}
                    onClick={() => choose(s)}
                    className="w-full text-left px-3 py-2 rounded-lg border border-slate-200 hover:border-primary hover:bg-primary/5 text-xs cursor-pointer"
                  >
                    <span className="font-bold text-slate-800">{s.name}</span>
                    <span className="text-slate-400"> · {s.officeName}</span>
                    {s.address && <span className="block text-slate-400 truncate">{s.address}</span>}
                  </button>
                </li>
              ))}
              {found.schools.length === 0 && <li className="text-xs text-slate-400">찾은 학교가 없습니다. 이름을 줄여 보세요.</li>}
              {found.more && <li className="text-xs text-amber-600">더 있습니다. 이름을 더 적어 주세요 (예: '서울대도초').</li>}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
