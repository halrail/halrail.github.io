// --- キャッシュ設定 ---
const CACHE_NAME = 'timetable-cache-v1';
const FILES_TO_CACHE = [
  '/School-timer/',
  '/School-timer/index.html',
  '/School-timer/style.css',
  '/School-timer/app.js',
  '/School-timer/manifest.json'
];

// インストール時にキャッシュ
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(FILES_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// 有効化
self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

// オフライン対応（キャッシュ優先）
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});

// --- 通知クリック時の挙動 ---
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      if (clientList.length > 0) {
        return clientList[0].focus();
      }
      return clients.openWindow('/School-timer/');
    })
  );
});