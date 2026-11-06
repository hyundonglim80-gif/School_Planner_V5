// 보냈는데 서버가 아직 받지 않은 글 (P22-5 ■1). 끊긴 동안 보낸 글은 메모리의 쓰기 대기에만 있어 앱을 닫으면 사라진다 -
//   받을 때까지 이 기기 보관(data/drafts - 열쇠 'unsent:<칸 열쇠>')에 따로 남기고, 다음에 그 칸을 열면 글 칸에 돌려준다.
//   - 쓰던 글 보관(useDraft)과 열쇠를 나눈다: 글 칸은 보내면 비고, 잇달아 보낸 글이 서로 덮지 않아야 한다.
//   - 이 탭에서 아직 기다리는 글은 돌려주지 않는다 - 끊긴 채 방을 떠났다 돌아오면 방에 '보내는 중…'으로 보이는 글이 칸에도 채워진다.
//   - 칸이 닫힌 뒤 서버가 막은 글은 기다림만 풀고 남긴다 - 다음에 열면 칸으로 돌아온다.
//   '저장하지 않은 글' 띠에는 들지 않는다(draftPlace가 모르는 열쇠). 로그아웃은 보관째 지운다(묻기에 수가 든다).
import { deleteDraft, readDraft, writeDraft } from '../../data/drafts';
import { newId } from '../../data/id';
import type { Attachment } from '../../data/types';

export interface UnsentChat {
  text: string;
  attachments: Attachment[];
}

interface Held extends UnsentChat {
  id: string;
}

const storeKey = (key: string) => `unsent:${key}`;

/** 이 탭이 남긴 글 (칸 열쇠마다) */
const held = new Map<string, Held[]>();
/** 그중 서버를 기다리는 글 */
const waiting = new Set<string>();

function save(uid: string, key: string): Promise<void> {
  const list = held.get(key) ?? [];
  return list.length ? writeDraft(uid, storeKey(key), list) : deleteDraft(uid, storeKey(key));
}

/** 보내기 직전에 남긴다. 돌려준 함수 = 끝났다 - keep이면 지우지 않고 다음에 열 때 돌려준다 */
export function holdUnsent(uid: string, key: string, item: UnsentChat): (keep: boolean) => void {
  const id = newId();
  held.set(key, [...(held.get(key) ?? []), { ...item, id }]);
  waiting.add(id);
  void save(uid, key);
  return (keep) => {
    waiting.delete(id);
    if (keep) return;
    held.set(key, (held.get(key) ?? []).filter((h) => h.id !== id));
    void save(uid, key);
  };
}

/** 칸을 열 때 - 지난번에 받지 못한 글을 꺼낸다 (차례대로). 이 탭에서 기다리는 글은 남긴다. wanted = 읽는 동안 칸이 그대로인가 - 아니면 꺼내지 않는다 */
export async function takeUnsent(uid: string, key: string, wanted: () => boolean): Promise<UnsentChat[]> {
  const saved = (await readDraft<Held[]>(uid, storeKey(key)))?.value;
  if (!wanted()) return [];
  const all = Array.isArray(saved) ? saved : (held.get(key) ?? []);
  const left = all.filter((h) => !waiting.has(h.id));
  if (left.length === 0) return [];
  held.set(key, (held.get(key) ?? []).filter((h) => !left.some((l) => l.id === h.id)));
  await save(uid, key);
  return left.map(({ text, attachments }) => ({ text, attachments }));
}

/** 시험 - 앱을 닫았다 연 것처럼 */
export function forgetUnsentForTest() {
  held.clear();
  waiting.clear();
}
