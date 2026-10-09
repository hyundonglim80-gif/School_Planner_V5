// 자리표 창의 🚫 떨어뜨릴 학생 칸 (V4 SeatingModal 'apart') - 학급마다 하나(학급 허브 apart), 그 학급의 자리표 모두에 쓰인다.
//   쌍은 'sidA|sidB'(domain/seating pairKey). 더하기·빼기는 곧바로 저장(Ctrl+Z 더미에).
import { useState } from 'react';
import { showToast } from '../../app/toast';
import type { Stored } from '../../data/types';
import { pairKey, parsePairKey } from '../../domain/seating';
import { saveApart } from './seatingData';

interface Props {
  sid: string;
  classId: string;
  stored: Stored<'classHub'> | undefined;
  apart: string[];
  /** 재학생 sid (번호 차례) */
  activeIds: string[];
  nameOf: (sid: string) => string;
}

export default function SeatApartBox({ sid, classId, stored, apart, activeIds, nameOf }: Props) {
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const write = (next: string[]) => void saveApart(sid, classId, stored, next).catch(() => {});
  const add = () => {
    if (!a || !b) return showToast('학생 두 명을 고르세요.');
    if (a === b) return showToast('서로 다른 학생을 고르세요.');
    const key = pairKey(a, b);
    if (apart.includes(key)) return showToast('이미 있는 쌍입니다.');
    write([...apart, key]);
    setA('');
    setB('');
  };
  const options = activeIds.map((id) => (
    <option key={id} value={id}>
      {nameOf(id)}
    </option>
  ));
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 flex flex-col gap-2 text-xs" data-seating-box="apart">
      <p className="text-slate-500">섞을 때 앞뒤옆(대각선 포함)으로 붙여 앉히지 않습니다. 모둠을 무작위로 나눌 때도 같은 모둠에 넣지 않습니다. 이 학급의 자리표 모두에 쓰입니다.</p>
      {apart.length === 0 ? (
        <p className="text-slate-400">아직 없습니다.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {apart.map((key) => {
            const pair = parsePairKey(key);
            if (!pair) return null;
            return (
              <span key={key} className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full bg-white border border-slate-200 font-bold" data-apart={key}>
                {nameOf(pair[0])} ↔ {nameOf(pair[1])}
                <button
                  type="button"
                  data-apart-remove={key}
                  onClick={() => write(apart.filter((k) => k !== key))}
                  aria-label={`${nameOf(pair[0])} ↔ ${nameOf(pair[1])} 빼기`}
                  title="빼기"
                  className="w-5 h-5 rounded-full hover:bg-slate-100 text-slate-400 cursor-pointer"
                >
                  ✕
                </button>
              </span>
            );
          })}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-1.5">
        <select value={a} data-apart-a onChange={(e) => setA(e.target.value)} aria-label="떨어뜨릴 학생 1" className="px-2 py-1 border border-slate-200 rounded-lg">
          <option value="">학생</option>
          {options}
        </select>
        <span>↔</span>
        <select value={b} data-apart-b onChange={(e) => setB(e.target.value)} aria-label="떨어뜨릴 학생 2" className="px-2 py-1 border border-slate-200 rounded-lg">
          <option value="">학생</option>
          {options}
        </select>
        <button type="button" data-apart-add onClick={add} className="px-2.5 py-1 rounded-lg bg-slate-800 text-white font-bold cursor-pointer">
          ＋ 더하기
        </button>
      </div>
    </div>
  );
}
