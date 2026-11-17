import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fullDeck, shuffleDeck, deal, canPlay, trickWinner, trickPoints, cardPoints, strengthInTrump, teamOf, createHokmGame, playCard, botCard, SUITS, RANKS } from '../public/src/engines/hokm.js';
import { mulberry32 } from '../public/src/core.js';

test('fullDeck: ۵۲ ورق یکتا', () => {
  const d = fullDeck();
  assert.equal(d.length, 52);
  assert.equal(new Set(d.map(c => c.id)).size, 52);
});

test('shuffleDeck: همان مجموعه ورق‌ها', () => {
  const d = shuffleDeck(mulberry32(3));
  assert.equal(d.length, 52);
  assert.deepEqual([...d.map(c => c.id)].sort(), [...fullDeck().map(c => c.id)].sort());
});

test('shuffleDeck: تکرارپذیر با seed', () => {
  const a = shuffleDeck(mulberry32(9)).map(c => c.id);
  const b = shuffleDeck(mulberry32(9)).map(c => c.id);
  assert.deepEqual(a, b);
});

test('deal: ۱۳ کارت برای هر نفر، بدون تکرار', () => {
  const hands = deal(mulberry32(11));
  assert.equal(hands.length, 4);
  hands.forEach(hnd => assert.equal(hnd.length, 13));
  const all = hands.flat().map(c => c.id);
  assert.equal(new Set(all).size, 52);
});

test('cardPoints: امتیاز استاندارد حکم', () => {
  assert.equal(cardPoints(14), 5);
  assert.equal(cardPoints(13), 4);
  assert.equal(cardPoints(12), 3);
  assert.equal(cardPoints(11), 2);
  assert.equal(cardPoints(10), 1);
  assert.equal(cardPoints(9), 0);
});

test('strengthInTrump: سرباز قوی‌ترین کارت حکم است', () => {
  assert.ok(strengthInTrump(11) > strengthInTrump(14));
  assert.ok(strengthInTrump(14) > strengthInTrump(10));
});

test('teamOf: شریک‌ها روبه‌رو', () => {
  assert.equal(teamOf(0), 'A');
  assert.equal(teamOf(2), 'A');
  assert.equal(teamOf(1), 'B');
  assert.equal(teamOf(3), 'B');
});

test('canPlay: باید از خال زمین بازی کرد', () => {
  const hand = [{ suit: 'hearts', rank: 5, id: 'hearts-5' }, { suit: 'spades', rank: 9, id: 'spades-9' }];
  assert.equal(canPlay(hand, hand[0], 'hearts'), true);
  assert.equal(canPlay(hand, hand[1], 'hearts'), false);
});

test('canPlay: بدون خال زمین هر کارتی مجاز است', () => {
  const hand = [{ suit: 'hearts', rank: 5, id: 'hearts-5' }];
  assert.equal(canPlay(hand, hand[0], null), true);
});

test('canPlay: کارتی که در دست نیست مجاز نیست', () => {
  const hand = [{ suit: 'hearts', rank: 5, id: 'hearts-5' }];
  assert.equal(canPlay(hand, { suit: 'clubs', rank: 3, id: 'clubs-3' }, null), false);
});

test('canPlay: خال ندارد پس می‌تواند حکم بزند', () => {
  const hand = [{ suit: 'clubs', rank: 3, id: 'clubs-3' }];
  assert.equal(canPlay(hand, hand[0], 'hearts'), true);
});

test('trickWinner: حکم برنده است', () => {
  const plays = [
    { seat: 0, card: { suit: 'hearts', rank: 14 } },
    { seat: 1, card: { suit: 'spades', rank: 2 } },
    { seat: 2, card: { suit: 'hearts', rank: 13 } },
    { seat: 3, card: { suit: 'hearts', rank: 12 } }
  ];
  assert.equal(trickWinner(plays, 'spades'), 1);
});

