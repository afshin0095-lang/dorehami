/* ============================================================
   «کرم کبابی» (Heckmeck) — هشت تاس، کرم‌های ۲۱ تا ۳۶
   ============================================================ */

import { h, mount, playSound, stats, toFa } from '../core.js';
import {
  WORM_DICE, WORM_FACE, TILE_MIN, TILE_MAX, RULES, faceName,
  createWorms, roll, pick, takeTile, bustTurn, discardRest,
  currentSum, wormsOver, isWorm, wormsBot, sum
} from '../engines/worms.js';
import { gameHeader, sheet, btn, helpBlock } from '../ui/kit.js';
import { die, turnBanner, seatStrip, tableNote } from '../ui/tablekit.js';

export function mountGame(root, { onExit, game } = {}) {
  let screen = 'intro';
  let state = null;
  let note = ''; let noteTone = 'info';
  let selected = [];
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
    note = ''; selected = [];
    state = createWorms({ players: 2, seed: (Date.now() ^ Math.random() * 1e6) >>> 0 });
    screen = 'play';
    playSound('dice');
    render();
  }

  function finish() {
    cleanup();
    if (!state || state._recorded) return;
    state._recorded = true;
    const won = state.winner === 0;
    stats.record('heckmeck', {
      key: 'heckmeck-best', best: state.owned[0].length, higherIsBetter: true,
      label: `${state.owned[0].length} کرم`
    });
    playSound(won ? 'win' : 'lose');
    screen = 'over';
    render();
  }

  function scheduleBot() {
    cleanup();
    if (!state || wormsOver(state) || state.turn === 0) return;
    botTimer = setTimeout(() => {
      botTimer = null;
      if (!state || wormsOver(state) || state.turn === 0) return;
      const ch = wormsBot(state, state.turn);
      let r;
      if (ch.action === 'roll') r = roll(state);
      else if (ch.action === 'pick') r = pick(state, ch.indices);
      else if (ch.action === 'take') r = takeTile(state);
      else if (ch.action === 'reroll') r = discardRest(state);
      else r = bustTurn(state);
      if (!r.ok) r = bustTurn(state);
      if (!r.ok) { finish(); return; }
      state = r.game;
      playSound(ch.action === 'take' ? 'win' : ch.action === 'roll' ? 'dice' : 'tap');
      if (wormsOver(state)) { finish(); return; }
      render();
      scheduleBot();
    }, 620);
  }

  /* ------------------------------ مقدمه ------------------------------ */

  function drawIntro() {
    return h('div', {},
      gameHeader({ title: 'کرم کبابی', onBack: onExit }),
      h('section', { class: 'hm-hero print-edge' },
        h('div', { class: 'hm-hero__dice', 'aria-hidden': 'true' },
          ...[6, 4, 4, 2, 5, 1].map(v => die(v))
        ),
        h('div', { class: 'hm-hero__text' },
          h('div', { class: 'hm-hero__kicker' }, '۸ تاس · کرم‌های ۲۱ تا ۳۶'),
          h('h1', {}, 'مجموع بخوان، کرم بگیر'),
          h('p', {}, 'تاس‌های هم‌وجه را کنار بگذار. اگر مجموعت روی یک کرم بنشیند، مال توست.')
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
      gameHeader({ title: 'راهنمای کرم کبابی', onBack: () => { screen = 'intro'; render(); } }),
      sheet({ title: 'قواعد', iconName: 'book', children: helpBlock(RULES) }),
      h('div', { class: 'stack' },
        btn('فهمیدم', { variant: 'btn--primary btn--block', onClick: () => { screen = 'intro'; render(); } })
      )
    );
  }

  /* ------------------------------ بازی ------------------------------ */

  function drawPlay() {
    const g = state;
    const myTurn = g.turn === 0 && !wormsOver(g);
    const total = currentSum(g);
    const canTake = myTurn && (g.phase === 'choose' || g.phase === 'roll') && g.tiles.includes(total) && total > 0;
    const picked = selected.map(i => g.dice[i]).filter(v => v !== undefined);
    const pickedValid = picked.length > 0
      && new Set(picked).size === 1
      && !(isWorm(picked[0]) && picked.length > 1);

    return h('div', {},
      gameHeader({
        title: 'میز کرم کبابی',
        onBack: () => { cleanup(); screen = 'intro'; render(); },
        children: [
          h('span', { class: 'score-pill' }, `مجموع ${toFa(total)}`),
          h('span', { class: 'score-pill' }, `${toFa(g.tiles.length)} کرم روی میز`)
        ]
      }),

      seatStrip(g.names.map((n, i) => ({
        name: n, meta: `${toFa(g.owned[i].length)} کرم`,
        active: g.turn === i, mine: i === 0
      }))),

      /* تاس‌های باقی‌مانده */
      h('section', { class: 'hm-tray', 'aria-label': 'تاس‌ها' },
        h('div', { class: 'hm-tray__row' },
          ...g.dice.map((v, i) => die(v, {
            held: selected.includes(i),
            label: `تاس ${i + 1}: ${faceName(v)}`,
            onClick: myTurn && g.phase === 'choose' ? () => onToggle(i) : null
          }))
        ),
        picked.length
          ? h('p', { class: 'hm-tray__hint' },
              pickedValid
                ? `انتخاب: ${picked.join('، ')} = ${toFa(sum(picked))}`
                : 'تاس‌ها باید هم‌وجه باشند (کرم‌ها یکی‌یکی)')
          : h('p', { class: 'hm-tray__hint' }, myTurn && g.phase === 'choose'
              ? 'تاس‌های هم‌وجه را انتخاب کن.' : '')
      ),

      /* تاس‌های کنارگذاشته */
      g.setAside.length ? h('section', { class: 'hm-aside' },
        h('span', { class: 'hm-aside__lbl' }, 'کنارگذاشته'),
        h('span', { class: 'hm-aside__vals' },
          ...g.setAside.map((v, i) =>
            h('span', { class: `hm-chip${isWorm(v) ? ' is-worm' : ''}`, key: i }, faceName(v)))
        ),
        h('strong', { class: 'hm-aside__sum' }, `= ${toFa(total)}`)
      ) : null,

      turnBanner(
        myTurn
          ? (g.phase === 'roll' ? 'بریز' : canTake ? `کرم ${toFa(total)} را بگیر!` : 'تاس انتخاب کن یا بریز')
          : `${g.names[g.turn]} در حال بازی…`,
        { tone: myTurn ? 'mine' : 'theirs' }
      ),

      h('div', { class: 'hm-actions' },
        btn(g.phase === 'choose' ? 'کنار گذاشتن انتخاب' : 'ریختن تاس‌ها', {
          variant: 'btn--primary btn--block',
          disabled: !myTurn || (g.phase === 'choose' && !pickedValid),
          onClick: g.phase === 'choose' ? onPick : onRoll
        }),
        btn(canTake ? `برداشتن کرم ${toFa(total)}` : 'کرمی برای این مجموع نیست', {
          variant: 'btn--teal btn--block',
          disabled: !canTake,
          onClick: onTake
        }),
        btn('دور ریختن تاس‌های باقی‌مانده', {
          variant: 'btn--ghost btn--block',
          disabled: !myTurn || g.phase !== 'choose' || !g.dice.length,
          onClick: onDiscard
        })
      ),

      /* کرم‌های میز */
      sheet({ title: 'کرم‌های روی میز', iconName: 'dice', children:
        h('div', { class: 'hm-tiles' },
          ...Array.from({ length: TILE_MAX - TILE_MIN + 1 }, (_, i) => TILE_MIN + i).map(n => {
            const onTable = g.tiles.includes(n);
            return h('span', {
              class: `hm-tile${onTable ? '' : ' is-taken'}${n === total && myTurn ? ' is-target' : ''}`
            }, toFa(n));
          })
        )
      }),

      /* کرم‌های من */
      g.owned[0].length ? h('section', { class: 'hm-owned' },
        h('span', { class: 'hm-owned__lbl' }, `کرم‌های تو (${toFa(g.owned[0].length)})`),
        h('span', { class: 'hm-owned__vals' },
          ...g.owned[0].slice().sort((a, b) => a - b).map(n => h('span', { class: 'hm-tile is-mine' }, toFa(n)))
        )
      ) : null,

      note ? tableNote(note, { tone: noteTone }) : null
    );
  }

  const sync = (s) => { state = s; render(); };

  function onToggle(i) {
    if (!state || state.turn !== 0) return;
    selected = selected.includes(i) ? selected.filter(k => k !== i) : [...selected, i];
    playSound('tap');
    render();
  }

  function onRoll() {
    if (!state || state.turn !== 0) return;
    const r = roll(state);
    if (!r.ok) { setNote(r.error, 'bad'); render(); return; }
    state = r.game; selected = [];
    playSound('dice');
    render();
  }

  function onPick() {
    if (!state || state.turn !== 0) return;
    const r = pick(state, selected);
    if (!r.ok) { setNote(r.error, 'bad'); playSound('error'); render(); return; }
    state = r.game; selected = [];
    playSound('card-slide');
    if (wormsOver(state)) { finish(); return; }
    render();
  }

  function onTake() {
    if (!state || state.turn !== 0) return;
    const r = takeTile(state);
    if (!r.ok) { setNote(r.error, 'bad'); render(); return; }
    state = r.game;
    setNote(`کرم ${toFa(r.tile)} مال تو شد`, 'info');
    playSound('win');
    if (wormsOver(state)) { finish(); return; }
    render();
    scheduleBot();
  }

  function onDiscard() {
    if (!state || state.turn !== 0) return;
    const r = discardRest(state);
    if (!r.ok) { setNote(r.error, 'bad'); render(); return; }
    state = r.game; selected = [];
    playSound('card-slide');
    render();
  }

  /* ------------------------------ پایان ------------------------------ */

  function drawOver() {
    const won = state?.winner === 0;
    return h('div', {},
      gameHeader({ title: won ? 'بردی' : 'باختی', onBack: onExit }),
      h('section', { class: `hm-result${won ? ' is-win' : ''}` },
        h('div', { class: 'hm-result__seal', 'aria-hidden': 'true' }, won ? '❧' : '☾'),
        h('h2', {}, won ? 'بیشترین کرم مال تو بود' : 'رقیب بیشتر گرفت'),
        ...state.owned.map((o, i) => h('p', {}, `${state.names[i]}: ${toFa(o.length)} کرم`))
      ),
      h('div', { class: 'stack' },
        btn('دست تازه', { variant: 'btn--primary btn--block', onClick: start }),
        btn('بازگشت', { variant: 'btn--ghost btn--block', onClick: onExit })
      )
    );
  }

  return () => { cleanup(); state = null; };
}
