/* ============================================================
   «همراهی حلقه» — تقلید The Lord of the Rings: The Card Game
   سه قهرمان، یک حلقه، و سفری که هر مرحلهاش تهدید را بالا می‌برد.

   سازوکارهای برگرفته از LOTR LCG:
   • سه قهرمان، هر کدام با اراده/حمله/دفاع/جان — همه با هم بازی می‌کنند
   • در فاز سفر، هر بازیگر یا در «جست‌وجو» است یا «آمادهٔ نبرد»
   • هر دور: بازیکن ۱ کارت می‌کشد، سپس منطقهٔ سایه تهدید می‌آورد
   • پیشرفت سفر باید از تهدید منطقه بیشتر شود، وگرنه تهدید بالا می‌رود
   • مرحله (Stage) سه‌گانه: هر کدام نیاز پیشرفت و تهدید منفی خودش را دارد
   • اگر تهدید از هم‌ترازی (threat threshold) بگذرد، باخت
   • دشمنان «درگیر» می‌شوند و باید در نبرد پاسخ داده شوند
   ============================================================ */

import { mulberry32 } from '../core.js';

export const HEROES = [
  { id: 'aragorn', name: 'آراگورن', role: 'رهبر', will: 2, attack: 3, defense: 2, hp: 5, threat: 12, hex: '#3a4a3a' },
  { id: 'legolas', name: 'لگولاس', role: 'کماندار', will: 1, attack: 3, defense: 1, hp: 4, threat: 9, hex: '#3a4a2a' },
  { id: 'gimli', name: 'گیملی', role: 'جنگاور', will: 1, attack: 2, defense: 3, hp: 5, threat: 11, hex: '#5a3a2a' },
  { id: 'eowyn', name: 'ائووین', role: 'بانوی سپیده', will: 4, attack: 1, defense: 1, hp: 4, threat: 9, hex: '#4a3a5a' }
];

export const HERO_BY_ID = Object.fromEntries(HEROES.map(h => [h.id, h]));

/** سه مرحلهٔ سفر */
export const STAGES = [
  {
    id: 1, name: 'مرحلهٔ اول: راه بیشه', need: 6, threat: 3,
    intro: 'از بیشهٔ تاریک می‌گذرید. سایه‌ها نگاهتان می‌کنند.'
  },
  {
    id: 2, name: 'مرحلهٔ دوم: گذرگاه مه‌آلود', need: 8, threat: 5,
    intro: 'مه غلیظ است. هر قدم می‌تواند اشتباه آخر باشد.'
  },
  {
    id: 3, name: 'مرحلهٔ سوم: دروازهٔ آتش', need: 10, threat: 7,
    intro: 'آخرین در. اگر اینجا نایستی، همه‌چیز از دست می‌رود.'
  }
];

/** دشمنان */
export const ENEMIES = [
  { id: 'orc', name: 'اورک', hp: 3, attack: 2, defense: 1, threat: 2, hex: '#4a3a2a', glyph: '✖' },
  { id: 'warg', name: 'وارگ', hp: 2, attack: 3, defense: 0, threat: 1, hex: '#3a3a2a', glyph: '◆' },
  { id: 'troll', name: 'ترال', hp: 6, attack: 4, defense: 2, threat: 4, hex: '#3a2a2a', glyph: '⬛' },
  { id: 'spider', name: 'عنکبوت غول', hp: 3, attack: 2, defense: 1, threat: 3, hex: '#2a3a3a', glyph: '✳' }
];

/** کارت‌های یاری (Attachments/Allies) */
export const ALLIES = [
  { id: 'sword', name: 'شمشیر کهنه', cost: 1, attack: 1, text: 'بهترین قهرمان حمله +۱', hex: '#5a5a5a' },
  { id: 'shield', name: 'سپر بلوط', cost: 1, defense: 1, text: 'بهترین قهرمان دفاع +۱', hex: '#4a5a6a' },
  { id: 'cloak', name: 'شنل الفی', cost: 1, will: 2, text: 'ارادهٔ گروه +۲', hex: '#3a5a4a' },
  { id: 'horn', name: 'شاخ جنگ', cost: 2, threatCut: 2, text: 'تهدید −۲ هنگام بازی', hex: '#7a6a3a' },
  { id: 'healer', name: 'شفابخش', cost: 2, heal: 2, text: 'هر دور ۲ جان بازمی‌گردد', hex: '#4a6a4a' },
  { id: 'scout', name: 'پیشاهنگ', cost: 1, will: 1, text: 'اراده +۱', hex: '#5a4a2a' },
  { id: 'banner', name: 'درفش سپید', cost: 2, will: 2, text: 'ارادهٔ گروه +۲', hex: '#6a6a6a' }
];

export const ALLY_BY_ID = Object.fromEntries(ALLIES.map(a => [a.id, a]));

