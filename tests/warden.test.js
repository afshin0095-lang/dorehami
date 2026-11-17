import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  INVESTIGATORS, LOCATIONS, SCENES, HORROR_DECK, RULES,
  createRun, beginScene, resolveSceneChoice, wardLocation, rest, endRound,
  drawHorror, confront, canConfront, currentScene, locationOf, investigatorOf,
  checkOdds, difficultyOf, progressOf, checkEnd
} from '../public/src/engines/v10.js';

const start = (inv = 'parisa', seed = 1) => beginScene(createRun({ investigatorId: inv, seed }));

test('محقق‌ها: چهار نفر، هر چهار ویژگی، مزیت و ضعف', () => {
  assert.equal(INVESTIGATORS.length, 4);
  for (const inv of INVESTIGATORS) {
    for (const k of ['mind', 'agility', 'will', 'body']) assert.equal(typeof inv.stats[k], 'number', `${inv.id}.${k}`);
    assert.ok(inv.perk && inv.weakness && inv.blurb);
  }
});

test('مکان‌ها و صحنه‌ها کامل‌اند و به هم اشاره دارند', () => {
  assert.equal(LOCATIONS.length, 9);
  assert.equal(SCENES.length, 9);
  for (const s of SCENES) {
    assert.ok(locationOf(s.location), `مکان ناموجود در صحنه ${s.id}`);
    assert.equal(s.choices.length, 2);
    for (const c of s.choices) {
      assert.ok(['mind', 'agility', 'will', 'body'].includes(c.stat));
      assert.ok(c.diff >= 3 && c.diff <= 7);
      assert.ok(c.success && c.fail);
    }
  }
});

test('کارت‌های هول: هر کارت اثر مثبت دارد', () => {
  assert.ok(HORROR_DECK.length >= 6);
  for (const c of HORROR_DECK) {
    assert.ok(c.doom >= 1, c.id);
    assert.ok(c.title && c.text);
  }
});

test('createRun: وضعیت اولیه درست', () => {
  const r = createRun({ investigatorId: 'shirin', seed: 7 });
  assert.equal(r.investigatorId, 'shirin');
  assert.equal(r.doom, 0);
  assert.equal(r.clues, 0);
  assert.equal(r.actionsLeft, RULES.actionsPerRound);
  assert.equal(r.status, 'active');
  assert.equal(r.sceneOrder.length, 9);
  assert.equal(investigatorOf(r).id, 'shirin');
});

test('createRun: بذر یکسان = وضعیت یکسان (بازتولیدپذیر)', () => {
  const a = start('parisa', 42);
  const b = start('parisa', 42);
  assert.deepEqual(a.sceneOrder, b.sceneOrder);
});

test('beginScene: صحنه باز می‌شود و مکانش ثبت می‌شود', () => {
  const r = start();
  assert.ok(r.current);
  assert.ok(currentScene(r));
  assert.ok(r.visited.includes(r.current.location));
});

test('rollCheck: پاداش ویژگی و سختی درست اعمال می‌شود', () => {
  // ذهن ۴ → پاداش ۲. سختی ۴ → موفق با تاس ۲..۶ (۵ از ۶)
  assert.equal(checkOdds(4, 4), 5 / 6);
  assert.equal(checkOdds(2, 4), 3 / 6);
  assert.equal(checkOdds(4, 6), 3 / 6);
  // «۱» همیشه شکست است (قاعده‌ی خودکار)، پس بهترین شانس ۵ از ۶ است
  assert.equal(checkOdds(2, 2), 5 / 6);
});

test('resolveSceneChoice: موفقیت سرنخ می‌دهد، شکست هول', () => {
  // چند بار با بذرهای مختلف تا هر دو حالت دیده شود
  let sawClue = false, sawDoom = false;
  for (let seed = 1; seed <= 40 && !(sawClue && sawDoom); seed++) {
    const r0 = start('parisa', seed);
    const scene = currentScene(r0);
    const i = scene.choices.findIndex(c => c.clue);
    const r1 = resolveSceneChoice(r0, i);
    assert.equal(r0.actionsLeft - r1.actionsLeft, 1, 'هر تصمیم یک کنش');
    if (r1.lastCheck.success) { assert.equal(r1.clues, 1); sawClue = true; }
    else { assert.ok(r1.doom >= 1); sawDoom = true; }
  }
  assert.ok(sawClue && sawDoom, 'باید هر دو نتیجه ممکن باشد');
});

test('resolveSceneChoice: بدون کنش خطا می‌دهد', () => {
  const r = { ...start(), actionsLeft: 0 };
  assert.throws(() => resolveSceneChoice(r, 0));
});

test('resolveSceneChoice: گزینه‌ی ناموجود خطا می‌دهد', () => {
  assert.throws(() => resolveSceneChoice(start(), 5));
});

test('wardLocation: کنش کم می‌کند و مکان ثبت می‌شود', () => {
  const r = start();
  const id = r.current.location;
  const before = r.actionsLeft;
  const after = wardLocation(r, id);
  assert.ok(after.warded.includes(id));
  assert.ok(after.actionsLeft < before);
});

test('wardLocation: مهر تکراری خطا می‌دهد', () => {
  const r0 = start();
  const id = r0.current.location;
  const r1 = wardLocation(r0, id);
  assert.throws(() => wardLocation(r1, id));
});

