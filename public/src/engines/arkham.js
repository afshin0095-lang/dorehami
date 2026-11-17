/* ============================================================
   «آرکام: نشانه‌های آشوب» — تقلید Arkham Horror: The Card Game
   پژوهشگری در شهر نفرین‌شده. سه کنش در نوبت، کیسهٔ آشوب، و
   ساعتی که با هر نشانهٔ عذاب به پایان نزدیک‌تر می‌شود.

   سازوکارهای برگرفته از Arkham LCG:
   • چهار مهارت: اراده، هوش، نبرد، چابکی
   • کیسهٔ آشوب: نشانه‌هایی با مقدار مثبت/منفی، نشانهٔ جمجمه،
     نشانهٔ فرقه، نشانهٔ ستارهٔ باستانی و نشانهٔ چادر (شکست قطعی)
   • آزمون مهارت: مهارت + کارت‌های همراه + نشانهٔ آشوب ≥ دشواری
   • سه کنش در هر نوبت: بررسی، نبرد، فرار، جابه‌جایی، بازی کارت
   • اجندا: هر دور ۱ عذاب می‌گیرد؛ پر شدنش سناریو را می‌بَرد از تو
   • پرده: با پیشرفت کافی در پرده، به پردهٔ بعد می‌روی؛ پردهٔ سوم = برد
   • کارت‌های دارایی «سلامت/هول» جذب می‌کنند
   ============================================================ */

import { mulberry32 } from '../core.js';

export const ACTIONS_PER_TURN = 3;

/** چهار مهارت */
export const SKILLS = {
  will:     { id: 'will',     name: 'اراده',  glyph: '✦' },
  intellect:{ id: 'intellect',name: 'هوش',   glyph: '✎' },
  combat:   { id: 'combat',   name: 'نبرد',  glyph: '⚔' },
  agility:  { id: 'agility',  name: 'چابکی', glyph: '➶' }
};

/** پژوهشگران */
export const INVESTIGATORS = [
  {
    id: 'roland', name: 'رولند بنکس', role: 'کارآگاه',
    stats: { will: 3, intellect: 3, combat: 4, agility: 2 },
    hp: 9, sanity: 8, hex: '#7a4a2a',
    perk: 'نبرد +۱ هنگام کشتن هیولا'
  },
  {
    id: 'daisey', name: 'دیزی واکر', role: 'کتاب‌دار',
    stats: { will: 4, intellect: 4, combat: 1, agility: 2 },
    hp: 6, sanity: 11, hex: '#4a6b7a',
    perk: 'بررسی هول کمتری می‌آورد'
  },
  {
    id: 'agnes', name: 'آگنس بیکر', role: 'مغازه‌دار',
    stats: { will: 5, intellect: 3, combat: 2, agility: 3 },
    hp: 8, sanity: 11, hex: '#6b4a6b',
    perk: 'هول گرفته، دشمن را می‌زند'
  }
];

/** نشانه‌های آشوب */
export const CHAOS_TOKENS = [
  { id: 'plus1',  value: 1,  label: '+۱', glyph: '+' },
  { id: 'zero',   value: 0,  label: '۰',  glyph: '0' },
  { id: 'minus1', value: -1, label: '−۱', glyph: '−' },
  { id: 'minus2', value: -2, label: '−۲', glyph: '−' },
  { id: 'minus3', value: -3, label: '−۳', glyph: '−' },
  { id: 'minus4', value: -4, label: '−۴', glyph: '−' },
  { id: 'skull',  value: -2, label: 'جمجمه', glyph: '☠' },
  { id: 'cultist',value: -3, label: 'فرقه',  glyph: '✠' },
  { id: 'elder',  value: 2,  label: 'ستاره', glyph: '✧' },
  { id: 'tentacle', value: null, label: 'چادر', glyph: '◈', autoFail: true }
];

