/* ============================================================
   «شب‌های محاصره» — تقلید This War of Mine
   سه بازمانده در شهری محاصره‌شده. روزها کار می‌کنی، شب‌ها رویداد
   می‌آید. منابع محدود است و هر تصمیم کسی را قربانی می‌کند.

   چرخهٔ یک روز:
   ۱. صبح: هر بازمانده غذا و دارو نیاز دارد (گرسنگی/زخم بالا می‌رود)
   ۲. روز: یک «کار روز» انتخاب می‌کنی (چوب، غذا، دارو، استحکام)
   ۳. شب: یک کارت رویداد می‌آید — یا تصمیم اخلاقی است یا حمله
   ۴. پایان روز: ذخیره‌ها بازبینی و روز بعد

   باخت: همهٔ بازمانده‌ها بمیرند
   برد: زنده ماندن تا پایان روز دوازدهم
   ============================================================ */

import { mulberry32 } from '../core.js';

export const DAYS = 12;

/** منابع */
export const RESOURCES = {
  food:  { id: 'food',  name: 'غذا',   glyph: '◍', hex: '#7a6a3a' },
  wood:  { id: 'wood',  name: 'چوب',   glyph: '▤', hex: '#6b4a2f' },
  meds:  { id: 'meds',  name: 'دارو',  glyph: '✚', hex: '#8a3b3b' },
  parts: { id: 'parts', name: 'قطعات', glyph: '⬢', hex: '#4a5a6b' }
};

export const SURVIVORS = [
  { id: 'bruno', name: 'برونو', role: 'سازنده', skill: 'build', hex: '#6b5a3a' },
  { id: 'anya',  name: 'آنیا',  role: 'پرستار', skill: 'heal',  hex: '#7a4a5a' },
  { id: 'marko', name: 'مارکو', role: 'کاوشگر', skill: 'scavenge', hex: '#4a5a6b' }
];

/** کارهای روز — هر کدام منبع می‌دهد و یک بازمانده را خسته می‌کند */
export const DAY_JOBS = [
  { id: 'scavenge', name: 'کاوش ویرانه', desc: 'چوب و قطعه', gives: { wood: 2, parts: 2 }, costs: { fatigue: 1 }, risk: 0.18 },
  { id: 'market', name: 'بازار سیاه', desc: '۲ غذا در برابر ۲ قطعه', gives: { food: 2 }, costs: { parts: 2, fatigue: 1 }, risk: 0 },
  { id: 'clinic', name: 'درمانگاه مخفی', desc: 'دارو بساز', gives: { meds: 1 }, costs: { wood: 2, fatigue: 1 }, risk: 0.12 },
  { id: 'barricade', name: 'استحکام‌بخشی', desc: 'خانه را امن کن', gives: { defense: 2 }, costs: { wood: 2, fatigue: 1 }, risk: 0 },
  { id: 'rest', name: 'استراحت', desc: 'خستگی هر سه را کم کن', gives: { rest: 2 }, costs: {}, risk: 0 },
  { id: 'forage', name: 'جست‌وجوی غذا', desc: 'غذا از خرابه', gives: { food: 1, wood: 1 }, costs: { fatigue: 2 }, risk: 0.2 }
];

