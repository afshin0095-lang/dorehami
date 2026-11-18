/* ============================================================
   صفحه‌های اصلی: خانه، بازی‌ها، کتابخانه، پروفایل
   ============================================================ */

import { h, mount, stats, playStreak, dailyGameId, toFa, toast, store, playSound } from '../core.js';
import { GAMES, CATEGORIES, byId } from '../games/registry.js';
import { icon, iconBtn, topbar, navbar, chip, sheet } from './kit.js';
import { openSettings, getPrefs } from './settings.js';
import { QUIZ_BANK, RIDDLES } from '../content.js';
import { LobbyScreen } from '../net/table.js';
import { overlay, closeOverlay } from './kit.js';

const TILT = [-1.4, 1.1, -0.7, 1.6, -1.9, 0.9, -1.1, 1.3, -0.5, 1.8, -1.6, 0.6];

/** بازی‌هایی که مدیر پنهان نکرده باشد */
export function visibleGames() {
  const hidden = new Set(getPrefs().hiddenGames || []);
  return GAMES.filter(g => !hidden.has(g.id));
}

/** باز کردن لابی چندگوشی یک بازی، تمام‌صفحه */
export function openLobby(game, navigate) {
  document.dispatchEvent(new CustomEvent('dy:lobby', {
    detail: {
      gameId: game.id,
      title: game.title,
      maxSeats: game.id === 'mafia' ? 10 : (game.id === 'duz' ? 2 : 4),
      minSeats: 2
    }
  }));
  void navigate;
}

/** دکمه‌های سرصفحه: تنظیمات (با برچسب) + پنل مدیریت */
function headerActions(navigate) {
  return [
    iconBtn('settings', { label: 'تنظیمات', onClick: () => openSettings() }),
    iconBtn('panel', { label: 'پنل مدیریت', onClick: () => navigate('admin') })
  ];
}

function gameCard(game, i, onOpen) {
  return h('button', {
    class: 'game-card deckle',
    style: { '--tilt': `${TILT[i % TILT.length]}deg` },
    dataset: { gameId: game.id },
    'aria-label': `${game.title} — ${game.meta}`,
    onclick: () => { playSound('card-deal'); onOpen(game.id); }
  },
    h('div', { class: 'game-card__art', style: { backgroundImage: `url(${game.art})` } }),
    h('div', { class: 'game-card__shade' }),
    game.badge ? h('span', { class: 'game-card__ribbon' }, game.badge) : null,
    h('div', { class: 'game-card__body' },
      h('div', { class: 'game-card__title' }, game.title),
      h('div', { class: 'game-card__meta' }, `${game.playersText} · ${game.timeText}`)
    )
  );
}

/* ------------------------------ خانه ------------------------------ */
export function HomeScreen({ navigate, openGame }) {
  const s = stats.get();
  const streak = playStreak(s.playDates || []);
  const pool = visibleGames();
  const dailyId = dailyGameId(pool.filter(g => g.solo).map(g => g.id)) || pool[0]?.id;
  const daily = byId(dailyId) || pool[0];
  const recent = byId(s.history?.[0]?.gameId);
  const featured = ['mafia', 'hokm', 'esmfamil', 'quiz'];
  const cats = CATEGORIES.slice(0, 5);

  return h('div', {},
    // لوگوی بالای برنامه — بالای همه‌چیز، مثل نشان روی جلد
    h('div', { class: 'brand' },
      h('img', {
        class: 'brand__logo',
        src: '/assets/logo-512.png',
        alt: 'دورهمی‌یار',
        width: '132', height: '120',
        draggable: 'false'
      })
    ),

    topbar({ right: headerActions(navigate) }),

    /*
     * بنر پارچه‌ای: بافت واقعی + گلدوزی فیروزه‌ای.
     * متن روی خودِ پارچه می‌نشیند (نه در یک جعبهٔ جدا) تا حس «چاپ روی
     * پارچه» بدهد. سایهٔ متن کوتاه و گرم است، نه سایهٔ سیاهِ تیز.
     */
    h('section', { class: 'hero-fabric' },
      h('div', { class: 'hero-fabric__cloth' }),
      h('div', { class: 'hero-fabric__inner' },
        h('div', { class: 'hero-fabric__kicker' }, 'گوشی وسط جمع روشن'),
        h('h1', { class: 'hero-fabric__title' }, 'امشب چی بازی کنیم؟'),
        h('p', { class: 'hero-fabric__sub' },
          'یه دورهمی شاد و لذت‌بخش — چه از راه دور و چه نزدیک')
      )
    ),

    // چالش امروز — زیر بنر، با همان قرمز جگریِ پارچه
    h('div', { class: 'hero-challenge' },
      h('button', {
        class: 'btn btn--oxblood btn--block hero-challenge__btn',
        onclick: () => { playSound('seal'); openGame(daily.id); }
      },
        icon('spark', 18),
        h('span', {}, 'چالش امروز'),
        h('span', { class: 'hero-challenge__name' }, `· ${daily.title}`)
      )
    ),

    // نوار آمار
    h('div', { class: 'score-row', style: { marginBottom: '1rem' } },
      h('span', { class: 'score-pill' }, icon('crown', 15), `${toFa(s.rounds || 0)} دور بازی`),
      h('span', { class: 'score-pill' }, icon('spark', 15), `${toFa(streak)} روز پیاپی`),
      h('span', { class: 'score-pill' }, icon('clock', 15), `چالش: ${daily.title}`)
    ),

    recentsSheet(recent, openGame),

    // دسته‌ها
    h('div', { class: 'chips' },
      ...cats.map(c => chip(c.label, {
        glyph: c.glyph, emblem: c.emblem,
        onClick: () => navigate('games', { cat: c.id })
      }))
    ),

    // بازی‌ها
    h('h2', { style: { margin: '.4rem .1rem .6rem', color: '#f7efdd', textShadow: '0 2px 6px rgba(0,0,0,.6)' } }, 'پیشنهاد امشب'),
    h('div', { class: 'game-grid' }, ...featured.map(id => byId(id)).filter(Boolean).map((g, i) => gameCard(g, i, openGame))),

    h('div', { style: { marginTop: '.9rem' } },
      h('button', {
        class: 'btn btn--block btn--teal',
        onclick: () => { playSound('paper-flip'); navigate('games'); }
      }, icon('games', 18), `همه‌ی ${toFa(pool.length)} بازی`)
    )
  );
}

