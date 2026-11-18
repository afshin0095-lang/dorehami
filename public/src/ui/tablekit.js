/* ============================================================
   ابزار میز — اجزای مشترک بازی‌های ورق و تاس
   هدف: هر بازی حس یک میز کاغذی واقعی بدهد، نه فرم وب.
   ============================================================ */

import { h } from '../core.js';

/* ------------------------------ کارت‌های دست ------------------------------ */

/**
 * کارت روی میز، با امکان انتخاب و غیرفعال‌کردن.
 * بازی‌های ورق از همین استفاده می‌کنند تا ظاهر یکدست باشد.
 */
export function handCard(card, { playable = true, selected = false, facedown = false, label = '', onClick = null } = {}) {
  const face = facedown
    ? h('div', { class: 'tbl-card__face tbl-card__face--back', 'aria-hidden': 'true' },
        h('span', { class: 'tbl-card__monogram' }, 'د'))
    : h('div', { class: 'tbl-card__face' },
        h('span', { class: 'tbl-card__corner tbl-card__corner--tl' }, label || ''),
        h('span', { class: 'tbl-card__pip', 'aria-hidden': 'true' }, cardGlyph(card)),
        h('span', { class: 'tbl-card__corner tbl-card__corner--br' }, label || '')
      );

  const node = h('button', {
    class: `tbl-card${playable ? ' is-playable' : ' is-blocked'}${selected ? ' is-selected' : ''}`,
    'aria-label': label || 'کارت',
    disabled: !playable || !onClick,
    onclick: onClick ? (e) => { e?.preventDefault?.(); onClick(); } : null
  }, face);
  return node;
}

/** نماد ساده روی کارت (بدون تصویر) */
export function cardGlyph(card) {
  if (!card) return '';
  const SUIT = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' };
  const RANK = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
  const rank = RANK[card.rank] || String(card.rank);
  return card.suit ? `${rank}${SUIT[card.suit] || ''}` : rank;
}

/* ------------------------------ تاس ------------------------------ */

const PIPS = {
  1: [[50, 50]],
  2: [[28, 28], [72, 72]],
  3: [[28, 28], [50, 50], [72, 72]],
  4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
  6: [[28, 25], [72, 25], [28, 50], [72, 50], [28, 75], [72, 75]]
};

/**
 * یک تاس کاغذی-چوبی. چشم‌ها نقطه‌اند، نه عدد — مثل تاس واقعی.
 */
export function die(value, { held = false, onClick = null, label = '', size = 'normal' } = {}) {
  const pips = PIPS[value] || [];
  const node = h('button', {
    class: `die${held ? ' is-held' : ''}${value ? '' : ' is-blank'} die--${size}`,
    'aria-label': label || (value ? `تاس ${value}` : 'تاس'),
    disabled: !onClick,
    onclick: onClick ? (e) => { e?.preventDefault?.(); onClick(); } : null
  },
    value
      ? pips.map(([x, y]) => h('span', { class: 'die__pip', style: `left:${x}%;top:${y}%` }))
      : h('span', { class: 'die__blank', 'aria-hidden': 'true' }, '·')
  );
  return node;
}

/* ------------------------------ نشانگر نوبت ------------------------------ */

export function turnBanner(text, { tone = 'mine' } = {}) {
  return h('div', { class: `tbl-turn tbl-turn--${tone}`, role: 'status' },
    h('span', { class: 'tbl-turn__dot', 'aria-hidden': 'true' }),
    h('span', { class: 'tbl-turn__text' }, text)
  );
}

/** ردیف بازیکنان با تعداد کارت/امتیاز */
export function seatStrip(seats) {
  return h('div', { class: 'tbl-seats' },
    ...seats.map(s => h('div', {
      class: `tbl-seat-chip${s.active ? ' is-active' : ''}${s.mine ? ' is-mine' : ''}`
    },
      h('span', { class: 'tbl-seat-chip__name' }, s.name),
      s.meta ? h('span', { class: 'tbl-seat-chip__meta' }, s.meta) : null
    ))
  );
}

/** انبار کارت (دستهٔ برداشت) */
export function drawPile(count, { onClick = null, label = 'برداشت' } = {}) {
  return h('button', {
    class: 'tbl-pile',
    'aria-label': `${label} — ${count} کارت`,
    disabled: !onClick || count <= 0,
    onclick: onClick ? (e) => { e?.preventDefault?.(); onClick(); } : null
  },
    h('span', { class: 'tbl-pile__stack', 'aria-hidden': 'true' }),
    h('span', { class: 'tbl-pile__count' }, String(count))
  );
}

/** پیام کوتاه روی میز */
export function tableNote(text, { tone = 'info' } = {}) {
  if (!text) return null;
  return h('div', { class: `tbl-note tbl-note--${tone}`, role: 'status' },
    h('span', { class: 'tbl-note__glyph', 'aria-hidden': 'true' }, tone === 'bad' ? '✕' : '✓'),
    h('span', {}, text));
}

export const SUIT_GLYPH = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' };
export const SUIT_IS_RED = { spades: false, hearts: true, diamonds: true, clubs: false };
