// 앱 안 일정 알림 (V4 hooks/useEventAlarms.ts의 '이 탭이 20초마다 보는 길'). 껍데기(Shell)에 하나 둔다.
//
// - 기기 사본에서 본다(V4는 오늘 일정 문서를 따로 구독했다): 알림 시각이 지났고 1시간 안, 끝내지 않았고 아직 울리지 않은 일정(domain/eventAlarm dueAlarms).
//   개인 공간과 내 그룹을 모두 본다(P22-3 - 지금 보는 공간 것만 울려, 푸시를 켜지 않은 기기는 다른 공간 알림을 놓쳤다). 그룹은 서버 푸시처럼 쓴 사람에게만.
// - 울리면 그 일정에 alarmDone을 적는다(문서 하나의 그 칸만 - V4는 하루 문서를 트랜잭션으로 다시 썼다). 다른 기기는 사본으로 받아 건너뛴다.
//   뒤에서 맞추는 쓰기라 안내·되돌리기 없이(writeOps) - 못 적으면 콘솔에만(V4 그대로).
// - 같은 일정은 이 탭에서 한 번만 울린다. 알림을 허용해 두었고 탭이 화면에 보이지 않거나 소리가 막혔으면 OS 알림도(10-14 - 소리 없음 보고).
//   허용을 묻는 창은 여기서 띄우지 않는다 - 환경설정 '알림' 탭의 '이 기기에서 받기'(서버 푸시 P8-2)에서 묻는다.
// - 서버 푸시(P8-2): 앱을 보고 있으면 서비스 워커가 'sp5-event-alarm'으로 넘겨 준다 - 같은 창·같은 소리(이 탭에서 한 번만).
//   앱이 뜰 때 이 기기 알림 토큰을 맞춘다(data/push refreshPushToken).
import { useEffect, useState } from 'react';
import { useCommonSettings } from '../../app/prefs';
import { soundAllowed, wakeAudioOnGesture } from '../../app/sound';
import { dueAlarmsIn } from '../../domain/eventAlarm';
import { collKey, useMirror } from '../../data/mirror/store';
import { writeOp, writeOps } from '../../data/repo';
import type { Docs } from '../../data/select';
import { refreshPushToken, shareAlarmSound } from '../../data/push';
import { useSession } from '../../data/session';
import { personalSpaceId } from '../../data/space';
import { useMySpaces } from '../../data/spaceChoice';
import EventAlarmPopup, { type RingingAlarm } from './EventAlarmPopup';
import { itemPath } from './eventOps';

/** 몇 초마다 보나 (V4 20초) - 처음은 3초 뒤 */
export const ALARM_CHECK_MS = 20_000;
export const ALARM_FIRST_CHECK_MS = 3_000;

/**
 * OS 알림 - 탭이 보이지 않거나 앱이 소리를 낼 수 없을 때(이 탭을 아직 누르지 않음). OS 알림은 기기 알림 소리가 난다.
 * 서비스 워커로 띄운다(안드로이드 크롬은 new Notification을 막는다 - 누르면 sw.js notificationclick). tag는 서버 푸시와 같다(겹치면 하나로).
 */