export const DIFFICULTY = {
  easy:   { label: 'آسان',   threatAdd: 0, startThreat: -4, handStart: 6 },
  normal: { label: 'میانه',  threatAdd: 1, startThreat: 0, handStart: 5 },
  hard:   { label: 'سخت',    threatAdd: 1, startThreat: 2, handStart: 4 }
};

export const THREAT_LIMIT = 60;
export const RESOURCES_PER_TURN = 3;

/* ------------------------------ ساخت بازی ------------------------------ */

export function createRing({ seed = Date.now(), heroIds = ['aragorn', 'legolas', 'gimli'], difficulty = 'normal' } = {}) {
  const rnd = mulberry32(seed >>> 0);
  const diff = DIFFICULTY[difficulty] || DIFFICULTY.normal;

  const heroes = heroIds
    .map(id => HERO_BY_ID[id])
    .filter(Boolean)
    .slice(0, 3);
  if (heroes.length < 2) {
    throw new Error('دست‌کم دو قهرمان لازم است.');
  }

  const startThreat = heroes.reduce((s, h) => s + h.threat, 0) + diff.startThreat;

  const deck = ALLIES.map(a => a.id);
  shuffleArr(deck, rnd);

  return {
    seed: seed >>> 0,
    heroIds: heroes.map(h => h.id),
    difficulty,
    rnd,
    round: 1,
    stageIndex: 0,
    progress: 0,          // پیشرفت در مرحلهٔ فعلی
    threat: Math.max(1, startThreat),
    res: RESOURCES_PER_TURN,
    heroes: heroes.map(h => ({ id: h.id, hp: h.hp, maxHp: h.hp, alive: true })),
    deck: deck.slice(diff.handStart),
    hand: deck.slice(0, diff.handStart),
    allies: [],           // یاری‌های در بازی
    engaged: [],          // دشمنان درگیر
    log: [],
    phase: 'plan',        // plan | quest | over
    winner: null,
    lastEvent: null
  };
}

function shuffleArr(a, rnd) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ------------------------------ ویژگی‌های گروه ------------------------------ */

/** ارادهٔ کل گروه با یاری‌ها، فقط قهرمانان زنده */
export function groupWill(g) {
  const alive = g.heroes.filter(h => h.alive);
  const base = alive.reduce((s, h) => s + (HERO_BY_ID[h.id]?.will || 0), 0);
  const bonus = g.allies.reduce((s, id) => s + (ALLY_BY_ID[id]?.will || 0), 0);
  return base + bonus;
}

export function groupAttack(g) {
  const alive = g.heroes.filter(h => h.alive);
  const base = alive.reduce((s, h) => s + (HERO_BY_ID[h.id]?.attack || 0), 0);
  const bonus = g.allies.reduce((s, id) => s + (ALLY_BY_ID[id]?.attack || 0), 0);
  return base + bonus;
}

export function groupDefense(g) {
  const alive = g.heroes.filter(h => h.alive);
  const base = alive.reduce((s, h) => s + (HERO_BY_ID[h.id]?.defense || 0), 0);
  const bonus = g.allies.reduce((s, id) => s + (ALLY_BY_ID[id]?.defense || 0), 0);
  return base + bonus;
}

export function groupHp(g) {
  return g.heroes.filter(h => h.alive).reduce((s, h) => s + h.hp, 0);
}

export function currentStage(g) { return STAGES[g.stageIndex] || STAGES[STAGES.length - 1]; }

/* ------------------------------ کارت بازی ------------------------------ */

export function playAlly(game, cardId) {
  if (game.phase === 'over') return { ok: false, error: 'بازی تمام شده.' };
  if (!game.hand.includes(cardId)) return { ok: false, error: 'این کارت در دستت نیست.' };
  const card = ALLY_BY_ID[cardId];
  if (!card) return { ok: false, error: 'کارت ناشناخته.' };
  if (game.res < card.cost) return { ok: false, error: `منبع کافی نداری (${card.cost} لازم است).` };

  const next = cloneRing(game);
  next.res -= card.cost;
  next.hand = next.hand.filter(id => id !== cardId);
  next.allies = [...next.allies, cardId];
  if (card.threatCut) next.threat = Math.max(1, next.threat - card.threatCut);
  next.log = [...next.log, { round: next.round, text: `«${card.name}» بازی شد` }];
  return { ok: true, game: next };
}

/** دور انداختن کارت برای منبع */
export function discardForResource(game, cardId) {
  if (!game.hand.includes(cardId)) return { ok: false, error: 'در دستت نیست.' };
  const next = cloneRing(game);
  next.hand = next.hand.filter(id => id !== cardId);
  next.res += 1;
  next.log = [...next.log, { round: next.round, text: 'کارت برای منبع دور انداخته شد' }];
  return { ok: true, game: next };
}

