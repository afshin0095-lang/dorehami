/* ============================================================
   نقطه‌ی ورود — مسیریابی، بارگذاری بازی، چرخه‌ی عمر
   ============================================================ */

import { h, mount, playSound, store, toast } from './core.js';
import { HomeScreen, GamesScreen, LibraryScreen, ProfileScreen } from './ui/screens.js';
import { navbar, artBanner } from './ui/kit.js';
import { applyPrefs, getPrefs } from './ui/settings.js';
import { AdminScreen } from './ui/admin.js';
import { TableScreen } from './net/table-screen.js';
import { LobbyScreen } from './net/table.js';
import { byId, GAMES } from './games/registry.js';

const app = document.getElementById('app');
let currentGameCleanup = null;

const NAV = [
  { id: 'home', label: 'خانه', icon: 'home' },
  { id: 'games', label: 'بازی‌ها', icon: 'games' },
  { id: 'library', label: 'کتابخانه', icon: 'book' },
  { id: 'profile', label: 'پروفایل', icon: 'user' }
];

const screenState = { cat: 'all', q: '' };
let route = { name: 'home' };

function renderNav(active) {
  return navbar({ items: NAV, active, onNavigate: (id) => navigate(id) });
}

function navigate(name, params = {}) {
  route = { name, params };
  if (name === 'games' && params.cat) screenState.cat = params.cat;
  render();
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
}

async function openGame(id) {
  const game = byId(id);
  if (!game) return;
  const mod = await game.load();
  if (!mod?.mountGame) { toast('این بازی بارگذاری نشد', 'warn'); return; }

  clearScreen();
  const host = h('div', { class: 'game-shell' });
  mount(app, host);
  document.querySelector('.navbar')?.remove();

  // هر درخواست بازگشت که صفحه‌ی بازی جوابش را ندهد، اینجا گرفته می‌شود
  const onGlobalBack = () => { destroyGame(); navigate('games'); };
  document.addEventListener('dy:back', onGlobalBack);

  // نوار هنر بازی: تصویر کارت انتخاب‌شده در بالای خود بازی
  const banner = artBanner(game.art, game.title);
  const stage = h('div', {});
  if (banner) host.append(banner);
  host.append(stage);

  const inner = mod.mountGame(stage, {
    game,
    onExit: () => { destroyGame(); navigate('home'); }
  });
  currentGameCleanup = () => {
    document.removeEventListener('dy:back', onGlobalBack);
    try { inner?.(); } catch (e) { console.warn(e); }
  };
}

function destroyGame() {
  try { currentGameCleanup?.(); } catch (e) { console.warn(e); }
  currentGameCleanup = null;
}

function clearScreen() {
  destroyGame();
  app.replaceChildren();
  document.querySelector('.navbar')?.remove();
}

function render() {
  clearScreen();
  switch (route.name) {
    case 'home':
      mount(app, HomeScreen({ navigate, openGame }));
      document.body.append(renderNav('home'));
      break;
    case 'games':
      mount(app, GamesScreen({ navigate, openGame, state: screenState }));
      document.body.append(renderNav('games'));
      break;
    case 'library':
      mount(app, LibraryScreen({ navigate, openGame }));
      document.body.append(renderNav('library'));
      break;
    case 'profile':
      mount(app, ProfileScreen({ navigate, openGame }));
      document.body.append(renderNav('profile'));
      break;
    case 'admin':
      // پنل مدیریت: بدون نوار پایین، با دکمه‌ی بازگشت اختصاصی
      mount(app, AdminScreen({ onBack: () => navigate('profile') }));
      break;
    default:
      mount(app, HomeScreen({ navigate, openGame }));
      document.body.append(renderNav('home'));
  }
  document.title = 'دورهمی‌یار — جعبه‌بازی کاغذی';
}

