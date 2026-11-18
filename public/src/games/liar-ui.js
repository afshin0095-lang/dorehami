/* ============================================================
   «تاس دروغگو» — شرط روی تاس‌های مشترک، آخرین بازمانده
   ============================================================ */

import { h, mount, playSound, stats, toFa } from '../core.js';
import {
  RULES, LIAR_FACES, createLiarsDice, totalDice, liarOver, validBid, makeBid,
  challenge, liarBot, faceName
} from '../engines/bluff.js';
import { gameHeader, sheet, btn, helpBlock } from '../ui/kit.js';
import { die, turnBanner, seatStrip, tableNote } from '../ui/tablekit.js';

export function mountGame(root, { onExit, game } = {}) {
  let screen = 'intro';
  let state = null;
  let note = ''; let noteTone = 'info';
  let qty = 1; let face = 2;
  let botTimer = null;
  let showReveal = false;

  const render = () => mount(root, draw());
  render();
  const cleanup = () => { if (botTimer) { clearTimeout(botTimer); botTimer = null; } };
  const setNote = (t, tone = 'info') => { note = t; noteTone = tone; };

  function draw() {
    if (screen === 'help') return drawHelp();
    if (screen === 'play') return drawPlay();
    if (screen === 'over') return drawOver();
    return drawIntro();
  }

  function start() {
    cleanup();
    note = ''; showReveal = false;
    state = createLiarsDice({ players: 3, seed: (Date.now() ^ Math.random() * 1e6) >>> 0 });
    qty = Math.max(1, Math.floor(totalDice(state) / 3));
    face = 2;
    screen = 'play';
    playSound('shuffle');
    render();
    scheduleBot();
  }

  function finish() {
    cleanup();
    if (!state || state._recorded) return;
    state._recorded = true;
    const won = state.winner === 0;
    stats.record('liarsdice', {
      key: 'liarsdice-wins', best: won ? 1 : 0, higherIsBetter: true,
      label: won ? 'آخرین بازمانده' : `تاس‌هایت تمام شد`
    });
    playSound(won ? 'win' : 'lose');
    screen = 'over';
    render();
  }

  function scheduleBot() {
    cleanup();
    if (!state || liarOver(state) || state.turn === 0) return;
    botTimer = setTimeout(() => {
      botTimer = null;
      if (!state || liarOver(state) || state.turn === 0) return;
      const seat = state.turn;
      const ch = liarBot(state, seat);
      let r;
      if (ch.action === 'bid') {
        r = makeBid(state, seat, ch.qty, ch.face);
        if (!r.ok) r = challenge(state, seat);
      } else {
        r = challenge(state, seat);
      }
      if (!r.ok) { finish(); return; }
      state = r.game;
      if (r.reveal) { showReveal = true; note = revealText(r.reveal, state); noteTone = r.reveal.bidTrue ? 'bad' : 'info'; }
      playSound(r.reveal ? 'seal' : 'tap');
      if (liarOver(state)) { finish(); return; }
      render();
      scheduleBot();
    }, 700);
  }

  const revealText = (rv, g) => rv.bidTrue
    ? `دروغ نبود — ${toFa(rv.count)} تا ${faceName(rv.face)} بود`
    : `دروغ بود — فقط ${toFa(rv.count)} تا ${faceName(rv.face)}`

  /* ------------------------------ مقدمه ------------------------------ */

  function drawIntro() {
    return h('div', {},
      gameHeader({ title: 'تاس دروغگو', onBack: onExit }),
      h('section', { class: 'liar-hero print-edge' },
        h('div', { class: 'liar-hero__dice', 'aria-hidden': 'true' },
          ...[2, 4, 6, 3, 5].map(v => die(v))
        ),
        h('div', { class: 'liar-hero__text' },
          h('div', { class: 'liar-hero__kicker' }, '۵ تاس · بلوف بزن'),
          h('h1', {}, 'راست می‌گوید یا نه؟'),
          h('p', {}, 'تاس‌ها پنهان‌اند. شرط ببند، بالاتر برو، یا اعتراض کن.')
        )
      ),
      h('div', { class: 'stack' },
        btn('شروع', { variant: 'btn--primary btn--block', onClick: start }),
        btn('راهنما', { onClick: () => { screen = 'help'; render(); } })
      )
    );
  }

  function drawHelp() {
    return h('div', {},
      gameHeader({ title: 'راهنمای تاس دروغگو', onBack: () => { screen = 'intro'; render(); } }),
      sheet({ title: 'قواعد', iconName: 'book', children: helpBlock(RULES) }),
      h('div', { class: 'stack' },
        btn('فهمیدم', { variant: 'btn--primary btn--block', onClick: () => { screen = 'intro'; render(); } })
      )
    );
  }

  /* ------------------------------ بازی ------------------------------ */

  function drawPlay() {
    const g = state;
    const myTurn = g.turn === 0 && !liarOver(g);
    const total = totalDice(g);
    const myHand = g.hands[0];
    const bidValid = validBid(g, qty, face);
    const maxQty = total;

    return h('div', {},
      gameHeader({
        title: 'میز تاس دروغگو',
        onBack: () => { cleanup(); screen = 'intro'; render(); },
        children: [
          h('span', { class: 'score-pill' }, `${toFa(total)} تاس روی میز`),
          h('span', { class: 'score-pill' }, `${toFa(myHand.length)} تاس تو`)
        ]
      }),

      seatStrip(g.names.map((n, i) => ({
        name: n,
        meta: g.alive[i] ? `${toFa(g.hands[i].length)} تاس` : 'بیرون',
        active: g.turn === i, mine: i === 0
      }))),

      /* تاس‌های من */
      h('section', { class: 'liar-hand' },
        h('div', { class: 'liar-hand__label' }, 'تاس‌های تو (فقط خودت می‌بینی)'),
        h('div', { class: 'liar-hand__row' },
          ...myHand.map((v, i) => die(v, { label: `تاس ${i + 1}: ${faceName(v)}` }))
        )
      ),

      /* شرط فعلی */
      h('section', { class: 'liar-bid print-edge' },
        g.bid
          ? h('div', { class: 'liar-bid__now' },
              h('span', { class: 'liar-bid__by' }, `${g.names[g.bid.seat]} شرط بست:`),
              h('strong', { class: 'liar-bid__val' }, `${toFa(g.bid.qty)} × ${faceName(g.bid.face)}`)
            )
          : h('div', { class: 'liar-bid__now' },
              h('span', { class: 'liar-bid__by' }, 'هنوز شرطی بسته نشده')
            ),
        showReveal && g.reveal ? h('p', { class: `liar-bid__reveal${g.reveal.bidTrue ? ' is-true' : ' is-false'}` },
          g.reveal.bidTrue
            ? `راست بود — ${toFa(g.reveal.count)} تا ${faceName(g.reveal.face)}`
            : `دروغ بود — فقط ${toFa(g.reveal.count)} تا ${faceName(g.reveal.face)}`) : null
      ),

      turnBanner(myTurn ? 'نوبت توست — شرط ببند یا اعتراض کن' : `${g.names[g.turn]} فکر می‌کند…`,
        { tone: myTurn ? 'mine' : 'theirs' }),

      sheet({ title: 'شرط تو', iconName: 'dice', children:
        h('div', { class: 'liar-form' },
          h('div', { class: 'liar-form__field' },
            h('label', { class: 'liar-form__label', for: 'liar-qty' }, 'تعداد'),
            h('div', { class: 'liar-stepper' },
              h('button', { class: 'liar-stepper__btn', 'aria-label': 'کمتر', onclick: () => stepQty(-1) }, '−'),
              h('output', { class: 'liar-stepper__val', id: 'liar-qty' }, toFa(qty)),
              h('button', { class: 'liar-stepper__btn', 'aria-label': 'بیشتر', onclick: () => stepQty(1) }, '+')
            )
          ),
          h('div', { class: 'liar-form__field' },
            h('span', { class: 'liar-form__label' }, 'وجه'),
            h('div', { class: 'liar-faces' },
              ...Array.from({ length: LIAR_FACES }, (_, i) => i + 1).map(f =>
                h('button', {
                  class: `liar-face${f === face ? ' is-on' : ''}`,
                  'aria-label': `وجه ${faceName(f)}`,
                  onclick: () => { face = f; playSound('tap'); render(); }
                }, die(f))
              )
            )
          )
        )
      }),

      h('div', { class: 'liar-actions' },
        btn(`شرط: ${toFa(qty)} × ${faceName(face)}`, {
          variant: 'btn--primary btn--block',
          disabled: !myTurn || !bidValid,
          onClick: onBid
        }),
        btn('دروغ می‌گویی!', {
          variant: 'btn--danger btn--block',
          disabled: !myTurn || !g.bid,
          onClick: onChallenge
        })
      ),
      !bidValid && myTurn ? tableNote('شرط باید بالاتر از شرط فعلی باشد', { tone: 'bad' }) : null,

      note ? tableNote(note, { tone: noteTone }) : null,

      h('section', { class: 'liar-log' },
        ...[...g.log].reverse().slice(0, 6).map(t => h('p', { class: 'liar-log__row' }, t))
      )
    );
  }

  function stepQty(d) {
    if (!state) return;
    const total = totalDice(state);
    qty = Math.max(1, Math.min(total, qty + d));
    playSound('tap');
    render();
  }

  function onBid() {
    if (!state || state.turn !== 0) return;
    const r = makeBid(state, 0, qty, face);
    if (!r.ok) { setNote(r.error, 'bad'); playSound('error'); render(); return; }
    state = r.game; showReveal = false;
    setNote(`شرط ثبت شد: ${qty} × ${faceName(face)}`, 'info');
    playSound('tap');
    render();
    scheduleBot();
  }

  function onChallenge() {
    if (!state || state.turn !== 0) return;
    const r = challenge(state, 0);
    if (!r.ok) { setNote(r.error, 'bad'); render(); return; }
    state = r.game; showReveal = true;
    setNote(revealText(r.reveal, state), r.reveal.bidTrue ? 'bad' : 'info');
    playSound('seal');
    if (liarOver(state)) { finish(); return; }
    render();
    scheduleBot();
  }

  /* ------------------------------ پایان ------------------------------ */

  function drawOver() {
    const won = state?.winner === 0;
    return h('div', {},
      gameHeader({ title: won ? 'بردی' : 'باختی', onBack: onExit }),
      h('section', { class: `cards-result${won ? ' is-win' : ''}` },
        h('div', { class: 'cards-result__seal', 'aria-hidden': 'true' }, won ? '❧' : '☾'),
        h('h2', {}, won ? 'همه بلوف‌ها را دیدی' : 'تاس‌هایت تمام شد'),
        ...state.alive.map((a, i) => h('p', {}, `${state.names[i]}: ${a ? 'مانده' : 'بیرون'}`))
      ),
      h('div', { class: 'stack' },
        btn('دست تازه', { variant: 'btn--primary btn--block', onClick: start }),
        btn('بازگشت', { variant: 'btn--ghost btn--block', onClick: onExit })
      )
    );
  }

  return () => { cleanup(); state = null; };
}
