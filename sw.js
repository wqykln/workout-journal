/* ================================================================
 * 运动打卡工具 · Service Worker
 * 策略：Cache-First（首屏访问缓存静态资源，后续离线直接读取）
 * ================================================================ */
const CACHE_NAME = 'workout-checkin-v1';
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.jpg',
  './icons/icon-512.jpg'
];

// 安装：预缓存核心资源
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

// 激活：清理旧缓存
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// 请求拦截：Cache-First，非 GET 直接放行
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  // 跨域请求（如 Google Fonts）→ 缓存优先但不阻塞
  const url = new URL(req.url);
  const isSameOrigin = url.origin === location.origin;

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((resp) => {
        // 仅缓存成功的同域响应和字体
        if (resp && resp.status === 200 && (isSameOrigin || req.url.includes('fonts.'))) {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, clone)).catch(() => {});
        }
        return resp;
      }).catch(() => {
        // 完全离线且未命中缓存：对导航请求 fallback 到 index.html
        if (req.mode === 'navigate' || (req.destination === 'document' && isSameOrigin)) {
          return caches.match('./index.html');
        }
      });
    })
  );
});