/* ---------------- لابی چندگوشی: تمام‌صفحه، مستقل از روتر ---------------- */
let lobbyDispose = null;
document.addEventListener('dy:lobby', (ev) => {
  const { gameId, title, maxSeats, minSeats } = ev.detail || {};
  clearScreen();
  // حکم: میز کامل با حکم‌خوانی، پخش ۱۳ کارت و دست پنهان هر بازیکن.
  // بقیهٔ بازی‌ها: لابی مشترک کد‌دار (همه یک میز می‌بینند).
  const back = () => {
    try { screen.dispose?.(); } catch { /* */ }
    lobbyDispose = null;
    navigate('games');
  };
  const screen = gameId === 'hokm'
    ? TableScreen({ gameId, title, maxSeats, minSeats, onBack: back })
    : LobbyScreen({ gameId, title, maxSeats, minSeats, onBack: back });
  lobbyDispose = () => screen.dispose?.();
  mount(app, screen.node);
  document.querySelector('.navbar')?.remove();
});
window.addEventListener('pagehide', () => { try { lobbyDispose?.(); } catch { /* */ } });

/* ---------------- دکمه‌های سیستمی (اندروید/iOS) ---------------- */
window.addEventListener('popstate', () => {
  if (document.querySelector('.game-shell')) { destroyGame(); navigate('games'); }
});

/* ---------------- چرخه‌ی عمر: پنهان‌سازی کارت خصوصی ---------------- */
function onHide() {
  // هر کارت خصوصیِ باز، فوراً بسته می‌شود تا در preview یا دست دیگران دیده نشود
  document.querySelectorAll('[data-private="open"]').forEach(el => {
    el.dispatchEvent(new CustomEvent('dy:hide'));
  });
}
document.addEventListener('visibilitychange', () => { if (document.hidden) onHide(); });
window.addEventListener('blur', onHide);
window.addEventListener('pagehide', onHide);

/* ---------------- شروع ---------------- */
applyPrefs();
void GAMES;
const IS_FRESH = location.search.includes('fresh=');

/* اگر با ?fresh= بالا آمده‌ایم: حافظهٔ موقت و سرویس‌ورکر را پاک کن تا کاربر
   قطعاً کد تازه را ببیند، بعد پارامتر را از نشانی بردار (تا رفرش بعدی عادی باشد). */
if (IS_FRESH) {
  (async () => {
    try {
      if (globalThis.caches?.keys) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r => r.unregister().catch(() => null)));
      }
    } catch { /* بی‌اهمیت */ }
    history.replaceState(null, '', location.pathname);
  })();
}

void getPrefs;
void playSound;
void store;
render();

// سرویس‌ورکر برای اجرای آفلاین (در صورت پشتیبانی)
// در بارگذاری «تازه» ثبت نمی‌کنیم تا نسخهٔ ذخیره‌شده نتواند کد قدیمی بدهد.
if ('serviceWorker' in navigator && !IS_FRESH) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      // اگر نسخهٔ تازه‌ای پیدا شد، آماده‌اش کن و بی‌درنگ فعال کن
      reg.addEventListener('updatefound', () => {
        const sw = reg.installing;
        if (!sw) return;
        sw.addEventListener('statechange', () => {
          if (sw.state === 'installed' && navigator.serviceWorker.controller) {
            sw.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      });
      // نسخهٔ تازه فعال شد → یک بار تازه‌سازی، تا کد قدیمی نماند
      /**
       * سرویس‌ورکر تازه فعال شد. فقط reload کافی نیست: ممکن است کش
       * نسخهٔ قدیمی هنوز زنده باشد و همان CSS کهنه را بدهد. یک بار
       * پاک‌سازی کامل می‌کنیم تا اولین بارگذاری، قطعاً نسخهٔ تازه باشد.
       */
      let reloaded = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloaded) return;
        reloaded = true;
        void hardReload();
      });
      // هر بار بازگشت به برنامه، کش را بررسی کن
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) reg.update().catch(() => {});
      });
    }).catch(() => { /* آفلاین غیرفعال، بازی کار می‌کند */ });
  });
}

/**
 * «بازنشانی نسخه» — برای وقتی که مرورگر نسخهٔ قدیمی را نگه داشته است.
 * با dy:hard-reload از پنل مدیریت یا هر جای دیگر صدا زده می‌شود.
 */