/** کارت‌های رویداد شب */
export const NIGHT_CARDS = [
  {
    id: 'raid', kind: 'threat', title: 'حملهٔ غارتگران',
    body: 'صدای شکستن الوار می‌آید. چند نفر پشت در هستند.',
    choices: [
      { id: 'fight', label: 'مقاومت کن', effect: { wound: 1, defense: -1 }, note: 'یک زخم، ولی چیزی نمی‌برند' },
      { id: 'hide', label: 'پنهان شو', effect: { food: -2 }, note: 'دو غذا می‌برند' },
      { id: 'bribe', label: 'رشوه بده', effect: { parts: -2 }, note: 'با قطعه می‌روند' }
    ]
  },
  {
    id: 'stranger', kind: 'moral', title: 'غریبه‌ای پشت در',
    body: 'زنی با کودکی ایستاده. می‌گوید فقط یک شب جا می‌خواهد.',
    choices: [
      { id: 'help', label: 'جا بده', effect: { food: -1, morale: 2 }, note: 'غذا می‌دهی، دل‌گرمی می‌گیری' },
      { id: 'refuse', label: 'رد کن', effect: { morale: -2 }, note: 'راحت‌تر، ولی سنگین‌تر' },
      { id: 'trade', label: 'معامله کن', effect: { meds: 1, food: -2 }, note: 'دارو می‌دهد' }
    ]
  },
  {
    id: 'sick', kind: 'crisis', title: 'تب بالا',
    body: 'یکی از بازمانده‌ها می‌لرزد و عرق می‌کند.',
    choices: [
      { id: 'treat', label: 'دارو بده', effect: { meds: -1, wound: -1 }, note: 'دارو کم می‌شود' },
      { id: 'wait', label: 'صبر کن', effect: { wound: 1 }, note: 'شاید خودش خوب شود' },
      { id: 'herbs', label: 'داروی گیاهی', effect: { wood: -1, wound: 0 }, note: 'کم‌اثر ولی رایگان' }
    ]
  },
  {
    id: 'cache', kind: 'luck', title: 'انبار متروک',
    body: 'زیر آوار یک انبار کوچک پیدا کردی.',
    choices: [
      { id: 'take', label: 'همه را بردار', effect: { food: 2, wood: 2 }, note: 'سیر و گرم' },
      { id: 'share', label: 'با همسایه‌ها قسمت کن', effect: { food: 1, morale: 3 }, note: 'کمتر، ولی دل‌ها گرم' }
    ]
  },
  {
    id: 'fire', kind: 'crisis', title: 'آتش‌سوزی جزئی',
    body: 'دود از اتاق پشتی بلند می‌شود.',
    choices: [
      { id: 'fight', label: 'خاموش کن', effect: { wood: -2, wound: 1 }, note: 'جان سالم، چوب رفته' },
      { id: 'flee', label: 'بیرون بزن', effect: { food: -1, morale: -1 }, note: 'اتاق سوخت' }
    ]
  },
  {
    id: 'snow', kind: 'threat', title: 'سرمای کشنده',
    body: 'دما به زیر صفر رفته. بی چوب، یخ می‌زنید.',
    choices: [
      { id: 'burn', label: 'چوب بسوزان', effect: { wood: -3 }, note: 'گرم می‌مانید' },
      { id: 'endure', label: 'تحمل کن', effect: { wound: 2 }, note: 'سرد، ولی چوب می‌ماند' }
    ]
  },
  {
    id: 'deserter', kind: 'moral', title: 'سرباز فراری',
    body: 'مردی با یونیفرم پاره پشت در است. می‌گوید سلاح دارد.',
    choices: [
      { id: 'let', label: 'بگذار بماند', effect: { defense: 2, food: -1 }, note: 'محافظ جدید' },
      { id: 'turn', label: 'بران', effect: { morale: -1 }, note: 'خطر کمتر، وجدان سنگین' },
      { id: 'rob', label: 'سلاحش را بگیر', effect: { defense: 1, morale: -3 }, note: 'کار درستی نیست' }
    ]
  },
  {
    id: 'trade', kind: 'luck', title: 'کاروان',
    body: 'کاروانی از راه دور آمده. چیزهایی برای معامله دارد.',
    choices: [
      { id: 'food', label: 'غذا بخر', effect: { parts: -2, food: 3 }, note: 'خرید خوب' },
      { id: 'meds', label: 'دارو بخر', effect: { wood: -3, meds: 2 }, note: 'دارو گران است' },
      { id: 'skip', label: 'رد شو', effect: {}, note: 'چیزی نمی‌دهی' }
    ]
  }
];

/* ------------------------------ ساخت بازی ------------------------------ */

export function createSiege({ seed = Date.now(), difficulty = 'normal' } = {}) {
  const rnd = mulberry32(seed >>> 0);
  const diff = DIFFICULTY[difficulty] || DIFFICULTY.normal;

  return {
    seed: seed >>> 0,
    difficulty,
    rnd,
    day: 1,
    maxDays: DAYS,
    phase: 'day',          // day | night | over
    res: {
      food: 5 + diff.startBonus,
      wood: 3 + Math.max(0, diff.startBonus),
      meds: 1,
      parts: 2 + Math.max(0, diff.startBonus)
    },
    defense: 1,
    morale: 0,
    survivors: SURVIVORS.map(s => ({
      ...s,
      hp: 10,
      hunger: 0,       // ۰ خوب، ۳ گرسنه
      fatigue: 0,      // ۰ خوب، ۳ خسته
      wound: 0,        // ۰ سالم
      alive: true
    })),
    nightCard: null,
    log: [],
    winner: null,
    lastReport: null
  };
}

