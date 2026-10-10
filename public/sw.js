// sw.js - School Planner V5 서비스 워커 (P1-4 앱으로 설치 + P8-2 서버 푸시 알림).
//
// 지금은 아무것도 담아 두지 않는다(fetch를 가로채지 않는다) - 화면 파일은 늘 서버에서 새로 받는다.
// 앱 파일 담아 두기(오프라인으로 열기)·공유받기(share_target)는 P8-3에서 여기에 더한다.
// ⚠️ 이 파일·manifest.json을 바꾸면 설치한 앱은 늦게 받는다 - 사용자에게 '지우고 크롬에서 다시 설치'를 함께 알린다(V4).

// 새 판이 오면 기다리지 않고 바로 바꾼다 (열린 창이 옛 판에 묶여 있지 않게)
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// 일정 알림 서버 푸시 (P8-2 - functions/index.js의 v5SendDueAlarms가 FCM으로 보낸다, V4 sw.js 그대로).
// FCM 웹 푸시는 { data: {...}, from, ... } 모양으로 온다 - data.type === 'event-alarm'만 다룬다.
// 앱 화면을 보고 있는 창이 있으면 그 창에 넘겨 알림 창·소리로 울리고(src/features/events/EventAlarms - 같은 일정은 한 번만),
// 없으면(앱을 닫았거나 다른 앱을 보는 중) 휴대폰·PC 알림을 띄운다. 알림 tag는 앱이 띄우는 알림과 같다(겹치면 하나로).
self.addEventListener('push', (event) => {
  let msg = {};
  try {
    msg = event.data ? event.data.json() : {};
  } catch {
    msg = {};
  }
  const d = (msg && msg.data) || msg || {};
  if (d.type !== 'event-alarm') return;
  event.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const visible = wins.filter((c) => c.visibilityState === 'visible' && c.url.startsWith(self.registration.scope));
      if (visible.length > 0) {
        visible.forEach((c) => c.postMessage({ type: 'sp5-event-alarm', alarm: d }));
        return;
      }
      await self.registration.showNotification('⏰ 일정 알림', {
        body: d.content || '예정된 일정이 있습니다.',
        tag: `sp5-alarm-${d.id}`,
        renotify: true,
        requireInteraction: true,
        vibrate: [400, 200, 400, 200, 400],
        icon: `${self.registration.scope}icon-192.png`,
        badge: `${self.registration.scope}icon-192.png`,
        data: { url: self.registration.scope },
      });
    })(),
  );
});

// 알림을 누르면 열려 있는 앱 창으로, 없으면 새로 연다
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || self.registration.scope;
  event.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const mine = wins.find((c) => c.url.startsWith(self.registration.scope));
      if (mine) return mine.focus();
      return self.clients.openWindow(url);
    })(),
  );
});
