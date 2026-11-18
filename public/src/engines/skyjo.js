/* ============================================================
   «اسکایجو» — شبکهٔ ۳×۴ از کارت‌های پنهان
   هدف: کمترین امتیاز. ستون هم‌عدد پاک می‌شود.
   موتور خالص و آزمون‌پذیر؛ رقیب کامپیوتری دارد.
   ============================================================ */

import { mulberry32 } from '../core.js';

export const COLS = 4;
export const ROWS = 3;
export const SLOTS = COLS * ROWS;          // ۱۲ خانه
export const SKYJO_DECK = [-2, -1, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3,
  4, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6, 6, 7, 7, 7, 7, 8, 8, 8, 8,
  9, 9, 9, 9, 10, 10, 10, 10, 11, 11, 11, 11, 12, 12, 12];   // ۵۴ کارت
export const VISIBLE_AT_START = 2;
export const SKYJO_TARGET = 100;           // عبور از ۱۰۰ = پایان

export const cardName = (v) => (v === -2 ? '−۲' : v === -1 ? '−۱' : String(v));

export function buildDeck() {
  return SKYJO_DECK.map((value, i) => ({ id: `s${i}-${value}`, value }));
}

export function shuffle(arr, seed = 1) {
  const rnd = mulberry32((seed >>> 0) || 1);
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function createSkyjo({ players = 2, seed = Date.now() } = {}) {
  const count = Math.max(2, Math.min(4, players));
  const deck = shuffle(buildDeck(), seed);
  const grids = [];
  let cursor = 0;
  for (let p = 0; p < count; p++) {
    const cards = [];
    for (let i = 0; i < SLOTS; i++) cards.push({ ...deck[cursor++], faceUp: false });
    // دو کارت اول هر بازیکن رو
    cards[0].faceUp = true;
    cards[1].faceUp = true;
    grids.push(cards);
  }
  const first = deck[cursor++];
  return {
    seed, playerCount: count, deck: deck.slice(cursor),
    names: Array.from({ length: count }, (_, i) => (i === 0 ? 'تو' : `رقیب ${i}`)),
    grids,
    discard: [first],
    turn: 0,
    phase: 'take',            // take | replace | reveal | over
    held: null,               // کارت برداشته‌شدهٔ دست
    opened: Array(count).fill(0),
    round: 1,
    scores: Array(count).fill(0),
    winner: null,
    log: ['اسکایجو — کمترین امتیاز برنده است']
  };
}

export const topDiscard = (g) => g.discard[g.discard.length - 1];
export const skyjoOver = (g) => g.winner !== null;

/** ارزش ستون اگر همه رو باشند */
export function columnValues(grid, col) {
  return [0, 1, 2].map(r => grid[r * COLS + col]);
}

/** گل‌کاری ستون: هر سه کارت هم‌عدد → حذف */
export function columnCleared(grid, col) {
  const v = columnValues(grid, col);
  if (!v.every(c => c && c.faceUp)) return false;
  return v[0].value === v[1].value && v[1].value === v[2].value;
}

export function gridScore(grid) {
  let total = 0;
  for (let c = 0; c < COLS; c++) {
    if (columnCleared(grid, c)) continue;
    for (const card of columnValues(grid, c)) if (card.faceUp) total += card.value;
  }
  return total;
}

/** برداشتن کارت روی زمین */
export function takeDiscard(g) {
  if (g.phase !== 'take') return { ok: false, error: 'الان نمی‌شود کارت برداشت', game: g };
  if (!g.discard.length) return { ok: false, error: 'زمین خالی است', game: g };
  const card = topDiscard(g);
  return {
    ok: true,
    game: { ...g, discard: g.discard.slice(0, -1), held: card, phase: 'replace' },
    card
  };
}

/** برداشتن از انبار (پنهان) — یا نگه می‌داری یا دور می‌ریزی */
export function drawHidden(g) {
  if (g.phase !== 'take') return { ok: false, error: 'الان نمی‌شود کارت برداشت', game: g };
  if (!g.deck.length) return { ok: false, error: 'انبار خالی است', game: g };
  const card = g.deck[0];
  return {
    ok: true,
    game: { ...g, deck: g.deck.slice(1), held: card, phase: 'replace' },
    card
  };
}

/** گذاشتن کارت دست روی خانه — کارت قبلی به زمین می‌رود */
export function placeCard(g, index) {
  if (g.phase !== 'replace' || !g.held) return { ok: false, error: 'کارتی در دست نیست', game: g };
  if (index < 0 || index >= SLOTS) return { ok: false, error: 'خانهٔ نامعتبر', game: g };
  const seat = g.turn;
  const grid = g.grids[seat].map(c => ({ ...c }));
  const old = { ...grid[index], faceUp: true };
  grid[index] = { ...g.held, faceUp: true };
  const grids = g.grids.map((gr, i) => (i === seat ? grid : gr));

  let next = {
    ...g, grids,
    discard: [...g.discard, old],
    held: null,
    opened: g.opened.map((n, i) => (i === seat ? n + 1 : n)),
    log: [...g.log, `${g.names[seat]} ${cardName(g.held.value)} را گذاشت`]
  };
  if (columnCleared(grid, index % COLS)) {
    next = { ...next, log: [...next.log, `ستون ${(index % COLS) + 1} پاک شد!`] };
  }
  return { ok: true, game: advance(next), cleared: columnCleared(grid, index % COLS) };
}

/** دور ریختن کارت برداشته‌شده — باید یک کارت پنهان خودت را رو کنی */
export function discardHeld(g, index) {
  if (g.phase !== 'replace' || !g.held) return { ok: false, error: 'کارتی در دست نیست', game: g };
  if (index < 0 || index >= SLOTS) return { ok: false, error: 'خانهٔ نامعتبر', game: g };
  const seat = g.turn;
  const grid = g.grids[seat].map(c => ({ ...c }));
  if (grid[index].faceUp) return { ok: false, error: 'این خانه از قبل رو است', game: g };
  grid[index] = { ...grid[index], faceUp: true };
  const grids = g.grids.map((gr, i) => (i === seat ? grid : gr));
  const next = {
    ...g, grids,
    discard: [...g.discard, g.held],
    held: null,
    opened: g.opened.map((n, i) => (i === seat ? n + 1 : n)),
    log: [...g.log, `${g.names[seat]} کارت را دور ریخت و یکی را رو کرد`]
  };
  return { ok: true, game: advance(next) };
}

/** پایان نوبت: اگر همهٔ کارت‌ها رو شدند، دور بسته می‌شود */
function advance(g) {
  const seat = g.turn;
  const grid = g.grids[seat];
  const allUp = grid.every(c => c.faceUp);
  const nextTurn = (seat + 1) % g.playerCount;
  if (allUp) {
    // دست را جمع می‌کنیم
    const scores = g.scores.map((s, i) => s + gridScore(g.grids[i]));
    const closing = g.opened[seat];
    // جریمهٔ بسته‌شدن: اگر کسی امتیازش کمتر یا مساوی تو باشد، امتیازت دو برابر می‌شود
    const finalScores = scores.slice();
    const mine = scores[seat];
    if (scores.some((s, i) => i !== seat && s <= mine)) finalScores[seat] = mine * 2;
    const reached = finalScores.some(s => s >= SKYJO_TARGET);
    const winner = finalScores.indexOf(Math.min(...finalScores));
    return {
      ...g,
      scores: finalScores,
      phase: reached ? 'over' : 'take',
      turn: reached ? seat : nextTurn,
      winner: reached ? winner : null,
      log: [...g.log, `دور ${g.round} بسته شد — ${g.names[seat]} ${closing} کارت رو کرد`]
    };
  }
  return { ...g, phase: 'take', turn: nextTurn };
}

export function skyjoBot(g, seat) {
  const top = topDiscard(g);
  const grid = g.grids[seat];
  const hidden = grid.map((c, i) => ({ c, i })).filter(x => !x.c.faceUp);
  const worst = grid.map((c, i) => ({ v: c.faceUp ? c.value : 0, i })).sort((a, b) => b.v - a.v)[0];

  // کارت روی زمین اگر کم‌ارزش است، بردار
  if (top && top.value <= 3 && hidden.length) {
    const target = hidden.sort((a, b) => a.i - b.i)[0].i;
    return { action: 'take', index: target };
  }
  // وگرنه از انبار بردار و اگر کارت خوب بود نگه دار
  return { action: 'draw' };
}

export const RULES = {
  steps: [
    'هر بازیکن ۱۲ کارت در شبکهٔ ۳×۴ دارد؛ همه پنهان‌اند جز دو کارت.',
    'در نوبتت می‌توانی کارت روی زمین را برداری یا از انبار پنهان بکشی.',
    'کارت را با یکی از کارت‌هایت عوض کن — کارت قبلی روی زمین می‌رود.',
    'یا کارت برداشته‌شده را دور بریز و یک کارت پنهان خودت را رو کن.',
    'اگر سه کارت یک ستون هم‌عدد و رو باشند، آن ستون پاک می‌شود.',
    'وقتی همهٔ کارت‌هایت رو شدند، دور بسته می‌شود. کمترین امتیاز برنده است.'
  ],
  example: 'کارت‌های رو تو ۷ و ۹ هستند. کارت ۲ روی زمین است — بردار و ۹ را عوض کن. ستون ۷،۷,۷ پاک می‌شود.',
  note: 'عبور از ۱۰۰ امتیاز بازی را تمام می‌کند.'
};
