const CACHE = 'timecard-v20';
const ASSETS = [
  './',
  './index.html',
  './payroll.html',
  './manifest.webmanifest',
  './payroll.webmanifest',
  './icon-192.png',
  './icon-512.png'
];

// 1ファイル失敗しても他は登録される（取りこぼしで壊れないように）
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.allSettled(ASSETS.map((a) => c.add(a))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const putCache = (req, res) => {
  const copy = res.clone();
  caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
  return res;
};
// 遅い回線でも待たされないように、一定時間で打ち切ってキャッシュを使う
const timeout = (ms) => new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms));

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const req = e.request;
  const isPage = req.mode === 'navigate' || req.destination === 'document' ||
    /\.html$/.test(new URL(req.url).pathname);

  if (isPage) {
    // ページ：ネット優先（更新が自動で反映される）／つながらなければキャッシュ
    e.respondWith(
      Promise.race([fetch(req).then((res) => putCache(req, res)), timeout(3000)])
        .catch(() => caches.match(req).then((hit) => hit || caches.match('./index.html')))
    );
  } else {
    // アイコン等：キャッシュ優先（速い・完全オフライン対応）
    e.respondWith(
      caches.match(req).then((hit) => hit ||
        fetch(req).then((res) => putCache(req, res)).catch(() => caches.match('./index.html')))
    );
  }
});