/** ترکیب کیسه بسته به سختی */
export const CHAOS_BAG = {
  easy:   ['plus1', 'zero', 'zero', 'minus1', 'minus1', 'minus2', 'minus2', 'elder'],
  normal: ['plus1', 'plus1', 'zero', 'zero', 'minus1', 'minus1', 'minus2', 'minus3', 'skull', 'tentacle'],
  hard:   ['plus1', 'zero', 'minus1', 'minus2', 'minus2', 'minus3', 'minus3', 'minus4', 'skull', 'cultist', 'tentacle']
};

/** کارت‌های دارایی — بازی می‌شوند و می‌مانند */
export const ASSETS = [
  { id: 'revolver', name: 'هفت‌تیر', cost: 2, stats: { combat: 1 }, slots: 'hand',
    text: 'نبرد +۱', hex: '#5a4a3a' },
  { id: 'lamp', name: 'چراغ‌دستی', cost: 1, stats: { intellect: 1 }, slots: 'hand',
    text: 'هوش +۱', hex: '#7a6a3a' },
  { id: 'coat', name: 'پالتوی بلند', cost: 2, hp: 2, slots: 'body',
    text: '۲ جان اضافه', hex: '#3a4a5a' },
  { id: 'charm', name: 'طلسم', cost: 2, sanity: 2, slots: 'slot-rel',
    text: '۲ سلامت روان اضافه', hex: '#6b4a7a' },
  { id: 'knife', name: 'چاقو', cost: 1, stats: { combat: 1 }, slots: 'hand',
    text: 'نبرد +۱', hex: '#6b6b6b' },
  { id: 'book', name: 'کتاب کهنه', cost: 2, stats: { will: 1, intellect: 1 }, slots: 'slot-rel',
    text: 'اراده +۱، هوش +۱', hex: '#4a5a3a' },
  { id: 'boots', name: 'چکمه', cost: 1, stats: { agility: 1 }, slots: 'body',
    text: 'چابکی +۱', hex: '#5a4a2a' },
  { id: 'mirror', name: 'آینهٔ شکسته', cost: 3, sanity: 3, stats: { will: 1 }, slots: 'slot-rel',
    text: 'اراده +۱، ۳ سلامت روان', hex: '#4a4a6b' }
];

export const ASSET_BY_ID = Object.fromEntries(ASSETS.map(a => [a.id, a]));

/** سه پرده (Act) — پیشرفت با بررسی */
export const ACTS = [
  { id: 1, name: 'پردهٔ اول: خانهٔ متروک', need: 3, location: 'عمارت پوسیده',
    intro: 'درِ عمارت باز است. باید دنبال سرنخ بگردی.' },
  { id: 2, name: 'پردهٔ دوم: زیرزمین', need: 4, location: 'زیرزمین نمناک',
    intro: 'پله‌ها به تاریکی می‌روند. چیزی آن پایین است.' },
  { id: 3, name: 'پردهٔ سوم: محراب', need: 5, location: 'محراب شکسته',
    intro: 'این آخرین جاست. آیین باید شکسته شود.' }
];

/** اجندا — ساعت عذاب */
export const AGENDAS = [
  { id: 1, name: 'اجندای اول: سایه‌ها', doomMax: 10 },
  { id: 2, name: 'اجندای دوم: آیین نزدیک است', doomMax: 9 },
  { id: 3, name: 'اجندای سوم: دروازه باز می‌شود', doomMax: 3 }
];

/** دشمنان */
export const ENEMIES = [
  { id: 'ghoul', name: 'غول', hp: 3, fight: 3, evade: 2, damage: 1, horror: 1, hex: '#5a3a3a', glyph: '☠' },
  { id: 'cultist', name: 'فرقه‌ای', hp: 2, fight: 2, evade: 3, damage: 1, horror: 2, hex: '#4a3a5a', glyph: '✠' },
  { id: 'rat', name: 'موش غول', hp: 1, fight: 1, evade: 2, damage: 1, horror: 0, hex: '#4a4a3a', glyph: '◆' },
  { id: 'nightgaunt', name: 'شب‌گَرد', hp: 4, fight: 4, evade: 4, damage: 2, horror: 2, hex: '#3a3a4a', glyph: '◈' }
];

