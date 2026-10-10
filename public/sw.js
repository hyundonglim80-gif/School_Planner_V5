// sw.js - School Planner V5 서비스 워커 (P1-4 앱으로 설치 + P8-2 서버 푸시 알림 + P8-3 공유받기·오프라인 앱).
//
// 오프라인 앱(P8-3 - V4 sw.js와 같은 갈래):
//   - 화면 문서(navigate)는 **네트워크 먼저**(cache: 'reload' - 오래된 index.html이 새 판을 가리지 않게), 안 되면 담아 둔 '/'.
//   - 해시가 붙은 앱 파일(/assets/*)은 **담아 둔 것 먼저**(이름이 바뀌니 낡지 않는다). 앱이 다 뜬 뒤 'sp5-precache'를 보내면
//     빌드가 남긴 asset-manifest.json대로 이 판의 파일을 모두 미리 담고 옛 판 파일은 지운다(개발 서버에는 그 파일이 없어 아무것도 안 한다).
//   - 자료는 앱의 기기 사본(IndexedDB)이 맡는다 - 여기서는 Firebase·구글 API를 건드리지 않는다(다른 출처는 가로채지 않는다).
// 공유받기(P8-3 - V4 그대로): manifest의 share_target으로 '/share-target'에 POST → 글·파일을 캐시에 두고 '/?share=<id>'로 연다
//   → 앱이 로그인한 뒤 꺼내 새 메모 칸에 채운다(src/features/share/receive.ts - 캐시 이름·열쇠 모양이 같아야 한다).
// ⚠️ 이 파일·manifest.json을 바꾸면 설치한 앱은 늦게 받는다 - 사용자에게 '지우고 크롬에서 다시 설치'를 함께 알린다(V4).

const APP_CACHE = 'sp5-app-v1';
const SHARE_CACHE = 'sp5share-inbox';
const shareKey = (id, part) => `${self.location.origin}/__sp5share/${id}/${part}`;

// 새 판이 오면 기다리지 않고 바로 바꾼다 (열린 창이 옛 판에 묶여 있지 않게)
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // 네비게이션 프리로드는 끈다 - 문서는 cache: 'reload'로 직접 받는다(V4 - 프리로드 응답은 그 우회를 거치지 않는다)
      if (self.registration.navigationPreload) await self.registration.navigationPreload.disable().catch(() => {});
      for (const name of await caches.keys()) if (name.startsWith('sp5-app-') && name !== APP_CACHE) await caches.delete(name);
      await self.clients.claim();
    })(),
  );
});

/** 이 판의 앱 파일을 모두 담고 옛 판 파일은 지운다 (빌드의 asset-manifest.json대로) */
async function precache() {
  let manifest;
  try {
    const res = await fetch('/asset-manifest.json', { cache: 'no-store' });
    if (!res.ok) return;
    manifest = await res.json();
  } catch {
    return;
  }
  const want = new Set();
  for (const entry of Object.values(manifest)) {
    if (entry && entry.file) want.add(`/${entry.file}`);
    for (const f of (entry && entry.css) || []) want.add(`/${f}`);
    for (const f of (entry && entry.assets) || []) want.add(`/${f}`);
  }
  const cache = await caches.open(APP_CACHE);
  for (const req of await cache.keys()) {
    const path = new URL(req.url).pathname;
    if (path.startsWith('/assets/') && !want.has(path)) await cache.delete(req);
  }
  for (const path of want) {
    if (!path.startsWith('/assets/') || (await cache.match(path, { ignoreVary: true }))) continue;
    try {
      const res = await fetch(path);
      if (res.ok) await cache.put(path, res);
    } catch {
      // 다음에 다시 (오프라인이 되면 그때까지 담은 것으로)
    }
  }
  // 첫 화면도 - 처음 연 문서는 서비스 워커가 서기 전에 받아 담기지 않았다
  try {
    const res = await fetch('/', { cache: 'reload' });
    if (res.ok) await cache.put('/', res);
  } catch {
    // 다음 열기에서
  }
}

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'sp5-precache') event.waitUntil(precache());
});

async function receiveShare(request) {
  const scope = self.registration.scope;
  try {
    const form = await request.formData();
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    const cache = await caches.open(SHARE_CACHE);
    const str = (v) => (typeof v === 'string' ? v : '');
    const files = [];
    const list = form.getAll('files');
    for (let i = 0; i < list.length; i++) {
      const f = list[i];
      if (!f || typeof f === 'string' || !f.size) continue;
      const key = shareKey(id, `file${i}`);
      await cache.put(key, new Response(f, { headers: { 'Content-Type': f.type || 'application/octet-stream' } }));
      files.push({ key, name: f.name || `공유 파일 ${i + 1}`, type: f.type || '' });
    }
    const meta = { title: str(form.get('title')), text: str(form.get('text')), url: str(form.get('url')), files, at: Date.now() };
    await cache.put(shareKey(id, 'meta'), new Response(JSON.stringify(meta), { headers: { 'Content-Type': 'application/json' } }));
    return Response.redirect(`${scope}?share=${id}`, 303);
  } catch (err) {
    console.log('[SP5] 공유받기 실패:', err);
    return Response.redirect(`${scope}?share=error`, 303);
  }
}

const OFFLINE_PAGE = () =>
  new Response('<!doctype html><meta charset="utf-8"><title>SP5</title><p style="font-family:sans-serif;padding:2rem">오프라인 상태입니다. 인터넷에 이어진 뒤 다시 열어 주세요.</p>', {
    status: 503,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method === 'POST' && url.origin === self.location.origin && url.pathname === '/share-target') {
    event.respondWith(receiveShare(req));
    return;
  }
  // 다른 출처(Firebase·구글 API·글꼴)와 Firebase Hosting 예약 경로는 그대로 보낸다
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/__/') || url.pathname === '/asset-manifest.json') return;

  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(req, { cache: 'reload' });
          if (res.ok && res.type === 'basic') {
            const copy = res.clone();
            event.waitUntil(caches.open(APP_CACHE).then((c) => c.put('/', copy)));
          }
          return res;
        } catch {
          return (await caches.match('/', { ignoreVary: true })) || OFFLINE_PAGE();
        }
      })(),
    );
    return;
  }

  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      (async () => {
        // 모듈 스크립트는 Origin을 달고 오고, 미리 담은 것은 달지 않았다 - 'Vary: Origin'이면 짝이 안 맞아 오프라인에서 못 찾는다
        const hit = await caches.match(req, { ignoreVary: true });
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok && res.type === 'basic') {
          const copy = res.clone();
          event.waitUntil(caches.open(APP_CACHE).then((c) => c.put(req, copy)));
        }
        return res;
      })(),
    );
    return;
  }

  // 아이콘·매니페스트 - 네트워크 먼저, 안 되면 담아 둔 것
  if (/^\/(manifest\.json|favicon\.svg|icon-[\w-]+\.png)$/.test(url.pathname)) {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(req);
          if (res.ok) {
            const copy = res.clone();
            event.waitUntil(caches.open(APP_CACHE).then((c) => c.put(req, copy)));
          }
          return res;
        } catch {
          return (await caches.match(req, { ignoreVary: true })) || new Response('', { status: 503 });
        }
      })(),
    );
  }
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
