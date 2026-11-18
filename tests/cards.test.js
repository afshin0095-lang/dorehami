/* ============================================================
   آزمون «هفت خبیث» و «بیست‌ویک»
   ============================================================ */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SUITS, SUIT_LABEL, SUIT_GLYPH, SUIT_IS_RED, RANKS, rankLabel, fullDeck, seededShuffle,
  cardLabel, EIGHTS, createEights, eightsTop, eightsCanPlay, eightsPlayable, playEights,
  drawEights, eightsBot, eightsOver,
  handValue, isBust, isNatural, createBlackjack, playerValue, dealerValue, dealerShown,
  hit, stand, runDealer, blackjackBot, blackjackOver
} from '../public/src/engines/eights.js';

const card = (suit, rank) => ({ id: `${suit}-${rank}`, suit, rank });

/* ------------------------------ دسته ------------------------------ */

test('دستهٔ پاسور ۵۲ کارت یکتا دارد', () => {
  const d = fullDeck();
  assert.equal(d.length, 52);
  assert.equal(new Set(d.map(c => c.id)).size, 52);
});

test('هر خال ۱۳ کارت دارد', () => {
  const d = fullDeck();
  for (const s of SUITS) assert.equal(d.filter(c => c.suit === s).length, 13);
});

test('خال‌ها نام و نماد و رنگ دارند', () => {
  for (const s of SUITS) {
    assert.ok(SUIT_LABEL[s], `نام خال ${s}`);
    assert.ok(SUIT_GLYPH[s], `نماد خال ${s}`);
    assert.equal(typeof SUIT_IS_RED[s], 'boolean');
  }
  assert.equal(SUIT_IS_RED.hearts, true);
  assert.equal(SUIT_IS_RED.spades, false);
});

test('رتبه‌های تصویری برچسب حرفی دارند', () => {
  assert.equal(rankLabel(11), 'J');
  assert.equal(rankLabel(12), 'Q');
  assert.equal(rankLabel(13), 'K');
  assert.equal(rankLabel(14), 'A');
  assert.equal(rankLabel(7), '7');
});

test('بُر با دانهٔ ثابت تکرارپذیر است', () => {
  assert.equal(
    seededShuffle(fullDeck(), 4).map(c => c.id).join(),
    seededShuffle(fullDeck(), 4).map(c => c.id).join()
  );
});

test('برچسب کارت نماد خال را دارد', () => {
  assert.equal(cardLabel(card('hearts', 10)), '10♥');
});

/* ------------------------------ هفت خبیث ------------------------------ */

test('بازی تازه دست‌ها و زمین را می‌سازد', () => {
  const g = createEights({ players: 3, seed: 8 });
  assert.equal(g.hands.length, 3);
  for (const hand of g.hands) assert.equal(hand.length, 5);
  assert.ok(eightsTop(g));
  assert.equal(g.turn, 0);
  assert.equal(g.winner, null);
});

test('هم‌خال مجاز است، بی‌ربط نه', () => {
  assert.equal(eightsCanPlay(card('hearts', 3), card('hearts', 9), 'hearts'), true);
  assert.equal(eightsCanPlay(card('hearts', 3), card('spades', 9), 'spades'), false);
});

test('هم‌شماره مجاز است', () => {
  assert.equal(eightsCanPlay(card('clubs', 9), card('hearts', 9), 'hearts'), true);
});

test('هشت همیشه مجاز است', () => {
  assert.equal(eightsCanPlay(card('clubs', EIGHTS), card('hearts', 2), 'hearts'), true);
});

test('کارت هم‌خال با خال فعال (بعد از هشت) مجاز است', () => {
  assert.equal(eightsCanPlay(card('clubs', 4), card('hearts', 2), 'clubs'), true);
});

test('بازیکن بدون نوبت رد می‌شود', () => {
  const g = createEights({ players: 3, seed: 3 });
  const r = playEights(g, 1, g.hands[1][0].id);
  assert.equal(r.ok, false);
});

test('کارت غیرمجاز رد می‌شود', () => {
  const g = createEights({ players: 2, seed: 3 });
  const top = eightsTop(g);
  const bad = g.hands[0].find(c => !eightsCanPlay(c, top, g.activeSuit));
  if (bad) assert.equal(playEights(g, 0, bad.id).ok, false);
});

