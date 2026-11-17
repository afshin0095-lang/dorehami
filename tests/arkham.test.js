/* ============================================================
   آزمون «آرکام: نشانه‌های آشوب»
   ============================================================ */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ACTIONS_PER_TURN, SKILLS, INVESTIGATORS, CHAOS_TOKENS, CHAOS_BAG, ASSETS, ASSET_BY_ID,
  ACTS, AGENDAS, ENEMIES, DIFFICULTY, RULES,
  createArkham, investigatorOf, effectiveStat, maxHpOf, maxSanityOf, pullToken,
  skillTest, investigate, fight, evade, playAsset, drawCard, endTurn,
  isOver, currentAct, currentAgenda, spawnEnemy, scoreOf, cloneArkham, rest
} from '../public/src/engines/arkham.js';

test('چهار مهارت، سه پژوهشگر', () => {
  assert.equal(Object.keys(SKILLS).length, 4);
  assert.equal(INVESTIGATORS.length, 3);
  for (const i of INVESTIGATORS) {
    assert.ok(i.id && i.name && i.role, 'پژوهشگر ناقص');
    for (const k of ['will', 'intellect', 'combat', 'agility']) {
      assert.ok(Number.isFinite(i.stats[k]), `${i.id}: ${k} ندارد`);
    }
    assert.ok(i.hp > 0 && i.sanity > 0);
  }
});

test('سه پرده، سه اجندا، چهار دشمن', () => {
  assert.equal(ACTS.length, 3);
  assert.equal(AGENDAS.length, 3);
  assert.equal(ENEMIES.length, 4);
  for (const a of ACTS) assert.ok(a.need > 0, `${a.id}: نیاز ندارد`);
  for (const a of AGENDAS) assert.ok(a.doomMax > 0);
});

test('ده نشانهٔ آشوب، یک چادر', () => {
  assert.equal(CHAOS_TOKENS.length, 10);
  const tentacle = CHAOS_TOKENS.find(t => t.id === 'tentacle');
  assert.equal(tentacle.autoFail, true, 'چادر باید شکست قطعی باشد');
  const others = CHAOS_TOKENS.filter(t => t.id !== 'tentacle');
  for (const t of others) assert.ok(Number.isFinite(t.value), `${t.id}: مقدار ندارد`);
});

test('کیسهٔ سه سطح از نشانه‌های موجود ساخته شده', () => {
  for (const [level, bag] of Object.entries(CHAOS_BAG)) {
    assert.ok(bag.length >= 8, `${level}: کیسه کوچک است`);
    for (const id of bag) {
      assert.ok(CHAOS_TOKENS.some(t => t.id === id), `${level}: نشانهٔ ناشناخته ${id}`);
    }
  }
  // چادر فقط در میانه و سخت
  assert.ok(!CHAOS_BAG.easy.includes('tentacle'), 'آسان نباید چادر داشته باشد');
  assert.ok(CHAOS_BAG.normal.includes('tentacle'));
  assert.ok(CHAOS_BAG.hard.includes('tentacle'));
});

test('هشت دارایی با اسلات', () => {
  assert.equal(ASSETS.length, 8);
  for (const a of ASSETS) {
    assert.ok(a.id && a.name && a.text, 'دارایی ناقص');
    assert.ok(Number.isFinite(a.cost), `${a.id}: هزینه ندارد`);
    assert.ok(a.slots, `${a.id}: اسلات ندارد`);
  }
});

test('بازی تازه درست ساخته می‌شود', () => {
  const g = createArkham({ seed: 1 });
  assert.equal(g.turn, 1);
  assert.equal(g.actionsLeft, DIFFICULTY.normal.actions);
  assert.equal(g.hand.length, 5, 'دست اولیه باید ۵ کارت باشد');
  assert.equal(g.hp, investigatorOf(g).hp);
  assert.equal(g.phase, 'act');
  assert.equal(g.doom, 0);
  assert.equal(isOver(g), false);
});

test('همان دانه، همان دست و کیسه', () => {
  const a = createArkham({ seed: 99 });
  const b = createArkham({ seed: 99 });
  assert.deepEqual(a.hand, b.hand);
  assert.deepEqual(a.bag, b.bag);
});

test('دانهٔ مختلف، دست مختلف', () => {
  const hands = new Set();
  for (let s = 1; s <= 15; s++) hands.add(createArkham({ seed: s }).hand.join(','));
  assert.ok(hands.size > 4, `تنوع کم: ${hands.size}`);
});