export const DIFFICULTY = {
  easy:   { label: 'آسان',   bag: 'easy',   actions: 4, resourceStart: 6 },
  normal: { label: 'میانه',  bag: 'normal', actions: 3, resourceStart: 5 },
  hard:   { label: 'سخت',    bag: 'hard',   actions: 3, resourceStart: 4 }
};

/* ------------------------------ ساخت بازی ------------------------------ */

export function createArkham({ seed = Date.now(), investigatorId = 'roland', difficulty = 'normal' } = {}) {
  const rnd = mulberry32(seed >>> 0);
  const diff = DIFFICULTY[difficulty] || DIFFICULTY.normal;
  const inv = INVESTIGATORS.find(i => i.id === investigatorId) || INVESTIGATORS[0];
  const bag = [...CHAOS_BAG[diff.bag]];

  const deck = ASSETS.map(a => a.id);
  shuffle(deck, rnd);

  return {
    seed: seed >>> 0,
    investigatorId: inv.id,
    difficulty,
    rnd,
    bag,
    turn: 1,
    actionsLeft: diff.actions,
    actionsPerTurn: diff.actions,
    res: diff.resourceStart,          // منابع
    hp: inv.hp,
    maxHp: inv.hp,
    sanity: inv.sanity,
    maxSanity: inv.sanity,
    doom: 0,
    actIndex: 0,
    agendaIndex: 0,
    clues: 0,
    actClues: 0,
    deck: deck.slice(5),
    hand: deck.slice(0, 5),
    assetsInPlay: [],
    engaged: [],                       // دشمنان درگیر
    log: [],
    lastTest: null,
    phase: 'act',                      // act | over
    winner: null
  };
}

function shuffle(a, rnd) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function investigatorOf(g) {
  return INVESTIGATORS.find(i => i.id === g.investigatorId) || INVESTIGATORS[0];
}

/** مهارت مؤثر با احتساب دارایی‌های در بازی */
export function effectiveStat(g, stat) {
  const base = investigatorOf(g).stats[stat] || 0;
  const bonus = g.assetsInPlay.reduce((sum, id) => sum + (ASSET_BY_ID[id]?.stats?.[stat] || 0), 0);
  return base + bonus;
}

export function maxHpOf(g) {
  const extra = g.assetsInPlay.reduce((s, id) => s + (ASSET_BY_ID[id]?.hp || 0), 0);
  return investigatorOf(g).hp + extra;
}
export function maxSanityOf(g) {
  const extra = g.assetsInPlay.reduce((s, id) => s + (ASSET_BY_ID[id]?.sanity || 0), 0);
  return investigatorOf(g).sanity + extra;
}

/* ------------------------------ کیسهٔ آشوب ------------------------------ */

/** برداشتن نشانه از کیسه — برمی‌گرداند { token, autoFail, value } */
export function pullToken(game) {
  const id = game.bag[Math.floor(game.rnd() * game.bag.length)];
  const token = CHAOS_TOKENS.find(t => t.id === id);
  return { token, autoFail: !!token.autoFail, value: token.value ?? 0 };
}

/* ------------------------------ آزمون مهارت ------------------------------ */

/**
 * آزمون: مهارت + نشانه ≥ دشواری.
 * commit: شناسهٔ کارت‌هایی که از دست همراه می‌کنی (+۱ هر کارت)
 */
export function skillTest(game, { stat, difficulty, commit = [], label = '' }) {
  if (game.phase === 'over') return { ok: false, error: 'بازی تمام شده.' };
  const validCommits = commit.filter(id => game.hand.includes(id));
  const base = effectiveStat(game, stat);
  const pull = pullToken(game);
  const bonus = validCommits.length;
  const total = base + bonus + pull.value;
  const success = !pull.autoFail && total >= difficulty;

  const test = {
    stat, difficulty, base, bonus,
    token: pull.token.id, tokenLabel: pull.token.label,
    tokenValue: pull.value, autoFail: pull.autoFail,
    total, success, label
  };
  return { ok: true, test, commits: validCommits };
}

