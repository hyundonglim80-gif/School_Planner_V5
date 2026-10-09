// 휴지통 자동 비우기 (V4 trashRetention.purgeExpiredTrashDaily) - Shell에 하나. 앱을 열어 항목·라벨 사본이 서버와 맞춰지면(live)
// 하루 한 번(이 기기 기준) 기간이 지난 것을 영구 삭제한다. 끄기(0)면 아무것도 하지 않는다(기본).
import { useEffect, useRef } from 'react';
import { useCommonSettings } from '../../app/prefs';
import { useClipboard } from '../../data/clipboard';
import { useDocs, useMirrorStatus } from '../../data/select';
import { useCurrentSpaceId } from '../../data/session';
import { autoEmptyTrash } from './actions';
import { expiredOf, trashEntries } from './trashList';

export function useTrashAutoEmpty() {
  const sid = useCurrentSpaceId();
  const days = useCommonSettings((s) => s.trashDays);
  const items = useDocs('items', sid);
  const labels = useDocs('labels', sid);
  const timetables = useDocs('timetables', sid);
  const progress = useDocs('progress', sid);
  const itemsLive = useMirrorStatus('items', sid) === 'live';
  const labelsLive = useMirrorStatus('labels', sid) === 'live';
  const done = useRef<string | null>(null);
  useEffect(() => {
    if (!sid || days <= 0 || !itemsLive || !labelsLive || done.current === sid) return;
    done.current = sid;
    const { ddays } = useCommonSettings.getState();
    const clips = useClipboard.getState().trash;
    const expired = expiredOf(trashEntries({ items, labels, ddays, clips, timetables, progress }), days);
    void autoEmptyTrash(sid, expired, items, labels, Date.now(), timetables, progress);
  }, [sid, days, itemsLive, labelsLive, items, labels, timetables, progress]);
}
