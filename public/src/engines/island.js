/* ============================================================
   «جزیرهٔ گم‌شده» — تقلید Robinson Crusoe: Curse of the Island
   یک کشتی‌شکسته روی ساحل. باید پیش از آمدن زمستان، اردوگاه را
   بسازی و از جزیره بیرون بزنی.

   قواعد بر پایهٔ Robinson Crusoe:
   • هر دور ۲ کنش دارید (کار، اکتشاف، ساخت‌وساز، استراحت)
   • هر کنش یک تاس سرنوشت می‌اندازد؛ نتیجه با دشواری مقایسه می‌شود
   • سه سطح «سلامت»: جان، روحیه، آذوقه — هر کدام ته بکشد می‌بازی
   • ساخت‌وساز: چوب + سنگ → سرپناه/قایق
   • اکتشاف: کارت ماجراجویی می‌آورد که یا یاری است یا بلا
   • پایان دور: آذوقه می‌سوزد، زخم‌ها می‌سایند
   • برد: ساختن قایق و رسیدن به آب‌های آزاد پیش از پایان دور ۱۰

   این نسخه در مقیاس کوچک‌تر: ۱۰ دور، ۳ اردوگاه، ۱۲ کارت ماجراجویی.
   ============================================================ */

import { mulberry32 } from '../core.js';

export const ROUNDS = 10;
export const ACTIONS_PER_ROUND = 2;

/** منابع جزیره */
export const GOODS = {
  wood:  { id: 'wood',  name: 'چوب',  glyph: '▤', hex: '#6b4a2f' },
  stone: { id: 'stone', name: 'سنگ',  glyph: '◆', hex: '#6b6b6b' },
  food:  { id: 'food',  name: 'آذوقه', glyph: '◍', hex: '#7a6a3a' },
  rope:  { id: 'rope',  name: 'طناب', glyph: '∿', hex: '#8a7040' }
};

/** اردوگاه — ساخت‌وسازها */
export const BUILDS = [
  {
    id: 'shelter', name: 'سرپناه', cost: { wood: 3, rope: 1 }, rounds: 1,
    effect: 'هر دور ۱ آسیب کمتر', hex: '#6b5a3a'
  },
  {
    id: 'fire', name: 'آتشگاه', cost: { wood: 2, stone: 2 }, rounds: 1,
    effect: 'آذوقهٔ پایان دور نصف می‌شود', hex: '#8a5a2a'
  },
  {
    id: 'raft', name: 'قایق', cost: { wood: 4, rope: 2, stone: 2 }, rounds: 2,
    effect: 'شرط برد — با آب‌های آزاد', hex: '#3a5a6b'
  },
  {
    id: 'trap', name: 'تله', cost: { wood: 2, rope: 1 }, rounds: 1,
    effect: 'هر دور ۱ آذوقه', hex: '#5a6b3a'
  }
];

/** کنش‌های پایه */
export const ACTIONS = [
  { id: 'gather', name: 'هیزم', desc: 'چوب و سنگ', skill: 'strength', diff: 3 },
  { id: 'hunt', name: 'شکار', desc: 'آذوقه', skill: 'resolve', diff: 3 },
  { id: 'explore', name: 'اکتشاف', desc: 'کارت ماجراجویی', skill: 'resolve', diff: 4 },
  { id: 'build', name: 'ساخت', desc: 'ساخت‌وسازی', skill: 'craft', diff: 0 },
  { id: 'rest', name: 'استراحت', desc: 'جان', skill: 'none', diff: 0 }
];

/** مهارت‌های چهارگانه */
export const SKILLS = {
  strength: { id: 'strength', name: 'زور', icon: '⚔' },
  resolve:  { id: 'resolve',  name: 'اراده', icon: '✦' },
  craft:    { id: 'craft',    name: 'ساخت', icon: '⚒' }
};