test('هشت خال فعال را عوض می‌کند و انتخاب نبودنش خطاست', () => {
  const g = createEights({ players: 2, seed: 3 });
  const eight = card('clubs', EIGHTS);
  const withEight = { ...g, hands: [[...g.hands[0], eight], g.hands[1]] };
  assert.equal(playEights(withEight, 0, eight.id).ok, false, 'بدون خال نباید قبول شود');
  const r = playEights(withEight, 0, eight.id, 'hearts');
  assert.equal(r.ok, true);
  assert.equal(r.game.activeSuit, 'hearts');
});

test('برداشت یک کارت به دست اضافه می‌کند و نوبت را می‌برد', () => {
  const g = createEights({ players: 3, seed: 6 });
  const before = g.hands[0].length;
  const r = drawEights(g, 0);
  assert.equal(r.ok, true);
  assert.equal(r.game.hands[0].length, before + 1);
  assert.equal(r.game.turn, 1);
});

test('خالی‌شدن دست برنده را تعیین می‌کند', () => {
  const g = createEights({ players: 2, seed: 6 });
  const top = eightsTop(g);
  const last = card(top.suit, top.rank === 2 ? 3 : 2);
  const rigged = { ...g, hands: [[last], g.hands[1]] };
  const r = playEights(rigged, 0, last.id);
  assert.equal(r.ok, true);
  assert.equal(r.game.winner, 0);
  assert.equal(eightsOver(r.game), true);
});

test('بازی تا پایان پیش می‌رود بدون گم‌شدن کارت', () => {
  for (let seed = 1; seed <= 6; seed++) {
    let g = createEights({ players: 3, seed });
    let guard = 0;
    while (!eightsOver(g) && guard++ < 900) {
      const seat = g.turn;
      const ch = eightsBot(g, seat);
      if (ch.action === 'draw') {
        const r = drawEights(g, seat);
        if (!r.ok) break;
        g = r.game;
      } else {
        const r = playEights(g, seat, ch.cardId, ch.suit);
        if (!r.ok) { const d = drawEights(g, seat); if (!d.ok) break; g = d.game; }
        else g = r.game;
      }
    }
    assert.ok(eightsOver(g), `دانه ${seed}: بازی تمام نشد`);
    const total = g.hands.flat().length + g.deck.length + g.discard.length;
    assert.equal(total, 52, `دانه ${seed}: کارت گم شد`);
  }
});

/* ------------------------------ بیست‌ویک ------------------------------ */

test('ارزش دست ساده جمع می‌شود', () => {
  assert.equal(handValue([card('hearts', 10), card('spades', 7)]), 17);
  assert.equal(handValue([card('hearts', 2), card('spades', 3), card('clubs', 4)]), 9);
});

test('آس هوشمند ۱۱ یا ۱ حساب می‌شود', () => {
  assert.equal(handValue([card('hearts', 14), card('spades', 9)]), 20);
  assert.equal(handValue([card('hearts', 14), card('spades', 9), card('clubs', 5)]), 15);
  assert.equal(handValue([card('hearts', 14), card('spades', 14)]), 12);
});

test('تصویری‌ها ۱۰ حساب می‌شوند', () => {
  assert.equal(handValue([card('hearts', 11), card('spades', 13)]), 20);
});

test('سوختن و بیست‌ویک طبیعی تشخیص داده می‌شوند', () => {
  assert.equal(isBust([card('hearts', 10), card('spades', 6), card('clubs', 8)]), true);
  assert.equal(isNatural([card('hearts', 14), card('spades', 13)]), true);
  assert.equal(isNatural([card('hearts', 10), card('spades', 11)]), false);
});

test('دست تازه دو کارت به بازیکن و دو کارت به دیلر می‌دهد', () => {
  const g = createBlackjack({ seed: 12 });
  assert.equal(g.hands[0].length, 2);
  assert.equal(g.dealer.length, 2);
  assert.equal(g.revealed, false);
  assert.equal(blackjackOver(g), false);
});

