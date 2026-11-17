/* ============================================================
   «روح جزیره» — تقلید Spirit Island
   یک روح باستانی در برابر مهاجمان. با قدرت‌ها جزیره را نگه می‌داری.

   سازوکارهای برگرفته از Spirit Island:
   • انرژی هر دور تازه می‌شود؛ کارت‌های قدرت انرژی می‌خواهند
   • هر کارت «سرعت» دارد: سریع (پیش از مهاجمان) یا کند (پس از آن)
   • سه مرحلهٔ قدرت: رشد، قدرت، وحشت
   • «ترس» (Fear) و «بیماری» (Blight) دو منبع متضادند
   • مهاجمان در سه زمین فرود می‌آیند؛ هر زمین جمعیت و بیماری دارد
   • کارت‌های قدرت می‌توانند: آسیب، دفع، ترس، درمان بیماری، دفاع
   • اگر بیماری از سقف بگذرد یا روح از انرژی خالی شود، باخت
   • با رسیدن ترس به سقف یا نابودی همهٔ مهاجمان، برد

   این نسخهٔ جمع‌وجور: یک روح، سه زمین، ۱۰ کارت قدرت، ۱۲ دور.
   ============================================================ */

import { mulberry32 } from '../core.js';

export const ROUNDS = 13;
export const BLIGHT_LIMIT = 14;
export const FEAR_TARGET = 32;
export const ENERGY_PER_ROUND = 3;
export const CARD_PLAY_PER_ROUND = 2;

/** زمین‌های جزیره */
export const LANDS = [
  { id: 'coast', name: 'ساحل', hex: '#4a6b7a', glyph: '≈' },
  { id: 'jungle', name: 'جنگل', hex: '#3a5a3a', glyph: '♣' },
  { id: 'mountain', name: 'کوهستان', hex: '#5a5a6a', glyph: '▲' }
];

export const LAND_BY_ID = Object.fromEntries(LANDS.map(l => [l.id, l]));

/** ارواح قابل انتخاب */
export const SPIRITS = [
  {
    id: 'river', name: 'رودخانهٔ خروشان', role: 'آب',
    energy: 4, hex: '#2f5f7a',
    perk: 'دفع مهاجمان ۱ انرژی پس می‌دهد',
    desc: 'آبی که هیچ‌چیز را نگه نمی‌دارد.'
  },
  {
    id: 'thunder', name: 'تندر کوهستان', role: 'آتش',
    energy: 3, hex: '#7a4a2a',
    perk: 'هر آسیب +۱',
    desc: 'صدایی که کوه را می‌شکند.'
  },
  {
    id: 'green', name: 'سبزی رشد', role: 'گیاه',
    energy: 5, hex: '#3a6b3a',
    perk: 'هر درمان ۱ بیماری بیشتر',
    desc: 'ریشه‌ای که همه‌جا هست.'
  }
];

export const SPIRIT_BY_ID = Object.fromEntries(SPIRITS.map(s => [s.id, s]));

/** کارت‌های قدرت */
export const POWERS = [
  {
    id: 'flood', name: 'سیل', speed: 'fast', cost: 1,
    effect: { land: 'push', amount: 2 }, fear: 1,
    text: '۲ مهاجم را از یک زمین دور کن، ۱ ترس', hex: '#2f5f7a'
  },
  {
    id: 'lightning', name: 'آذرخش', speed: 'fast', cost: 2,
    effect: { damage: 2 }, fear: 1,
    text: '۲ آسیب به مهاجمان یک زمین، ۲ ترس', hex: '#7a6a2a'
  },
  {
    id: 'roots', name: 'ریشه‌های چنگ‌زن', speed: 'slow', cost: 1,
    effect: { damage: 1, healBlight: 1 }, fear: 1,
    text: '۱ آسیب و ۱ بیماری درمان', hex: '#3a5a3a'
  },
  {
    id: 'fog', name: 'مه', speed: 'fast', cost: 1,
    effect: { defend: 2 }, fear: 0,
    text: '۲ دفاع در برابر حملهٔ این دور', hex: '#5a5a7a'
  },
  {
    id: 'beast', name: 'جانور وحشی', speed: 'slow', cost: 2,
    effect: { damage: 3 }, fear: 1,
    text: '۳ آسیب به یک زمین', hex: '#5a3a2a'
  },
  {
    id: 'song', name: 'آوای کهن', speed: 'slow', cost: 1,
    effect: {}, fear: 3,
    text: '۴ ترس بی‌آسیب', hex: '#6a4a7a'
  },
  {
    id: 'tide', name: 'جزر و مد', speed: 'fast', cost: 2,
    effect: { land: 'push', amount: 3 }, fear: 1,
    text: '۳ مهاجم را دور کن', hex: '#2f6b7a'
  },
  {
    id: 'quake', name: 'زمین‌لرزه', speed: 'slow', cost: 3,
    effect: { damage: 4 }, fear: 1,
    text: '۴ آسیب به یک زمین، ۲ ترس', hex: '#6a5a3a'
  },
  {
    id: 'bloom', name: 'شکوفه', speed: 'slow', cost: 1,
    effect: { healBlight: 2 }, fear: 0,
    text: '۲ بیماری درمان، ۲ انرژی', gainEnergy: 2, hex: '#4a7a4a'
  },
  {
    id: 'ward', name: 'حریم', speed: 'fast', cost: 1,
    effect: { defend: 1, healBlight: 1 }, fear: 0,
    text: '۱ دفاع و ۱ بیماری درمان', hex: '#5a6a7a'
  }
];

