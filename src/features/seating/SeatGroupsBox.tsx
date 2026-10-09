// 자리표 창의 👥 모둠 칸 (V4 components/SeatGroupsPanel.tsx). 셈은 domain/groups, 저장은 학급 허브 groupSets(seatingData.saveGroupSet).
//   - 새로 나누기: 무작위(떨어뜨릴 학생은 다른 모둠으로) · 자리대로(앞뒤 넷씩). 나눈 것은 먼저 '저장 전'으로 보이고, 이름을 붙여 저장한다.
//   - 저장한 모둠을 누르면 자리표에 모둠 색이 보인다(이 칸이 열려 있는 동안). 조사표 '조별 평가'를 만들 때 불러 쓴다(P7-4).
//   - 학생을 누른 뒤 다른 모둠의 학생을 누르면 서로 바꾸고, 모둠 이름(빈 곳)을 누르면 그 모둠으로 옮긴다(저장한 모둠은 바로 저장).
//   - 지우기 = 그 벌의 칸 지우기(안내의 되돌리기 - V4는 휴지통).
import { useEffect, useState } from 'react';
import { showToast } from '../../app/toast';
import type { Stored } from '../../data/types';
import { newId } from '../../data/id';
import { apartInGroups, defaultGroupCount, groupColor, groupName, groupSetSummary, MAX_GROUPS, moveMember, randomGroups, seatGroups, swapMembers, type GroupSet, type StudentGroup } from '../../domain/groups';
import { parsePairKey, type SeatingChart } from '../../domain/seating';
import { saveGroupSet } from './seatingData';

interface Props {
  sid: string;
  classId: string;
  stored: Stored<'classHub'> | undefined;
  sets: GroupSet[];
  /** 재학생 sid (번호 차례) */
  activeNums: string[];
  /** 떨어뜨릴 학생 쌍 */
  apart: string[];
  /** 지금 보는 자리표 ('자리대로'에 쓴다) */
  chart: SeatingChart | null;
  /** '15번 홍길동' */
  nameOf: (sid: string) => string;
  /** 자리표에 칠할 모둠 (없으면 null) */
  onShown: (groups: StudentGroup[] | null) => void;
}

const SET_MEMORY_KEY = 'sp5-seating-groupset';
function readMemory(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(SET_MEMORY_KEY) || '{}') || {};
  } catch {
    return {};
  }
}
function remember(classId: string, id: string | null) {
  try {
    const next = { ...readMemory() };
    if (id) next[classId] = id;
    else delete next[classId];
    localStorage.setItem(SET_MEMORY_KEY, JSON.stringify(next));
  } catch {
    /* 이 기기에서 기억하지 못할 뿐 */
  }
}

/** '10/2 모둠', 같은 이름이 있으면 '10/2 모둠 (2)' */
function defaultSetName(sets: GroupSet[]): string {
  const d = new Date();
  const base = `${d.getMonth() + 1}/${d.getDate()} 모둠`;
  const names = new Set(sets.map((s) => s.name));
  if (!names.has(base)) return base;
  let n = 2;
  while (names.has(`${base} (${n})`)) n++;
  return `${base} (${n})`;
}

type Draft = { name: string; groups: StudentGroup[]; mode: 'random' | 'seats' };

