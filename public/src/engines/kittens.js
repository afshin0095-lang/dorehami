/* ============================================================
   «بچه گربه‌های منفجر شونده»
   از دسته بکش — اگر گربهٔ منفجرشونده بیاید و «خنثی» نداشته باشی، بیرون می‌روی.
   ============================================================ */

import { mulberry32 } from '../core.js';

export const KITTEN_KINDS = [
  { id: 'defuse', label: 'خنثی‌کننده', glyph: '✚', tone: 'good', count: 6,
    text: 'گربهٔ منفجرشونده را خنثی کن و بی‌سر‌و‌صدا در دسته بگذار.' },
  { id: 'skip', label: 'رد کردن', glyph: '↷', tone: 'move', count: 4,
    text: 'بدون کشیدن کارت، نوبت را رد کن.' },
  { id: 'attack', label: 'حمله', glyph: '⚔', tone: 'bad', count: 4,
    text: 'نوبت بعدی را به بازیکن بعدی بده؛ او دو بار می‌کشد.' },
  { id: 'favor', label: 'خواهش', glyph: '✦', tone: 'move', count: 4,
    text: 'از یک بازیکن بخواه یک کارت به تو بدهد.' },
  { id: 'shuffle', label: 'به‌هم‌ریختن', glyph: '⤨', tone: 'move', count: 4,
    text: 'دسته را بی‌نگاه به‌هم بریز.' },
  { id: 'see', label: 'دیدن آینده', glyph: '◉', tone: 'move', count: 5,
    text: 'سه کارت بالای دسته را ببین.' },
  { id: 'nope', label: 'نه!', glyph: '⊘', tone: 'bad', count: 5,
    text: 'کارت آخر حریف را لغو کن — حتی بیرون از نوبت.' },
  { id: 'cat1', label: 'گربهٔ کاغذی', glyph: '❦', tone: 'cat', count: 4, pair: true },
  { id: 'cat2', label: 'گربهٔ ماه', glyph: '☾', tone: 'cat', count: 4, pair: true },
  { id: 'cat3', label: 'گربهٔ چای', glyph: '☕', tone: 'cat', count: 4, pair: true },
  { id: 'cat4', label: 'گربهٔ ریش‌دار', glyph: '⚓', tone: 'cat', count: 4, pair: true }
];

export const KIND = Object.fromEntries(KITTEN_KINDS.map(k => [k.id, k]));
export const START_HAND = 5;
export const KITTEN = 'kitten';           // گربهٔ منفجرشونده