export const POWER_BY_ID = Object.fromEntries(POWERS.map(p => [p.id, p]));

export const DIFFICULTY = {
  easy:   { label: 'آسان',   invaders: 3, energyBonus: 2, blightStart: 0 },
  normal: { label: 'میانه',  invaders: 4, energyBonus: 0, blightStart: 1 },
  hard:   { label: 'سخت',    invaders: 5, energyBonus: -1, blightStart: 2 }
};

/* ------------------------------ ساخت بازی ------------------------------ */

export function createSpirit({ seed = Date.now(), spiritId = 'river', difficulty = 'normal' } = {}) {
  const rnd = mulberry32(seed >>> 0);
  const diff = DIFFICULTY[difficulty] || DIFFICULTY.normal;
  const spirit = SPIRIT_BY_ID[spiritId] || SPIRITS[0];

  const deck = POWERS.map(p => p.id);
  shuffleArr(deck, rnd);

  return {
    seed: seed >>> 0,
    spiritId: spirit.id,
    difficulty,
    rnd,
    round: 1,
    maxRounds: ROUNDS,
    energy: spirit.energy + diff.energyBonus,
    maxEnergy: spirit.energy + diff.energyBonus + 2,
    fear: 0,
    blight: diff.blightStart,
    defend: 0,
    lands: LANDS.map(l => ({
      id: l.id,
      invaders: Math.max(1, Math.round(diff.invaders / LANDS.length * (l.id === 'coast' ? 1.4 : 1))),
      blight: 0
    })),
    hand: deck.slice(0, 4),
    deck: deck.slice(4),
    played: [],           // کارت‌های بازی‌شدهٔ این دور
    log: [],
    phase: 'play',        // play | over
    winner: null,
    lastPlay: null
  };
}

function shuffleArr(a, rnd) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ------------------------------ قدرت‌ها ------------------------------ */

/**
 * بازی یک قدرت. targetLand برای کارت‌های آسیب/دفع لازم است.
 * برمی‌گرداند { ok, game, effect? }
 */
