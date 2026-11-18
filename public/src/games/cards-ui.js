/* ============================================================
   «هفت خبیث» و «بیست‌ویک» — رابط مشترک دو بازی ورق
   کارت‌ها با نماد خال و رتبه، روی میز سبز-کاغذی.
   ============================================================ */

import { h, mount, playSound, stats, toFa } from '../core.js';
import {
  SUIT_LABEL, SUIT_GLYPH, SUIT_IS_RED, rankLabel,
  createEights, playEights, drawEights, eightsBot, eightsPlayable, eightsTop, eightsOver,
  createBlackjack, hit, stand, playerValue, dealerValue, dealerShown,
  blackjackOver, cardLabel, handValue
} from '../engines/eights.js';
import { gameHeader, sheet, btn, helpBlock } from '../ui/kit.js';
import { handCard, turnBanner, seatStrip, drawPile, tableNote, cardGlyph } from '../ui/tablekit.js';

const EIGHTS_RULES = {
  steps: [
    'هر بازیکن ۵ کارت می‌گیرد و یک کارت روی زمین می‌نشیند.',
    'کارتی بازی کن که هم‌خال کارت روی زمین باشد یا هم‌شمارهٔ آن.',
    'کارت ۸ خال را عوض می‌کند: هر خالی را می‌توانی انتخاب کنی.',
    'اگر کارت مجاز نداشتی، از انبار یک کارت بردار و نوبت را رد کن.',
    'هر کس دستش خالی شود، برنده است.'
  ],
  example: 'روی زمین «۷ دل» است. می‌توانی هر کارت دل، هر ۷ دیگر، یا یک ۸ بازی کنی.',
  note: 'این نسخه با دو تا چهار بازیکن و رقیب کامپیوتری.'
};

const BJ_RULES = {
  steps: [
    'هدف: مجموع کارت‌هایت به ۲۱ نزدیک شود، بدون اینکه از آن بگذرد.',
    'کارت‌های ۲ تا ۱۰ ارزش عددی خود را دارند؛ سرباز، ملکه و شاه هر کدام ۱۰.',
    'آس ۱۱ یا ۱ حساب می‌شود — هر چه به نفع دست باشد.',
    'می‌توانی کارت بکشی (Hit) یا بایستی (Stand).',
    'دیلر تا ۱۷ می‌کشد. اگر از ۲۱ بگذرد، تو بردی.',
    'اگر مساوی شوی، دست مساوی است (Push).'
  ],
  example: 'دست تو ۱۰ و ۷ است، یعنی ۱۷. کشیدن کارت پرخطر است؛ ایستادن معقول‌تر است.',
  note: 'دیلر تا ۱۷ می‌کشد. این نسخه سرگرمی است، نه شرط‌بندی.'
};