/* ------------------------------ کنش‌ها ------------------------------ */

/** بررسی — سرنخ جمع می‌کند (هوش) */
export function investigate(game, commit = []) {
  if (game.phase !== 'act') return { ok: false, error: 'الان وقت کنش نیست.' };
  if (game.actionsLeft <= 0) return { ok: false, error: 'کنشی نمانده — نوبت عوض می‌شود.' };

  const next = cloneArkham(game);
  const act = ACTS[next.actIndex];
  const r = skillTest(next, { stat: 'intellect', difficulty: 2, commit, label: 'بررسی' });
  if (!r.ok) return r;

  removeCommits(next, r.commits);
  next.lastTest = r.test;
  next.actionsLeft -= 1;

  if (r.test.success) {
    next.clues += 1;
    next.actClues += 1;
    next.log = [...next.log, { turn: next.turn, text: `بررسی موفق — یک سرنخ (${next.actClues}/${act.need})` }];
    // پیشرفت پرده
    if (next.actClues >= act.need) advanceAct(next);
  } else {
    next.log = [...next.log, { turn: next.turn, text: 'بررسی ناموفق' }];
  }

  // هول فقط وقتی آزمون شکست خورده باشد و نشانه بد باشد
  // پرک دیزی: هول بررسی فقط با نشانهٔ چادر نمی‌آید
  const daiseyGrace = investigatorOf(next).id === 'daisey';
  const badToken = ['skull', 'cultist', 'tentacle'].includes(r.test.token);
  if (!r.test.success && badToken && !(daiseyGrace && r.test.token !== 'tentacle')) {
    takeHorror(next, 1);
  }
  return { ok: true, game: afterAction(next), test: r.test };
}

/** نبرد — آسیب به دشمن درگیر (نبرد) */
export function fight(game, targetUid = null, commit = []) {
  if (game.phase !== 'act') return { ok: false, error: 'الان وقت کنش نیست.' };
  if (game.actionsLeft <= 0) return { ok: false, error: 'کنشی نمانده.' };
  const alive = game.engaged.filter(e => e.hp > 0);
  if (!alive.length) return { ok: false, error: 'دشمنی برای نبرد نیست.' };

  const next = cloneArkham(game);
  const target = next.engaged.find(e => e.uid === targetUid && e.hp > 0) || next.engaged.find(e => e.hp > 0);
  const enemy = ENEMIES.find(e => e.id === target.id);

  const r = skillTest(next, { stat: 'combat', difficulty: enemy.fight, commit, label: 'نبرد' });
  if (!r.ok) return r;
  removeCommits(next, r.commits);
  next.lastTest = r.test;
  next.actionsLeft -= 1;

  const inv = investigatorOf(next);
  if (r.test.success) {
    // پرک رولند: نبرد +۱ جانِ بیشتر در کشتن
    const dmg = inv.id === 'roland' ? 2 : 1;
    target.hp -= dmg;
    next.log = [...next.log, { turn: next.turn, text: `نبرد موفق — ${dmg} آسیب به ${enemy.name}` }];
    if (target.hp <= 0) {
      next.engaged = next.engaged.filter(e => e.uid !== target.uid);
      next.log = [...next.log, { turn: next.turn, text: `${enemy.name} از پا افتاد` }];
    }
  } else {
    target.hp = target.hp;   // بی‌اثر
    next.log = [...next.log, { turn: next.turn, text: `نبرد ناموفق با ${enemy.name}` }];
  }
  if (!r.test.success && ['skull', 'cultist', 'tentacle'].includes(r.test.token)) takeHorror(next, 1);
  return { ok: true, game: afterAction(next), test: r.test };
}