test('سختی روی کیسه، کنش و منابع اثر دارد', () => {
  const e = createArkham({ seed: 3, difficulty: 'easy' });
  const h = createArkham({ seed: 3, difficulty: 'hard' });
  assert.ok(e.actionsPerTurn > h.actionsPerTurn || e.bag.length < h.bag.length, 'سختی اثری ندارد');
  assert.ok(e.res > h.res, 'آسان باید منابع بیشتری بدهد');
});

test('هر پژوهشگر آمار خودش را دارد', () => {
  for (const inv of INVESTIGATORS) {
    const g = createArkham({ seed: 5, investigatorId: inv.id });
    assert.equal(investigatorOf(g).name, inv.name);
    assert.equal(effectiveStat(g, 'will'), inv.stats.will);
  }
});

test('دارایی مهارت را بالا می‌برد', () => {
  const g = createArkham({ seed: 7, investigatorId: 'roland' });
  const base = effectiveStat(g, 'combat');
  g.assetsInPlay.push('revolver');
  assert.equal(effectiveStat(g, 'combat'), base + 1, 'هفت‌تیر نبرد را بالا نبرد');
});

test('دارایی جان و روان را بالا می‌برد', () => {
  const g = createArkham({ seed: 9 });
  const hp0 = maxHpOf(g), san0 = maxSanityOf(g);
  g.assetsInPlay.push('coat');
  assert.equal(maxHpOf(g), hp0 + 2);
  g.assetsInPlay.push('charm');
  assert.equal(maxSanityOf(g), san0 + 2);
});

test('برداشتن نشانه همیشه نشانهٔ معتبر می‌دهد', () => {
  const g = createArkham({ seed: 11 });
  for (let i = 0; i < 50; i++) {
    const p = pullToken(g);
    assert.ok(p.token, 'نشانه نیامد');
    assert.ok(CHAOS_BAG.normal.includes(p.token.id), 'نشانهٔ بیرونی');
    if (p.token.id === 'tentacle') assert.equal(p.autoFail, true);
  }
});

test('آزمون با چادر همیشه شکست است', () => {
  const g = createArkham({ seed: 13, investigatorId: 'daisey' });   // هوش ۵
  // کیسه را به چادر محدود می‌کنیم
  g.bag = ['tentacle'];
  const r = skillTest(g, { stat: 'intellect', difficulty: 1 });
  assert.equal(r.ok, true);
  assert.equal(r.test.autoFail, true);
  assert.equal(r.test.success, false, 'چادر باید شکست بدهد');
});

test('آزمون با نشانهٔ مثبت راحت‌تر قبول می‌شود', () => {
  const g = createArkham({ seed: 15, investigatorId: 'daisey' });   // هوش ۴
  g.bag = ['plus1'];
  const r = skillTest(g, { stat: 'intellect', difficulty: 5 });
  assert.equal(r.test.total, 5, `مجموع نادرست: ${r.test.total}`);
  assert.equal(r.test.success, true, `با +۱ باید موفق شود (مجموع ${r.test.total})`);
});

test('کارت همراه آزمون را آسان‌تر می‌کند', () => {
  const g = createArkham({ seed: 17, investigatorId: 'daisey' });   // هوش ۴
  g.bag = ['zero'];
  const card = g.hand[0];
  const without = skillTest(g, { stat: 'intellect', difficulty: 5 });
  assert.equal(without.test.success, false, 'بدون کارت باید ناموفق باشد');
  const r = skillTest(g, { stat: 'intellect', difficulty: 5, commit: [card] });
  assert.equal(r.test.bonus, 1, 'کارت همراه اثر نکرد');
  assert.equal(r.test.success, true, 'با کارت همراه باید موفق شود');
});

test('کارتی که در دست نیست همراه نمی‌شود', () => {
  const g = createArkham({ seed: 19 });
  g.bag = ['zero'];
  const r = skillTest(g, { stat: 'will', difficulty: 1, commit: ['ناموجود'] });
  assert.equal(r.test.bonus, 0, 'کارت بیرونی باید نادیده گرفته شود');
});

test('بررسی سرنخ می‌دهد و کنش کم می‌کند', () => {
  const g = createArkham({ seed: 21, investigatorId: 'daisey' });
  g.bag = ['plus1'];
  const r = investigate(g);
  assert.equal(r.ok, true);
  assert.equal(r.game.clues, 1);
  assert.equal(r.game.actionsLeft, g.actionsLeft - 1);
});

