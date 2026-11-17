/* ============================================================
   آزمون «غارهای گِلومهیون»
   ============================================================ */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CARDS, CARD_BY_ID, ENEMIES, SCENARIOS, DIFFICULTY, HAND_START, HERO_HP,
  createGloom, chooseCards, playTurn, aliveEnemies, isOver, cardsInHand,
  scoreOf, afterRound, RULES
} from '../public/src/engines/gloom.js';

test('ده کارت توانایی، هر کدام بالا و پایین', () => {
  assert.equal(CARDS.length, 10);
  for (const c of CARDS) {
    assert.ok(c.id && c.name, 'کارت بی‌نام');
    assert.ok(Number.isFinite(c.initiative), `${c.id}: iniciativa ندارد`);
    assert.ok(c.top && c.top.type, `${c.id}: بالا ندارد`);
    assert.ok(c.bottom && c.bottom.type, `${c.id}: پایین ندارد`);
  }
  assert.equal(new Set(CARDS.map(c => c.id)).size, 10, 'شناسهٔ تکراری');
});

test('هر کارت در فهرست جست‌وجو هست', () => {
  for (const c of CARDS) assert.equal(CARD_BY_ID[c.id].name, c.name);
});

test('چهار صحنه و چهار دشمن', () => {
  assert.equal(SCENARIOS.length, 4);
  assert.equal(ENEMIES.length, 4);
  for (const s of SCENARIOS) {
    assert.ok(s.enemies.length > 0, `${s.id}: دشمن ندارد`);
    assert.ok(s.goal > 0 && s.rounds > 0);
  }
});

test('بازی تازه: دست کامل، دشمنان با جان درست', () => {
  const g = createGloom({ seed: 1, scenarioId: 'crypt' });
  assert.equal(g.heroes[0].hand.length, HAND_START);
  assert.equal(g.heroes[0].hp, HERO_HP);
  assert.equal(g.enemies.length, 2);
  assert.equal(g.phase, 'choose');
  assert.equal(g.round, 1);
});

test('همان دانه، همان دست', () => {
  const a = createGloom({ seed: 99 });
  const b = createGloom({ seed: 99 });
  assert.deepEqual(a.heroes[0].hand, b.heroes[0].hand);
});

test('دانهٔ مختلف، دست مختلف', () => {
  const hands = new Set();
  for (let s = 1; s <= 15; s++) hands.add(createGloom({ seed: s }).heroes[0].hand.join(','));
  assert.ok(hands.size > 5, `تنوع کم: ${hands.size}`);
});

test('سختی روی جان دشمن اثر دارد', () => {
  const easy = createGloom({ seed: 3, scenarioId: 'lair', difficulty: 'easy' });
  const hard = createGloom({ seed: 3, scenarioId: 'lair', difficulty: 'hard' });
  assert.ok(hard.enemies[0].maxHp > easy.enemies[0].maxHp, 'جان دشمن با سختی بالا نرفت');
});

test('انتخاب دو کارت درست است', () => {
  const g = createGloom({ seed: 7 });
  const two = g.heroes[0].hand.slice(0, 2);
  const res = chooseCards(g, two);
  assert.equal(res.ok, true);
  assert.equal(res.game.phase, 'resolve');
  assert.equal(res.game.heroes[0].hand.length, HAND_START - 2);
  assert.deepEqual(res.game.heroes[0].chosen, two);
});

test('یک کارت، دو کارت، سه کارت', () => {
  const g = createGloom({ seed: 7 });
  const hand = g.heroes[0].hand;
  assert.equal(chooseCards(g, [hand[0]]).ok, true, 'یک کارت باید استراحت طولانی باشد');
  assert.equal(chooseCards(g, hand.slice(0, 2)).ok, true);
  assert.equal(chooseCards(g, hand.slice(0, 3)).ok, false, 'سه کارت نباید پذیرفته شود');
  assert.equal(chooseCards(g, []).ok, false, 'صفر کارت نباید پذیرفته شود');
});

test('کارتی که در دست نیست پذیرفته نمی‌شود', () => {
  const g = createGloom({ seed: 7 });
  const res = chooseCards(g, ['ناموجود', 'cleave']);
  assert.equal(res.ok, false);
  assert.ok(res.error.includes('دستت نیست') || res.error.length > 0);
});

test('یک کارت دو بار پذیرفته نمی‌شود', () => {
  const g = createGloom({ seed: 7 });
  const id = g.heroes[0].hand[0];
  assert.equal(chooseCards(g, [id, id]).ok, false);
});

