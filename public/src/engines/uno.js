/* ============================================================
   «اونو» — موتور خالص
   رنگ‌ها و شماره‌ها؛ کارت‌های اکشن: +۲، تغییر جهت، پرش،
   و کارت وحشی (تغییر رنگ / +۴).
   ============================================================ */

import { mulberry32 } from '../core.js';

const FA_DIGIT = '۰۱۲۳۴۵۶۷۸۹';
const toFa = v => String(v ?? '').replace(/[0-9]/g, d => FA_DIGIT[+d]);

export const COLORS = [
  { id: 'red', label: 'سرخ', hex: '#a33d2c' },
  { id: 'yellow', label: 'زرین', hex: '#b0801f' },
  { id: 'green', label: 'سبز', hex: '#2f6f68' },
  { id: 'blue', label: 'نیلی', hex: '#33507a' }
];
export const COLOR_LABEL = Object.fromEntries(COLORS.map(c => [c.id, c.label]));

/** کارت‌ها: عدد ۰..۹ (۰ و ۱..۹)، و اکشن‌ها */
export const ACTIONS = ['skip', 'reverse', 'draw2', 'wild', 'wild4'];
export const START_HAND = 7;

const id = (color, face) => `${color}-${face}`;

/** دستهٔ کامل اونو: ۱۰۸ کارت */
export function fullDeck() {
  const deck = [];
  for (const c of COLORS) {
    deck.push({ id: id(c.id, 0), color: c.id, face: '0', kind: 'num', value: 0 });
    for (let n = 1; n <= 9; n++) {
      for (let k = 0; k < 2; k++) {
        deck.push({ id: id(c.id, n) + (k ? 'b' : 'a'), color: c.id, face: String(n), kind: 'num', value: n });
      }
    }
    for (const a of ['skip', 'reverse', 'draw2']) {
      for (let k = 0; k < 2; k++) {
        deck.push({ id: id(c.id, a) + (k ? 'b' : 'a'), color: c.id, face: a, kind: 'action', value: null });
      }
    }
  }
  for (let k = 0; k < 4; k++) {
    deck.push({ id: `wild-wild-${k}`, color: null, face: 'wild', kind: 'wild', value: null });
    deck.push({ id: `wild-wild4-${k}`, color: null, face: 'wild4', kind: 'wild', value: null });
  }
  return deck;
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

/** آیا این کارت روی کارت روی زمین می‌نشیند؟ */
export function canPlay(card, top, currentColor) {
  if (!card) return false;
  if (card.kind === 'wild') return true;
  if (card.color === currentColor) return true;
  if (top && card.kind === 'num' && top.kind === 'num' && card.value === top.value) return true;
  if (top && card.kind === 'action' && top.kind === 'action' && card.face === top.face) return true;
  return false;
}

export function playableCards(hand, top, currentColor) {
  return hand.filter(c => canPlay(c, top, currentColor));
}

/**
 * بازی تازه. بازیکن ۰ انسان است.
 */
export function createUno({ players = 2, seed = Date.now(), names = null } = {}) {
  const count = Math.max(2, Math.min(4, players));
  const deck = shuffle(fullDeck(), seed);
  const hands = [];
  for (let i = 0; i < count; i++) hands.push(deck.splice(0, START_HAND));

  // کارت شروع نباید وحشی یا اکشن باشد
  let startIdx = deck.findIndex(c => c.kind === 'num');
  if (startIdx < 0) startIdx = 0;
  const [start] = deck.splice(startIdx, 1);

  return {
    seed,
    playerCount: count,
    names: names || Array.from({ length: count }, (_, i) => (i === 0 ? 'تو' : `رقیب ${i}`)),
    hands,
    deck,
    discard: [start],
    currentColor: start.color,
    turn: 0,
    direction: 1,              // ۱ ساعتگرد، −۱ پادساعتگرد
    pendingDraw: 0,            // کارت‌های جریمهٔ انبارشده
    mustChooseColor: false,    // منتظر انتخاب رنگ
    winner: null,
    log: [`بازی با ${count} نفر شروع شد`]
  };
}

export const topCard = (g) => g.discard[g.discard.length - 1];

/** برداشتن از دسته؛ اگر تمام شد، زمین را دوباره بُر می‌زند */
export function drawCards(g, n = 1) {
  let deck = [...g.deck];
  let discard = [...g.discard];
  const out = [];
  for (let i = 0; i < n; i++) {
    if (!deck.length) {
      if (discard.length <= 1) break;              // هیچ کارتی نمانده
      const top = discard[discard.length - 1];
      deck = shuffle(discard.slice(0, -1), (g.seed ^ (out.length + 7)) >>> 0);
      discard = [top];
    }
    out.push(deck.shift());
  }
  return { cards: out, deck, discard };
}

function nextSeat(g, from = g.turn, step = 1) {
  const n = g.playerCount;
  return ((from + g.direction * step) % n + n) % n;
}

/**
 * بازی یک کارت توسط بازیکن.
 * @returns {{ok:boolean, error?:string, game?:object, events?:string[]}}
 */
export function playUno(g, seat, cardId, chosenColor = null) {
  if (g.winner !== null) return { ok: false, error: 'بازی تمام شده', game: g };
  if (seat !== g.turn) return { ok: false, error: 'نوبت تو نیست', game: g };
  if (g.mustChooseColor) return { ok: false, error: 'اول رنگ را انتخاب کن', game: g };

  const hand = g.hands[seat];
  const card = hand.find(c => c.id === cardId);
  if (!card) return { ok: false, error: 'این کارت در دست تو نیست', game: g };

  const top = topCard(g);
  if (!canPlay(card, top, g.currentColor)) {
    return { ok: false, error: 'این کارت روی کارت روی زمین نمی‌نشیند', game: g };
  }
  if (card.kind === 'wild' && !chosenColor) {
    return { ok: false, error: 'برای کارت وحشی، رنگ را انتخاب کن', game: g };
  }

  const hands = g.hands.map((h, i) => (i === seat ? h.filter(c => c.id !== cardId) : h));
  const events = [`${g.names[seat]}: ${cardName(card)}`];
  let next = {
    ...g,
    hands,
    discard: [...g.discard, card],
    currentColor: card.kind === 'wild' ? chosenColor : card.color,
    log: [...g.log, `${g.names[seat]} ${cardName(card)} بازی کرد`]
  };

  // برد؟
  if (hands[seat].length === 0) {
    return { ok: true, game: { ...next, winner: seat }, events: [...events, 'دست خالی شد!'] };
  }

  // اثر کارت اکشن
  let drawnResult = null;
  switch (card.face) {
    case 'skip':
      next.turn = nextSeat(next, seat, 2);
      events.push(`${g.names[nextSeat(next, seat, 1)]} نوبت را از دست داد`);
      break;
    case 'reverse':
      if (next.playerCount === 2) {
        next.turn = nextSeat(next, seat, 2);   // با دو نفر، مثل پرش
        events.push('جهت برگشت — نوبت دوباره به تو');
      } else {
        next.direction = -next.direction;
        next.turn = nextSeat(next, seat, 1);
        events.push('جهت عوض شد');
      }
      break;
    case 'draw2':
      drawnResult = drawCards(next, 2);
      next = { ...next, deck: drawnResult.deck, discard: drawnResult.discard };
      next.hands = next.hands.map((h, i) =>
        i === nextSeat(next, seat, 1) ? [...h, ...drawnResult.cards] : h);
      next.turn = nextSeat(next, seat, 2);
      events.push(`${g.names[nextSeat(next, seat, 1)]} دو کارت جریمه گرفت`);
      break;
    case 'wild4':
      drawnResult = drawCards(next, 4);
      next = { ...next, deck: drawnResult.deck, discard: drawnResult.discard };
      next.hands = next.hands.map((h, i) =>
        i === nextSeat(next, seat, 1) ? [...h, ...drawnResult.cards] : h);
      next.turn = nextSeat(next, seat, 2);
      events.push(`${g.names[nextSeat(next, seat, 1)]} چهار کارت جریمه گرفت`);
      break;
    case 'wild':
      next.turn = nextSeat(next, seat, 1);
      events.push(`رنگ به ${COLOR_LABEL[chosenColor]} تغییر کرد`);
      break;
    default:
      next.turn = nextSeat(next, seat, 1);
  }

  return { ok: true, game: next, events };
}

export function cardName(card) {
  if (card.kind === 'wild') return card.face === 'wild4' ? 'وحشی +۴' : 'وحشی';
  const color = COLOR_LABEL[card.color] || '';
  if (card.kind === 'num') return `${color} ${toFa(card.face)}`;
  const label = { skip: 'پرش', reverse: 'برگشت', draw2: '+۲' }[card.face] || card.face;
  return `${color} ${label}`;
}

/** برداشتن کارت برای بازیکن نوبت‌دار (اگر کارت مجاز نداشت) */
export function drawForTurn(g) {
  if (g.winner !== null) return { ok: false, error: 'بازی تمام شده', game: g };
  const seat = g.turn;
  const r = drawCards(g, 1);
  if (!r.cards.length) return { ok: false, error: 'کارتی برای برداشتن نمانده', game: g };
  const hands = g.hands.map((h, i) => (i === seat ? [...h, ...r.cards] : h));
  return {
    ok: true,
    game: {
      ...g,
      hands,
      deck: r.deck,
      discard: r.discard,
      turn: nextSeat(g, seat, 1),
      log: [...g.log, `${g.names[seat]} یک کارت برداشت`]
    },
    card: r.cards[0]
  };
}

/** انتخاب سادهٔ هوش مصنوعی: کارت رنگ جاری، وگرنه +۲، وگرنه وحشی */
export function botChoice(g, seat) {
  const hand = g.hands[seat];
  const top = topCard(g);
  const legal = playableCards(hand, top, g.currentColor);
  if (!legal.length) return { action: 'draw' };

  // اولویت: کم‌کردن دست با کارت اکشن رنگی، بعد عدد، آخر وحشی
  const rank = (c) => (c.kind === 'wild' ? 30 : c.kind === 'action' ? 0 : 10 + c.value);
  const best = legal.sort((a, b) => rank(a) - rank(b))[0];
  const chosenColor = best.kind === 'wild' ? mostCommonColor(hand) : null;
  return { action: 'play', cardId: best.id, color: chosenColor };
}

function mostCommonColor(hand) {
  const tally = {};
  for (const c of hand) if (c.color) tally[c.color] = (tally[c.color] || 0) + 1;
  const best = Object.entries(tally).sort((a, b) => b[1] - a[1])[0];
  return best ? best[0] : 'red';
}

export const handCount = (g, seat) => g.hands[seat].length;
export const isOver = (g) => g.winner !== null;

export const RULES = {
  steps: [
    'هر بازیکن ۷ کارت می‌گیرد؛ یک کارت روی زمین می‌نشیند.',
    'کارتی بازی کن که هم‌رنگ کارت روی زمین باشد، یا هم‌شمارهٔ آن.',
    'کارت‌های اکشن: پرش (نوبت بعدی را رد می‌کند)، برگشت (جهت را عوض می‌کند)، +۲ (دو کارت جریمه).',
    'کارت وحشی رنگ را عوض می‌کند؛ وحشی +۴ چهار کارت جریمه می‌دهد و رنگ را هم عوض می‌کند.',
    'اگر کارت مجاز نداشتی، یک کارت بردار و نوبت را رد کن.',
    'هر کس دستش خالی شود، برنده است.'
  ],
  example: 'روی زمین «سرخ ۷» است. می‌توانی هر کارت سرخ، یا هر ۷ از رنگ دیگر، یا کارت وحشی بازی کنی.',
  note: 'این نسخه با دو تا چهار بازیکن و رقیب کامپیوتری بازی می‌شود.'
};
