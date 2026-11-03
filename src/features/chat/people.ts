// 대화 창이 보일 이름 (P19-2 ■1). 그룹마다 구성원 이름(spaces/{sid}/people)을 창을 열 때 한 번씩 읽는다 - 쪽지 쓰기 탭과 같은 길(readPeople).
//   다시 열면 지난 이름을 곧바로 보이고 뒤에서 새로 받는다. 글의 보낸 사람 이름은 글에 적혀 있어(fromName) 여기를 보지 않는다.
import { useEffect, useState } from 'react';
import { readPeople } from '../../data/spaces';

/** 그룹 → (uid → 이름) */
export type GroupPeople = Record<string, Record<string, string>>;

const cache = new Map<string, Record<string, string>>();

export function useGroupPeople(sids: readonly string[]): GroupPeople {
  const key = [...sids].sort().join(',');
  const [people, setPeople] = useState<GroupPeople>(() => Object.fromEntries(sids.flatMap((s) => (cache.has(s) ? [[s, cache.get(s)!]] : []))));
  useEffect(() => {
    let alive = true;
    for (const sid of key ? key.split(',') : []) {
      readPeople(sid)
        .then((p) => {
          const names = Object.fromEntries(Object.entries(p).flatMap(([uid, x]) => (x.name.trim() ? [[uid, x.name.trim()]] : [])));
          cache.set(sid, names);
          if (alive) setPeople((prev) => ({ ...prev, [sid]: names }));
        })
        .catch((e) => console.warn('[chat] 구성원 이름을 받지 못했습니다.', e));
    }
    return () => {
      alive = false;
    };
  }, [key]);
  return people;
}

/** 이름 - 먼저 그 그룹(sid), 없으면 다른 그룹, 그래도 없으면 fallback(1:1 방 names) */
export function personName(people: GroupPeople, uid: string, sid?: string, fallback?: string): string {
  return (sid ? people[sid]?.[uid] : undefined) ?? Object.values(people).find((g) => g[uid])?.[uid] ?? (fallback || '이름 없음');
}
