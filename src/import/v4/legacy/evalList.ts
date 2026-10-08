// V4 lib/evalList.ts에서 옮긴 읽기 (DESIGN 8-1). 조사표 문서(`{sp}/evaluations/{날짜}`)의 목록.
//
// V3는 `evalList`만 쓴다. V4는 2026-09-14부터 `list`와 `evalList`를 함께, 그 전에는 `list`만 썼다.
//   - 한 이름만 있으면 그것을 쓴다.
//   - 둘 다 있으면 `evalList`가 최신이다(두 앱이 모두 쓰는 이름).
//   - 다만 둘이 겹치는 항목이 하나도 없으면 9/14 전 V4(list)와 V3(evalList)가 따로 만든 두 목록이라 합친다
//     (한쪽이 비었으면 합치지 않는다 - V3에서 모두 지운 날이다).

const keyOf = (e: unknown) => {
  const id = e && typeof e === 'object' ? (e as { id?: unknown }).id : undefined;
  return id !== undefined && id !== null ? `id:${String(id)}` : `js:${JSON.stringify(e)}`;
};

export function readEvalList(data: unknown): unknown[] {
  if (!data || typeof data !== 'object') return [];
  const d = data as { evalList?: unknown; list?: unknown };
  const fromBoth = Array.isArray(d.evalList) ? (d.evalList as unknown[]) : null;
  const fromV4 = Array.isArray(d.list) ? (d.list as unknown[]) : null;
  if (!fromBoth && !fromV4) return [];
  if (!fromV4) return fromBoth!;
  if (!fromBoth) return fromV4;
  if (fromBoth.length === 0 || fromV4.length === 0) return fromBoth;
  const keys = new Set(fromBoth.map(keyOf));
  if (fromV4.some((e) => keys.has(keyOf(e)))) return fromBoth;
  return [...fromBoth, ...fromV4];
}
