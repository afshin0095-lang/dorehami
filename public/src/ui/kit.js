/* ============================================================
   اجزای مشترک UI کاغذی
   ============================================================ */

import { h, playSound } from '../core.js';

export const ICONS = {
  home:   '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9.5 21v-6h5v6"/>',
  games:  '<rect x="3" y="6" width="8" height="12" rx="1.2"/><rect x="13" y="6" width="8" height="12" rx="1.2"/><path d="M6 10h2M7 9v2M16.5 10.5h1"/>',
  book:   '<path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17.5H6.5A2.5 2.5 0 0 0 4 22z"/><path d="M8 7h8M8 11h6"/>',
  user:   '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  back:   '<path d="M15 5 8 12l7 7"/>',
  close:  '<path d="M6 6l12 12M18 6L6 18"/>',
  help:   '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.2a2.6 2.6 0 1 1 3.4 2.5c-.7.3-1.1 1-1.1 1.8v.3"/><circle cx="11.8" cy="17.4" r=".9" fill="currentColor"/>',
  sound:  '<path d="M4 9.5h3l4-3.5v12l-4-3.5H4z"/><path d="M15.5 9a4 4 0 0 1 0 6"/><path d="M18 6.5a7.5 7.5 0 0 1 0 11"/>',
  mute:   '<path d="M4 9.5h3l4-3.5v12l-4-3.5H4z"/><path d="M15.5 9.5l5 5M20.5 9.5l-5 5"/>',
  dice:   '<rect x="4" y="4" width="16" height="16" rx="2.4"/><circle cx="9" cy="9" r="1.2" fill="currentColor"/><circle cx="15" cy="15" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/>',
  play:   '<path d="M7 4.5v15l13-7.5z"/>',
  check:  '<path d="M4.5 12.5l5 5 10-11"/>',
  x:      '<path d="M6 6l12 12M18 6L6 18"/>',
  clock:  '<circle cx="12" cy="12" r="9"/><path d="M12 7v5.5l3.5 2"/>',
  users:  '<circle cx="9" cy="8" r="3.4"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M17 6.2a3.4 3.4 0 0 1 0 6.6"/><path d="M18.5 20a6.4 6.4 0 0 0-2.2-4.8"/>',
  spark:  '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>',
  crown:  '<path d="M3 17l1.5-9 4 4 3.5-6 3.5 6 4-4L21 17z"/><path d="M4 20h16"/>',
  skull:  '<path d="M12 3a7 7 0 0 0-7 7v3l2.5 2v3h9v-3L19 13v-3a7 7 0 0 0-7-7z"/><circle cx="9.5" cy="11" r="1.4" fill="currentColor"/><circle cx="14.5" cy="11" r="1.4" fill="currentColor"/>',
  arrow:  '<path d="M20 12H4"/><path d="M10 6l-6 6 6 6"/>',
  shuffle:'<path d="M3 7h4l7 10h4"/><path d="M3 17h4l2-2.9"/><path d="M14 7h3"/><path d="M15.5 4.5 18 7l-2.5 2.5"/><path d="M15.5 14.5 18 17l-2.5 2.5"/>',
  refresh:'<path d="M20 11a8 8 0 1 0-2.6 6"/><path d="M20 5v6h-6"/>',
  settings:'<circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.11-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.64 8.9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H9a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V9a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1z"/>',
  panel:  '<rect x="3" y="4" width="18" height="16" rx="1.6"/><path d="M9 4v16"/><path d="M13 9h4M13 13h4M13 17h2"/>',
  plus:   '<path d="M12 5v14M5 12h14"/>',
  trash:  '<path d="M4 7h16"/><path d="M9 7V4.5h6V7"/><path d="M6 7l1 13h10l1-13"/><path d="M10 11v6M14 11v6"/>',
  save:   '<path d="M5 4h11l3 3v13H5z"/><path d="M8 4v6h7V4"/><path d="M8 14h8v6H8z"/>',
  lock:   '<rect x="4.5" y="10" width="15" height="10" rx="1.6"/><path d="M8 10V7.5a4 4 0 0 1 8 0V10"/>',
  grid:   '<rect x="3.5" y="3.5" width="7" height="7"/><rect x="13.5" y="3.5" width="7" height="7"/><rect x="3.5" y="13.5" width="7" height="7"/><rect x="13.5" y="13.5" width="7" height="7"/>',
  chart:  '<path d="M4 20V9M10 20V4M16 20v-7M22 20H2"/>',
  wand:   '<path d="M4 20 15 9"/><path d="M14 4l1 2 2 1-2 1-1 2-1-2-2-1 2-1z"/><path d="M19 12l.7 1.4 1.4.6-1.4.6-.7 1.4-.7-1.4-1.4-.6 1.4-.6z"/>'
};

