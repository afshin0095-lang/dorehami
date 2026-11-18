/* ============================================================
   تنظیمات — پنل کاغذی
   ============================================================ */

import { h, store, soundPrefs, playSound, toast, setVolume } from '../core.js';
import { overlay, closeOverlay, icon, btn } from './kit.js';

const DEFAULTS = { sound: true, volume: 0.7, reduceMotion: false, largeText: false, highContrast: false, hiddenGames: [] };

export function getPrefs() {
  return { ...DEFAULTS, ...store.get('settings', {}) };
}

/** نوشتن تنظیمات — تنها راه تغییر مجاز (پنل‌ها از این استفاده می‌کنند) */
export function setPrefs(patch = {}) {
  const next = { ...getPrefs(), ...patch };
  store.set('settings', next);
  return next;
}

export function applyPrefs() {
  const p = getPrefs();
  soundPrefs.enabled = p.sound;
  soundPrefs.volume = typeof p.volume === 'number' ? p.volume : 0.7;
  setVolume(soundPrefs.volume);
  document.body.classList.toggle('reduce-motion', p.reduceMotion);
  document.body.classList.toggle('text-lg', p.largeText);
  document.body.classList.toggle('high-contrast', Boolean(p.highContrast));
}

export function openSettings() {
  const prefs = getPrefs();
  playSound('paper-flip');

  const toggle = (key, label, desc) => h('label', {
    style: {
      display: 'flex', alignItems: 'center', gap: '.65rem', padding: '.6rem 0',
      borderBottom: '1px dashed rgba(0,0,0,.14)', cursor: 'pointer'
    }
  },
    h('input', {
      type: 'checkbox', checked: prefs[key], style: { width: '20px', height: '20px', accentColor: '#a33d2c' },
      onchange: (e) => {
        const next = { ...getPrefs(), [key]: e.target.checked };
        store.set('settings', next);
        applyPrefs();
        playSound('tap');
      }
    }),
    h('div', {}, h('div', { style: { fontWeight: 700, fontSize: '.9rem' } }, label),
                h('small', {}, desc))
  );

  function volumeRow() {
    const current = Math.round((getPrefs().volume ?? 0.7) * 100);
    const label = h('span', { class: 'vol__num' }, `${current}٪`);
    const input = h('input', {
      class: 'vol__range', type: 'range', min: '0', max: '100', step: '5',
      value: String(current), 'aria-label': 'بلندی صدا',
      oninput: (e) => {
        const v = Number(e.target.value);
        label.textContent = `${v}٪`;
        setVolume(v / 100);
        setPrefs({ volume: v / 100 });
      },
      onchange: () => { playSound('tap'); }
    });
    return h('div', { class: 'vol' },
      h('div', { class: 'vol__head' },
        h('span', { class: 'vol__title' }, 'بلندی صدا'),
        label
      ),
      input,
      h('p', { class: 'vol__hint' }, 'پیش‌فرض آرام است. اگر جمع شلوغ است، بیشترش کن.')
    );
  }

  const node = h('div', { class: 'modal-sheet sheet-in' },
    h('div', { style: { display: 'flex', alignItems: 'center', marginBottom: '.6rem' } },
      h('h2', { style: { flex: 1 } }, 'تنظیمات'),
      h('button', { class: 'icon-btn', 'aria-label': 'بستن', onclick: () => { playSound('tap'); closeOverlay(); } }, icon('close'))
    ),
    toggle('sound', 'صدای رابط', 'صدای کاغذ و کارت. برای سکوت کامل خاموش کن.'),
    volumeRow(),
    toggle('reduceMotion', 'کاهش حرکت', 'انیمیشن‌های پرحرکت را متوقف می‌کند.'),
    toggle('largeText', 'متن بزرگ‌تر', 'خوانایی بیشتر در جمع و نور کم.'),

    h('div', { style: { marginTop: '1rem', display: 'grid', gap: '.5rem' } },
      btn('پاک‌کردن داده‌های محلی', {
        variant: 'btn--mustard', cls: 'btn--block', ico: 'trash',
        onClick: () => {
          if (!confirm('همه‌ی آمار، رکوردها و نشست‌ها پاک شود؟ این کار برگشت‌پذیر نیست.')) return;
          store.clearAll();
          toast('داده‌های محلی پاک شد', 'ok');
          closeOverlay();
          location.reload();
        }
      }),
      btn('پاک‌کردن حافظهٔ موقت و بارگذاری تازه', {
        variant: 'btn--block', ico: 'refresh',
        onClick: async () => {
          if (!confirm('نسخهٔ ذخیره‌شدهٔ برنامه پاک شود و تازه بارگذاری شود؟ آمار و رکوردها دست‌نخورده می‌مانند.')) return;
          toast('حافظهٔ موقت پاک شد — در حال بارگذاری تازه', 'ok');
          const { hardReload } = await import('../main.js');
          await hardReload();
        }
      }),
      btn('بستن', { variant: 'btn--block', onClick: closeOverlay, ico: 'close' })
    ),
    h('p', { style: { marginTop: '.9rem', fontSize: '.76rem', color: 'var(--ink-soft)' } },
      'دورهمی‌یار هیچ داده‌ای به اینترنت نمی‌فرستد. همه‌چیز روی همین گوشی است.'),
    h('p', { style: { margin: '.3rem 0 0', fontSize: '.72rem', color: 'var(--ink-faint)' } },
      'اگر بعد از به‌روزرسانی هنوز نسخهٔ قدیمی را می‌بینی، «پاک‌کردن حافظهٔ موقت» را بزن.')
  );

  overlay(node, { onDismiss: closeOverlay });
}
