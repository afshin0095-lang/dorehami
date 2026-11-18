/* ============================================================
   «بچه گربه‌های منفجر شونده» — کشیدن از دسته، امیدوار باش
   ============================================================ */

import { h, mount, playSound, stats, toFa } from '../core.js';
import {
  KIND, KITTEN, RULES, createKittens, kittensOver, playCard, playPair,
  drawCard, playNope, kittensBot, handOf
} from '../engines/kittens.js';
import { gameHeader, sheet, btn, helpBlock } from '../ui/kit.js';
import { turnBanner, seatStrip, tableNote } from '../ui/tablekit.js';

export function mountGame(root, { onExit, game } = {}) {
  let screen = 'intro';
  let state = null;
  let note = ''; let noteTone = 'info';
  let botTimer = null;

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
    note = '';
    state = createKittens({ players: 3, seed: (Date.now() ^ Math.random() * 1e6) >>> 0 });
    screen = 'play';
    playSound('card-deal');
    render();
    scheduleBot();
  }

  function finish() {
    cleanup();
    if (!state || state._recorded) return;
    state._recorded = true;
    const won = state.winner === 0;
    stats.record('kittens', {
      key: 'kittens-wins', best: won ? 1 : 0, higherIsBetter: true,
      label: won ? 'آخرین بازمانده' : 'منفجر شدی'
    });
    playSound(won ? 'win' : 'lose');
    screen = 'over';
    render();
  }

  function scheduleBot() {
    cleanup();
    if (!state || kittensOver(state) || state.turn === 0) return;
    botTimer = setTimeout(() => {
      botTimer = null;
      if (!state || kittensOver(state) || state.turn === 0) return;
      const seat = state.turn;
      const ch = kittensBot(state, seat);
      let r;
      if (ch.action === 'draw') r = drawCard(state, seat);
      else if (ch.action === 'pair') r = playPair(state, seat, ch.kind, ch.target);
      else r = playCard(state, seat, ch.cardId, { target: ch.target });
      if (!r.ok) { const d = drawCard(state, seat); if (!d.ok) { finish(); return; } r = d; }
      state = r.game;
      if (r.boom && r.eliminated) playSound('lose');
      else playSound('card-slide');
      if (kittensOver(state)) { finish(); return; }
      render();
      scheduleBot();
    }, 640);
  }

  /* ------------------------------ مقدمه ------------------------------ */

  function drawIntro() {
    return h('div', {},
      gameHeader({ title: 'بچه گربه‌های منفجر شونده', onBack: onExit }),
      h('section', { class: 'kit-hero print-edge' },
        h('div', { class: 'kit-hero__cards', 'aria-hidden': 'true' },
          h('span', { class: 'kit-hero__card kit-hero__card--boom' }, '💥'),
          h('span', { class: 'kit-hero__card' }, '✚'),
          h('span', { class: 'kit-hero__card' }, '⊘')
        ),
        h('div', { class: 'kit-hero__text' },
          h('div', { class: 'kit-hero__kicker' }, 'بکش… یا منفجر شو'),
          h('h1', {}, 'نوبتت را با کارت بگذران'),
          h('p', {}, 'هر کارت اکشن یک راه فرار است. آخرین نفری که می‌ماند، برنده است.')
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
      gameHeader({ title: 'راهنمای بچه گربه‌ها', onBack: () => { screen = 'intro'; render(); } }),
      sheet({ title: 'قواعد', iconName: 'book', children: helpBlock(RULES) }),
      sheet({ title: 'کارت‌ها', iconName: 'cards', children:
        h('ul', { class: 'kit-kinds' },
          ...Object.values(KIND).filter(k => k.text).map(k => h('li', { class: 'kit-kinds__row' },
            h('span', { class: `kit-kinds__glyph tone-${k.tone}` }, k.glyph),
            h('span', { class: 'kit-kinds__body' },
              h('strong', {}, k.label),
              h('span', {}, k.text))
          ))
        )
      }),
      h('div', { class: 'stack' },
        btn('فهمیدم', { variant: 'btn--primary btn--block', onClick: () => { screen = 'intro'; render(); } })
      )
    );
  }

  /* ------------------------------ بازی ------------------------------ */

  function drawPlay() {
    const g = state;
    const myTurn = g.turn === 0 && !kittensOver(g);
    const hand = handOf(g, 0);
    const canNope = g.lastAction && !g.lastAction.noped && g.lastAction.seat !== 0 && hand.some(c => c.kind === 'nope');

    return h('div', {},
      gameHeader({
        title: 'میز بچه گربه‌ها',
        onBack: () => { cleanup(); screen = 'intro'; render(); },
        children: [
          h('span', { class: 'score-pill' }, `${toFa(g.deck.length)} کارت در دسته`),
          h('span', { class: 'score-pill' }, `${toFa(hand.length)} در دستت`)
        ]
      }),

      seatStrip(g.names.map((n, i) => ({
        name: n,
        meta: g.alive[i] ? `${toFa(handOf(g, i).length)} کارت` : 'بیرون',
        active: g.turn === i, mine: i === 0
      }))),

      h('section', { class: 'kit-table' },
        h('button', {
          class: 'kit-deck', disabled: !myTurn,
          'aria-label': `کشیدن کارت از دسته، ${toFa(g.deck.length)} کارت مانده`,
          onclick: onDraw
        },
          h('span', { class: 'kit-deck__back', 'aria-hidden': 'true' }, '❦'),
          h('span', { class: 'kit-deck__count' }, `${toFa(g.deck.length)}`)
        ),
        h('div', { class: 'kit-actions' },
          h('p', { class: 'kit-actions__hint' }, myTurn
            ? (g.turnsFor > 1 ? `دو بار می‌کشی (${toFa(g.turnsFor)} نوبت)` : 'کارت اکشن بازی کن، بعد بکش.')
            : `${g.names[g.turn]} بازی می‌کند…`)
        )
      ),

      g.peek ? h('section', { class: 'kit-peek print-edge' },
        h('h3', { class: 'kit-peek__title' }, 'سه کارت آینده'),
        h('div', { class: 'kit-peek__row' },
          ...g.peek.map((c, i) => h('span', {
            class: `kit-mini${c.kind === KITTEN ? ' is-boom' : ''}`
          },
            h('span', { class: 'kit-mini__glyph' }, c.kind === KITTEN ? '💥' : (KIND[c.kind]?.glyph || '?')),
            h('span', { class: 'kit-mini__lbl' }, c.kind === KITTEN ? 'گربه!' : KIND[c.kind]?.label || '')
          ))
        )
      ) : null,

      turnBanner(myTurn ? 'نوبت توست' : `${g.names[g.turn]}…`, { tone: myTurn ? 'mine' : 'theirs' }),

      canNope ? h('div', { class: 'stack' },
        btn('«نه!» — لغو کارت حریف', { variant: 'btn--danger btn--block', onClick: onNope })
      ) : null,

      sheet({ title: `دست تو (${toFa(hand.length)})`, iconName: 'cards', children:
        h('div', { class: 'kit-hand' },
          ...hand.map(c => {
            const k = KIND[c.kind];
            const playable = myTurn && c.kind !== 'defuse' && c.kind !== 'nope' && !k?.pair;
            return h('button', {
              class: `kit-card tone-${k?.tone || 'move'}${playable ? ' is-playable' : ''}`,
              disabled: !playable,
              'aria-label': `${k?.label || c.kind}`,
              onclick: playable ? () => onPlayCard(c) : null
            },
              h('span', { class: 'kit-card__glyph' }, k?.glyph || '?'),
              h('span', { class: 'kit-card__label' }, k?.label || c.kind)
            );
          })
        )
      }),

      note ? tableNote(note, { tone: noteTone }) : null
    );
  }

  function onDraw() {
    if (!state || state.turn !== 0) return;
    const r = drawCard(state, 0);
    if (!r.ok) { setNote(r.error, 'bad'); render(); return; }
    state = r.game;
    if (r.boom && r.eliminated) { setNote('گربهٔ منفجرشونده! بیرون رفتی', 'bad'); playSound('lose'); }
    else if (r.boom && r.defused) { setNote('گربه آمد — خنثی‌کننده نجاتت داد', 'info'); playSound('seal'); }
    else { setNote(`کارت: ${KIND[r.card.kind]?.label || '؟'}`, 'info'); playSound('card-deal'); }
    if (kittensOver(state)) { finish(); return; }
    render();
    scheduleBot();
  }

  function onPlayCard(card) {
    if (!state || state.turn !== 0) return;
    const r = playCard(state, 0, card.id);
    if (!r.ok) { setNote(r.error, 'bad'); playSound('error'); render(); return; }
    state = r.game;
    setNote(KIND[card.kind]?.text || 'کارت بازی شد', 'info');
    playSound('paper-flip');
    if (kittensOver(state)) { finish(); return; }
    render();
  }

  function onNope() {
    if (!state) return;
    const nope = handOf(state, 0).find(c => c.kind === 'nope');
    if (!nope) return;
    const r = playNope(state, 0, nope.id);
    if (!r.ok) { setNote(r.error, 'bad'); render(); return; }
    state = r.game;
    setNote('کارت حریف لغو شد', 'info');
    playSound('seal');
    render();
  }

  /* ------------------------------ پایان ------------------------------ */

  function drawOver() {
    const won = state?.winner === 0;
    return h('div', {},
      gameHeader({ title: won ? 'زنده ماندی' : 'منفجر شدی', onBack: onExit }),
      h('section', { class: `kit-result${won ? ' is-win' : ''}` },
        h('div', { class: 'kit-result__seal', 'aria-hidden': 'true' }, won ? '❦' : '💥'),
        h('h2', {}, won ? 'آخرین بازمانده تویی' : `${state?.names?.[state?.winner] ?? 'رقیب'} برد`),
        h('p', {}, won ? 'همهٔ گربه‌ها برای بقیه بود.' : 'دفعهٔ بعد کارت «نه!» را نگه دار.')
      ),
      h('div', { class: 'stack' },
        btn('دست تازه', { variant: 'btn--primary btn--block', onClick: start }),
        btn('بازگشت', { variant: 'btn--ghost btn--block', onClick: onExit })
      )
    );
  }

  return () => { cleanup(); state = null; };
}
