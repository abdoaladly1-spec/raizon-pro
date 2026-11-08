// ProCashier Service Worker — استراتيجية صحيحة:
// - صفحات HTML: أولاً الشبكة (network-first) حتى تصل التحديثات فوراً
// - أصول مُجزّأة بأسماء hash: أولاً الكاش (cache-first) لأن الاسم يتغير مع كل build
// - تنظيف الكاشات القديمة + تفعيل فوري

// إلغاء تفعيل وتجاوز Service Worker كلياً في بيئة التطوير المحلية (localhost / 127.0.0.1) لتجنب أخطاء الشاشة البيضاء والتخزين المؤقت
if (self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1') {
  self.addEventListener('install', () => self.skipWaiting());
  self.addEventListener('activate', (event) => {
    event.waitUntil(
      self.registration.unregister().then(() => self.clients.matchAll()).then((clients) => {
        clients.forEach((client) => client.navigate(client.url));
      })
    );
  });
} else {
  const VERSION = 'v3';
  const STATIC_CACHE = `procashier-${VERSION}`;

  self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
      caches.open(STATIC_CACHE).then((cache) =>
        cache.addAll(['/', '/index.html', '/manifest.json', '/icon-192.png', '/icon-512.png'])
      )
    );
  });

  self.addEventListener('activate', (event) => {
    event.waitUntil(
      caches.keys().then((keys) =>
        Promise.all(keys.filter((k) => k !== STATIC_CACHE).map((k) => caches.delete(k)))
      ).then(() => self.clients.claim())
    );
  });

  self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;
    const url = new URL(req.url);
    if (url.origin !== self.location.origin) return;

    // صفحات التنقل والـ HTML: أولاً الشبكة، والكاش احتياط
    if (req.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('.html')) {
      event.respondWith(
        fetch(req)
          .then((res) => {
            const copy = res.clone();
            caches.open(STATIC_CACHE).then((c) => c.put('/index.html', copy));
            return res;
          })
          .catch(() => caches.match('/index.html'))
      );
      return;
    }

    // أصول مبنية بأسماء مجزّأة (hash) وثابتة: أولاً الكاش
    if (url.pathname.startsWith('/assets/') || /\.(png|jpg|svg|woff2?|webp)$/.test(url.pathname)) {
      event.respondWith(
        caches.match(req).then((cached) => {
          if (cached) return cached;
          return fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(STATIC_CACHE).then((c) => c.put(req, copy));
            }
            return res;
          });
        })
      );
      return;
    }

    // الباقي: شبكة أولاً
    event.respondWith(fetch(req).catch(() => caches.match(req)));
  });
}