test('wardLocation: شیرین ارزان‌تر مهر می‌کند', () => {
  const a = start('parisa');
  const b = start('shirin');
  const ca = a.actionsLeft - wardLocation(a, a.current.location).actionsLeft;
  const cb = b.actionsLeft - wardLocation(b, b.current.location).actionsLeft;
  assert.ok(cb < ca, `شیرین ${cb} کنش، پریسا ${ca} کنش`);
});

test('rest: سلامت برمی‌گردد و از ۶ بیشتر نمی‌شود', () => {
  const r = { ...start(), health: 3 };
  const after = rest(r);
  assert.ok(after.health > 3 && after.health <= 6);
});

test('rest: اردلان بیشتر شفا می‌دهد', () => {
  const a = rest({ ...start('parisa'), health: 2 });
  const b = rest({ ...start('ardalan'), health: 2 });
  assert.ok(b.health > a.health);
});

test('drawHorror: هول بالا می‌رود و کارت ثبت می‌شود', () => {
  const r = drawHorror(start());
  assert.ok(r.doom >= 1);
  assert.ok(r.horrorDrawn.length === 1);
  assert.ok(r.lastHorror?.title);
});

test('drawHorror: مکان مهرشده اثر هول را کم می‌کند', () => {
  let softened = 0, hard = 0;
  for (let seed = 1; seed <= 30; seed++) {
    const base = start('parisa', seed);
    const plain = drawHorror(base);
    const warded = drawHorror({ ...base, warded: [base.current.location] });
    if (warded.doom < plain.doom) softened++;
    else hard++;
  }
  assert.ok(softened > 0, 'مهر باید اثر داشته باشد');
  void hard;
});

test('endRound: دور جلو می‌رود و کنش‌ها پر می‌شوند', () => {
  const r = { ...start(), actionsLeft: 0, round: 3 };
  const after = endRound(r);
  assert.equal(after.round, 4);
  assert.equal(after.actionsLeft, RULES.actionsPerRound);
});

test('beginScene: بعد از تمام‌شدن ۹ صحنه، پرده‌ی دوم آغاز می‌شود (بن‌بست ممنوع)', () => {
  let r = start('parisa', 3);
  for (let i = 0; i < 9; i++) r = beginScene({ ...r, current: null, sceneIndex: i });
  const after = beginScene({ ...r, current: null, sceneIndex: 9 });
  assert.equal(after.cycle, 2);
  assert.ok(after.current, 'باید صحنه‌ی تازه باز شود');
});

test('difficultyOf: پرده‌ی دوم سخت‌تر است', () => {
  const scene = SCENES[0];
  const c = scene.choices[0];
  assert.equal(difficultyOf({ cycle: 1 }, c), c.diff);
  assert.equal(difficultyOf({ cycle: 2 }, c), c.diff + 1);
  assert.equal(difficultyOf({ cycle: 5 }, c), c.diff + 2, 'سختی حداکثر ۲ واحد بالا می‌رود');
});

test('canConfront: فقط با سرنخ کافی', () => {
  const r = start();
  assert.equal(canConfront(r), false);
  assert.equal(canConfront({ ...r, clues: RULES.cluesNeeded }), true);
});

test('confront: بدون سرنخ خطا می‌دهد', () => {
  assert.throws(() => confront(start()));
});

test('confront: با سرنخ کافی یا می‌برد یا فقط شکست می‌خورد (بدون خطا)', () => {
  let wins = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const r = { ...start('kamran', seed), clues: RULES.cluesNeeded, warded: ['archive', 'harbor'] };
    const after = confront(r);
    assert.ok(['won', 'active', 'lost'].includes(after.status));
    if (after.status === 'won') { wins++; assert.ok(after.ending); }
  }
  assert.ok(wins > 0, 'باید حداقل یک برد ممکن باشد');
});

test('checkEnd: هول پر و سلامت صفر باعث باخت می‌شوند', () => {
  assert.equal(checkEnd({ status: 'active', doom: 12, doomMax: 12, health: 3 }).status, 'lost');
  assert.equal(checkEnd({ status: 'active', doom: 0, doomMax: 12, health: 0 }).status, 'lost');
  assert.equal(checkEnd({ status: 'active', doom: 3, doomMax: 12, health: 3 }).status, 'active');
});

test('progressOf: بین ۰ و ۱ می‌ماند', () => {
  for (const doom of [0, 6, 12]) {
    const p = progressOf({ clues: 2, cluesNeeded: 3, warded: ['a', 'b'], doom, doomMax: 12 });
    assert.ok(p >= 0 && p <= 1, `doom ${doom} → ${p}`);
  }
});

test('سقف دور: بعد از ۳۰ دور بازی خودش تمام می‌شود', () => {
  const r = endRound({ ...start(), round: 30 });
  assert.equal(r.status, 'lost');
});

test('شبیه‌سازی ۳۰۰ بازی: هیچ بازی‌ای قفل نمی‌شود', () => {
  for (let seed = 1; seed <= 300; seed++) {
    let run = start(INVESTIGATORS[seed % 4].id, seed);
    let guard = 0;
    while (run.status === 'active' && guard++ < 400) {
      if (canConfront(run)) { run = confront(run); continue; }
      if (!run.current) run = beginScene(run);
      if (run.actionsLeft <= 0) { run = endRound(run); continue; }
      if (run.current) run = resolveSceneChoice(run, seed % 2);
      else run = endRound(run);
    }
    assert.notEqual(run.status, 'active', `بازی ${seed} قفل شد`);
  }
});
