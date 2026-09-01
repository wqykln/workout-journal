/* ================================================================
 * 运动打卡工具 · Service Worker
 * 策略：
 *   - 首页 index.html 用 Stale-While-Revalidate（先返回缓存秒开，后台拉新）
 *   - 其余静态资源用 Cache-First（字体、manifest、图标）
 * ================================================================ */
const CACHE_NAME = 'workout-checkin-v17';
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// 安装：预缓存核心资源 + 跳过等待
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

// 激活：清理旧版本缓存
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// 请求拦截
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const isSameOrigin = url.origin === location.origin;
  const isNavRequest = req.mode === 'navigate' || req.destination === 'document';

  // 首页导航请求 → Stale-While-Revalidate
  // 先返回缓存秒开，同时后台去网络取最新版并更新缓存
  if (isSameOrigin && (isNavRequest || url.pathname === '/' || url.pathname.endsWith('index.html'))) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(req).then((cached) => {
          const networkFetch = fetch(req).then((resp) => {
            if (resp && resp.status === 200) {
              cache.put(req, resp.clone());
            }
            return resp;
          }).catch(() => cached);
          return cached || networkFetch;
        });
      })
    );
    return;
  }

  // 其余请求 → Cache-First（manifest、图标、字体）
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((resp) => {
        if (resp && resp.status === 200 && (isSameOrigin || req.url.includes('fonts.'))) {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, clone)).catch(() => {});
        }
        return resp;
      }).catch(() => {
        if (req.mode === 'navigate' || (req.destination === 'document' && isSameOrigin)) {
          return caches.match('./index.html');
        }
      });
    })
  );
});