function recentsSheet(recent, openGame) {
  if (!recent) return null;
  return h('section', { class: 'sheet', style: { marginBottom: '1rem' } },
    h('div', { class: 'sheet__title' }, icon('clock', 18), 'ادامه از آخرین بار'),
    h('div', { style: { display: 'flex', alignItems: 'center', gap: '.7rem' } },
      h('div', {
        style: {
          width: '44px', height: '44px', flex: '0 0 auto', backgroundImage: `url(${recent.art})`,
          backgroundSize: 'cover', backgroundPosition: 'center', mixBlendMode: 'multiply', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.2)'
        }
      }),
      h('div', { style: { flex: 1 } },
        h('div', { style: { fontWeight: 700, fontSize: '.9rem' } }, recent.title),
        h('small', {}, recent.meta)
      ),
      h('button', { class: 'btn btn--sm', onclick: () => openGame(recent.id) }, 'بازی')
    )
  );
}

/* ------------------------------ فهرست بازی‌ها ------------------------------ */
export function GamesScreen({ navigate, openGame, state }) {
  const activeCat = state?.cat || 'all';
  const query = state?.q || '';
  const filtered = visibleGames().filter(g => {
    const catOk = activeCat === 'all' || g.cats.includes(activeCat);
    const qOk = !query || (g.title + g.meta + g.tags.join(' ')).includes(query);
    return catOk && qOk;
  });

  const search = h('input', {
    type: 'search', placeholder: 'جست‌وجو… مثلاً «دونفره» یا «مافیا»',
    value: query,
    style: {
      width: '100%', padding: '.65rem .8rem', font: 'inherit', fontSize: '.9rem',
      border: 'none', outline: 'none', borderRadius: '2px',
      backgroundColor: 'rgba(251,246,234,.96)', boxShadow: 'var(--lift-1)'
    },
    oninput: (e) => { state.q = e.target.value; mount(document.getElementById('app'), GamesScreen({ navigate, openGame, state })); }
  });

  return h('div', {},
    topbar({ right: headerActions(navigate) }),
    h('div', { style: { marginBottom: '.8rem' } }, search),
    h('div', { class: 'chips' },
      chip('همه', { pressed: activeCat === 'all', onClick: () => { state.cat = 'all'; navigate('games', state); } }),
      ...CATEGORIES.map(c => chip(c.label, {
        pressed: activeCat === c.id,
        glyph: c.glyph, emblem: c.emblem,
        onClick: () => { state.cat = c.id; navigate('games', state); }
      }))
    ),
    filtered.length === 0
      ? h('section', { class: 'sheet' }, h('p', {}, 'با این فیلتر بازی‌ای پیدا نشد. فیلتر را پاک کن.'))
      : h('div', { class: 'game-grid' }, ...filtered.map((g, i) => gameCard(g, i, openGame))),
    h('section', { class: 'sheet', style: { marginTop: '.9rem' } },
      h('div', { class: 'sheet__title' }, icon('users', 18), 'بازی چندگوشی'),
      h('p', { style: { margin: '0 0 .6rem', fontSize: '.86rem' } },
        'برای بازی با گوشی‌های جدا یک کد اتاق بساز. پیام‌ها اعتبارسنجی می‌شوند و محتوای مخفی هرگز ارسال نمی‌شود.'),
      h('div', { style: { display: 'grid', gap: '.45rem' } },
        // همهٔ بازی‌های چندنفره، نه فقط چهارتای قدیمی
        GAMES.filter(g => g.multi).map(g => g.id)
          .filter(id => !(getPrefs().hiddenGames || []).includes(id)).map(id => {
          const g = byId(id);
          if (!g) return null;
          return h('button', {
            class: 'btn btn--teal btn--block',
            onclick: () => { playSound('paper-flip'); openLobby(g, navigate); }
          }, icon('users', 16), ` میز ${g.title}`);
        })
      )
    ),
    h('p', { style: { textAlign: 'center', color: '#e8dcc4', fontSize: '.78rem', marginTop: '1.2rem', opacity: .8 } },
      'همه‌ی بازی‌ها آفلاین کار می‌کنند.')
  );
}

