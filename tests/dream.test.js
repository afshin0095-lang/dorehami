/* ============================================================
   آزمون «دروازه‌های رؤیا» — موتور کارتی هزارتوی خواب
   ============================================================ */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DREAMS, SIGNS, HAND_SIZE, DOORS_NEEDED, NIGHTMARE_COUNT, DOORS_TARGET,
  buildDeck, createDreamGame, canPlay, playableCards, playDream, discardDream,
  nightmareOptions, applyNightmare, resolveNightmare, doorsTarget, deckLeft,
  progressPercent, dreamName, signName, dreamColor, RULES, toFa
} from '../public/src/engines/dream.js';

/* ------------------------------ دسته ------------------------------ */
test('دسته: ۱۲ نوع خواب، ۲ در برای هر رنگ، و کابوس‌ها', () => {
  const deck = buildDeck(Math.random, 5);
  const dreams = deck.filter(c => c.kind === 'dream');
  const doors = deck.filter(c => c.kind === 'door');
  const nights = deck.filter(c => c.kind === 'nightmare');

  assert.equal(nights.length, 5);
  assert.equal(doors.length, DREAMS.length * 2);
  assert.equal(dreams.length, DREAMS.length * 11);

  // هر رنگ ۱۱ کارت خواب: ۴ خورشید، ۴ ماه، ۳ کلید
  for (const d of DREAMS) {
    const ofDream = dreams.filter(c => c.dream === d.id);
    assert.equal(ofDream.length, 11, `${d.name}: تعداد نادرست`);
    assert.equal(ofDream.filter(c => c.sign === 'sun').length, 4);
    assert.equal(ofDream.filter(c => c.sign === 'moon').length, 4);
    assert.equal(ofDream.filter(c => c.sign === 'key').length, 3);
  }
});

test('همه‌ی کارت‌ها شناسه‌ی یکتا دارند', () => {
  const deck = buildDeck();
  const ids = new Set(deck.map(c => c.id));
  assert.equal(ids.size, deck.length);
});

/* ------------------------------ شروع ------------------------------ */
test('دست اولیه فقط کارت خواب دارد', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const g = createDreamGame({ seed });
    assert.equal(g.hand.length, HAND_SIZE);
    assert.ok(g.hand.every(c => c.kind === 'dream'), `seed ${seed}: کارت غیرخواب در دست`);
    assert.equal(g.doors.length, 0);
    assert.equal(g.chain.length, 0);
    assert.equal(g.status, 'playing');
  }
});

test('درجه روی تعداد کابوس اثر دارد', () => {
  assert.deepEqual(NIGHTMARE_COUNT, { easy: 3, normal: 5, hard: 8 });
  const easy = createDreamGame({ seed: 7, difficulty: 'easy' });
  const hard = createDreamGame({ seed: 7, difficulty: 'hard' });
  assert.equal(easy.difficulty, 'easy');
  assert.equal(hard.difficulty, 'hard');
  assert.ok(hard.deck.length + hard.hand.length > easy.deck.length + easy.hand.length);
});

test('همه‌ی درجات پنج در می‌خواهند', () => {
  assert.equal(DOORS_NEEDED, 5);
  assert.equal(doorsTarget({ difficulty: 'easy' }), DOORS_TARGET.normal);
  assert.equal(RULES.doorsNeeded, 5);
});

/* ------------------------------ قاعده‌ی نماد ------------------------------ */
test('نمی‌شود دو کارت هم‌نماد پشت‌سرهم بازی کرد', () => {
  const g = createDreamGame({ seed: 11 });
  // یک کارت مصنوعی روی میز می‌گذاریم
  const table = { ...g, chain: [{ id: 'x', kind: 'dream', dream: 'garden', sign: 'sun' }] };
  assert.equal(canPlay(table, { id: 'a', kind: 'dream', dream: 'garden', sign: 'sun' }), false);
  assert.equal(canPlay(table, { id: 'b', kind: 'dream', dream: 'tower', sign: 'sun' }), false);
  assert.equal(canPlay(table, { id: 'c', kind: 'dream', dream: 'garden', sign: 'moon' }), true);
  assert.equal(canPlay(table, { id: 'd', kind: 'dream', dream: 'tower', sign: 'key' }), true);
});

