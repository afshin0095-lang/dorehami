/* ============================================================
   «کوییکس» — چهار ردیف رنگی روی یک برگهٔ کاغذی
   هر نوبت همه علامت می‌زنند؛ هیچ‌کس منتظر نمی‌ماند.
   ============================================================ */

import { h, mount, playSound, stats, toFa } from '../core.js';
import {
  ROWS, ROW, RULES, PENALTY, MAX_PENALTIES, LOCKS_TO_END, faceName,
  createQwixx, rollDice, mark, endActive, markPassive, passivePass,
  legalMoves, sheetScore, qwixxOver, rowLocked, markedOf
} from '../engines/qwixx.js';
import { gameHeader, sheet, btn, helpBlock } from '../ui/kit.js';
import { die, turnBanner, seatStrip, tableNote } from '../ui/tablekit.js';

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
    state = createQwixx({ players: 2, seed: (Date.now() ^ Math.random() * 1e6) >>> 0 });
    screen = 'play';
    playSound('dice');
    render();
  }

  function finish() {
    cleanup();
    if (!state || state._recorded) return;
    state._recorded = true;
    const won = state.winner === 0;
    const mine = state.totals ? state.totals[0] : sheetScore(state.sheets[0], state.locked);
    stats.record('qwixx', {
      key: 'qwixx-best', best: mine, higherIsBetter: true,
      label: `${mine} امتیاز`
    });
    playSound(won ? 'win' : 'lose');
    screen = 'over';
    render();
  }

  /* ------------------------------ نوبت رقیب ------------------------------ */

  function scheduleBot() {
    cleanup();
    if (!state || qwixxOver(state)) return;
    const phase = state.phase;
    const isBotTurn = phase === 'active' && state.turn !== 0;
    const isBotPassive = phase === 'passive' && state.passiveSeat !== 0;
    if (!isBotTurn && !isBotPassive) return;

    botTimer = setTimeout(() => {
      botTimer = null;
      if (!state || qwixxOver(state)) return;
      let r;
      if (state.phase === 'active' && state.turn !== 0) {
        const seat = state.turn;
        const moves = legalMoves(state, seat, true);
        if (moves.length) {
          const best = moves[moves.length - 1];
          r = mark(state, seat, best.row, best.value, true);
          playSound('tap');
        } else {
          r = endActive(state);
          playSound('card-slide');
        }
      } else if (state.phase === 'passive' && state.passiveSeat !== 0) {
        const seat = state.passiveSeat;
        const moves = legalMoves(state, seat, false);
        if (moves.length) {
          r = markPassive(state, seat, moves[moves.length - 1].row, moves[moves.length - 1].value);
          playSound('tap');
        } else {
          r = passivePass(state);
          playSound('card-slide');
        }
      }
      if (!r || !r.ok) { finish(); return; }
      state = r.game;
      if (r.ended || qwixxOver(state)) { finish(); return; }
      render();
      if (state.phase === 'roll') autoRollForMe();
      else scheduleBot();
    }, 480);
  }

  /** بعد از تمام‌شدن دور رقبا، نوبت من است: تاس می‌ریزم */
  function autoRollForMe() {
    if (!state || state.phase !== 'roll' || state.turn !== 0) return;
    const r = rollDice(state);
    if (r.ok) { state = r.game; playSound('dice'); render(); }
  }

  /* ------------------------------ مقدمه ------------------------------ */

  function drawIntro() {
    return h('div', {},
      gameHeader({ title: 'کوییکس', onBack: onExit }),
      h('section', { class: 'qw-hero print-edge' },
        h('div', { class: 'qw-hero__rows', 'aria-hidden': 'true' },
          ...ROWS.map((row, ri) => h('div', { class: `qw-row qw-row--${row.id} qw-row--mini` },
            ...Array.from({ length: 9 }, (_, i) => h('span', {
              class: `qw-cell${i < (9 - ri) ? ' is-marked' : ''}`
            }))
          ))
        ),
        h('div', { class: 'qw-hero__text' },
          h('div', { class: 'qw-hero__kicker' }, '۲ تاس سفید · ۴ تاس رنگی'),
          h('h1', {}, 'همه در هر نوبت علامت می‌زنند'),
          h('p', {}, 'خانه‌ها را از چپ به راست بزن. ردیفی که کامل شد، قفل می‌شود.')
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
      gameHeader({ title: 'راهنمای کوییکس', onBack: () => { screen = 'intro'; render(); } }),
      sheet({ title: 'قواعد', iconName: 'book', children: helpBlock(RULES) }),
      h('div', { class: 'stack' },
        btn('فهمیدم', { variant: 'btn--primary btn--block', onClick: () => { screen = 'intro'; render(); } })
      )
    );
  }

  /* ------------------------------ بازی ------------------------------ */

  function drawPlay() {
    const g = state;
    const iAmActive = g.phase === 'active' && g.turn === 0;
    const iAmPassive = g.phase === 'passive' && g.passiveSeat === 0;
    const myMoves = iAmActive ? legalMoves(g, 0, true) : iAmPassive ? legalMoves(g, 0, false) : [];
    const canMark = iAmActive || iAmPassive;
    const whiteSum = g.white[0] + g.white[1];

    return h('div', {},
      gameHeader({
        title: 'برگهٔ کوییکس',
        onBack: () => { cleanup(); screen = 'intro'; render(); },
        children: [
          h('span', { class: 'score-pill' }, `امتیاز ${toFa(sheetScore(g.sheets[0], g.locked))}`),
          h('span', { class: 'score-pill' }, `جریمه ${toFa(g.sheets[0].penalties)}`)
        ]
      }),

      seatStrip(g.names.map((n, i) => ({
        name: n,
        meta: `جریمه ${toFa(g.sheets[i].penalties)}`,
        active: (g.phase === 'active' && g.turn === i) || (g.phase === 'passive' && g.passiveSeat === i),
        mine: i === 0
      }))),

      /* تاس‌ها */
      h('section', { class: 'qw-dice', 'aria-label': 'تاس‌ها' },
        h('div', { class: 'qw-dice__group' },
          h('span', { class: 'qw-dice__lbl' }, 'سفید'),
          h('div', { class: 'qw-dice__row' },
            ...g.white.map((v, i) => die(v, { label: `تاس سفید ${i + 1}: ${faceName(v)}` }))
          ),
          h('span', { class: 'qw-dice__sum' }, `جمع ${toFa(whiteSum)}`)
        ),
        h('div', { class: 'qw-dice__group' },
          h('span', { class: 'qw-dice__lbl' }, 'رنگی'),
          h('div', { class: 'qw-dice__row' },
            ...ROWS.map(row => g.colour[row.id] > 0
              ? h('div', { class: `qw-colour qw-colour--${row.id}` },
                  die(g.colour[row.id], { label: `تاس ${row.label}: ${faceName(g.colour[row.id])}` }))
              : null)
          )
        )
      ),

      turnBanner(
        iAmActive ? 'نوبت توست — یک خانه بزن یا پایان بده'
          : iAmPassive ? 'با تاس سفید علامت بزن'
            : g.phase === 'active' ? `${g.names[g.turn]} بازی می‌کند…` : 'نوبت بقیه…',
        { tone: canMark ? 'mine' : 'theirs' }
      ),

      /* برگهٔ من */
      h('section', { class: 'qw-sheet' },
        ...ROWS.map(row => {
          const marks = markedOf(g, 0, row.id);
          const locked = rowLocked(g, row.id);
          return h('div', { class: `qw-row qw-row--${row.id}${locked ? ' is-locked' : ''}` },
            h('span', { class: 'qw-row__label' }, row.label),
            h('div', { class: 'qw-row__cells' },
              ...row.cells.map(v => {
                const isMarked = marks.includes(v);
                const isLegal = canMark && myMoves.some(m => m.row === row.id && m.value === v);
                return h('button', {
                  class: `qw-cell${isMarked ? ' is-marked' : ''}${isLegal ? ' is-legal' : ''}${locked ? ' is-locked' : ''}`,
                  disabled: !isLegal,
                  'aria-label': `ردیف ${row.label}، خانهٔ ${toFa(v)}${isMarked ? ' (علامت‌خورده)' : ''}`,
                  onclick: isLegal ? () => onMark(row.id, v) : null
                }, isMarked ? '×' : toFa(v));
              }),
              h('span', { class: 'qw-row__lock', title: 'قفل با آخرین خانه' }, locked ? '🔒' : '')
            )
          );
        })
      ),

      canMark ? h('div', { class: 'qw-actions' },
        btn(iAmActive ? 'پایان نوبت' : 'من حرکتی ندارم (جریمه)', {
          variant: 'btn--ghost btn--block',
          onClick: iAmActive ? onEndActive : onPassivePass
        })
      ) : null,

      note ? tableNote(note, { tone: noteTone }) : null
    );
  }

  function onMark(rowId, value) {
    if (!state) return;
    const active = state.phase === 'active' && state.turn === 0;
    const passive = state.phase === 'passive' && state.passiveSeat === 0;
    if (!active && !passive) return;
    const r = active
      ? mark(state, 0, rowId, value, true)
      : markPassive(state, 0, rowId, value);
    if (!r.ok) { setNote(r.error, 'bad'); playSound('error'); render(); return; }
    state = r.game;
    setNote(`${ROW[rowId].label} ${toFa(value)} علامت خورد`, 'info');
    playSound('tap');
    if (r.ended || qwixxOver(state)) { finish(); return; }
    render();
    scheduleBot();
  }

  function onEndActive() {
    if (!state || state.phase !== 'active' || state.turn !== 0) return;
    const r = endActive(state);
    if (!r.ok) { setNote(r.error, 'bad'); render(); return; }
    state = r.game;
    setNote('نوبت به بقیه رسید', 'info');
    playSound('card-slide');
    if (r.ended || qwixxOver(state)) { finish(); return; }
    render();
    scheduleBot();
  }

  function onPassivePass() {
    if (!state || state.phase !== 'passive') return;
    const r = passivePass(state);
    if (!r.ok) { setNote(r.error, 'bad'); render(); return; }
    state = r.game;
    setNote(`یک جریمه (${toFa(PENALTY)}−)`, 'bad');
    playSound('error');
    if (r.ended || qwixxOver(state)) { finish(); return; }
    render();
    if (state.phase === 'roll') autoRollForMe();
    else scheduleBot();
  }

  /* ------------------------------ پایان ------------------------------ */

  function drawOver() {
    const won = state?.winner === 0;
    const totals = state?.totals || state?.sheets?.map(s => sheetScore(s, state.locked)) || [];
    return h('div', {},
      gameHeader({ title: won ? 'بردی' : 'باختی', onBack: onExit }),
      h('section', { class: `qw-result${won ? ' is-win' : ''}` },
        h('div', { class: 'qw-result__seal', 'aria-hidden': 'true' }, won ? '❧' : '☾'),
        h('h2', {}, won ? 'بالاترین امتیاز مال تو بود' : 'رقیب جلو زد'),
        h('div', { class: 'qw-result__scores' },
          ...totals.map((t, i) => h('div', { class: `qw-result__score${i === 0 ? ' is-mine' : ''}` },
            h('span', { class: 'qw-result__name' }, state.names[i]),
            h('strong', { class: 'qw-result__val' }, toFa(t))
          ))
        )
      ),
      h('div', { class: 'stack' },
        btn('برگهٔ تازه', { variant: 'btn--primary btn--block', onClick: start }),
        btn('بازگشت', { variant: 'btn--ghost btn--block', onClick: onExit })
      )
    );
  }

  return () => { cleanup(); state = null; };
}
