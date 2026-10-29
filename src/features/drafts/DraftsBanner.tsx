// 앱을 열 때 '📝 저장하지 않은 글 n개 - 보기' 띠 (P14-6 ■1b - 10-30 사용자 휴대폰 (a) ②: 끊긴 채 저장하고 앱을 닫으면 메모는 쓰던 글 보관에만 남아
// 같은 칸을 다시 열어야 보였다).
//   - 앱을 연 때 남아 있던 글만 센다(지금 쓰는 칸이 2초마다 적는 것은 세지 않는다). 되살려 저장하거나 버리면 줄고, 0이면 사라진다.
//   - 보기 = 창 'drafts' · 나중에 = 이 기기에서 지금까지 남은 것은 다시 알리지 않는다(새로 남은 글이 생기면 다음에 연 때 다시).
import { useEffect, useState } from 'react';
import { useSession } from '../../data/session';
import { openDraftsWindow } from './open';
import { readDraftRows, useDraftRows } from './useDraftRows';

const seenKey = (uid: string) => `sp5_drafts_seen_${uid}`;

function readSeen(uid: string): number {
  try {
    return Number(localStorage.getItem(seenKey(uid))) || 0;
  } catch {
    return 0;
  }
}

export default function DraftsBanner() {
  const uid = useSession((s) => s.user?.uid ?? null);
  /** 앱을 연 때 남아 있던 글의 열쇠 (알릴 것이 없으면 빈 집합) */
  const [atOpen, setAtOpen] = useState<{ uid: string; keys: ReadonlySet<string>; newest: number } | null>(null);
  const [hidden, setHidden] = useState(false);
  const rows = useDraftRows(atOpen && !hidden ? atOpen.uid : null);

  useEffect(() => {
    if (!uid) return;
    let alive = true;
    void readDraftRows(uid).then((list) => {
      if (!alive) return;
      const seen = readSeen(uid);
      // 나중에를 누른 뒤에 새로 남은 글이 없으면 알리지 않는다
      const fresh = list.some((r) => r.savedAt > seen);
      setAtOpen({ uid, keys: new Set(fresh ? list.map((r) => r.key) : []), newest: Math.max(0, ...list.map((r) => r.savedAt)) });
    });
    return () => {
      alive = false;
    };
  }, [uid]);

  if (!atOpen || hidden || !rows || atOpen.uid !== uid) return null;
  const left = rows.filter((r) => atOpen.keys.has(r.key)).length;
  if (left === 0) return null;

  const acknowledge = () => {
    try {
      localStorage.setItem(seenKey(atOpen.uid), String(atOpen.newest));
    } catch {
      // 기기 저장소가 막혀도 이번에는 숨긴다
    }
    setHidden(true);
  };

  return (
    <div role="status" data-drafts-banner={left} className="mb-3 flex items-center gap-2 flex-wrap rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">
      <span className="font-bold">📝 저장하지 않은 글 {left}개가 이 기기에 남아 있습니다.</span>
      <span className="text-sky-700">인터넷이 끊긴 채 저장했거나 저장하지 않고 닫은 글입니다.</span>
      <span className="ml-auto flex items-center gap-1.5">
        <button
          type="button"
          data-drafts-banner-open
          onClick={() => {
            acknowledge();
            openDraftsWindow();
          }}
          className="px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-bold cursor-pointer"
        >
          보기
        </button>
        <button type="button" data-drafts-banner-later onClick={acknowledge} className="px-2 py-1 rounded-lg hover:bg-sky-100 font-bold text-sky-800 cursor-pointer">
          나중에
        </button>
      </span>
    </div>
  );
}
