// 이월: 처음 따라올 때 carrying 한 번 (DESIGN 5-1). 껍데기(Shell)에 하나 둔다 - 그리는 것은 없다.
//
// 오늘로 따라오는 일정은 계산으로 보인다(features/events/forward). 다만 이월 기간(환경설정 '학교')이 지나도 계속 따라오게
// 처음 따라오는 날 그 일정에 carrying: true를 한 번 적는다(V4 '이월 사슬'과 같은 뜻 - 어느 기기가 적어도 같은 값).
// 이미 적힌 일정은 건드리지 않는다 - **앱을 열 때 이월이 서버에 쓰는 것은 처음 따라오는 일정뿐**이다.
//
// - 일정·라벨을 서버에서 받은 뒤에만 본다(live). 기기 사본만으로 판단하면 라벨을 모르는 채 거짓 답을 낼 수 있다
//   (V4 09-22: 비어 있는 캐시를 '라벨 없음'으로 믿어 이월이 멈췄다).
// - 뒤에서 맞추는 쓰기라 안내·되돌리기 없이(writeOps). 못 적으면 콘솔에만 - 이 탭에서는 다시 시도하지 않는다(다음에 열 때).
import { useEffect, useRef } from 'react';
import { writeOp, writeOps } from '../../data/repo';
import { useMirrorStatus } from '../../data/select';
import { useCurrentSpaceId } from '../../data/session';
import { itemPath } from './eventOps';
import { useCarried } from './forward';

export default function ForwardMarks() {
  const sid = useCurrentSpaceId();
  const carried = useCarried(sid);
  const itemsStatus = useMirrorStatus('items', sid);
  const labelsStatus = useMirrorStatus('labels', sid);
  const ready = itemsStatus === 'live' && labelsStatus === 'live';
  const toMark = carried.list.filter((d) => !d.carrying);
  const key = toMark.map((d) => d.id).join(',');
  const listRef = useRef(toMark);
  useEffect(() => {
    listRef.current = toMark;
  });
  const tried = useRef(new Set<string>());

  useEffect(() => {
    if (!sid || !ready || !key) return;
    const fresh = listRef.current.filter((d) => !tried.current.has(`${sid}/${d.id}`));
    if (fresh.length === 0) return;
    for (const d of fresh) tried.current.add(`${sid}/${d.id}`);
    writeOps(fresh.map((d) => writeOp.patch(itemPath(sid, d.id), { carrying: true }, d))).catch((err: unknown) =>
      console.error('이월 표시를 적지 못했습니다:', err),
    );
  }, [sid, ready, key]);

  return null;
}
