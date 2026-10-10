// 앱 안 일정 알림 (V4 hooks/useEventAlarms.ts의 '이 탭이 20초마다 보는 길'). 껍데기(Shell)에 하나 둔다.
//
// - 기기 사본에서 본다(V4는 오늘 일정 문서를 따로 구독했다): 알림 시각이 지났고 1시간 안, 끝내지 않았고 아직 울리지 않은 일정(domain/eventAlarm dueAlarms).
// - 울리면 그 일정에 alarmDone을 적는다(문서 하나의 그 칸만 - V4는 하루 문서를 트랜잭션으로 다시 썼다). 다른 기기는 사본으로 받아 건너뛴다.
//   뒤에서 맞추는 쓰기라 안내·되돌리기 없이(writeOps) - 못 적으면 콘솔에만(V4 그대로).
// - 같은 일정은 이 탭에서 한 번만 울린다. 탭이 화면에 보이지 않고 알림을 허용해 두었으면 OS 알림도.
//   허용을 묻는 창은 여기서 띄우지 않는다 - 환경설정 '알림' 탭의 '이 기기에서 받기'(서버 푸시 P8-2)에서 묻는다.
// - 서버 푸시(P8-2): 앱을 보고 있으면 서비스 워커가 'sp5-event-alarm'으로 넘겨 준다 - 같은 창·같은 소리(이 탭에서 한 번만).
//   앱이 뜰 때 이 기기 알림 토큰을 맞춘다(data/push refreshPushToken).
import { useEffect, useRef, useState } from 'react';
import { wakeAudioOnGesture } from '../../app/sound';
import { dueAlarms } from '../../domain/eventAlarm';
import { writeOp, writeOps } from '../../data/repo';
import { useDocs } from '../../data/select';
import { refreshPushToken } from '../../data/push';
import { useCurrentSpaceId, useSession } from '../../data/session';
import EventAlarmPopup, { type RingingAlarm } from './EventAlarmPopup';
import { itemPath } from './eventOps';

/** 몇 초마다 보나 (V4 20초) - 처음은 3초 뒤 */
export const ALARM_CHECK_MS = 20_000;
export const ALARM_FIRST_CHECK_MS = 3_000;

function osNotify(alarms: RingingAlarm[]) {
  if (typeof document === 'undefined' || !document.hidden) return;
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  for (const a of alarms) {
    try {
      const n = new Notification('⏰ 일정 알림', { body: a.text, tag: `sp5-alarm-${a.id}` });
      n.onclick = () => {
        window.focus();
        n.close();
      };
    } catch (err) {
      console.error('OS 알림 표시 실패:', err);
    }
  }
}

export default function EventAlarms() {
  const sid = useCurrentSpaceId();
  const items = useDocs('items', sid);
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  });
  const [ringing, setRinging] = useState<RingingAlarm[]>([]);

  // 브라우저는 이 페이지를 한 번 누르기 전에는 소리를 막는다 - 처음 누를 때 소리 장치를 깨워 둔다
  useEffect(() => wakeAudioOnGesture(), []);

  // 서버 푸시(P8-2): 이 기기 알림 토큰을 맞춘다 (허용해 두었고 끈 적이 없을 때만 - 창을 띄우지 않는다)
  const uid = useSession((s) => s.user?.uid ?? null);
  useEffect(() => {
    if (uid) void refreshPushToken(uid);
  }, [uid]);

  useEffect(() => {
    if (!sid) return;
    const rung = new Set<string>();
    /** 울린다 - 이 탭에서 한 번만, 울린 일정에 alarmDone (다른 기기의 앱 안 알림이 건너뛰게) */
    const ring = (due: Array<{ id: string; date?: string | null; text?: string }>, mark: boolean) => {
      const fresh = due.filter((d) => !rung.has(d.id));
      if (fresh.length === 0) return;
      for (const d of fresh) rung.add(d.id);
      if (mark) {
        const docs = fresh.map((d) => itemsRef.current[d.id]).filter((d) => d && !d.alarmDone);
        if (docs.length)
          writeOps(docs.map((d) => writeOp.patch(itemPath(sid, d!.id), { alarmDone: true }, d!))).catch((err: unknown) => console.error('알림 확인 처리 반영 실패:', err));
      }
      const added = fresh.map((d) => ({ id: d.id, date: d.date ?? '', text: d.text || '예정된 일정이 있습니다.' }));
      setRinging((prev) => {
        const more = added.filter((a) => !prev.some((p) => p.id === a.id));
        return more.length ? [...prev, ...more] : prev;
      });
      osNotify(added);
    };
    // 서버 푸시를 서비스 워커가 넘겨 준다 (앱을 보고 있는 창 - public/sw.js 'sp5-event-alarm')
    const onMessage = (e: MessageEvent) => {
      const m = e.data as { type?: string; alarm?: { id?: string; sid?: string; content?: string; time?: string } } | null;
      if (!m || m.type !== 'sp5-event-alarm' || !m.alarm?.id) return;
      ring([{ id: m.alarm.id, date: (m.alarm.time ?? '').slice(0, 10), text: m.alarm.content }], m.alarm.sid === sid);
    };
    navigator.serviceWorker?.addEventListener('message', onMessage);
    const check = () => {
      const due = dueAlarms(Object.values(itemsRef.current), Date.now(), rung);
      if (due.length) ring(due, true);
    };
    const first = setTimeout(check, ALARM_FIRST_CHECK_MS);
    const every = setInterval(check, ALARM_CHECK_MS);
    return () => {
      clearTimeout(first);
      clearInterval(every);
      navigator.serviceWorker?.removeEventListener('message', onMessage);
    };
  }, [sid]);

  return <EventAlarmPopup alarms={ringing} onDismiss={() => setRinging([])} />;
}
