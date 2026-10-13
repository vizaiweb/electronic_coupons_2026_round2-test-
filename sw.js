/* ===== Service Worker for 2026社區消費連環賞 ===== */
const CACHE_NAME = 'macau-voucher-v1';

// 要快取的靜態資源（HTML 不快取，確保更新即時生效）
const STATIC_ASSETS = [
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// 安裝：預先快取靜態資源
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS);
    }).catch(err => {
      console.warn('預快取失敗（可能是某些資源不存在）:', err);
    })
  );
  self.skipWaiting();
});

// 啟用：清除舊版快取
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// 攔截請求
self.addEventListener('fetch', event => {
  const url = event.request.url;

  // 1. 排除 Vercount（每次去網路拿，確保計數正常）
  if (url.includes('vercount.one')) {
    event.respondWith(fetch(event.request).catch(() => new Response('', { status: 503 })));
    return;
  }

  // 2. 排除非 GET 請求（POST 等不走快取）
  if (event.request.method !== 'GET') {
    event.respondWith(fetch(event.request));
    return;
  }

  // 3. HTML 不快取（確保每次拿到最新版）
  if (event.request.mode === 'navigate' ||
      (event.request.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  // 4. 其他資源：先看快取，沒有才去網路
  event.respondWith(
    caches.match(event.request).then(response => {
      if (response) return response;
      return fetch(event.request).then(networkResponse => {
        // 只快取成功的 GET 回應
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, clone).catch(() => {});
          });
        }
        return networkResponse;
      }).catch(() => new Response('', { status: 503 }));
    })
  );
});