/* ------------------------------ کتابخانه/راهنما ------------------------------ */
export function LibraryScreen({ navigate, openGame }) {
  const howto = [
    { title: '۱ گوشی، ۴ حالت', body: 'تکی: یک نفر. دونفره روی یک گوشی: گوشی دست‌به‌دست می‌شود. دورهمی: گوشی روی میز و جمع دور آن. چندگوشی: هرکس با گوشی خودش؛ در نقشه‌ی راه است.' },
    { title: 'کارت خصوصی چطور کار می‌کند؟', body: 'وقتی نقش یا واژه‌ای مخفی است، اول پرده‌ی حریم می‌آید. کسی که نوبتش است گوشی را برمی‌دارد، کارت را لمس می‌کند، می‌بیند و بعد «دیدم» را می‌زند. کارت بعدی روی همان کاغذ پوشانده می‌شود.' },
    { title: 'اگر گوشی زنگ خورد؟', body: 'وقتی برنامه به پس‌زمینه برود، کارت خصوصی خودکار بسته می‌شود تا کسی نقش را نبیند. با برگشت، از همان مرحله ادامه می‌دهی.' },
    { title: 'امتیاز دوباره ثبت نمی‌شود', body: 'هر دور یک شناسه دارد و فقط یک بار ثبت می‌شود؛ لمس دوباره یا برگشت به صفحه‌ی نتیجه امتیاز را دوبرابر نمی‌کند.' },
    { title: 'حریم خصوصی', body: 'هیچ داده‌ای به بیرون فرستاده نمی‌شود. آمار و رکوردها فقط روی همین گوشی ذخیره می‌شوند و با «پاک‌کردن داده‌ها» در تنظیمات حذف می‌شوند.' }
  ];

  const s = stats.get();
  const played = Object.entries(s.byGame || {}).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return h('div', {},
    topbar({ right: headerActions(navigate) }),
    h('h1', { style: { color: '#f7efdd', marginBottom: '.8rem', textShadow: '0 2px 8px rgba(0,0,0,.6)' } }, 'کتابخانه'),
    h('section', { class: 'sheet sheet--lined' },
      h('div', { class: 'sheet__title' }, icon('book', 18), 'راهنمای کوتاه: چطور بازی کنیم'),
      ...howto.map((x, i) => h('div', { style: { marginBottom: '.75rem' } },
        h('div', { style: { fontWeight: 700, fontSize: '.9rem', marginBottom: '.15rem' } }, x.title),
        h('p', { style: { margin: 0, fontSize: '.86rem', lineHeight: 1.85 } }, x.body)
      ))
    ),
    h('section', { class: 'sheet' },
      h('div', { class: 'sheet__title' }, icon('crown', 18), 'رکوردهای تو'),
      played.length === 0
        ? h('p', { style: { margin: 0 } }, 'هنوز بازی‌ای ثبت نشده. یک بازی شروع کن!')
        : h('div', { style: { display: 'grid', gap: '.4rem' } },
            ...played.map(([id, count]) => {
              const g = byId(id);
              return h('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: '.88rem' } },
                h('span', {}, g?.title || id),
                h('span', { class: 'tnum', style: { fontWeight: 700 } }, `${toFa(count)} بار`)
              );
            })
          ),
      h('div', { style: { marginTop: '.8rem' } },
        h('button', { class: 'btn btn--sm', onclick: () => navigate('profile') }, 'دیدن پروفایل')
      )
    ),
    h('section', { class: 'sheet' },
      h('div', { class: 'sheet__title' }, icon('spark', 18), 'دانستنی‌ها'),
      h('p', { style: { margin: 0, fontSize: '.86rem' } },
        `${toFa(QUIZ_BANK.length)} سؤال کوییز، ${toFa(RIDDLES.length)} چیستان و ۸ تست هوش در برنامه هست — همه آفلاین.`),
      h('div', { style: { marginTop: '.7rem', display: 'flex', gap: '.5rem', flexWrap: 'wrap' } },
        ['quiz', 'riddle', 'iq'].map(id => h('button', {
          class: 'btn btn--sm', onclick: () => openGame(id)
        }, byId(id)?.title))
      )
    )
  );
}

