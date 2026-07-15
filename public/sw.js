// キルスイッチService Worker
// 旧MindAR版で登録したService Workerを置き換え、キャッシュを全削除して自分自身を解除する。
// 旧版の訪問者のブラウザに残った古いキャッシュを一掃するために残している（新規登録はしない）。
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
      await self.registration.unregister();
      const clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach((client) => client.navigate(client.url));
    })()
  );
});
