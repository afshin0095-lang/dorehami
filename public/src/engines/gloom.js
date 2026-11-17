/* ============================================================
   «غارهای گِلومهیون» — تقلید کارتی-تاکتیکی از Gloomhaven
   دو ماجراجو در برابر غار. هر دور دقیقاً دو کارت توانایی بازی می‌کنی،
   یکی «پیشرو» با iniciativa که ترتیب نوبت را تعیین می‌کند؛ بالای یکی
   و پایین دیگری را اجرا می‌کنی. کارت‌ها برنمی‌گردند تا استراحت کنی.

   قواعد بر پایه‌ی کتاب قاعدهٔ Gloomhaven:
   • هر دور ۲ کارت انتخاب می‌کنی (یا استراحت طولانی با ۱ کارت دورانداخته)
   • iniciativa کارت پیشرو نوبت را تعیین می‌کند؛ مساوی را کارت دوم می‌شکند
   • بالای یک کارت + پایین کارت دیگر
   • استراحت کوتاه در پایان دور: یک کارت تصادفی از دورانداخته‌ها برمی‌گردد
     و یک آسیب می‌گیری
   • وقتی کارت برای بازی نداری و نمی‌توانی استراحت کنی، خسته‌ای (باختی)
   ============================================================ */

import { mulberry32 } from '../core.js';

/* ------------------------------ تعریف کارت‌ها ------------------------------ */

/**
 * هر کارت: id، name، initiative، top (بالا)، bottom (پایین)
 * کنش‌ها: { type, amount, target }
 *  attack  — آسیب به دشمن (amount)
 *  move    — جابه‌جایی (amount خانه)
 *  shield  — سپر تا پایان دور بعد
 *  heal    — درمان خودت
 *  loot    — برداشتن غنیمت
 *  pierce  — نادیده گرفتن سپر
 *  push    — عقب راندن دشمن
 *
 * کارت‌های «ازدست‌رفته» (lost) پس از بازی از بازی بیرون می‌روند و برنمی‌گردند —
 * همان سازوکاری که در Gloomhaven باعث خستگی می‌شود.
 */
export const CARDS = [
  {
    id: 'cleave', lost: true, name: 'شکافتن', initiative: 22,
    top: { type: 'attack', amount: 3, text: 'حمله ۳ به همهٔ دشمنان مجاور' },
    bottom: { type: 'move', amount: 2, text: 'حرکت ۲' }
  },
  {
    id: 'shield-bash', name: 'کوبش سپر', initiative: 18,
    top: { type: 'attack', amount: 2, text: 'حمله ۲' },
    bottom: { type: 'shield', amount: 2, text: 'سپر ۲ تا پایان دور بعد' }
  },
  {
    id: 'trample', name: 'لگدمال', initiative: 35,
    top: { type: 'move', amount: 3, text: 'حرکت ۳' },
    bottom: { type: 'attack', amount: 3, text: 'حمله ۳' }
  },
  {
    id: 'juggernaut', lost: true, name: 'کرگدن', initiative: 12,
    top: { type: 'attack', amount: 4, text: 'حمله ۴، سپس عقب راندن' },
    bottom: { type: 'move', amount: 2, text: 'حرکت ۲' }
  },
  {
    id: 'warcry', name: 'نعرهٔ جنگ', initiative: 8,
    top: { type: 'attack', amount: 2, text: 'حمله ۲' },
    bottom: { type: 'heal', amount: 2, text: 'درمان ۲' }
  },
  {
    id: 'frenzy', lost: true, name: 'دیوانگی', initiative: 45,
    top: { type: 'attack', amount: 5, text: 'حمله ۵ (پرهزینه)' },
    bottom: { type: 'move', amount: 1, text: 'حرکت ۱' }
  },
  {
    id: 'ironhide', name: 'پوست آهنین', initiative: 28,
    top: { type: 'shield', amount: 3, text: 'سپر ۳' },
    bottom: { type: 'attack', amount: 2, text: 'حمله ۲' }
  },
  {
    id: 'loot-run', name: 'تاراج', initiative: 62,
    top: { type: 'loot', amount: 1, text: 'برداشتن غنیمت' },
    bottom: { type: 'move', amount: 3, text: 'حرکت ۳' }
  },
  {
    id: 'pierce-shot', name: 'تیر نافذ', initiative: 30,
    top: { type: 'attack', amount: 3, pierce: true, text: 'حمله ۳، نادیده گرفتن سپر' },
    bottom: { type: 'attack', amount: 1, text: 'حمله ۱' }
  },
  {
    id: 'second-wind', name: 'نفس دوباره', initiative: 52,
    top: { type: 'heal', amount: 3, text: 'درمان ۳' },
    bottom: { type: 'shield', amount: 1, text: 'سپر ۱' }
  }
];

