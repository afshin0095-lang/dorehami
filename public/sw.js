/* ============================================================
   سرویس‌ورکر: کش پوسته + بازی‌ها برای اجرای آفلاین
   استراتژی: cache-first برای فایل‌های پوسته، network-first برای HTML
   ============================================================ */

const CACHE = 'dorehami-shell-v28';

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
  '/src/net/hokm-table.js',
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
  '/src/engines/uno.js',
  '/src/engines/eights.js',
  '/src/engines/dice5.js',
  '/src/ui/tablekit.js',
  '/src/games/uno-ui.js',
  '/src/games/cards-ui.js',
  '/src/games/dice-ui.js',
  '/src/engines/skyjo.js',
  '/src/engines/kittens.js',
  '/src/engines/bluff.js',
  '/src/games/skyjo-ui.js',
  '/src/games/kittens-ui.js',
  '/src/games/liar-ui.js',
  '/src/engines/qwixx.js',
  '/src/games/qwixx-ui.js',
  '/src/engines/worms.js',
  '/src/engines/kot.js',
  '/src/games/kot-ui.js',
  '/src/games/worms-ui.js',
  '/src/engines/finddiff.js',
  '/src/games/finddiff-ui.js',
  '/assets/art/spot/spot1-a.jpg',
  '/assets/art/spot/spot1-b.jpg',
  '/assets/art/spot/spot2-a.jpg',
  '/assets/art/spot/spot2-b.jpg',
  '/assets/art/spot/spot3-a.jpg',
  '/assets/art/spot/spot3-b.jpg',
  '/assets/art/spot/spot4-a.jpg',
  '/assets/art/spot/spot4-b.jpg',
  '/assets/art/spot/spot5-a.jpg',
  '/assets/art/spot/spot5-b.jpg',
  '/assets/art/games/qwixx.jpg',
  '/assets/art/games/skyjo.jpg',
  '/assets/art/games/kittens.jpg',
  '/assets/art/games/liarsdice.jpg',
  '/assets/art/games/uno.jpg',
  '/assets/art/games/crazy8.jpg',
  '/assets/art/games/blackjack.jpg',
  '/assets/art/games/yahtzee.jpg',
  '/assets/art/games/farkle.jpg',
  '/src/games/gk-ui.js',
  '/assets/art/games/story.jpg',
  '/assets/art/games/warden.jpg',
  '/assets/art/games/arkham.jpg',
  '/assets/art/games/gloom.jpg',
  '/assets/art/games/siege.jpg',
  '/assets/art/games/duz.jpg',
  '/assets/art/games/spot.jpg',
  '/assets/art/games/dream.jpg',
  '/assets/art/games/logic.jpg',
  '/assets/art/games/heckmeck.jpg',
  '/assets/art/games/king-of-tokyo.jpg',
  '/assets/art/games/spirit.jpg',
  '/assets/art/cats/cat-group.jpg',
  '/assets/art/cats/cat-duo.jpg',
  '/assets/art/cats/cat-solo.jpg',
  '/assets/art/cats/cat-cards.jpg',
  '/assets/art/cats/cat-words.jpg',
  '/assets/art/cats/cat-mind.jpg',
  '/assets/art/cats/lvl-quick.jpg',
  '/assets/art/cats/lvl-standard.jpg',
  '/assets/art/cats/lvl-deep.jpg',
  '/assets/art/arcade/machine.jpg',
  '/assets/art/games/geo-quiz.jpg',
  '/assets/art/games/mafia.jpg',
  '/assets/art/games/hokm.jpg',
  '/assets/art/games/esmfamil.jpg',
  '/assets/art/games/snake.jpg',
  '/assets/art/games/quiz.jpg',
  '/assets/art/games/riddle.jpg',
  '/assets/art/games/iq.jpg',
  '/assets/art/games/codenames.jpg',
  '/assets/art/games/lowball.jpg',
  '/src/engines/gk.js',
  '/src/content/gk-geo.js',
  '/src/content/gk-history.js',
  '/src/content/gk-science.js',
  '/src/content/gk-culture.js',
  '/src/content/gk-misc.js',
  '/src/content/gk-tables.js',
  '/src/content/gk-gen.js',
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
  '/src/engines/gloom.js',
  '/src/games/gloom-ui.js',
  '/src/engines/siege.js',
  '/src/games/siege-ui.js',
  '/src/engines/island.js',
  '/src/games/island-ui.js',
  '/src/engines/arkham.js',
  '/src/games/arkham-ui.js',
  '/src/engines/ring.js',
  '/src/games/ring-ui.js',
  '/src/engines/spirit.js',
  '/src/games/spirit-ui.js',
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
  '/assets/art/desk-frame.jpg',
  '/assets/art/hero-fabric.jpg',
  '/assets/art/hero-fabric-sm.jpg',
  '/assets/brand/weave-v28.jpg',
  '/assets/brand/weave-v28-sm.jpg',
  '/assets/brand/seal-v28-512.png',
  '/assets/brand/seal-v28-256.png',
  '/assets/logo-512.png',
  '/assets/logo-256.png',
  '/assets/art/paper-tile.jpg',
  '/assets/art/games/geo-quiz.jpg',
  '/assets/art/games/mafia.jpg',
  '/assets/art/games/hokm.jpg',
  '/assets/art/games/esmfamil.jpg',
  '/assets/art/games/snake.jpg',
  '/assets/art/games/quiz.jpg',
  '/assets/art/games/riddle.jpg',
  '/assets/art/games/iq.jpg',
  '/assets/art/games/codenames.jpg',
  '/assets/art/games/lowball.jpg',
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
   * کد و ظاهر برنامه — `/src/` **و `/styles.css`** — همیشه network-first است.
   *
   * چرا styles.css هم مهم است؟ چون قبلاً این فایل در شاخهٔ stale-while-
   * revalidate می‌افتاد: کش بی‌درنگ نسخهٔ کهنه را می‌داد و تازه‌سازی در
   * پس‌زمینه می‌نشست. نتیجه این بود که هر تغییر ظاهری فقط از **بار دوم**
   * دیده می‌شد و کاربر فکر می‌کرد «هیچ تغییری اعمال نشده». بدترین حالت
   * ممکن: کد تازه + CSS کهنه، یعنی صفحه‌ای که ساختارش عوض شده ولی
   * استایلش نه — دقیقاً همان چیزی که به‌شکل «به‌هم‌ریختگی» دیده می‌شد.
   */
  const isCode = url.pathname.startsWith('/src/')
    || url.pathname === '/sw.js'
    || url.pathname === '/styles.css'
    || url.pathname === '/manifest.webmanifest';

  if (isCode) {
    event.respondWith(
      fetch(req)
        .then(res => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match(req).then(r => r || Response.error()))
    );
    return;
  }

  /**
   * تصاویر و فونت‌ها: stale-while-revalidate. حجم بالا دارند و
   * آدم دوست ندارد منتظرشان بماند؛ نسخهٔ تازه در پس‌زمینه می‌نشیند.
   */
  event.respondWith(
    caches.match(req).then(hit => {
      const network = fetch(req).then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => null);

      if (hit) {
        event.waitUntil ? event.waitUntil(network) : void network;
        return hit;
      }
      return network.then(res => res || caches.match('/index.html')).then(r => r || Response.error());
    })
  );
});

