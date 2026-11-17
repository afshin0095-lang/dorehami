/* ============================================================
   سرویس‌ورکر: کش پوسته + بازی‌ها برای اجرای آفلاین
   استراتژی: cache-first برای فایل‌های پوسته، network-first برای HTML
   ============================================================ */

const CACHE = 'dorehami-shell-v8';

const SHELL = [
  '/',
  '/index.html',
  '/styles.css',
  '/manifest.webmanifest',
  '/src/main.js',
  '/src/net/sync.js',
  '/src/net/ws.js',
  '/src/net/table.js',
  '/src/net/table-screen.js',
  '/src/core.js',
  '/src/content.js',
  '/src/content-extra.js',
  '/src/content-more.js',
  '/src/ui/kit.js',
  '/src/ui/screens.js',
  '/src/ui/settings.js',
  '/src/ui/admin.js',
  '/src/ui/cardkit.js',
  '/src/games/registry.js',
  '/src/games/mafia-ui.js',
  '/src/games/hokm-ui.js',
  '/src/games/esmfamil-ui.js',
  '/src/games/quiz-ui.js',
  '/src/games/riddle-ui.js',
  '/src/games/iq-ui.js',
  '/src/games/snake-ui.js',
  '/src/games/codenames-ui.js',
  '/src/games/lowball-ui.js',
  '/src/games/story-ui.js',
  '/src/games/warden-ui.js',
  '/src/games/logic-ui.js',
  '/src/engines/dream.js',
  '/src/games/dream-ui.js',
  '/src/engines/duz.js',
  '/src/games/duz-ui.js',
  '/src/engines/spot.js',
  '/src/games/spot-ui.js',
  '/src/engines/gloom.js',
  '/src/games/gloom-ui.js',
  '/src/engines/siege.js',
  '/src/games/siege-ui.js',
  '/src/engines/island.js',
  '/src/games/island-ui.js',
  '/src/engines/mafia.js',
  '/src/engines/hokm.js',
  '/src/engines/snake.js',
  '/src/engines/esmfamil.js',
  '/src/engines/quiz.js',
  '/src/engines/codenames.js',
  '/src/engines/lowball.js',
  '/src/engines/v10.js',
  '/src/engines/logic.js',
  '/offline.html',
  '/assets/icon-192.png',
  '/assets/icon-512.png',
  '/assets/art/desk-bg.jpg',
  '/assets/art/paper-cream.jpg',
  '/assets/art/notebook-page.jpg',
  '/assets/art/noir-leather.jpg',
  '/assets/art/persian-gold.jpg',
  '/assets/art/velvet-board.jpg',
  '/assets/art/cards/king-red.jpg',
  '/assets/art/cards/queen-red.jpg',
  '/assets/art/cards/jack-red.jpg',
  '/assets/art/cards/king-black.jpg',
  '/assets/art/cards/queen-black.jpg',
  '/assets/art/cards/jack-black.jpg',
  '/assets/art/mafia-role.jpg',
  '/assets/art/citizen-role.jpg',
  '/assets/art/doctor-role.jpg',
  '/assets/art/detective-role.jpg',
  '/assets/fonts/Vazirmatn-Regular.woff2',
  '/assets/fonts/Vazirmatn-Bold.woff2'
];

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      // هر فایل جدا کش می‌شود تا یک ۴۰۴ کل نصب را خراب نکند
      .then(cache => Promise.all(SHELL.map(u => cache.add(u).catch(() => null))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // API هرگز به HTML آفلاین تبدیل نمی‌شود
  if (url.pathname.startsWith('/api/')) return;

  if (req.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('.html')) {
    event.respondWith(
      fetch(req)
        .then(res => {
          // تازه‌سازی کش پوسته در پس‌زمینه
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put('/index.html', copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match('/index.html').then(r => r || caches.match('/offline.html')).then(r => r || Response.error()))
    );
    return;
  }

  /**
   * stale-while-revalidate: نسخهٔ کش‌شده فوراً می‌آید و *همان لحظه*
   * نسخهٔ تازه در پس‌زمینه گرفته و جایگزین می‌شود. با cache-first خالص،
   * یک نسخهٔ قدیمی می‌توانست تا ابد بماند و کاربر هیچ تغییری نبیند.
   */
  event.respondWith(
    caches.match(req).then(hit => {
      const network = fetch(req).then(res => {
        if (res.ok && (url.pathname.startsWith('/src/') || url.pathname.startsWith('/assets/'))) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => null);

      if (hit) {
        // تازه‌سازی در پس‌زمینه؛ پاسخ فوری از کش
        event.waitUntil ? event.waitUntil(network) : void network;
        return hit;
      }
      return network.then(res => res || caches.match('/index.html')).then(r => r || Response.error());
    })
  );
});
