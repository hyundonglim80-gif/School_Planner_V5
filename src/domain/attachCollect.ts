// 첨부 모으기 (V4 lib/driveMigration.ts의 찾기·바꾸기 - 순수, P8-3). 넣기는 features/backup/collect.
//
// V4에서 가져온 기록·메모·일정·수업 칸에는 예전 Firebase Storage 주소의 첨부가 남아 있을 수 있다.
// V5는 그 파일을 드라이브(School_Planner 폴더)로 **복사**하고 V5 문서의 주소만 바꾼다.
// Storage 원본은 지우지 않는다 - V4가 아직 같은 주소를 쓴다(PLAN 5장 P8-3).

/** 문서 안에서 찾아낸 첨부 하나 */
export interface FoundFile {
  /** 문서 안 위치 */
  path: (string | number)[];
  url: string;
  name: string;
}

export const isStorageUrl = (u: unknown): u is string => typeof u === 'string' && /firebasestorage\.googleapis\.com|\.firebasestorage\.app/.test(u);

/** 주소 끝의 파일 이름 (올릴 때 앞에 붙인 타임스탬프는 뗀다) */
export function nameFromUrl(url: string): string {
  try {
    const last = decodeURIComponent(url.split('?')[0]).split('/').pop() || 'file';
    return last.replace(/^\d{10,}_/, '') || 'file';
  } catch {
    return 'file';
  }
}

/** 문서에서 Storage 주소를 모두 찾는다 (어떤 모양이든 통째로 내려가며 - 빠뜨리면 영영 옛 주소로 남는다) */
export function collectStorageFiles(data: unknown): FoundFile[] {
  const found: FoundFile[] = [];
  const walk = (node: unknown, path: (string | number)[]) => {
    if (isStorageUrl(node)) return void found.push({ path, url: node, name: nameFromUrl(node) });
    if (Array.isArray(node)) return node.forEach((v, i) => walk(v, [...path, i]));
    if (node && typeof node === 'object') for (const [k, v] of Object.entries(node as Record<string, unknown>)) walk(v, [...path, k]);
  };
  walk(data, []);
  return found;
}

/**
 * 찾은 자리의 주소를 새 주소로 갈아 끼운 **맨 위 칸들**(저장 도우미의 바뀐 칸) - 원본은 건드리지 않는다.
 * 주소가 객체의 'url' 칸이면 그 객체에 driveId도 단다(그림 펼치기·지우기에 쓴다).
 */
export function changesForNewUrls(
  data: Record<string, unknown>,
  changes: ReadonlyArray<{ path: (string | number)[]; url: string; driveId: string }>,
  /** 바꾼 칸의 깊이 - 수업 칸은 2('periods.3' - 다른 교시를 덮지 않게) */
  depth = 1,
): Record<string, unknown> {
  const clone = JSON.parse(JSON.stringify(data)) as Record<string, unknown>;
  const top = new Set<string>();
  for (const c of changes) {
    let node: Record<string | number, unknown> = clone;
    for (let i = 0; i < c.path.length - 1; i++) node = node?.[c.path[i]] as Record<string | number, unknown>;
    if (!node) continue;
    const last = c.path[c.path.length - 1];
    node[last] = c.url;
    if (last === 'url') node.driveId = c.driveId;
    top.add(c.path.slice(0, depth).join('.'));
  }
  const at = (key: string) => key.split('.').reduce<unknown>((n, k) => (n as Record<string, unknown>)?.[k], clone);
  return Object.fromEntries([...top].map((k) => [k, at(k)]));
}