export const CARD_BY_ID = Object.fromEntries(CARDS.map(c => [c.id, c]));

/* ------------------------------ دشمنان ------------------------------ */

export const ENEMIES = [
  { id: 'bandit', name: 'راهزن', hp: 6, attack: 3, initiative: 40, hex: '#8a5a3b', glyph: '♟' },
  { id: 'hound', name: 'سگ هار', hp: 5, attack: 4, initiative: 20, hex: '#6b4a2f', glyph: '♞' },
  { id: 'archer', name: 'کماندار', hp: 5, attack: 3, initiative: 65, hex: '#5b6b3a', glyph: '♜' },
  { id: 'brute', name: 'دیو غار', hp: 14, attack: 6, initiative: 55, hex: '#6b2f3a', glyph: '♛' }
];

/* ------------------------------ صحنه‌ها ------------------------------ */

export const SCENARIOS = [
  {
    id: 'crypt', name: 'دخمهٔ سیاه', goal: 2, rounds: 12,
    intro: 'دو ماجراجو به دخمه‌ای فروریخته فرستاده شده‌اند. باید دو راهزن را از میان بردارند.',
    enemies: ['bandit', 'bandit'], difficulty: 1
  },
  {
    id: 'woods', name: 'بیشهٔ خفه', goal: 2, rounds: 14,
    intro: 'سگ‌های هار در بیشه کمین کرده‌اند. دو تایشان را از پا دربیاور و زنده بیرون بزن.',
    enemies: ['hound', 'hound'], difficulty: 1
  },
  {
    id: 'ridge', name: 'گردنهٔ کمانداران', goal: 2, rounds: 14,
    intro: 'کمانداران از بلندی تیر می‌اندازند. پیش از آن‌که سوراخ سوراخ شوی، خودت را برسان.',
    enemies: ['archer', 'bandit'], difficulty: 2
  },
  {
    id: 'lair', name: 'لانهٔ دیو', goal: 1, rounds: 16,
    intro: 'دیو غار بیدار شده. تنها یک هدف هست: خود دیو. اما همراهانش سد راه‌اند.',
    enemies: ['brute'], goalIds: ['brute'], difficulty: 3
  }
];

export const DIFFICULTY = {
  easy: { label: 'آسان', hpMul: 0.7, enemyAtk: -1, aggro: 0.75 },
  normal: { label: 'میانه', hpMul: 1, enemyAtk: 0, aggro: 1 },
  hard: { label: 'سخت', hpMul: 1.35, enemyAtk: 1, aggro: 1.3 }
};

export const HAND_START = 8;      // کارت‌هایی که با خود می‌بری
export const HERO_HP = 12;
export const HERO_SHIELD_MAX = 4;

/* ------------------------------ ساخت بازی ------------------------------ */

export function createGloom({ seed = Date.now(), scenarioId = 'crypt', difficulty = 'normal', heroes = 1 } = {}) {
  const rnd = mulberry32(seed >>> 0);
  const scenario = SCENARIOS.find(s => s.id === scenarioId) || SCENARIOS[0];
  const diff = DIFFICULTY[difficulty] || DIFFICULTY.normal;

  const deck = CARDS.map(c => c.id);
  shuffleArr(deck, rnd);
  const hand = deck.slice(0, HAND_START);
  const discard = [];

  const enemies = scenario.enemies.map((eid, i) => {
    const base = ENEMIES.find(e => e.id === eid);
    return {
      uid: `${eid}-${i}`,
      id: base.id,
      name: base.name,
      glyph: base.glyph,
      hex: base.hex,
      maxHp: Math.max(1, Math.round(base.hp * diff.hpMul)),
      hp: Math.max(1, Math.round(base.hp * diff.hpMul)),
      attack: Math.max(1, Math.round((base.attack + diff.enemyAtk) * diff.aggro)),
      initiative: base.initiative,
      alive: true
    };
  });

  return {
    seed: seed >>> 0,
    scenarioId: scenario.id,
    difficulty,
    rnd,
    round: 1,
    maxRounds: scenario.rounds,
    goal: scenario.goal,
    kills: 0,
    // در «لانهٔ دیو» فقط کشتن دیو حساب است
    goalIds: scenario.goalIds || null,
    heroes: Array.from({ length: heroes }, (_, i) => ({
      id: `hero-${i}`,
      name: heroes === 1 ? 'آزاد' : (i === 0 ? 'آزاد' : 'برین'),
      hp: HERO_HP,
      maxHp: HERO_HP,
      shield: 0,
      shieldRounds: 0,
      hand: [...hand],
      discard: [...discard],
      lost: [],
      initiative: 99,
      chosen: [],
      exhausted: false
    })),
    enemies,
    phase: 'choose',        // choose | resolve | over
    log: [],
    winner: null,
    shortRested: false
  };
}