test('trickWinner: بدون حکم، بالاترین کارت خال زمین', () => {
  const plays = [
    { seat: 0, card: { suit: 'hearts', rank: 5 } },
    { seat: 1, card: { suit: 'hearts', rank: 14 } },
    { seat: 2, card: { suit: 'clubs', rank: 13 } },
    { seat: 3, card: { suit: 'diamonds', rank: 14 } }
  ];
  assert.equal(trickWinner(plays, 'spades'), 1);
});

test('trickPoints: جمع امتیاز دور', () => {
  const plays = [
    { seat: 0, card: { suit: 'hearts', rank: 14 } },
    { seat: 1, card: { suit: 'hearts', rank: 13 } },
    { seat: 2, card: { suit: 'hearts', rank: 10 } },
    { seat: 3, card: { suit: 'hearts', rank: 2 } }
  ];
  assert.equal(trickPoints(plays), 10);
});

test('playCard: نوبت غیرمجاز رد می‌شود', () => {
  const g = createHokmGame();
  assert.throws(() => playCard(g, 1, g.hands[1][0]));
});

test('playCard: دور کامل، امتیاز به تیم برنده می‌رسد', () => {
  let g = createHokmGame({ trumpSuit: 'spades' });
  // چهار کارت هم‌خال دل بسازیم تا برنده قطعی باشد
  const hearts = [14, 13, 12, 11].map(r => ({ suit: 'hearts', rank: r, id: `hearts-${r}` }));
  g = {
    ...g,
    hands: [hearts.slice(0, 1), hearts.slice(1, 2), hearts.slice(2, 3), hearts.slice(3, 4)],
    trick: [], trickLead: null, turn: 0
  };
  g = playCard(g, 0, hearts[0]);
  g = playCard(g, 1, hearts[1]);
  g = playCard(g, 2, hearts[2]);
  g = playCard(g, 3, hearts[3]);
  assert.equal(g.trick.length, 0);
  assert.equal(g.tricksWon.A, 1);
  assert.equal(g.scores.A, 0 + cardPoints(14) + cardPoints(13) + cardPoints(12) + cardPoints(11));
  assert.equal(g.turn, 0); // آس دل برنده شد
});

test('playCard: کارت غیرمجاز خطا می‌دهد', () => {
  const g = createHokmGame();
  const notInHand = { suit: 'spades', rank: 2, id: 'spades-2' };
  const has = g.hands[0].some(c => c.id === notInHand.id);
  if (!has) assert.throws(() => playCard(g, 0, notInHand));
});

test('botCard: همیشه کارت مجاز برمی‌گرداند', () => {
  const g = createHokmGame();
  for (let seat = 0; seat < 4; seat++) {
    const card = botCard(g.hands[seat], null, g.trump);
    assert.ok(g.hands[seat].some(c => c.id === card.id));
  }
});

test('botCard: با خال زمین، کارت مجاز انتخاب می‌کند', () => {
  const g = createHokmGame();
  const lead = g.hands[0][0].suit;
  for (let seat = 1; seat < 4; seat++) {
    const card = botCard(g.hands[seat], lead, g.trump);
    assert.equal(canPlay(g.hands[seat], card, lead), true);
  }
});

test('بازی کامل: ۱۳ دور تمام می‌شود و برنده اعلام می‌شود', () => {
  let g = createHokmGame({ trumpSuit: 'clubs' });
  let guard = 0;
  while (!g.finished && guard++ < 200) {
    const seat = g.turn;
    const partnerWinning = false;
    const card = botCard(g.hands[seat], g.trickLead, g.trump, partnerWinning);
    g = playCard(g, seat, card);
  }
  assert.equal(g.finished, true);
  assert.equal(g.roundCount, 13);
  assert.ok(['A', 'B'].includes(g.winner));
  assert.equal(g.hands.flat().length, 0);
});

void SUITS; void RANKS;