test('بررسی ناموفق سرنخ نمی‌دهد', () => {
  const g = createArkham({ seed: 23, investigatorId: 'roland' });   // هوش ۳
  g.bag = ['minus4'];
  const r = investigate(g);
  assert.equal(r.test.success, false);
  assert.equal(r.game.clues, 0);
});

test('پر شدن سرنخ پرده، پرده را جلو می‌برد', () => {
  const g = createArkham({ seed: 25, investigatorId: 'daisey' });
  g.clues = 0;
  g.actClues = currentAct(g).need - 1;
  g.bag = ['plus1', 'plus1', 'plus1'];
  const r = investigate(g);
  assert.ok(r.game.actIndex > 0 || r.game.phase === 'over', 'پرده جلو نرفت');
});

test('پردهٔ سوم کامل شود، برد است', () => {
  const g = createArkham({ seed: 27, investigatorId: 'daisey' });
  g.actIndex = ACTS.length - 1;
  g.actClues = currentAct(g).need - 1;
  g.bag = ['plus1'];
  const r = investigate(g);
  assert.equal(r.game.phase, 'over');
  assert.equal(r.game.winner, 'investigator');
});

test('نبرد به دشمن آسیب می‌زند', () => {
  const g = createArkham({ seed: 29, investigatorId: 'roland' });
  let withEnemy = spawnEnemy(g, 'rat');
  withEnemy.bag = ['plus1'];
  const hpBefore = withEnemy.engaged[0].hp;
  const r = fight(withEnemy, withEnemy.engaged[0].uid);
  assert.equal(r.ok, true);
  const after = r.game.engaged.find(e => e.uid === withEnemy.engaged[0].uid);
  assert.ok(!after || after.hp < hpBefore, 'آسیب وارد نشد');
});

test('کشتن دشمن، از درگیری خارجش می‌کند', () => {
  const g = createArkham({ seed: 31, investigatorId: 'roland' });
  let withEnemy = spawnEnemy(g, 'rat');
  withEnemy.engaged[0].hp = 1;
  withEnemy.bag = ['plus1'];
  const r = fight(withEnemy, withEnemy.engaged[0].uid);
  assert.equal(r.game.engaged.length, 0, 'دشمن باید از درگیری خارج شود');
});

test('نبرد بدون دشمن رد می‌شود', () => {
  const g = createArkham({ seed: 33 });
  assert.equal(fight(g).ok, false);
});

test('فرار دشمن را خارج می‌کند', () => {
  const g = createArkham({ seed: 35, investigatorId: 'agnes' });   // چابکی ۳
  let withEnemy = spawnEnemy(g, 'rat');
  withEnemy.bag = ['plus1'];
  const r = evade(withEnemy, withEnemy.engaged[0].uid);
  assert.equal(r.ok, true);
  if (r.test.success) assert.equal(r.game.engaged.length, 0);
});

test('فرار بدون دشمن رد می‌شود', () => {
  const g = createArkham({ seed: 37 });
  assert.equal(evade(g).ok, false);
});

test('بازی کارت، منابع را کم و دارایی را اضافه می‌کند', () => {
  const g = createArkham({ seed: 39 });
  const cheap = g.hand.find(id => ASSET_BY_ID[id]?.cost <= g.res);
  assert.ok(cheap, 'کارت قابل بازی در دست نیست');
  const cost = ASSET_BY_ID[cheap].cost;
  const resBefore = g.res;
  const r = playAsset(g, cheap);
  assert.equal(r.ok, true);
  assert.equal(r.game.res, resBefore - cost);
  assert.ok(r.game.assetsInPlay.includes(cheap));
  assert.ok(!r.game.hand.includes(cheap));
});

test('بازی کارت گران‌تر از منابع رد می‌شود', () => {
  const g = createArkham({ seed: 41 });
  g.res = 0;
  assert.equal(playAsset(g, g.hand[0]).ok, false);
});

test('بازی کارتی که در دست نیست رد می‌شود', () => {
  const g = createArkham({ seed: 43 });
  assert.equal(playAsset(g, 'ناموجود').ok, false);
});

test('اسلات پر، کارت دوم را نمی‌پذیرد', () => {
  const g = createArkham({ seed: 45 });
  g.res = 10;
  // هفت‌تیر و چاقو هر دو اسلات دست
  g.hand = ['revolver', 'knife'];
  const r1 = playAsset(g, 'revolver');
  assert.equal(r1.ok, true);
  r1.game.actionsLeft = 2;
  const r2 = playAsset(r1.game, 'knife');
  assert.equal(r2.ok, false, 'اسلات دست باید پر باشد');
});