function shuffleArr(a, rnd) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ------------------------------ انتخاب کارت ------------------------------ */

/**
 * انتخاب دو کارت. اگر یک کارت بدهی، «استراحت طولانی» است.
 * برمی‌گرداند: { ok, error?, game }
 */
export function chooseCards(game, cardIds) {
  if (game.phase === 'over') return { ok: false, error: 'بازی تمام شده است.' };
  if (!Array.isArray(cardIds)) return { ok: false, error: 'کارت‌ها را درست انتخاب کن.' };
  if (cardIds.length !== 2 && cardIds.length !== 1) {
    return { ok: false, error: 'دقیقاً دو کارت انتخاب کن (یا یک کارت برای استراحت طولانی).' };
  }
  const hero = game.heroes[0];
  if (hero.exhausted) return { ok: false, error: 'ماجراجو خسته است.' };

  for (const id of cardIds) {
    if (!hero.hand.includes(id)) return { ok: false, error: `کارت «${CARD_BY_ID[id]?.name ?? id}» در دستت نیست.` };
  }
  if (new Set(cardIds).size !== cardIds.length) return { ok: false, error: 'یک کارت را دو بار نمی‌توانی انتخاب کنی.' };

  const longRest = cardIds.length === 1;
  const chosen = cardIds.slice();

  // iniciativa: کارت اول، مساوی را کارت دوم می‌شکند
  const first = CARD_BY_ID[chosen[0]];
  const second = chosen[1] ? CARD_BY_ID[chosen[1]] : null;
  const initiative = second
    ? (first.initiative === second.initiative ? first.initiative + 1 : first.initiative)
    : 99;

  const next = cloneGame(game);
  const h = next.heroes[0];
  h.chosen = chosen;
  h.initiative = initiative;
  // کارت‌ها از دست بیرون می‌روند؛ کارت‌های «ازدست‌رفته» برنمی‌گردند
  h.hand = h.hand.filter(id => !chosen.includes(id));
  const lostIds = chosen.filter(id => CARD_BY_ID[id]?.lost);
  const keepIds = chosen.filter(id => !CARD_BY_ID[id]?.lost);
  h.lost = [...(h.lost || []), ...lostIds];
  h.discard = [...h.discard, ...keepIds];
  next.phase = 'resolve';
  next.longRest = longRest;
  next.log = [...next.log, {
    round: next.round,
    text: longRest
      ? `استراحت طولانی — iniciativa ${initiative}`
      : `${first.name} + ${second.name} — iniciativa ${initiative}`
  }];
  return { ok: true, game: next };
}

/* ------------------------------ اجرای نوبت ------------------------------ */

/**
 * اجرای نوبت ماجراجو.
 * use: 'both' (بالای کارت اول + پایین کارت دوم)
 *    | 'bottom-first' (بالای کارت دوم + پایین کارت اول)
 * targetUid: دشمن هدف (برای حمله)
 */
export function playTurn(game, { use = 'both', targetUid = null } = {}) {
  if (game.phase !== 'resolve') return { ok: false, error: 'اول کارت انتخاب کن.' };
  const next = cloneGame(game);
  const hero = next.heroes[0];
  const [aId, bId] = hero.chosen;
  const cardA = CARD_BY_ID[aId];
  const cardB = bId ? CARD_BY_ID[bId] : null;

  if (!cardA) return { ok: false, error: 'کارت پیدا نشد.' };

  if (next.longRest) {
    return longRestTurn(next, hero);
  }
  if (!cardB) return { ok: false, error: 'دو کارت لازم است.' };

  const events = [];
  // بالای یکی + پایین دیگری — بازیکن انتخاب می‌کند کدام ترکیب
  const pair = use === 'bottom-first'
    ? [cardB.top, cardA.bottom]
    : [cardA.top, cardB.bottom];

  for (const action of pair) {
    applyAction(next, hero, action, targetUid, events);
  }

  next.log = [...next.log, ...events.map(e => ({ round: next.round, text: e }))];
  next.phase = 'choose';
  next.shortRested = false;
  return { ok: true, game: afterRound(next) };
}