/* ------------------------------ جست‌وجو (Quest) ------------------------------ */

/**
 * فاز جست‌وجو: پیشرفت = اراده − تهدید منطقه.
 * اگر پیشرفت به نیاز مرحله برسد، مرحلهٔ بعد.
 * اگر منفی باشد، تهدید بالا می‌رود.
 */
export function quest(game) {
  if (game.phase === 'over') return { ok: false, error: 'بازی تمام شده.' };
  const next = cloneRing(game);
  const stage = currentStage(next);
  const will = groupWill(next);
  const stageThreat = stage.threat + (DIFFICULTY[next.difficulty]?.threatAdd || 0);
  const net = will - stageThreat;

  next.phase = 'plan';
  let event;

  if (net > 0) {
    next.progress += net;
    event = `جست‌وجو موفق — پیشرفت +${net} (${next.progress}/${stage.need})`;
    if (next.progress >= stage.need) {
      if (next.stageIndex >= STAGES.length - 1) {
        next.phase = 'over';
        next.winner = 'fellowship';
        next.log = [...next.log, { round: next.round, text: event },
          { round: next.round, text: 'دروازه بسته شد — پیروزی' }];
        next.lastEvent = event;
        return { ok: true, game: next };
      }
      next.stageIndex += 1;
      next.progress = 0;
      next.log = [...next.log, { round: next.round, text: event },
        { round: next.round, text: `${STAGES[next.stageIndex].name} آغاز شد` }];
      next.lastEvent = event;
      return { ok: true, game: next };
    }
  } else {
    // اگر اراده دقیقاً برابر تهدید باشد، دست‌کم ۱ تهدید اضافه می‌شود
    // تا بازی هرگز در «صفر خنثی» قفل نشود
    const penalty = Math.max(1, Math.abs(net));
    next.threat += penalty;
    event = net === 0
      ? 'جست‌وجو خنثی — تهدید +۱'
      : `جست‌وجو ناکام — تهدید +${penalty}`;
  }

  next.log = [...next.log, { round: next.round, text: event }];
  next.lastEvent = event;

  // دشمن جدید
  const spawn = next.rnd();
  if (spawn < 0.4 && next.engaged.length < 2) {
    const e = ENEMIES[Math.floor(next.rnd() * ENEMIES.length)];
    next.engaged = [...next.engaged, {
      uid: `${e.id}-${next.round}`, id: e.id, hp: e.hp, maxHp: e.hp
    }];
    next.threat += e.threat;
    next.log = [...next.log, { round: next.round, text: `${e.name} درگیر شد (تهدید +${e.threat})` }];
  }

  return { ok: true, game: checkLoss(next) };
}

/* ------------------------------ نبرد ------------------------------ */

export function attackEnemy(game, uid = null) {
  if (game.phase === 'over') return { ok: false, error: 'بازی تمام شده.' };
  const alive = game.engaged.filter(e => e.hp > 0);
  if (!alive.length) return { ok: false, error: 'دشمنی درگیر نیست.' };

  const next = cloneRing(game);
  const target = next.engaged.find(e => e.uid === uid && e.hp > 0) || next.engaged.find(e => e.hp > 0);
  const base = ENEMIES.find(e => e.id === target.id);
  const dmg = Math.max(1, groupAttack(next) - base.defense);
  target.hp -= dmg;

  if (target.hp <= 0) {
    next.engaged = next.engaged.filter(e => e.uid !== target.uid);
    // تهدید از کشتن کم نمی‌شود — دشمنان جای خود را به دیگری می‌دهند
    next.log = [...next.log, { round: next.round, text: `${base.name} شکست خورد` }];
    next.lastEvent = `${base.name} شکست خورد`;
  } else {
    next.log = [...next.log, { round: next.round, text: `${dmg} آسیب به ${base.name} (${target.hp} مانده)` }];
    next.lastEvent = `${dmg} آسیب به ${base.name}`;
  }
  return { ok: true, game: next };
}

/** دفاع در برابر حملهٔ دشمنان در پایان دور */
export function defend(game) {
  if (game.phase === 'over') return { ok: false, error: 'بازی تمام شده.' };
  const next = cloneRing(game);
  const defense = groupDefense(next);
  let total = 0;
  for (const e of next.engaged.filter(e => e.hp > 0)) {
    const base = ENEMIES.find(x => x.id === e.id);
    total += Math.max(0, base.attack - Math.floor(defense / Math.max(1, next.engaged.length)));
  }
  if (total > 0) {
    // به ضعیف‌ترین قهرمان زنده آسیب می‌رود
    const alive = next.heroes.filter(h => h.alive);
    const victim = alive.sort((a, b) => a.hp - b.hp)[0];
    if (victim) {
      victim.hp -= total;
      if (victim.hp <= 0) {
        victim.hp = 0;
        victim.alive = false;
        next.log = [...next.log, { round: next.round, text: `${HERO_BY_ID[victim.id].name} از پا افتاد` }];
      }
    }
    next.log = [...next.log, { round: next.round, text: `دشمنان ${total} آسیب زدند` }];
    next.lastEvent = `${total} آسیب`;
  } else {
    next.lastEvent = 'دفاع کامل';
    next.log = [...next.log, { round: next.round, text: 'دفاع کامل' }];
  }

  // همهٔ قهرمانان مردند
  if (next.heroes.every(h => !h.alive)) {
    next.phase = 'over'; next.winner = 'shadow';
    next.log = [...next.log, { round: next.round, text: 'همه از پا افتادند' }];
    return { ok: true, game: next };
  }
  return { ok: true, game: checkLoss(next) };
}