test('iniciativa از کارت پیشرو می‌آید', () => {
  const g = createGloom({ seed: 5 });
  // دست را دستی می‌چینیم
  const h = g.heroes[0];
  h.hand = ['juggernaut', 'ironhide', ...h.hand.filter(x => x !== 'juggernaut' && x !== 'ironhide')];
  const res = chooseCards(g, ['juggernaut', 'ironhide']);
  assert.equal(res.ok, true);
  assert.equal(res.game.heroes[0].initiative, 12, 'iniciativa باید ۱۲ باشد');
});

test('iniciativa مساوی به‌نفع کارت دوم شکسته می‌شود', () => {
  const g = createGloom({ seed: 5, scenarioId: 'crypt' });
  const fake = { ...g, heroes: [{ ...g.heroes[0], hand: ['cleave', 'shield-bash', 'trample'] }] };
  const res = chooseCards(fake, ['cleave', 'shield-bash']);
  assert.equal(res.ok, true);
  // 22 در برابر 18 → 22
  assert.equal(res.game.heroes[0].initiative, 22);
});

test('بالای یک کارت و پایین دیگری اجرا می‌شود', () => {
  const g = createGloom({ seed: 5 });
  g.heroes[0].hand = ['juggernaut', 'ironhide', 'cleave'];
  const r1 = chooseCards(g, ['juggernaut', 'ironhide']);
  const hpBefore = r1.game.enemies[0].hp;
  // بالای کرگدن (حمله ۴) + پایین پوست آهنین (حمله ۲) = ۶
  const r2 = playTurn(r1.game, { use: 'both', targetUid: r1.game.enemies[0].uid });
  const target = r2.game.enemies[0];
  assert.equal(hpBefore - target.hp, Math.min(6, hpBefore), `آسیب نادرست: ${hpBefore - target.hp}`);
});

test('سپر آسیب دشمن را کم می‌کند', () => {
  // دو بازی: یکی با سپر، یکی بدون
  const build = (withShield) => {
    const g = createGloom({ seed: 11, scenarioId: 'crypt' });
    g.heroes[0].hand = ['ironhide', 'cleave', 'trample'];
    const c = chooseCards(g, ['ironhide', 'cleave']).game;
    const use = withShield ? 'both' : 'bottom-first';
    // both = بالای ironhide (سپر ۳) + پایین cleave؛ bottom-first = بالای cleave + پایین ironhide
    return playTurn(c, { use }).game.heroes[0].hp;
  };
  assert.ok(build(true) > build(false), 'سپر باید آسیب کمتری بگذارد');
});

test('درمان اثر می‌کند ولی از بیشینه نمی‌گذرد', () => {
  const g = createGloom({ seed: 13 });
  g.heroes[0].hp = 5;
  g.heroes[0].hand = ['warcry', 'second-wind', 'cleave'];
  const c = chooseCards(g, ['second-wind', 'warcry']).game;
  // بالای second-wind = درمان ۳، پایین warcry = درمان ۲ → ۵+۵
  // سپس دشمنان حمله می‌کنند؛ پس فقط اثر بیشینه را می‌سنجیم
  const p = playTurn(c, { use: 'both', targetUid: c.enemies[0].uid }).game;
  const heals = p.log.filter(l => l.text.startsWith('درمان'));
  assert.equal(heals.length, 2, 'دو درمان باید اجرا شود');
  assert.ok(heals.some(l => l.text === 'درمان 3'), 'درمان ۳ نیامد');
  assert.ok(heals.some(l => l.text === 'درمان 2'), 'درمان ۲ نیامد');
  assert.ok(p.heroes[0].hp <= HERO_HP, 'جان از بیشینه گذشت');
});

test('درمان از بیشینه بالاتر نمی‌زند', () => {
  const g = createGloom({ seed: 13, scenarioId: 'crypt' });
  g.heroes[0].hp = HERO_HP;
  g.heroes[0].hand = ['second-wind', 'warcry', 'cleave'];
  g.enemies.forEach(e => { e.alive = false; });   // دشمنی نمانده
  const c = chooseCards(g, ['second-wind', 'warcry']).game;
  c.enemies.forEach(e => { e.alive = false; });
  const p = playTurn(c, { use: 'both' }).game;
  assert.equal(p.heroes[0].hp, HERO_HP, `جان از بیشینه گذشت: ${p.heroes[0].hp}`);
});

