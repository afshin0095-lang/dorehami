/* ============================================================
   «اسکایجو» — شبکهٔ کارت‌های پنهان، کمترین امتیاز برنده
   ============================================================ */

import { h, mount, playSound, stats, toFa } from '../core.js';
import {
  COLS, SLOTS, RULES, createSkyjo, topDiscard, takeDiscard, drawHidden,
  placeCard, discardHeld, gridScore, columnCleared, skyjoOver, skyjoBot, cardName, SKYJO_TARGET
} from '../engines/skyjo.js';
import { gameHeader, sheet, btn, helpBlock } from '../ui/kit.js';
import { turnBanner, seatStrip, tableNote } from '../ui/tablekit.js';

export function mountGame(root, { onExit, game } = {}) {
  let screen = 'intro';
  let state = null;
  let note = ''; let noteTone = 'info';
  let pickOpen = false;      // کارت دست برداشته شده؟ انتخاب خانه
  let botTimer = null;

  const render = () => mount(root, draw());
  render();

  const cleanup = () => { if (botTimer) { clearTimeout(botTimer); botTimer = null; } };
  const setNote = (t, tone = 'info') => { note = t; noteTone = tone; };

  function draw() {
    if (screen === 'help') return drawHelp();
    if (screen === 'play') return drawPlay();
    return drawIntro();
  }

  function start() {
    cleanup();
    note = ''; pickOpen = false;
    state = createSkyjo({ players: 2, seed: (Date.now() ^ Math.random() * 1e6) >>> 0 });
    screen = 'play';
    playSound('card-deal');
    render();
    scheduleBot();
  }

  function scheduleBot() {
    cleanup();
    if (!state || skyjoOver(state) || state.turn === 0) return;
    botTimer = setTimeout(() => {
      botTimer = null;
      if (!state || skyjoOver(state) || state.turn === 0) return;
      const seat = state.turn;
      const ch = skyjoBot(state, seat);
      let r;
      if (ch.action === 'take') {
        const t = takeDiscard(state);
        if (t.ok) r = placeCard(t.game, ch.index);
        if (!r || !r.ok) r = drawHidden(state);
      } else {
        const t = drawHidden(state);
        if (t.ok) {
          const grid = t.game.grids[seat];
          const target = grid.findIndex(c => !c.faceUp);
          r = target >= 0 ? placeCard(t.game, target) : t.game && { ok: true, game: discardHeld(t.game, 0).game };
        }
      }
      if (r && r.ok) { state = r.game; playSound('card-slide'); } else { const d = drawHidden(state); if (d.ok) state = d.game; }
      if (skyjoOver(state)) { finish(); return; }
      render();
      scheduleBot();
    }, 560);
  }

  function finish() {
    cleanup();
    if (!state || state._recorded) return;
    state._recorded = true;
    const won = state.winner === 0;
    stats.record('skyjo', {
      key: 'skyjo-wins', best: won ? 1 : 0, higherIsBetter: true,
      label: `${won ? 'برد' : 'باخت'} · ${toFa(state.scores[0])}`
    });
    playSound(won ? 'win' : 'lose');
    screen = 'over';
    render();
  }

  /* ------------------------------ مقدمه ------------------------------ */

  function drawIntro() {
    return h('div', {},
      gameHeader({ title: 'اسکایجو', onBack: onExit }),
      h('section', { class: 'skyjo-hero print-edge' },
        h('div', { class: 'skyjo-hero__grid', 'aria-hidden': 'true' },
          ...[7, 9, 2, 5, 12, 3, 1, 8, 4, 6, 11, 0].map((v, i) =>
            h('span', { class: `skyjo-mini${i < 8 ? ' is-open' : ''}` }, i < 8 ? toFa(v) : ''))
        ),
        h('div', { class: 'skyjo-hero__text' },
          h('div', { class: 'skyjo-hero__kicker' }, '۱۲ کارت · کمترین امتیاز'),
          h('h1', {}, 'کمترین عدد را نگه دار'),
          h('p', {}, 'کارت‌ها پنهان‌اند. ستون هم‌عدد پاک می‌شود و امتیازت را کم می‌کند.')
        )
      ),
      h('div', { class: 'stack' },
        btn('شروع دور', { variant: 'btn--primary btn--block', onClick: start }),
        btn('راهنما', { onClick: () => { screen = 'help'; render(); } })
      )
    );
  }

  function drawHelp() {
    return h('div', {},
      gameHeader({ title: 'راهنمای اسکایجو', onBack: () => { screen = 'intro'; render(); } }),
      sheet({ title: 'قواعد', iconName: 'book', children: helpBlock(RULES) }),
      h('div', { class: 'stack' },
        btn('فهمیدم', { variant: 'btn--primary btn--block', onClick: () => { screen = 'intro'; render(); } })
      )
    );
  }

  /* ------------------------------ بازی ------------------------------ */

  function drawPlay() {
    const g = state;
    const myTurn = g.turn === 0;
    const top = topDiscard(g);
    const myGrid = g.grids[0];

    return h('div', {},
      gameHeader({
        title: 'میز اسکایجو',
        onBack: () => { cleanup(); screen = 'intro'; render(); },
        children: [
          h('span', { class: 'score-pill' }, `امتیاز دور ${toFa(gridScore(myGrid))}`),
          h('span', { class: 'score-pill' }, `دور ${toFa(g.round)}`)
        ]
      }),

      seatStrip(g.names.map((n, i) => ({
        name: n,
        meta: `${toFa(gridScore(g.grids[i]))}`,
        active: g.turn === i, mine: i === 0
      }))),

      /* رقیب‌ها */
      ...g.grids.slice(1).map((grid, idx) => h('section', { class: 'skyjo-rival' },
        h('div', { class: 'skyjo-rival__name' }, g.names[idx + 1]),
        h('div', { class: 'skyjo-grid skyjo-grid--small' },
          ...grid.map((c, i) => h('span', {
            class: `skyjo-tile${c.faceUp ? ' is-open' : ''}${columnCleared(grid, i % COLS) ? ' is-cleared' : ''}`
          }, c.faceUp ? toFa(c.value) : ''))
        )
      )),

      /* میز برداشت */
      h('section', { class: 'skyjo-pile' },
        h('button', {
          class: 'skyjo-draw', disabled: !myTurn || pickOpen,
          'aria-label': `برداشت از انبار، ${toFa(g.deck.length)} کارت`,
          onclick: onDraw
        },
          h('span', { class: 'skyjo-draw__back', 'aria-hidden': 'true' }, '❧'),
          h('span', { class: 'skyjo-draw__count' }, `${toFa(g.deck.length)} کارت`)
        ),
        top
          ? h('button', {
              class: `skyjo-discard${top.value < 0 ? ' is-negative' : ''}`,
              disabled: !myTurn || pickOpen,
              'aria-label': `برداشت کارت روی زمین: ${cardName(top.value)}`,
              onclick: onTake
            },
              h('span', { class: 'skyjo-discard__val' }, cardName(top.value)),
              h('span', { class: 'skyjo-discard__lbl' }, 'روی زمین')
            )
          : null
      ),

      turnBanner(
        pickOpen ? 'کارت را با یکی از کارت‌هایت عوض کن، یا دور بریز'
          : myTurn ? 'نوبت توست — از انبار یا زمین بردار'
            : `${g.names[g.turn]} بازی می‌کند…`,
        { tone: myTurn ? 'mine' : 'theirs' }
      ),

      /* کارت در دست */
      pickOpen && g.held ? h('section', { class: 'skyjo-held' },
        h('span', { class: 'skyjo-held__card' }, cardName(g.held.value)),
        h('span', { class: 'skyjo-held__lbl' }, 'در دستت')
      ) : null,

      /* شبکهٔ من */
      sheet({ title: 'کارت‌های تو', iconName: 'cards', children:
        h('div', { class: 'skyjo-grid' },
          ...myGrid.map((c, i) => {
            const open = c.faceUp;
            const cleared = columnCleared(myGrid, i % COLS);
            const clickable = myTurn && (pickOpen || (!open && false));
            return h('button', {
              class: `skyjo-tile${open ? ' is-open' : ''}${cleared ? ' is-cleared' : ''}${clickable ? ' is-target' : ''}`,
              disabled: !clickable,
              'aria-label': `خانهٔ ${i + 1}${open ? `: ${cardName(c.value)}` : ': پنهان'}`,
              onclick: clickable ? () => onPlace(i) : null
            }, open ? toFa(c.value) : '');
          })
        )
      }),

      pickOpen ? btn('دور ریختن کارت و رو کردن یکی از مال خودت', {
        variant: 'btn--ghost btn--block', onClick: () => { pickOpen = false; setNote('یک خانهٔ پنهان را لمس کن', 'info'); render(); }
      }) : null,

      note ? tableNote(note, { tone: noteTone }) : null
    );
  }

  function onDraw() {
    if (!state || state.turn !== 0) return;
    const r = drawHidden(state);
    if (!r.ok) { setNote(r.error, 'bad'); render(); return; }
    state = r.game;
    pickOpen = true;
    setNote(`کارت پنهان: ${cardName(r.card.value)} — جایش را انتخاب کن`, 'info');
    playSound('card-slide');
    render();
  }

  function onTake() {
    if (!state || state.turn !== 0) return;
    const r = takeDiscard(state);
    if (!r.ok) { setNote(r.error, 'bad'); render(); return; }
    state = r.game;
    pickOpen = true;
    setNote(`کارت ${cardName(r.card.value)} برداشتی — جایش را انتخاب کن`, 'info');
    playSound('tap');
    render();
  }

  function onPlace(i) {
    if (!state || state.turn !== 0 || !pickOpen) return;
    const r = placeCard(state, i);
    if (!r.ok) { setNote(r.error, 'bad'); playSound('error'); render(); return; }
    state = r.game;
    pickOpen = false;
    setNote(r.cleared ? 'ستون پاک شد!' : 'کارت گذاشته شد', r.cleared ? 'info' : 'info');
    playSound(r.cleared ? 'win' : 'card-deal');
    if (skyjoOver(state)) { finish(); return; }
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
        h('h2', {}, won ? 'کمترین امتیاز مال تو بود' : 'رقیب کمترین امتیاز را داشت'),
        ...state.scores.map((s, i) => h('p', {}, `${state.names[i]}: ${toFa(s)} امتیاز`))
      ),
      h('div', { class: 'stack' },
        btn('دور تازه', { variant: 'btn--primary btn--block', onClick: start }),
        btn('بازگشت', { variant: 'btn--ghost btn--block', onClick: onExit })
      )
    );
  }

  return () => { cleanup(); state = null; };
}