export const DIFFICULTY = {
  // نیاز غذا با عدد صحیح جمع می‌شود، پس باید فاصله‌ها واقعی باشند
  easy:   { label: 'آسان',   foodPer: 1, woundMul: 0.5, startBonus: 2 },
  normal: { label: 'میانه',  foodPer: 1.3, woundMul: 1.2, startBonus: 1 },
  hard:   { label: 'سخت',    foodPer: 1.7, woundMul: 1.4, startBonus: -1 }
};

/* ------------------------------ روز ------------------------------ */

/** انجام کار روزانه. jobId از DAY_JOBS. */
export function doJob(game, jobId) {
  if (game.phase !== 'day') return { ok: false, error: 'الان وقت کار روز نیست.' };
  const job = DAY_JOBS.find(j => j.id === jobId);
  if (!job) return { ok: false, error: 'چنین کاری نیست.' };

  const next = cloneSiege(game);

  // هزینه‌ها
  for (const [k, v] of Object.entries(job.costs)) {
    if (k === 'fatigue') {
      const s = pickSurvivor(next);
      if (s) s.fatigue = Math.min(4, s.fatigue + v);
    } else if ((next.res[k] || 0) < v) {
      return { ok: false, error: `${RESOURCES[k].name} کافی نداری.` };
    } else {
      next.res[k] -= v;
    }
  }

  // دستاوردها
  for (const [k, v] of Object.entries(job.gives)) {
    if (k === 'defense') next.defense += v;
    else if (k === 'rest') next.survivors.forEach(s => { if (s.alive) s.fatigue = Math.max(0, s.fatigue - v); });
    else next.res[k] = (next.res[k] || 0) + v;
  }

  // خطر
  const riskRoll = next.rnd();
  if (riskRoll < job.risk) {
    const s = pickSurvivor(next);
    if (s) s.wound += 1;
    next.lastReport = `کار «${job.name}» خطرناک بود — یک زخم`;
  } else {
    next.lastReport = `کار «${job.name}» انجام شد`;
  }

  next.log = [...next.log, { day: next.day, text: next.lastReport }];
  next.phase = 'night';
  next.nightCard = drawNightCard(next);
  return { ok: true, game: next };
}

/** کارت شب تصادفی */
export function drawNightCard(game) {
  const pool = NIGHT_CARDS;
  return pool[Math.floor(game.rnd() * pool.length)];
}

/* ------------------------------ شب ------------------------------ */

/** انتخاب گزینه در کارت شب */
export function chooseNight(game, choiceId) {
  if (game.phase !== 'night') return { ok: false, error: 'کارت شب فعال نیست.' };
  const card = game.nightCard;
  if (!card) return { ok: false, error: 'کارتی نیست.' };
  const choice = card.choices.find(c => c.id === choiceId);
  if (!choice) return { ok: false, error: 'چنین گزینه‌ای نیست.' };

  const next = cloneSiege(game);
  const survivors = next.survivors.filter(s => s.alive);

  // اثر منابع
  for (const [k, v] of Object.entries(choice.effect || {})) {
    if (k === 'defense') next.defense = Math.max(0, next.defense + v);
    else if (k === 'morale') next.morale += v;
    else if (k === 'wound') {
      const s = survivors[0];
      if (s) s.wound = Math.max(0, s.wound + v);
    } else {
      next.res[k] = Math.max(0, (next.res[k] || 0) + v);
    }
  }

  next.log = [...next.log, { day: next.day, text: `${card.title}: ${choice.label}` }];
  next.lastReport = `${card.title} — ${choice.note || choice.label}`;

  // پایان روز: نیازها
  endDay(next);
  return { ok: true, game: next };
}

