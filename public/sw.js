// sw.js - School Planner V5 서비스 워커 (P1-4: 앱으로 설치할 수 있게 하는 최소 틀).
//
// 지금은 아무것도 담아 두지 않는다(fetch를 가로채지 않는다) - 화면 파일은 늘 서버에서 새로 받는다.
// 앱 파일 담아 두기(오프라인으로 열기)·공유받기(share_target)·서버 푸시 알림은 P8-2·P8-3에서 여기에 더한다.
// ⚠️ 이 파일·manifest.json을 바꾸면 설치한 앱은 늦게 받는다 - 사용자에게 '지우고 크롬에서 다시 설치'를 함께 알린다(V4).

// 새 판이 오면 기다리지 않고 바로 바꾼다 (열린 창이 옛 판에 묶여 있지 않게)
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
