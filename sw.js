// Service Worker for AR Meishi TechConnect
// キャッシュバージョン - 更新時はこの番号を変更
const CACHE_VERSION = 'v2';
const CACHE_NAME = `ar-meishi-cache-${CACHE_VERSION}`;

// キャッシュするファイル一覧
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './script.js',
    './assets/target.mind',
    './assets/meishi_front.png',
    './assets/meishi_inside.png',
    './assets/logoanimation.mp4',
    './assets/intro_profile.jpg',
    './assets/intro_name.png',
    './assets/intro_job.png',
    './assets/intro_catch.png',
    './assets/icon_instagram.png',
    './assets/icon_website.png',
    './assets/icon_potfolio.png'
];

// インストール時：全アセットをキャッシュ
self.addEventListener('install', (event) => {
    console.log('[SW] Installing Service Worker...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Caching assets...');
                return cache.addAll(ASSETS_TO_CACHE);
            })
            .then(() => {
                console.log('[SW] All assets cached!');
                return self.skipWaiting();
            })
    );
});

// アクティベート時：古いキャッシュを削除
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating Service Worker...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name.startsWith('ar-meishi-cache-') && name !== CACHE_NAME)
                    .map((name) => {
                        console.log('[SW] Deleting old cache:', name);
                        return caches.delete(name);
                    })
            );
        }).then(() => {
            return self.clients.claim();
        })
    );
});

// リクエスト時：キャッシュ優先、なければネットワーク
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((cachedResponse) => {
                if (cachedResponse) {
                    // キャッシュがあれば即座に返す
                    return cachedResponse;
                }
                // キャッシュがなければネットワークから取得
                return fetch(event.request).then((response) => {
                    // 外部リソース（CDN等）もキャッシュに追加
                    if (response && response.status === 200) {
                        const responseClone = response.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(event.request, responseClone);
                        });
                    }
                    return response;
                });
            })
    );
});