export default function SeatGroupsBox({ sid, classId, stored, sets, activeNums, apart, chart, nameOf, onShown }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(() => readMemory()[classId] || null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [count, setCount] = useState(() => defaultGroupCount(activeNums.length));
  const [picked, setPicked] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const selected = sets.find((s) => s.id === selectedId) || null;
  const shown: StudentGroup[] | null = draft ? draft.groups : selected ? selected.groups : null;
  // 이름 칸 - 보이는 것이 바뀌면 다시 채운다 (그리는 중에 맞춘다)
  const nameKey = draft ? `draft:${draft.name}` : `saved:${selected?.id ?? ''}:${selected?.name ?? ''}`;
  const [seenName, setSeenName] = useState(nameKey);
  const [nameDraft, setNameDraft] = useState(draft ? draft.name : (selected?.name ?? ''));
  if (seenName !== nameKey) {
    setSeenName(nameKey);
    setNameDraft(draft ? draft.name : (selected?.name ?? ''));
  }

  useEffect(() => {
    onShown(shown);
  }, [shown, onShown]);
  useEffect(() => () => onShown(null), [onShown]);

  const inGroup = new Set((shown ?? []).flatMap((g) => g.members));
  const unassigned = shown ? activeNums.filter((n) => !inGroup.has(n)) : [];
  const together = shown ? apartInGroups(shown, apart) : [];

  const chooseSet = (id: string) => {
    setDraft(null);
    setPicked(null);
    const next = selectedId === id ? null : id;
    setSelectedId(next);
    remember(classId, next);
  };
  const makeRandom = () => {
    if (activeNums.length === 0) return showToast('명렬표에 재학생이 없습니다.');
    setPicked(null);
    setDraft({ name: draft?.name || defaultSetName(sets), groups: randomGroups(activeNums, count, apart), mode: 'random' });
  };
  const makeBySeat = () => {
    if (!chart) return showToast('자리표가 없어 자리대로 나눌 수 없습니다. 자리표를 먼저 만들거나 무작위로 나눕니다.');
    if (activeNums.length === 0) return showToast('명렬표에 재학생이 없습니다.');
    setPicked(null);
    setDraft({ name: draft?.name || defaultSetName(sets), groups: seatGroups(chart, activeNums), mode: 'seats' });
  };
  const saveDraft = async () => {
    if (!draft || busy) return;
    const name = nameDraft.trim() || draft.name;
    const id = newId();
    setBusy(true);
    try {
      await saveGroupSet(sid, classId, stored, id, { name, groups: draft.groups.filter((g) => g.members.length > 0) });
      setDraft(null);
      setPicked(null);
      setSelectedId(id);
      remember(classId, id);
      showToast(`💾 모둠 '${name}'을(를) 저장했습니다. 조사표 '조별 평가'를 만들 때 불러 씁니다.`);
    } catch {
      // 안내는 저장 도우미가 했다
    } finally {
      setBusy(false);
    }
  };
  /** 저장한 모둠을 고친다 (이름·옮기기) */
  const updateSelected = (fields: Partial<Pick<GroupSet, 'name' | 'groups'>>) => {
    if (!selected) return;
    void saveGroupSet(sid, classId, stored, selected.id, { ...selected, ...fields }).catch(() => {});
  };
  const saveName = () => {
    const name = nameDraft.trim();
    if (draft) {
      if (name) setDraft({ ...draft, name });
      return;
    }
    if (!selected || !name || name === selected.name) return setNameDraft(selected?.name || '');
    updateSelected({ name });
  };
  const deleteSelected = async () => {
    if (!selected || busy) return;
    setBusy(true);
    try {
      await saveGroupSet(sid, classId, stored, selected.id, null, `🗑️ 모둠 '${selected.name}'을(를) 지웠습니다.`);
      setSelectedId(null);
      remember(classId, null);
    } catch {
      // 안내는 저장 도우미가 했다
    } finally {
      setBusy(false);
    }
  };
  const setGroups = (groups: StudentGroup[]) => {
    if (draft) setDraft({ ...draft, groups });
    else updateSelected({ groups });
  };
  const moveTo = (index: number) => {
    if (picked === null || !shown) return;
    const from = shown.findIndex((g) => g.members.includes(picked));
    setPicked(null);
    if (from === index) return;
    setGroups(moveMember(shown, picked, index, activeNums));
  };
  const addEmptyGroup = () => {
    if (!shown || shown.length >= MAX_GROUPS) return;
    setGroups([...shown, { name: groupName(shown.length), members: [] }]);
  };

  const btn = 'px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 font-bold cursor-pointer';
  const memberChip = (n: string) => (
    <button
      key={n}
      type="button"
      data-group-member={n}
      aria-pressed={picked === n}
      onClick={(e) => {
        // 모둠 칸의 누름(옮기기)으로 번지지 않게
        e.stopPropagation();
        if (picked === null || picked === n || !shown) return setPicked(picked === n ? null : n);
        const from = shown.findIndex((g) => g.members.includes(picked));
        const to = shown.findIndex((g) => g.members.includes(n));
        // 같은 모둠(또는 둘 다 모둠 없음)이면 고르기만 바꾼다
        if (from === to) return setPicked(n);
        setPicked(null);
        setGroups(swapMembers(shown, picked, n, activeNums));
      }}
      className={`px-1.5 py-0.5 rounded-md border text-2xs font-bold cursor-pointer ${picked === n ? 'border-primary bg-indigo-50 text-primary ring-2 ring-primary/30' : 'border-slate-200 bg-white text-slate-700'}`}
    >
      {nameOf(n)}
    </button>
  );

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 flex flex-col gap-2 text-xs" data-seating-box="groups">
      {sets.length > 0 && (
        <div className="flex flex-wrap items-center gap-1" aria-label="저장한 모둠">
          <span className="font-bold text-slate-400 mr-1">저장한 모둠</span>
          {sets.map((s) => (
            <button
              key={s.id}
              type="button"
              data-group-set={s.id}
              aria-pressed={!draft && s.id === selectedId}
              onClick={() => chooseSet(s.id)}
              className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer ${!draft && s.id === selectedId ? 'bg-slate-800 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'}`}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="font-bold text-slate-400">새로 나누기</span>
        <label className="flex items-center gap-1">
          <input
            type="number"
            min={1}
            max={MAX_GROUPS}
            data-group-count
            value={count}
            onChange={(e) => setCount(Math.max(1, Math.min(MAX_GROUPS, Number(e.target.value) || 1)))}
            aria-label="모둠 수"
            className="w-12 px-1.5 py-1 border border-slate-200 rounded-lg text-center font-bold"
          />
          모둠
        </label>
        <button type="button" data-group-random onClick={makeRandom} className={btn}>
          🎲 무작위로
        </button>
        <button type="button" data-group-by-seat onClick={makeBySeat} className={btn} title="자리표에서 앞뒤 두 줄 × 짝씩 묶습니다 (모둠 수는 자리대로)">
          🪑 자리대로 (앞뒤 넷씩)
        </button>
        {apart.length > 0 && <span className="text-slate-400">떨어뜨릴 학생 {apart.length}쌍은 다른 모둠으로</span>}
      </div>
      {shown && (
        <div className="flex flex-col gap-2 pt-2 border-t border-slate-200" data-group-view={draft ? 'draft' : 'saved'}>
          <div className="flex flex-wrap items-center gap-1.5">
            {draft && <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-black">저장 전</span>}
            <input
              value={nameDraft}
              data-group-name
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={saveName}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  if (draft) void saveDraft();
                  else saveName();
                }
              }}
              aria-label="모둠 이름"
              className="flex-1 min-w-[8rem] px-2 py-1 border border-slate-200 rounded-lg font-bold bg-white"
            />
            <span className="text-slate-500 font-bold" data-group-summary>
              {groupSetSummary(shown)}
            </span>
            {draft ? (
              <>
                <button type="button" data-group-save onClick={() => void saveDraft()} disabled={busy} className="px-2.5 py-1 rounded-lg bg-primary text-white font-black cursor-pointer">
                  💾 저장
                </button>
                <button
                  type="button"
                  data-group-discard
                  onClick={() => {
                    setDraft(null);
                    setPicked(null);
                  }}
                  className={btn}
                >
                  버리기
                </button>
              </>
            ) : (
              <button type="button" data-group-delete onClick={() => void deleteSelected()} disabled={busy} className="px-2 py-1 rounded-lg text-red-600 hover:bg-red-50 font-bold cursor-pointer">
                🗑️ 지우기
              </button>
            )}
          </div>
          {together.length > 0 && (
            <p className="text-amber-700 font-bold" data-group-apart-warn>
              ⚠️ 떨어뜨릴 학생이 같은 모둠:{' '}
              {together
                .map((k) => parsePairKey(k))
                .filter((p): p is [string, string] => !!p)
                .map(([a, b]) => `${nameOf(a)} ↔ ${nameOf(b)}`)
                .join(', ')}
            </p>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {shown.map((g, i) => {
              const color = groupColor(i);
              return (
                <div
                  key={i}
                  data-group-index={i}
                  onClick={() => moveTo(i)}
                  className={`rounded-lg border p-1.5 flex flex-col gap-1 ${color.chip} ${picked !== null ? 'cursor-pointer hover:ring-2 hover:ring-primary/30' : ''}`}
                >
                  <div className={`flex items-center gap-1 font-black ${color.text}`} data-group-head>
                    <span className={`w-2 h-2 rounded-full ${color.bar}`} aria-hidden />
                    {g.name}
                    <span className="font-bold text-slate-400">{g.members.length}명</span>
                  </div>
                  <div className="flex flex-wrap gap-1">{g.members.map(memberChip)}</div>
                </div>
              );
            })}
          </div>
          {unassigned.length > 0 && (
            <div className="flex flex-wrap items-center gap-1" data-group-unassigned>
              <span className="text-2xs font-black text-slate-400 mr-1">모둠 없는 학생</span>
              {unassigned.map(memberChip)}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2 text-2xs text-slate-400">
            <span>
              학생을 누른 뒤 다른 모둠의 학생을 누르면 서로 바꾸고, 모둠 이름을 누르면 그 모둠으로 옮깁니다.
              {draft ? '' : ' 저장한 모둠은 바로 저장됩니다.'}
            </span>
            {shown.length < MAX_GROUPS && (
              <button type="button" data-group-add-empty onClick={addEmptyGroup} className="font-bold text-primary hover:underline cursor-pointer">
                ＋ 빈 모둠
              </button>
            )}
          </div>
        </div>
      )}
      {!shown && sets.length === 0 && <p className="text-slate-400">저장한 모둠이 없습니다. 무작위나 자리대로 나눈 뒤 이름을 붙여 저장하면, 조사표 '조별 평가'를 만들 때 불러 씁니다.</p>}
    </div>
  );
}