function longRestTurn(next, hero) {
  // استراحت طولانی: درمان ۲، همهٔ کارت‌های دورانداخته برمی‌گردند
  hero.hp = Math.min(hero.maxHp, hero.hp + 2);
  hero.hand = [...new Set([...hero.hand, ...hero.discard])];
  hero.discard = [];
  // کارت‌های ازدست‌رفته هرگز برنمی‌گردند
  hero.chosen = [];
  next.longRest = false;
  next.phase = 'choose';
  next.log = [...next.log, { round: next.round, text: 'استراحت طولانی: درمان ۲ و همهٔ کارت‌ها برگشتند' }];
  return { ok: true, game: afterRound(next) };
}

function applyAction(state, hero, action, targetUid, events) {
  if (!action) return;
  const alive = state.enemies.filter(e => e.alive);

  switch (action.type) {
    case 'attack': {
      if (!alive.length) { events.push('حمله — دشمنی نمانده'); return; }
      const target = alive.find(e => e.uid === targetUid) || alive[0];
      let dmg = action.amount;
      if (hero.weak) dmg = Math.max(1, dmg - 1);
      target.hp -= dmg;
      events.push(`حمله ${dmg} به ${target.name} (${Math.max(0, target.hp)} جان)`);
      if (target.hp <= 0) {
        target.alive = false;
        target.hp = 0;
        // فقط دشمنان هدف (اگر صحنه محدود کرده باشد) به شمارش می‌آیند
        const counts = !state.goalIds || state.goalIds.includes(target.id);
        if (counts) state.kills += 1;
        events.push(`${target.name} از پا افتاد${counts ? '' : ' (هدف نبود)'}`);
      }
      if (action.pierce) events.push('تیر از سپر گذشت');
      break;
    }
    case 'move': {
      hero.moved = (hero.moved || 0) + action.amount;
      events.push(`حرکت ${action.amount}`);
      break;
    }
    case 'shield': {
      hero.shield = Math.min(HERO_SHIELD_MAX, (hero.shield || 0) + action.amount);
      hero.shieldRounds = 2;
      events.push(`سپر ${action.amount}`);
      break;
    }
    case 'heal': {
      hero.hp = Math.min(hero.maxHp, hero.hp + action.amount);
      events.push(`درمان ${action.amount}`);
      break;
    }
    case 'loot': {
      state.loot = (state.loot || 0) + 1;
      events.push('غنیمت برداشته شد');
      break;
    }
    default:
      events.push('کنش ناشناخته');
  }
}

/* ------------------------------ پایان دور ------------------------------ */