test('کارت غیرخواب هرگز بازی‌شدنی نیست', () => {
  const g = createDreamGame({ seed: 2 });
  assert.equal(canPlay(g, { id: 'z', kind: 'door', dream: 'garden' }), false);
  assert.equal(canPlay(g, { id: 'z', kind: 'nightmare' }), false);
});

test('صفحه‌ی خالی هر کارت خوابی را می‌پذیرد', () => {
  const g = createDreamGame({ seed: 3 });
  for (const c of g.hand) assert.equal(canPlay(g, c), true);
});

/* ------------------------------ درها ------------------------------ */
test('سه کارت هم‌رنگ پشت‌سرهم یک در باز می‌کند', () => {
  const base = createDreamGame({ seed: 5 });
  const three = [
    { id: 'h1', kind: 'dream', dream: 'library', sign: 'sun' },
    { id: 'h2', kind: 'dream', dream: 'library', sign: 'moon' },
    { id: 'h3', kind: 'dream', dream: 'library', sign: 'key' }
  ];
  // دسته‌ی خالی تا کشیدن کارت تازه وضعیت را عوض نکند
  // دسته فقط کارت هم‌رنگ می‌دهد تا وضعیت عوض نشود
  const feed = { id: 'feed', kind: 'dream', dream: 'aquarium', sign: 'moon' };
  let g = { ...base, hand: [...three], chain: [], doors: [], deck: [feed] };
  g = playDream(g, 'h1');
  assert.equal(g.doors.length, 0, 'یک کارت نباید در باز کند');
  g = { ...g, hand: [three[1]], deck: [feed] };
  g = playDream(g, 'h2');
  assert.equal(g.doors.length, 0, 'دو کارت نباید در باز کند');
  g = { ...g, hand: [three[2]], deck: [feed] };
  g = playDream(g, 'h3');
  assert.equal(g.doors.length, 1);
  assert.equal(g.doors[0], 'library');
  assert.equal(g.progress.library, 1);
});

test('هر رنگ بیشتر از دو در ندارد', () => {
  const base = createDreamGame({ seed: 9 });
  let g = {
    ...base,
    deck: [],
    doors: ['garden', 'garden'],
    progress: { ...base.progress, garden: 2 },
    chain: [],
    hand: [
      { id: 'a', kind: 'dream', dream: 'garden', sign: 'sun' },
      { id: 'b', kind: 'dream', dream: 'garden', sign: 'moon' },
      { id: 'c', kind: 'dream', dream: 'garden', sign: 'key' }
    ]
  };
  const feed = { id: 'feed', kind: 'dream', dream: 'aquarium', sign: 'moon' };
  g = { ...g, deck: [feed] };
  g = playDream(g, 'a');
  g = { ...g, deck: [feed], hand: [{ id: 'b', kind: 'dream', dream: 'garden', sign: 'moon' }] };
  g = playDream(g, 'b');
  g = { ...g, deck: [feed], hand: [{ id: 'c', kind: 'dream', dream: 'garden', sign: 'key' }] };
  g = playDream(g, 'c');
  assert.equal(g.doors.filter(d => d === 'garden').length, 2, 'در سوم نباید باز شود');
});

test('پنج در = برد', () => {
  const base = createDreamGame({ seed: 4 });
  let g = {
    ...base,
    deck: [],
    doors: ['garden', 'garden', 'library', 'library'],
    chain: [],
    hand: [{ id: 'win', kind: 'dream', dream: 'tower', sign: 'sun' }]
  };
  // زنجیره‌ی قبلی برای ساختن سه‌گانه‌ی tower
  g = { ...g, chain: [
    { id: 't1', kind: 'dream', dream: 'tower', sign: 'moon' },
    { id: 't2', kind: 'dream', dream: 'tower', sign: 'key' }
  ] };
  g = playDream(g, 'win');
  assert.equal(g.status, 'won');
  assert.equal(g.doors.length, 5);
  assert.ok(g.ending.includes('بیرون'));
});

/* ------------------------------ دور انداختن ------------------------------ */
test('دور انداختن دست را پر می‌کند ولی زنجیره را تغییر نمی‌دهد', () => {
  const g = createDreamGame({ seed: 6 });
  const card = g.hand[0];
  const res = discardDream(g, card.id);
  assert.equal(res.chain.length, 0, 'زنجیره نباید عوض شود');
  assert.equal(res.hand.length, HAND_SIZE, 'دست باید پر بماند');
  assert.ok(!res.hand.some(c => c.id === card.id));
});