/** کارت‌های ماجراجویی */
export const ADVENTURES = [
  { id: 'spring', title: 'چشمهٔ تازه', kind: 'boon', text: 'آبی زلال پیدا کردی.', effect: { food: 2, morale: 1 } },
  { id: 'boar', title: 'گراز وحشی', kind: 'boon', text: 'شکاری چاق.', effect: { food: 3 } },
  { id: 'driftwood', title: 'الوار ساحلی', kind: 'boon', text: 'دریا چوب آورده.', effect: { wood: 2 } },
  { id: 'shells', title: 'صدف‌ها', kind: 'boon', text: 'طناب از الیاف گیاهی.', effect: { rope: 2 } },
  { id: 'ruins', title: 'ویرانهٔ کشتی', kind: 'boon', text: 'چیزهایی از کشتی دیگر.', effect: { wood: 1, stone: 2 } },
  { id: 'snake', title: 'مار زنگی', kind: 'peril', text: 'یک زخم، ولی راهی پیدا شد.', effect: { wound: 1, stone: 1 } },
  { id: 'storm', title: 'طوفان ناگهانی', kind: 'peril', text: 'آذوقه را باد برد.', effect: { food: -2 } },
  { id: 'cave', title: 'غار تاریک', kind: 'peril', text: 'ترس و تاریکی.', effect: { morale: -2 } },
  { id: 'fever', title: 'تب باتلاقی', kind: 'peril', text: 'بدنت می‌سوزد.', effect: { wound: 2 } },
  { id: 'thieves', title: 'دزدان شب', kind: 'peril', text: 'کسی چوب‌ها را برد.', effect: { wood: -2 } },
  { id: 'map', title: 'نقشهٔ کهنه', kind: 'boon', text: 'راه میان‌بُر پیدا کردی.', effect: { morale: 2, food: 1 } },
  { id: 'friend', title: 'طوطی سخنگو', kind: 'boon', text: 'همراهی پیدا کردی.', effect: { morale: 3 } }
];

export const DIFFICULTY = {
  // سختی اصلی از تعداد دور می‌آید: قایق باید پیش از پایان دورها ساخته شود.
  // dice = تاس اضافه بر ۱، startBonus = منابع شروع، foodBurn = آذوقهٔ پایان دور
  easy:   { label: 'آسان',   rounds: 12, dice: 2, startBonus: 2, foodBurn: 1, hpStart: 12 },
  normal: { label: 'میانه',  rounds: 10, dice: 1, startBonus: 1, foodBurn: 2, hpStart: 10 },
  hard:   { label: 'سخت',    rounds: 8,  dice: 0, startBonus: 0, foodBurn: 2, hpStart: 9 }
};

/* ------------------------------ ساخت بازی ------------------------------ */

export function createIsland({ seed = Date.now(), difficulty = 'normal' } = {}) {
  const rnd = mulberry32(seed >>> 0);
  const diff = DIFFICULTY[difficulty] || DIFFICULTY.normal;

  return {
    seed: seed >>> 0,
    difficulty,
    rnd,
    round: 1,
    maxRounds: diff.rounds,
    phase: 'act',               // act | build | over
    actionsLeft: ACTIONS_PER_ROUND,
    res: {
      wood: 2 + diff.startBonus,
      stone: 1,
      food: 3 + diff.startBonus,
      rope: 1
    },
    hp: diff.hpStart,
    maxHp: diff.hpStart + 2,
    morale: 8,
    wound: 0,
    built: [],                  // شناسهٔ ساخت‌وسازه‌ها
    building: null,             // { id, left }
    log: [],
    lastCard: null,
    winner: null,
    skills: { strength: 2, resolve: 2, craft: 2 }
  };
}

/* ------------------------------ کنش‌ها ------------------------------ */