/* ------------------------------ پروفایل ------------------------------ */
export function ProfileScreen({ navigate, openGame }) {
  const s = stats.get();
  const streak = playStreak(s.playDates || []);
  const xp = (s.rounds || 0) * 25 + Object.keys(s.byGame || {}).length * 20 + streak * 10;
  const level = 1 + Math.floor(xp / 100);
  const inLevel = xp % 100;

  const achievements = [
    { id: 'first', label: 'شروع قشنگ', desc: 'اولین دور کامل', done: (s.rounds || 0) >= 1 },
    { id: 'five', label: 'گرم‌شدن', desc: '۵ دور بازی', done: (s.rounds || 0) >= 5 },
    { id: 'ten', label: 'پای کار', desc: '۱۰ دور بازی', done: (s.rounds || 0) >= 10 },
    { id: 'explorer', label: 'بازی‌گرد', desc: '۳ بازی متفاوت', done: Object.keys(s.byGame || {}).length >= 3 },
    { id: 'streak3', label: 'زنجیره‌ساز', desc: '۳ روز پیاپی', done: streak >= 3 }
  ];

  return h('div', {},
    topbar({ right: headerActions(navigate) }),
    h('section', { class: 'sheet', style: { textAlign: 'center' } },
      h('div', {
        style: {
          width: '72px', height: '72px', margin: '0 auto .6rem', borderRadius: '50%',
          background: 'radial-gradient(circle at 34% 30%, #c25b45, #6d2216 72%)',
          boxShadow: '0 6px 16px rgba(0,0,0,.4), inset 0 2px 3px rgba(255,255,255,.3)',
          display: 'grid', placeItems: 'center', color: '#f5dfae', fontWeight: 700, fontSize: '1.4rem'
        }
      }, toFa(level)),
      h('div', { style: { fontWeight: 700 } }, 'بازیکن محلی'),
      h('small', {}, `${toFa(xp)} امتیاز تجربه · سطح ${toFa(level)}`),
      h('div', { style: { height: '10px', background: 'rgba(0,0,0,.1)', marginTop: '.7rem', borderRadius: '1px', overflow: 'hidden' } },
        h('div', { style: { width: `${inLevel}%`, height: '100%', background: 'var(--teal)' } })
      ),
      h('small', { style: { display: 'block', marginTop: '.3rem' } }, `${toFa(inLevel)} از ۱۰۰ تا سطح بعد`)
    ),

    h('section', { class: 'sheet' },
      h('div', { class: 'sheet__title' }, icon('crown', 18), 'نشان‌ها'),
      h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.5rem' } },
        ...achievements.map(a => h('div', {
          style: {
            padding: '.55rem .6rem', fontSize: '.78rem',
            background: a.done ? 'rgba(47,111,104,.16)' : 'rgba(0,0,0,.05)',
            border: `1px solid ${a.done ? 'var(--teal)' : 'rgba(0,0,0,.12)'}`,
            opacity: a.done ? 1 : .6
          }
        }, h('div', { style: { fontWeight: 700 } }, a.done ? '🏅 ' : '🔒 ', a.label),
           h('div', { style: { fontSize: '.72rem', marginTop: '.1rem' } }, a.desc)))
      )
    ),

    h('section', { class: 'sheet' },
      h('div', { class: 'sheet__title' }, icon('clock', 18), 'آخرین بازی‌ها'),
      (s.history || []).length === 0
        ? h('p', { style: { margin: 0 } }, 'هنوز چیزی ثبت نشده.')
        : h('div', { style: { display: 'grid', gap: '.35rem', fontSize: '.85rem' } },
            ...(s.history || []).slice(0, 8).map(rec => {
              const g = byId(rec.gameId);
              const d = new Date(rec.at);
              return h('div', { style: { display: 'flex', justifyContent: 'space-between' } },
                h('span', {}, g?.title || rec.gameId, rec.label ? ` — ${rec.label}` : ''),
                h('span', { style: { color: 'var(--ink-soft)', fontSize: '.76rem' } },
                  `${toFa(d.getHours())}:${toFa(String(d.getMinutes()).padStart(2, '0'))}`)
              );
            })
          )
    ),

    h('button', { class: 'btn btn--block btn--mustard', onclick: () => openGame('quiz') }, icon('spark', 18), 'چالش کوییز امروز')
  );
}