/** مصرف روزانه: هر بازمانده غذا و گرما می‌خواهد */
export function endDay(game) {
  const next = game;
  const alive = next.survivors.filter(s => s.alive);
  if (!alive.length) {
    next.phase = 'over';
    next.winner = 'nobody';
    return next;
  }

  const diff = DIFFICULTY[next.difficulty] || DIFFICULTY.normal;
  const need = Math.max(1, Math.round(alive.length * diff.foodPer));

  // غذا
  if (next.res.food >= need) {
    next.res.food -= need;
    alive.forEach(s => { s.hunger = Math.max(0, s.hunger - 1); });
  } else {
    // غذای ناکافی: به نسبت تقسیم می‌شود، نه همه یا هیچ
    const perHead = next.res.food / alive.length;
    next.res.food = 0;
    alive.forEach(s => {
      if (perHead >= 1) s.hunger = Math.max(0, s.hunger - 1);
      else if (perHead >= 0.5) s.hunger = Math.min(3, s.hunger); // نه بهتر نه بدتر
      else s.hunger = Math.min(3, s.hunger + 1);
    });
    next.log = [...next.log, { day: next.day, text: 'غذا کم بود' }];
  }

  // گرما و درمان
  alive.forEach(s => {
    if (s.wound >= 2 && next.res.meds > 0) {
      next.res.meds -= 1;
      s.hp = Math.min(10, s.hp + 2);
      s.wound = Math.max(0, s.wound - 1);
    }
    // آسیب گرسنگی و زخم
    const damage = (s.hunger >= 3 ? 2 : 0)
      + (s.wound >= 2 ? Math.round(2 * diff.woundMul) : 0)
      + (s.fatigue >= 3 ? 1 : 0);
    s.hp -= damage;
    if (s.hp <= 0) {
      s.hp = 0;
      s.alive = false;
      next.log = [...next.log, { day: next.day, text: `${s.name} از پا افتاد` }];
    }
  });

  // بررسی پایان
  if (next.survivors.every(s => !s.alive)) {
    next.phase = 'over';
    next.winner = 'nobody';
    return next;
  }

  next.day += 1;
  if (next.day > next.maxDays) {
    next.phase = 'over';
    next.winner = 'survivors';
    return next;
  }
  next.phase = 'day';
  next.nightCard = null;
  return next;
}

/* ------------------------------ کمکی ------------------------------ */

function pickSurvivor(game) {
  const alive = game.survivors.filter(s => s.alive);
  if (!alive.length) return null;
  return alive[Math.floor(game.rnd() * alive.length)];
}

export function cloneSiege(g) {
  return {
    ...g,
    res: { ...g.res },
    survivors: g.survivors.map(s => ({ ...s })),
    log: [...g.log]
  };
}

export function isOver(g) { return g.phase === 'over'; }
export function aliveSurvivors(g) { return g.survivors.filter(s => s.alive); }
export function totalHp(g) { return aliveSurvivors(g).reduce((a, s) => a + s.hp, 0); }
export function needsOf(g) {
  const diff = DIFFICULTY[g.difficulty] || DIFFICULTY.normal;
  return Math.max(1, Math.round(aliveSurvivors(g).length * diff.foodPer));
}

/** امتیاز: روزهای زنده‌مانده + جان + منابع */
export function scoreOf(g) {
  if (g.winner !== 'survivors') return 0;
  return Math.max(10,
    g.day * 30 +
    totalHp(g) * 4 +
    (g.res.food + g.res.wood + g.res.meds + g.res.parts) * 3 +
    Math.max(0, g.morale) * 5
  );
}

export const RULES = {
  steps: [
    'سه بازمانده داری: برونو سازنده، آنیا پرستار، مارکو کاوشگر. هر کدام جان ۱۰ دارند.',
    'هر روز یک «کار» انتخاب می‌کنی: کاوش، بازار، درمانگاه، استحکام، استراحت یا جست‌وجوی غذا. کارها منبع می‌دهند ولی خسته و گاهی زخمی می‌کنند.',
    'شب یک کارت رویداد می‌آید — تصمیم اخلاقی، حمله یا شانس. هر گزینه پیامد خودش را دارد.',
    'پایان روز: هر بازمانده غذا می‌خواهد. اگر غذا کم بیاید گرسنه می‌شوند؛ گرسنگی و زخم جان می‌گیرد.',
    'وقتی همه بمیرند باختی. اگر تا پایان روز دوازدهم زنده بمانی، بردی.',
    'استحکام خانه جلوی غارت را می‌گیرد. اخلاق (morale) بر امتیاز اثر دارد، نه بر بقا.'
  ],
  example: 'مثال: روز سوم ۳ بازمانده داری و ۲ غذا. نیاز ۳ است. یک غذا کم می‌آید، پس هر سه گرسنه می‌شوند. اگر روز بعد هم غذا نباشد، هر کدام ۱ آسیب می‌گیرند.',
  note: 'این بازی دربارهٔ انتخاب‌های بد است، نه بردن. هیچ مسیری نیست که همه چیز را نگه دارد.'
};
