// 同じ mukai599.github.io 上の第1弾(zunda-rpg-v2)とキャッシュが混ざらないよう、専用の名前を使う
const CACHE_PREFIX = 'ninadamon-tower-';
const CACHE_NAME = CACHE_PREFIX + 'v1';
const CORE_ASSETS = [
  './manifest.json'
];

// index.html(本体)は毎回最新を取りに行きたいので、ここには含めない

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k.startsWith(CACHE_PREFIX) && k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

function isAppShell(request, url) {
  // ナビゲーション(URLを開く/再読み込み)と index.html 自体は常に最新を優先する
  return request.mode === 'navigate' || url.pathname.endsWith('/index.html') || url.pathname === '/' || url.pathname.endsWith('/');
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 同じサイト内のGETリクエストだけ扱う(Firebase/Firestore等の外部通信には一切関与しない)
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  if (isAppShell(event.request, url)) {
    // ネットワーク優先: 問題データ等を含む本体は常に最新を取得。オフライン時だけキャッシュにフォールバック
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // 画像・音声などの静的ファイルはキャッシュ優先(速度・オフライン対応重視)
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => cached);
    })
  );
});