export function mountGame(root, { onExit, game } = {}) {
  const kind = game?.id === 'blackjack' ? 'blackjack' : 'eights';
  const title = kind === 'blackjack' ? 'بیست‌ویک' : 'هفت خبیث';

  let screen = 'intro';
  let state = null;
  let note = '';
  let noteTone = 'info';
  let pendingEight = null;
  let botTimer = null;

  const render = () => mount(root, draw());
  render();

  const cleanupBots = () => { if (botTimer) { clearTimeout(botTimer); botTimer = null; } };
  const setNote = (t, tone = 'info') => { note = t; noteTone = tone; };

  function draw() {
    if (screen === 'help') return drawHelp();
    if (screen === 'play') return kind === 'blackjack' ? drawBlackjack() : drawEights();
    if (screen === 'over') return drawOver();
    return drawIntro();
  }

  function start() {
    cleanupBots();
    note = ''; noteTone = 'info'; pendingEight = null;
    state = kind === 'blackjack'
      ? createBlackjack({ seed: (Date.now() ^ Math.random() * 1e6) >>> 0, players: 1 })
      : createEights({ seed: (Date.now() ^ Math.random() * 1e6) >>> 0, players: 3 });
    screen = 'play';
    playSound('card-deal');
    render();
    if (kind === 'eights') scheduleBot();
  }

  function finish() {
    cleanupBots();
    if (!state || state._recorded) return;
    state._recorded = true;
    const won = kind === 'blackjack'
      ? state.winner === 'win'
      : state.winner === 0;
    stats.record(kind, {
      key: `${kind}-wins`, best: won ? 1 : 0, higherIsBetter: true,
      label: won ? 'برد' : 'باخت'
    });
    playSound(won ? 'win' : 'lose');
    screen = 'over';
    render();
  }

  /* ------------------------------ رقیب ------------------------------ */

  function scheduleBot() {
    cleanupBots();
    if (kind !== 'eights' || !state || state.winner !== null || state.turn === 0) return;
    botTimer = setTimeout(() => {
      botTimer = null;
      if (!state || state.winner !== null || state.turn === 0) return;
      const seat = state.turn;
      const choice = eightsBot(state, seat);
      if (choice.action === 'draw') {
        const r = drawEights(state, seat);
        if (r.ok) { state = r.game; playSound('card-slide'); }
      } else {
        const r = playEights(state, seat, choice.cardId, choice.suit);
        if (r.ok) { state = r.game; playSound('card-deal'); }
        else { const d = drawEights(state, seat); if (d.ok) state = d.game; }
      }
      if (eightsOver(state)) { finish(); return; }
      render();
      scheduleBot();
    }, 620);
  }

  /* ------------------------------ مقدمه ------------------------------ */

  function drawIntro() {
    return h('div', {},
      gameHeader({ title, onBack: onExit }),
      h('section', { class: 'cards-hero print-edge' },
        h('div', { class: 'cards-hero__fan', 'aria-hidden': 'true' },
          ...[['hearts', 14], ['spades', 13], ['diamonds', 12]].map(([s, r], i) => h('span', {
            class: `cards-hero__card${SUIT_IS_RED[s] ? ' is-red' : ''}`,
            style: `transform:rotate(${(i - 1) * 9}deg)`
          }, cardGlyph({ suit: s, rank: r })))
        ),
        h('div', { class: 'cards-hero__text' },
          h('div', { class: 'cards-hero__kicker' }, kind === 'blackjack' ? 'تا ۲۱، نه بیشتر' : 'هم‌خال یا هم‌شماره'),
          h('h1', {}, kind === 'blackjack' ? 'بکش یا بایست' : 'زودتر خالی کن'),
          h('p', {}, kind === 'blackjack'
            ? 'هر کارت تازه هیجان دارد، ولی یک قدم تا سوختن فاصله است.'
            : 'کارت هم‌خال یا هم‌شماره؛ هشت‌ها خال را عوض می‌کنند.')
        )
      ),
      h('div', { class: 'stack' },
        btn('شروع دست', { variant: 'btn--primary btn--block', onClick: start }),
        btn('راهنما', { onClick: () => { screen = 'help'; render(); } })
      )
    );
  }

  function drawHelp() {
    return h('div', {},
      gameHeader({ title: `راهنمای ${title}`, onBack: () => { screen = 'intro'; render(); } }),
      sheet({ title: 'قواعد', iconName: 'book', children: helpBlock(kind === 'blackjack' ? BJ_RULES : EIGHTS_RULES) }),
      h('div', { class: 'stack' },
        btn('فهمیدم', { variant: 'btn--primary btn--block', onClick: () => { screen = 'intro'; render(); } })
      )
    );
  }

  /* ------------------------------ هفت خبیث ------------------------------ */

  function drawEights() {
    const g = state;
    const top = eightsTop(g);
    const myTurn = g.turn === 0;
    const legal = eightsPlayable(g, 0);

    return h('div', {},
      gameHeader({
        title: 'میز هفت خبیث',
        onBack: () => { cleanupBots(); screen = 'intro'; render(); },
        children: [
          h('span', { class: 'score-pill' }, `${toFa(g.hands[0].length)} کارت`),
          h('span', { class: 'score-pill' }, `خال ${SUIT_LABEL[g.activeSuit]}`)
        ]
      }),

      seatStrip(g.names.map((n, i) => ({
        name: n, meta: `${toFa(g.hands[i].length)} کارت`,
        active: g.turn === i, mine: i === 0
      }))),

      h('section', { class: 'cards-table', 'aria-label': 'میز بازی' },
        h('div', { class: 'cards-table__pile' },
          drawPile(g.deck.length, { label: 'برداشت', onClick: myTurn ? onEightsDraw : null })
        ),
        h('div', { class: 'cards-table__center' },
          h('div', { class: `cards-top${SUIT_IS_RED[top.suit] ? ' is-red' : ''}` },
            h('span', { class: 'cards-top__rank' }, rankLabel(top.rank)),
            h('span', { class: 'cards-top__suit' }, SUIT_GLYPH[top.suit])
          ),
          h('p', { class: 'cards-table__suit' }, `خال فعال: ${SUIT_LABEL[g.activeSuit]}`),
          note ? tableNote(note, { tone: noteTone }) : null
        )
      ),

      pendingEight
        ? h('section', { class: 'cards-pick' },
            h('h3', { class: 'cards-pick__title' }, 'خال را انتخاب کن'),
            h('div', { class: 'cards-pick__row' },
              ...Object.keys(SUIT_LABEL).map(s => h('button', {
                class: `cards-pick__btn${SUIT_IS_RED[s] ? ' is-red' : ''}`,
                'aria-label': `خال ${SUIT_LABEL[s]}`,
                onclick: () => commitEight(s)
              }, h('span', {}, SUIT_GLYPH[s]), h('span', {}, SUIT_LABEL[s])))
            ),
            btn('بی‌خیال', { variant: 'btn--ghost btn--block', onClick: () => { pendingEight = null; render(); } })
          )
        : null,

      turnBanner(
        myTurn ? 'نوبت توست' : `${g.names[g.turn]} بازی می‌کند…`,
        { tone: myTurn ? 'mine' : 'theirs' }
      ),

      sheet({ title: `دست تو (${toFa(g.hands[0].length)})`, iconName: 'cards', children:
        h('div', { class: 'cards-hand' },
          ...g.hands[0].map(c => handCard(
            { suit: c.suit, rank: c.rank },
            {
              label: cardGlyph(c),
              playable: myTurn && legal.some(l => l.id === c.id),
              onClick: myTurn ? () => onEightsPlay(c) : null
            }
          ))
        )
      }),

      h('div', { class: 'cards-actions' },
        btn('برداشتن کارت', { variant: 'btn--teal btn--block', disabled: !myTurn, onClick: onEightsDraw })
      )
    );
  }

  function onEightsPlay(card) {
    if (!state || state.turn !== 0) return;
    if (card.rank === 8) { pendingEight = card; playSound('tap'); render(); return; }
    const r = playEights(state, 0, card.id);
    if (!r.ok) { setNote(r.error, 'bad'); playSound('error'); render(); return; }
    state = r.game;
    setNote(`${cardLabel(card)} بازی شد`, 'info');
    playSound('card-deal');
    if (eightsOver(state)) { finish(); return; }
    render();
    scheduleBot();
  }

  function commitEight(suit) {
    if (!pendingEight) return;
    const r = playEights(state, 0, pendingEight.id, suit);
    pendingEight = null;
    if (!r.ok) { setNote(r.error, 'bad'); render(); return; }
    state = r.game;
    setNote(`خال به ${SUIT_LABEL[suit]} تغییر کرد`, 'info');
    playSound('card-deal');
    if (eightsOver(state)) { finish(); return; }
    render();
    scheduleBot();
  }

  function onEightsDraw() {
    if (!state || state.turn !== 0) return;
    const r = drawEights(state, 0);
    if (!r.ok) { setNote(r.error, 'bad'); render(); return; }
    state = r.game;
    setNote(`یک کارت برداشتی (${cardLabel(r.card)})`, 'info');
    playSound('card-slide');
    render();
    scheduleBot();
  }

  /* ------------------------------ بیست‌ویک ------------------------------ */

  function drawBlackjack() {
    const g = state;
    const myHand = g.hands[0];
    const mine = playerValue(g);
    const over = blackjackOver(g);

    return h('div', {},
      gameHeader({ title: 'میز بیست‌ویک', onBack: () => { cleanupBots(); screen = 'intro'; render(); } }),

      /* دیلر */
      h('section', { class: 'bj-dealer', 'aria-label': 'دیلر' },
        h('div', { class: 'bj-dealer__label' },
          `دیلر${over ? ` — ${toFa(dealerValue(g))}` : ` — نمایان ${toFa(dealerShown(g))}`}`
        ),
        h('div', { class: 'bj-dealer__hand' },
          ...g.dealer.map((c, i) => (i === 0 && !g.revealed)
            ? handCard(c, { facedown: true, playable: false })
            : handCard(c, { label: cardGlyph(c), playable: false }))
        )
      ),

      /* دست من */
      h('section', { class: 'bj-mine', 'aria-label': 'دست تو' },
        h('div', { class: `bj-mine__label${mine > 21 ? ' is-bust' : mine === 21 ? ' is-perfect' : ''}` },
          `دست تو — ${toFa(mine)}${mine > 21 ? ' (سوخت)' : mine === 21 ? ' (بیست‌ویک!)' : ''}`),
        h('div', { class: 'bj-mine__hand' },
          ...myHand.map(c => handCard(c, { label: cardGlyph(c), playable: false }))
        )
      ),

      note ? tableNote(note, { tone: noteTone }) : null,

      over
        ? h('section', { class: 'bj-outcome' },
            h('h2', { class: state.winner === 'win' ? 'is-win' : 'is-lose' },
              state.winner === 'win' ? 'بردی' : state.winner === 'push' ? 'مساوی' : 'باختی'),
            h('p', {}, `نتیجه: ${state.results?.[0]?.outcome === 'win' ? 'برد' : state.results?.[0]?.outcome === 'push' ? 'مساوی' : 'باخت'}`)
          )
        : h('div', { class: 'bj-actions' },
            btn('کارت بکش', { variant: 'btn--primary btn--block', onClick: onHit }),
            btn('بایست', { variant: 'btn--teal btn--block', onClick: onStand })
          ),

      over
        ? h('div', { class: 'stack' },
            btn('دست تازه', { variant: 'btn--primary btn--block', onClick: start }),
            btn('بازگشت', { variant: 'btn--ghost btn--block', onClick: onExit })
          )
        : btn('بازگشت', { variant: 'btn--ghost btn--block', onClick: () => { cleanupBots(); screen = 'intro'; render(); } })
    );
  }

  function onHit() {
    if (!state || blackjackOver(state)) return;
    const r = hit(state, 0);
    if (!r.ok) { setNote(r.error, 'bad'); render(); return; }
    state = r.game;
    setNote(r.bust ? 'از ۲۱ گذشتی!' : `کارت: ${cardLabel(r.card)}`, r.bust ? 'bad' : 'info');
    playSound(r.bust ? 'error' : 'card-deal');
    if (blackjackOver(state)) { finish(); return; }
    render();
  }

  function onStand() {
    if (!state || blackjackOver(state)) return;
    const r = stand(state, 0);
    if (!r.ok) { setNote(r.error, 'bad'); render(); return; }
    state = r.game;
    setNote(`دیلر: ${toFa(dealerValue(state))}`, 'info');
    playSound('card-slide');
    if (blackjackOver(state)) { finish(); return; }
    render();
  }

  /* ------------------------------ پایان ------------------------------ */

  function drawOver() {
    const won = kind === 'blackjack' ? state?.winner === 'win' : state?.winner === 0;
    const push = kind === 'blackjack' && state?.winner === 'push';
    return h('div', {},
      gameHeader({ title: won ? 'بردی' : push ? 'مساوی' : 'باختی', onBack: onExit }),
      h('section', { class: `cards-result${won ? ' is-win' : ''}` },
        h('div', { class: 'cards-result__seal', 'aria-hidden': 'true' }, won ? '❧' : push ? '≈' : '☾'),
        h('h2', {}, won ? `در ${title} بردی` : push ? 'دست مساوی شد' : 'این دست را باختی'),
        kind === 'blackjack'
          ? h('p', {}, `دست تو ${toFa(playerValue(state))} — دیلر ${toFa(dealerValue(state))}`)
          : h('p', {}, `کارت‌های تو: ${toFa(state?.hands?.[0]?.length ?? 0)}`)
      ),
      h('div', { class: 'stack' },
        btn('دست تازه', { variant: 'btn--primary btn--block', onClick: start }),
        btn('بازگشت', { variant: 'btn--ghost btn--block', onClick: onExit })
      )
    );
  }

  return () => { cleanupBots(); state = null; };
}