async function osNotify(alarms: RingingAlarm[], soundBlocked: boolean) {
  if (typeof document === 'undefined' || (!document.hidden && !soundBlocked)) return;
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  const reg = await navigator.serviceWorker?.getRegistration?.().catch(() => undefined);
  for (const a of alarms) {
    try {
      if (reg) {
        // 서버 푸시(public/sw.js)와 같은 모양 - 같은 tag여도 다시 울리고(renotify) 휴대폰은 떤다 (TS 알림 칸 표에 둘이 없다)
        await reg.showNotification('⏰ 일정 알림', {
          body: a.text,
          tag: `sp5-alarm-${a.id}`,
          renotify: true,
          requireInteraction: true,
          vibrate: [400, 200, 400, 200, 400],
          icon: `${reg.scope}icon-192.png`,
          badge: `${reg.scope}icon-192.png`,
          data: { url: reg.scope },
        } as NotificationOptions);
        continue;
      }
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

/** 그 공간의 일정 - 볼 때 store에서 읽는다(공간 수만큼 훅을 돌릴 수 없고, 20초마다 보면 된다) */
const itemsOf = (sid: string) => (useMirror.getState().colls[collKey(sid, 'items')]?.docs ?? {}) as unknown as Docs<'items'>;

export default function EventAlarms() {
  const [ringing, setRinging] = useState<RingingAlarm[]>([]);

  // 브라우저는 이 페이지를 한 번 누르기 전에는 소리를 막는다 - 처음 누를 때 소리 장치를 깨워 둔다
  useEffect(() => wakeAudioOnGesture(), []);

  // 서버 푸시(P8-2): 이 기기 알림 토큰을 맞춘다 (허용해 두었고 끈 적이 없을 때만 - 창을 띄우지 않는다)
  const uid = useSession((s) => s.user?.uid ?? null);
  useEffect(() => {
    if (uid) void refreshPushToken(uid);
  }, [uid]);
  // 앱을 닫았을 때 오는 기기 알림도 '알림 소리' 길이만큼 다시 울리게 - 서비스 워커가 읽을 자리에 적어 둔다
  const alarmSound = useCommonSettings((s) => s.alarmSound);
  useEffect(() => {
    void shareAlarmSound(alarmSound);
  }, [alarmSound]);

  useEffect(() => {
    if (!uid) return;
    const rung = new Set<string>();
    /** 울린다 - 이 탭에서 한 번만, 울린 일정에 alarmDone (다른 기기의 앱 안 알림이 건너뛰게). 사본에 없는 일정(푸시가 먼저 왔다)은 적지 못한다 */
    const ring = (due: Array<{ sid: string; id: string; date?: string | null; text?: string }>) => {
      const fresh = due.filter((d) => !rung.has(d.id));
      if (fresh.length === 0) return;
      for (const d of fresh) rung.add(d.id);
      const marks = fresh.flatMap((d) => {
        const doc = itemsOf(d.sid)[d.id];
        return doc && !doc.alarmDone ? [writeOp.patch(itemPath(d.sid, doc.id), { alarmDone: true }, doc)] : [];
      });
      if (marks.length) writeOps(marks).catch((err: unknown) => console.error('알림 확인 처리 반영 실패:', err));
      const added = fresh.map((d) => ({ id: d.id, date: d.date ?? '', text: d.text || '예정된 일정이 있습니다.' }));
      setRinging((prev) => {
        const more = added.filter((a) => !prev.some((p) => p.id === a.id));
        return more.length ? [...prev, ...more] : prev;
      });
      void soundAllowed().then((ok) => osNotify(added, !ok));
    };
    // 서버 푸시를 서비스 워커가 넘겨 준다 (앱을 보고 있는 창 - public/sw.js 'sp5-event-alarm')
    const onMessage = (e: MessageEvent) => {
      const m = e.data as { type?: string; alarm?: { id?: string; sid?: string; content?: string; time?: string } } | null;
      if (!m || m.type !== 'sp5-event-alarm' || !m.alarm?.id) return;
      ring([{ sid: m.alarm.sid ?? '', id: m.alarm.id, date: (m.alarm.time ?? '').slice(0, 10), text: m.alarm.content }]);
    };
    navigator.serviceWorker?.addEventListener('message', onMessage);
    const check = () => {
      // 내 그룹 = 받은 목록, 받기 전이면 기억한 그룹 - 기기 사본이 받는 공간과 같다
      const spaces = [personalSpaceId(uid), ...useMySpaces.getState().groups.map((g) => g.id)].map((sid) => ({ sid, items: Object.values(itemsOf(sid)) }));
      const due = dueAlarmsIn(spaces, uid, Date.now(), rung);
      if (due.length) ring(due.map(({ sid, item }) => ({ ...item, sid })));
    };
    const first = setTimeout(check, ALARM_FIRST_CHECK_MS);
    const every = setInterval(check, ALARM_CHECK_MS);
    return () => {
      clearTimeout(first);
      clearInterval(every);
      navigator.serviceWorker?.removeEventListener('message', onMessage);
    };
  }, [uid]);

  return <EventAlarmPopup alarms={ringing} onDismiss={() => setRinging([])} />;
}