/** انجام یک کنش. برمی‌گرداند { ok, game, card?, roll? } */
export function act(game, actionId, opts = {}) {
  if (game.phase !== 'act') return { ok: false, error: 'الان وقت کنش نیست.' };
  if (game.actionsLeft <= 0) return { ok: false, error: 'کنشی برایت نمانده.' };

  const action = ACTIONS.find(a => a.id === actionId);
  if (!action) return { ok: false, error: 'چنین کنشی نیست.' };

  const next = cloneIsland(game);

  // ساخت‌وساز جداگانه رسیدگی می‌شود
  if (actionId === 'build') {
    const build = BUILDS.find(b => b.id === opts.buildId);
    if (!build) return { ok: false, error: 'چنین ساخت‌وسازی نیست.' };
    if (next.built.includes(build.id)) return { ok: false, error: 'قبلاً ساخته شده.' };
    for (const [k, v] of Object.entries(build.cost)) {
      if ((next.res[k] || 0) < v) return { ok: false, error: `${GOODS[k].name} کافی نداری.` };
    }
    for (const [k, v] of Object.entries(build.cost)) next.res[k] -= v;
    next.built = [...next.built, build.id];
    next.actionsLeft -= 1;
    next.log = [...next.log, { round: next.round, text: `«${build.name}» ساخته شد` }];
    checkRaftWin(next);
    return { ok: true, game: finishRoundIfDone(next) };
  }

  if (actionId === 'rest') {
    next.hp = Math.min(next.maxHp || 12, next.hp + 2);
    next.wound = Math.max(0, next.wound - 1);
    next.morale = Math.min(10, next.morale + 1);
    next.actionsLeft -= 1;
    next.log = [...next.log, { round: next.round, text: 'استراحت کردی' }];
    return { ok: true, game: finishRoundIfDone(next) };
  }

  // کنش‌های آزمون‌محور: تاس می‌اندازیم
  const diff = DIFFICULTY[next.difficulty] || DIFFICULTY.normal;
  const diceCount = 1 + diff.dice;
  const roll = rollDice(next.rnd, diceCount);
  const bonus = next.skills[action.skill] || 0;
  const total = roll + bonus;
  const success = total >= action.diff;

  next.log = [...next.log, {
    round: next.round,
    text: `«${action.name}»: تاس ${roll} + ${action.skill === 'strength' ? 'زور' : action.skill === 'resolve' ? 'اراده' : 'ساخت'} ${bonus} = ${total} ${success ? '≥' : '<'} ${action.diff} → ${success ? 'موفق' : 'ناموفق'}`
  }];

  if (actionId === 'gather') {
    if (success) { next.res.wood += 3; next.res.stone += 1; }
    else { next.res.wood += 1; next.hp -= 1; }
  } else if (actionId === 'hunt') {
    if (success) { next.res.food += 3; }
    else { next.res.food += 1; next.wound += 1; }
  } else if (actionId === 'explore') {
    const card = ADVENTURES[Math.floor(next.rnd() * ADVENTURES.length)];
    next.lastCard = card;
    applyEffect(next, card.effect);
    next.log = [...next.log, { round: next.round, text: `ماجرا: ${card.title}` }];
    if (!success) { next.wound += 1; next.log = [...next.log, { round: next.round, text: 'اکتشاف سخت بود — یک زخم' }]; }
    next.actionsLeft -= 1;
    return { ok: true, game: finishRoundIfDone(next), card, roll: total };
  }

  next.actionsLeft -= 1;
  return { ok: true, game: finishRoundIfDone(next), roll: total, success };
}

function rollDice(rnd, n) {
  let total = 0;
  for (let i = 0; i < n; i++) total += Math.floor(rnd() * 3) + 1;   // ۱ت۳
  return total;
}

function applyEffect(next, effect) {
  for (const [k, v] of Object.entries(effect || {})) {
    if (k === 'morale') next.morale = Math.max(0, Math.min(10, next.morale + v));
    else if (k === 'wound') next.wound = Math.max(0, next.wound + v);
    else if (k === 'hp') next.hp = Math.max(0, Math.min(next.maxHp || 12, next.hp + v));
    else next.res[k] = Math.max(0, (next.res[k] || 0) + v);
  }
}

function checkRaftWin(next) {
  if (next.built.includes('raft')) {
    next.phase = 'over';
    next.winner = 'castaway';
    next.log = [...next.log, { round: next.round, text: 'قایق به آب افتاد — آزادی' }];
  }
}

/* ------------------------------ پایان دور ------------------------------ */