/* ------------------------------ پایان دور ------------------------------ */

export function endRound(game) {
  if (game.phase === 'over') return { ok: false, error: 'بازی تمام شده.' };
  let next = cloneRing(game);

  // شفابخش
  if (next.allies.includes('healer')) {
    const hurt = next.heroes.filter(h => h.alive && h.hp < h.maxHp).sort((a, b) => a.hp - b.hp)[0];
    if (hurt) hurt.hp = Math.min(hurt.maxHp, hurt.hp + 2);
  }

  // منبع تازه
  next.res = RESOURCES_PER_TURN;

  // کارت تازه
  if (next.deck.length) {
    next.hand = [...next.hand, next.deck[0]];
    next.deck = next.deck.slice(1);
  }

  // تهدید هر دور کمی بالا می‌رود — زمان دشمن توست
  next.threat += 1;
  next.round += 1;
  next.phase = 'plan';
  next.log = [...next.log, { round: next.round, text: `دور ${next.round}` }];
  return { ok: true, game: checkLoss(next) };
}

/* ------------------------------ درونی ------------------------------ */

function checkLoss(next) {
  if (next.phase === 'over') return next;
  if (next.threat >= THREAT_LIMIT) {
    next.phase = 'over';
    next.winner = 'shadow';
    next.log = [...next.log, { round: next.round, text: 'تهدید از هم‌ترازی گذشت — سایه چیره شد' }];
    return next;
  }
  if (next.heroes.every(h => !h.alive)) {
    next.phase = 'over';
    next.winner = 'shadow';
    next.log = [...next.log, { round: next.round, text: 'هیچ قهرمانی نماند' }];
  }
  return next;
}

export function cloneRing(g) {
  return {
    ...g,
    heroes: g.heroes.map(h => ({ ...h })),
    deck: [...g.deck],
    hand: [...g.hand],
    allies: [...g.allies],
    engaged: g.engaged.map(e => ({ ...e })),
    log: [...g.log]
  };
}

export function isOver(g) { return g.phase === 'over'; }

export function scoreOf(g) {
  if (g.winner !== 'fellowship') return 0;
  return Math.max(10,
    (STAGES.length - g.stageIndex) * 70 +
    (THREAT_LIMIT - g.threat) * 2 +
    groupHp(g) * 5 -
    g.round * 3
  );
}

export const RULES = {
  steps: [
    'سه قهرمان داری و همه با هم می‌جنگند: اراده برای جست‌وجو، حمله برای زدن دشمن، دفاع برای گریز از آسیب.',
    'هر دور سه منبع داری. کارت یاری بخر تا اراده/حمله/دفاع بالا برود. کارت اضافه را می‌توانی برای ۱ منبع دور بیندازی.',
    'جست‌وجو کن: پیشرفت = ارادهٔ گروه − تهدید مرحله. اگر مثبت باشد پیشرفت می‌کنی، اگر منفی باشد تهدید بالا می‌رود.',
    'پیشرفت به نیاز مرحله برسد، مرحلهٔ بعد آغاز می‌شود. سه مرحله تمام شود، بردی.',
    'دشمنان درگیر می‌شوند و تهدید اضافه می‌کنند. با حمله نابودشان کن تا تهدید برگردد.',
    'پایان دور، دشمنان حمله می‌کنند. تهدید به ۵۰ برسد یا همهٔ قهرمانان بیفتند، باختی.'
  ],
  example: 'مثال: آراگورن (اراده ۲)، لگولاس (۱)، گیملی (۱) → ارادهٔ گروه ۴. مرحلهٔ اول تهدید ۲ دارد، پس پیشرفت ۴−۲=۲. با هفت دور چنین، نیاز ۸ پر می‌شود. اما اگر «شنل الفی» بخری، اراده ۵ می‌شود و هر دور ۳ پیشرفت می‌گیری.',
  note: 'تهدید همیشه بالا می‌رود؛ هیچ راهی برای کم کردنش نیست جز کشتن دشمنان و کارت «شاخ جنگ». پس نباید دشمنان را زیاد کنی.'
};