export function buildDeck() {
  const out = [];
  for (const k of KITTEN_KINDS) {
    for (let i = 0; i < k.count; i++) out.push({ id: `${k.id}-${i}`, kind: k.id });
  }
  return out;
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

export function createKittens({ players = 3, seed = Date.now() } = {}) {
  const count = Math.max(2, Math.min(5, players));
  let pool = shuffle(buildDeck(), seed);
  const hands = [];
  for (let p = 0; p < count; p++) {
    const hand = [];
    const di = pool.findIndex(c => c.kind === 'defuse');
    if (di >= 0) hand.push(pool.splice(di, 1)[0]);
    for (let i = 0; i < START_HAND - 1; i++) hand.push(pool.splice(0, 1)[0]);
    hands.push(hand);
  }
  // گربه‌های منفجرشونده: یکی کمتر از تعداد بازیکن
  const kittens = Array.from({ length: count - 1 }, (_, i) => ({ id: `kitten-${i}`, kind: KITTEN }));
  let deck = shuffle([...pool, ...kittens], (seed ^ 0x9e3779b9) >>> 0);

  return {
    seed, playerCount: count,
    names: Array.from({ length: count }, (_, i) => (i === 0 ? 'تو' : `رقیب ${i}`)),
    hands, deck,
    alive: Array(count).fill(true),
    eliminated: [],
    turn: 0,
    phase: 'play',             // play | over
    turnsFor: 1,               // نوبت‌های باقی‌ماندهٔ بازیکن فعلی (حمله = ۲)
    peek: null,                // سه کارت آینده
    lastAction: null,          // برای «نه!»
    winner: null,
    log: ['بچه گربه‌ها — از دسته بکش، امیدوار باش']
  };
}

export const kittensOver = (g) => g.phase === 'over';
export const handOf = (g, seat) => g.hands[seat] || [];
export const hasKind = (g, seat, kind) => handOf(g, seat).some(c => c.kind === kind);

function nextAlive(g, seat) {
  for (let s = 1; s <= g.playerCount; s++) {
    const n = (seat + s) % g.playerCount;
    if (g.alive[n]) return n;
  }
  return seat;
}

function removeFromHand(hands, seat, ids) {
  const out = hands.map(h => h.slice());
  for (const id of ids) {
    const i = out[seat].findIndex(c => c.id === id);
    if (i >= 0) out[seat].splice(i, 1);
  }
  return out;
}

const checkWin = (g) => {
  const alive = g.alive.filter(Boolean).length;
  if (alive <= 1) {
    const w = g.alive.indexOf(true);
    return { ...g, phase: 'over', winner: w, log: [...g.log, `${g.names[w]} آخرین بازمانده است`] };
  }
  return g;
};

/** بازی کردن یک کارت اکشن */
export function playCard(g, seat, cardId, opts = {}) {
  if (g.phase === 'over') return { ok: false, error: 'بازی تمام شده', game: g };
  if (seat !== g.turn) return { ok: false, error: 'نوبت تو نیست', game: g };
  const card = handOf(g, seat).find(c => c.id === cardId);
  if (!card) return { ok: false, error: 'این کارت در دستت نیست', game: g };
  if (card.kind === 'defuse') return { ok: false, error: 'خنثی‌کننده فقط برای گربهٔ منفجرشونده است', game: g };

  const hands = removeFromHand(g.hands, seat, [cardId]);
  let next = { ...g, hands, lastAction: { kind: card.kind, seat, cardId } };
  let events = [`${g.names[seat]}: ${KIND[card.kind].label}`];

  switch (card.kind) {
    case 'skip':
      next = endTurn(next, { skipDraw: true });
      break;
    case 'attack':
      next = { ...next, turn: nextAlive(next, seat), turnsFor: 2 };
      events.push(`${g.names[next.turn]} دو بار می‌کشد`);
      break;
    case 'see':
      next = { ...next, peek: next.deck.slice(0, 3) };
      events.push('سه کارت آینده دیده شد');
      break;
    case 'shuffle':
      next = { ...next, deck: shuffle(next.deck, (next.seed ^ (next.deck.length * 31)) >>> 0), peek: null };
      events.push('دسته به‌هم ریخت');
      break;
    case 'favor': {
      const target = opts.target ?? nextAlive(next, seat);
      if (!next.alive[target]) return { ok: false, error: 'هدف معتبر نیست', game: g };
      const pool = next.hands[target];
      if (!pool.length) return { ok: false, error: 'آن بازیکن کارتی ندارد', game: g };
      const picked = pool[Math.floor(mulberry32((next.seed ^ (pool.length * 977)) >>> 0)() * pool.length)];
      const h = next.hands.map(x => x.slice());
      h[target] = h[target].filter(c => c.id !== picked.id);
      h[seat] = [...h[seat], picked];
      next = { ...next, hands: h };
      events.push(`${g.names[target]} یک کارت داد`);
      break;
    }
    case 'nope':
      // «نه!» بیرون از نوبت با playNope اجرا می‌شود
      return { ok: false, error: 'کارت «نه!» را وقتی حریف کاری می‌کند بازی کن', game: g };
    default:
      if (KIND[card.kind]?.pair) return { ok: false, error: 'دو گربهٔ هم‌شکل لازم است', game: g };
      return { ok: false, error: 'کارت ناشناس', game: g };
  }
  return { ok: true, game: next, events };
}

/** جفت گربه: یک کارت تصادفی از حریف بدزد */
export function playPair(g, seat, kindId, target) {
  if (g.phase === 'over') return { ok: false, error: 'بازی تمام شده', game: g };
  if (seat !== g.turn) return { ok: false, error: 'نوبت تو نیست', game: g };
  const pair = handOf(g, seat).filter(c => c.kind === kindId);
  if (pair.length < 2) return { ok: false, error: 'دو کارت هم‌شکل لازم است', game: g };
  const t = target ?? nextAlive(g, seat);
  if (!g.alive[t]) return { ok: false, error: 'هدف معتبر نیست', game: g };
  if (!g.hands[t].length) return { ok: false, error: 'آن بازیکن کارتی ندارد', game: g };

  const hands = removeFromHand(g.hands, seat, [pair[0].id, pair[1].id]);
  const pool = g.hands[t];
  const picked = pool[Math.floor(mulberry32((g.seed ^ (pool.length * 613)) >>> 0)() * pool.length)];
  const h = hands.map(x => x.slice());
  h[t] = h[t].filter(c => c.id !== picked.id);
  h[seat] = [...h[seat], picked];
  return {
    ok: true,
    game: { ...g, hands: h },
    events: [`${g.names[seat]} دو ${KIND[kindId].label} بازی کرد`, `${g.names[t]} یک کارت داد`]
  };
}

/** کشیدن کارت از دسته — قلب بازی */
export function drawCard(g, seat = g.turn) {
  if (g.phase === 'over') return { ok: false, error: 'بازی تمام شده', game: g };
  if (seat !== g.turn) return { ok: false, error: 'نوبت تو نیست', game: g };
  if (!g.deck.length) return { ok: false, error: 'دسته خالی است', game: g };

  const [card, ...rest] = g.deck;
  const base = { ...g, deck: rest, peek: null, lastAction: null };

  // گربهٔ منفجرشونده؟
  if (card.kind === KITTEN) {
    const defuseIdx = g.hands[seat].findIndex(c => c.kind === 'defuse');
    if (defuseIdx < 0) {
      const alive = g.alive.slice();
      alive[seat] = false;
      const elim = [...g.eliminated, seat];
      let next = {
        ...base, alive, eliminated: elim,
        hands: g.hands.map((h, i) => (i === seat ? [] : h)),
        log: [...g.log, `💥 ${g.names[seat]} گربهٔ منفجرشونده کشید و بیرون رفت`]
      };
      next = checkWin(next);
      if (next.phase === 'over') return { ok: true, game: next, boom: true, eliminated: true, events: ['بوم!'] };
      next = { ...next, turn: nextAlive(next, seat), turnsFor: 1 };
      return { ok: true, game: next, boom: true, eliminated: true };
    }
    // خنثی می‌کند و گربه را برمی‌گرداند
    const h = g.hands.map(x => x.slice());
    h[seat].splice(defuseIdx, 1);
    const insertAt = Math.min(rest.length, 1 + Math.floor(mulberry32((g.seed ^ (seat * 71 + rest.length)) >>> 0)() * Math.max(1, rest.length - 1)));
    const deck = [...rest.slice(0, insertAt), card, ...rest.slice(insertAt)];
    let next = {
      ...base, hands: h, deck,
      log: [...g.log, `${g.names[seat]} گربه را خنثی کرد و در دسته گذاشت`]
    };
    next = endTurn(next, { skipDraw: true });
    return { ok: true, game: next, boom: true, defused: true, events: ['خنثی شد'] };
  }

  // کارت معمولی
  const h = g.hands.map(x => x.slice());
  h[seat] = [...h[seat], card];
  return { ok: true, game: endTurn({ ...base, hands: h }, { afterDraw: true }), card };
}

/** «نه!» — لغو آخرین کارت اکشن */
export function playNope(g, seat, cardId) {
  if (g.phase === 'over') return { ok: false, error: 'بازی تمام شده', game: g };
  const card = handOf(g, seat).find(c => c.id === cardId);
  if (!card || card.kind !== 'nope') return { ok: false, error: 'کارت «نه!» نداری', game: g };
  if (!g.lastAction || g.lastAction.noped) return { ok: false, error: 'کاری برای لغو کردن نیست', game: g };
  const hands = removeFromHand(g.hands, seat, [cardId]);
  return {
    ok: true,
    game: {
      ...g, hands,
      lastAction: { ...g.lastAction, noped: true },
      log: [...g.log, `${g.names[seat]} گفت «نه!»`]
    },
    events: ['کارت لغو شد']
  };
}

function endTurn(g, { skipDraw = false, afterDraw = false } = {}) {
  const turnsLeft = (g.turnsFor || 1) - 1;
  if (turnsLeft > 0) return { ...g, turnsFor: turnsLeft, peek: null };
  return { ...g, turn: nextAlive(g, g.turn), turnsFor: 1, peek: null };
}

/** رقیب: کارت مفید بازی می‌کند، بعد می‌کشد */
export function kittensBot(g, seat) {
  const hand = handOf(g, seat);
  const pairs = KITTEN_KINDS.filter(k => k.pair && hand.filter(c => c.kind === k.id).length >= 2);
  const others = g.alive.map((a, i) => (a && i !== seat ? i : -1)).filter(i => i >= 0);

  if (others.length && pairs.length && Math.random() < 0.5) {
    return { action: 'pair', kind: pairs[0].id, target: others[0] };
  }
  if (hand.some(c => c.kind === 'see') && Math.random() < 0.55) {
    return { action: 'play', cardId: hand.find(c => c.kind === 'see').id };
  }
  if (hand.some(c => c.kind === 'shuffle') && g.deck.some(c => c.kind === KITTEN)) {
    return { action: 'play', cardId: hand.find(c => c.kind === 'shuffle').id };
  }
  if (others.length && hand.some(c => c.kind === 'favor') && Math.random() < 0.4) {
    return { action: 'play', cardId: hand.find(c => c.kind === 'favor').id, target: others[0] };
  }
  return { action: 'draw' };
}

export const RULES = {
  steps: [
    'دستهٔ کارت‌ها مخلوط است؛ بین‌شان چند گربهٔ منفجرشونده خوابیده.',
    'در نوبتت هر تعداد کارت اکشن می‌توانی بازی کنی.',
    'در پایان نوبت یک کارت از دسته می‌کشی — اگر گربه باشد، منفجر می‌شوی!',
    'کارت «خنثی‌کننده» نجاتت می‌دهد: گربه را بی‌سر‌و‌صدا جایی در دسته بگذار.',
    '«نه!» کارت حریف را لغو می‌کند؛ «حمله» نوبت بعدی را دو برابر می‌کند.',
    'دو گربهٔ هم‌شکل = یک کارت تصادفی از حریف بدزد.',
    'هر کسی منفجر شود بیرون است. آخرین بازمانده برنده است.'
  ],
  example: 'دو کارت در دست داری. «دیدن آینده» را بازی می‌کنی: گربه در کارت دوم است — «به‌هم‌ریختن» را بازی کن!',
  note: 'برای دو تا پنج نفر.'
};