export async function hardReload() {
  /**
   * نکتهٔ مهم: این تابع ممکن است خودش از یک نسخهٔ **کهنه** اجرا شود
   * (کاربر دکمه را در کد قدیمی می‌زند). پس هیچ‌کس نباید به تازه‌بودن
   * منطق این‌جا تکیه کند؛ باید «کامل و خودبسنده» باشد:
   *  ۱) هر کشی هست، با هر نامی، پاک شود (نه فقط کش خودمان)
   *  ۲) سرویس‌ورکرها برداشته شوند
   *  ۳) با ?fresh= بالا بیاییم و از آن‌جا پیش‌راه‌انداز دوباره
   *     همان پاک‌سازی را انجام می‌دهد
   * حتی اگر همهٔ این‌ها شکست بخورد، پارامتر fresh در آدرس باعث می‌شود
   * پیش‌راه‌اندازِ تازه (که با no-store سرو می‌شود) کار را تمام کند.
   */
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister().catch(() => null)));
    }
  } catch { /* بی‌اهمیت */ }
  try {
    if (globalThis.caches?.keys) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
  } catch { /* بی‌اهمیت */ }
  // با پارامتر تازه، هیچ نسخهٔ کش‌شده‌ای در مسیر نمی‌ماند
  const url = `${location.pathname}?fresh=${Date.now()}`;
  try {
    location.replace(url);
  } catch {
    location.href = url;
  }
}
document.addEventListener('dy:hard-reload', () => { void hardReload(); });



/* ============================================================
   نگهبان نسخه — «چرا تغییرات را نمی‌بینم؟»
   مرورگر ممکن است چندی کد قدیمی را از کش بدهد. صفحه هر چند دقیقه
   /api/build را می‌پرسد؛ اگر با نسخهٔ اجراکننده یکی نبود، نواری
   نشان می‌دهد که با یک زدن، کش را پاک و کد تازه را بار می‌کند.
   این نوار راه فرار از «دکمهٔ پاک‌کردن کش در نسخهٔ قدیمی است» را می‌بندد.
   ============================================================ */

const RUNNING_BUILD = new URL(import.meta.url).searchParams.get('b')
  || document.documentElement.dataset.build
  || null;

async function askBuild() {
  try {
    const r = await fetch('/api/build', { cache: 'no-store' });
    if (!r.ok) return null;
    const j = await r.json();
    return j.build || null;
  } catch { return null; }
}

function showUpdateBar(serverBuild) {
  if (document.getElementById('dy-update-bar')) return;
  const bar = document.createElement('div');
  bar.id = 'dy-update-bar';
  bar.className = 'update-bar';
  bar.setAttribute('role', 'status');
  const text = document.createElement('span');
  text.className = 'update-bar__text';
  text.textContent = 'نسخهٔ تازه آماده است';
  const go = document.createElement('button');
  go.className = 'update-bar__go';
  go.type = 'button';
  go.textContent = 'به‌روزرسانی';
  go.addEventListener('click', () => { void hardReload(); });
  const close = document.createElement('button');
  close.className = 'update-bar__x';
  close.type = 'button';
  close.setAttribute('aria-label', 'بستن');
  close.textContent = '×';
  close.addEventListener('click', () => bar.remove());
  bar.append(text, go, close);
  bar.dataset.build = serverBuild || '';
  document.body.appendChild(bar);
  // دکمه همیشه در دسترس باشد، نه فقط وقتی از دست رفته‌ایم
  go.addEventListener('click', () => { try { sessionStorage.setItem('dy:updated', '1'); } catch {} });
}

if (RUNNING_BUILD && !IS_FRESH) {
  const check = async () => {
    const build = await askBuild();
    if (build && RUNNING_BUILD && build !== RUNNING_BUILD) showUpdateBar(build);
  };
  window.setTimeout(check, 1500);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) void check(); });
  window.setInterval(check, 120_000);
}

/* ============================================================
   خودآزمای نسخه — از کنسول مرورگر:  dyVersion()
   می‌گوید کدام نسخه اجرا می‌شود، سرور چه نسخه‌ای دارد، و آیا
   سرویس‌ورکری مانده که کد کهنه بدهد.
   ============================================================ */
globalThis.dyVersion = async function dyVersion() {
  const server = await askBuild();
  const running = RUNNING_BUILD;
  const regs = ('serviceWorker' in navigator)
    ? await navigator.serviceWorker.getRegistrations().catch(() => []) : [];
  const keys = globalThis.caches?.keys ? await caches.keys().catch(() => []) : [];
  const report = {
    running,
    server,
    upToDate: !!server && server === running,
    swRegistrations: regs.length,
    caches: keys,
    url: location.href
  };
  // eslint-disable-next-line no-console
  console.table(report);
  return report;
};

/** پاک‌سازی کامل از کنسول:  dyFix() */
globalThis.dyFix = hardReload;