export function finishRoundIfDone(next) {
  if (next.phase === 'over') return next;
  if (next.actionsLeft > 0) return next;

  // پایان دور: آذوقه می‌سوزد
  const diff = DIFFICULTY[next.difficulty] || DIFFICULTY.normal;
  let burn = diff.foodBurn;
  if (next.built.includes('fire')) burn = Math.max(1, Math.floor(burn / 2));
  if (next.built.includes('shelter') && next.wound > 0) next.wound = Math.max(0, next.wound - 1);
  if (next.built.includes('trap')) next.res.food += 1;

  if (next.res.food >= burn) {
    next.res.food -= burn;
  } else {
    next.res.food = 0;
    next.hp -= 2;
    next.morale -= 1;
    next.log = [...next.log, { round: next.round, text: 'آذوقه تمام شد — گرسنگی' }];
  }

  // زخم آسیب می‌زند
  if (next.wound >= 3) {
    next.hp -= 2;
    next.log = [...next.log, { round: next.round, text: 'زخم چرک کرد' }];
  } else if (next.wound >= 1) {
    next.hp -= 1;
  }

  // باخت
  if (next.hp <= 0) {
    next.phase = 'over'; next.winner = 'island'; next.hp = 0;
    next.log = [...next.log, { round: next.round, text: 'جان به آخر رسید' }];
    return next;
  }
  if (next.morale <= 0) {
    next.phase = 'over'; next.winner = 'island'; next.morale = 0;
    next.log = [...next.log, { round: next.round, text: 'امید از دست رفت' }];
    return next;
  }

  // دور بعد
  next.round += 1;
  next.actionsLeft = ACTIONS_PER_ROUND;
  if (next.round > next.maxRounds) {
    next.phase = 'over';
    next.winner = 'island';
    next.log = [...next.log, { round: next.round, text: 'زمستان آمد — جزیره نگهت داشت' }];
  }
  return next;
}

/* ------------------------------ کمکی ------------------------------ */

export function cloneIsland(g) {
  return {
    ...g,
    res: { ...g.res },
    skills: { ...g.skills },
    built: [...g.built],
    log: [...g.log]
  };
}

export function isOver(g) { return g.phase === 'over'; }
export function canBuild(g, buildId) {
  const b = BUILDS.find(x => x.id === buildId);
  if (!b || g.built.includes(buildId)) return false;
  return Object.entries(b.cost).every(([k, v]) => (g.res[k] || 0) >= v);
}
export function progressOf(g) {
  return { raft: g.built.includes('raft'), built: g.built.length };
}
export function scoreOf(g) {
  if (g.winner !== 'castaway') return 0;
  return Math.max(10,
    (g.maxRounds - g.round + 1) * 40 +
    g.hp * 6 + g.morale * 4 +
    (g.res.wood + g.res.stone + g.res.food + g.res.rope) * 2
  );
}

export const RULES = {
  steps: [
    'هر دور ۲ کنش داری: هیزم، شکار، اکتشاف، ساخت یا استراحت.',
    'کنش‌های هیزم/شکار/اکتشاف تاس می‌اندازند. تاس + مهارت‌ات باید به دشواری برسد.',
    'ساخت‌وساز هزینهٔ چوب/سنگ/طناب دارد: سرپناه، آتشگاه، تله و قایق.',
    'پایان دور آذوقه می‌سوزد. آتشگاه مصرف را نصف می‌کند، تله آذوقه می‌دهد.',
    'زخم اگر درمان نشود هر دور جان می‌گیرد. استراحت زخم را کم می‌کند.',
    'جان یا روحیه به صفر برسد باختی. قایق بسازی و پیش از دور دهم تمام شود، بردی.'
  ],
  example: 'مثال: زور ۲ داری و هیزم می‌زنی (دشواری ۳). تاس ۲ می‌آوری: ۲+۲=۴ ≥ ۳ → موفق، ۲ چوب و ۱ سنگ. اگر تاس ۱ می‌آوردی، ۳ می‌شدی و همچنان موفق بودی؛ با تاس ۰ هیچ چوب اضافه‌ای نمی‌گرفتی و ۱ آسیب می‌خوردی.',
  note: 'قایق گران است — ۵ چوب، ۳ طناب و ۲ سنگ. بدون سرپناه و آتشگاه، معمولاً پیش از رسیدن به قایق می‌میری. اولویت‌بندی همه‌چیز است.'
};
