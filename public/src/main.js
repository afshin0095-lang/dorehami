/* ============================================================
   نقطه‌ی ورود — مسیریابی، بارگذاری بازی، چرخه‌ی عمر
   ============================================================ */

import { h, mount, playSound, store, toast } from './core.js';
import { HomeScreen, GamesScreen, LibraryScreen, ProfileScreen } from './ui/screens.js';
import { navbar } from './ui/kit.js';
import { applyPrefs, getPrefs } from './ui/settings.js';
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

  currentGameCleanup = mod.mountGame(host, {
    game,
    onExit: () => { destroyGame(); navigate('home'); }
  });
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
    default:
      mount(app, HomeScreen({ navigate, openGame }));
      document.body.append(renderNav('home'));
  }
  document.title = 'دورهمی‌یار — جعبه‌بازی کاغذی';
}

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
void getPrefs;
void playSound;
void store;
render();

// سرویس‌ورکر برای اجرای آفلاین (در صورت پشتیبانی)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => { /* آفلاین غیرفعال، بازی کار می‌کند */ });
  });
}
