/* ============================================================
   پنل مدیریت — همه‌ی کارهای مدیریتی در یک جا
   داده‌ها: تنظیمات (prefs)، آمار بازیکن، محتوای بازی‌ها،
   وضعیت نسخه/کش، و ابزارهای نگهداری (پاک‌سازی، پشتیبان).
   محافظت: قفل محلی با کد؛ داده هرگز از دستگاه بیرون نمی‌رود.
   ============================================================ */

import { h, mount, store, stats, toFa, toast, playSound } from '../core.js';
import { icon, iconBtn, btn, sheet, gameHeader, callout, helpBlock } from './kit.js';
import { getPrefs, setPrefs, applyPrefs } from './settings.js';
import { GAMES, CATEGORIES } from '../games/registry.js';
import { QUIZ_BANK, RIDDLES, CODENAMES_WORDS, ESF_CATEGORIES, IQ_ITEMS } from '../content.js';
import { QUIZ_EXTRA } from '../content-extra.js';
import { RIDDLES_EXTRA, IQ_EXTRA } from '../content-more.js';

const ADMIN_KEY = 'admin:pin';          // فقط هش ساده‌ی محلی
const ADMIN_SESSION = 'admin:session';
const LOG_KEY = 'admin:log';

/* ------------------------------ ابزار ------------------------------ */

/** هش ساده — فقط برای جلوگیری از دید اتفاقی، نه رمزنگاری واقعی */
function simpleHash(str) {
  let h1 = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h1 ^= str.charCodeAt(i);
    h1 = Math.imul(h1, 0x01000193) >>> 0;
  }
  return h1.toString(16).padStart(8, '0');
}

export function hasPin() {
  return Boolean(store.get(ADMIN_KEY, null));
}

export function setPin(pin) {
  if (!/^\d{4,8}$/.test(pin || '')) throw new Error('کد باید ۴ تا ۸ رقم باشد');
  store.set(ADMIN_KEY, simpleHash(pin));
  log('تعیین کد مدیریت');
}

export function checkPin(pin) {
  const stored = store.get(ADMIN_KEY, null);
  if (!stored) return false;
  return stored === simpleHash(String(pin || ''));
}

export function isUnlocked() {
  return store.get(ADMIN_SESSION, false) === true;
}

function log(action, detail = '') {
  const list = store.get(LOG_KEY, []);
  const entry = { at: new Date().toISOString(), action, detail };
  store.set(LOG_KEY, [entry, ...list].slice(0, 100));
}

function getLog() { return store.get(LOG_KEY, []); }

/* ------------------------------ شمارش محتوا ------------------------------ */
function contentStats() {
  return [
    { label: 'سؤال کوییز', value: QUIZ_BANK.length + QUIZ_EXTRA.length, min: 50 },
    { label: 'چیستان', value: RIDDLES.length + RIDDLES_EXTRA.length, min: 20 },
    { label: 'آیتم تست هوش', value: IQ_ITEMS.length + IQ_EXTRA.length, min: 12 },
    { label: 'واژه‌ی اسم رمز', value: CODENAMES_WORDS.length, min: 25 },
    { label: 'دسته‌ی اسم و فامیل', value: ESF_CATEGORIES.length, min: 8 },
    { label: 'بازی', value: GAMES.length, min: 10 },
    { label: 'دسته‌بندی', value: CATEGORIES.length, min: 5 }
  ];
}

/* ------------------------------ صفحه‌های پنل ------------------------------ */