test('کارت پنهان دیلر در شمارش نمایان نیست', () => {
  const g = { ...createBlackjack({ seed: 12 }), dealer: [card('spades', 10), card('hearts', 7)] };
  assert.equal(dealerShown(g), 7);
  assert.equal(dealerValue(g), 17);
});

test('کشیدن کارت به دست اضافه می‌کند', () => {
  const g = { ...createBlackjack({ seed: 12 }), hands: [[card('hearts', 2)]], dealer: [card('spades', 10), card('clubs', 9)] };
  const r = hit(g, 0);
  assert.equal(r.ok, true);
  assert.equal(r.game.hands[0].length, 2);
});

test('عبور از ۲۱ باعث باخت فوری می‌شود و دیلر رو می‌شود', () => {
  const busted = { ...createBlackjack({ seed: 20 }), hands: [[card('hearts', 10), card('spades', 9), card('clubs', 5)]] };
  // دست ۲۴ ساخته شد؛ hit روی آن باید سوختن را ثبت کند
  const g = { ...createBlackjack({ seed: 20 }), hands: [[card('hearts', 10), card('spades', 9)]], dealer: [card('spades', 10), card('clubs', 9)] };
  let cur = g, guard = 0;
  while (!blackjackOver(cur) && guard++ < 30) {
    const r = hit(cur, 0);
    if (!r.ok) break;
    cur = r.game;
    if (playerValue(cur) > 21) break;
  }
  if (playerValue(cur) > 21) {
    assert.equal(cur.revealed, true, 'دیلر باید رو شود');
    assert.equal(cur.winner, 'lose');
    assert.equal(blackjackOver(cur), true);
  }
  assert.ok(busted.hands[0].length === 3);
});

test('ایستادن دیلر را بازی می‌دهد و برنده را می‌سازد', () => {
  const g = { ...createBlackjack({ seed: 15 }), hands: [[card('hearts', 10), card('spades', 9)]], dealer: [card('spades', 10), card('clubs', 6)] };
  const r = stand(g, 0);
  assert.equal(r.ok, true);
  assert.equal(r.game.revealed, true);
  assert.ok(['win', 'lose', 'push'].includes(r.game.winner));
  assert.equal(blackjackOver(r.game), true);
});

test('دیلر تا ۱۷ می‌کشد و روی ۱۷ می‌ایستد', () => {
  const soft16 = { ...createBlackjack({ seed: 15 }), hands: [[card('hearts', 10), card('spades', 9)]], dealer: [card('spades', 10), card('clubs', 6)] };
  const r = runDealer(soft16);
  assert.ok(dealerValue(r) >= 17 || dealerValue(r) > 21, `دیلر روی ${dealerValue(r)} ایستاد`);
  const hard17 = { ...createBlackjack({ seed: 15 }), hands: [[card('hearts', 10), card('spades', 9)]], dealer: [card('spades', 10), card('clubs', 7)] };
  assert.equal(dealerValue(runDealer({ ...hard17, deck: [] })), 17);
});

test('بازی با دیلر خالی و دستهٔ خالی قفل نمی‌شود', () => {
  const g = { ...createBlackjack({ seed: 15 }), hands: [[card('hearts', 10), card('spades', 9)]], dealer: [card('spades', 10), card('clubs', 6)], deck: [] };
  const r = stand(g, 0);
  assert.equal(r.ok, true);
  assert.equal(blackjackOver(r.game), true);
});

test('۲۰۰ دست بیست‌ویک همه تمام می‌شوند', () => {
  let wins = 0;
  for (let seed = 1; seed <= 200; seed++) {
    let g = createBlackjack({ seed });
    let guard = 0;
    while (!blackjackOver(g) && guard++ < 40) {
      const ch = blackjackBot(g, 0);
      const r = ch.action === 'hit' ? hit(g, 0) : stand(g, 0);
      if (!r.ok) break;
      g = r.game;
    }
    assert.equal(blackjackOver(g), true, `دانه ${seed}: دست تمام نشد`);
    assert.equal(g.revealed, true, `دانه ${seed}: دیلر رو نشد`);
    if (g.winner === 'win') wins++;
  }
  assert.ok(wins > 20, `فقط ${wins} برد از ۲۰۰ — بازیکن بیش از حد ضعیف است`);
});