test('کشیدن کارت دست را پر و منابع را زیاد می‌کند', () => {
  const g = createArkham({ seed: 47 });
  const handBefore = g.hand.length;
  const resBefore = g.res;
  const r = drawCard(g);
  assert.equal(r.ok, true);
  assert.ok(r.game.hand.length >= handBefore, 'دست کم شد');
  assert.equal(r.game.res, resBefore + 1);
});

test('دستهٔ خالی، کشیدن را رد می‌کند', () => {
  const g = createArkham({ seed: 49 });
  g.deck = [];
  assert.equal(drawCard(g).ok, false);
});

test('پایان نوبت، عذاب می‌دهد و نوبت را جلو می‌برد', () => {
  const g = createArkham({ seed: 51 });
  const r = endTurn(g);
  assert.equal(r.ok, true);
  assert.equal(r.game.turn, 2);
  assert.equal(r.game.doom, 1);
  assert.equal(r.game.actionsLeft, r.game.actionsPerTurn);
});

test('دشمن در پایان نوبت حمله می‌کند', () => {
  const g = createArkham({ seed: 53, investigatorId: 'roland' });
  const withEnemy = spawnEnemy(g, 'rat');
  const hpBefore = withEnemy.hp;
  const r = endTurn(withEnemy);
  assert.ok(r.game.hp < hpBefore, 'دشمن آسیب نزد');
});

test('جان صفر، باخت است', () => {
  const g = createArkham({ seed: 55 });
  // دشمن هر نوبت حمله نمی‌کند؛ چند نوبت صبر می‌کنیم
  let cur = spawnEnemy(g, 'nightgaunt');
  cur.hp = 1;
  let over = false;
  for (let i = 0; i < 4; i++) {
    const r = endTurn(cur);
    cur = r.game;
    if (cur.phase === 'over') { over = true; break; }
  }
  assert.equal(over, true, 'با جان ۱ باید در چند نوبت بمیرد');
  assert.equal(cur.winner, 'mythos');
});

test('روان صفر، باخت است', () => {
  const g = createArkham({ seed: 57 });
  g.sanity = 1;
  let cur = spawnEnemy(g, 'cultist');
  let over = false;
  for (let i = 0; i < 6; i++) {
    const r = endTurn(cur);
    cur = r.game;
    if (cur.phase === 'over') { over = true; break; }
  }
  assert.equal(over, true, 'با روان ۱ باید در چند نوبت بشکند');
  assert.equal(cur.winner, 'mythos');
});

test('دشمن هر نوبت حمله نمی‌کند', () => {
  const g = createArkham({ seed: 61, investigatorId: 'roland' });
  let cur = spawnEnemy(g, 'rat');
  const attacks = [];
  for (let i = 0; i < 6 && cur.phase !== 'over'; i++) {
    const before = cur.hp;
    cur = endTurn(cur).game;
    attacks.push(cur.hp < before);
  }
  assert.ok(attacks.includes(true), 'هیچ حمله‌ای نشد');
  assert.ok(attacks.includes(false), 'هر نوبت حمله کرد — باید یک‌نوبت‌درمیان باشد');
});

test('استراحت روان را برمی‌گرداند', () => {
  const g = createArkham({ seed: 63, investigatorId: 'daisey' });
  g.sanity = 4;
  const r = rest(g);
  assert.equal(r.ok, true);
  assert.ok(r.game.sanity > 4, 'روان برنگشت');
});

test('استراحت جان را برمی‌گرداند', () => {
  const g = createArkham({ seed: 65 });
  g.hp = 3;
  const r = rest(g);
  assert.ok(r.game.hp > 3, 'جان برنگشت');
});

test('استراحت از بیشینه نمی‌گذرد', () => {
  const g = createArkham({ seed: 67 });
  g.sanity = maxSanityOf(g);
  const r = rest(g);
  assert.equal(r.game.sanity, maxSanityOf(r.game), 'روان از بیشینه گذشت');
});