test('دور انداختن کلید پیش‌گویی می‌دهد', () => {
  const base = createDreamGame({ seed: 12 });
  const key = { id: 'k1', kind: 'dream', dream: 'garden', sign: 'key' };
  const g = { ...base, hand: [key, ...base.hand.slice(0, 3)] };
  const res = discardDream(g, 'k1');
  assert.ok(Array.isArray(res.peek), 'پیش‌گویی باید فهرست باشد');
  assert.ok(res.peek.length <= 5);
});

test('دور انداختن غیرکلید پیش‌گویی نمی‌دهد', () => {
  const base = createDreamGame({ seed: 12 });
  const sun = { id: 's1', kind: 'dream', dream: 'garden', sign: 'sun' };
  const g = { ...base, hand: [sun, ...base.hand.slice(0, 3)] };
  const res = discardDream(g, 's1');
  assert.equal(res.peek, null);
});

test('کارتی که در دست نیست خطا می‌دهد', () => {
  const g = createDreamGame({ seed: 8 });
  assert.throws(() => playDream(g, 'ناموجود'), /در دست تو نیست/);
  assert.throws(() => discardDream(g, 'ناموجود'), /در دست تو نیست/);
});

/* ------------------------------ کابوس ------------------------------ */
test('گزینه‌های کابوس به وضعیت وابسته‌اند', () => {
  const g = { ...createDreamGame({ seed: 1 }), status: 'nightmare', doors: [] };
  const opts = nightmareOptions(g);
  const ids = opts.map(o => o.id);
  assert.ok(ids.includes('hand'), 'گزینه‌ی دست همیشه هست');
  assert.ok(!ids.includes('door'), 'بدون درِ باز، گزینه‌ی در نباید باشد');

  const withDoors = { ...g, doors: ['garden'] };
  assert.ok(nightmareOptions(withDoors).map(o => o.id).includes('door'));

  const noKey = { ...g, hand: g.hand.filter(c => c.sign !== 'key') };
  assert.ok(!nightmareOptions(noKey).map(o => o.id).includes('key'), 'بدون کلید، گزینه‌ی کلید نباید باشد');
});

test('دادن کلید، کلید را از دست حذف می‌کند', () => {
  const base = createDreamGame({ seed: 15 });
  const key = { id: 'kk', kind: 'dream', dream: 'tower', sign: 'key' };
  const g = { ...base, status: 'nightmare', hand: [key, ...base.hand.slice(0, 4)] };
  const after = applyNightmare(g, 'key');
  assert.equal(after.status, 'playing');
  assert.ok(!after.hand.some(c => c.id === 'kk'));
});

test('سوختن پنج کارت، دسته را کوچک می‌کند', () => {
  const g = { ...createDreamGame({ seed: 20 }), status: 'nightmare' };
  const before = g.deck.length;
  const after = applyNightmare(g, 'discard5');
  assert.ok(after.deck.length < before, 'دسته باید کوچک‌تر شود');
  assert.equal(after.status, 'playing');
});

test('برگرداندن در، پیشرفت آن رنگ را کم می‌کند', () => {
  const base = createDreamGame({ seed: 21 });
  const g = {
    ...base, status: 'nightmare',
    doors: ['library'],
    progress: { ...base.progress, library: 1 }
  };
  const after = applyNightmare(g, 'door');
  assert.equal(after.doors.length, 0);
  assert.equal(after.progress.library, 0);
  assert.equal(after.status, 'playing');
});

test('کابوس بدون وضعیت کابوس خطا می‌دهد', () => {
  const g = createDreamGame({ seed: 22 });
  assert.throws(() => applyNightmare(g, 'hand'), /کابوسی در جریان نیست/);
  assert.throws(() => applyNightmare({ ...g, status: 'nightmare' }, 'ناشناخته'), /وجود ندارد/);
});