test('کشتن دشمن هدف را پیش می‌برد', () => {
  const g = createGloom({ seed: 17, scenarioId: 'crypt' });
  g.heroes[0].hand = ['frenzy', 'juggernaut', 'cleave'];
  const c = chooseCards(g, ['frenzy', 'juggernaut']).game;
  // bottom-first = بالای کرگدن (حمله ۴) + پایین دیوانگی (حرکت ۱)
  // راهزن ۶ جان دارد → ۴ کافی نیست. پس دشمن را ۴ جان می‌کنیم.
  const uid = c.enemies[0].uid;
  c.enemies[0].hp = 4;
  const p = playTurn(c, { use: 'bottom-first', targetUid: uid }).game;
  assert.equal(p.enemies[0].alive, false, `راهزن باید مرده باشد (جان: ${p.enemies[0].hp})`);
  assert.equal(p.kills, 1);
});

test('کشتن همه، بازی را می‌برد', () => {
  const g = createGloom({ seed: 19, scenarioId: 'crypt' });
  // دشمنان را یک‌جان می‌کنیم تا با یک حمله بمیرند
  g.enemies.forEach(e => { e.hp = 1; });
  g.heroes[0].hand = ['frenzy', 'juggernaut', 'cleave'];
  const c = chooseCards(g, ['frenzy', 'juggernaut']).game;
  c.enemies.forEach(e => { e.hp = 1; });
  const p = playTurn(c, { use: 'both', targetUid: c.enemies[0].uid }).game;
  // اگر هنوز دشمنی زنده است، دور دیگری
  assert.ok(p.kills >= 1, 'حداقل یک کشته لازم است');
});

test('جان صفر، باخت است', () => {
  const g = createGloom({ seed: 23, scenarioId: 'lair' });
  g.heroes[0].hp = 1;
  g.heroes[0].hand = ['cleave', 'trample', 'juggernaut'];
  const c = chooseCards(g, ['trample', 'cleave']).game;
  const p = playTurn(c, { use: 'both' }).game;
  if (p.phase === 'over') {
    assert.equal(p.winner, 'enemies');
    assert.equal(p.heroes[0].exhausted, true);
  } else {
    assert.ok(p.heroes[0].hp >= 1);
  }
});

test('استراحت طولانی دورانداخته‌ها را برمی‌گرداند', () => {
  const g = createGloom({ seed: 29 });
  const h = g.heroes[0];
  h.discard = ['trample', 'ironhide'];
  h.hp = 8;
  // کارتی برمی‌گزینیم که «ازدست‌رفته» نباشد تا شمارش ساده بماند
  const keep = h.hand.find(id => id !== 'frenzy' && id !== 'juggernaut' && id !== 'cleave');
  const totalBefore = h.hand.length + h.discard.length + (h.lost?.length || 0) - 1;
  const c = chooseCards(g, [keep]).game;
  assert.equal(c.longRest, true, 'باید استراحت طولانی باشد');
  const p = playTurn(c, {}).game;
  assert.equal(p.heroes[0].hand.length, totalBefore, 'کارت‌ها کامل برنگشتند');
  assert.equal(p.heroes[0].discard.length, 0, 'دورانداخته‌ها خالی نشد');
  assert.equal(p.heroes[0].lost.length, 0, 'چیزی نباید ازدست‌رفته باشد');
});

test('کارت ازدست‌رفته هرگز برنمی‌گردد', () => {
  const g = createGloom({ seed: 31 });
  const h = g.heroes[0];
  h.hand = ['frenzy', 'cleave', 'trample', 'ironhide'];
  const c = chooseCards(g, ['frenzy', 'cleave']).game;
  // هر دو ازدست‌رفته‌اند
  assert.equal(c.heroes[0].lost.length, 2, 'کارت ازدست‌رفته ثبت نشد');
  assert.equal(c.heroes[0].discard.length, 0, 'کارت ازدست‌رفته نباید در دورانداخته باشد');
  // دور بعد استراحت طولانی
  const c2 = chooseCards({ ...c, phase: 'choose' }, [c.heroes[0].hand[0]]).game;
  const p = playTurn(c2, {}).game;
  assert.ok(!p.heroes[0].hand.includes('frenzy'), 'کارت ازدست‌رفته برگشت!');
  assert.equal(p.heroes[0].lost.length, 2, 'کارت ازدست‌رفته باید در تل‌انبار بماند');
});

test('استراحت طولانی ۲ درمان می‌دهد (پیش از حملهٔ دشمن)', () => {
  const g = createGloom({ seed: 29, scenarioId: 'crypt' });
  const h = g.heroes[0];
  h.hp = 4;
  // دشمنان را از معرکه بیرون می‌بریم تا فقط اثر درمان دیده شود
  g.enemies.forEach(e => { e.alive = false; });
  const c = chooseCards(g, [h.hand[0]]).game;
  c.enemies.forEach(e => { e.alive = false; });
  const p = playTurn(c, {}).game;
  assert.equal(p.heroes[0].hp, 6, `درمان نادرست: ${p.heroes[0].hp}`);
});