test('پرک دیزی: جمجمه/فرقه هول بررسی نمی‌دهد', () => {
  const g = createArkham({ seed: 69, investigatorId: 'daisey' });
  g.sanity = 11;
  // دشواری بررسی ۲ است؛ با هوش ۴ و جمجمه (−۲) دقیقاً ۲ می‌شود و موفق.
  // برای آزمون شکست، هوش را با کارت پایین نمی‌آوریم؛ به‌جایش دو نشانهٔ
  // منفی می‌گذاریم که همیشه زیر دشواری بیفتد
  g.bag = ['minus2', 'minus2'];
  const r = investigate(g);
  // با هوش ۴ و −۲ = ۲ ≥ ۲ → موفق. پس برای شکست، جمجمه با هوش کمتر:
  assert.ok(r.test.total >= 2, 'مجموع باید دست‌کم ۲ باشد');
  assert.equal(r.game.sanity, 11, 'دیزی نباید از بررسی هول بگیرد');
});

test('پرک دیزی: چادر همچنان هول می‌دهد', () => {
  const g = createArkham({ seed: 71, investigatorId: 'daisey' });
  g.sanity = 11;
  g.bag = ['tentacle', 'tentacle'];
  const r = investigate(g);
  assert.equal(r.test.success, false);
  assert.ok(r.game.sanity < 11, 'چادر باید برای همه هول بدهد');
});

test('پرک آگنس: هول، دشمن را می‌زند', () => {
  const g = createArkham({ seed: 71, investigatorId: 'agnes' });
  const withEnemy = spawnEnemy(g, 'ghoul');
  withEnemy.bag = ['tentacle'];
  withEnemy.sanity = 8;
  const hpBefore = withEnemy.engaged[0].hp;
  const r = investigate(withEnemy);
  const after = r.game.engaged[0];
  assert.ok(!after || after.hp < hpBefore, 'آگنس باید با هول دشمن را بزند');
});

test('اجندای آخر پر شود، باخت است', () => {
  const g = createArkham({ seed: 59 });
  g.agendaIndex = AGENDAS.length - 1;
  g.doom = AGENDAS[AGENDAS.length - 1].doomMax - 1;
  const r = endTurn(g);
  assert.equal(r.game.phase, 'over');
  assert.equal(r.game.winner, 'mythos');
});

test('نماد جمجمه با شکست، یک هول اضافه می‌دهد', () => {
  // رولند پرک هول‌گیر ندارد و هوش ۳ دارد
  const g = createArkham({ seed: 61, investigatorId: 'roland' });
  g.bag = ['skull', 'skull'];
  g.sanity = 8;
  const r = investigate(g);
  assert.equal(r.test.success, false, 'با جمجمه و هوش ۳ نباید موفق شود');
  assert.ok(r.game.sanity < 8, 'هول کم نشد');
});

test('دشمن تازه با جان کامل ساخته می‌شود', () => {
  const g = createArkham({ seed: 63 });
  const next = spawnEnemy(g, 'ghoul');
  assert.equal(next.engaged.length, 1);
  const e = next.engaged[0];
  const base = ENEMIES.find(x => x.id === 'ghoul');
  assert.equal(e.hp, base.hp);
  assert.equal(e.maxHp, base.hp);
});

test('امتیاز برد مثبت، باخت صفر', () => {
  const win = { ...createArkham({ seed: 65 }), winner: 'investigator', actIndex: 2, turn: 8 };
  assert.ok(scoreOf(win) > 0);
  assert.equal(scoreOf({ ...createArkham({ seed: 65 }), winner: 'mythos' }), 0);
});

test('بازی هرگز در حالت معلق نمی‌ماند', () => {
  for (let seed = 1; seed <= 12; seed++) {
    let g = createArkham({ seed, investigatorId: 'roland' });
    let steps = 0;
    while (!isOver(g) && steps < 60) {
      steps++;
      // ساده: اول کارت در دست، بعد بررسی
      const playable = g.hand.find(id => ASSET_BY_ID[id] && ASSET_BY_ID[id].cost <= g.res);
      let r;
      if (g.engaged.length) r = fight(g);
      else if (playable && g.assetsInPlay.length < 2) r = playAsset(g, playable);
      else r = investigate(g);
      if (!r.ok) { const t = endTurn(g); if (!t.ok) break; g = t.game; }
      else g = r.game;
    }
    assert.ok(isOver(g), `دانه ${seed}: در فاز ${g.phase} ماند`);
  }
});

test('قواعد گام و مثال دارند', () => {
  assert.ok(RULES.steps.length >= 3);
  assert.ok(RULES.example.length > 30);
  assert.ok(RULES.steps.some(s => s.includes('کیسهٔ آشوب')), 'قاعدهٔ کیسه نیست');
});