export function icon(name, size = 20) {
  const paths = ICONS[name] || '';
  return h('svg', {
    viewBox: '0 0 24 24', width: size, height: size, fill: 'none',
    stroke: 'currentColor', 'stroke-width': '1.9', 'stroke-linecap': 'round',
    'stroke-linejoin': 'round', 'aria-hidden': 'true', html: paths
  });
}

export function iconBtn(name, { label, onClick, cls = '' }) {
  return h('button', {
    class: `icon-btn ${cls}`.trim(), 'aria-label': label, title: label,
    onclick: () => { playSound('tap'); onClick?.(); }
  }, icon(name));
}

export function btn(label, { onClick, variant = '', cls = '', disabled = false, sound = 'paper-flip', ico = '' } = {}) {
  return h('button', {
    class: `btn ${variant} ${cls} ${ico ? 'btn--with-icon' : ''}`.trim(),
    disabled,
    onclick: (e) => { if (disabled) return; playSound(sound); onClick?.(e); }
  }, ico ? icon(ico, 16) : null, label);
}

export function sheet({ title, iconName, children, cls = '', tone = '' }) {
  return h('section', { class: `sheet ${cls} ${tone}`.trim() },
    title ? h('div', { class: 'sheet__title' }, iconName ? icon(iconName, 18) : null, title) : null,
    children
  );
}

/**
 * چیپ دسته‌بندی. با emblem، کاغذ جلد دسته پشت آن می‌آید و
 * نشان (glyph) هم کنار برچسب می‌نشیند تا هر دکمه معنی‌اش را
 * با متن و تصویر هر دو نشان دهد.
 */
export function chip(label, { pressed = false, onClick, glyph = '', emblem = '' } = {}) {
  return h('button', {
    class: `chip${emblem ? ' chip--emblem' : ''}`,
    'aria-pressed': pressed ? 'true' : 'false',
    ...(emblem ? { style: `--emblem:url('${emblem}')` } : {}),
    onclick: () => { playSound('tap'); onClick?.(); }
  },
    glyph ? h('span', { class: 'chip__glyph', 'aria-hidden': 'true' }, glyph) : null,
    h('span', { class: 'chip__label' }, label)
  );
}

export function topbar({ brand = 'دورهمی‌یار', right = [], onBack = null, title = null }) {
  return h('header', { class: 'topbar' },
    onBack ? iconBtn('back', { label: 'بازگشت', onClick: onBack }) : null,
    onBack
      ? h('div', { class: 'topbar__title', style: { fontWeight: 700, color: '#f7efdd', textShadow: '0 2px 6px rgba(0,0,0,.6)', fontSize: '1rem' } }, title || '')
      : h('div', { class: 'topbar__brand' }, h('div', { class: 'topbar__seal' }, 'د'), brand),
    h('div', { class: 'topbar__spacer' }),
    ...right
  );
}

/**
 * نوار پایین. هر بخش سه لایه دارد:
 *  ۱) نشان (icon) که در بخش فعال بزرگ‌تر و رنگی می‌شود
 *  ۲) عنوان نوشتاری
 *  ۳) خطِ نشانگر پایین که با انتخاب، از وسط باز می‌شود
 * این‌طور «کجای برنامه‌ای» بدون خواندن متن هم معلوم است.
 */