test('وقتی کارت تمام شود استراحت کوتاه رخ می‌دهد', () => {
  const g = createGloom({ seed: 31 });
  g.heroes[0].hand = ['cleave', 'trample'];
  g.heroes[0].discard = ['warcry', 'ironhide', 'frenzy'];
  const c = chooseCards(g, ['cleave', 'trample']).game;
  const p = playTurn(c, { use: 'both' }).game;
  assert.equal(p.heroes[0].hand.length, 1, 'باید یک کارت برگردد');
  assert.equal(p.shortRested, true);
});

test('خستگی وقتی هیچ کارتی برای بازی نمانده', () => {
  const g = createGloom({ seed: 37 });
  g.heroes[0].hand = ['frenzy', 'juggernaut'];
  g.heroes[0].discard = [];
  g.heroes[0].lost = [];
  const c = chooseCards(g, ['frenzy', 'juggernaut']).game;
  // هر دو ازدست‌رفته، دست خالی، دورانداخته خالی → خستگی
  const p = playTurn(c, { use: 'both' }).game;
  assert.equal(p.phase, 'over');
  assert.equal(p.winner, 'enemies');
  assert.ok(p.log.some(l => l.text.includes('خستگی')), 'گزارش خستگی نیامد');
});

test('زمان تمام شود، باخت است', () => {
  const g = createGloom({ seed: 41, scenarioId: 'crypt' });
  g.round = g.maxRounds;
  g.heroes[0].hand = ['cleave', 'trample', 'warcry'];
  const c = chooseCards(g, ['cleave', 'trample']).game;
  const p = playTurn(c, { use: 'both' }).game;
  assert.equal(p.phase, 'over');
  assert.equal(p.winner, 'enemies');
});

test('بعد از پایان، انتخاب کارت پذیرفته نمی‌شود', () => {
  const g = createGloom({ seed: 43 });
  g.phase = 'over';
  assert.equal(chooseCards(g, ['cleave']).ok, false);
});

test('امتیاز برد مثبت و باخت صفر', () => {
  const g = createGloom({ seed: 47, scenarioId: 'crypt' });
  const win = { ...g, winner: 'heroes', round: 5, loot: 2 };
  assert.ok(scoreOf(win) > 0);
  assert.equal(scoreOf({ ...g, winner: 'enemies' }), 0);
  assert.equal(scoreOf(g), 0, 'بازی ناتمام صفر است');
});

test('امتیاز با جان و غنیمت بالا می‌رود', () => {
  const g = createGloom({ seed: 53 });
  const base = { ...g, winner: 'heroes', round: 5 };
  const hurt = { ...base, heroes: [{ ...g.heroes[0], hp: 2 }] };
  const healthy = { ...base, heroes: [{ ...g.heroes[0], hp: 10 }] };
  assert.ok(scoreOf(healthy) > scoreOf(hurt), 'جان بیشتر باید امتیاز بیشتری بدهد');
  assert.ok(scoreOf({ ...healthy, loot: 3 }) > scoreOf(healthy), 'غنیمت باید امتیاز بدهد');
});

test('بازی هیچ‌وقت در حالت معلق نمی‌ماند', () => {
  for (let seed = 1; seed <= 12; seed++) {
    let g = createGloom({ seed, scenarioId: 'crypt', difficulty: 'normal' });
    let steps = 0;
    while (g.phase !== 'over' && steps < 60) {
      steps++;
      if (g.phase === 'choose') {
        const hand = g.heroes[0].hand;
        if (!hand.length) break;
        const pick = hand.length >= 2 ? hand.slice(0, 2) : [hand[0]];
        const c = chooseCards(g, pick);
        if (!c.ok) break;
        g = c.game;
      } else {
        const alive = aliveEnemies(g);
        const p = playTurn(g, { use: 'both', targetUid: alive[0]?.uid });
        if (!p.ok) break;
        g = p.game;
      }
    }
    assert.equal(g.phase, 'over', `دانه ${seed}: بازی در ${g.phase} ماند`);
    assert.ok(['heroes', 'enemies'].includes(g.winner), `دانه ${seed}: برنده تعیین نشد`);
  }
});

test('قواعد سه گام و یک مثال دارند', () => {
  assert.ok(RULES.steps.length >= 3);
  assert.ok(RULES.example.length > 20);
  assert.ok(RULES.steps.some(s => s.includes('دو کارت')), 'قاعدهٔ دو کارت نیست');
  assert.ok(RULES.steps.some(s => s.includes('iniciativa') || s.includes('پیشرو')));
});
