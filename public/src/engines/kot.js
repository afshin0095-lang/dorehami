/* ============================================================
   «پادشاه توکیو» — هیولاها شهر را می‌زنند، توکیو را می‌گیرند
   تاس می‌ریزی (۶ تاس، ۳ بار)، سه تا نگه می‌داری، بقیه دوباره.
   عددها: پنجه/جمجمه/قلب/برق/۱/۲/۳
   • سه پنجه = زدنِ بقیه به‌اندازهٔ پنجه‌ها
   • قلب = جان
   • برق = انرژی
   • اگر پادشاه توکیو باشی، پنجه به کسانی می‌خورد که بیرون شهرند
     و بقیه هم می‌توانند تو را بزنند. ۲۰ ستاره = برد.
   ============================================================ */

import { mulberry32 } from '../core.js';

export const DICE_PER_ROLL = 6;
export const MAX_REROLLS = 2;          // سه بار در کل: پرتاب + ۲ بازپرتاب
export const STARTS = 20;              // ۲۰ ستاره = برد
export const MAX_HEALTH = 10;
export const MAX_ENERGY = 10;

/** چهره‌های تاس — برچسب‌های فارسی و نشانه */
export const FACES = [
  { id: 'claw', label: 'پنجه', glyph: '爪', kind: 'attack' },
  { id: 'skull', label: 'جمجمه', glyph: '☠', kind: 'attack' },
  { id: 'heart', label: 'قلب', glyph: '♥', kind: 'heal' },
  { id: 'bolt', label: 'برق', glyph: '⚡', kind: 'energy' },
  { id: 'one', label: 'یکی', glyph: '1', kind: 'number' },
  { id: 'two', label: 'دوتا', glyph: '2', kind: 'number' },
  { id: 'three', label: 'سه‌تا', glyph: '3', kind: 'number' }
];
export const FACE = Object.fromEntries(FACES.map(f => [f.id, f]));

/** سه‌تایی عدد ⇒ ستاره. ۳تا از ۱ = ۱ ستاره، ۳تا از ۲ = ۲، ۳تا از ۳ = ۳ */
export const NUMBER_TRIPLE_STARS = { one: 1, two: 2, three: 3 };
/** هر سه‌تاییِ پنجه/جمجمه/قلب/برق ⇒ یک امتیاز مخصوص همان چهره */

export const RULES = {
  title: 'پادشاه توکیو',
  steps: [
    '۶ تاس بریز. تا دو بار می‌توانی بعضی تاس‌ها را نگه داری و بقیه را دوباره بریزی.',
    'پنجه/جمجمه = حمله. سه‌تایی از آن‌ها یک امتیاز ویژه هم می‌دهد.',
    'قلب = یک جان، تا سقف ۱۰. برق = یک انرژی.',
    'سه‌تاییِ ۱/۲/۳ = ۱/۲/۳ ستاره.',
    'اگر در توکیو باشی، پنجه‌هایت به بیرونی‌ها می‌خورد و بیرونی‌ها هم تو را می‌زنند.',
    'هر کس زودتر ۲۰ ستاره بگیرد (یا تنها بازمانده باشد) پادشاه است.'
  ],
  example: 'سه پنجه + دو قلب + یک برق ⇒ ۳ آسیب به حریف‌ها، ۲ جان برای خودت، ۱ انرژی.'
};

const rndOf = (seed) => mulberry32((seed >>> 0) || 1);
const rollDie = (r) => FACES[Math.floor(r() * FACES.length)].id;

export function createKot({ players = 2, seed = Date.now() } = {}) {
  const count = Math.max(2, Math.min(4, players));
  const rnd = rndOf(seed);
  return {
    seed,
    playerCount: count,
    monsters: Array.from({ length: count }, (_, i) => ({
      id: i,
      name: i === 0 ? 'تو' : ['کرگدن', 'اژدها', 'ربات'][i - 1] || `هیولا ${i}`,
      human: i === 0,
      stars: 0,
      health: MAX_HEALTH,
      energy: 0,
      inTokyo: false,
      alive: true
    })),
    /** توکیو یک جایگاه دارد؛ با ۳+ بازیکن دو جا (شهر + خلیج) */
    tokyoSlots: count >= 3 ? 2 : 1,
    kingId: null,
    turnId: 0,
    round: 1,
    dice: [],
    kept: [],              // ایندکس تاس‌های نگه‌داشته‌شده
    rerollsLeft: MAX_REROLLS,
    rolled: false,
    winnerId: null,
    log: [],
    _rnd: rnd
  };
}

const clone = (g) => ({
  ...g,
  monsters: g.monsters.map(m => ({ ...m })),
  dice: [...g.dice],
  kept: [...g.kept],
  log: [...g.log]
});