/** فرار — دشمن را از درگیری خارج می‌کند (چابکی) */
export function evade(game, targetUid = null, commit = []) {
  if (game.phase !== 'act') return { ok: false, error: 'الان وقت کنش نیست.' };
  if (game.actionsLeft <= 0) return { ok: false, error: 'کنشی نمانده.' };
  const alive = game.engaged.filter(e => e.hp > 0);
  if (!alive.length) return { ok: false, error: 'دشمنی درگیر نیست.' };

  const next = cloneArkham(game);
  const target = next.engaged.find(e => e.uid === targetUid && e.hp > 0) || next.engaged.find(e => e.hp > 0);
  const enemy = ENEMIES.find(e => e.id === target.id);
  const r = skillTest(next, { stat: 'agility', difficulty: enemy.evade, commit, label: 'فرار' });
  if (!r.ok) return r;
  removeCommits(next, r.commits);
  next.lastTest = r.test;
  next.actionsLeft -= 1;

  if (r.test.success) {
    next.engaged = next.engaged.filter(e => e.uid !== target.uid);
    next.log = [...next.log, { turn: next.turn, text: `از ${enemy.name} فرار کردی` }];
  } else {
    next.log = [...next.log, { turn: next.turn, text: `فرار از ${enemy.name} نشد` }];
  }
  if (!r.test.success && ['skull', 'cultist', 'tentacle'].includes(r.test.token)) takeHorror(next, 1);
  return { ok: true, game: afterAction(next), test: r.test };
}

/** بازی کارت دارایی از دست */
export function playAsset(game, cardId) {
  if (game.phase !== 'act') return { ok: false, error: 'الان وقت کنش نیست.' };
  if (game.actionsLeft <= 0) return { ok: false, error: 'کنشی نمانده.' };
  if (!game.hand.includes(cardId)) return { ok: false, error: 'این کارت در دستت نیست.' };

  const card = ASSET_BY_ID[cardId];
  if (!card) return { ok: false, error: 'کارت ناشناخته.' };
  if (game.res < card.cost) return { ok: false, error: `منبع کافی نداری (${card.cost} لازم است).` };

  // اسلات: هر اسلات فقط یک کارت
  const used = game.assetsInPlay.map(id => ASSET_BY_ID[id]?.slots);
  if (card.slots && used.includes(card.slots)) {
    return { ok: false, error: 'آن اسلات پر است.' };
  }

  const next = cloneArkham(game);
  next.res -= card.cost;
  next.hand = next.hand.filter(id => id !== cardId);
  next.assetsInPlay = [...next.assetsInPlay, cardId];
  next.actionsLeft -= 1;
  next.log = [...next.log, { turn: next.turn, text: `«${card.name}» را بازی کردی` }];
  return { ok: true, game: afterAction(next) };
}

/** استراحت — جان و روان را کمی برمی‌گرداند و از دسترس دشمن دور می‌شود */
export function rest(game) {
  if (game.phase !== 'act') return { ok: false, error: 'الان وقت کنش نیست.' };
  if (game.actionsLeft <= 0) return { ok: false, error: 'کنشی نمانده.' };

  const next = cloneArkham(game);
  next.actionsLeft -= 1;
  next.hp = Math.min(maxHpOf(next), next.hp + 1);
  next.sanity = Math.min(maxSanityOf(next), next.sanity + 2);
  next.log = [...next.log, { turn: next.turn, text: 'نفس تازه — روان +۲، جان +۱' }];
  return { ok: true, game: afterAction(next) };
}

/** کشیدن کارت از دسته */
export function drawCard(game) {
  if (game.phase !== 'act') return { ok: false, error: 'الان وقت کنش نیست.' };
  if (game.actionsLeft <= 0) return { ok: false, error: 'کنشی نمانده.' };
  if (!game.deck.length) return { ok: false, error: 'دسته خالی است.' };

  const next = cloneArkham(game);
  const top = next.deck[0];
  next.deck = next.deck.slice(1);
  next.hand = [...next.hand, top];
  next.res += 1;
  next.actionsLeft -= 1;
  next.log = [...next.log, { turn: next.turn, text: `«${ASSET_BY_ID[top]?.name}» به دستت آمد` }];
  return { ok: true, game: afterAction(next) };
}