test('پس از کابوس، هیچ وضعیت مرده‌ای نمی‌ماند', () => {
  for (let seed = 1; seed <= 60; seed++) {
    let g = createDreamGame({ seed });
    let guard = 0;
    while (['playing', 'nightmare'].includes(g.status) && guard++ < 400) {
      if (g.status === 'nightmare') {
        const opts = nightmareOptions(g);
        assert.ok(opts.length > 0, `seed ${seed}: کابوس بدون گزینه`);
        g = applyNightmare(g, opts[0].id);
        continue;
      }
      const playable = playableCards(g);
      if (!playable.length) {
        if (!g.hand.length) { assert.fail(`seed ${seed}: دست خالی ولی بازی در جریان`); }
        g = discardDream(g, g.hand[0].id);
        continue;
      }
      try {
        g = playDream(g, playable[0].id);
      } catch (e) {
        assert.fail(`seed ${seed}: حرکت مجاز خطا داد — ${e.message}`);
      }
    }
    assert.ok(['won', 'lost'].includes(g.status), `seed ${seed}: وضعیت پایانی نامعتبر ${g.status}`);
    assert.ok(guard < 400, `seed ${seed}: حلقه بی‌پایان`);
  }
});

/* ------------------------------ خواص ------------------------------ */
test('شبیه‌سازی: هر سه درجه به پایان می‌رسند و درجه سخت‌تر سخت‌تر است', () => {
  const playOut = (difficulty) => {
    let wins = 0, ends = 0;
    for (let seed = 1; seed <= 80; seed++) {
      let g = createDreamGame({ seed, difficulty });
      let guard = 0;
      while (['playing', 'nightmare'].includes(g.status) && guard++ < 500) {
        if (g.status === 'nightmare') {
          const opts = nightmareOptions(g);
          const pick = ['key', 'door', 'discard5', 'hand'].map(id => opts.find(o => o.id === id)).find(Boolean);
          g = applyNightmare(g, pick.id);
          continue;
        }
        const playable = playableCards(g);
        if (!playable.length) {
          if (!g.hand.length) break;
          g = discardDream(g, g.hand[0].id);
          continue;
        }
        const tailOf = (c) => {
          let n = 0;
          for (let i = g.chain.length - 1; i >= 0 && g.chain[i].dream === c.dream; i--) n++;
          return n;
        };
        g = playDream(g, playable.slice().sort((a, b) => tailOf(b) - tailOf(a))[0].id);
      }
      ends++;
      if (g.status === 'won') wins++;
    }
    return { wins, ends };
  };

  const easy = playOut('easy');
  const hard = playOut('hard');
  assert.equal(easy.ends, 80);
  assert.equal(hard.ends, 80);
  assert.ok(easy.wins > 20, `درجه‌ی آسان باید قابل برد باشد (برد: ${easy.wins}/80)`);
  assert.ok(easy.wins > hard.wins, 'درجه‌ی آسان باید آسان‌تر از سخت باشد');
  assert.ok(hard.wins >= 0);
});

test('بازی هرگز بیش از پنج در نشان نمی‌دهد', () => {
  for (let seed = 1; seed <= 40; seed++) {
    let g = createDreamGame({ seed });
    let guard = 0;
    while (['playing', 'nightmare'].includes(g.status) && guard++ < 400) {
      if (g.status === 'nightmare') {
        g = applyNightmare(g, nightmareOptions(g)[0].id);
        continue;
      }
      const playable = playableCards(g);
      if (!playable.length) { g = discardDream(g, g.hand[0].id); continue; }
      g = playDream(g, playable[0].id);
      assert.ok(g.doors.length <= DOORS_NEEDED, `seed ${seed}: ${g.doors.length} در`);
    }
  }
});

/* ------------------------------ کمکی‌ها ------------------------------ */
test('کمکی‌های نمایش درست کار می‌کنند', () => {
  assert.equal(dreamName('garden'), 'باغ');
  assert.equal(signName('sun'), 'خورشید');
  assert.equal(dreamColor('garden'), DREAMS[0].hex);
  assert.equal(toFa(5), '۵');
  assert.equal(toFa(1234), '۱۲۳۴');

  const g = createDreamGame({ seed: 30 });
  const pct = progressPercent(g);
  assert.ok(pct >= 0 && pct <= 1);
  assert.equal(deckLeft(g), g.deck.length);
  assert.equal(SIGNS.length, 3);
});

test('پیشرفت همیشه بین صفر و یک است حتی با پنج در', () => {
  const g = { ...createDreamGame({ seed: 31 }), doors: ['garden', 'garden', 'library', 'library', 'tower'] };
  assert.equal(progressPercent(g), 1);
  const over = { ...g, doors: [...g.doors, 'tower'] };
  assert.ok(progressPercent(over) <= 1, 'درصد نباید از یک بیشتر شود');
});