/**
 * پیام پاک‌سازی از سمت برنامه: همهٔ کش‌ها را می‌ریزد و می‌گوید
 * صفحه را دوباره بارگذاری کند. برای مواقعی است که کاربر مطمئن نیست
 * نسخهٔ درست را می‌بیند.
 */
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') { self.skipWaiting(); return; }
  if (event.data?.type === 'CLEAR_CACHES') {
    event.waitUntil(
      caches.keys()
        .then(keys => Promise.all(keys.map(k => caches.delete(k))))
        .then(() => {
          event.source?.postMessage({ type: 'CACHES_CLEARED' });
        })
    );
  }
  /**
   * «همه‌چیز را از نو بگیر» — کش‌ها را می‌ریزد، پوسته را از شبکه
   * دوباره پر می‌کند و به همهٔ پنجره‌ها می‌گوید بارگذاری کنند.
   * یک پیام، یک بارگذاری؛ کاربر لازم نیست چند بار رفرش کند.
   */
  if (event.data?.type === 'REFRESH_ALL') {
    event.waitUntil((async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
        const cache = await caches.open(CACHE);
        await Promise.all(SHELL.map(u => cache.add(u).catch(() => null)));
      } catch { /* بی‌اهمیت */ }
      const list = await self.clients.matchAll({ type: 'window' });
      for (const c of list) { try { c.postMessage({ type: 'REFRESH_ALL_DONE' }); } catch { /* */ } }
    })());
  }
});