/** پایان نوبت: عذاب، درگیری، نوبت بعد */
export function endTurn(game) {
  if (game.phase !== 'act') return { ok: false, error: 'بازی تمام شده.' };

  const next = cloneArkham(game);

  // دشمنان درگیر حمله می‌کنند — اما هر دشمن هر نوبت حمله نمی‌کند.
  // نشانهٔ حمله با شمارهٔ نوبت تعیین می‌شود تا قابل پیش‌بینی باشد.
  for (const e of next.engaged.filter(e => e.hp > 0)) {
    const enemy = ENEMIES.find(x => x.id === e.id);
    const strikes = (next.turn + e.hp) % 2 === 0;
    if (!strikes) continue;
    next.hp -= enemy.damage;
    next.sanity -= enemy.horror;
    next.log = [...next.log, {
      turn: next.turn,
      text: `${enemy.name} حمله کرد — ${enemy.damage} آسیب، ${enemy.horror} هول`
    }];
  }

  // شکست با جان یا روان
  if (next.hp <= 0) { next.hp = 0; return { ok: true, game: loseGame(next, 'جانت تمام شد') }; }
  if (next.sanity <= 0) { next.sanity = 0; return { ok: true, game: loseGame(next, 'روانت شکست') }; }

  // عذاب روی اجندا
  next.doom += 1;

  // هر بار که اجندا یک عذاب می‌گیرد، احتمال ظهور دشمن هست
  // (در Arkham LCG بخشی از فاز Mythos است)
  if (next.doom % 3 === 0 && next.engaged.length < 1) {
    const r = spawnEnemy(next);
    Object.assign(next, r);
    next.engaged = r.engaged;
    next.log = r.log;
  }
  const agenda = AGENDAS[next.agendaIndex];
  if (next.doom >= agenda.doomMax) {
    // اجندا پر شد: یا اجندای بعدی، یا باخت
    if (next.agendaIndex >= AGENDAS.length - 1) {
      return { ok: true, game: loseGame(next, 'آیین کامل شد') };
    }
    next.agendaIndex += 1;
    next.doom = 0;
    next.log = [...next.log, { turn: next.turn, text: `${AGENDAS[next.agendaIndex].name} آغاز شد` }];
  }

  // نوبت بعد، کارت تازه
  next.turn += 1;
  next.actionsLeft = next.actionsPerTurn;
  if (next.deck.length) {
    next.hand = [...next.hand, next.deck[0]];
    next.deck = next.deck.slice(1);
  }
  next.log = [...next.log, { turn: next.turn, text: `نوبت ${next.turn}` }];
  return { ok: true, game: afterTurn(next) };
}

/* ------------------------------ درونی ------------------------------ */

function afterAction(next) {
  if (next.phase === 'over') return next;
  if (next.actionsLeft > 0) return next;
  // کنش‌ها تمام شد — نوبت خودکار بسته می‌شود
  return endTurn(next).game;
}

function afterTurn(next) {
  if (next.phase === 'over') return next;
  // اگر کاری نمانده و جان/روان در خطر است، همان‌جا باخت
  if (next.hp <= 0 || next.sanity <= 0) {
    return loseGame(next, next.hp <= 0 ? 'جان' : 'روان');
  }
  return next;
}

function advanceAct(next) {
  const act = ACTS[next.actIndex];
  next.log = [...next.log, { turn: next.turn, text: `${act.name} کامل شد` }];
  if (next.actIndex >= ACTS.length - 1) {
    next.phase = 'over';
    next.winner = 'investigator';
    next.log = [...next.log, { turn: next.turn, text: 'آیین شکست — شهر نجات یافت' }];
    return;
  }
  next.actIndex += 1;
  next.actClues = 0;
  if (next.agendaIndex < AGENDAS.length - 1) {
    next.agendaIndex += 1;
    next.doom = 0;
  }
  next.log = [...next.log, { turn: next.turn, text: `${ACTS[next.actIndex].name} آغاز شد` }];
}