export const currentMonster = (g) => g.monsters.find(m => m.id === g.turnId) || null;
export const aliveMonsters = (g) => g.monsters.filter(m => m.alive);
export const kingOf = (g) => g.monsters.find(m => m.id === g.kingId) || null;

/** پرتاب اول نوبت */
export function roll(g) {
  if (g.winnerId !== null) return { ok: false, error: 'بازی تمام شده', game: g };
  if (g.rolled && g.rerollsLeft <= 0) return { ok: false, error: 'بازپرتابی نمانده — حرکت کن', game: g };
  if (g.rolled) {
    // بازپرتاب: تاس‌های نگه‌داشته‌شده دست نمی‌خورند
    const next = clone(g);
    next.dice = next.dice.map((d, i) => (next.kept.includes(i) ? d : rollDie(g._rnd)));
    next.rerollsLeft--;
    next.log.push({ kind: 'reroll', who: g.turnId });
    return { ok: true, game: next };
  }
  const next = clone(g);
  next.dice = Array.from({ length: DICE_PER_ROLL }, () => rollDie(g._rnd));
  next.rolled = true;
  next.rerollsLeft = MAX_REROLLS;
  next.log.push({ kind: 'roll', who: g.turnId });
  return { ok: true, game: next };
}

/** نگه‌داشتن/آزاد کردن یک تاس پیش از بازپرتاب */
export function toggleKeep(g, index) {
  if (!g.rolled) return { ok: false, error: 'اول تاس بریز', game: g };
  if (g.rerollsLeft <= 0) return { ok: false, error: 'بازپرتابی نمانده', game: g };
  if (index < 0 || index >= g.dice.length) return { ok: false, error: 'تاس نامعتبر', game: g };
  const next = clone(g);
  next.kept = next.kept.includes(index)
    ? next.kept.filter(i => i !== index)
    : [...next.kept, index];
  return { ok: true, game: next };
}

/** شمارش چهره‌ها در تاس‌های فعلی */
export function tally(dice) {
  const out = Object.fromEntries(FACES.map(f => [f.id, 0]));
  for (const d of dice) out[d] = (out[d] || 0) + 1;
  return out;
}

/** نتیجهٔ تاس: آسیب، جان، انرژی، ستاره — بدون اعمال */
export function resolveDice(dice) {
  const t = tally(dice);
  const attacks = t.claw + t.skull;
  const heal = t.heart;
  const energy = t.bolt;
  let stars = 0;
  for (const [id, need] of Object.entries(NUMBER_TRIPLE_STARS)) {
    if (t[id] >= 3) stars += need;
  }
  // هر سه‌تایی پنجه/جمجمه/قلب/برق یک ستاره هم می‌دهد (امتیاز ویژه)
  const specials = ['claw', 'skull', 'heart', 'bolt'].filter(id => t[id] >= 3).length;
  return { attacks, heal, energy, stars, specials, tally: t };
}

/**
 * حرکت را اعمال می‌کند: آسیب/جان/انرژی/ستاره، بعد نوبت را می‌گرداند.
 * پنجه‌ها اگر بازیکن پادشاه باشد به بیرونی‌ها می‌خورد، وگرنه به پادشاه.
 */
export function commit(g) {
  if (!g.rolled) return { ok: false, error: 'اول تاس بریز', game: g };
  if (g.winnerId !== null) return { ok: false, error: 'بازی تمام شده', game: g };

  const next = clone(g);
  const me = next.monsters.find(m => m.id === next.turnId);
  const res = resolveDice(next.dice);

  // جان و انرژی
  me.health = Math.min(MAX_HEALTH, me.health + res.heal);
  me.energy = Math.min(MAX_ENERGY, me.energy + res.energy);
  me.stars += res.stars;

  // حمله
  if (res.attacks > 0) {
    const targets = me.inTokyo
      ? next.monsters.filter(m => m.alive && !m.inTokyo)
      : next.monsters.filter(m => m.alive && m.id === next.kingId && m.id !== me.id);
    for (const tgt of targets) {
      tgt.health -= res.attacks;
      if (tgt.health <= 0) {
        tgt.health = 0;
        tgt.alive = false;
        if (tgt.inTokyo) { tgt.inTokyo = false; if (next.kingId === tgt.id) next.kingId = null; }
        next.log.push({ kind: 'ko', who: tgt.id, by: me.id });
      }
    }
  }

  next.log.push({
    kind: 'turn', who: me.id,
    attacks: res.attacks, heal: res.heal, energy: res.energy, stars: res.stars
  });

  // آیا کسی برنده شد؟
  const survivor = next.monsters.filter(m => m.alive);
  if (survivor.length === 1) {
    next.winnerId = survivor[0].id;
    return { ok: true, game: next, result: res, winner: survivor[0] };
  }
  const starKing = next.monsters.find(m => m.alive && m.stars >= STARTS);
  if (starKing) {
    next.winnerId = starKing.id;
    return { ok: true, game: next, result: res, winner: starKing };
  }

  // نوبت بعدی
  const order = next.monsters.filter(m => m.alive).map(m => m.id);
  const here = order.indexOf(next.turnId);
  next.turnId = order[(here + 1) % order.length];
  if (next.turnId === 0 || next.turnId <= g.turnId) next.round++;
  next.dice = [];
  next.kept = [];
  next.rolled = false;
  next.rerollsLeft = MAX_REROLLS;
  return { ok: true, game: next, result: res };
}

