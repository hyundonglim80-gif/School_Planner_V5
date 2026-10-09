// 기록·메모의 🧑‍🎓 학생 태그 (V4 StudentMentionList·StudentTagPicker - V5는 글에 '#26040305'를 넣지 않고 studentIds 칩으로, 셈은 domain/studentTag).
//   StudentMentionList: 글 칸에서 '@이름'을 치면 뜨는 목록 - 키보드(↑↓·Enter·Tab·Esc)는 글 칸이 받아 넘긴다(목록으로 초점을 옮기면 한글 조합이 끊긴다).
//   StudentTagRow: 고른 학생 칩(✕로 빼기) + '🧑‍🎓 학생 고르기'(학급을 골라 학생을 누르면 더하기·빼기).
//   EntryStudents: 카드의 학생 칩.
import { useState } from 'react';
import { describeClass, isActive } from '../../domain/roster';
import { studentKeyOf, studentOfKey, type MentionCandidate } from '../../domain/studentTag';
import { useClasses, useHubClass, type ClassItem } from '../class/classes';

/** 칩 글자 '김지우' - 올해가 아닌 학급이면 '김지우 (2025 4-3)' */
const chipText = (cls: ClassItem, name: string, num: number, year: number) => `${name || `${num}번`}${cls.year !== year ? ` (${cls.year} ${cls.grade}-${cls.num})` : ''}`;

export function StudentMentionList({
  query,
  candidates,
  activeIndex,
  hasClasses,
  onPick,
}: {
  query: string;
  candidates: MentionCandidate<ClassItem>[];
  activeIndex: number;
  hasClasses: boolean;
  onPick: (c: MentionCandidate<ClassItem>) => void;
}) {
  const manyClasses = new Set(candidates.map((c) => c.cls.id)).size > 1;
  return (
    <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-white border border-amber-200 rounded-xl shadow-lg p-1 max-h-64 overflow-y-auto" data-student-mention>
      {candidates.length === 0 ? (
        <p className="px-2 py-1.5 text-xs text-slate-400">
          {hasClasses ? `'${query}'에 맞는 학생이 없습니다.` : '명렬표가 없습니다 - 학급 화면의 명렬표에서 학생을 넣습니다.'} Esc로 닫습니다.
        </p>
      ) : (
        <ul role="listbox" aria-label="학생 태그 넣기">
          {candidates.map((c, i) => (
            <li key={c.key}>
              <button
                type="button"
                role="option"
                aria-selected={i === activeIndex}
                data-mention-option={c.key}
                // 글 칸의 초점을 잃지 않게 (blur로 목록이 먼저 닫히지 않게)
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onPick(c)}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-xs cursor-pointer ${i === activeIndex ? 'bg-amber-100 text-amber-900' : 'hover:bg-slate-50 text-slate-700'}`}
              >
                <span className="w-6 text-right font-black text-slate-400">{c.student.num}</span>
                <span className="font-black">{c.student.name}</span>
                {manyClasses && <span className="ml-auto text-slate-400">{describeClass(c.cls)}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="px-2 pt-1 text-2xs text-slate-400 border-t border-slate-100 mt-1">↑↓로 고르고 Enter·Tab으로 넣습니다. 자음만 쳐도(ㄱㅈ) 찾습니다.</p>
    </div>
  );
}

/** 고른 학생 칩 + 🧑‍🎓 학생 고르기 */
export function StudentTagRow({ studentIds, onChange, year }: { studentIds: string[]; onChange: (ids: string[]) => void; year: number }) {
  const { classes } = useClasses();
  const hub = useHubClass((s) => s.id);
  const [open, setOpen] = useState(false);
  const [classId, setClassId] = useState<string | null>(null);
  const cls = classes.find((c) => c.id === classId) ?? classes.find((c) => c.id === hub) ?? classes.find((c) => c.students.length > 0) ?? classes[0] ?? null;
  const toggle = (key: string) => onChange(studentIds.includes(key) ? studentIds.filter((k) => k !== key) : [...studentIds, key]);

  return (
    <div className="space-y-2" data-note-students={studentIds.length}>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-semibold text-slate-600">🧑‍🎓 학생</span>
        {studentIds.map((key) => {
          const found = studentOfKey(key, classes);
          return (
            <span
              key={key}
              data-note-student={key}
              className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-xs font-bold text-amber-800"
              title={found ? `${describeClass(found.cls)} ${found.student.num}번` : '명렬표에서 찾지 못한 학생'}
            >
              {found ? chipText(found.cls, found.student.name, found.student.num, year) : '(지운 학생)'}
              <button type="button" data-note-student-remove={key} onClick={() => toggle(key)} title="빼기" aria-label="빼기" className="w-4 h-4 rounded-full text-amber-500 hover:text-amber-900 hover:bg-amber-100 cursor-pointer leading-none">
                ✕
              </button>
            </span>
          );
        })}
        <button
          type="button"
          data-note-student-pick-open
          aria-pressed={open}
          onClick={() => setOpen((v) => !v)}
          title="학생 기록(누가기록)에 이 글이 모입니다. 글 칸에서 @이름을 쳐도 됩니다."
          className="px-2 py-0.5 rounded-md text-xs font-bold border border-dashed border-amber-300 text-amber-700 hover:bg-amber-50 cursor-pointer"
        >
          {open ? '닫기' : '+ 학생 고르기'}
        </button>
      </div>
      {open && (
        <div className="p-2.5 bg-amber-50/60 border border-amber-200 rounded-xl space-y-2" data-note-student-picker>
          {!cls ? (
            <p className="text-xs text-slate-500">명렬표가 없습니다 - 학급 화면의 🧑‍🤝‍🧑 명렬표에서 학생을 넣으면 여기서 고릅니다.</p>
          ) : (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={cls.id}
                  data-note-student-class
                  onChange={(e) => setClassId(e.target.value)}
                  aria-label="학생을 고를 학급"
                  className="px-2 py-1 text-xs border border-slate-200 rounded-lg font-bold bg-white"
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {describeClass(c)}
                    </option>
                  ))}
                </select>
                <span className="text-xs text-slate-500">누르면 더하고, 다시 누르면 뺍니다</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {cls.students.filter(isActive).map((s) => {
                  const key = studentKeyOf(cls, s.sid);
                  const on = studentIds.includes(key);
                  return (
                    <button
                      key={s.sid}
                      type="button"
                      data-note-student-option={key}
                      aria-pressed={on}
                      onClick={() => toggle(key)}
                      className={`px-2 py-1 rounded-lg border text-xs font-bold cursor-pointer ${on ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-slate-600 border-slate-200 hover:border-amber-400'}`}
                    >
                      {s.num} {s.name}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** 카드의 학생 칩 '🧑‍🎓 김지우' (명렬표에서 지운 학생은 빼고 보인다) */
export function EntryStudents({ studentIds }: { studentIds: readonly string[] }) {
  const { classes } = useClasses();
  const names = studentIds.map((key) => studentOfKey(key, classes)).filter((x) => x !== null);
  if (names.length === 0) return null;
  return (
    <span className="inline-flex flex-wrap gap-1" data-entry-students={names.length}>
      {names.map(({ cls, student }) => (
        <span key={`${cls.id}/${student.sid}`} className="px-1.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-2xs font-bold text-amber-800" title={`${describeClass(cls)} ${student.num}번`}>
          🧑‍🎓 {student.name || `${student.num}번`}
        </span>
      ))}
    </span>
  );
}