function loseGame(next, why) {
  next.phase = 'over';
  next.winner = 'mythos';
  next.log = [...next.log, { turn: next.turn, text: why }];
  return next;
}

function removeCommits(next, commits) {
  next.hand = next.hand.filter(id => !commits.includes(id));
}

function takeHorror(next, n) {
  next.sanity -= n;
  // پرک آگنس: هر هولی که می‌گیرد، دشمن درگیر را زخمی می‌کند
  if (next.investigatorId === 'agnes' && next.engaged.length) {
    const victim = next.engaged.find(e => e.hp > 0);
    if (victim) {
      victim.hp -= 1;
      if (victim.hp <= 0) {
        next.engaged = next.engaged.filter(e => e.uid !== victim.uid);
        next.log = [...next.log, { turn: next.turn, text: 'انتقام آگنس — دشمن افتاد' }];
      }
    }
  }
  if (next.sanity <= 0) {
    next.sanity = 0;
    loseGame(next, 'روانت شکست');
  }
}

/* ------------------------------ کمکی ------------------------------ */

export function cloneArkham(g) {
  return {
    ...g,
    bag: [...g.bag],
    deck: [...g.deck],
    hand: [...g.hand],
    assetsInPlay: [...g.assetsInPlay],
    engaged: g.engaged.map(e => ({ ...e })),
    log: [...g.log]
  };
}

export function isOver(g) { return g.phase === 'over'; }
export function currentAct(g) { return ACTS[g.actIndex] || ACTS[ACTS.length - 1]; }
export function currentAgenda(g) { return AGENDAS[g.agendaIndex] || AGENDAS[AGENDAS.length - 1]; }
export function spawnEnemy(game, enemyId = null) {
  const next = cloneArkham(game);
  const e = enemyId
    ? ENEMIES.find(x => x.id === enemyId)
    : ENEMIES[Math.floor(next.rnd() * ENEMIES.length)];
  const uid = `${e.id}-${next.turn}-${next.engaged.length}`;
  next.engaged = [...next.engaged, { uid, id: e.id, hp: e.hp, maxHp: e.hp, damage: e.damage, horror: e.horror }];
  next.log = [...next.log, { turn: next.turn, text: `${e.name} ظاهر شد` }];
  return next;
}

export function scoreOf(g) {
  if (g.winner !== 'investigator') return 0;
  return Math.max(10,
    (ACTS.length - g.actIndex) * 60 + g.clues * 20 +
    g.hp * 4 + g.sanity * 4 - g.turn * 3
  );
}

export const RULES = {
  steps: [
    'هر نوبت سه کنش داری: بررسی (هوش)، نبرد (نبرد)، فرار (چابکی)، بازی کارت یا کشیدن کارت.',
    'هر آزمون به کیسهٔ آشوب دست می‌برد: مهارت + نشانه باید به دشواری برسد. نشانهٔ چادر همیشه شکست است.',
    'نشانهٔ جمجمه/فرقه/چادر یک هول اضافه هم می‌دهد — حتی اگر موفق شده باشی.',
    'بررسی سرنخ می‌دهد. پر شدن سرنخ‌های پرده، تو را به پردهٔ بعد می‌برد. پردهٔ سوم = برد.',
    'پایان نوبت: هر دشمن درگیر حمله می‌کند، سپس اجندا یک عذاب می‌گیرد. پر شدن اجندا آیین را پیش می‌برد.',
    'جان یا روان به صفر برسد باختی. اجندای آخر پر شود هم باختی.'
  ],
  example: 'مثال: هوش ۳، دشواری بررسی ۳. نشانهٔ −۱ می‌آید: ۳−۱=۲ < ۳ → ناموفق. با نشانهٔ صفر، ۳ ≥ ۳ → موفق. با نشانهٔ چادر، حتی با مهارت ۵ هم شکست می‌خوری.',
  note: 'کارت‌های همراه را می‌توانی پیش از آزمون خرج کنی: هر کارت +۱. دارایی‌های در بازی مهارت و ظرفیت جان/روان را بالا می‌برند.'
};
