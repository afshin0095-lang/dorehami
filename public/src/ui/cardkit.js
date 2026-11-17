/* ============================================================
   ورق بازی مشترک — یک نمایش، همه‌ی بازی‌های کارتی
   حروف و اعداد لاتین با فونت گوتیک، چیدمان واقعی ورق:
   شاخص گوشه + خال، تصویر نقاشی‌شده برای شاه/ملکه/سرباز،
   طرح بزرگ برای آس، و چیدمان نقطه‌ای برای کارت‌های عددی.
   ============================================================ */

import { h } from '../core.js';

/** نام لاتین رتبه — همان چیزی که روی ورق واقعی چاپ می‌شود */
export const RANK_LATIN = { 2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: '10', 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
export const RANK_FA = { 11: 'سرباز', 12: 'ملکه', 13: 'شاه', 14: 'آس' };

/** خال‌ها: نام، نماد، و رنگ */
export const SUITS = {
  hearts:   { glyph: '♥', red: true,  fa: 'دل',  latin: 'H' },
  diamonds: { glyph: '♦', red: true,  fa: 'خشت', latin: 'D' },
  clubs:    { glyph: '♣', red: false, fa: 'گشنیز', latin: 'C' },
  spades:   { glyph: '♠', red: false, fa: 'پیک', latin: 'S' },
  // خال‌های بازی حکم ایرانی
  sorkh:    { glyph: '♥', red: true,  fa: 'سرخ', latin: 'H' },
  khaj:     { glyph: '♦', red: true,  fa: 'خاج', latin: 'D' },
  ghashn:   { glyph: '♣', red: false, fa: 'گشنیز', latin: 'C' },
  pike:     { glyph: '♠', red: false, fa: 'پیک', latin: 'S' }
};

export const suitOf = (suit) => SUITS[suit] || SUITS.spades;

/** تصویر نقاشی‌شده برای کارت‌های عکس‌دار */
export function courtArt(suit, rank) {
  if (rank < 11 || rank > 13) return null;
  const red = suitOf(suit).red;
  const name = rank === 11 ? 'jack' : rank === 12 ? 'queen' : 'king';
  return `/assets/art/cards/${name}-${red ? 'red' : 'black'}.jpg`;
}

/**
 * چیدمان نقطه‌ای کارت‌های عددی (مثل ورق واقعی).
 * هر نقطه: ستون و سطر در یک شبکه‌ی ۳×۵ با موقعیت درصدی.
 */
const PIP_LAYOUT = {
  2: [[50, 18], [50, 82]],
  3: [[50, 18], [50, 50], [50, 82]],
  4: [[30, 18], [70, 18], [30, 82], [70, 82]],
  5: [[30, 18], [70, 18], [50, 50], [30, 82], [70, 82]],
  6: [[30, 18], [70, 18], [30, 50], [70, 50], [30, 82], [70, 82]],
  7: [[30, 18], [70, 18], [50, 34], [30, 50], [70, 50], [30, 82], [70, 82]],
  8: [[30, 18], [70, 18], [50, 34], [30, 50], [70, 50], [50, 66], [30, 82], [70, 82]],
  9: [[30, 15], [70, 15], [30, 39], [70, 39], [50, 50], [30, 61], [70, 61], [30, 85], [70, 85]],
  10: [[30, 13], [70, 13], [50, 26], [30, 39], [70, 39], [30, 61], [70, 61], [50, 74], [30, 87], [70, 87]]
};

const CORNER = (rank, suit) => {
  const s = suitOf(suit);
  return h('div', { class: 'pcard__corner', style: { color: s.red ? 'var(--card-red)' : 'var(--card-black)' } },
    h('span', { class: 'pcard__rank' }, RANK_LATIN[rank] || String(rank)),
    h('span', { class: 'pcard__suit' }, s.glyph)
  );
};

/**
 * ساخت یک ورق بازی.
 * @param {{suit:string, rank:number}} card
 * @param {{compact?:boolean, facedown?:boolean, lift?:number, rot?:number, cls?:string}} opts
 */
export function playingCard(card, opts = {}) {
  const { compact = false, facedown = false, cls = '' } = opts;

  if (facedown) {
    return h('div', { class: `pcard pcard--back ${compact ? 'pcard--compact' : ''} ${cls}`.trim(), 'aria-label': 'ورق رو‌برگردان' },
      h('div', { class: 'pcard__face pcard__face--back' },
        h('span', { class: 'pcard__monogram' }, 'د')
      )
    );
  }

  const { suit, rank } = card;
  const s = suitOf(suit);
  const art = courtArt(suit, rank);
  const tone = s.red ? 'is-red' : 'is-black';

  return h('div', {
    class: `pcard ${tone} ${compact ? 'pcard--compact' : ''} ${cls}`.trim(),
    'aria-label': `${RANK_LATIN[rank]} ${s.fa}`,
    dataset: { suit, rank: String(rank) }
  },
    h('div', { class: 'pcard__face' },
      CORNER(rank, suit),

      art
        ? h('div', { class: 'pcard__art', style: { backgroundImage: `url(${art})` }, 'aria-hidden': 'true' })
        : rank === 14
          /* آس: طرح بزرگ تزئینی، مثل ورق واقعی ولی گوتیک */
          ? h('div', { class: 'pcard__ace' },
              h('div', { class: 'pcard__ace-ornament' }),
              h('span', { class: 'pcard__ace-suit' }, s.glyph),
              h('div', { class: 'pcard__ace-ornament pcard__ace-ornament--low' })
            )
          /* کارت عددی: چیدمان نقطه‌ای واقعی */
          : h('div', { class: 'pcard__pips' },
              ...(PIP_LAYOUT[rank] || [[50, 50]]).map(([x, y]) =>
                h('span', { class: 'pcard__pip', style: { left: `${x}%`, top: `${y}%` } }, s.glyph)
              )
            ),

      h('div', { class: 'pcard__corner pcard__corner--br', style: { color: s.red ? 'var(--card-red)' : 'var(--card-black)' } },
        h('span', { class: 'pcard__rank' }, RANK_LATIN[rank] || String(rank)),
        h('span', { class: 'pcard__suit' }, s.glyph)
      )
    )
  );
}

/** پشت ورق، به‌صورت مستقل (برای انیمیشن) */
export function cardBack(cls = '') {
  return h('div', { class: `pcard pcard--back ${cls}`.trim(), 'aria-label': 'پشت ورق' },
    h('div', { class: 'pcard__face pcard__face--back' }, h('span', { class: 'pcard__monogram' }, 'د'))
  );
}