export function playPower(game, cardId, targetLand = null) {
  if (game.phase === 'over') return { ok: false, error: 'بازی تمام شده.' };
  if (game.played.length >= CARD_PLAY_PER_ROUND) {
    return { ok: false, error: `فقط ${CARD_PLAY_PER_ROUND} قدرت در هر دور می‌شود.` };
  }
  if (!game.hand.includes(cardId)) return { ok: false, error: 'این کارت در دستت نیست.' };

  const card = POWER_BY_ID[cardId];
  if (!card) return { ok: false, error: 'کارت ناشناخته.' };
  if (game.energy < card.cost) return { ok: false, error: `انرژی کافی نداری (${card.cost} لازم است).` };

  const next = cloneSpirit(game);
  next.energy -= card.cost;
  next.played = [...next.played, cardId];
  next.hand = next.hand.filter(id => id !== cardId);   // کارت از دست می‌رود
  next.lastPlay = card.id;

  const events = [];
  const spirit = SPIRIT_BY_ID[next.spiritId];
  const damageBonus = spirit.id === 'thunder' ? 1 : 0;
  // سبزی رشد: ترس کامل، ولی هر کارت درمان ۱ بیماری بیشتر
  const fearMod = 0;
  const blightBonus = spirit.id === 'green' ? 1 : 0;
  // رودخانه: هزینهٔ کمتر برای کارت‌های دفع — یک انرژی پس می‌گیرد
  const refund = spirit.id === 'river' && (card.effect?.land === 'push') ? 1 : 0;

  // هدف: اگر کارت زمین لازم دارد و داده نشده — اولین زمین پرمهاجم
  const landId = targetLand
    || next.lands.slice().sort((a, b) => b.invaders - a.invaders)[0]?.id;
  const land = next.lands.find(l => l.id === landId);

  const eff = card.effect || {};

  if (eff.damage) {
    const dmg = eff.damage + damageBonus;
    if (land) {
      const killed = Math.min(land.invaders, dmg);
      land.invaders -= killed;
      events.push(`${killed} مهاجم در ${LAND_BY_ID[land.id].name} از میان رفت`);
    }
  }

  if (eff.land === 'push') {
    const amount = eff.amount || 1;
    const cheapen = spirit.id === 'river' ? 1 : 0;
    const pushed = Math.min(land?.invaders || 0, amount + cheapen);
    if (land) land.invaders -= pushed;
    events.push(`${pushed} مهاجم از ${LAND_BY_ID[land?.id || 'coast'].name} دور شد`);
  }

  if (eff.defend) {
    next.defend += eff.defend;
    events.push(`دفاع +${eff.defend}`);
  }

  if (eff.healBlight) {
    const heal = eff.healBlight + blightBonus;
    next.blight = Math.max(0, next.blight - heal);
    if (land && land.blight > 0) land.blight = Math.max(0, land.blight - heal);
    events.push(`بیماری −${heal}`);
  }

  if (eff.gainEnergy) {
    next.energy = Math.min(next.maxEnergy, next.energy + eff.gainEnergy);
    events.push(`انرژی +${eff.gainEnergy}`);
  }

  // ترس به‌کندی جمع می‌شود: هر کارت حداکثر ۱ ترس، کارت اختصاصی ترس ۲
  const rawFear = Math.min(card.fear || 0, card.id === 'song' ? 2 : 1);
  const fearGain = Math.max(0, rawFear + fearMod);
  if (fearGain) {
    next.fear += fearGain;
    events.push(`ترس +${fearGain}`);
  }
  if (refund) {
    next.energy = Math.min(next.maxEnergy, next.energy + refund);
    events.push(`انرژی +${refund}`);
  }

  next.log = [...next.log, { round: next.round, text: `${card.name}: ${events.join('، ')}` }];

  // برد فوری
  if (next.fear >= FEAR_TARGET) {
    next.phase = 'over';
    next.winner = 'spirit';
    next.log = [...next.log, { round: next.round, text: 'وحشت همه را گرفت — جزیره آزاد شد' }];
  }
  return { ok: true, game: next, events };
}

/* ------------------------------ پایان دور ------------------------------ */

/**
 * پایان دور: مهاجمان حمله می‌کنند، بیماری می‌گیرد، انرژی تازه می‌شود.
 */