/** ورود به توکیو: فقط پادشاه می‌تواند (اگر جا خالی باشد) */
export function enterTokyo(g) {
  const me = currentMonster(g);
  if (!me || me.inTokyo) return { ok: false, error: 'همین‌جا هستی', game: g };
  if (g.kingId !== null) return { ok: false, error: 'توکیو پر است', game: g };
  const next = clone(g);
  const m = next.monsters.find(x => x.id === g.turnId);
  m.inTokyo = true;
  next.kingId = m.id;
  next.log.push({ kind: 'enter', who: m.id });
  return { ok: true, game: next };
}

/** خروج از توکیو — ۱ ستاره جایزه، جایگاه آزاد می‌شود */
export function leaveTokyo(g) {
  const me = currentMonster(g);
  if (!me || !me.inTokyo) return { ok: false, error: 'در توکیو نیستی', game: g };
  const next = clone(g);
  const m = next.monsters.find(x => x.id === g.turnId);
  m.inTokyo = false;
  m.stars += 1;
  if (next.kingId === m.id) next.kingId = null;
  next.log.push({ kind: 'leave', who: m.id });
  return { ok: true, game: next };
}

/** خرید کارت انرژی (ساده: سه کارت ثابت) */
export const CARDS = [
  { id: 'roar', name: 'نعره', cost: 2, text: '۲ آسیب اضافه به همهٔ بیرونی‌ها' },
  { id: 'medic', name: 'درمان', cost: 3, text: '۲ جان تازه' },
  { id: 'greed', name: 'طمع', cost: 4, text: '۲ ستاره' }
];
export const CARD = Object.fromEntries(CARDS.map(c => [c.id, c]));

export function buyCard(g, cardId) {
  const card = CARD[cardId];
  const me = currentMonster(g);
  if (!card) return { ok: false, error: 'کارت نامعتبر', game: g };
  if (!me || me.energy < card.cost) return { ok: false, error: 'انرژی کافی نیست', game: g };
  const next = clone(g);
  const m = next.monsters.find(x => x.id === g.turnId);
  m.energy -= card.cost;
  if (cardId === 'medic') m.health = Math.min(MAX_HEALTH, m.health + 2);
  if (cardId === 'greed') m.stars += 2;
  if (cardId === 'roar') {
    for (const tgt of next.monsters) {
      if (tgt.id === m.id || !tgt.alive) continue;
      tgt.health -= 2;
      if (tgt.health <= 0) { tgt.health = 0; tgt.alive = false; }
    }
  }
  next.log.push({ kind: 'card', who: m.id, card: cardId });
  const survivor = next.monsters.filter(x => x.alive);
  if (survivor.length === 1) next.winnerId = survivor[0].id;
  const starKing = next.monsters.find(x => x.alive && x.stars >= STARTS);
  if (starKing) next.winnerId = starKing.id;
  return { ok: true, game: next };
}

/** حرکت خودکار برای ربات: چند بار بازپرتاب کن، بعد حرکت */
export function botMove(g) {
  let cur = g;
  let r = roll(cur);
  if (!r.ok) return cur;
  cur = r.game;
  for (let i = 0; i < MAX_REROLLS; i++) {
    // تاس‌های حمله/ستاره را نگه دار
    cur = { ...cur, kept: cur.dice.map((d, idx) => (d === 'claw' || d === 'skull' || d === 'three') ? idx : -1).filter(i2 => i2 >= 0) };
    const rr = roll(cur);
    if (!rr.ok) break;
    cur = rr.game;
  }
  const c = commit(cur);
  return c.ok ? c.game : cur;
}

export function renderDice(dice) {
  return dice.map(d => FACE[d]?.glyph || '·').join(' ');
}

export function isOver(g) { return g.winnerId !== null; }
export function winnerOf(g) { return g.monsters.find(m => m.id === g.winnerId) || null; }