/** دشمنان حمله می‌کنند، سپر کم می‌شود، بررسی باخت/برد */
export function afterRound(state) {
  const next = state;
  const hero = next.heroes[0];
  const alive = next.enemies.filter(e => e.alive);

  // برد؟
  if (next.kills >= next.goal) {
    next.phase = 'over';
    next.winner = 'heroes';
    next.log = [...next.log, { round: next.round, text: 'هدف کامل شد — پیروزی' }];
    return next;
  }

  // دشمنان فقط اگر در دسترس باشند حمله می‌کنند.
  // هر «حرکت» در این دور یک دشمن را از دسترس خارج می‌کند (دور ماندن/عقب کشیدن).
  const moved = hero.moved || 0;
  const engaged = Math.max(0, alive.length - Math.floor(moved / 2));
  let incoming = 0;
  for (let i = 0; i < engaged; i++) incoming += alive[i].attack;
  if (alive.length > engaged) {
    next.log = [...next.log, {
      round: next.round,
      text: `از ${alive.length - engaged} دشمن دور ماندی`
    }];
  }
  hero.moved = 0;
  const blocked = Math.min(hero.shield || 0, incoming);
  const dmg = Math.max(0, incoming - blocked);
  hero.hp -= dmg;
  if (dmg > 0) {
    next.log = [...next.log, { round: next.round, text: `دشمنان ${dmg} آسیب زدند${blocked ? ` (سپر ${blocked} را گرفت)` : ''}` }];
  }

  // سپر بلندمدت
  if (hero.shieldRounds > 0) {
    hero.shieldRounds -= 1;
    if (hero.shieldRounds === 0) hero.shield = 0;
  }

  // باخت با سلامت
  if (hero.hp <= 0) {
    hero.hp = 0;
    hero.exhausted = true;
    next.phase = 'over';
    next.winner = 'enemies';
    next.log = [...next.log, { round: next.round, text: 'ماجراجو از پا افتاد — شکست' }];
    return next;
  }

  // خستگی: کارتی برای بازی نیست و دورانداخته‌ای هم برای استراحت نمانده
  if (hero.hand.length < 2 && hero.discard.length === 0) {
    hero.exhausted = true;
    next.phase = 'over';
    next.winner = 'enemies';
    next.log = [...next.log, { round: next.round, text: 'کارت برای بازی نماند — خستگی و شکست' }];
    return next;
  }

  // استراحت کوتاه اجباری وقتی کارت ته کشیده
  next.round += 1;
  if (hero.hand.length === 0 && hero.discard.length > 0) {
    const idx = Math.floor(next.rnd() * hero.discard.length);
    const back = hero.discard.splice(idx, 1)[0];
    hero.hand = [back];
    hero.hp = Math.max(1, hero.hp - 1);
    next.shortRested = true;
    next.log = [...next.log, { round: next.round, text: 'استراحت کوتاه: یک کارت برگشت، ۱ آسیب' }];
  }

  // باخت با زمان
  if (next.round > next.maxRounds) {
    next.phase = 'over';
    next.winner = 'enemies';
    next.log = [...next.log, { round: next.round, text: 'زمان تمام شد — شکست' }];
  }

  return next;
}

/* ------------------------------ کمکی‌ها ------------------------------ */

export function cloneGame(game) {
  return {
    ...game,
    heroes: game.heroes.map(h => ({ ...h, hand: [...h.hand], discard: [...h.discard], lost: [...(h.lost || [])], chosen: [...h.chosen] })),
    enemies: game.enemies.map(e => ({ ...e })),
    log: [...game.log]
  };
}

export function aliveEnemies(game) { return game.enemies.filter(e => e.alive); }

export function isOver(game) { return game.phase === 'over'; }

export function cardsInHand(game) {
  const h = game.heroes[0];
  return h.hand.map(id => CARD_BY_ID[id]).filter(Boolean);
}

/** امتیاز: جان باقی‌مانده + غنیمت + سرعت */
export function scoreOf(game) {
  if (game.winner !== 'heroes') return 0;
  const hero = game.heroes[0];
  const roundsLeft = Math.max(0, game.maxRounds - game.round);
  return Math.max(10, hero.hp * 12 + (game.loot || 0) * 15 + roundsLeft * 5);
}

export const RULES = {
  steps: [
    'هر دور دقیقاً دو کارت توانایی انتخاب کن. کارت اول «پیشرو» است و iniciativa آن تعیین می‌کند زودتر از دشمنان بازی کنی یا دیرتر.',
    'از کارت پیشرو بالایی و از کارت دوم پایینی را اجرا کن (یا برعکس). هر کارت یک بالا و یک پایین دارد.',
    'کارت‌های بازی‌شده به دورانداخته می‌روند و برنمی‌گردند تا استراحت کنی.',
    'وقتی کارتت ته کشید، «استراحت کوتاه» می‌کنی: یک کارت تصادفی برمی‌گردد و یک آسیب می‌گیری.',
    'با یک کارت تنها می‌توانی «استراحت طولانی» کنی: ۲ درمان و همهٔ کارت‌ها برمی‌گردند.',
    'اگر جان به صفر برسد یا کارت برای بازی نمانَد، خسته می‌شوی و بازی را می‌بازی.'
  ],
  example: 'مثال: کارت «کرگدن» (iniciativa ۱۲، بالا حمله ۴) و «پوست آهنین» (iniciativa ۲۸، پایین حمله ۲). iniciativa ۱۲ است، پس زودتر از دشمن‌ها می‌زنی: حمله ۴ از کرگدن و حمله ۲ از پایین پوست آهنین — مجموعاً ۶ آسیب پیش از آن‌که دشمن جواب بدهد.',
  note: 'دشمنان هر دور با هم حمله می‌کنند. سپر فقط تا پایان دور بعد می‌ماند. برنامه‌ریزی کارت‌ها مهم‌تر از شانس است.'
};