export function endRound(game) {
  if (game.phase === 'over') return { ok: false, error: 'بازی تمام شده.' };

  const next = cloneSpirit(game);
  const spirit = SPIRIT_BY_ID[next.spiritId];

  // مهاجمان حمله می‌کنند
  // بیماری همیشه کمی می‌آید — مهاجم بودن خودش بیماری است
  let incoming = 0;
  for (const l of next.lands) incoming += Math.ceil(l.invaders / 2);
  const blocked = Math.min(next.defend, incoming);
  const dmg = Math.max(0, incoming - blocked);
  const ambient = Math.max(1, Math.ceil(next.lands.filter(l => l.invaders > 0).length / 2));
  next.blight += dmg + ambient;
  next.defend = 0;

  if (dmg > 0) {
    next.log = [...next.log, {
      round: next.round,
      text: `مهاجمان ${dmg} بیماری آوردند${blocked ? ` (دفاع ${blocked} را گرفت)` : ''}`
    }];
  } else {
    next.log = [...next.log, { round: next.round, text: 'دفاع کامل — آسیبی نرسید' }];
  }

  // رشد: انرژی تازه
  next.energy = Math.min(next.maxEnergy, next.energy + ENERGY_PER_ROUND);

  // مهاجمان زیاد می‌شوند
  const diff = DIFFICULTY[next.difficulty] || DIFFICULTY.normal;
  // هر دو دور یک مهاجم تازه
  if (next.round % 2 === 0) {
    const spawnLand = next.lands[Math.floor(next.rnd() * next.lands.length)];
    spawnLand.invaders += 1;
    next.log = [...next.log, { round: next.round, text: `${LAND_BY_ID[spawnLand.id].name}: مهاجم تازه` }];
  }

  // ۱) کارت‌های بازی‌شده به ته دسته برمی‌گردند
  next.deck = [...next.deck, ...next.played];
  next.played = [];
  // ۲) سپس دست تا ۴ کارت پر می‌شود — این ترتیب حیاتی است،
  //    وگرنه کارت‌ها پیش از بازگشت به دسته، از بازی گم می‌شوند.
  let draw = 0;
  while (next.hand.length < 4 && next.deck.length && draw < 10) {
    next.hand = [...next.hand, next.deck[0]];
    next.deck = next.deck.slice(1);
    draw++;
  }

  next.round += 1;

  // باخت: بیماری از سقف
  if (next.blight >= BLIGHT_LIMIT) {
    next.blight = BLIGHT_LIMIT;
    next.phase = 'over';
    next.winner = 'invaders';
    next.log = [...next.log, { round: next.round, text: 'جزیره بیمار شد — مهاجمان ماندند' }];
    return { ok: true, game: next };
  }

  // برد: یا ترس کافی، یا همهٔ مهاجمان رفته و دست‌کم نیمی از ترس
  if (next.fear >= FEAR_TARGET) {
    next.phase = 'over';
    next.winner = 'spirit';
    next.log = [...next.log, { round: next.round, text: 'وحشت همه را گرفت — جزیره آزاد شد' }];
    return { ok: true, game: next };
  }
  // پاک کردن همهٔ مهاجمان جایزه می‌دهد، ولی شرط برد نیست —
  // پیروزی فقط با ترس به دست می‌آید، همان‌طور که در Spirit Island.
  if (next.lands.every(l => l.invaders === 0)) {
    next.fear += 2;
    next.log = [...next.log, { round: next.round, text: 'هیچ مهاجمی نماند — ترس +۲' }];
    if (next.fear >= FEAR_TARGET) {
      next.phase = 'over';
      next.winner = 'spirit';
      next.log = [...next.log, { round: next.round, text: 'وحشت همه را گرفت — جزیره آزاد شد' }];
      return { ok: true, game: next };
    }
  }

  // باخت با زمان
  if (next.round > next.maxRounds) {
    next.phase = 'over';
    next.winner = 'invaders';
    next.log = [...next.log, { round: next.round, text: 'فصل‌ها گذشت — جزیره از دست رفت' }];
  }
  return { ok: true, game: next };
}

/* ------------------------------ کمکی ------------------------------ */

export function cloneSpirit(g) {
  return {
    ...g,
    lands: g.lands.map(l => ({ ...l })),
    hand: [...g.hand],
    deck: [...g.deck],
    played: [...g.played],
    log: [...g.log]
  };
}

export function isOver(g) { return g.phase === 'over'; }
export function spiritOf(g) { return SPIRIT_BY_ID[g.spiritId] || SPIRITS[0]; }
export function totalInvaders(g) { return g.lands.reduce((s, l) => s + l.invaders, 0); }
export function blightPct(g) { return Math.min(100, (g.blight / BLIGHT_LIMIT) * 100); }
export function fearPct(g) { return Math.min(100, (g.fear / FEAR_TARGET) * 100); }

export function scoreOf(g) {
  if (g.winner !== 'spirit') return 0;
  return Math.max(10,
    g.fear * 6 +
    (BLIGHT_LIMIT - g.blight) * 8 +
    (ROUNDS - g.round + 1) * 10
  );
}

export const RULES = {
  steps: [
    'هر دور ۲ قدرت بازی می‌کنی و ۳ انرژی تازه می‌گیری. کارت‌ها انرژی می‌خواهند.',
    'قدرت‌ها می‌توانند آسیب بزنند، مهاجم را دور کنند، بیماری را درمان کنند یا دفاع بسازند.',
    'دفاع فقط برای همان دور است — در پایان دور مهاجمان حمله می‌کنند و بیماری می‌آورند.',
    'با «ترس» می‌توانی برنده شوی: ۱۶ ترس = پیروزی. با «بیماری» می‌بازی: ۱۰ بیماری = شکست.',
    'هر سه دور، یک مهاجم تازه در یک زمین می‌آید. اگر همهٔ مهاجمان را دور کنی هم بردی.',
    'هر روح perk خودش را دارد: رودخانه دفع ارزان‌تر، تندر آسیب بیشتر، سبزی بیماری کمتر.'
  ],
  example: 'مثال: «آذرخش» ۲ انرژی می‌خواهد و ۲ آسیب می‌زند (با تندر ۳ آسیب). اگر زمین ساحل ۴ مهاجم داشته باشد، ۳ تایشان از میان می‌روند و ۱ می‌ماند. ۲ ترس هم می‌گیری.',
  note: 'ترس و بیماری همیشه با هم می‌آیند: هر کارتی که ترس می‌دهد، معمولاً مهاجمی هم دور می‌کند. انتخاب بین آسیب و دفع، هستهٔ بازی است.'
};