export function navbar({ items, active, onNavigate }) {
  return h('nav', { class: 'navbar', 'aria-label': 'ناوبری اصلی' },
    h('div', { class: 'navbar__inner' },
      ...items.map(it => {
        const on = active === it.id;
        return h('button', {
          class: `nav-item${on ? ' is-active' : ''}`,
          'aria-current': on ? 'page' : null,
          'aria-label': it.label,
          onclick: () => { playSound('tap'); onNavigate(it.id); }
        },
          h('span', { class: 'nav-item__glyph' }, icon(it.icon, 21)),
          h('span', { class: 'nav-item__label' }, it.label),
          h('span', { class: 'nav-item__mark', 'aria-hidden': 'true' })
        );
      })
    )
  );
}

/**
 * سرصفحه‌ی بازی. دکمه‌ی بازگشت همیشه هست: حتی اگر صفحه onBack نداشته باشد،
 * رویداد dy:back فرستاده می‌شود تا پوسته‌ی بازی آن را بگیرد (هیچ صفحه‌ای بدون راه برگشت نمی‌ماند).
 */
export function gameHeader({ title, onBack, children }) {
  const handleBack = () => {
    if (typeof onBack === 'function') return onBack();
    document.dispatchEvent(new CustomEvent('dy:back'));
  };
  return h('div', { class: 'game-shell__top' },
    h('button', {
      class: 'icon-btn icon-btn--back', 'aria-label': 'بازگشت به صفحه‌ی قبل', title: 'بازگشت',
      onclick: () => { playSound('paper-flip'); handleBack(); }
    }, icon('back'), h('span', { class: 'icon-btn__label' }, 'بازگشت')),
    h('div', { class: 'game-shell__title' }, title),
    h('div', { style: { flex: 1 } }),
    ...(children ? [children].flat() : [])
  );
}

export function scorePill(label, { active = false } = {}) {
  return h('span', { class: `score-pill ${active ? 'score-pill--active' : ''}`.trim() }, label);
}

export function callout(text, iconName = 'spark') {
  return h('div', { class: 'callout' }, icon(iconName, 18), h('div', {}, text));
}

export function helpBlock({ steps, example, note }) {
  return h('div', {},
    h('ol', { class: 'help-list' }, ...steps.map(s => h('li', {}, s))),
    example ? h('div', { class: 'help-example' }, example) : null,
    note ? callout(note, 'help') : null
  );
}

/** نمایش روی پوشش تمام‌صفحه */
export function overlay(node, { onDismiss = null } = {}) {
  const root = document.getElementById('modal-root');
  const wrap = h('div', {
    class: 'overlay',
    onclick: (e) => { if (e.target === e.currentTarget && onDismiss) { closeOverlay(); onDismiss(); } }
  }, node);
  root.replaceChildren(wrap);
  document.body.style.overflow = 'hidden';
  return wrap;
}
export function closeOverlay() {
  document.getElementById('modal-root').replaceChildren();
  document.body.style.overflow = '';
}

/** تصویر کاغذی هر سطح (سبک/آسانی) — برای کارت‌های انتخاب سختی */
export const LEVEL_ART = {
  easy: '/assets/art/cats/lvl-quick.jpg',
  normal: '/assets/art/cats/lvl-standard.jpg',
  hard: '/assets/art/cats/lvl-deep.jpg'
};
export const levelArt = (id) => LEVEL_ART[id] || '';

/**
 * نوار هنر بازی: تصویر کارت همان بازی را در سرصفحهٔ خودش می‌آورد
 * تا کارت انتخاب‌شده و داخل بازی یک هویت بصری باشند.
 */
export function artBanner(art, label = '') {
  if (!art) return null;
  return h('div', { class: 'game-art-banner', 'aria-hidden': 'true' },
    h('div', { class: 'game-art-banner__img', style: { backgroundImage: `url('${art}')` } }),
    h('div', { class: 'game-art-banner__wash' }),
    label ? h('div', { class: 'game-art-banner__label' }, label) : null
  );
}