export function AdminScreen({ onBack }) {
  let state = { screen: hasPin() && isUnlocked() ? 'panel' : hasPin() ? 'login' : 'setup', tab: 'overview' };

  const render = () => mount(host, draw());
  const host = h('div', { class: 'game-shell admin' });
  render();
  return host;

  function draw() {
    switch (state.screen) {
      case 'setup': return drawSetup();
      case 'login': return drawLogin();
      default: return drawPanel();
    }
  }

  /* ---------- ساخت کد ---------- */
  function drawSetup() {
    let pin = '', pin2 = '';
    const err = h('div', { class: 'admin__err' });
    return h('div', {},
      gameHeader({ title: 'پنل مدیریت', onBack }),
      sheet({ title: 'ساخت کد مدیریت', iconName: 'lock', children: h('div', {},
        h('p', { style: { fontSize: '.88rem' } },
          'برای اولین بار یک کد ۴ تا ۸ رقمی بساز. این کد فقط روی همین دستگاه ذخیره می‌شود و هیچ‌جا ارسال نمی‌شود.'),
        h('input', {
          class: 'admin__input', type: 'password', inputmode: 'numeric', placeholder: 'کد جدید',
          'aria-label': 'کد جدید', oninput: e => { pin = e.target.value; }
        }),
        h('input', {
          class: 'admin__input', type: 'password', inputmode: 'numeric', placeholder: 'تکرار کد',
          'aria-label': 'تکرار کد', oninput: e => { pin2 = e.target.value; }
        }),
        err,
        btn('ساخت و ورود', {
          variant: 'btn--primary btn--block',
          onClick: () => {
            try {
              if (pin !== pin2) throw new Error('دو کد یکسان نیست');
              setPin(pin);
              store.set(ADMIN_SESSION, true);
              state.screen = 'panel';
              playSound('seal');
              render();
            } catch (e) { err.textContent = e.message; }
          }
        })
      ) }),
      callout('این پنل برای مدیر دستگاه است؛ هیچ داده‌ای به سرور فرستاده نمی‌شود.', 'lock')
    );
  }

  /* ---------- ورود ---------- */
  function drawLogin() {
    let pin = '';
    const err = h('div', { class: 'admin__err' });
    return h('div', {},
      gameHeader({ title: 'ورود به مدیریت', onBack }),
      sheet({ title: 'کد مدیریت', iconName: 'lock', children: h('div', {},
        h('input', {
          class: 'admin__input', type: 'password', inputmode: 'numeric', placeholder: 'کد',
          'aria-label': 'کد مدیریت', oninput: e => { pin = e.target.value; },
          onkeydown: (e) => { if (e.key === 'Enter') submit(); }
        }),
        err,
        btn('ورود', { variant: 'btn--primary btn--block', onClick: submit })
      ) })
    );

    function submit() {
      if (checkPin(pin)) {
        store.set(ADMIN_SESSION, true);
        log('ورود به پنل');
        state.screen = 'panel';
        playSound('seal');
        render();
      } else {
        err.textContent = 'کد درست نیست';
        playSound('lose');
      }
    }
  }

  /* ---------- پنل اصلی ---------- */
  function drawPanel() {
    const tabs = [
      { id: 'overview', label: 'نمای کلی', iconName: 'chart' },
      { id: 'games', label: 'بازی‌ها', iconName: 'grid' },
      { id: 'content', label: 'محتوا', iconName: 'book' },
      { id: 'settings', label: 'تنظیمات', iconName: 'settings' },
      { id: 'data', label: 'داده‌ها', iconName: 'save' },
      { id: 'log', label: 'گزارش', iconName: 'clock' }
    ];

    return h('div', {},
      gameHeader({
        title: 'پنل مدیریت',
        onBack: () => { store.set(ADMIN_SESSION, false); log('خروج از پنل'); onBack(); }
      }),
      h('div', { class: 'chips admin__tabs' },
        ...tabs.map(t => h('button', {
          class: 'chip', 'aria-pressed': String(state.tab === t.id),
          onclick: () => { playSound('tap'); state.tab = t.id; render(); }
        }, icon(t.iconName, 14), ' ', t.label))
      ),
      state.tab === 'overview' ? tabOverview()
        : state.tab === 'games' ? tabGames()
        : state.tab === 'content' ? tabContent()
        : state.tab === 'settings' ? tabSettings()
        : state.tab === 'data' ? tabData()
        : tabLog()
    );
  }

  /* --- نمای کلی --- */
  function tabOverview() {
    const s = stats.get();
    const rows = [
      ['دورهای بازی‌شده', toFa(s.rounds || 0)],
      ['بازی‌های متفاوت', toFa(Object.keys(s.byGame || {}).length)],
      ['روزهای بازی', toFa((s.playDates || []).length)],
      ['رکوردهای ثبت‌شده', toFa(Object.keys(s.records || {}).length)],
      ['نسخه', '۰٫۲٫۰'],
      ['وضعیت', navigator.onLine ? 'آنلاین' : 'آفلاین']
    ];
    return h('div', {},
      sheet({ title: 'وضعیت دستگاه', iconName: 'chart', children: h('div', { class: 'admin__kv' },
        ...rows.map(([k, v]) => h('div', { class: 'admin__kv-row' }, h('span', {}, k), h('strong', {}, v)))
      ) }),
      sheet({ title: 'محتوای در دسترس', iconName: 'book', children: h('div', { class: 'admin__kv' },
        ...contentStats().map(c => h('div', { class: 'admin__kv-row' },
          h('span', {}, c.label),
          h('strong', { class: c.value >= c.min ? 'ok' : 'warn' },
            toFa(c.value), c.value >= c.min ? ' ✓' : ` (حداقل ${toFa(c.min)})`)
        ))
      ) })
    );
  }

  /* --- بازی‌ها: فعال/غیرفعال، ترتیب، بررسی --- */
  function tabGames() {
    const hidden = getPrefs().hiddenGames || [];
    return h('div', {},
      sheet({ title: 'فهرست بازی‌ها', iconName: 'grid', children: h('div', { style: { display: 'grid', gap: '.35rem' } },
        ...GAMES.map((g, i) => {
          const isHidden = hidden.includes(g.id);
          return h('div', { class: 'admin__game-row' },
            h('span', { class: 'admin__idx' }, toFa(i + 1)),
            h('div', { style: { flex: 1, minWidth: 0 } },
              h('div', { style: { fontWeight: 700, fontSize: '.88rem' } }, g.title),
              h('small', {}, `${g.playersText} · ${g.timeText}`)
            ),
            h('button', {
              class: `admin__toggle ${isHidden ? '' : 'is-on'}`,
              'aria-pressed': String(!isHidden),
              'aria-label': isHidden ? `نمایش ${g.title}` : `پنهان‌کردن ${g.title}`,
              onclick: () => {
                const cur = new Set(getPrefs().hiddenGames || []);
                cur.has(g.id) ? cur.delete(g.id) : cur.add(g.id);
                setPrefs({ hiddenGames: [...cur] });
                applyPrefs();
                log(isHidden ? 'نمایش بازی' : 'پنهان‌کردن بازی', g.id);
                playSound('tap');
                render();
              }
            }, isHidden ? 'پنهان' : 'فعال')
          );
        })
      ) }),
      callout('بازی‌های پنهان از فهرست و خانه حذف می‌شوند، ولی داده و رکوردشان می‌ماند.', 'grid')
    );
  }

  /* --- محتوا --- */
  function tabContent() {
    return h('div', {},
      sheet({ title: 'بانک محتوا', iconName: 'book', children: h('div', { class: 'admin__kv' },
        ...contentStats().map(c => h('div', { class: 'admin__kv-row' },
          h('span', {}, c.label),
          h('strong', {}, toFa(c.value))
        ))
      ) }),
      sheet({ title: 'بررسی سلامت محتوا', iconName: 'check', children: h('div', {},
        btn('اجرای بررسی', {
          variant: 'btn--teal btn--block',
          onClick: () => runContentCheck()
        }),
        h('div', { dataset: { checkOut: '1' }, style: { marginTop: '.6rem', fontSize: '.84rem' } })
      ) })
    );

    function runContentCheck() {
      const out = host.querySelector('[data-check-out]');
      const problems = [];
      const all = [...QUIZ_BANK, ...QUIZ_EXTRA];
      all.forEach((q, i) => {
        if (!q.q || !Array.isArray(q.a) || q.a.length !== 4) problems.push(`کوییز #${i + 1}: ساختار خراب`);
        else if (!(q.correct >= 0 && q.correct < 4)) problems.push(`کوییز #${i + 1}: پاسخ درست بی‌اعتبار`);
      });
      [...RIDDLES, ...RIDDLES_EXTRA].forEach((r, i) => { if (!r.q || !r.a) problems.push(`چیستان #${i + 1}: ناقص`); });
      [...IQ_ITEMS, ...IQ_EXTRA].forEach((q, i) => {
        if (!q.q || !Array.isArray(q.a) || q.a.length !== 4) problems.push(`هوش #${i + 1}: ساختار خراب`);
      });
      if (new Set(CODENAMES_WORDS).size !== CODENAMES_WORDS.length) problems.push('اسم رمز: واژه‌ی تکراری');
      log('بررسی محتوا', problems.length ? `${problems.length} مشکل` : 'سالم');

      if (out) {
        out.replaceChildren(
          problems.length
            ? h('div', {},
                h('div', { style: { color: 'var(--rust)', fontWeight: 700, marginBottom: '.3rem' } }, `${toFa(problems.length)} مشکل پیدا شد:`),
                h('ul', { class: 'help-list' }, ...problems.slice(0, 20).map(p => h('li', {}, p))))
            : h('div', { class: 'admin__ok' }, 'همه‌ی محتوا سالم است ✓')
        );
      }
      playSound(problems.length ? 'lose' : 'win');
    }
  }

  /* --- تنظیمات --- */
  function tabSettings() {
    const p = getPrefs();
    const toggle = (key, label, hint) => h('div', { class: 'admin__kv-row' },
      h('div', {},
        h('div', { style: { fontSize: '.88rem', fontWeight: 500 } }, label),
        hint ? h('small', {}, hint) : null
      ),
      h('button', {
        class: `admin__toggle ${p[key] ? 'is-on' : ''}`,
        'aria-pressed': String(Boolean(p[key])),
        'aria-label': label,
        onclick: () => {
          setPrefs({ [key]: !p[key] });
          applyPrefs();
          log('تغییر تنظیم', `${key}=${!p[key]}`);
          playSound('tap');
          render();
        }
      }, p[key] ? 'روشن' : 'خاموش')
    );

    return h('div', {},
      sheet({ title: 'تنظیمات کلی', iconName: 'settings', children: h('div', { style: { display: 'grid', gap: '.15rem' } },
        toggle('sound', 'صدا', 'افکت‌های کاغذی و ورق'),
        toggle('reduceMotion', 'کاهش حرکت', 'برای حساسیت به حرکت'),
        toggle('largeText', 'متن بزرگ‌تر', 'خوانایی بهتر در جمع'),
        toggle('highContrast', 'کنتراست بالا', 'خوانایی در نور کم')
      ) }),
      sheet({ title: 'امنیت پنل', iconName: 'lock', children: h('div', { style: { display: 'grid', gap: '.5rem' } },
        btn('تغییر کد مدیریت', {
          variant: 'btn--block',
          onClick: () => { store.set(ADMIN_KEY, null); store.set(ADMIN_SESSION, false); state.screen = 'setup'; render(); }
        }),
        btn('قفل کردن پنل', {
          variant: 'btn--ghost btn--block',
          onClick: () => { store.set(ADMIN_SESSION, false); log('قفل پنل'); state.screen = 'login'; render(); }
        })
      ) })
    );
  }

  /* --- داده‌ها --- */
  function tabData() {
    return h('div', {},
      sheet({ title: 'پشتیبان‌گیری', iconName: 'save', children: h('div', { style: { display: 'grid', gap: '.5rem' } },
        btn('دریافت فایل پشتیبان (JSON)', { variant: 'btn--teal btn--block', onClick: exportData }),
        btn('بازگردانی از فایل', { variant: 'btn--block', onClick: importData })
      ) }),
      sheet({ title: 'پاک‌سازی', iconName: 'trash', children: h('div', { style: { display: 'grid', gap: '.5rem' } },
        btn('پاک‌کردن آمار بازی', {
          variant: 'btn--block',
          onClick: () => {
            if (!confirm('همه‌ی آمار و رکوردها پاک شود؟ این کار برگشت‌پذیر نیست.')) return;
            store.set('stats', { rounds: 0, byGame: {}, history: [], playDates: [], records: {} });
            log('پاک‌کردن آمار');
            toast('آمار پاک شد', 'ok');
            render();
          }
        }),
        btn('بازنشانی کامل تنظیمات', {
          variant: 'btn--block',
          onClick: () => {
            if (!confirm('همه‌ی تنظیمات به حالت اولیه برگردد؟')) return;
            ['prefs', 'hiddenGames'].forEach(k => store.set(k, null));
            applyPrefs();
            log('بازنشانی تنظیمات');
            toast('تنظیمات بازنشانی شد', 'ok');
            render();
          }
        })
      ) }),
      sheet({ title: 'نسخه و کش', iconName: 'refresh', children: h('div', { style: { display: 'grid', gap: '.5rem' } },
        h('p', { style: { fontSize: '.8rem', margin: 0 } },
          'اگر بازی را به‌روز کردی و تغییرها را ندیدی، مرورگر نسخه‌ی قدیمی را از کش سرو می‌کند. این دکمه کش و سرویس‌ورکر را پاک می‌کند — آمار و تنظیمات دست‌نخورده می‌مانند.'),
        btn('بازنشانی نسخه و کش', {
          variant: 'btn--primary btn--block',
          onClick: () => {
            log('بازنشانی نسخه و کش');
            toast('کش پاک شد — صفحه تازه می‌شود', 'ok');
            document.dispatchEvent(new CustomEvent('dy:hard-reload'));
          }
        })
      ) }),
      callout('همه‌ی داده‌ها فقط روی همین دستگاه هستند. پشتیبان را جای امن نگه دار.', 'lock')
    );

    function exportData() {
      const keys = ['stats', 'prefs', 'admin:log', 'soundPrefs'];
      const dump = { version: 1, exportedAt: new Date().toISOString(), data: {} };
      keys.forEach(k => { dump.data[k] = store.get(k, null); });
      const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = h('a', { href: url, download: `dorehami-backup-${new Date().toISOString().slice(0, 10)}.json` });
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      log('دریافت پشتیبان');
      toast('فایل پشتیبان ساخته شد', 'ok');
    }

    function importData() {
      const input = h('input', {
        type: 'file', accept: 'application/json',
        style: { display: 'none' },
        onchange: async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          try {
            const text = await file.text();
            const parsed = JSON.parse(text);
            if (!parsed?.data || typeof parsed.data !== 'object') throw new Error('فایل پشتیبان معتبر نیست');
            Object.entries(parsed.data).forEach(([k, v]) => store.set(k, v));
            applyPrefs();
            log('بازگردانی پشتیبان', file.name);
            toast('بازیابی انجام شد', 'ok');
            render();
          } catch (err) {
            toast(`بازیابی نشد: ${err.message}`, 'warn');
          }
        }
      });
      document.body.append(input);
      input.click();
      setTimeout(() => input.remove(), 1000);
    }
  }

  /* --- گزارش --- */
  function tabLog() {
    const list = getLog();
    return h('div', {},
      sheet({ title: 'آخرین کارها', iconName: 'clock', children:
        list.length
          ? h('div', { style: { display: 'grid', gap: '.3rem', fontSize: '.8rem' } },
              ...list.slice(0, 40).map(e => h('div', { class: 'admin__log-row' },
                h('span', { class: 'admin__log-time' }, new Date(e.at).toLocaleTimeString('fa-IR')),
                h('span', {}, e.action),
                e.detail ? h('small', {}, ` — ${e.detail}`) : null
              )))
          : h('p', { style: { fontSize: '.85rem' } }, 'هنوز کاری ثبت نشده.')
      }),
      list.length ? btn('پاک‌کردن گزارش', {
        variant: 'btn--ghost btn--block',
        onClick: () => { store.set(LOG_KEY, []); render(); }
      }) : null,
      helpBlock({
        steps: [
          'هر تغییر در تنظیمات، بازی‌ها یا داده‌ها اینجا ثبت می‌شود.',
          'گزارش فقط روی همین دستگاه ذخیره می‌شود و سقف ۱۰۰ ردیف دارد.',
          'برای بازبینی، از همین صفحه یا از فایل پشتیبان استفاده کن.'
        ],
        note: 'این گزارش برای عیب‌یابی و پیگیری تغییرات است، نه برای نظارت بر بازیکنان.'
      })
    );
  }
}

void iconBtn;
